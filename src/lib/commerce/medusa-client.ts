import { sdk } from "../medusa/sdk";
import { getDefaultRegion } from "../medusa/regions";
import { NATURAL_LANGUAGE_HINTS, inStock, priceOf, searchScore } from "./scoring";
import type { CommerceClient } from "./client";
import type { Category, Product, ProductListResult, ProductQuery } from "./types";

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

let categoriesCache: Category[] | null = null;

async function listCategoriesInternal(): Promise<Category[]> {
  if (categoriesCache) return categoriesCache;
  const { product_categories } = await sdk.client.fetch<{
    product_categories: { id: string; name: string; handle: string; description: string }[];
  }>("/store/product-categories", {
    method: "GET",
    query: { fields: "id,name,handle,description", limit: 100 },
  });
  categoriesCache = product_categories.map((c) => ({
    id: c.id,
    handle: c.handle,
    name: c.name,
    description: c.description,
  }));
  return categoriesCache;
}

async function fetchProducts(query: ProductQuery): Promise<Product[]> {
  const region = await getDefaultRegion();
  const params: Record<string, unknown> = {
    fields: PRODUCT_FIELDS,
    region_id: region.id,
    limit: 100,
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
  const { products } = await sdk.client.fetch<{ products: MedusaProduct[] }>("/store/products", {
    method: "GET",
    query: params,
  });
  return products.map(mapProduct);
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
>;

export const medusaClient: RealCommerceMethods = {
  async listProducts(query = {}) {
    let list = await fetchProducts(query);

    list = list.filter((p) => {
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
};
