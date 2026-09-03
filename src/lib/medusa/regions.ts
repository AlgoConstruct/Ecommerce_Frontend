import { sdk } from "./sdk";

export interface MedusaRegion {
  id: string;
  name: string;
  currency_code: string;
}

let regionsCache: MedusaRegion[] | null = null;

export async function listRegions(): Promise<MedusaRegion[]> {
  if (regionsCache) return regionsCache;
  const { regions } = await sdk.client.fetch<{ regions: MedusaRegion[] }>("/store/regions", {
    method: "GET",
  });
  regionsCache = regions;
  return regions;
}

export async function getDefaultRegion(): Promise<MedusaRegion> {
  const regions = await listRegions();
  const region = regions.find((r) => r.currency_code === "usd") ?? regions[0];
  if (!region) {
    throw new Error("No Medusa region configured — run setup-storefront.ts on the backend first.");
  }
  return region;
}
