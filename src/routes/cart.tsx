import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/commerce/cart";
import { formatMoney } from "@/lib/commerce/format";
import { PageHeader } from "@/components/site/catalog";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your bag — InfiniTrends" },
      {
        name: "description",
        content: "Review the items in your bag before checking out.",
      },
      { property: "og:title", content: "Your bag — InfiniTrends" },
      {
        property: "og:description",
        content: "Review the items in your bag before checking out.",
      },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { bag, subtotal, itemCount, setQty, remove, isLoading, isUnavailable, error } = useCart();

  if (isLoading) {
    return (
      <div>
        <PageHeader eyebrow="Your bag" title="Your bag" />
        <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
          <p className="text-sm text-muted-foreground">Loading your bag…</p>
        </div>
      </div>
    );
  }

  if (isUnavailable) {
    return (
      <div>
        <PageHeader eyebrow="Your bag" title="We couldn't load your bag" />
        <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
          <p className="text-sm text-muted-foreground">
            Something went wrong reaching the store. Your bag hasn't been lost — try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (bag.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Your bag" title="Your bag is empty" />
        <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
          <p className="text-sm text-muted-foreground">
            Start with the makers — browse the full marketplace.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground"
          >
            Browse the marketplace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Your bag" title={`Your bag (${itemCount})`} />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        {error && (
          <p className="mb-6 rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {bag.length > 1 && (
          <p className="mb-6 text-sm text-muted-foreground">
            Items from different makers are placed as separate orders.
          </p>
        )}
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          <div className="divide-y divide-border border-t border-border">
            {bag.map((group) => (
              <div key={group.vendorId} className="py-6">
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow">Sold by {group.vendorName}</p>
                  {group.cart && (
                    <span className="text-sm text-muted-foreground">
                      Subtotal {formatMoney(group.cart.subtotal)}
                    </span>
                  )}
                </div>
                {group.isLoading ? (
                  <p className="mt-4 text-sm text-muted-foreground">Loading this maker's items…</p>
                ) : group.isUnavailable ? (
                  <p className="mt-4 text-sm text-destructive">
                    We couldn't load this maker's items. The rest of your bag is unaffected.
                  </p>
                ) : (
                  group.cart && (
                    <ul className="mt-4 divide-y divide-border">
                      {group.cart.lines.map((l) => (
                        <li key={l.id} className="flex gap-5 py-6">
                          {l.thumbnail ? (
                            <img
                              src={l.thumbnail}
                              alt={l.productTitle}
                              className="h-32 w-24 rounded-sm object-cover"
                            />
                          ) : (
                            <div
                              aria-hidden="true"
                              className="h-32 w-24 shrink-0 rounded-sm bg-muted"
                            />
                          )}
                          <div className="flex flex-1 flex-col justify-between">
                            <div>
                              <p className="mt-1 text-base">{l.productTitle}</p>
                              {l.variantTitle && (
                                <p className="text-sm text-muted-foreground">{l.variantTitle}</p>
                              )}
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <div className="flex items-center gap-3 rounded-full border border-border px-2 py-1">
                                <button
                                  aria-label="Decrease quantity"
                                  disabled={group.isMutating}
                                  onClick={() => void setQty(group.cartId, l.id, l.quantity - 1)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-xs">{l.quantity}</span>
                                <button
                                  aria-label="Increase quantity"
                                  disabled={group.isMutating}
                                  onClick={() => void setQty(group.cartId, l.id, l.quantity + 1)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <button
                                className="text-xs text-muted-foreground underline disabled:opacity-60"
                                disabled={group.isMutating}
                                onClick={() => void remove(group.cartId, l.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-medium">{formatMoney(l.lineTotal)}</p>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            ))}
          </div>

          <div className="h-fit rounded-sm border border-border p-6">
            <p className="eyebrow">Order summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
                <span>Total before shipping &amp; tax</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Shipping and tax are calculated at checkout.
            </p>
            <Link
              to="/checkout"
              className="mt-6 block rounded-sm bg-ink py-3.5 text-center text-sm font-medium text-ink-foreground"
            >
              Proceed to checkout
            </Link>
            <Link to="/shop" className="mt-3 block py-2 text-center text-sm underline">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
