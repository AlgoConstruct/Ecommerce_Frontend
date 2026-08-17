import { createFileRoute, notFound } from "@tanstack/react-router";
import { Catalog, PageHeader } from "@/components/site/catalog";
import { categories, products } from "@/lib/commerce/data";

export const Route = createFileRoute("/category/$handle")({
  loader: ({ params }) => {
    const category = categories.find((c) => c.handle === params.handle);
    if (!category) throw notFound();
    return { category };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Category not found — InfiniTrends" }, { name: "robots", content: "noindex" }] };
    }
    const { category } = loaderData;
    return {
      meta: [
        { title: `${category.name} — InfiniTrends` },
        { name: "description", content: category.description },
        { property: "og:title", content: `${category.name} — InfiniTrends` },
        { property: "og:description", content: category.description },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useLoaderData();
  const list = products.filter((p) => p.categoryId === category.id);

  return (
    <div>
      <PageHeader eyebrow="Category" title={category.name} description={category.description} />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        <Catalog products={list} />
      </div>
    </div>
  );
}
