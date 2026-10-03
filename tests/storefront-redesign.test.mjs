import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const prepared = JSON.parse(
  await readFile("docs/commerce/PREPARED_PRODUCTS.json", "utf8"),
);
const metadata = JSON.parse(
  await readFile("docs/commerce/PRODUCT_METADATA.json", "utf8"),
);
const products = prepared.map((p) => ({
  ...p,
  ...metadata.find((m) => m.slug === p.slug),
  price_vnd: 9000,
  duration_seconds: 900,
  activation_days: 7,
}));
const release = "20261003-1";

async function storefront(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "localhost")
      return route.fulfill({ status: 204, body: "" });
    if (url.pathname === "/api/catalog")
      return route.fulfill({
        json: { products, turnstile_site_key: "local-fixture" },
      });
    let file =
      url.pathname === "/"
        ? "index.html"
        : url.pathname === "/checkout"
          ? "shop.html"
          : url.pathname.slice(1);
    try {
      const body = await readFile("public/" + file);
      const contentType =
        file.endsWith(".mjs") || file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".webp")
              ? "image/webp"
              : file.endsWith(".jpg")
                ? "image/jpeg"
                : "text/html";
      return route.fulfill({ body, contentType });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
}

test("redesigned storefront keeps two mobile columns, all products, cart edits and accurate checkout totals", async () => {
  const browser = await chromium.launch();
  await mkdir("test-results/redesign", { recursive: true });
  try {
    for (const width of [1440, 430, 390, 360]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await storefront(page);
      await page.goto("http://localhost/");
      await page.locator("[data-add]").first().waitFor();
      assert.equal(await page.locator(".product-card").count(), products.length);
      assert.equal(
        await page
          .locator("#product-grid")
          .evaluate(
            (node) =>
              getComputedStyle(node).gridTemplateColumns.split(" ").length,
          ),
        width < 620 ? 2 : 4,
      );
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (theme) => (document.documentElement.dataset.theme = theme),
          theme,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page
          .locator("#store")
          .screenshot({
            path: `test-results/redesign/store-${width}-${theme}.png`,
            style: ".topbar, .bottom-bar { visibility: hidden; }",
          });
        await page.evaluate(()=>scrollTo(0,document.querySelector('#store').offsetTop));
        await page.screenshot({path:`test-results/redesign/store-viewport-${width}-${theme}.png`});
      }
      assert.equal(await page.locator("[data-detail], #catalog-more").count(), 0);
      assert.match(await page.locator(".product-runtime").first().innerText(), /15 phút.*7 ngày/);
      await page.locator("[data-add]").first().click();
      await page.locator("[data-add]").nth(1).click();
      await page.locator(".floating-cart-button").click();
      assert.equal(await page.locator(".cart-line").count(), 2);
      await page.locator(".cart-checkout-action").click();
      await page.locator("#checkout-form").waitFor();
      assert.equal(await page.locator(".checkout-review-line").count(), 2);
      assert.match(
        await page.locator(".checkout-review .cart-total").innerText(),
        /18.000/,
      );
      await page.locator("#checkout-edit-cart").click();
      await page.locator("[data-remove]").first().click();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.querySelectorAll(".checkout-review-line").length === 1,
      );
      assert.match(
        await page.locator(".checkout-review .cart-total").innerText(),
        /9.000/,
      );
      assert.equal(await page.locator("input[type=email]").count(), 1);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `test-results/redesign/checkout-${width}.png`,
        fullPage: true,
        style: "#shop-announcement { visibility: hidden !important; }",
      });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test("a returning browser switches every public and admin asset to the new release URL", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await storefront(page);
    const old = (await readFile("public/index.html", "utf8")).replaceAll(
      release,
      "20261001-1",
    );
    await page.route(
      "http://localhost/",
      (route) => route.fulfill({ body: old, contentType: "text/html" }),
      { times: 1 },
    );
    await page.goto("http://localhost/");
    await page.locator("[data-add]").first().waitFor();
    assert.ok(
      await page
        .locator('script[src*="commerce.mjs"]')
        .getAttribute("src")
        .then((src) => src.includes("20261001-1")),
    );
    await page.reload();
    await page.locator("[data-add]").first().waitFor();
    for (const file of [
      "index.html",
      "shop.html",
      "commerce.html",
      "admin.html",
    ]) {
      const html = await readFile("public/" + file, "utf8");
      assert.doesNotMatch(html, /20261001-1/);
      const refs = [
        ...html.matchAll(
          /(?:src|href)="\/?(?:styles\.css|commerce\.css|app\.js|commerce\.mjs|admin\.css|admin\.mjs)\?v=([^"]+)"/g,
        ),
      ];
      assert.ok(refs.length > 0);
      assert.ok(refs.every((ref) => ref[1] === release));
    }
    assert.match(
      await page.locator('script[src*="commerce.mjs"]').getAttribute("src"),
      /20261003-1/,
    );
  } finally {
    await browser.close();
  }
});
