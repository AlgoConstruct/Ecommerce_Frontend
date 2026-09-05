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
