import { FetchError } from "@medusajs/js-sdk";
import { sdk } from "../medusa/sdk";
import { getDefaultRegion } from "../medusa/regions";
import { createTtlCache } from "../medusa/ttl-cache";
import { NATURAL_LANGUAGE_HINTS, inStock, priceOf, searchScore } from "./scoring";
import type { CommerceClient } from "./client";
import type {
  CartSummary,
  Category,
  CurrencyCode,
  Product,
  ProductListResult,
  ProductQuery,
  Vendor,
} from "./types";

/** Derives a stable, URL-safe vendor handle from a Medusa store's display name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PRODUCT_FIELDS =
  "id,title,subtitle,description,handle,thumbnail,created_at,tags,material,origin_country," +
  "*categories,*collection,store.id,store.name," +
  "*variants.calculated_price,+variants.inventory_quantity";

interface MedusaProductVariant {
  id: string;
  title: string;
  inventory_quantity: number | null;
  calculated_price: { calculated_amount: number; currency_code: string } | null;
}

interface MedusaProduct {
  id: string;
  handle: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnail: string | null;
  tags: { value: string }[] | null;
  material: string | null;
  origin_country: string | null;
  created_at: string;
  categories: { id: string; name: string; handle: string; description: string }[] | null;
  collection: { id: string; title: string; handle: string } | null;
  store: { id: string; name: string } | null;
  variants: MedusaProductVariant[] | null;
}

function mapProduct(raw: MedusaProduct): Product {
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    subtitle: raw.subtitle ?? "",
    description: raw.description ?? "",
    images: raw.thumbnail ? [{ url: raw.thumbnail, alt: raw.title }] : [],
    categoryId: raw.categories?.[0]?.id ?? "",
    collectionIds: raw.collection ? [raw.collection.id] : [],
    vendorId: raw.store?.id ?? "",
    vendor: raw.store ? { id: raw.store.id, name: raw.store.name } : undefined,
    variants: (raw.variants ?? [])
      .filter((v) => v.calculated_price)
      .map((v) => ({
        id: v.id,
        title: v.title,
        price: {
          amount: v.calculated_price!.calculated_amount,
          currency: v.calculated_price!.currency_code as "usd" | "npr",
        },
        inventoryQuantity: v.inventory_quantity ?? 999,
      })),
    tags: raw.tags?.map((t) => t.value) ?? [],
    material: raw.material ?? undefined,
    originCountry: raw.origin_country ?? "",
    nepalOrigin: raw.origin_country === "NP",
    rating: 0,
    reviewCount: 0,
    createdAt: raw.created_at,
    popularity: 0,
    specs: [],
  };
}

const categoriesCache = createTtlCache<Category[]>();

async function listCategoriesInternal(): Promise<Category[]> {
  const cached = categoriesCache.get();
  if (cached) return cached;
  const { product_categories } = await sdk.client.fetch<{
    product_categories: { id: string; name: string; handle: string; description: string }[];
  }>("/store/product-categories", {
    method: "GET",
    query: { fields: "id,name,handle,description", limit: 100 },
  });
  return categoriesCache.set(
    product_categories.map((c) => ({
      id: c.id,
      handle: c.handle,
      name: c.name,
      description: c.description,
    })),
  );
}

// Page size for the /store/products pagination loop below — not a cap on
// results, just how many rows come back per request.
const PRODUCTS_PAGE_SIZE = 100;

async function fetchProducts(query: ProductQuery): Promise<Product[]> {
  const region = await getDefaultRegion();
  const params: Record<string, unknown> = {
    fields: PRODUCT_FIELDS,
    region_id: region.id,
  };
  if (query.categoryHandle) {
    const categories = await listCategoriesInternal();
    const category = categories.find((c) => c.handle === query.categoryHandle);
    if (!category) return [];
    params["category_id"] = [category.id];
  }
  if (query.q) {
    params["q"] = query.q;
  }

  // vendor/material/tag/price/stock filters in `listProducts` below all run
  // client-side over this result set — the Store API has no linked-field
  // filter for `store` (vendor) on /store/products (confirmed: a raw
  // `store_id` query param is rejected as an unrecognized field, unlike the
  // admin API's /admin/products, which gets that support from an
  // admin-only middleware with no storefront equivalent). So client-side
  // vendor filtering needs the FULL matching set, not one truncated page —
  // paginate through every page here rather than cap at an arbitrary limit
  // and silently drop products past it (that previously broke vendor pages,
  // the wishlist, and productCount past the 100th product).
  const products: MedusaProduct[] = [];
  let offset = 0;
  for (;;) {
    const page = await sdk.client.fetch<{ products: MedusaProduct[]; count: number }>(
      "/store/products",
      { method: "GET", query: { ...params, limit: PRODUCTS_PAGE_SIZE, offset } },
    );
    products.push(...page.products);
    offset += page.products.length;
    if (page.products.length === 0 || offset >= page.count) break;
  }
  return products.map(mapProduct);
}

const vendorsCache = createTtlCache<Vendor[]>();

/**
 * Real vendors, derived from the `vendor` (Medusa `store`) field every real
 * `Product` already carries — no dedicated backend route exists for this.
 * Each vendor's handle is slugified from its store name — a vendor renaming
 * their store therefore changes (and can break existing links to) its
 * handle; this is a known limitation, not a "stable" identifier. Two stores
 * can also slugify to the same handle (e.g. "The Fade" and "The-Fade"), so
 * every collision after the first gets a short id suffix appended below —
 * that keeps every vendor's URL unique, at the cost of that vendor's handle
 * shifting if a same-slug store is renamed or removed. Editorial fields
 * (tagline, location, since, rating) have no backend equivalent and are
 * intentionally omitted rather than fabricated.
 *
 * Cached at module scope (like `categoriesCache` above) so `getVendor` and
 * vendor-filtered product listings below don't each trigger their own full
 * product fetch just to look up a vendor.
 */
