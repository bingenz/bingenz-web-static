import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const products = JSON.parse(await readFile('docs/commerce/PREPARED_PRODUCTS.json', 'utf8')).slice(0, 4);
const code = 'BGZ23456789ABCD';
const token = 'A'.repeat(43);
const items = products.map((p, i) => ({ ...p, id: `entitlement-${i}`, duration_seconds: 900, description: 'Khám phá cách hệ thống hoạt động qua từng bước tương tác.', status: ['not_started','active','expired','activation_expired'][i], activation_deadline: new Date(Date.now() + 7 * 86400000).toISOString(), expires_at: new Date(Date.now() + 900000).toISOString() }));

test('paid access shows saved link, previews and independent Start across mobile/desktop and themes', async () => {
  const browser = await chromium.launch();
  await mkdir('test-results/paid-access', { recursive: true });
  try {
    for (const width of [1440, 768, 390, 360, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage(), requests = [], errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ code, token }) => sessionStorage.setItem(`bgz-access-link:${code}:0`, `${location.origin}/access/${token}`), { code, token });
      await page.route('**/*', async route => {
        const url = new URL(route.request().url()), path = url.pathname;
        requests.push(path);
        if (url.hostname !== 'localhost') return route.fulfill({ status: 204, body: '' });
        if (path === '/api/access') return route.fulfill({ json: { order_code: code, server_now: new Date().toISOString(), items } });
        try {
          const file = path === '/access' ? 'commerce.html' : path.slice(1);
          return route.fulfill({ body: await readFile('public/' + file), contentType: /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.webp') ? 'image/webp' : 'text/html' });
        } catch { return route.fulfill({ status: 404, body: '' }); }
      });
      await page.goto('http://localhost/access');
      await page.locator('#copy-access').waitFor();
      assert.equal(await page.locator('#access-link-value').inputValue(), `http://localhost/access/${token}`);
      assert.equal(await page.locator('[data-start]').count(), 1);
      assert.equal(await page.locator('a[href="/play/entitlement-1"]').count(), 1);
      assert.equal(await page.locator('.access-product-ended').count(), 2);
      assert.equal(await page.locator('iframe').count(), 0);
      await page.locator('#copy-access').click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `http://localhost/access/${token}`);
      await page.waitForFunction(() => document.querySelector('#shop-announcement').textContent.includes('liên kết truy cập'));
      assert.match(await page.locator('#shop-announcement').innerText(), /liên kết truy cập/);
      await page.locator('[data-start]').click();
      assert.match(await page.locator('dialog').innerText(), /Bắt đầu 15 phút/);
      await page.locator('#cancel-start').click();
      assert.equal(requests.some(path => /\/start$|\/runtime/.test(path)), false);
      await page.waitForFunction(() => document.querySelector('#copy-access').textContent.includes('Sao chép'));
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        await page.waitForFunction(theme => getComputedStyle(document.body).color === (theme === 'dark' ? 'rgb(241, 245, 249)' : 'rgb(15, 23, 42)'), theme);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `test-results/paid-access/access-${width}-${theme}.png`, fullPage: true, animations: 'disabled', style: '.commerce-toast { visibility: hidden; }' });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});
