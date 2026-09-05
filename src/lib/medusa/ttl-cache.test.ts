import { describe, expect, test } from "bun:test";
import { createTtlCache } from "./ttl-cache";

describe("createTtlCache", () => {
  test("returns null before anything is cached", () => {
    expect(createTtlCache<string>().get()).toBeNull();
  });

  test("returns the cached value inside the window", () => {
    const cache = createTtlCache<string>(1000);
    cache.set("travories");
    expect(cache.get()).toBe("travories");
  });

  test("expires the value once the window has passed", async () => {
    const cache = createTtlCache<string>(5);
    cache.set("travories");
    await new Promise((r) => setTimeout(r, 15));
    // This is the whole point: a vendor added in the admin after the SSR
    // process started must eventually appear without a restart.
    expect(cache.get()).toBeNull();
  });

  test("clear drops the value immediately", () => {
    const cache = createTtlCache<string>(10_000);
    cache.set("travories");
    cache.clear();
    expect(cache.get()).toBeNull();
  });
});
