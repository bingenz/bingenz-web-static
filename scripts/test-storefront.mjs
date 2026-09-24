import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const browser = await chromium.launch();
const results = [];
await mkdir('test-results/storefront', { recursive: true });

try {
  for (const width of [1440, 390, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/shop`);
    await page.evaluate(() => {
      localStorage.removeItem('bgz-cart');
      localStorage.removeItem('theme');
    });
    await page.reload();
    await page.locator('[data-add]').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');

    assert.equal(await page.locator('.product-card').count(), 35);
    const columns = await page.locator('#product-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width <= 620 ? 1 : 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.locator('[data-add]').first().click();
    assert.equal(await page.locator('[data-add]').first().isDisabled(), true);
    assert.equal(await page.locator('[data-cart-count]').textContent(), '1');
    await page.locator('.header-cart-button').click();
    await page.locator('dialog').waitFor();
    assert.equal(await page.locator('.cart-line').count(), 1);
    await page.keyboard.press('Escape');
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.header-cart-button').evaluate(node => node === document.activeElement), true);

    await page.reload();
    await page.locator('[data-add]').first().waitFor();
    assert.equal(await page.locator('[data-cart-count]').textContent(), '1');
    const detailHref = await page.locator('.product-body h3 a').first().getAttribute('href');
    await page.goto(base + detailHref);
    await page.locator('.product-detail').waitFor();
    assert.equal(await page.locator('.product-detail [data-add]').isDisabled(), true);

    await page.locator('[data-open-cart]').last().click();
    await page.locator('.cart-summary .gold').click();
    await page.locator('#checkout-form').waitFor();
    assert.equal(new URL(page.url()).pathname, '/checkout');
    assert.equal(await page.locator('.checkout-summary-line').count(), 1);
    assert.equal(await page.locator('input[type=email]').count(), 1);

    await page.goto(`${base}/shop`);
    await page.locator('#shop-search').fill('Quick Sort');
    assert.equal(await page.locator('.product-card').count(), 1);
    await page.locator('#shop-search').fill('');
    const lightBackground = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
    assert.equal(lightBackground, 'rgb(248, 250, 252)');
    await page.screenshot({ path: `test-results/storefront/${width}-light.png`, fullPage: true });
    await page.locator('#commerce-theme').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.waitForTimeout(350);
    const darkBackground = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
    assert.equal(darkBackground, 'rgb(9, 9, 12)');
    await page.screenshot({ path: `test-results/storefront/${width}-dark.png`, fullPage: true });

    assert.deepEqual(errors, []);
    results.push({ width, products: 35, columns, cart: 'pass', detail: 'pass', checkout: 'pass', keyboard: 'pass', theme: 'pass', overflow: false, errors });
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile('docs/commerce/STOREFRONT_TESTS.json', `${JSON.stringify(results, null, 2)}\n`);
console.log(results);
