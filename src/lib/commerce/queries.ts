import { queryOptions } from "@tanstack/react-query";
import { commerce, type RecommendationSignals } from "./client";
import type { ProductQuery } from "./types";

export const productListQuery = (query: ProductQuery = {}) =>
  queryOptions({
    queryKey: ["products", query],
    queryFn: () => commerce.listProducts(query),
  });

export const productQuery = (handle: string) =>
  queryOptions({
    queryKey: ["product", handle],
    queryFn: () => commerce.getProduct(handle),
  });

export const categoriesQuery = () =>
  queryOptions({ queryKey: ["categories"], queryFn: () => commerce.listCategories() });

export const categoryQuery = (handle: string) =>
  queryOptions({ queryKey: ["category", handle], queryFn: () => commerce.getCategory(handle) });

export const collectionsQuery = () =>
  queryOptions({ queryKey: ["collections"], queryFn: () => commerce.listCollections() });

export const collectionQuery = (handle: string) =>
  queryOptions({
    queryKey: ["collection", handle],
    queryFn: () => commerce.getCollection(handle),
  });

export const vendorsQuery = () =>
  queryOptions({ queryKey: ["vendors"], queryFn: () => commerce.listVendors() });

export const vendorQuery = (handle: string) =>
  queryOptions({ queryKey: ["vendor", handle], queryFn: () => commerce.getVendor(handle) });

export const reviewsQuery = (productId: string) =>
  queryOptions({ queryKey: ["reviews", productId], queryFn: () => commerce.listReviews(productId) });

export const relatedProductsQuery = (handle: string, limit = 4) =>
  queryOptions({
    queryKey: ["related", handle, limit],
    queryFn: () => commerce.getRelatedProducts(handle, limit),
  });

export const recommendationsQuery = (signals: RecommendationSignals) =>
  queryOptions({
    queryKey: ["recommendations", signals],
    queryFn: () => commerce.getRecommendations(signals),
  });

export const searchSuggestionsQuery = (q: string) =>
  queryOptions({
    queryKey: ["suggestions", q],
    queryFn: () => commerce.getSearchSuggestions(q),
  });

export const customerQuery = () =>
  queryOptions({ queryKey: ["customer"], queryFn: () => commerce.getCustomer() });

export const ordersQuery = () =>
  queryOptions({ queryKey: ["orders"], queryFn: () => commerce.listOrders() });
