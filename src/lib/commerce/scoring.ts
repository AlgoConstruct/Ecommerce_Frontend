import type { Product } from "./types";

export const NATURAL_LANGUAGE_HINTS: { match: RegExp; term: string; label: string }[] = [
  { match: /gift|present/i, term: "handwoven", label: "gift-worthy handmade pieces" },
  { match: /morning|breakfast|wake/i, term: "coffee", label: "morning ritual essentials" },
  { match: /sleep|calm|stress|relax/i, term: "herbal", label: "calming wellness products" },
  { match: /warm|winter|cold/i, term: "wool", label: "warm textiles" },
  { match: /skin|face|glow/i, term: "skincare", label: "skincare" },
  { match: /under\s*\$?(\d+)/i, term: "", label: "budget-filtered results" },
];

export function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function searchScore(product: Product, q: string): number {
  const tokens = tokenize(q);
  if (!tokens.length) return 0;
  const haystack = [
    product.title,
    product.subtitle,
    product.description,
    product.material ?? "",
    product.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (product.title.toLowerCase().includes(token)) score += 6;
    if (product.tags.some((t) => t.includes(token))) score += 4;
    if (haystack.includes(token)) score += 2;
  }
  return score;
}

export function priceOf(product: Product) {
  return Math.min(...product.variants.map((v) => v.price.amount));
}

export function inStock(product: Product) {
  return product.variants.some((v) => v.inventoryQuantity > 0);
}
