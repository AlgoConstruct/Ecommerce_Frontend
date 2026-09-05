import { sdk } from "./sdk";
import { createTtlCache } from "./ttl-cache";

export interface MedusaRegion {
  id: string;
  name: string;
  currency_code: string;
}

const regionsCache = createTtlCache<MedusaRegion[]>();

export async function listRegions(): Promise<MedusaRegion[]> {
  const cached = regionsCache.get();
  if (cached) return cached;
  const { regions } = await sdk.client.fetch<{ regions: MedusaRegion[] }>("/store/regions", {
    method: "GET",
  });
  return regionsCache.set(regions);
}

export async function getDefaultRegion(): Promise<MedusaRegion> {
  const regions = await listRegions();
  const region = regions.find((r) => r.currency_code === "usd") ?? regions[0];
  if (!region) {
    throw new Error("No Medusa region configured — run setup-storefront.ts on the backend first.");
  }
  return region;
}
