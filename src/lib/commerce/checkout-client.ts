import { sdk } from "../medusa/sdk";
import { getDefaultRegion } from "../medusa/regions";
import type { CurrencyCode, MedusaCartLine, Money } from "./types";

export interface CheckoutAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
  phone: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  amount: Money;
}

export interface PaymentProvider {
  id: string;
}

export interface CartTotals {
  subtotal: Money;
  shipping: Money;
  tax: Money;
  total: Money;
}

export interface OrderSummary {
  id: string;
  displayId: number | null;
  currency: CurrencyCode;
  lines: MedusaCartLine[];
  totals: CartTotals;
  email: string | null;
  shippingAddress: CheckoutAddress | null;
  vendorName: string | null;
}

export type CompleteResult = { ok: true; orderId: string } | { ok: false; message: string };

// Amounts from Medusa are already decimal. Never scale them.
const money = (amount: number | null | undefined, currency: CurrencyCode): Money => ({
  amount: amount ?? 0,
  currency,
});

export function mapShippingOption(
  raw: { id: string; name: string; calculated_price?: { calculated_amount?: number } | null },
  currency: CurrencyCode,
): ShippingOption {
  return {
    id: raw.id,
    name: raw.name,
    amount: money(raw.calculated_price?.calculated_amount, currency),
  };
}

export function mapTotals(
  raw: { subtotal?: number; shipping_total?: number; tax_total?: number; total?: number },
  currency: CurrencyCode,
): CartTotals {
  return {
    subtotal: money(raw.subtotal, currency),
    shipping: money(raw.shipping_total, currency),
    tax: money(raw.tax_total, currency),
    total: money(raw.total, currency),
  };
}

/**
 * Cart completion answers HTTP 200 whether it succeeded or not — the
 * discriminator is the `type` field. Treating a 200 as success would report
 * phantom orders to the shopper and clear a bag that was never ordered.
 */
export function interpretCompletion(raw: {
  type?: string;
  order?: { id?: string } | null;
  cart?: { id?: string } | null;
  error?: { message?: string } | null;
}): CompleteResult {
  if (raw?.type === "order" && raw.order?.id) {
    return { ok: true, orderId: raw.order.id };
  }
  return {
    ok: false,
    message: raw?.error?.message ?? "This maker's order couldn't be placed. Nothing was charged.",
  };
}

interface MedusaAddressRaw {
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone?: string | null;
}

function mapAddress(raw: MedusaAddressRaw | null): CheckoutAddress | null {
  if (!raw) return null;
  return {
    firstName: raw.first_name ?? "",
    lastName: raw.last_name ?? "",
    address1: raw.address_1 ?? "",
    address2: raw.address_2 ?? "",
    city: raw.city ?? "",
    province: raw.province ?? "",
    postalCode: raw.postal_code ?? "",
    countryCode: raw.country_code ?? "",
    phone: raw.phone ?? "",
  };
}

function toMedusaAddress(address: CheckoutAddress) {
  return {
    first_name: address.firstName,
    last_name: address.lastName,
    address_1: address.address1,
    address_2: address.address2,
    city: address.city,
    province: address.province,
    postal_code: address.postalCode,
    country_code: address.countryCode,
    phone: address.phone,
  };
}

interface MedusaOrderLineRaw {
  id: string;
  product_id: string | null;
  product_title: string | null;
  title: string | null;
  product_handle: string | null;
  variant_id: string | null;
  variant_title: string | null;
  thumbnail: string | null;
  quantity: number;
  unit_price: number;
}

interface MedusaOrderRaw {
  id: string;
  display_id: number | null;
  currency_code: string;
  items: MedusaOrderLineRaw[] | null;
  subtotal?: number;
  shipping_total?: number;
  tax_total?: number;
  total?: number;
  email: string | null;
  shipping_address: MedusaAddressRaw | null;
}

