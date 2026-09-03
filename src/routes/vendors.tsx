import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/site/catalog";
import { vendorsQuery } from "@/lib/commerce/queries";

export const Route = createFileRoute("/vendors")({
  loader: ({ context }) => context.queryClient.ensureQueryData(vendorsQuery()),
  head: () => ({
    meta: [
      { title: "Vendors & makers — InfiniTrends" },
      {
        name: "description",
        content:
          "Meet the independent studios, tea gardens and family workshops selling on InfiniTrends.",
      },
      { property: "og:title", content: "Vendors & makers — InfiniTrends" },
      {
        property: "og:description",
        content: "Verified independent vendors, each with their own storefront and story.",
      },
    ],
  }),
  component: Vendors,
});

function Vendors() {
  const { data: vendors = [] } = useQuery(vendorsQuery());

  return (
    <div>
      <PageHeader
        eyebrow="The makers"
        title="Vendors"
        description="Every storefront on InfiniTrends is run by the people who actually make the goods."
      />
      <div className="mx-auto grid max-w-[1400px] gap-8 px-5 pb-24 sm:grid-cols-2 lg:grid-cols-3 lg:px-10">
        {vendors.map((v) => (
          <Link
            key={v.id}
            to="/vendor/$handle"
            params={{ handle: v.handle }}
            className="group block"
          >
            <div className="overflow-hidden rounded-sm bg-surface">
              <img
                src={v.heroImage}
                alt={v.name}
                loading="lazy"
                className="aspect-4/3 w-full object-cover transition-transform duration-700 ease-soft group-hover:scale-105"
              />
            </div>
            <div className="mt-4">
              <h2 className="font-display text-2xl">{v.name}</h2>
            </div>
            {v.tagline && (
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{v.tagline}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{v.productCount} products</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
