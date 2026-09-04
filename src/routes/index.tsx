import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Globe, Leaf, ShieldCheck, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import hero from "@/assets/hero.jpg";
import { ProductGrid } from "@/components/site/product-card";
import { categoriesQuery, productListQuery, vendorsQuery } from "@/lib/commerce/queries";
import { collections, images } from "@/lib/commerce/data";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery()),
      context.queryClient.ensureQueryData(productListQuery({ limit: 8 })),
      context.queryClient.ensureQueryData(productListQuery({ sort: "newest", limit: 4 })),
      context.queryClient.ensureQueryData(vendorsQuery()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "InfiniTrends — Curated marketplace for makers worldwide" },
      {
        name: "description",
        content:
          "Discover tea, textiles, ceramics and wellness goods from independent makers. Editorial collections, verified vendors, worldwide shipping.",
      },
      { property: "og:title", content: "InfiniTrends — Curated marketplace for makers worldwide" },
      {
        property: "og:description",
        content:
          "Editorial commerce meets intelligent discovery. Shop direct from independent makers.",
      },
    ],
  }),
  component: Home,
});

const trust = [
  { icon: ShieldCheck, title: "Verified vendors", copy: "Every studio vetted before listing." },
  { icon: Truck, title: "Worldwide shipping", copy: "Free over $150, tracked door to door." },
  { icon: Leaf, title: "Traceable sourcing", copy: "Batch, farm and maker on every label." },
  { icon: Globe, title: "Fair trade pricing", copy: "Makers set their own margins." },
];

function Home() {
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: productList } = useQuery(productListQuery({ limit: 8 }));
  const { data: newestList } = useQuery(productListQuery({ sort: "newest", limit: 4 }));
  const { data: vendors = [] } = useQuery(vendorsQuery());
  const featured = productList?.products ?? [];
  const newest = newestList?.products ?? [];
  const vendorGridCols =
    vendors.length >= 4
      ? "lg:grid-cols-4"
      : vendors.length === 3
        ? "lg:grid-cols-3"
        : "lg:grid-cols-2";

  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
          <div>
            <p className="eyebrow">Marketplace · Est. Kathmandu</p>
            <h1 className="display-xl mt-4">
              Extraordinary goods,
              <br />
              direct from the makers.
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              InfiniTrends brings independent growers, weavers and studios to a global audience —
              with the editorial care of a magazine and the intelligence of modern discovery.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground"
              >
                Shop the marketplace <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/nepal-origin" className="rule-link text-sm">
                Explore Nepal Origin
              </Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
              {[
                ["120+", "Independent vendors"],
                ["48", "Countries shipped"],
                ["4.8", "Average rating"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-3xl">{n}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <img
              src={hero}
              alt="Editorial still life of handmade goods from Himalayan makers"
              className="aspect-4/5 w-full rounded-sm object-cover"
            />
            <div className="absolute -bottom-6 left-6 hidden rounded-sm border border-border bg-background/95 px-5 py-4 shadow-xl backdrop-blur sm:block">
              <p className="eyebrow">This week's dispatch</p>
              <p className="mt-1 font-display text-lg">Ilam first flush, just harvested</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <Section eyebrow="Browse" title="Shop by category" href="/shop" linkLabel="All products">
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
          {categories.map((c, i) => (
            <Link
              key={c.id}
              to="/category/$handle"
              params={{ handle: c.handle }}
              className="group relative overflow-hidden rounded-sm bg-surface"
            >
              <img
                src={Object.values(images)[i % 9]}
                alt={c.name}
                loading="lazy"
                className="aspect-3/2 w-full object-cover transition-transform duration-700 ease-soft group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/70 to-transparent p-5">
                <p className="font-display text-xl text-ink-foreground">{c.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Featured products */}
      <Section
        eyebrow="Curated"
        title="Most loved this season"
        href="/shop"
        linkLabel="See everything"
      >
        <ProductGrid products={featured} />
      </Section>

      {/* Editorial collections */}
      <Section eyebrow="Editorial" title="Collections with a point of view">
        <div className="grid gap-6 lg:grid-cols-3">
          {collections.slice(0, 3).map((c) => (
            <Link
              key={c.id}
              to="/collection/$handle"
              params={{ handle: c.handle }}
              className="group"
            >
              <div className="overflow-hidden rounded-sm bg-surface">
                <img
                  src={c.image}
                  alt={c.title}
                  loading="lazy"
                  className="aspect-4/3 w-full object-cover transition-transform duration-700 ease-soft group-hover:scale-105"
                />
              </div>
              <p className="eyebrow mt-4">{c.subtitle}</p>
              <h3 className="mt-1 font-display text-2xl">{c.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* Nepal Origin feature */}
      <section className="mt-24 bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-20 lg:grid-cols-2 lg:px-10">
          <img
            src={images.nepal}
            alt="Terraced hillsides and makers at work in Nepal"
            loading="lazy"
            className="aspect-4/3 w-full rounded-sm object-cover"
          />
          <div>
            <p className="eyebrow text-ink-foreground/70">Nepal Origin</p>
            <h2 className="display-lg mt-3">Where the marketplace began</h2>
            <p className="mt-5 max-w-md text-sm text-ink-foreground/80">
              High-altitude tea gardens, cashmere ridges, and family kilns. Every Nepal Origin
              product carries the name of the person who made it and the valley it came from.
            </p>
            <Link
              to="/nepal-origin"
              className="mt-8 inline-flex items-center gap-2 rounded-sm bg-ink-foreground px-6 py-3.5 text-sm font-medium text-ink"
            >
              Discover Nepal Origin <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Vendors */}
      <Section eyebrow="The makers" title="Vendors on InfiniTrends" href="/vendors" linkLabel="All vendors">
        <div className={`grid gap-6 sm:grid-cols-2 ${vendorGridCols}`}>
          {vendors.slice(0, 4).map((v) => (
            <Link key={v.id} to="/vendor/$handle" params={{ handle: v.handle }} className="group">
              <div className="overflow-hidden rounded-sm bg-surface">
                <img
                  src={v.heroImage ?? images.nepal}
                  alt={v.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-700 ease-soft group-hover:scale-105"
                />
              </div>
              <h3 className="mt-4 font-display text-xl">{v.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.productCount} products</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* New arrivals */}
      <Section eyebrow="Just landed" title="New arrivals">
        <ProductGrid products={newest} />
      </Section>

      {/* Trust */}
      <section className="mx-auto mt-24 max-w-[1400px] px-5 lg:px-10">
        <div className="grid gap-8 border-y border-border py-12 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map((t) => (
            <div key={t.title}>
              <t.icon className="h-5 w-5 text-primary" aria-hidden />
              <p className="mt-3 text-sm font-medium">{t.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  href,
  linkLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  href?: "/shop" | "/vendors";
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-24 max-w-[1400px] px-5 lg:px-10">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="display-lg mt-2">{title}</h2>
        </div>
        {href && linkLabel && (
          <Link to={href} className="rule-link hidden text-sm sm:block">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
