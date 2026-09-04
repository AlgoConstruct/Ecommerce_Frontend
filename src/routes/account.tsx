import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { customerQuery, ordersQuery } from "@/lib/commerce/queries";
import { formatDate, formatMoney } from "@/lib/commerce/format";
import { PageHeader } from "@/components/site/catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customerQuery()),
      context.queryClient.ensureQueryData(ordersQuery()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Your account — InfiniTrends" },
      {
        name: "description",
        content: "Profile details and order history for your InfiniTrends account.",
      },
      { property: "og:title", content: "Your account — InfiniTrends" },
      {
        property: "og:description",
        content: "Profile details and order history for your InfiniTrends account.",
      },
    ],
  }),
  component: AccountPage,
});

const statusStyle: Record<string, string> = {
  processing: "bg-surface text-muted-foreground",
  shipped: "bg-primary/10 text-primary",
  delivered: "bg-ink text-ink-foreground",
};

function AccountPage() {
  const { data: customer } = useQuery(customerQuery());
  const { data: orders = [] } = useQuery(ordersQuery());

  return (
    <div>
      <PageHeader eyebrow="Your account" title="Account" />
      <div className="mx-auto max-w-[1400px] px-5 pb-24 lg:px-10">
        <div className="rounded-sm border border-border bg-surface p-4 text-sm text-muted-foreground">
          This page shows placeholder data. Real customer accounts and authentication aren't wired
          up yet — what you see below is a mock profile and mock order history, not your actual
          account.
        </div>

        {customer && (
          <div className="mt-10">
            <p className="eyebrow">Profile</p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="mt-1 text-sm">
                  {customer.firstName} {customer.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="mt-1 text-sm">{customer.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="mt-1 text-sm">{formatDate(customer.memberSince)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interests</p>
                <p className="mt-1 text-sm">{customer.interests.join(", ")}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-14">
          <p className="eyebrow">Order history</p>
          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-6 py-6">
                  <div className="flex -space-x-4">
                    {o.items.map((item, i) => (
                      <img
                        key={i}
                        src={item.image}
                        alt={item.title}
                        className="h-16 w-14 rounded-sm border-2 border-background object-cover"
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium">{o.displayId}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.date)}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium capitalize",
                      statusStyle[o.status],
                    )}
                  >
                    {o.status}
                  </span>
                  <p className="text-sm font-medium">{formatMoney(o.total)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
