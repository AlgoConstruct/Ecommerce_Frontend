import { expect, test, describe, mock } from "bun:test";

// `mapCart` is deliberately not exported — it is an internal mapper, and
// exporting it purely for a test would widen the module's public surface for
// no production caller. `medusaClient.getCart` is the narrowest existing
// public surface that reaches it: unlike `createCart`, it needs no region
// lookup, so stubbing `sdk.client.fetch` is the whole of the setup.
//
// The stub is installed before `./medusa-client` is imported, so the module
// never constructs a real Medusa SDK client (which would want
// `import.meta.env` values that do not exist under `bun test`).
const fetchMock = mock(async (_path: string, _init?: unknown) => ({}) as unknown);

mock.module("../medusa/sdk", () => ({
  sdk: { client: { fetch: fetchMock } },
}));

const { medusaClient } = await import("./medusa-client");

interface RawCartOverrides {
  item_subtotal?: number;
  subtotal: number;
  total: number;
}

async function getCartWithTotals(totals: RawCartOverrides) {
  fetchMock.mockImplementation(async () => ({
    cart: {
      id: "cart_1",
      currency_code: "usd",
      items: [
        {
          id: "line_1",
          product_id: "prod_1",
          product_title: "Ilam First Flush Black Tea",
          product_handle: "ilam-first-flush-black-tea",
          variant_id: "variant_1",
          variant_title: "100g",
          thumbnail: null,
          quantity: 2,
          unit_price: 12,
        },
      ],
      ...totals,
    },
  }));
  const cart = await medusaClient.getCart("cart_1");
  expect(cart).not.toBeNull();
  return cart!;
}

describe("mapCart totals (via medusaClient.getCart)", () => {
  // Medusa's `subtotal` already includes shipping; `item_subtotal` is the
  // items-only figure. Verified against the live backend:
  //
  //   cart before shipping: item_subtotal 24 | subtotal 24 | shipping 0  | total 24
  //   cart after  shipping: item_subtotal 24 | subtotal 34 | shipping 10 | total 34
  //
  // The bag page and cart drawer render CartSummary.subtotal unqualified —
  // one of them labelled "Total before shipping & tax" — with no shipping
  // line to explain a jump, so reading `subtotal` prints the
  // shipping-inclusive number under a label denying it.
  test("reads the items-only subtotal, not the shipping-inclusive one", async () => {
    const cart = await getCartWithTotals({ item_subtotal: 24, subtotal: 34, total: 34 });
    expect(cart.subtotal.amount).toBe(24);
    expect(cart.total.amount).toBe(34);
  });

  test("falls back to subtotal when the payload carries no item_subtotal", async () => {
    const cart = await getCartWithTotals({ subtotal: 24, total: 24 });
    expect(cart.subtotal.amount).toBe(24);
  });

  // The `??` is load-bearing. Under a `||` typo every case above still
  // passes, because they all carry a truthy item_subtotal; only a legitimate
  // zero (an all-free bag) exposes the difference, and `||` would silently
  // restore the shipping-inclusive figure this mapper exists to avoid.
  test("preserves a legitimate item_subtotal of 0 rather than falling through", async () => {
    const cart = await getCartWithTotals({ item_subtotal: 0, subtotal: 10, total: 10 });
    expect(cart.subtotal.amount).toBe(0);
  });

  test("maps lines with decimal money, unscaled", async () => {
    const cart = await getCartWithTotals({ item_subtotal: 24, subtotal: 34, total: 34 });
    expect(cart.itemCount).toBe(2);
    expect(cart.lines[0]?.unitPrice).toEqual({ amount: 12, currency: "usd" });
    expect(cart.lines[0]?.lineTotal).toEqual({ amount: 24, currency: "usd" });
  });
});
