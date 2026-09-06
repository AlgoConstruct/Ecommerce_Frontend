import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Placement failure, partial and total.
 *
 * Medusa cannot roll back a completed order, so all-or-nothing placement is
 * not on offer. The design instead attempts every vendor, continues past a
 * failure, and reports per-vendor outcomes. These tests pin the two halves of
 * that bargain:
 *
 *   1. a failing maker must not deny an unrelated maker whose items are fine;
 *   2. a failed maker's items must stay in the bag, which is the durable
 *      record of what was *not* ordered.
 *
 * Both are close to impossible to exercise by hand and have the worst
 * consequences when they regress, which is why they are pinned here.
 */

interface SeededProduct {
  handle: string;
  /** The Medusa store (vendor) name, as the storefront renders it. */
  vendor: string;
  /** The product title, as it appears in the bag and on the order. */
  title: string;
}

const SEEDED: SeededProduct[] = [
  {
    handle: "ilam-first-flush-black-tea",
    vendor: "Travories",
    title: "Ilam First Flush Black Tea",
  },
  { handle: "ridge-cashmere-shawl", vendor: "The Fade", title: "Ridge Cashmere Shawl" },
];

/**
 * The vendor names are read out of the page rather than assumed, so the test
 * doesn't depend on bag ordering. This turns one back into the seeded product
 * it belongs to — loudly, because a silent `undefined` here would quietly
 * weaken every assertion built on it.
 */
function productOfVendor(vendorName: string): SeededProduct {
  const product = SEEDED.find((p) => p.vendor === vendorName);
  if (!product) {
    throw new Error(
      `Checkout showed the vendor "${vendorName}", which is not one of the seeded vendors ` +
        `(${SEEDED.map((p) => p.vendor).join(", ")}). The seed data or the bag has changed.`,
    );
  }
  return product;
}

/**
 * A fulfilled cross-origin response still goes through the browser's CORS
 * check, so the intercept has to answer with the same permissions the real
 * backend does — otherwise the fetch fails at the network layer and the app
 * takes its generic `catch` path instead of the completion-failure path we
 * mean to exercise.
 */
const CORS_JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "http://localhost:8080",
  "access-control-allow-credentials": "true",
};

/**
 * Medusa answers `POST /store/carts/:id/complete` with HTTP **200** whether
 * the cart became an order or not; the discriminator is the `type` field.
 * Faking a 5xx here would exercise a different code path than the one real
 * failures take, so the intercept mirrors the real failure envelope exactly.
 */
function completionFailureBody(message: string) {
  return JSON.stringify({
    type: "cart",
    cart: { id: "cart_failed" },
    error: { message },
  });
}

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
  await page.getByTestId("checkout-email").fill("partial-failure@example.com");
  await page.getByTestId("checkout-firstName").fill("Ada");
  await page.getByTestId("checkout-lastName").fill("Lovelace");
  await page.getByTestId("checkout-address1").fill("12 Analytical Way");
  await page.getByTestId("checkout-city").fill("Portland");
  await page.getByTestId("checkout-province").fill("OR");
  await page.getByTestId("checkout-postalCode").fill("97201");
  await page.getByTestId("checkout-countryCode").selectOption("us");
}

/**
 * The vendor name a shipping group is for — its first paragraph.
 *
 * `textContent`, not `innerText`: the heading carries the `eyebrow` utility,
 * which is `text-transform: uppercase`, and `innerText` would hand back
 * "TRAVORIES" rather than the name the vendor actually has.
 */
async function vendorNameOf(group: Locator): Promise<string> {
  return ((await group.locator("p").first().textContent()) ?? "").trim();
}

