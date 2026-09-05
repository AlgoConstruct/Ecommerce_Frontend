import { expect, test, describe } from "bun:test";
import { placeOrders, type PlaceOrderDeps } from "./place-order";

// `outcomes` is a plain array, so under noUncheckedIndexedAccess every
// `outcomes[i]` is `T | undefined`. Each outcome here is asserted to exist
// (via `expect(...).toBeDefined()`) rather than assumed with `!`, so a
// regression that drops an outcome still fails the test loudly instead of
// throwing a bare runtime TypeError.
function assertDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined();
}

const targets = [
  { vendorId: "store_a", vendorName: "Travories", cartId: "cart_a" },
  { vendorId: "store_b", vendorName: "The Fade", cartId: "cart_b" },
  { vendorId: "store_c", vendorName: "Kalinchowk", cartId: "cart_c" },
];

function fakeDeps(overrides: Partial<PlaceOrderDeps> = {}): PlaceOrderDeps {
  return {
    createPaymentCollection: async (cartId) => `pc_${cartId}`,
    initPaymentSession: async () => {},
    completeCart: async (cartId) => ({ ok: true, orderId: `order_${cartId}` }),
    ...overrides,
  };
}

describe("placeOrders", () => {
  test("returns one successful outcome per vendor, in order", async () => {
    const outcomes = await placeOrders(targets, "pp_system_default", fakeDeps());
    expect(outcomes.map((o) => o.vendorName)).toEqual(["Travories", "The Fade", "Kalinchowk"]);
    expect(outcomes.every((o) => o.ok)).toBe(true);
    const [first] = outcomes;
    assertDefined(first);
    expect(first.orderId).toBe("order_cart_a");
  });

  test("a failing vendor does not stop the vendors after it", async () => {
    const deps = fakeDeps({
      completeCart: async (cartId) =>
        cartId === "cart_b"
          ? { ok: false, message: "Not enough stock" }
          : { ok: true, orderId: `order_${cartId}` },
    });
    const outcomes = await placeOrders(targets, "pp_system_default", deps);
    expect(outcomes.map((o) => o.ok)).toEqual([true, false, true]);
    const [, second, third] = outcomes;
    assertDefined(second);
    assertDefined(third);
    expect(second.message).toBe("Not enough stock");
    expect(third.orderId).toBe("order_cart_c");
  });

  test("a thrown error becomes that vendor's failure, not everyone's", async () => {
    const deps = fakeDeps({
      createPaymentCollection: async (cartId) => {
        if (cartId === "cart_a") throw new Error("network down");
        return `pc_${cartId}`;
      },
    });
    const outcomes = await placeOrders(targets, "pp_system_default", deps);
    const [first, second] = outcomes;
    assertDefined(first);
    assertDefined(second);
    expect(first.ok).toBe(false);
    expect(first.message).toContain("network down");
    expect(second.ok).toBe(true);
  });

  test("processes carts one at a time so a shared inventory item cannot double-sell", async () => {
    const seen: string[] = [];
    const deps = fakeDeps({
      completeCart: async (cartId) => {
        seen.push(`start:${cartId}`);
        await new Promise((r) => setTimeout(r, 5));
        seen.push(`end:${cartId}`);
        return { ok: true, orderId: `order_${cartId}` };
      },
    });
    await placeOrders(targets, "pp_system_default", deps);
    expect(seen).toEqual([
      "start:cart_a",
      "end:cart_a",
      "start:cart_b",
      "end:cart_b",
      "start:cart_c",
      "end:cart_c",
    ]);
  });
});
