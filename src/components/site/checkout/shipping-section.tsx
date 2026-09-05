import type { ShippingOption } from "@/lib/commerce/checkout-client";
import { formatMoney } from "@/lib/commerce/format";

export interface VendorShipping {
  vendorId: string;
  vendorName: string;
  options: ShippingOption[];
  selectedOptionId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface Props {
  vendors: VendorShipping[];
  disabled: boolean;
  onSelect: (vendorId: string, optionId: string) => void;
}

export function ShippingSection({ vendors, disabled, onSelect }: Props) {
  return (
    <div className="space-y-6">
      {vendors.map((v) => (
        <div key={v.vendorId} data-testid={`shipping-group-${v.vendorId}`}>
          <p className="eyebrow">{v.vendorName}</p>

          {v.isLoading && (
            <p className="mt-2 text-sm text-muted-foreground">Loading shipping options…</p>
          )}

          {!v.isLoading && v.error && <p className="mt-2 text-sm text-destructive">{v.error}</p>}

          {/* An empty list is a real state, not a loading artefact: it means
              this maker has no shipping set up for their stock location. Say
              so, rather than rendering an empty radio group the shopper will
              stare at. */}
          {!v.isLoading && !v.error && v.options.length === 0 && (
            <p
              className="mt-2 text-sm text-destructive"
              data-testid={`shipping-none-${v.vendorId}`}
            >
              {v.vendorName} hasn't set up shipping yet, so we can't place their part of this order.
              Remove their items to check out with the rest.
            </p>
          )}

          <div className="mt-2 space-y-2">
            {v.options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center justify-between rounded-sm border border-border px-4 py-3 text-sm"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`shipping-${v.vendorId}`}
                    value={o.id}
                    disabled={disabled}
                    checked={v.selectedOptionId === o.id}
                    onChange={() => onSelect(v.vendorId, o.id)}
                    data-testid={`shipping-option-${o.id}`}
                  />
                  {o.name}
                </span>
                <span>{formatMoney(o.amount)}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
