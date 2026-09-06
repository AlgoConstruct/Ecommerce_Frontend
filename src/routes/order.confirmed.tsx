import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { queryOptions, useQueries } from "@tanstack/react-query";
import { checkoutClient } from "@/lib/commerce/checkout-client";
import type { PlacementOutcome } from "@/lib/commerce/place-order";
import { PageHeader } from "@/components/site/catalog";
import { formatMoney } from "@/lib/commerce/format";

const orderQuery = (id: string) =>
  queryOptions({ queryKey: ["order", id], queryFn: () => checkoutClient.getOrder(id) });

function parseIds(raw: unknown): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const Route = createFileRoute("/order/confirmed")({
  validateSearch: (search: Record<string, unknown>) => ({ ids: String(search["ids"] ?? "") }),
  loaderDeps: ({ search }) => ({ ids: search.ids }),
  // Prefetched in the loader, not left to a bare useQuery, so the order
  // numbers render server-side and survive a refresh instead of living only
  // in the memory of the tab that placed them.
  // `allSettled`, not `all`: an order that can't be read must not throw the
  // route into its error boundary. The order was still placed, so the page
  // degrades to showing its id rather than telling the shopper the page broke.
  loader: async ({ context, deps }) => {
    await Promise.allSettled(
      parseIds(deps.ids).map((id) => context.queryClient.ensureQueryData(orderQuery(id))),
    );
  },
  head: () => ({
    meta: [
      { title: "Order confirmed — InfiniTrends" },
      { name: "description", content: "Your InfiniTrends order has been placed." },
    ],
  }),
  component: OrderConfirmedPage,
});

function OrderConfirmedPage() {
  const { ids } = Route.useSearch();
  const orderIds = parseIds(ids);
  const results = useQueries({ queries: orderIds.map((id) => orderQuery(id)) });

  // Failures ride in router state, never in the URL — no customer detail goes
  // into a query parameter. They are NOT lost on refresh: TanStack Router
  // backs `location.state` with `window.history.state`, and a browser keeps a
  // session-history entry's state across a reload. Verified in real Chrome via
  // Playwright — after F5 on this page, `history.state.failures` is still
  // there and this block renders again. What the state genuinely does not
  // survive is a fresh arrival at the same URL (a new tab, a shared link,
  // history cleared), and that costs the shopper nothing: the failed items are
  // still in the bag, which is the durable record of what was not ordered.
  //
  // Validated rather than cast, because the value is whatever the last
  // `history.pushState` wrote — including a hand-crafted one. A non-array
  // truthy `failures` would sail past a `?? []` guard, reach `.length`, and
  // then throw on `.map`.
  const routerState = useRouterState({ select: (s) => s.location.state }) as {
    failures?: unknown;
  };
  const failures: PlacementOutcome[] = Array.isArray(routerState?.failures)
    ? (routerState.failures as PlacementOutcome[])
    : [];

  if (!orderIds.length) {
    return (
      <div>
        <PageHeader eyebrow="Order" title="No order to show" />
        <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
          <p className="text-sm text-muted-foreground">
            This page needs an order to display. If you've just checked out, use the link from your
            confirmation.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Order confirmed"
        title={orderIds.length > 1 ? "Your orders are placed" : "Your order is placed"}
      />
      <div className="mx-auto max-w-[1400px] space-y-8 px-5 pb-24 lg:px-10">
        <p className="text-sm text-muted-foreground">
          Nothing was charged — payment isn't connected yet, so these orders are placed unpaid.
        </p>

        {results.map((result, i) => {
          const id = orderIds[i] ?? "";
          if (result.isPending) {
            return (
              <p key={id} className="text-sm text-muted-foreground">
                Loading order…
              </p>
            );
          }
          if (result.isError || !result.data) {
            return (
              <div key={id} className="rounded-sm border border-border p-6">
                <p className="text-sm">
                  Your order was placed, but we couldn't load its details right now. Your order
                  number is <span className="font-medium">{id}</span>.
                </p>
              </div>
            );
          }
          const order = result.data;
          return (
            <div
              key={id}
              className="rounded-sm border border-border p-6"
              data-testid={`order-${order.id}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow">{order.vendorName ?? "Order"}</p>
                <p className="text-sm text-muted-foreground" data-testid="order-number">
                  Order {order.displayId !== null ? `#${order.displayId}` : order.id}
                </p>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                {order.lines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-4">
                    <span>
                      {line.productTitle}
                      {line.variantTitle ? ` — ${line.variantTitle}` : ""} × {line.quantity}
                    </span>
                    <span>{formatMoney(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(order.totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatMoney(order.totals.shipping)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatMoney(order.totals.tax)}</span>
                </div>
                <div className="flex justify-between pt-1 font-medium">
                  <span>Total</span>
                  <span>{formatMoney(order.totals.total)}</span>
                </div>
              </div>

              {order.shippingAddress && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Shipping to {order.shippingAddress.firstName} {order.shippingAddress.lastName},{" "}
                  {order.shippingAddress.address1}, {order.shippingAddress.city}{" "}
                  {order.shippingAddress.postalCode}
                </p>
              )}
            </div>
          );
        })}

        {failures.length > 0 && (
          <div className="rounded-sm border border-destructive p-6" data-testid="confirm-failures">
            <p className="text-sm font-medium text-destructive">
              Some makers couldn't be ordered from
            </p>
            <ul className="mt-2 space-y-1">
              {failures.map((f) => (
                <li key={f.vendorId} className="text-sm text-destructive">
                  {f.vendorName}: {f.message}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Their items are still in your bag — nothing was charged for them.
            </p>
            <Link
              to="/cart"
              className="mt-4 inline-flex rounded-sm border border-border px-6 py-3.5 text-sm font-medium"
            >
              Back to bag
            </Link>
          </div>
        )}

        <Link
          to="/shop"
          className="inline-flex rounded-sm bg-ink px-6 py-3.5 text-sm font-medium text-ink-foreground"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
