import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Catalog, PageHeader } from "@/components/site/catalog";
import { productListQuery } from "@/lib/commerce/queries";

interface ShopSearch {
  q?: string | undefined;
}

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search["q"] === "string" && search["q"] ? (search["q"] as string) : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      productListQuery(deps.q ? { q: deps.q, limit: 100 } : { limit: 100 }),
    ),
  head: () => ({
    meta: [
      { title: "Shop all — InfiniTrends" },
      {
        name: "description",
        content:
          "Browse every product on InfiniTrends: tea, coffee, textiles, ceramics, wellness and craft from independent makers.",
      },
      { property: "og:title", content: "Shop all — InfiniTrends" },
      {
        property: "og:description",
        content: "Filter by vendor, price, material and origin across the full marketplace.",
      },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { q } = Route.useSearch();
  const { data } = useQuery(productListQuery(q ? { q, limit: 100 } : { limit: 100 }));
  const list = data?.products ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={q ? "Search results" : "Marketplace"}
        title={q ? `Results for “${q}”` : "Shop all"}
        description={
          q
            ? `${list.length} products matched your search across every vendor.`
            : "Everything on InfiniTrends, from first-flush tea to hand-thrown stoneware."
        }
      />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        <Catalog products={list} />
      </div>
    </div>
  );
}
