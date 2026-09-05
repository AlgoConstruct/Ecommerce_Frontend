/**
 * Which of the checkout page's mutually exclusive screens should render.
 *
 * This exists as a pure function because the page's branch order has twice
 * been the source of a real defect: first a "Your bag is empty" flash during a
 * successful placement, then — worse — a placed order whose reference was
 * swallowed because the empty-bag branch sat above the notices and returned
 * early. Branch precedence is the bug surface here, so it lives somewhere it
 * can be reasoned about and tested on its own.
 *
 * The caller renders notices *outside* this decision, unconditionally, so no
 * screen can hide them. `hasNotices` only decides whether the shopper is shown
 * the "add something to your bag" pitch, which would be absurd next to a
 * just-placed order.
 */
export type CheckoutScreen = "loading" | "unavailable" | "placing" | "notices" | "empty" | "form";

export interface CheckoutScreenState {
  /** Nothing about the bag is known yet (pre-hydration or first fetch). */
  isLoading: boolean;
  /** Every vendor cart failed to load. */
  isUnavailable: boolean;
  bagIsEmpty: boolean;
  /** A placement is in flight. */
  placing: boolean;
  /** Any error, failure, or placed-order notice is waiting to be shown. */
  hasNotices: boolean;
}

export function checkoutScreen(state: CheckoutScreenState): CheckoutScreen {
  if (state.isLoading) return "loading";
  if (state.isUnavailable) return "unavailable";
  if (!state.bagIsEmpty) return "form";
  // The bag is empty from here down. That is three different situations.
  if (state.placing) return "placing";
  // Emptied by a placement that has already finished: the notices carry the
  // outcome, and inviting the shopper to go shopping would bury it.
  if (state.hasNotices) return "notices";
  return "empty";
}

export function checkoutTitle(screen: CheckoutScreen): string {
  if (screen === "unavailable") return "We couldn't load your bag";
  if (screen === "empty") return "Your bag is empty";
  return "Checkout";
}
