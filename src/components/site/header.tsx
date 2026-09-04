import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { categoriesQuery, vendorsQuery } from "@/lib/commerce/queries";
import { collections } from "@/lib/commerce/data";
import { useCart } from "@/lib/commerce/cart";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Shop all", to: "/shop" as const },
  { label: "Vendors", to: "/vendors" as const },
  { label: "Nepal Origin", to: "/nepal-origin" as const },
];

export function Header() {
  const { itemCount, wishlist, setOpen } = useCart();
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: vendors = [] } = useQuery(vendorsQuery());
  const [menu, setMenu] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [q, setQ] = React.useState("");
  const navigate = useNavigate();
  const count = itemCount;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSearching(false);
    navigate({ to: "/shop", search: { q: q || undefined } });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <p className="bg-ink py-2 text-center text-[11px] uppercase tracking-[0.18em] text-ink-foreground">
        Free worldwide shipping over $150 · Direct from makers
      </p>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-5 lg:px-10">
        <button
          type="button"
          className="lg:hidden"
          aria-label="Open menu"
          onClick={() => setMenu(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/" className="font-display text-xl tracking-tight lg:text-2xl">
          InfiniTrends
        </Link>

        <nav aria-label="Primary" className="ml-8 hidden items-center gap-7 lg:flex">
          <div className="group relative">
            <button className="text-sm" aria-haspopup="true">
              Categories
            </button>
            <div className="invisible absolute left-1/2 top-full w-[860px] -translate-x-1/2 pt-4 opacity-0 transition-opacity duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="grid grid-cols-3 gap-8 rounded-sm border border-border bg-popover p-8 shadow-xl">
                {categories.map((c) => (
                  <div key={c.id}>
                    <Link
                      to="/category/$handle"
                      params={{ handle: c.handle }}
                      className="text-sm font-medium"
                    >
                      {c.name}
                    </Link>
                    <ul className="mt-2 space-y-1.5">
                      {c.children?.map((child) => (
                        <li key={child.name}>
                          <Link
                            to="/category/$handle"
                            params={{ handle: child.handle }}
                            className="text-sm text-muted-foreground hover:text-foreground"
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="group relative">
            <button className="text-sm">Collections</button>
            <div className="invisible absolute left-1/2 top-full w-64 -translate-x-1/2 pt-4 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <ul className="space-y-2 rounded-sm border border-border bg-popover p-6 shadow-xl">
                {collections.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/collection/$handle"
                      params={{ handle: c.handle }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="text-sm">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <button aria-label="Search" onClick={() => setSearching((s) => !s)}>
            <Search className="h-5 w-5" />
          </button>
          <Link to="/wishlist" aria-label="Wishlist" className="relative hidden sm:block">
            <Heart className="h-5 w-5" />
            {wishlist.length > 0 && <Dot />}
          </Link>
          <Link to="/account" aria-label="Account" className="hidden sm:block">
            <User className="h-5 w-5" />
          </Link>
          <button aria-label={`Cart, ${count} items`} onClick={() => setOpen(true)} className="relative">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {searching && (
        <div className="border-t border-border bg-background">
          <form onSubmit={submit} className="mx-auto max-w-[1400px] px-5 py-6 lg:px-10">
            <label htmlFor="site-search" className="eyebrow">
              Search the marketplace
            </label>
            <input
              id="site-search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try “something calming for evenings”"
              className="mt-2 w-full border-b border-border bg-transparent pb-3 font-display text-2xl outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {["first flush tea", "wild honey", "cashmere", "stoneware", "seabuckthorn"].map(
                (term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQ(term)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {term}
                  </button>
                ),
              )}
            </div>
          </form>
        </div>
      )}

      {menu && (
        <div className="fixed inset-0 z-50 bg-background lg:hidden">
          <div className="flex h-16 items-center justify-between px-5">
            <span className="font-display text-xl">InfiniTrends</span>
            <button aria-label="Close menu" onClick={() => setMenu(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="space-y-6 overflow-y-auto px-5 pb-16 pt-4" aria-label="Mobile">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMenu(false)}
                className="block font-display text-3xl"
              >
                {n.label}
              </Link>
            ))}
            <div>
              <p className="eyebrow">Categories</p>
              <ul className="mt-3 space-y-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/category/$handle"
                      params={{ handle: c.handle }}
                      onClick={() => setMenu(false)}
                      className="text-base text-muted-foreground"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow">Vendors</p>
              <ul className="mt-3 space-y-2">
                {vendors.slice(0, 4).map((v) => (
                  <li key={v.id}>
                    <Link
                      to="/vendor/$handle"
                      params={{ handle: v.handle }}
                      onClick={() => setMenu(false)}
                      className="text-base text-muted-foreground"
                    >
                      {v.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function Dot() {
  return (
    <span className={cn("absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary")} aria-hidden />
  );
}
