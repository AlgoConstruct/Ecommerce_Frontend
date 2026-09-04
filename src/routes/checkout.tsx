import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCartDetail } from "@/lib/commerce/cart";
import { formatMoney } from "@/lib/commerce/format";
import { PageHeader } from "@/components/site/catalog";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — InfiniTrends" },
      {
        name: "description",
        content: "Checkout is not yet available on InfiniTrends.",
      },
      { property: "og:title", content: "Checkout — InfiniTrends" },
      { property: "og:description", content: "Checkout is not yet available on InfiniTrends." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { detail, subtotal, shipping, tax, total, itemCount } = useCartDetail();

  if (detail.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Checkout" title="Your bag is empty" />
        <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
          <p className="text-sm text-muted-foreground">
            Add something to your bag before heading to checkout.
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
      <PageHeader eyebrow="Checkout" title="Checkout isn't available yet" />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          <div className="rounded-sm border border-border bg-surface p-6">
            <p className="text-sm leading-relaxed">
              We're still wiring up payment and order processing, so we can't take your order here
              yet. Nothing in your bag has been charged or submitted — it's saved locally in this
              browser.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Come back once checkout is live, or keep browsing in the meantime.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/cart"
                className="inline-flex items-center justify-center rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground"
              >
                Back to bag
              </Link>
              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-sm border border-border px-6 py-3.5 text-sm font-medium"
              >
                Continue shopping
              </Link>
            </div>
          </div>

          <div className="h-fit rounded-sm border border-border p-6">
            <p className="eyebrow">Order summary ({itemCount} items)</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping.amount === 0 ? "Free" : formatMoney(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatMoney(tax)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Estimated — no payment will be collected here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
