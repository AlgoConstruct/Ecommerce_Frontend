import type { Money } from "./types";

export function formatMoney(money: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency.toUpperCase(),
    maximumFractionDigits: money.amount % 100 === 0 ? 0 : 2,
  }).format(money.amount / 100);
}

export function formatDate(iso: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}
