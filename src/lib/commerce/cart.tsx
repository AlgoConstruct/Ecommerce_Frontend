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

/** Returns a copy of `carts` without `vendorId`. Never mutates its input. */
export function removeVendorFromCarts(carts: CartsByVendor, vendorId: string): CartsByVendor {
  if (!(vendorId in carts)) return carts;
  const next = { ...carts };
  delete next[vendorId];
  return next;
}

export interface BagGroup {
  vendorId: string;
  vendorName: string;
  /**
   * The stored cart id for this vendor, always known once the vendor has an
   * entry — independent of whether that cart's data has loaded yet. Use this
   * (not `cart.id`) to target `setQty`/`remove`, since `cart` is null while
   * loading or unavailable.
   */
  cartId: string;
  /**
   * Present only once this vendor's cart has loaded successfully and has at
   * least one line. A group with zero lines is dropped from the bag entirely
   * (see the filter below), so if you see a group here, `cart` is either
   * populated or the group is `isLoading`/`isUnavailable`.
   */
  cart: CartSummary | null;
  /** This vendor's cart specifically is still being fetched. */
  isLoading: boolean;
  /** This vendor's cart specifically failed to fetch — render an inline
   *  "couldn't load this maker's items" for this group only. Other groups
   *  must keep rendering normally; see bag-level `isUnavailable` below for
   *  the all-failed case. */
  isUnavailable: boolean;
  /** A quantity change or removal is in flight for *this* vendor's cart. */
  isMutating: boolean;
}

interface CartState {
  bag: BagGroup[];
  itemCount: number;
  subtotal: Money;
  /**
   * True only while nothing about the bag is known yet at all (first
   * hydration/fetch, before any vendor's cart has settled). Once at least
   * one vendor's cart has resolved (success or error), the bag renders with
   * per-group placeholders instead of hiding everything behind this.
   */
  isLoading: boolean;
  /**
   * True only when the bag is genuinely unusable end-to-end — every vendor
   * cart in it failed to load. A single failing vendor among several healthy
   * ones does NOT set this; that vendor's `BagGroup.isUnavailable` is true
   * instead, and the rest of the bag keeps working. This "unavailable, never
   * empty" guarantee holds at both levels — see Task 2's `getCart` contract.
   */
  isUnavailable: boolean;
  /** The add-to-cart mutation only — unrelated qty/remove mutations elsewhere
   *  in the bag do not affect this, so the product page's button reflects
   *  just its own action. */
  isAdding: boolean;
  error: string | null;
  add: (product: Product, variant: ProductVariant, quantity?: number) => Promise<void>;
  setQty: (cartId: string, lineId: string, quantity: number) => Promise<void>;
  remove: (cartId: string, lineId: string) => Promise<void>;
  /**
   * Retires a vendor's cart after its order has been placed. A completed
   * Medusa cart cannot accept new line items, so leaving the id in storage
   * means every later add from that maker fails with a 400.
   */
  removeVendorCart: (vendorId: string) => void;
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
  // True once client-side hydration has read localStorage at least once.
  // Stays false through SSR and the first client render (which must match
  // the server markup), so `isLoading` below can distinguish "we haven't
  // looked yet" from "we looked and there's nothing" — without it, an SSR
  // pass with no route loader always starts from `carts = {}`, which reads
  // identically to a shopper with a genuinely empty bag and bakes "Your bag
  // is empty" into the server HTML even when the shopper has one.
  const [hydrated, setHydrated] = React.useState(false);

  // Mirrors `carts` for synchronous reads inside async mutation callbacks.
  // `carts` (state) can only be read via a stale closure or a functional
  // updater that doesn't return a value — neither works for "read the current
  // cart id, then await a network call, then write" inside `addMutation`.
  // The ref is always current, which also protects against the same-tab race
  // the code review flagged: two overlapping `add()` calls in one tab no
  // longer read the cart id from a stale render's closure.
  const cartsRef = React.useRef<CartsByVendor>({});

  function applyCarts(next: CartsByVendor) {
    cartsRef.current = next;
    setCarts(next);
  }

  function commitCarts(next: CartsByVendor) {
    applyCarts(next);
    writeStoredCarts(next);
  }

  const removeVendorCart = React.useCallback((vendorId: string) => {
    // Re-read from disk rather than trusting the in-memory map, so a
    // concurrent write from another tab is not clobbered — the same
    // merge-on-write discipline the dead-cart prune uses.
    commitCarts(removeVendorFromCarts(readStoredCarts(), vendorId));
  }, []);

  // Cart ids live in localStorage, which the server cannot read, so carts are
  // hydrated on the client after mount rather than prefetched in a route
  // loader like every other query in this app. Do not "fix" this into a
  // loader prefetch — it would SSR an empty bag for everyone.
  React.useEffect(() => {
    applyCarts(readStoredCarts());
    setHydrated(true);
  }, []);

