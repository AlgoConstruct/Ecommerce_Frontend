import { expect, test } from "@playwright/test";

test("shop page renders products from the live backend", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto("/shop");
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});
