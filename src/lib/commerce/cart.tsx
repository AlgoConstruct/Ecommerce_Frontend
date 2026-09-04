import * as React from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { commerce } from "./client";
import type { CartSummary, Money, Product, ProductVariant } from "./types";

// The marketplace backend rejects any cart holding products from more than one
// vendor (validate-single-store-for-products, wired into completeCartWorkflow).
// So we keep one Medusa cart per vendor and present them as a single bag. The
// validator's precondition is then always true and there is no split step at
// checkout that can fail after the shopper has committed.
const STORAGE_KEY = "marketplace.cartIds";

// The vendor's display name is stored alongside its cart id, not just the id.
// Vendor names are only known when a product is added, so storing ids alone
// would make every group read "Unknown vendor" after a reload — and recovering
// the name otherwise would cost an extra product lookup per group.
interface StoredVendorCart {
  cartId: string;
  vendorName: string;
}

type CartsByVendor = Record<string, StoredVendorCart>;

function readStoredCarts(): CartsByVendor {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    // Ignore anything that isn't the expected shape rather than trusting
    // whatever is in storage — it may predate this format.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, StoredVendorCart] => {
          const v = entry[1] as StoredVendorCart | undefined;
          return !!v && typeof v.cartId === "string" && typeof v.vendorName === "string";
        },
      ),
    );
  } catch {
    return {};
  }
}

function writeStoredCarts(carts: CartsByVendor) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(carts));
  } catch {
    // Private browsing or a full quota. The bag still works for this page
    // view; it just won't survive a reload.
  }
}

export interface BagGroup {
  vendorId: string;
  vendorName: string;
  cart: CartSummary;
}

interface CartState {
  bag: BagGroup[];
  itemCount: number;
  subtotal: Money;
  isLoading: boolean;
  isMutating: boolean;
  /** True when a cart could not be fetched — render "unavailable", not "empty". */
  isUnavailable: boolean;
  error: string | null;
  add: (product: Product, variant: ProductVariant, quantity?: number) => Promise<void>;
  setQty: (cartId: string, lineId: string, quantity: number) => Promise<void>;
  remove: (cartId: string, lineId: string) => Promise<void>;
  wishlist: string[];
  toggleWish: (productId: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = React.createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [carts, setCarts] = React.useState<CartsByVendor>({});
  const [wishlist, setWishlist] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Cart ids live in localStorage, which the server cannot read, so carts are
  // hydrated on the client after mount rather than prefetched in a route
  // loader like every other query in this app. Do not "fix" this into a
  // loader prefetch — it would SSR an empty bag for everyone.
  React.useEffect(() => {
    setCarts(readStoredCarts());
  }, []);

  const entries = Object.entries(carts);
  const cartQueries = useQueries({
    queries: entries.map(([, stored]) => ({
      queryKey: ["cart", stored.cartId],
      queryFn: () => commerce.getCart(stored.cartId),
      staleTime: 0,
    })),
  });

  // Drop ids that no longer resolve (deleted, expired, already completed).
  // getCart returns null for these rather than throwing, so a null result is
  // the signal — distinct from isError, which means the backend is unreachable
  // and the id may still be perfectly good.
  const deadKey = cartQueries
    .map((q) => `${q.status}:${q.data === null ? "gone" : "ok"}`)
    .join("|");
  React.useEffect(() => {
    const deadVendorIds = entries
      .filter((_entry, i) => {
        const q = cartQueries[i];
        return q && q.isSuccess && q.data === null;
      })
      .map(([vendorId]) => vendorId);
    if (!deadVendorIds.length) return;
    setCarts((prev) => {
      const next = { ...prev };
      for (const vendorId of deadVendorIds) delete next[vendorId];
      writeStoredCarts(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadKey]);

  // The backend being unreachable must not look like an empty bag — a shopper
  // seeing "your bag is empty" when their items are actually fine is worse
  // than an error.
  const isUnavailable = cartQueries.some((q) => q.isError);

  const bag: BagGroup[] = entries
    .map(([vendorId, stored], i) => {
      const cart = cartQueries[i]?.data;
      if (!cart || cart.lines.length === 0) return null;
      return { vendorId, vendorName: stored.vendorName, cart };
    })
    .filter((g): g is BagGroup => g !== null);

  const itemCount = bag.reduce((sum, g) => sum + g.cart.itemCount, 0);
  const currency = bag[0]?.cart.currency ?? "usd";
  const subtotal: Money = {
    amount: bag.reduce((sum, g) => sum + g.cart.subtotal.amount, 0),
    currency,
  };

  const invalidate = (cartId: string) =>
    queryClient.invalidateQueries({ queryKey: ["cart", cartId] });

  const addMutation = useMutation({
    mutationFn: async ({
      product,
      variant,
      quantity,
    }: {
      product: Product;
      variant: ProductVariant;
      quantity: number;
    }) => {
      const vendor = product.vendor;
      if (!vendor) {
        // Refusing loudly: a product with no vendor cannot be checked out,
        // because the backend links every order to a store. Silently adding it
        // to some other vendor's cart would produce a bag that fails at the
        // very end of checkout.
        throw new Error(`"${product.title}" has no vendor and cannot be added to the bag.`);
      }

      let cartId = carts[vendor.id]?.cartId;
      if (!cartId) {
        const created = await commerce.createCart();
        cartId = created.id;
      }
      // Always rewrite the entry: it creates the mapping on first add and
      // refreshes the stored vendor name if the vendor has since renamed.
      const next: CartsByVendor = {
        ...carts,
        [vendor.id]: { cartId, vendorName: vendor.name },
      };
      setCarts(next);
      writeStoredCarts(next);

      await commerce.addLineItem(cartId, variant.id, quantity);
      return cartId;
    },
    onSuccess: (cartId) => {
      setError(null);
      void invalidate(cartId);
      setOpen(true);
    },
    onError: (e: Error) => setError(e.message),
  });

  const qtyMutation = useMutation({
    mutationFn: ({
      cartId,
      lineId,
      quantity,
    }: {
      cartId: string;
      lineId: string;
      quantity: number;
    }) =>
      quantity <= 0
        ? commerce.removeLineItem(cartId, lineId)
        : commerce.updateLineItem(cartId, lineId, quantity),
    onSuccess: (_data, vars) => {
      setError(null);
      void invalidate(vars.cartId);
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: ({ cartId, lineId }: { cartId: string; lineId: string }) =>
      commerce.removeLineItem(cartId, lineId),
    onSuccess: (_data, vars) => {
      setError(null);
      void invalidate(vars.cartId);
    },
    onError: (e: Error) => setError(e.message),
  });

  const value: CartState = {
    bag,
    itemCount,
    subtotal,
    isLoading: cartQueries.some((q) => q.isLoading),
    isMutating: addMutation.isPending || qtyMutation.isPending || removeMutation.isPending,
    isUnavailable,
    error,
    add: async (product, variant, quantity = 1) => {
      await addMutation.mutateAsync({ product, variant, quantity }).catch(() => {
        // onError already surfaced it; swallow so callers don't need try/catch.
      });
    },
    setQty: async (cartId, lineId, quantity) => {
      await qtyMutation.mutateAsync({ cartId, lineId, quantity }).catch(() => {});
    },
    remove: async (cartId, lineId) => {
      await removeMutation.mutateAsync({ cartId, lineId }).catch(() => {});
    },
    wishlist,
    toggleWish: (productId) =>
      setWishlist((prev) =>
        prev.includes(productId) ? prev.filter((p) => p !== productId) : [...prev, productId],
      ),
    open,
    setOpen,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
