import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProductGrid } from "@/components/site/product-card";
import { collections, products } from "@/lib/commerce/data";

export const Route = createFileRoute("/collection/$handle")({
  loader: ({ params }) => {
    const collection = collections.find((c) => c.handle === params.handle);
    if (!collection) throw notFound();
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
  const list = products.filter((p) => p.collectionIds.includes(collection.id));

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
        <ProductGrid products={list} />
      </div>
    </div>
  );
}
