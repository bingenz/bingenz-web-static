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

test("admin navigation, product search/filter, minute conversion and dirty selection work on mobile and desktop", async () => {
  const browser = await chromium.launch();
  await mkdir("test-results/redesign", { recursive: true });
  try {
    for (const width of [1440, 430, 390, 360]) {
      const products = prepared.map((p, i) => ({
        ...p,
        ...metadata.find((m) => m.slug === p.slug),
        price_vnd: 9000,
        duration_seconds: 900,
        active: i < 30 ? 1 : 0,
        archived: i > 32 ? 1 : 0,
        current_version_id: p.version,
        activation_days: 7,
        display_order: i,
      }));
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [],
        mutations = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("http://localhost/**", async (route) => {
        const url = new URL(route.request().url()),
          path = url.pathname.replace("/admin/api/", "");
        if (url.pathname.startsWith("/admin/api/")) {
          let json;
          if (path === "dashboard")
            json = {
              revenue: {
                today_vnd: 180000,
                week_vnd: 1260000,
                month_vnd: 4860000,
              },
              orders: { paid: 540, pending: 3, expired_pending: 2 },
              manual_review_payments: 1,
              active_entitlements: 6,
              best_sellers: [{ title: "Quick Sort", sold: 85 }],
            };
          else if (path === "products") json = { products, snapshot:JSON.stringify(products.filter(p=>!p.archived).map(p=>({id:p.id,display_order:p.display_order}))) };
          else if (path === "gemini-prices") json = {plans:[],snapshot:"[]"};
          else if (path === "orders") json = { orders: [] };
          else if (path === "payments") json = { payments: [] };
          else if (path === "settings") json = { activation_days: 7 };
          else if (path.endsWith("/versions")) {
            const p = products.find((p) => path.includes(p.id));
            json = {
              current_version_id: p.version,
              versions: [
                {
                  id: p.version,
                  sha256: p.sha256,
                  bytes: p.bytes,
                  created_at: "2026-09-25T08:00:00Z",
                },
              ],
            };
          } else if (path === "products/reorder") {
            const body=route.request().postDataJSON();
            mutations.push(body);
            for(const [i,id] of body.ids.entries())products.find(p=>p.id===id).display_order=i+1;
            products.sort((a,b)=>a.archived-b.archived||a.display_order-b.display_order);
            json={updated:body.ids};
          } else if (route.request().method() === "PATCH") {
            const changes = route.request().postDataJSON(),
              p = products.find((p) => path === "products/" + p.id);
            mutations.push(changes);
            Object.assign(p, changes);
            json = { product: p };
          }
          return route.fulfill({ json });
        }
        const file =
          url.pathname === "/admin" ? "admin.html" : url.pathname.slice(1);
        try {
          return route.fulfill({
            body: await readFile("public/" + file),
            contentType: file.endsWith(".mjs")
              ? "text/javascript"
              : file.endsWith(".css")
                ? "text/css"
                : "text/html",
          });
        } catch {
          return route.fulfill({ status: 404 });
        }
      });
      await page.goto("http://localhost/admin");
      await page.waitForFunction(
        () =>
          document.querySelector("#message").textContent === "Đã tải dữ liệu.",
      );
      assert.equal(await page.locator("[data-admin-panel]:visible").count(), 1);
      assert.equal(await page.locator("#orders-section").isVisible(), true);
      assert.equal(await page.locator(".admin-nav a").count(), 2);
      await page.screenshot({
        path: `test-results/redesign/admin-orders-${width}.png`,
        fullPage: true,
      });
      await page.locator('.admin-nav a[href="#products-section"]').click();
      assert.equal(await page.locator("[data-admin-panel]:visible").count(), 1);
      await page.locator("#admin-product-search").fill("Quick Sort");
      assert.equal(await page.locator("#admin-product-rows tr[data-product-id]").count(), 1);
      await page.locator("#admin-product-rows [data-action=edit]").click();
      await page.locator("#product-form [name=duration_minutes]").fill("20");
      await page.locator("#product-form button").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#message").textContent ===
          "Đã lưu sản phẩm và ghi nhật ký.",
      );
      assert.equal(mutations.at(-1).duration_seconds, 1200);
      await page.locator("#admin-product-search").fill("");
      await page.locator("#admin-product-filter").selectOption("draft");
      assert.equal(await page.locator("#admin-product-rows tr[data-product-id]").count(), 3);
      await page.locator("#admin-product-filter").selectOption("all");
      const selected = await page.locator("#product-list").inputValue();
      await page
        .locator("#product-form [name=title]")
        .fill("Thay đổi chưa lưu");
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.locator("#product-list").selectOption(products[2].id);
      assert.equal(await page.locator("#product-list").inputValue(), selected);
      assert.equal(
        await page.locator("#product-form [name=title]").inputValue(),
        "Thay đổi chưa lưu",
      );
      await page.locator("#product-form [name=title]").fill("Quick Sort");
      await page.locator("#product-form button").click();
      await page.waitForFunction(
        () => !document.querySelector("#product-form button").disabled,
      );
      await page.waitForFunction(()=>document.querySelector('#message').textContent==='Đã lưu sản phẩm và ghi nhật ký.');
      const row=page.locator('#admin-product-rows tr[data-product-id]').first();
      const firstId=await row.getAttribute('data-product-id');
      await row.locator('[data-action=down]').click();
      assert.equal(await page.locator('#admin-product-rows tr[data-product-id]').nth(1).getAttribute('data-product-id'),firstId);
      await page.locator('#cancel-order').click();
      assert.equal(await page.locator('#admin-product-rows tr[data-product-id]').first().getAttribute('data-product-id'),firstId);
      const position=page.locator(`#admin-product-rows tr[data-product-id="${firstId}"] [data-action=position]`);
      await position.fill('4');await position.press('Tab');
      assert.equal(await page.locator('#admin-product-rows tr[data-product-id]').nth(3).getAttribute('data-product-id'),firstId);
      await page.locator('#save-order').click();
      await page.waitForFunction(()=>document.querySelector('#message').textContent==='Đã lưu thứ tự sản phẩm và ghi nhật ký.');
      assert.equal(mutations.at(-1).ids[3],firstId);
      await page.locator('.admin-nav a[href="#orders-section"]').click();
      await page.locator('#products-section').waitFor({state:'hidden'});
      assert.equal(await page.locator('#products-section').isVisible(),false);
      await page.locator('.admin-nav a[href="#products-section"]').click();
      await page.locator('#products-section').waitFor({state:'visible'});
      assert.equal(await page.locator('#admin-product-rows tr[data-product-id]').nth(3).getAttribute('data-product-id'),firstId);
      await page.locator('[data-action=position]').first().focus();
      assert.ok(await page.locator('[data-action=position]').first().evaluate(node=>node===document.activeElement));
      await page.screenshot({path:`test-results/redesign/admin-viewport-${width}.png`});
      await page.screenshot({
        path: `test-results/redesign/admin-products-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
