import { Link } from "@tanstack/react-router";
import { Heart, Star } from "lucide-react";
import type { Product } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/commerce/format";
import { useCart } from "@/lib/commerce/cart";
import { cn } from "@/lib/utils";

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const { wishlist, toggleWish } = useCart();
  const variant = product.variants[0];
  const vendor = product.vendor;

  // A product with no priced variant in the active region (e.g. leftover
  // test data) can't be shown or bought here — a card with no price and no
  // working add-to-cart would look buyable but isn't, which is worse than
  // just leaving it out of the grid. Skip it rather than crash or mislead.
  if (!variant) return null;

  const wished = wishlist.includes(product.id);
  const onSale = variant.compareAtPrice && variant.compareAtPrice.amount > variant.price.amount;

  return (
    <article className="group relative">
      <Link
        to="/product/$handle"
        params={{ handle: product.handle }}
        className="block"
        aria-label={product.title}
      >
        <div className="relative aspect-4/5 overflow-hidden rounded-sm bg-surface">
          <img
            src={product.images[0]?.url}
            alt={product.images[0]?.alt ?? product.title}
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.04]"
          />
          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {product.nepalOrigin && (
              <span className="rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground backdrop-blur">
                Nepal origin
              </span>
            )}
            {onSale && (
              <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-primary-foreground">
                Sale
              </span>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => toggleWish(product.id)}
        aria-label={wished ? `Remove ${product.title} from wishlist` : `Save ${product.title}`}
        aria-pressed={wished}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur transition-colors hover:bg-background"
      >
        <Heart className={cn("h-4 w-4", wished && "fill-primary text-primary")} />
      </button>

      <div className="mt-3 space-y-1">
        {vendor && <p className="eyebrow inline-block">{vendor.name}</p>}
        <h3 className="text-base leading-snug">
          <Link to="/product/$handle" params={{ handle: product.handle }}>
            {product.title}
          </Link>
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">{product.subtitle}</p>
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm font-medium">
            {formatMoney(variant.price)}
            {onSale && (
              <span className="ml-2 text-muted-foreground line-through">
                {formatMoney(variant.compareAtPrice!)}
              </span>
            )}
          </p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
            {product.rating.toFixed(1)}
            <span className="sr-only">out of 5</span>
            <span>({product.reviewCount})</span>
          </span>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  columns = 4,
}: {
  products: Product[];
  columns?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-5 gap-y-10",
        columns === 4 ? "md:grid-cols-3 lg:grid-cols-4" : "md:grid-cols-3",
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
