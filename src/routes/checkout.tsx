import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCart } from "@/lib/commerce/cart";
import {
  checkoutClient,
  type CartTotals,
  type CheckoutAddress,
  type PaymentProvider,
} from "@/lib/commerce/checkout-client";
import { placeOrders, type PlacementOutcome } from "@/lib/commerce/place-order";
import { listRegions, type MedusaRegion } from "@/lib/medusa/regions";
import { PageHeader } from "@/components/site/catalog";
import { AddressForm, EMPTY_ADDRESS, addressErrors } from "@/components/site/checkout/address-form";
import { ShippingSection, type VendorShipping } from "@/components/site/checkout/shipping-section";
import { PaymentSection } from "@/components/site/checkout/payment-section";
import { CheckoutSummary, sumTotals } from "@/components/site/checkout/checkout-summary";
import { checkoutScreen, checkoutTitle } from "@/components/site/checkout/checkout-screen";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — InfiniTrends" },
      { name: "description", content: "Complete your InfiniTrends order." },
      { property: "og:title", content: "Checkout — InfiniTrends" },
      { property: "og:description", content: "Complete your InfiniTrends order." },
    ],
  }),
  component: CheckoutPage,
});

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm " +
  "font-medium text-ink-foreground disabled:opacity-50";

/** `/store/regions` returns each region's countries; `MedusaRegion` doesn't
 *  declare them, so read them through this narrow shape rather than widening
 *  the shared type for one screen. */
interface RegionCountry {
  iso_2: string;
  display_name: string;
}

/** The state a vendor's shipping starts in, before anything has loaded. */
function blankShipping(vendorId: string, vendorName: string): VendorShipping {
  return {
    vendorId,
    vendorName,
    options: [],
    selectedOptionId: null,
    isLoading: false,
    error: null,
  };
}

