/**
 * Commerce service layer.
 *
 * `commerce` (exported at the bottom of this file) is a partial migration: it
 * merges `mockClient` (fully mock, backed by `./data`) with `medusaClient`
 * (backed by the real Medusa store API), with `medusaClient`'s methods taking
 * priority wherever both implement the same one. See the merge site below for
 * exactly which methods are real today.
 *
 * IMPORTANT: this module is NOT the only thing UI code reads from. Several
 * routes/components still import mock data directly rather than going through
 * `commerce`: `header.tsx` and `footer.tsx` (collections nav), `index.tsx`
 * and `collection.$handle.tsx` (collection editorial fields only — their
 * product grids now come from real data). Collections have no real backend
 * integration (no dedicated Collection editorial content in Medusa); vendors
 * DO now go through `commerce` and get real data derived from products (see
 * medusa-client's `fetchVendors`), but only `id`/`name`/`productCount`/
 * `heroImage` — there's no backend source for tagline/location/since/rating,
 * so those stay `undefined` for real vendors (see `Vendor` in `types.ts`).
 * Product, category, vendor, and search surfaces (shop, category, product
 * detail, vendors, vendor detail) go through `commerce` and get real Medusa
 * data. Keep this in mind before assuming a change to `commerce` affects the
 * whole app — check whether the surface you're touching actually calls
 * through here first.
 *
 *   Medusa mapping reference (for the methods medusaClient implements)
 *   listProducts   -> GET  /store/products
 *   getProduct     -> GET  /store/products?handle=
 *   listCategories -> GET  /store/product-categories
 *   getCategory    -> GET  /store/product-categories (filtered client-side)
 *   listVendors    -> derived from GET /store/products' `store` field
 *   getVendor      -> derived from GET /store/products' `store` field
 */

import {
  categories as mockCategories,
  collections as mockCollections,
  customer as mockCustomer,
  orders as mockOrders,
  products as mockProducts,
  reviews as mockReviews,
  vendors as mockVendors,
} from "./data";
import { medusaClient } from "./medusa-client";
import { NATURAL_LANGUAGE_HINTS, inStock, priceOf, searchScore } from "./scoring";
import type {
  CartSummary,
  Category,
  Collection,
  Customer,
  Order,
  Product,
  ProductListResult,
  ProductQuery,
  Review,
  Vendor,
} from "./types";

export interface CommerceClient {
  listProducts(query?: ProductQuery): Promise<ProductListResult>;
  getProduct(handle: string): Promise<Product | null>;
  listCategories(): Promise<Category[]>;
  getCategory(handle: string): Promise<Category | null>;
  listCollections(): Promise<Collection[]>;
  getCollection(handle: string): Promise<Collection | null>;
  listVendors(): Promise<Vendor[]>;
  getVendor(handle: string): Promise<Vendor | null>;
  listReviews(productId: string): Promise<Review[]>;
  /** Related items — replaceable by a vector/AI recommendation endpoint. */
  getRelatedProducts(handle: string, limit?: number): Promise<Product[]>;
  /** Personalized feed — takes signals so an AI ranker can slot in later. */
  getRecommendations(signals: RecommendationSignals): Promise<Product[]>;
  /** Query understanding hook: today keyword-based, later natural language. */
  getSearchSuggestions(q: string): Promise<SearchSuggestions>;
  getCustomer(): Promise<Customer>;
  listOrders(): Promise<Order[]>;

  // --- cart -------------------------------------------------------------
  // Real Medusa carts. One cart per vendor; the bag in cart.tsx composes them.
  createCart(): Promise<CartSummary>;
  getCart(cartId: string): Promise<CartSummary | null>;
  addLineItem(cartId: string, variantId: string, quantity: number): Promise<CartSummary>;
  updateLineItem(cartId: string, lineId: string, quantity: number): Promise<CartSummary>;
  removeLineItem(cartId: string, lineId: string): Promise<CartSummary>;
}