test("one vendor failing does not block the others", async ({ page }) => {
  for (const product of SEEDED) await addToBag(page, product.handle);

  await page.goto("/checkout");
  await fillAddress(page);
  await page.getByTestId("save-address").click();

  await expect(page.getByTestId("shipping-section")).toBeVisible();
  const groups = page.locator('[data-testid^="shipping-group-"]');
  await expect(groups).toHaveCount(2);

  // `placeOrders` walks the bag in order and `ShippingSection` renders that
  // same order, so the second group is the vendor whose completion is failed
  // below. Reading the names off the page rather than hardcoding them keeps
  // the assertions pointed at the *right* vendor even if bag order changes.
  const succeeding = productOfVendor(await vendorNameOf(groups.nth(0)));
  const failing = productOfVendor(await vendorNameOf(groups.nth(1)));
  expect(succeeding.vendor).not.toBe(failing.vendor);

  for (let i = 0; i < 2; i++) {
    await groups.nth(i).locator('input[type="radio"]').first().check();
  }
  await expect(page.getByTestId("payment-section")).toBeVisible();
  await expect(page.getByTestId("place-order")).toBeEnabled();

  // Fail exactly the second cart's completion, the way Medusa really does.
  let completions = 0;
  await page.route("**/store/carts/*/complete", async (route) => {
    // A CORS preflight, if it ever reaches the handler, is not a completion.
    if (route.request().method() !== "POST") return route.continue();
    completions += 1;
    if (completions !== 2) return route.continue();
    return route.fulfill({
      status: 200,
      headers: CORS_JSON_HEADERS,
      body: completionFailureBody("Not enough stock for this item."),
    });
  });

  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/order\/confirmed/);

  // Both vendors were attempted: the failure did not abort the loop, and the
  // succeeding vendor was not silently skipped.
  expect(completions).toBe(2);

  // Exactly one order exists, and it is the vendor that succeeded — not a
  // placeholder, and not the failed vendor's items dressed up as placed.
  const orders = page.locator('[data-testid^="order-order_"]');
  await expect(orders).toHaveCount(1);
  await expect(orders.first()).toContainText(succeeding.title);
  await expect(orders.first()).not.toContainText(failing.title);

  // The failed vendor is named on the confirmation, with the reason Medusa
  // gave, so the shopper knows precisely what did not happen.
  const confirmFailures = page.getByTestId("confirm-failures");
  await expect(confirmFailures).toBeVisible();
  await expect(confirmFailures).toContainText(failing.vendor);
  await expect(confirmFailures).toContainText("Not enough stock for this item.");
  await expect(confirmFailures).not.toContainText(succeeding.vendor);

  // The bag is the durable record of what was not ordered: the failed
  // vendor's items are still in it, and the ordered vendor's are gone.
  await page.goto("/cart");
  await expect(page.getByText(`Sold by ${failing.vendor}`)).toBeVisible();
  await expect(page.getByText(failing.title).first()).toBeVisible();
  await expect(page.getByText(`Sold by ${succeeding.vendor}`)).toHaveCount(0);
  await expect(page.getByText(succeeding.title)).toHaveCount(0);
});

test("when every vendor fails, nothing is confirmed and the bag is intact", async ({ page }) => {
  const only = SEEDED[0];
  if (!only) throw new Error("No seeded products configured.");
  await addToBag(page, only.handle);

  await page.goto("/checkout");
  await fillAddress(page);
  await page.getByTestId("save-address").click();

  await expect(page.getByTestId("shipping-section")).toBeVisible();
  await page.locator('[data-testid^="shipping-group-"] input[type="radio"]').first().check();
  await expect(page.getByTestId("place-order")).toBeEnabled();

  let completions = 0;
  await page.route("**/store/carts/*/complete", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    completions += 1;
    return route.fulfill({
      status: 200,
      headers: CORS_JSON_HEADERS,
      body: completionFailureBody("Payment could not be authorised."),
    });
  });

  await page.getByTestId("place-order").click();

  const failures = page.getByTestId("placement-failures");
  await expect(failures).toBeVisible();
  await expect(failures).toContainText(only.vendor);
  await expect(failures).toContainText("Payment could not be authorised.");
  // The wording matters as much as the list: with nothing placed, the shopper
  // must be told the bag is untouched, not that "some" makers failed.
  await expect(failures).toContainText("Nothing was placed. Your bag is unchanged.");
  expect(completions).toBe(1);

  // No confirmation, and nothing claiming an order was placed.
  expect(page.url()).toContain("/checkout");
  expect(page.url()).not.toContain("/order/confirmed");
  await expect(page.getByTestId("orders-placed")).toHaveCount(0);

  // The button is released, so the shopper can fix the problem and retry
  // rather than being stranded on a dead "Placing your order…" state.
  await expect(page.getByTestId("place-order")).toBeEnabled();

  await page.goto("/cart");
  await expect(page.getByText(`Sold by ${only.vendor}`)).toBeVisible();
  await expect(page.getByText(only.title).first()).toBeVisible();
});
