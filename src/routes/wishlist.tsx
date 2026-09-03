import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { productListQuery } from "@/lib/commerce/queries";
import { useCart } from "@/lib/commerce/cart";
import { ProductGrid } from "@/components/site/product-card";
import { PageHeader } from "@/components/site/catalog";

export const Route = createFileRoute("/wishlist")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productListQuery({ limit: 100 })),
  head: () => ({
    meta: [
      { title: "Wishlist — InfiniTrends" },
      {
        name: "description",
        content: "Products you've saved from the InfiniTrends marketplace.",
      },
      { property: "og:title", content: "Wishlist — InfiniTrends" },
      {
        property: "og:description",
        content: "Products you've saved from the InfiniTrends marketplace.",
      },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist } = useCart();
  const { data } = useQuery(productListQuery({ limit: 100 }));
  const products = (data?.products ?? []).filter((p) => wishlist.includes(p.id));

  return (
    <div>
      <PageHeader
        eyebrow="Saved"
        title="Your wishlist"
        {...(products.length > 0
          ? {
              description: `${products.length} saved product${products.length === 1 ? "" : "s"}.`,
            }
          : {})}
      />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        {products.length === 0 ? (
          <div>
            <p className="text-sm text-muted-foreground">
              Nothing saved yet. Tap the heart on any product to add it here.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground"
            >
              Browse the marketplace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </div>
  );
}
