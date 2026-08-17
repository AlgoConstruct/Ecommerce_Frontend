import { createFileRoute, notFound } from "@tanstack/react-router";
import { MapPin, Star } from "lucide-react";
import { Catalog } from "@/components/site/catalog";
import { products, vendors } from "@/lib/commerce/data";

export const Route = createFileRoute("/vendor/$handle")({
  loader: ({ params }) => {
    const vendor = vendors.find((v) => v.handle === params.handle);
    if (!vendor) throw notFound();
    return { vendor };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Vendor not found — InfiniTrends" }, { name: "robots", content: "noindex" }],
      };
    }
    const { vendor } = loaderData;
    return {
      meta: [
        { title: `${vendor.name} — Vendor storefront on InfiniTrends` },
        { name: "description", content: vendor.tagline },
        { property: "og:title", content: `${vendor.name} on InfiniTrends` },
        { property: "og:description", content: vendor.tagline },
      ],
    };
  },
  component: VendorPage,
});

function VendorPage() {
  const { vendor } = Route.useLoaderData();
  const list = products.filter((p) => p.vendorId === vendor.id);

  return (
    <div>
      <section className="relative">
        <img src={vendor.heroImage} alt={vendor.name} className="h-[44vh] w-full object-cover" />
        <div className="absolute inset-0 bg-ink/40" />
      </section>

      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="-mt-16 grid gap-8 rounded-sm border border-border bg-background p-8 shadow-xl lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow">Vendor storefront</p>
            <h1 className="display-lg mt-2">{vendor.name}</h1>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">{vendor.description}</p>
          </div>
          <dl className="grid grid-cols-2 gap-6 self-center text-sm">
            <div>
              <dt className="eyebrow">Based in</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
                {vendor.location}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Making since</dt>
              <dd className="mt-1">{vendor.since}</dd>
            </div>
            <div>
              <dt className="eyebrow">Rating</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-current" aria-hidden />
                {vendor.rating.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Products</dt>
              <dd className="mt-1">{list.length}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-14 max-w-2xl font-display text-2xl leading-snug">{vendor.tagline}</p>

        <div className="py-14">
          <Catalog products={list} />
        </div>
      </div>
    </div>
  );
}
