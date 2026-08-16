import * as React from "react";
import { ProductGrid } from "./product-card";
import { vendors as allVendors } from "@/lib/commerce/data";
import type { Product, SortKey } from "@/lib/commerce/types";
import { cn } from "@/lib/utils";

const sorts: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "rating", label: "Top rated" },
];

function priceOf(p: Product) {
  return Math.min(...p.variants.map((v) => v.price.amount));
}

export function Catalog({ products }: { products: Product[] }) {
  const [sort, setSort] = React.useState<SortKey>("relevance");
  const [vendorIds, setVendorIds] = React.useState<string[]>([]);
  const [maxPrice, setMaxPrice] = React.useState<number | null>(null);
  const [nepalOnly, setNepalOnly] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const materials = Array.from(new Set(products.map((p) => p.material).filter(Boolean)));
  const vendorFacets = allVendors.filter((v) => products.some((p) => p.vendorId === v.id));

  const list = products
    .filter((p) => (vendorIds.length ? vendorIds.includes(p.vendorId) : true))
    .filter((p) => (maxPrice ? priceOf(p) <= maxPrice : true))
    .filter((p) => (nepalOnly ? p.nepalOrigin : true))
    .sort((a, b) => {
      if (sort === "price-asc") return priceOf(a) - priceOf(b);
      if (sort === "price-desc") return priceOf(b) - priceOf(a);
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "newest") return +new Date(b.createdAt) - +new Date(a.createdAt);
      return b.popularity - a.popularity;
    });

  const rail = (
    <div className="space-y-8">
      <fieldset>
        <legend className="eyebrow">Vendor</legend>
        <div className="mt-3 space-y-2">
          {vendorFacets.map((v) => (
            <label key={v.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="accent-primary"
                checked={vendorIds.includes(v.id)}
                onChange={() =>
                  setVendorIds((prev) =>
                    prev.includes(v.id) ? prev.filter((x) => x !== v.id) : [...prev, v.id],
                  )
                }
              />
              {v.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow">Price</legend>
        <div className="mt-3 space-y-2">
          {[3000, 6000, 12000, 30000].map((cap) => (
            <label key={cap} className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="radio"
                name="price"
                className="accent-primary"
                checked={maxPrice === cap}
                onChange={() => setMaxPrice(cap)}
              />
              Under ${cap / 100}
            </label>
          ))}
          <button
            type="button"
            className="text-xs underline"
            onClick={() => setMaxPrice(null)}
          >
            Clear price
          </button>
        </div>
      </fieldset>

      {materials.length > 0 && (
        <div>
          <p className="eyebrow">Materials</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {materials.map((m) => (
              <span
                key={m}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="accent-primary"
          checked={nepalOnly}
          onChange={() => setNepalOnly((v) => !v)}
        />
        Nepal origin only
      </label>
    </div>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block" aria-label="Filters">
        {rail}
      </aside>

      <div>
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-4">
          <p className="text-sm text-muted-foreground">{list.length} products</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="text-sm underline lg:hidden"
            >
              Filters
            </button>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Sort by</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="border-b border-border bg-transparent py-1 text-sm outline-none"
              >
                {sorts.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className={cn("mb-8 lg:hidden", !filtersOpen && "hidden")}>{rail}</div>

        {list.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            No products match those filters.
          </p>
        ) : (
          <ProductGrid products={list} columns={3} />
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-10 pt-14 lg:px-10">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="display-lg mt-3 max-w-3xl">{title}</h1>
      {description && (
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
