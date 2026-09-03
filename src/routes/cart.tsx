import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ArrowRight } from "lucide-react";
import { useCartDetail } from "@/lib/commerce/cart";
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
  const { detail, subtotal, shipping, tax, total, itemCount, setQty, remove } = useCartDetail();

  if (detail.length === 0) {
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
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          <ul className="divide-y divide-border border-t border-border">
            {detail.map((l) => (
              <li key={l.variant.id} className="flex gap-5 py-6">
                <img
                  src={l.product.images[0]?.url}
                  alt={l.product.title}
                  className="h-32 w-24 rounded-sm object-cover"
                />
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    {l.product.vendor && <p className="eyebrow">{l.product.vendor.name}</p>}
                    <p className="mt-1 text-base">{l.product.title}</p>
                    <p className="text-sm text-muted-foreground">{l.variant.title}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center gap-3 rounded-full border border-border px-2 py-1">
                      <button
                        aria-label="Decrease quantity"
                        onClick={() => setQty(l.variant.id, l.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs">{l.quantity}</span>
                      <button
                        aria-label="Increase quantity"
                        onClick={() => setQty(l.variant.id, l.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      className="text-xs text-muted-foreground underline"
                      onClick={() => remove(l.variant.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium">{formatMoney(l.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <div className="h-fit rounded-sm border border-border p-6">
            <p className="eyebrow">Order summary</p>
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
              Shipping and duties are estimated. Free shipping on orders over $150.
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
