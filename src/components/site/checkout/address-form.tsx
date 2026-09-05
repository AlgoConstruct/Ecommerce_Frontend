import * as React from "react";
import type { CheckoutAddress } from "@/lib/commerce/checkout-client";

export const EMPTY_ADDRESS: CheckoutAddress = {
  firstName: "",
  lastName: "",
  address1: "",
  address2: "",
  city: "",
  province: "",
  postalCode: "",
  countryCode: "",
  phone: "",
};

/** Fields the shopper must fill. address2 and phone are genuinely optional. */
const REQUIRED = [
  "firstName",
  "lastName",
  "address1",
  "city",
  "province",
  "postalCode",
  "countryCode",
] as const satisfies readonly (keyof CheckoutAddress)[];

type RequiredField = (typeof REQUIRED)[number];

export function addressErrors(email: string, address: CheckoutAddress): string[] {
  const missing: string[] = [];
  if (!/^\S+@\S+\.\S+$/.test(email)) missing.push("a valid email address");
  // Keyed by the required fields themselves rather than a string index
  // signature, so every field is guaranteed a label at compile time.
  const labels: Record<RequiredField, string> = {
    firstName: "first name",
    lastName: "last name",
    address1: "street address",
    city: "city",
    province: "state or province",
    postalCode: "postal code",
    countryCode: "country",
  };
  for (const field of REQUIRED) {
    if (!address[field].trim()) missing.push(labels[field]);
  }
  return missing;
}

interface Props {
  email: string;
  address: CheckoutAddress;
  countries: { code: string; name: string }[];
  disabled: boolean;
  onEmailChange: (v: string) => void;
  onAddressChange: (v: CheckoutAddress) => void;
}

const field =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm " +
  "focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-60";

export function AddressForm({
  email,
  address,
  countries,
  disabled,
  onEmailChange,
  onAddressChange,
}: Props) {
  const set =
    (key: keyof CheckoutAddress) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onAddressChange({ ...address, [key]: e.target.value });

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted-foreground">Email</span>
        <input
          type="email"
          name="email"
          value={email}
          disabled={disabled}
          className={field}
          onChange={(e) => onEmailChange(e.target.value)}
          data-testid="checkout-email"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted-foreground">First name</span>
          <input
            name="firstName"
            value={address.firstName}
            disabled={disabled}
            className={field}
            onChange={set("firstName")}
            data-testid="checkout-firstName"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted-foreground">Last name</span>
          <input
            name="lastName"
            value={address.lastName}
            disabled={disabled}
            className={field}
            onChange={set("lastName")}
            data-testid="checkout-lastName"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-muted-foreground">Street address</span>
        <input
          name="address1"
          value={address.address1}
          disabled={disabled}
          className={field}
          onChange={set("address1")}
          data-testid="checkout-address1"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm text-muted-foreground">
          Apartment, suite (optional)
        </span>
        <input
          name="address2"
          value={address.address2}
          disabled={disabled}
          className={field}
          onChange={set("address2")}
          data-testid="checkout-address2"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted-foreground">City</span>
          <input
            name="city"
            value={address.city}
            disabled={disabled}
            className={field}
            onChange={set("city")}
            data-testid="checkout-city"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted-foreground">State / province</span>
          <input
            name="province"
            value={address.province}
            disabled={disabled}
            className={field}
            onChange={set("province")}
            data-testid="checkout-province"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted-foreground">Postal code</span>
          <input
            name="postalCode"
            value={address.postalCode}
            disabled={disabled}
            className={field}
            onChange={set("postalCode")}
            data-testid="checkout-postalCode"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted-foreground">Country</span>
          <select
            name="countryCode"
            value={address.countryCode}
            disabled={disabled}
            className={field}
            onChange={set("countryCode")}
            data-testid="checkout-countryCode"
          >
            <option value="">Select a country</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted-foreground">Phone (optional)</span>
          <input
            name="phone"
            value={address.phone}
            disabled={disabled}
            className={field}
            onChange={set("phone")}
            data-testid="checkout-phone"
          />
        </label>
      </div>
    </div>
  );
}
