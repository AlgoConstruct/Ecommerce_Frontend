import { expect, test, describe } from "bun:test";
import { removeVendorFromCarts } from "./cart";

describe("removeVendorFromCarts", () => {
  const carts = {
    store_a: { cartId: "cart_a", vendorName: "Travories" },
    store_b: { cartId: "cart_b", vendorName: "The Fade" },
  };

  test("drops only the named vendor", () => {
    expect(removeVendorFromCarts(carts, "store_a")).toEqual({
      store_b: { cartId: "cart_b", vendorName: "The Fade" },
    });
  });

  test("leaves the map untouched when the vendor is absent", () => {
    expect(removeVendorFromCarts(carts, "store_zzz")).toEqual(carts);
  });

  test("does not mutate its input", () => {
    removeVendorFromCarts(carts, "store_a");
    expect(Object.keys(carts)).toEqual(["store_a", "store_b"]);
  });
});
