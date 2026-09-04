import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductGrid } from "@/components/site/product-card";
import { collections } from "@/lib/commerce/data";
import { productListQuery } from "@/lib/commerce/queries";

export const Route = createFileRoute("/collection/$handle")({
  loader: async ({ params, context }) => {
    const collection = collections.find((c) => c.handle === params.handle);
    if (!collection) throw notFound();
    // Only "nepal-origin" has a true real-data equivalent. The page below
    // actually filters on `p.nepalOrigin` (origin_country === "NP"), not on
    // membership in the seeded Medusa "Nepal Origin" collection — the two
    // happen to select the same 10 products today because every seeded
    // product is Nepal-origin, but they are not the same filter. The other
    // three mock collections have no curated real subset, so we fall back
    // to the full catalog rather than fabricate a filter — the page below
    // makes that explicit instead of implying it's curated.
    await context.queryClient.ensureQueryData(productListQuery({ limit: 100 }));
    return { collection };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Collection not found — InfiniTrends" }, { name: "robots", content: "noindex" }],
      };
    }
    const { collection } = loaderData;
    return {
      meta: [
        { title: `${collection.title} — InfiniTrends Collections` },
        { name: "description", content: collection.description },
        { property: "og:title", content: `${collection.title} — InfiniTrends` },
        { property: "og:description", content: collection.description },
      ],
    };
  },
  component: CollectionPage,
});

function CollectionPage() {
  const { collection } = Route.useLoaderData();
  const { data } = useQuery(productListQuery({ limit: 100 }));
  const all = data?.products ?? [];
  const isNepalOrigin = collection.handle === "nepal-origin";
  const list = isNepalOrigin ? all.filter((p) => p.nepalOrigin) : all;

  return (
    <div>
      <section className="relative">
        <img
          src={collection.image}
          alt={collection.title}
          className="h-[52vh] w-full object-cover"
        />
        <div className="absolute inset-0 bg-ink/45" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-[1400px] px-5 pb-12 text-ink-foreground lg:px-10">
            <p className="eyebrow text-ink-foreground/75">{collection.subtitle}</p>
            <h1 className="display-xl mt-3 max-w-3xl">{collection.title}</h1>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        <p className="mx-auto max-w-2xl py-16 text-center font-display text-2xl leading-snug">
          {collection.description}
        </p>
        {!isNepalOrigin && (
          <p className="mx-auto -mt-10 mb-12 max-w-2xl text-center text-xs text-muted-foreground">
            This collection doesn't have a curated real-product set yet — showing the full
            InfiniTrends catalog instead.
          </p>
        )}
        <ProductGrid products={list} />
      </div>
    </div>
  );
}
