import * as React from "react";
import type { Money, Product, ProductVariant } from "./types";

// A cart line snapshots the product + variant it was added with, rather than
// storing only ids and re-resolving them against a product catalog. This
// keeps the cart correct regardless of where the product came from (real
// Medusa data or the mock catalog in `./data`) and regardless of whether
// that catalog still contains a matching id later. See useCartDetail below.
interface Line {
  productId: string;
  variantId: string;
  quantity: number;
  product: Product;
  variant: ProductVariant;
}

interface CartState {
  lines: Line[];
  wishlist: string[];
  add: (product: Product, variant: ProductVariant, quantity?: number) => void;
  setQty: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  toggleWish: (productId: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = React.createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = React.useState<Line[]>([]);
  const [wishlist, setWishlist] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);

  const value: CartState = {
    lines,
    wishlist,
    open,
    setOpen,
    add: (product, variant, quantity = 1) => {
      setLines((prev) => {
        const found = prev.find((l) => l.variantId === variant.id);
        if (found) {
          return prev.map((l) =>
            l.variantId === variant.id ? { ...l, quantity: l.quantity + quantity } : l,
          );
        }
        return [
          ...prev,
          { productId: product.id, variantId: variant.id, quantity, product, variant },
        ];
      });
      setOpen(true);
    },
    setQty: (variantId, quantity) =>
      setLines((prev) =>
        quantity <= 0
          ? prev.filter((l) => l.variantId !== variantId)
          : prev.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)),
      ),
    remove: (variantId) => setLines((prev) => prev.filter((l) => l.variantId !== variantId)),
    toggleWish: (productId) =>
      setWishlist((prev) =>
        prev.includes(productId) ? prev.filter((p) => p !== productId) : [...prev, productId],
      ),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export interface ResolvedLine {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  lineTotal: Money;
}

export function useCartDetail() {
  const cart = useCart();
  // Render straight from each line's own snapshot — no lookup against any
  // product catalog (mock or real) needed, so this works for both.
  const detail: ResolvedLine[] = cart.lines.map((line) => ({
    product: line.product,
    variant: line.variant,
    quantity: line.quantity,
    lineTotal: {
      amount: line.variant.price.amount * line.quantity,
      currency: line.variant.price.currency,
    },
  }));

  const subtotal = detail.reduce((sum, l) => sum + l.lineTotal.amount, 0);
  const itemCount = detail.reduce((sum, l) => sum + l.quantity, 0);
  // Amounts are decimal (e.g. 24 = $24.00), matching Medusa's Store API.
  const shipping = subtotal === 0 || subtotal >= 150 ? 0 : 12;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;

  return {
    ...cart,
    detail,
    itemCount,
    subtotal: { amount: subtotal, currency: "usd" } as Money,
    shipping: { amount: shipping, currency: "usd" } as Money,
    tax: { amount: tax, currency: "usd" } as Money,
    total: { amount: subtotal + shipping + tax, currency: "usd" } as Money,
  };
}