  // Reconcile with another tab: if a second tab adds/removes a vendor cart,
  // its `localStorage.setItem` fires a `storage` event in *this* tab (not
  // its own), so this is how a second tab's additions become visible here
  // instead of being silently lost the next time this tab writes.
  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      applyCarts(readStoredCarts());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
    // Re-read from disk (not the in-memory `carts` closure) so a concurrent
    // write from another tab isn't clobbered by this prune.
    const next = { ...readStoredCarts() };
    let changed = false;
    for (const vendorId of deadVendorIds) {
      if (vendorId in next) {
        delete next[vendorId];
        changed = true;
      }
    }
    if (changed) commitCarts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadKey]);

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

      let cartId = cartsRef.current[vendor.id]?.cartId;
      if (!cartId) {
        const created = await commerce.createCart();
        cartId = created.id;
      }
      // Merge into whatever is on disk right now (not the closed-over `carts`
      // state) so a different vendor's cart added concurrently in another tab
      // — or even earlier in this same tab, past the `await` above — survives
      // instead of being overwritten by this write.
      const next: CartsByVendor = {
        ...readStoredCarts(),
        [vendor.id]: { cartId, vendorName: vendor.name },
      };
      commitCarts(next);

      await commerce.addLineItem(cartId, variant.id, quantity);
      return cartId;
    },
    onSuccess: () => {
      setError(null);
      setOpen(true);
    },
    onError: (e: Error) => setError(e.message),
    // Invalidate on settle, not just success: a write can land server-side
    // and still surface as a client error (e.g. the response fails to parse
    // or the connection drops after the mutation). Without this, the UI
    // keeps a stale cached cart with no refetch even though the server has
    // the shopper's item.
    onSettled: (cartId, _error, variables) => {
      const id = cartId ?? cartsRef.current[variables.product.vendor?.id ?? ""]?.cartId;
      if (id) void invalidate(id);
    },
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
    onSuccess: () => setError(null),
    onError: (e: Error) => setError(e.message),
    // See addMutation's onSettled: invalidate whether the mutation succeeded
    // or failed, so a write that landed server-side but errored on the
    // client (e.g. a dropped response) doesn't leave stale line items shown.
    onSettled: (_data, _error, vars) => void invalidate(vars.cartId),
  });

  const removeMutation = useMutation({
    mutationFn: ({ cartId, lineId }: { cartId: string; lineId: string }) =>
      commerce.removeLineItem(cartId, lineId),
    onSuccess: () => setError(null),
    onError: (e: Error) => setError(e.message),
    onSettled: (_data, _error, vars) => void invalidate(vars.cartId),
  });

  // Which vendor carts have a mutation in flight right now, keyed by cart id
  // — not a single global flag — so vendor A's controls don't disable while
  // vendor B's are the ones actually mutating.
  const mutatingCartIds = new Set<string>();
  if (qtyMutation.isPending && qtyMutation.variables) {
    mutatingCartIds.add(qtyMutation.variables.cartId);
  }
  if (removeMutation.isPending && removeMutation.variables) {
    mutatingCartIds.add(removeMutation.variables.cartId);
  }
  if (addMutation.isPending && addMutation.variables) {
    // Only relevant if this vendor already has a cart rendered in the bag
    // (e.g. adding another unit while its group is already open) — a brand
    // new vendor cart has no existing group to disable.
    const vendorId = addMutation.variables.product.vendor?.id;
    const existingCartId = vendorId ? cartsRef.current[vendorId]?.cartId : undefined;
    if (existingCartId) mutatingCartIds.add(existingCartId);
  }

  const bag: BagGroup[] = entries
    .map(([vendorId, stored], i) => {
      const q = cartQueries[i];
      const cartId = stored.cartId;
      const isMutating = mutatingCartIds.has(cartId);
      if (!q) return null;
      if (q.isLoading) {
        return {
          vendorId,
          vendorName: stored.vendorName,
          cartId,
          cart: null,
          isLoading: true,
          isUnavailable: false,
          isMutating,
        };
      }
      if (q.isError) {
        return {
          vendorId,
          vendorName: stored.vendorName,
          cartId,
          cart: null,
          isLoading: false,
          isUnavailable: true,
          isMutating,
        };
      }
      // Settled successfully. `data === null` means the cart is genuinely
      // gone (pruned by the effect above on the next tick); an empty cart is
      // simply not shown. Either way, no group renders for it.
      if (!q.data || q.data.lines.length === 0) return null;
      return {
        vendorId,
        vendorName: stored.vendorName,
        cartId,
        cart: q.data,
        isLoading: false,
        isUnavailable: false,
        isMutating,
      };
    })
    .filter((g): g is BagGroup => g !== null);

  const populatedGroups = bag.filter((g) => g.cart !== null);
  const itemCount = populatedGroups.reduce((sum, g) => sum + (g.cart?.itemCount ?? 0), 0);
  const currency = populatedGroups[0]?.cart?.currency ?? "usd";
  const subtotal: Money = {
    amount: populatedGroups.reduce((sum, g) => sum + (g.cart?.subtotal.amount ?? 0), 0),
    currency,
  };

  // Bag-wide loading: nothing has resolved yet for any tracked vendor. Once
  // even one vendor settles (success or error), we have something to render
  // and per-group state takes over — a newly-added vendor's cart loading
  // must not hide vendors that already resolved.
  const isLoading = !hydrated || (entries.length > 0 && cartQueries.every((q) => q.isLoading));
  // Bag-wide unavailable: every tracked vendor cart failed. A partial failure
  // (some vendors OK, one down) is NOT bag-wide — it renders as that one
  // group's `isUnavailable`, per the fix requested in review.
  const isUnavailable = entries.length > 0 && cartQueries.every((q) => q.isError);

  const value: CartState = {
    bag,
    itemCount,
    subtotal,
    isLoading,
    isUnavailable,
    isAdding: addMutation.isPending,
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
    removeVendorCart,
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
