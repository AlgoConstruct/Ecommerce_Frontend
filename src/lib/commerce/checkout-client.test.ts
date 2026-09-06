import { expect, test, describe } from "bun:test";
import { interpretCompletion, mapShippingOption, mapTotals } from "./checkout-client";

describe("mapShippingOption", () => {
  test("reads the calculated amount as a decimal, unconverted", () => {
    const option = mapShippingOption(
      {
        id: "so_1",
        name: "Travories standard shipping",
        calculated_price: { calculated_amount: 10 },
      },
      "usd",
    );
    expect(option).toEqual({
      id: "so_1",
      name: "Travories standard shipping",
      amount: { amount: 10, currency: "usd" },
    });
  });

  test("falls back to zero when no price is calculated", () => {
    const option = mapShippingOption({ id: "so_1", name: "x", calculated_price: null }, "usd");
    expect(option.amount.amount).toBe(0);
  });
});

describe("mapTotals", () => {
  test("carries shipping and tax straight through", () => {
    expect(mapTotals({ subtotal: 34, shipping_total: 10, tax_total: 0, total: 44 }, "usd")).toEqual(
      {
        subtotal: { amount: 34, currency: "usd" },
        shipping: { amount: 10, currency: "usd" },
        tax: { amount: 0, currency: "usd" },
        total: { amount: 44, currency: "usd" },
      },
    );
  });

  test("treats missing totals as zero rather than NaN", () => {
    expect(mapTotals({ subtotal: 34, total: 34 }, "usd").tax.amount).toBe(0);
  });

  // Medusa's `subtotal` already includes shipping; `item_subtotal` is the
  // items-only figure. Reading the wrong one renders a summary that does not
  // add up — 24 + 10 + 0 must equal 34, not 34 + 10 + 0 against a total of 34.
  test("reads the items-only subtotal, not the shipping-inclusive one", () => {
    const totals = mapTotals(
      { item_subtotal: 24, subtotal: 34, shipping_total: 10, tax_total: 0, total: 34 },
      "usd",
    );
    expect(totals.subtotal.amount).toBe(24);
    expect(totals.shipping.amount).toBe(10);
    expect(totals.total.amount).toBe(34);
    expect(totals.subtotal.amount + totals.shipping.amount + totals.tax.amount).toBe(
      totals.total.amount,
    );
  });

  test("falls back to subtotal when the payload carries no item_subtotal", () => {
    expect(mapTotals({ subtotal: 24, shipping_total: 0, total: 24 }, "usd").subtotal.amount).toBe(
      24,
    );
  });

  // The `??` is load-bearing and every other test in this block passes under a
  // `||` typo, because they all carry a truthy item_subtotal. Zero is a real
  // items-only subtotal (an all-free bag) and `||` would silently discard it
  // for the shipping-inclusive figure — the exact bug this mapper exists to
  // avoid, restored by a one-character regression.
  test("preserves a legitimate item_subtotal of 0 rather than falling through", () => {
    const totals = mapTotals(
      { item_subtotal: 0, subtotal: 10, shipping_total: 10, tax_total: 0, total: 10 },
      "usd",
    );
    expect(totals.subtotal.amount).toBe(0);
    expect(totals.subtotal.amount + totals.shipping.amount + totals.tax.amount).toBe(
      totals.total.amount,
    );
  });
});

describe("interpretCompletion", () => {
  // Medusa answers HTTP 200 for BOTH outcomes. The discriminator is `type`.
  test("treats type:order as success", () => {
    expect(interpretCompletion({ type: "order", order: { id: "order_1" } })).toEqual({
      ok: true,
      orderId: "order_1",
    });
  });

  test("treats type:cart as failure and surfaces the reason", () => {
    expect(
      interpretCompletion({
        type: "cart",
        cart: { id: "cart_1" },
        error: { message: "Not enough stock" },
      }),
    ).toEqual({ ok: false, message: "Not enough stock" });
  });

  test("never reports success without an order id", () => {
    const result = interpretCompletion({ type: "order", order: null });
    expect(result.ok).toBe(false);
  });

  test("gives a readable message when the error carries none", () => {
    const result = interpretCompletion({ type: "cart", cart: { id: "cart_1" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});
