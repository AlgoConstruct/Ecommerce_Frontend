import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ProductGrid } from "@/components/site/product-card";
import { images } from "@/lib/commerce/data";
import { productListQuery, vendorsQuery } from "@/lib/commerce/queries";

export const Route = createFileRoute("/nepal-origin")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(productListQuery({ limit: 100 })),
      context.queryClient.ensureQueryData(vendorsQuery()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Nepal Origin — Traceable goods from Himalayan makers" },
      {
        name: "description",
        content:
          "High-altitude tea, cashmere, wild honey and hand-thrown ceramics — traced to the valley, workshop and maker behind each piece.",
      },
      { property: "og:title", content: "Nepal Origin — InfiniTrends" },
      {
        property: "og:description",
        content: "Traceable, fairly priced goods from Himalayan growers and studios.",
      },
    ],
  }),
  component: NepalOrigin,
});

const chapters = [
  {
    eyebrow: "Chapter 01",
    title: "The gardens of Ilam",
    body: "At 1,800 metres the mist arrives before dawn and leaves the leaf slow-growing and sweet. First flush is picked over eleven days and rolled the same afternoon.",
    image: images.tea,
  },
  {
    eyebrow: "Chapter 02",
    title: "Ridge cashmere",
    body: "Combed by hand each spring from herds grazing above the treeline, then spun in small batches in the Kathmandu valley by weavers working four-shaft looms.",
    image: images.pashmina,
  },
  {
    eyebrow: "Chapter 03",
    title: "Clay and kiln",
    body: "Family studios in Bhaktapur have thrown the same river clay for nine generations. The glazes are ash, iron and time.",
    image: images.ceramic,
  },
];

function NepalOrigin() {
  const { data } = useQuery(productListQuery({ limit: 100 }));
  // Every seeded product is genuinely Nepal-origin, but filter on the flag
  // rather than assuming it so this stays correct if that ever changes.
  const list = (data?.products ?? []).filter((p) => p.nepalOrigin).slice(0, 8);
  const { data: vendorList = [] } = useQuery(vendorsQuery());
  const makers = vendorList.slice(0, 3);

  return (
    <div>
      <section className="relative">
        <img
          src={images.nepal}
          alt="Terraced hillsides in the Himalayan foothills"
          className="h-[70vh] w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-ink/80 via-ink/25 to-ink/10" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-[1400px] px-5 pb-16 text-ink-foreground lg:px-10">
            <p className="eyebrow text-ink-foreground/75">Nepal Origin</p>
            <h1 className="display-xl mt-4 max-w-4xl">
              Made where the mountains start.
            </h1>
            <p className="mt-5 max-w-xl text-sm text-ink-foreground/85">
              A dedicated programme inside InfiniTrends: goods traced to the valley, the workshop
              and the person who made them — priced so the maker keeps the margin.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 py-20 lg:px-10">
        <div className="grid gap-10 border-y border-border py-12 sm:grid-cols-3">
          {[
            ["1,800 m", "Average growing altitude"],
            ["100%", "Named-maker traceability"],
            ["3–5×", "Above local market rate paid"],
          ].map(([n, l]) => (
            <div key={l}>
              <p className="display-lg">{n}</p>
              <p className="mt-2 text-sm text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {chapters.map((c, i) => (
        <section key={c.title} className="mx-auto max-w-[1400px] px-5 py-10 lg:px-10">
          <div
            className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
              i % 2 === 1 ? "lg:[&>figure]:order-2" : ""
            }`}
          >
            <figure className="overflow-hidden rounded-sm bg-surface">
              <img src={c.image} alt={c.title} loading="lazy" className="aspect-4/3 w-full object-cover" />
            </figure>
            <div>
              <p className="eyebrow">{c.eyebrow}</p>
              <h2 className="display-lg mt-3">{c.title}</h2>
              <p className="mt-5 max-w-md text-sm text-muted-foreground">{c.body}</p>
            </div>
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-[1400px] px-5 py-20 lg:px-10">
        <p className="eyebrow">The makers behind it</p>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {makers.map((v) => (
            <Link key={v.id} to="/vendor/$handle" params={{ handle: v.handle }} className="group">
              <img
                src={v.heroImage}
                alt={v.name}
                loading="lazy"
                className="aspect-square w-full rounded-sm object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.03]"
              />
              <h3 className="mt-4 font-display text-xl">{v.name}</h3>
              <p className="text-sm text-muted-foreground">{v.productCount} products</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="display-lg">Shop Nepal Origin</h2>
          <Link to="/shop" className="rule-link hidden text-sm sm:inline-flex">
            All products
          </Link>
        </div>
        <ProductGrid products={list} />
        <div className="mt-12 text-center">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground"
          >
            Browse the full marketplace <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
