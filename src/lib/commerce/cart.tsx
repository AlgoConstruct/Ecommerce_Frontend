import * as React from "react";
import { products } from "./data";
import type { Money, Product, ProductVariant } from "./types";

interface Line {
  productId: string;
  variantId: string;
  quantity: number;
}

interface CartState {
  lines: Line[];
  wishlist: string[];
  add: (productId: string, variantId: string, quantity?: number) => void;
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
    add: (productId, variantId, quantity = 1) => {
      setLines((prev) => {
        const found = prev.find((l) => l.variantId === variantId);
        if (found) {
          return prev.map((l) =>
            l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l,
          );
        }
        return [...prev, { productId, variantId, quantity }];
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
  const detail: ResolvedLine[] = cart.lines.flatMap((line) => {
    const product = products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) return [];
    return [
      {
        product,
        variant,
        quantity: line.quantity,
        lineTotal: {
          amount: variant.price.amount * line.quantity,
          currency: variant.price.currency,
        },
      },
    ];
  });

  const subtotal = detail.reduce((sum, l) => sum + l.lineTotal.amount, 0);
  const itemCount = detail.reduce((sum, l) => sum + l.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= 15000 ? 0 : 1200;
  const tax = Math.round(subtotal * 0.08);

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
