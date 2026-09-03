/**
 * Commerce domain types.
 *
 * These mirror the Medusa store API shape closely enough that the mock adapter
 * in `./adapters/mock.ts` can be swapped for a Medusa adapter without touching
 * UI code. Money is stored as decimal (e.g. 24 = $24.00), matching Medusa's Store API directly.
 */

export type CurrencyCode = "usd" | "npr";

export interface Money {
  amount: number; // decimal, e.g. 24 = $24.00 — matches Medusa's Store API directly
  currency: CurrencyCode;
}

export interface ProductVariant {
  id: string;
  title: string;
  price: Money;
  compareAtPrice?: Money | undefined;
  inventoryQuantity: number;
  options?: Record<string, string> | undefined;
}

export interface ProductImage {
  url: string;
  alt: string;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  subtitle: string;
  description: string;
  story?: string | undefined;
  images: ProductImage[];
  categoryId: string;
  collectionIds: string[];
  vendorId: string;
  vendor?: { id: string; name: string } | undefined;
  variants: ProductVariant[];
  tags: string[];
  material?: string | undefined;
  originCountry: string;
  nepalOrigin: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  popularity: number;
  specs: { label: string; value: string }[];
}

export interface Category {
  id: string;
  handle: string;
  name: string;
  description: string;
  children?: { handle: string; name: string }[];
  featured?: boolean;
}

export interface Vendor {
  id: string;
  handle: string;
  name: string;
  tagline: string;
  description: string;
  location: string;
  since: number;
  rating: number;
  productCount: number;
  heroImage: string;
}

export interface Collection {
  id: string;
  handle: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  editorial: boolean;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  location: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
}

export interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CartLineDetail extends CartLine {
  product: Product;
  variant: ProductVariant;
  lineTotal: Money;
}

export interface Cart {
  id: string;
  lines: CartLineDetail[];
  subtotal: Money;
  shipping: Money;
  tax: Money;
  total: Money;
  itemCount: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  memberSince: string;
  interests: string[];
}

export interface Order {
  id: string;
  displayId: string;
  date: string;
  status: "processing" | "shipped" | "delivered";
  total: Money;
  items: { title: string; quantity: number; image: string }[];
}

export type SortKey =
  | "relevance"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "popularity";

export interface ProductQuery {
  q?: string;
  categoryHandle?: string;
  collectionHandle?: string;
  vendorHandle?: string;
  vendorIds?: string[];
  tags?: string[];
  materials?: string[];
  minPrice?: number; // minor units
  maxPrice?: number;
  minRating?: number;
  nepalOrigin?: boolean;
  inStockOnly?: boolean;
  sort?: SortKey;
  limit?: number;
  offset?: number;
}

export interface ProductListResult {
  products: Product[];
  count: number;
  facets: {
    vendors: { id: string; name: string; count: number }[];
    materials: { value: string; count: number }[];
    tags: { value: string; count: number }[];
    priceRange: { min: number; max: number };
  };
}