export interface RecommendationSignals {
  recentlyViewed?: string[];
  wishlist?: string[];
  cart?: string[];
  interests?: string[];
  limit?: number;
}

export interface SearchSuggestions {
  /** Interpreted intent — a stub an AI query parser can replace. */
  interpretation: string | null;
  terms: string[];
  products: Product[];
  categories: Category[];
  vendors: Vendor[];
}

function delay<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

export const mockClient: CommerceClient = {
  async listProducts(query = {}) {
    const category = query.categoryHandle
      ? mockCategories.find((c) => c.handle === query.categoryHandle)
      : undefined;
    const collection = query.collectionHandle
      ? mockCollections.find((c) => c.handle === query.collectionHandle)
      : undefined;
    const vendor = query.vendorHandle
      ? mockVendors.find((v) => v.handle === query.vendorHandle)
      : undefined;

    let list = mockProducts.filter((p) => {
      if (category && p.categoryId !== category.id) return false;
      if (collection && !p.collectionIds.includes(collection.id)) return false;
      if (vendor && p.vendorId !== vendor.id) return false;
      if (query.vendorIds?.length && !query.vendorIds.includes(p.vendorId)) return false;
      if (query.materials?.length && !query.materials.includes(p.material ?? "")) return false;
      if (query.tags?.length && !query.tags.some((t) => p.tags.includes(t))) return false;
      if (query.nepalOrigin && !p.nepalOrigin) return false;
      if (query.inStockOnly && !inStock(p)) return false;
      if (query.minRating && p.rating < query.minRating) return false;
      const price = priceOf(p);
      if (query.minPrice !== undefined && price < query.minPrice) return false;
      if (query.maxPrice !== undefined && price > query.maxPrice) return false;
      if (query.q && searchScore(p, query.q) === 0) return false;
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
        case "rating":
          return b.rating - a.rating;
        case "relevance":
          return query.q
            ? searchScore(b, query.q) - searchScore(a, query.q)
            : b.popularity - a.popularity;
        default:
          return b.popularity - a.popularity;
      }
    });

    const all = mockProducts;
    const facets: ProductListResult["facets"] = {
      vendors: mockVendors
        .map((v) => ({
          id: v.id,
          name: v.name,
          count: list.filter((p) => p.vendorId === v.id).length,
        }))
        .filter((v) => v.count > 0),
      materials: Array.from(new Set(all.map((p) => p.material ?? "")))
        .filter(Boolean)
        .map((m) => ({ value: m, count: list.filter((p) => p.material === m).length }))
        .filter((m) => m.count > 0),
      tags: Array.from(new Set(all.flatMap((p) => p.tags)))
        .map((t) => ({ value: t, count: list.filter((p) => p.tags.includes(t)).length }))
        .filter((t) => t.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 14),
      priceRange: {
        min: Math.min(...all.map(priceOf)),
        max: Math.max(...all.map(priceOf)),
      },
    };

    const offset = query.offset ?? 0;
    const limit = query.limit ?? list.length;
    return delay({ products: list.slice(offset, offset + limit), count: list.length, facets });
  },

  async getProduct(handle) {
    return delay(mockProducts.find((p) => p.handle === handle) ?? null);
  },

  async listCategories() {
    return delay(mockCategories);
  },

  async getCategory(handle) {
    return delay(mockCategories.find((c) => c.handle === handle) ?? null);
  },

  async listCollections() {
    return delay(mockCollections);
  },

  async getCollection(handle) {
    return delay(mockCollections.find((c) => c.handle === handle) ?? null);
  },

  async listVendors() {
    return delay(mockVendors);
  },

  async getVendor(handle) {
    return delay(mockVendors.find((v) => v.handle === handle) ?? null);
  },

  async listReviews(productId) {
    return delay(mockReviews.filter((r) => r.productId === productId));
  },

  async getRelatedProducts(handle, limit = 4) {
    const product = mockProducts.find((p) => p.handle === handle);
    if (!product) return delay([]);
    const scored = mockProducts
      .filter((p) => p.id !== product.id)
      .map((p) => {
        let score = 0;
        if (p.categoryId === product.categoryId) score += 5;
        if (p.vendorId === product.vendorId) score += 4;
        score += p.tags.filter((t) => product.tags.includes(t)).length * 3;
        score += p.collectionIds.filter((c) => product.collectionIds.includes(c)).length * 2;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score || b.p.popularity - a.p.popularity);
    return delay(scored.slice(0, limit).map((s) => s.p));
  },

  async getRecommendations(signals) {
    const seenIds = new Set([...(signals.recentlyViewed ?? []), ...(signals.cart ?? [])]);
    const seeds = mockProducts.filter((p) => seenIds.has(p.id) || seenIds.has(p.handle));
    const interestTags = new Set([...(signals.interests ?? []), ...seeds.flatMap((p) => p.tags)]);
    const ranked = mockProducts
      .filter((p) => !seenIds.has(p.id) && !seenIds.has(p.handle))
      .map((p) => {
        const overlap = p.tags.filter((t) => interestTags.has(t)).length;
        return { p, score: overlap * 10 + p.rating * 4 + p.popularity / 20 };
      })
      .sort((a, b) => b.score - a.score);
    return delay(ranked.slice(0, signals.limit ?? 6).map((r) => r.p));
  },

  async getSearchSuggestions(q) {
    const trimmed = q.trim();
    if (!trimmed) {
      return delay({
        interpretation: null,
        terms: ["first flush tea", "wild honey", "cashmere", "stoneware", "seabuckthorn"],
        products: mockProducts.slice(0, 4),
        categories: mockCategories.slice(0, 4),
        vendors: mockVendors.slice(0, 3),
      });
    }
    const hint = NATURAL_LANGUAGE_HINTS.find((h) => h.match.test(trimmed));
    const effective = hint?.term ? `${trimmed} ${hint.term}` : trimmed;
    const products = mockProducts
      .map((p) => ({ p, score: searchScore(p, effective) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.p);
    return delay({
      interpretation: hint ? `Showing ${hint.label}` : null,
      terms: Array.from(new Set(products.flatMap((p) => p.tags))).slice(0, 5),
      products,
      categories: mockCategories.filter((c) =>
        c.name.toLowerCase().includes(trimmed.toLowerCase()),
      ),
      vendors: mockVendors.filter((v) => v.name.toLowerCase().includes(trimmed.toLowerCase())),
    });
  },

  async getCustomer() {
    return delay(mockCustomer);
  },

  async listOrders() {
    return delay(mockOrders);
  },

  async createCart(): Promise<CartSummary> {
    throw new Error("mockClient has no cart — carts require the Medusa backend");
  },
  async getCart(): Promise<CartSummary | null> {
    throw new Error("mockClient has no cart — carts require the Medusa backend");
  },
  async addLineItem(): Promise<CartSummary> {
    throw new Error("mockClient has no cart — carts require the Medusa backend");
  },
  async updateLineItem(): Promise<CartSummary> {
    throw new Error("mockClient has no cart — carts require the Medusa backend");
  },
  async removeLineItem(): Promise<CartSummary> {
    throw new Error("mockClient has no cart — carts require the Medusa backend");
  },
};

// Real (medusaClient) overrides mock for: listProducts, getProduct,
// listCategories, getCategory, listReviews (always returns [] — no reviews
// module), getRelatedProducts, getRecommendations, getSearchSuggestions,
// listVendors, getVendor (both derived from product data — see medusa-client.ts).
// Still mock-only (medusaClient does not implement these, so mockClient's
// version is used as-is): listCollections, getCollection, getCustomer, listOrders.
export const commerce: CommerceClient = {
  ...mockClient,
  ...medusaClient,
};
