import { Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { useCartDetail } from "@/lib/commerce/cart";
import { formatMoney } from "@/lib/commerce/format";

export function CartDrawer() {
  const { open, setOpen, detail, subtotal, setQty, remove, itemCount } = useCartDetail();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="Close cart"
        className="absolute inset-0 bg-ink/40"
        onClick={() => setOpen(false)}
      />
      <aside
        aria-label="Shopping cart"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-lg">Your bag ({itemCount})</h2>
          <button aria-label="Close cart" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {detail.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Your bag is empty. Start with the makers.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {detail.map((l) => (
                <li key={l.variant.id} className="flex gap-4 py-5">
                  <img
                    src={l.product.images[0]?.url}
                    alt={l.product.title}
                    className="h-24 w-20 rounded-sm object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm">{l.product.title}</p>
                    <p className="text-xs text-muted-foreground">{l.variant.title}</p>
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
                  <p className="text-sm">{formatMoney(l.lineTotal)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-6 py-5">
          <div className="flex items-center justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-medium">{formatMoney(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Shipping and duties calculated at checkout.
          </p>
          <Link
            to="/checkout"
            onClick={() => setOpen(false)}
            className="mt-4 block rounded-sm bg-ink py-3.5 text-center text-sm font-medium text-ink-foreground"
          >
            Checkout
          </Link>
          <Link
            to="/cart"
            onClick={() => setOpen(false)}
            className="mt-2 block py-2 text-center text-sm underline"
          >
            View bag
          </Link>
        </div>
      </aside>
    </div>
  );
}
