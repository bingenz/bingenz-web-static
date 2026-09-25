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
    await page.goto(`${base}/`);
    await page.evaluate(() => {
      localStorage.removeItem('bgz-cart');
      localStorage.removeItem('theme');
    });
    await page.reload();
    await page.locator('[data-add]').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');

    assert.equal(await page.locator('.product-card').count(), 8);
    const columns = await page.locator('#product-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width <= 620 ? 2 : width <= 900 ? 3 : 4);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('.product-description').count(), 0);
    assert.equal(await page.locator('.product-card h3 a').count(), 0);
    await page.locator('#catalog-more').click();
    assert.equal(await page.locator('.product-card').count(), 16);
    await page.locator('#shop-search').fill('Quick Sort');
    assert.equal(await page.locator('.product-card').count(), 1);
    await page.locator('#shop-search').fill('');
    assert.equal(await page.locator('.product-card').count(), 8);

    await page.locator('[data-add]').first().click();
    assert.equal(await page.locator('[data-add]').first().isDisabled(), true);
    assert.match(await page.locator('.floating-cart-button').innerText(), /^1 mô phỏng/);
    assert.equal(await page.locator('.home-section-cart').count(), 0);
    await page.locator('.floating-cart-button').click();
    await page.locator('dialog').waitFor();
    assert.equal(await page.locator('.cart-line').count(), 1);
    await page.keyboard.press('Escape');
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.floating-cart-button').evaluate(node => node === document.activeElement), true);

    await page.reload();
    await page.locator('[data-add]').first().waitFor();
    assert.match(await page.locator('.floating-cart-button').innerText(), /^1 mô phỏng/);
    await page.locator('.floating-cart-button').click();
    await page.locator('.cart-summary .cart-checkout-action').click();
    await page.locator('#checkout-form').waitFor();
    assert.equal(new URL(page.url()).pathname, '/checkout');
    assert.equal(await page.locator('.checkout-entry-panel').count(), 1);
    assert.equal(await page.locator('input[type=email]').count(), 1);

    await page.goto(`${base}/`);
    await page.locator('#shop-search').fill('Quick Sort');
    assert.equal(await page.locator('.product-card').count(), 1);
    await page.locator('#shop-search').fill('');
    const lightBackground = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
    assert.equal(lightBackground, 'rgb(248, 250, 252)');
    await page.screenshot({ path: `test-results/storefront/${width}-light.png`, fullPage: true });
    await page.locator('#themeToggleBtn').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.waitForTimeout(350);
    const darkBackground = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
    assert.equal(darkBackground, 'rgb(9, 9, 12)');
    await page.screenshot({ path: `test-results/storefront/${width}-dark.png`, fullPage: true });

    assert.deepEqual(errors, []);
    results.push({ width, products: 35, initialProducts: 8, columns, cart: 'pass', loadMore: 'pass', checkout: 'pass', keyboard: 'pass', theme: 'pass', overflow: false, errors });
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile('docs/commerce/STOREFRONT_TESTS.json', `${JSON.stringify(results, null, 2)}\n`);
console.log(results);