async function fetchVendors(): Promise<Vendor[]> {
  const cached = vendorsCache.get();
  if (cached) return cached;
  const all = await fetchProducts({});
  const byId = new Map<string, Vendor>();
  for (const p of all) {
    if (!p.vendor) continue;
    const existing = byId.get(p.vendor.id);
    if (existing) {
      existing.productCount += 1;
      continue;
    }
    byId.set(p.vendor.id, {
      id: p.vendor.id,
      handle: slugify(p.vendor.name),
      name: p.vendor.name,
      productCount: 1,
      heroImage: p.images[0]?.url,
    });
  }
  const vendors = Array.from(byId.values());

  const handleCounts = new Map<string, number>();
  for (const v of vendors) {
    const seen = handleCounts.get(v.handle) ?? 0;
    handleCounts.set(v.handle, seen + 1);
    if (seen > 0) {
      v.handle = `${v.handle}-${v.id.slice(-6)}`;
    }
  }

  return vendorsCache.set(vendors);
}

interface MedusaCartLineRaw {
  id: string;
  product_id: string | null;
  product_title: string | null;
  product_handle: string | null;
  variant_id: string | null;
  variant_title: string | null;
  thumbnail: string | null;
  quantity: number;
  unit_price: number;
}

interface MedusaCartRaw {
  id: string;
  currency_code: string;
  items: MedusaCartLineRaw[] | null;
  subtotal: number;
  total: number;
}

function mapCart(raw: MedusaCartRaw): CartSummary {
  const currency = raw.currency_code as CurrencyCode;
  const lines = (raw.items ?? []).map((item) => ({
    id: item.id,
    productId: item.product_id ?? "",
    productTitle: item.product_title ?? "",
    productHandle: item.product_handle ?? "",
    variantId: item.variant_id ?? "",
    variantTitle: item.variant_title ?? undefined,
    thumbnail: item.thumbnail ?? undefined,
    quantity: item.quantity,
    unitPrice: { amount: item.unit_price, currency },
    // Medusa leaves per-line `total` null on a plain cart retrieve, so compute
    // it. Amounts are decimal already — no conversion. Verified: a cart's
    // unit_price (5000) equals the product's calculated_amount (5000).
    lineTotal: { amount: item.unit_price * item.quantity, currency },
  }));

  return {
    id: raw.id,
    currency,
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal: { amount: raw.subtotal, currency },
    total: { amount: raw.total, currency },
  };
}

type RealCommerceMethods = Pick<
  CommerceClient,
  | "listProducts"
  | "getProduct"
  | "listCategories"
  | "getCategory"
  | "listReviews"
  | "getRelatedProducts"
  | "getRecommendations"
  | "getSearchSuggestions"
  | "listVendors"
  | "getVendor"
  | "createCart"
  | "getCart"
  | "addLineItem"
  | "updateLineItem"
  | "removeLineItem"
>;