export const checkoutClient = {
  async listShippingOptions(cartId: string): Promise<ShippingOption[]> {
    const region = await getDefaultRegion();
    const { shipping_options } = await sdk.client.fetch<{
      shipping_options: Parameters<typeof mapShippingOption>[0][];
    }>(`/store/shipping-options?cart_id=${cartId}`, { method: "GET" });
    return (shipping_options ?? []).map((o) =>
      mapShippingOption(o, region.currency_code as CurrencyCode),
    );
  },

  async listPaymentProviders(): Promise<PaymentProvider[]> {
    const region = await getDefaultRegion();
    const { payment_providers } = await sdk.client.fetch<{
      payment_providers: { id: string }[];
    }>(`/store/payment-providers?region_id=${region.id}`, { method: "GET" });
    return payment_providers ?? [];
  },

  async updateCartDetails(cartId: string, email: string, address: CheckoutAddress) {
    const medusaAddress = toMedusaAddress(address);
    await sdk.client.fetch(`/store/carts/${cartId}`, {
      method: "POST",
      body: {
        email,
        shipping_address: medusaAddress,
        // No separate billing step exists, and nothing is charged. Sending the
        // shipping address as billing keeps the order record internally
        // consistent instead of leaving it blank.
        billing_address: medusaAddress,
      },
    });
  },

  async addShippingMethod(cartId: string, optionId: string): Promise<CartTotals> {
    const region = await getDefaultRegion();
    const { cart } = await sdk.client.fetch<{ cart: Parameters<typeof mapTotals>[0] }>(
      `/store/carts/${cartId}/shipping-methods`,
      { method: "POST", body: { option_id: optionId } },
    );
    return mapTotals(cart, region.currency_code as CurrencyCode);
  },

  async createPaymentCollection(cartId: string): Promise<string> {
    const { payment_collection } = await sdk.client.fetch<{
      payment_collection: { id: string };
    }>("/store/payment-collections", { method: "POST", body: { cart_id: cartId } });
    return payment_collection.id;
  },

  async initPaymentSession(collectionId: string, providerId: string) {
    await sdk.client.fetch(`/store/payment-collections/${collectionId}/payment-sessions`, {
      method: "POST",
      body: { provider_id: providerId },
    });
  },

  async completeCart(cartId: string): Promise<CompleteResult> {
    const raw = await sdk.client.fetch<Parameters<typeof interpretCompletion>[0]>(
      `/store/carts/${cartId}/complete`,
      { method: "POST" },
    );
    return interpretCompletion(raw);
  },

  async getOrder(orderId: string): Promise<OrderSummary> {
    const { order } = await sdk.client.fetch<{ order: MedusaOrderRaw }>(
      `/store/orders/${orderId}`,
      { method: "GET" },
    );
    const currency = order.currency_code as CurrencyCode;
    const lines: MedusaCartLine[] = (order.items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id ?? "",
      productTitle: item.product_title ?? item.title ?? "",
      productHandle: item.product_handle ?? "",
      variantId: item.variant_id ?? "",
      variantTitle: item.variant_title ?? undefined,
      thumbnail: item.thumbnail ?? undefined,
      quantity: item.quantity,
      unitPrice: money(item.unit_price, currency),
      lineTotal: money(item.unit_price * item.quantity, currency),
    }));

    // Resolve the vendor from the order's own products rather than carrying it
    // over from placement state, so the confirmation page survives a refresh.
    let vendorName: string | null = null;
    const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
    if (productIds.length) {
      try {
        const params = productIds.map((id) => `id=${id}`).join("&");
        const { products } = await sdk.client.fetch<{
          products: { store?: { name?: string } | null }[];
        }>(`/store/products?${params}&fields=id,store.name`, { method: "GET" });
        vendorName = products?.[0]?.store?.name ?? null;
      } catch {
        // A missing vendor name degrades the page; it must not break it.
        vendorName = null;
      }
    }

    return {
      id: order.id,
      displayId: order.display_id ?? null,
      currency,
      lines,
      totals: mapTotals(order, currency),
      email: order.email ?? null,
      shippingAddress: mapAddress(order.shipping_address ?? null),
      vendorName,
    };
  },
};
