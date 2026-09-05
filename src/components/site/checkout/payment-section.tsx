import type { PaymentProvider } from "@/lib/commerce/checkout-client";

/**
 * Only pp_system_default is enabled, so nothing is charged. The copy says so
 * plainly — a checkout that lets someone believe they paid is worse than one
 * that admits it is a demo. No card, bank, or credential field belongs here.
 */
function describe(providerId: string): { label: string; detail: string } {
  if (providerId === "pp_system_default") {
    return {
      label: "Test payment",
      detail:
        "No card required. Nothing is charged — orders are placed unpaid while payment is being connected.",
    };
  }
  return { label: providerId, detail: "" };
}

interface Props {
  providers: PaymentProvider[];
  selectedProviderId: string | null;
  disabled: boolean;
  onSelect: (providerId: string) => void;
}

export function PaymentSection({ providers, selectedProviderId, disabled, onSelect }: Props) {
  if (!providers.length) {
    return (
      <p className="text-sm text-destructive">
        No payment method is available right now, so orders can't be placed. Nothing in your bag has
        been charged.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {providers.map((p) => {
        const { label, detail } = describe(p.id);
        return (
          <label
            key={p.id}
            className="flex cursor-pointer gap-3 rounded-sm border border-border px-4 py-3 text-sm"
          >
            <input
              type="radio"
              name="payment-provider"
              value={p.id}
              disabled={disabled}
              checked={selectedProviderId === p.id}
              onChange={() => onSelect(p.id)}
              className="mt-0.5"
              data-testid={`payment-provider-${p.id}`}
            />
            <span>
              <span className="block font-medium">{label}</span>
              {detail && <span className="mt-1 block text-muted-foreground">{detail}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
