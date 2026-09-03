import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Catalog, PageHeader } from "@/components/site/catalog";
import { categoryQuery, productListQuery } from "@/lib/commerce/queries";

export const Route = createFileRoute("/category/$handle")({
  loader: async ({ params, context }) => {
    const [category] = await Promise.all([
      context.queryClient.ensureQueryData(categoryQuery(params.handle)),
      context.queryClient.ensureQueryData(
        productListQuery({ categoryHandle: params.handle, limit: 100 }),
      ),
    ]);
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
  const { data } = useQuery(productListQuery({ categoryHandle: category.handle, limit: 100 }));
  const list = data?.products ?? [];

  return (
    <div>
      <PageHeader eyebrow="Category" title={category.name} description={category.description} />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        <Catalog products={list} />
      </div>
    </div>
  );
}
