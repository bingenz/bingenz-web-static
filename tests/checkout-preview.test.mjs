import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const id = '11111111-1111-1111-1111-111111111111';
const products = JSON.parse(await readFile('docs/commerce/PREPARED_PRODUCTS.json', 'utf8')).slice(0, 2);
const items = products.map((item, index) => ({ ...item, title: index ? 'Quick Sort' : 'A* Pathfinding', price_vnd: 9000, duration_seconds: 900, activation_days: 7, description: 'Quan sát từng bước xử lý trong mô phỏng tương tác.' }));
async function fixture(page, { qrError = false, many = false } = {}) {
  let status = 'pending', offline = false;
  const requests = [];
  const orderItems = many ? Array.from({ length: 35 }, (_, i) => ({ ...items[i % 2], title: `Mô phỏng ${i + 1}` })) : items;
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    requests.push(path);
    if (url.hostname !== 'localhost') return route.fulfill({ status: 204, body: '' });
    if (path === `/api/orders/${id}`) {
      if (offline) return route.fulfill({ status: 503, json: { error: 'service_unavailable' } });
      return route.fulfill({ json: { id, status, items: orderItems, total_vnd: orderItems.length * 9000, payment_code: 'BGZ23456789ABCD', expires_at: new Date(Date.now() + 900000).toISOString(), server_now: new Date().toISOString(), payment_destination: { bank_code: 'TPBank', account_number: '63993686868', account_name: 'LE NGOC THUAN' } } });
    }
    if (path === `/api/orders/${id}/qr`) return qrError
      ? route.fulfill({ status: 502, body: '' })
      : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="white"/><path d="M20 20h60v60H20zM140 20h60v60h-60zM20 140h60v60H20zM100 100h20v20h-20zM140 140h60v60h-60z" fill="black"/></svg>' });
    try {
      const file = path.startsWith('/checkout/') ? 'commerce.html' : path.slice(1);
      return route.fulfill({ body: await readFile('public/' + file), contentType: /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.webp') ? 'image/webp' : 'text/html' });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  return { expire: () => { status = 'expired'; }, offline: value => { offline = value; }, requests };
}

test('QR checkout keeps previews locked, switches products, and works across widths/themes', async () => {
  const browser = await chromium.launch();
  await mkdir('test-results/checkout', { recursive: true });
  try {
    for (const width of [1440, 768, 390, 360, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const mock = await fixture(page);
      await page.goto(`http://localhost/checkout/${id}`);
      await page.locator('.payment-qr').waitFor();
      assert.equal(await page.locator('.payment-manual').getAttribute('open'), null);
      assert.equal(await page.locator('.preview-start').isDisabled(), true);
      assert.equal(await page.locator('iframe').count(), 0);
      assert.equal(await page.locator('.payment-total').innerText().then(x => x.includes('18.000')), true);
      assert.equal(await page.locator('.preview-product:visible h3').innerText(), items[0].title);
      await page.locator('[data-preview="1"]').click();
      assert.equal(await page.locator('.preview-product:visible h3').innerText(), items[1].title);
      assert.equal(await page.locator('[data-preview="1"]').getAttribute('aria-pressed'), 'true');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        await page.waitForFunction(theme => getComputedStyle(document.body).color === (theme === 'dark' ? 'rgb(241, 245, 249)' : 'rgb(15, 23, 42)'), theme);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `test-results/checkout/qr-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
      }
      if (width === 390) {
        mock.offline(true);
        await page.waitForFunction(() => document.querySelector('#payment-state')?.textContent.includes('kết nối lại'));
        assert.equal(await page.locator('.preview-start').isDisabled(), true);
        mock.offline(false);
        await page.waitForFunction(() => document.querySelector('#payment-state')?.textContent.includes('ngân hàng'));
        mock.expire();
        await page.locator('.expired-state').waitFor();
        assert.equal(await page.locator('.payment-qr, .preview-start').count(), 0);
      }
      assert.equal(mock.requests.some(path => /\/play|\/runtime|\/start/.test(path)), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('unavailable QR reveals manual payment and a large order stays within mobile width', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await fixture(page, { qrError: true, many: true });
    await page.goto(`http://localhost/checkout/${id}`);
    await page.waitForFunction(() => document.querySelector('.payment-manual')?.open);
    assert.equal(await page.locator('.payment-qr-wrap').isVisible(), false);
    assert.equal(await page.locator('.qr-download-action').isVisible(), false);
    assert.equal(await page.locator('#copy-code').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('.preview-start').isDisabled(), true);
  } finally { await browser.close(); }
});
