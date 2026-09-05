import type { CartTotals } from "@/lib/commerce/checkout-client";
import type { Money } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/commerce/format";

/**
 * Sums the carts' own totals. There is deliberately no shipping or tax
 * arithmetic here: once a shipping method is set, Medusa's totals are
 * authoritative and any local formula would eventually disagree with what the
 * order is actually placed for.
 */
export function sumTotals(totals: CartTotals[], fallbackCurrency: Money["currency"]): CartTotals {
  const currency = totals[0]?.subtotal.currency ?? fallbackCurrency;
  const add = (pick: (t: CartTotals) => Money): Money => ({
    amount: totals.reduce((sum, t) => sum + pick(t).amount, 0),
    currency,
  });
  return {
    subtotal: add((t) => t.subtotal),
    shipping: add((t) => t.shipping),
    tax: add((t) => t.tax),
    total: add((t) => t.total),
  };
}

interface Props {
  itemCount: number;
  totals: CartTotals;
  /**
   * True only once every cart in the bag has had a shipping method set and has
   * returned its own totals. Until then the only figure that is server-truth
   * is the subtotal, so shipping, tax and total all say so rather than
   * printing zeros that wouldn't add up to the total beside them.
   */
  shippingKnown: boolean;
}

const PENDING = "Once shipping is set";

export function CheckoutSummary({ itemCount, totals, shippingKnown }: Props) {
  return (
    <div className="h-fit rounded-sm border border-border p-6">
      <p className="eyebrow">Order summary ({itemCount} items)</p>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span data-testid="summary-subtotal">{formatMoney(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span data-testid="summary-shipping">
            {shippingKnown ? formatMoney(totals.shipping) : "Choose a method"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax</span>
          <span data-testid="summary-tax">{shippingKnown ? formatMoney(totals.tax) : PENDING}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
          <span>Total</span>
          <span data-testid="summary-total">
            {shippingKnown ? formatMoney(totals.total) : PENDING}
          </span>
        </div>
      </div>
    </div>
  );
}
