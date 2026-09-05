import { describe, expect, it } from "bun:test";
import { checkoutScreen, checkoutTitle, type CheckoutScreenState } from "./checkout-screen";

const base: CheckoutScreenState = {
  isLoading: false,
  isUnavailable: false,
  bagIsEmpty: false,
  placing: false,
  hasNotices: false,
};

describe("checkoutScreen", () => {
  it("shows the loading screen before anything about the bag is known", () => {
    expect(checkoutScreen({ ...base, isLoading: true, bagIsEmpty: true })).toBe("loading");
  });

  it("prefers unavailable over empty when every cart failed", () => {
    expect(checkoutScreen({ ...base, isUnavailable: true, bagIsEmpty: true })).toBe("unavailable");
  });

  it("shows the form whenever the bag has anything in it", () => {
    expect(checkoutScreen(base)).toBe("form");
    expect(checkoutScreen({ ...base, placing: true })).toBe("form");
    expect(checkoutScreen({ ...base, hasNotices: true })).toBe("form");
  });

  it("does not call a mid-placement bag empty", () => {
    // Every cart is retired before `navigate` resolves, so the bag is briefly
    // empty while the order is still being placed.
    expect(checkoutScreen({ ...base, bagIsEmpty: true, placing: true })).toBe("placing");
  });

  it("never offers the empty-bag pitch while a notice is waiting", () => {
    // The regression this guards: a placed order whose redirect failed left an
    // empty bag and no `placing`, and the shopper was shown "add something to
    // your bag" with their order reference nowhere on screen.
    expect(checkoutScreen({ ...base, bagIsEmpty: true, hasNotices: true })).toBe("notices");
  });

  it("shows the empty screen only when the bag is empty and there is nothing to report", () => {
    expect(checkoutScreen({ ...base, bagIsEmpty: true })).toBe("empty");
  });
});

describe("checkoutTitle", () => {
  it("names the two screens that are not a checkout", () => {
    expect(checkoutTitle("unavailable")).toBe("We couldn't load your bag");
    expect(checkoutTitle("empty")).toBe("Your bag is empty");
  });

  it("keeps the notices screen titled as checkout, not as an empty bag", () => {
    expect(checkoutTitle("notices")).toBe("Checkout");
    expect(checkoutTitle("placing")).toBe("Checkout");
    expect(checkoutTitle("form")).toBe("Checkout");
    expect(checkoutTitle("loading")).toBe("Checkout");
  });
});
