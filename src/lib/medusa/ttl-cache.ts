/**
 * Matches the router's React Query `staleTime`, so the server-side caches and
 * the browser's query cache go stale on the same clock.
 */
export const CACHE_TTL_MS = 60_000;

/**
 * A single value held for a short window.
 *
 * Module-scoped caches on the SSR server live for the lifetime of the node
 * process, not one request. Held forever, a vendor, category, or region
 * created in the admin *after* the server started would never reach the
 * storefront until someone restarted it — and for vendors that is worse than
 * a stale list, because `fetchProducts` resolves `vendorHandle` through
 * `fetchVendors`: an unknown handle yields no vendor id, and the filter then
 * drops every product, so a new vendor's page renders empty rather than late.
 */
export function createTtlCache<T>(ttlMs: number = CACHE_TTL_MS) {
  let entry: { value: T; expiresAt: number } | null = null;
  return {
    get(): T | null {
      if (!entry || Date.now() >= entry.expiresAt) return null;
      return entry.value;
    },
    set(value: T): T {
      entry = { value, expiresAt: Date.now() + ttlMs };
      return value;
    },
    clear() {
      entry = null;
    },
  };
}
