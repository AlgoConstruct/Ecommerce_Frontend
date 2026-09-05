import { checkoutClient, type CompleteResult } from "./checkout-client";

export interface PlacementTarget {
  vendorId: string;
  vendorName: string;
  cartId: string;
}

export interface PlacementOutcome {
  vendorId: string;
  vendorName: string;
  ok: boolean;
  orderId?: string;
  message?: string;
}

export interface PlaceOrderDeps {
  createPaymentCollection(cartId: string): Promise<string>;
  initPaymentSession(collectionId: string, providerId: string): Promise<void>;
  completeCart(cartId: string): Promise<CompleteResult>;
}

const defaultDeps: PlaceOrderDeps = {
  createPaymentCollection: (cartId) => checkoutClient.createPaymentCollection(cartId),
  initPaymentSession: (id, provider) => checkoutClient.initPaymentSession(id, provider),
  completeCart: (cartId) => checkoutClient.completeCart(cartId),
};

/**
 * Completes each vendor's cart in turn.
 *
 * Sequential, not parallel: two carts can hold the same shared inventory, and
 * completing them at once invites a race the shopper would experience as a
 * mystery failure.
 *
 * A failure never aborts the vendors after it. Medusa cannot roll back a
 * completed order, so all-or-nothing is not on offer — one maker being out of
 * stock must not deny an unrelated maker whose items are fine. Every vendor
 * gets an outcome and the caller reports all of them.
 */
export async function placeOrders(
  targets: PlacementTarget[],
  providerId: string,
  deps: PlaceOrderDeps = defaultDeps,
): Promise<PlacementOutcome[]> {
  const outcomes: PlacementOutcome[] = [];

  for (const target of targets) {
    const base = { vendorId: target.vendorId, vendorName: target.vendorName };
    try {
      const collectionId = await deps.createPaymentCollection(target.cartId);
      await deps.initPaymentSession(collectionId, providerId);
      const result = await deps.completeCart(target.cartId);
      outcomes.push(
        result.ok
          ? { ...base, ok: true, orderId: result.orderId }
          : { ...base, ok: false, message: result.message },
      );
    } catch (error) {
      outcomes.push({
        ...base,
        ok: false,
        message:
          error instanceof Error ? error.message : "Something went wrong placing this order.",
      });
    }
  }

  return outcomes;
}