export const medusaClient: RealCommerceMethods = {
  async listProducts(query = {}) {
    let list = await fetchProducts(query);

    // Resolve the handle to a vendor id once via the (cached) vendor list,
    // rather than recomputing slugify(p.vendor?.name) per product: two
    // stores can slugify to the same handle, and fetchVendors' collision
    // suffix wouldn't be reproduced by recomputing it here, which would
    // either match the wrong vendor or match none at all.
    const vendorId = query.vendorHandle
      ? (await fetchVendors()).find((v) => v.handle === query.vendorHandle)?.id
      : undefined;

    list = list.filter((p) => {
      if (query.vendorHandle && p.vendorId !== vendorId) return false;
      if (query.vendorIds?.length && !query.vendorIds.includes(p.vendorId)) return false;
      if (query.materials?.length && !query.materials.includes(p.material ?? "")) return false;
      if (query.tags?.length && !query.tags.some((t) => p.tags.includes(t))) return false;
      if (query.nepalOrigin && !p.nepalOrigin) return false;
      if (query.inStockOnly && !inStock(p)) return false;
      const price = priceOf(p);
      if (query.minPrice !== undefined && price < query.minPrice) return false;
      if (query.maxPrice !== undefined && price > query.maxPrice) return false;
      return true;
    });

    const sort = query.sort ?? (query.q ? "relevance" : "popularity");
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "newest":
          return b.createdAt.localeCompare(a.createdAt);
        case "price-asc":
          return priceOf(a) - priceOf(b);
        case "price-desc":
          return priceOf(b) - priceOf(a);
        case "relevance":
          return query.q ? searchScore(b, query.q) - searchScore(a, query.q) : 0;
        default:
          return 0;
      }
    });

    const all = list;
    const vendorCounts = new Map<string, { id: string; name: string; count: number }>();
    for (const p of all) {
      if (!p.vendor) continue;
      const entry = vendorCounts.get(p.vendor.id) ?? { id: p.vendor.id, name: p.vendor.name, count: 0 };
      entry.count += 1;
      vendorCounts.set(p.vendor.id, entry);
    }

    const facets: ProductListResult["facets"] = {
      vendors: Array.from(vendorCounts.values()),
      materials: Array.from(new Set(all.map((p) => p.material ?? "")))
        .filter(Boolean)
        .map((m) => ({ value: m, count: all.filter((p) => p.material === m).length })),
      tags: Array.from(new Set(all.flatMap((p) => p.tags)))
        .map((t) => ({ value: t, count: all.filter((p) => p.tags.includes(t)).length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 14),
      priceRange: all.length
        ? { min: Math.min(...all.map(priceOf)), max: Math.max(...all.map(priceOf)) }
        : { min: 0, max: 0 },
    };

    const offset = query.offset ?? 0;
    const limit = query.limit ?? list.length;
    return { products: list.slice(offset, offset + limit), count: list.length, facets };
  },

  async getProduct(handle) {
    const region = await getDefaultRegion();
    const { products } = await sdk.client.fetch<{ products: MedusaProduct[] }>("/store/products", {
      method: "GET",
      query: { fields: PRODUCT_FIELDS, handle, region_id: region.id },
    });
    return products[0] ? mapProduct(products[0]) : null;
  },

  listCategories: listCategoriesInternal,

  async getCategory(handle) {
    const categories = await listCategoriesInternal();
    return categories.find((c) => c.handle === handle) ?? null;
  },

  async listReviews() {
    return [];
  },

  async getRelatedProducts(handle, limit = 4) {
    const all = await fetchProducts({});
    const product = all.find((p) => p.handle === handle);
    if (!product) return [];
    const scored = all
      .filter((p) => p.id !== product.id)
      .map((p) => {
        let score = 0;
        if (p.categoryId === product.categoryId) score += 5;
        if (p.vendorId === product.vendorId) score += 4;
        score += p.tags.filter((t) => product.tags.includes(t)).length * 3;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.p);
  },

  async getRecommendations(signals) {
    const all = await fetchProducts({});
    const seenIds = new Set([...(signals.recentlyViewed ?? []), ...(signals.cart ?? [])]);
    const seeds = all.filter((p) => seenIds.has(p.id) || seenIds.has(p.handle));
    const interestTags = new Set([...(signals.interests ?? []), ...seeds.flatMap((p) => p.tags)]);
    const ranked = all
      .filter((p) => !seenIds.has(p.id) && !seenIds.has(p.handle))
      .map((p) => ({ p, score: p.tags.filter((t) => interestTags.has(t)).length }))
      .sort((a, b) => b.score - a.score);
    return ranked.slice(0, signals.limit ?? 6).map((r) => r.p);
  },

  async getSearchSuggestions(q) {
    const trimmed = q.trim();
    const all = await fetchProducts({});
    if (!trimmed) {
      return {
        interpretation: null,
        terms: [],
        products: all.slice(0, 4),
        categories: (await listCategoriesInternal()).slice(0, 4),
        vendors: [],
      };
    }
    const hint = NATURAL_LANGUAGE_HINTS.find((h) => h.match.test(trimmed));
    const effective = hint?.term ? `${trimmed} ${hint.term}` : trimmed;
    const products = all
      .map((p) => ({ p, score: searchScore(p, effective) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.p);
    return {
      interpretation: hint ? `Showing ${hint.label}` : null,
      terms: Array.from(new Set(products.flatMap((p) => p.tags))).slice(0, 5),
      products,
      categories: [],
      vendors: [],
    };
  },

  listVendors: fetchVendors,

  async getVendor(handle) {
    const vendors = await fetchVendors();
    return vendors.find((v) => v.handle === handle) ?? null;
  },

  async createCart() {
    const region = await getDefaultRegion();
    const { cart } = await sdk.client.fetch<{ cart: MedusaCartRaw }>("/store/carts", {
      method: "POST",
      body: { region_id: region.id },
    });
    return mapCart(cart);
  },

  async getCart(cartId: string) {
    // `cart` is intentionally optional here: verified empirically against
    // the live backend that GET /store/carts/:id does NOT 404 for a
    // well-formed but nonexistent cart id — it resolves HTTP 200 with an
    // empty body (`{}`, no `cart` key at all). That is the primary
    // "genuinely gone" signal below.
    let response: { cart?: MedusaCartRaw };
    try {
      response = await sdk.client.fetch<{ cart?: MedusaCartRaw }>(`/store/carts/${cartId}`, {
        method: "GET",
      });
    } catch (err) {
      // Only a genuine 404 (confirmed empirically: a route that fails to
      // resolve at all, e.g. an empty cartId producing `/store/carts/`,
      // throws a `FetchError` with `status === 404`) is treated as "not
      // found" here. Everything else — a network failure reaching the
      // backend at all (confirmed empirically: pointing the SDK at an
      // unreachable host throws a plain `TypeError`, not a `FetchError`,
      // with no `status` property) or a non-404 FetchError such as a 5xx —
      // is rethrown. Swallowing those as `null` would make a transient
      // backend blip indistinguishable from a cart that's actually gone,
      // and the caller (the vendor→cart map) would silently and
      // permanently drop a live cart on nothing more than a hiccup.
      if (err instanceof FetchError && err.status === 404) {
        return null;
      }
      throw err;
    }
    // The well-formed-but-nonexistent-id case: no exception, just no
    // `cart` key in the response body. This is normal — a cart id that no
    // longer resolves (deleted, expired, already completed) — so the
    // caller drops it from its map.
    return response.cart ? mapCart(response.cart) : null;
  },

  async addLineItem(cartId: string, variantId: string, quantity: number) {
    const { cart } = await sdk.client.fetch<{ cart: MedusaCartRaw }>(
      `/store/carts/${cartId}/line-items`,
      { method: "POST", body: { variant_id: variantId, quantity } },
    );
    return mapCart(cart);
  },

  async updateLineItem(cartId: string, lineId: string, quantity: number) {
    const { cart } = await sdk.client.fetch<{ cart: MedusaCartRaw }>(
      `/store/carts/${cartId}/line-items/${lineId}`,
      { method: "POST", body: { quantity } },
    );
    return mapCart(cart);
  },

  async removeLineItem(cartId: string, lineId: string) {
    await sdk.client.fetch(`/store/carts/${cartId}/line-items/${lineId}`, {
      method: "DELETE",
    });
    // The delete response shape differs across versions; re-read the cart so
    // callers always get a consistent CartSummary.
    const cart = await medusaClient.getCart(cartId);
    if (!cart) {
      // Genuinely rare (the cart was deleted/expired between the DELETE above
      // and this re-read) and self-heals: cart.tsx's dead-cart-pruning effect
      // drops this vendor's stored id once it sees a null getCart result, so
      // no raw id needs to reach shopper-facing copy — log it for debugging
      // instead.
      console.error(
        `removeLineItem: cart ${cartId} was gone on re-read after removing a line item`,
      );
      throw new Error("This item's cart is no longer available. It's been removed from your bag.");
    }
    return cart;
  },
};
