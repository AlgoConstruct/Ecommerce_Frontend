import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { productQuery, relatedProductsQuery } from "@/lib/commerce/queries";
import { formatMoney } from "@/lib/commerce/format";
import { useCart } from "@/lib/commerce/cart";
import { ProductGrid } from "@/components/site/product-card";
import { PageHeader } from "@/components/site/catalog";

export const Route = createFileRoute("/product/$handle")({
  loader: async ({ params, context }) => {
    const [product] = await Promise.all([
      context.queryClient.ensureQueryData(productQuery(params.handle)),
      context.queryClient.ensureQueryData(relatedProductsQuery(params.handle, 4)),
    ]);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Product not found — InfiniTrends" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { product } = loaderData;
    return {
      meta: [
        { title: `${product.title} — InfiniTrends` },
        { name: "description", content: product.description },
        { property: "og:title", content: `${product.title} — InfiniTrends` },
        { property: "og:description", content: product.description },
      ],
    };
  },
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { product } = Route.useLoaderData();
  const { add, isMutating } = useCart();
  const { data: related = [] } = useQuery(relatedProductsQuery(product.handle, 4));
  const variant = product.variants[0];

  return (
    <div>
      <div className="mx-auto max-w-[1400px] px-5 py-14 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-4/5 overflow-hidden rounded-sm bg-surface">
            {product.images[0] && (
              <img
                src={product.images[0].url}
                alt={product.images[0].alt}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div>
            {product.vendor && <p className="eyebrow">{product.vendor.name}</p>}
            <h1 className="display-lg mt-2">{product.title}</h1>
            <p className="mt-2 text-base text-muted-foreground">{product.subtitle}</p>
            {variant && <p className="mt-6 text-2xl font-medium">{formatMoney(variant.price)}</p>}
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
            {variant && (
              <button
                type="button"
                onClick={() => void add(product, variant)}
                disabled={isMutating}
                className="mt-8 inline-flex items-center justify-center rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground disabled:opacity-60"
              >
                {isMutating ? "Adding…" : "Add to cart"}
              </button>
            )}
            {product.specs.length > 0 && (
              <dl className="mt-10 space-y-2 border-t border-border pt-6">
                {product.specs.map((s) => (
                  <div key={s.label} className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
          <PageHeader eyebrow="You might also like" title="Related products" />
          <ProductGrid products={related} columns={4} />
        </div>
      )}
    </div>
  );
}
