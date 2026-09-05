import { expect, test, type Page } from "@playwright/test";

// Products from two different vendors in the seeded catalog.
const TRAVORIES = "ilam-first-flush-black-tea";
const THE_FADE = "ridge-cashmere-shawl";

// The product page's button reads "Add to cart" (and "Adding…" while the
// mutation is in flight), so the selector matches that text rather than the
// "add to bag" wording used elsewhere in the copy.
const addButton = (page: Page) => page.getByRole("button", { name: /add to cart/i }).first();

async function addToBag(page: Page, handle: string) {
  await page.goto(`/product/${handle}`);
  await addButton(page).click();
  // The cart drawer opens only on a successful add, so it — not the button
  // re-enabling — is the signal that the line actually landed on the server.
  // Navigating away any sooner cancels the in-flight request.
  await expect(page.getByRole("complementary", { name: "Shopping cart" })).toBeVisible();
}

async function fillAddress(page: Page) {
  await page.getByTestId("checkout-email").fill("checkout-test@example.com");
  await page.getByTestId("checkout-firstName").fill("Ada");
  await page.getByTestId("checkout-lastName").fill("Lovelace");
  await page.getByTestId("checkout-address1").fill("12 Analytical Way");
  await page.getByTestId("checkout-city").fill("Portland");
  await page.getByTestId("checkout-province").fill("OR");
  await page.getByTestId("checkout-postalCode").fill("97201");
  await page.getByTestId("checkout-countryCode").selectOption("us");
}

test("places one order per vendor and empties the bag", async ({ page }) => {
  await addToBag(page, TRAVORIES);
  await addToBag(page, THE_FADE);

  await page.goto("/checkout");
  await fillAddress(page);
  await page.getByTestId("save-address").click();

  // Each vendor must be offered exactly one option — its own. This is the
  // storefront-side proof that the backend filter works.
  await expect(page.getByTestId("shipping-section")).toBeVisible();
  const groups = page.locator('[data-testid^="shipping-group-"]');
  await expect(groups).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    const radios = groups.nth(i).locator('input[type="radio"]');
    await expect(radios).toHaveCount(1);
    await radios.first().check();
  }

  await expect(page.getByTestId("payment-section")).toBeVisible();
  await page.getByTestId("place-order").click();

  await page.waitForURL(/\/order\/confirmed/);
  const orders = page.locator('[data-testid^="order-order_"]');
  await expect(orders).toHaveCount(2);

  // The order numbers must survive a refresh, not live only in memory.
  await page.reload();
  await expect(page.locator('[data-testid^="order-order_"]')).toHaveCount(2);

  await page.goto("/cart");
  await expect(page.getByText(/your bag is empty/i)).toBeVisible();
});

test("a vendor's cart can be used again after ordering from them", async ({ page }) => {
  // Regression test for removeVendorCart: a completed Medusa cart rejects new
  // line items with a 400, so a stale cart id makes every later add fail.
  await addToBag(page, TRAVORIES);

  await page.goto("/checkout");
  await fillAddress(page);
  await page.getByTestId("save-address").click();
  await page.locator('[data-testid^="shipping-group-"] input[type="radio"]').first().check();
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/order\/confirmed/);

  await addToBag(page, TRAVORIES);
  await page.goto("/cart");
  await expect(page.getByText(/your bag is empty/i)).toHaveCount(0);
  await expect(page.getByText(/ilam first flush/i).first()).toBeVisible();
});
