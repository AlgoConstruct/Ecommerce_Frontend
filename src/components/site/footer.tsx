import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { categoriesQuery } from "@/lib/commerce/queries";
import { collections } from "@/lib/commerce/data";

export function Footer() {
  const { data: categories = [] } = useQuery(categoriesQuery());
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <p className="font-display text-2xl">InfiniTrends</p>
            <p className="mt-3 text-sm text-muted-foreground">
              A curated global marketplace for makers, growers and studios. Made in Nepal, shipped
              worldwide.
            </p>
            <form className="mt-6" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="newsletter" className="eyebrow">
                Dispatches from the makers
              </label>
              <div className="mt-2 flex border-b border-border">
                <input
                  id="newsletter"
                  type="email"
                  placeholder="you@email.com"
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
                <button className="text-sm font-medium">Join</button>
              </div>
            </form>
          </div>

          <FooterCol title="Shop">
            {categories.map((c) => (
              <Link key={c.id} to="/category/$handle" params={{ handle: c.handle }}>
                {c.name}
              </Link>
            ))}
          </FooterCol>

          <FooterCol title="Collections">
            {collections.map((c) => (
              <Link key={c.id} to="/collection/$handle" params={{ handle: c.handle }}>
                {c.title}
              </Link>
            ))}
          </FooterCol>

          <FooterCol title="Marketplace">
            <Link to="/vendors">All vendors</Link>
            <Link to="/nepal-origin">Nepal Origin</Link>
            <Link to="/account">Your account</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/cart">Cart</Link>
          </FooterCol>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} InfiniTrends. All rights reserved.</p>
          <p>Kathmandu · Singapore · Berlin</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="eyebrow">{title}</p>
      <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground [&>a:hover]:text-foreground">
        {children}
      </div>
    </nav>
  );
}