function CheckoutPage() {
  const navigate = useNavigate();
  const { bag, itemCount, isLoading, isUnavailable, removeVendorCart } = useCart();

  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [addressSaved, setAddressSaved] = React.useState(false);
  const [savingAddress, setSavingAddress] = React.useState(false);
  const [countries, setCountries] = React.useState<{ code: string; name: string }[]>([]);

  const [shipping, setShipping] = React.useState<Record<string, VendorShipping>>({});
  const [totalsByVendor, setTotalsByVendor] = React.useState<Record<string, CartTotals>>({});

  const [providers, setProviders] = React.useState<PaymentProvider[]>([]);
  const [providerId, setProviderId] = React.useState<string | null>(null);

  const [placing, setPlacing] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [failures, setFailures] = React.useState<PlacementOutcome[]>([]);
  /**
   * Orders that were genuinely placed but whose confirmation redirect failed.
   * Kept apart from `errors` because this is not a failure from the shopper's
   * side — it is a success with a broken redirect, and dressing it in a red
   * error box would tell them the opposite of what happened.
   */
  const [placedOrderIds, setPlacedOrderIds] = React.useState<string[]>([]);

  // Countries come from the active region, so the shopper can only choose one
  // the region actually ships to — a country outside it fails at completion.
  React.useEffect(() => {
    let cancelled = false;
    listRegions()
      .then((regions) => {
        if (cancelled) return;
        const region: MedusaRegion | undefined =
          regions.find((r) => r.currency_code === "usd") ?? regions[0];
        if (!region) {
          setCountries([]);
          return;
        }
        const raw = (region as MedusaRegion & { countries?: RegionCountry[] }).countries ?? [];
        const list = raw.map((c) => ({ code: c.iso_2, name: c.display_name }));
        setCountries(list);
        const only = list.length === 1 ? list[0] : undefined;
        if (only) setAddress((a) => ({ ...a, countryCode: only.code }));
      })
      .catch(() => setCountries([]));
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    checkoutClient
      .listPaymentProviders()
      .then((list) => {
        if (cancelled) return;
        setProviders(list);
        const only = list.length === 1 ? list[0] : undefined;
        if (only) setProviderId(only.id);
      })
      .catch(() => setProviders([]));
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveAddress() {
    const missing = addressErrors(email, address);
    if (missing.length) {
      setErrors([`Please enter ${missing.join(", ")}.`]);
      return;
    }
    setErrors([]);
    setSavingAddress(true);
    try {
      // Every cart carries the same address — the shopper entered it once.
      for (const group of bag) {
        await checkoutClient.updateCartDetails(group.cartId, email, address);
      }
      setAddressSaved(true);
      await loadShippingOptions();
    } catch (error) {
      setErrors([
        error instanceof Error
          ? `We couldn't save your address: ${error.message}`
          : "We couldn't save your address.",
      ]);
    } finally {
      setSavingAddress(false);
    }
  }

  async function loadShippingOptions() {
    // Totals from a previous pass were computed against the previous
    // destination, so they cannot survive a re-save. Clearing them first means
    // the summary falls back to cart subtotals until fresh, address-correct
    // totals come back — never showing stale server truth as current.
    setTotalsByVendor({});
    setShipping(
      Object.fromEntries(
        bag.map((g) => [
          g.vendorId,
          { ...blankShipping(g.vendorId, g.vendorName), isLoading: true },
        ]),
      ),
    );
    await Promise.all(
      bag.map(async (group) => {
        try {
          const options = await checkoutClient.listShippingOptions(group.cartId);
          setShipping((prev) => ({
            ...prev,
            [group.vendorId]: {
              ...(prev[group.vendorId] ?? blankShipping(group.vendorId, group.vendorName)),
              options,
              isLoading: false,
              error: null,
            },
          }));
        } catch {
          setShipping((prev) => ({
            ...prev,
            [group.vendorId]: {
              ...(prev[group.vendorId] ?? blankShipping(group.vendorId, group.vendorName)),
              isLoading: false,
              error: `We couldn't load shipping options for ${group.vendorName}.`,
            },
          }));
        }
      }),
    );
  }

  async function selectShipping(vendorId: string, optionId: string) {
    const group = bag.find((g) => g.vendorId === vendorId);
    if (!group) return;
    setShipping((prev) => ({
      ...prev,
      [vendorId]: {
        ...(prev[vendorId] ?? blankShipping(vendorId, group.vendorName)),
        selectedOptionId: optionId,
      },
    }));
    try {
      // Setting the method makes the cart's own totals authoritative, which is
      // what the summary reads — no client-side shipping or tax maths.
      const totals = await checkoutClient.addShippingMethod(group.cartId, optionId);
      setTotalsByVendor((prev) => ({ ...prev, [vendorId]: totals }));
    } catch (error) {
      setShipping((prev) => ({
        ...prev,
        [vendorId]: {
          ...(prev[vendorId] ?? blankShipping(vendorId, group.vendorName)),
          selectedOptionId: null,
          error: error instanceof Error ? error.message : "We couldn't apply that shipping method.",
        },
      }));
      // The selection is gone, so the totals it produced must go with it —
      // otherwise the summary keeps quoting a method the cart no longer has.
      setTotalsByVendor((prev) => {
        if (!(vendorId in prev)) return prev;
        const next = { ...prev };
        delete next[vendorId];
        return next;
      });
    }
  }

  const vendors = bag.map((g) => shipping[g.vendorId] ?? blankShipping(g.vendorId, g.vendorName));
  const allShippingChosen = vendors.length > 0 && vendors.every((v) => !!v.selectedOptionId);

  // A group whose cart didn't load contributes nothing to the summary and
  // can't be reasoned about, so it must not be handed to placeOrders. Blocking
  // the whole placement (rather than quietly dropping that maker) is the
  // honest reading: the shopper asked for everything in the bag.
  const unreadyGroups = bag.filter((g) => g.isUnavailable || g.isLoading);
  const bagReady = unreadyGroups.length === 0;
  const canPlace = addressSaved && allShippingChosen && !!providerId && bagReady && !placing;

  async function placeOrder() {
    if (!providerId) return;
    setPlacing(true);
    setErrors([]);
    setFailures([]);
    setPlacedOrderIds([]);
    try {
      const outcomes = await placeOrders(
        bag.map((g) => ({ vendorId: g.vendorId, vendorName: g.vendorName, cartId: g.cartId })),
        providerId,
      );
      const placed = outcomes.filter((o) => o.ok);
      const failed = outcomes.filter((o) => !o.ok);

      // Retire only the carts that actually became orders. A failed cart is
      // still live and its items must stay in the bag.
      for (const outcome of placed) removeVendorCart(outcome.vendorId);

      if (!placed.length) {
        setFailures(failed);
        setPlacing(false);
        return;
      }

      const orderIds = placed.map((o) => o.orderId).filter((id): id is string => !!id);

      try {
        await navigate({
          to: "/order/confirmed",
          search: { ids: orderIds.join(",") },
          state: { failures: failed } as never,
        });
      } catch {
        // The orders are real and already placed; only the redirect failed.
        // Release the button, show the ids, and keep any partial failures
        // visible — none of that may be lost behind a dead "Placing your
        // order…" state or, worse, an empty-bag screen.
        setPlacing(false);
        setPlacedOrderIds(orderIds);
        setFailures(failed);
      }
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Something went wrong placing your order.",
      ]);
      setPlacing(false);
    }
  }

  // Until a vendor's shipping method is set there is no cart-totals call to
  // read, so fall back to that cart's own subtotal/total (Medusa's numbers,
  // already fetched for the bag) rather than summing an empty map and showing
  // a $0 order. Shipping and tax have no server value yet; they stay zero
  // here and the summary shows them — and the total — as pending rather than
  // printing figures that wouldn't add up.
  const vendorTotals: CartTotals[] = bag.map((group) => {
    const fromCart = totalsByVendor[group.vendorId];
    if (fromCart) return fromCart;
    const currency = group.cart?.currency ?? "usd";
    const zero = { amount: 0, currency } as const;
    return {
      subtotal: group.cart?.subtotal ?? zero,
      shipping: zero,
      tax: zero,
      total: group.cart?.total ?? zero,
    };
  });
  const totals = sumTotals(vendorTotals, "usd");
  // Ask the bag which vendors need totals rather than counting the map:
  // `totalsByVendor` can outlive a group that has left the bag, and a stale
  // extra key would push the count past `bag.length` and pin this to false
  // while the order placed anyway.
  const shippingKnown = allShippingChosen && bag.every((g) => !!totalsByVendor[g.vendorId]);

  const hasNotices = placedOrderIds.length > 0 || errors.length > 0 || failures.length > 0;

  // Notices are rendered outside the screen decision, never inside a branch.
  // The regression this replaces was exactly that: a placed order's reference
  // lived in a branch the empty-bag early return had already returned past.
  // There are no early returns in this component any more, so a screen added
  // later cannot get above them.
  const notices = (
    <>
      {placedOrderIds.length > 0 && (
        <div className="rounded-sm border border-border bg-surface p-4" data-testid="orders-placed">
          <p className="text-sm font-medium">
            {placedOrderIds.length > 1 ? "Your orders are placed." : "Your order is placed."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't open your confirmation page, but nothing is wrong with the order itself.
            Keep this reference:
          </p>
          <p className="mt-2 font-mono text-sm break-all" data-testid="placed-order-ids">
            {placedOrderIds.join(", ")}
          </p>
          <Link
            to="/order/confirmed"
            search={{ ids: placedOrderIds.join(",") }}
            className={`mt-4 ${primaryButton}`}
            data-testid="retry-confirmation"
          >
            Open my confirmation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-sm border border-destructive p-4" data-testid="checkout-errors">
          {errors.map((e) => (
            <p key={e} className="text-sm text-destructive">
              {e}
            </p>
          ))}
        </div>
      )}

      {failures.length > 0 && (
        <div className="rounded-sm border border-destructive p-4" data-testid="placement-failures">
          <p className="text-sm font-medium text-destructive">
            {placedOrderIds.length > 0
              ? "These makers' orders couldn't be placed. Their items are still in your bag."
              : "Nothing was placed. Your bag is unchanged."}
          </p>
          <ul className="mt-2 space-y-1">
            {failures.map((f) => (
              <li key={f.vendorId} className="text-sm text-destructive">
                {f.vendorName}: {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  const screen = checkoutScreen({
    isLoading,
    isUnavailable,
    bagIsEmpty: bag.length === 0,
    placing,
    hasNotices,
  });

  return (
    <div>
      <PageHeader eyebrow="Checkout" title={checkoutTitle(screen)} />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        {screen !== "form" && <div className="space-y-6">{notices}</div>}

        {screen === "loading" && <p className="text-sm text-muted-foreground">Loading your bag…</p>}

        {screen === "unavailable" && (
          <>
            <p className="text-sm text-muted-foreground">
              Something went wrong reaching the store. Try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`mt-6 ${primaryButton}`}
            >
              Try again
            </button>
          </>
        )}

        {/* A fully successful placement retires every vendor cart before
            `navigate` resolves, so the bag is momentarily empty mid-placement.
            That is not an empty bag. */}
        {screen === "placing" && (
          <p className="text-sm text-muted-foreground" data-testid="checkout-placing">
            Placing your order…
          </p>
        )}

        {screen === "empty" && (
          <>
            <p className="text-sm text-muted-foreground">
              Add something to your bag before heading to checkout.
            </p>
            <Link to="/shop" className={`mt-6 ${primaryButton}`}>
              Browse the marketplace <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}

        {screen === "notices" && (
          <Link to="/shop" className={`mt-6 ${primaryButton}`}>
            Continue shopping <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {screen === "form" && (
          <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
            <div className="space-y-10">
              {unreadyGroups.length > 0 && (
                <div
                  className="rounded-sm border border-destructive p-4"
                  data-testid="bag-group-notices"
                >
                  {unreadyGroups.map((g) => (
                    <p
                      key={g.vendorId}
                      className="text-sm text-destructive"
                      data-testid={`bag-group-notice-${g.vendorId}`}
                    >
                      {g.isLoading
                        ? `Still loading ${g.vendorName}'s items…`
                        : `We couldn't load ${g.vendorName}'s items, so they aren't counted in the total below and no order can be placed yet. Try again in a moment.`}
                    </p>
                  ))}
                </div>
              )}

              <section>
                <h2 className="mb-4 text-lg font-medium">Contact &amp; shipping address</h2>
                <AddressForm
                  email={email}
                  address={address}
                  countries={countries}
                  disabled={savingAddress || placing}
                  onEmailChange={setEmail}
                  onAddressChange={setAddress}
                />
                <button
                  type="button"
                  onClick={saveAddress}
                  disabled={savingAddress || placing}
                  className={`mt-5 ${primaryButton}`}
                  data-testid="save-address"
                >
                  {savingAddress
                    ? "Saving…"
                    : addressSaved
                      ? "Update address"
                      : "Save address & see shipping"}
                </button>
              </section>

              {addressSaved && (
                <section data-testid="shipping-section">
                  <h2 className="mb-4 text-lg font-medium">Shipping</h2>
                  {bag.length > 1 && (
                    <p className="mb-4 text-sm text-muted-foreground">
                      Items from different makers ship separately and are placed as separate orders.
                    </p>
                  )}
                  <ShippingSection vendors={vendors} disabled={placing} onSelect={selectShipping} />
                </section>
              )}

              {addressSaved && allShippingChosen && (
                <section data-testid="payment-section">
                  <h2 className="mb-4 text-lg font-medium">Payment</h2>
                  <PaymentSection
                    providers={providers}
                    selectedProviderId={providerId}
                    disabled={placing}
                    onSelect={setProviderId}
                  />
                </section>
              )}

              {notices}

              <button
                type="button"
                onClick={placeOrder}
                disabled={!canPlace}
                className={primaryButton}
                data-testid="place-order"
              >
                {placing ? "Placing your order…" : "Place order"}
              </button>
            </div>

            <CheckoutSummary itemCount={itemCount} totals={totals} shippingKnown={shippingKnown} />
          </div>
        )}
      </div>
    </div>
  );
}
