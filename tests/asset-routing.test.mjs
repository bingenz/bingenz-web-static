import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { unstable_readConfig } from 'wrangler';

test('actual asset router bypasses compute only for public files and preserves protected shells', async () => {
  const config = unstable_readConfig({config: 'wrangler.toml'});
  for (const file of ['wrangler.local.toml', 'wrangler.preview.toml']) {
    assert.deepEqual(unstable_readConfig({config: file}).assets.run_worker_first, config.assets.run_worker_first);
  }
  const bundle = await build({
    stdin: {
      contents: `import app from './src/worker.mjs'; export default { async fetch(request, env) {
        const response = await app.fetch(request, env);
        const marked = new Response(response.body, response);
        marked.headers.set('x-test-worker-invoked', '1'); return marked;
      }};`,
      resolveDir: process.cwd(),
    }, bundle: true, format: 'esm', platform: 'browser', write: false,
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: config.compatibility_date,
    bindings: {SESSION_SECRET: 'local-only-fixture-secret-at-least-32-characters', ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com', ACCESS_AUD: 'fixture'},
    assets: {directory: './public', binding: 'ASSETS', run_worker_first: config.assets.run_worker_first, routerConfig: {has_user_worker: true}},
  }));
  try {
    for (const path of ['/', '/index.html', '/styles.css', '/app.js', '/gemini.mjs', '/commerce.css', '/admin.mjs', '/icons/gemini.svg']) {
      const response = await mf.dispatchFetch('https://shop.test' + path, {redirect: 'manual'});
      assert.ok([200, 307, 308].includes(response.status), path + ': ' + response.status);
      assert.equal(response.headers.get('x-test-worker-invoked'), null, path + ' must bypass compute');
    }
    for (const path of ['/admin', '/admin.html', '/commerce.html', '/shop', '/shop.html', '/api', '/api/unknown', '/runtime/secret', '/play/secret', '/checkout/secret']) {
      const response = await mf.dispatchFetch('https://shop.test' + path, {redirect: 'manual'});
      assert.equal(response.headers.get('x-test-worker-invoked'), '1', path + ' must keep Worker checks');
      assert.ok(response.status >= 400 && response.status < 500, path + ': ' + response.status);
    }
    const encodedAdmin = await mf.dispatchFetch('https://shop.test/%61dmin.html', {redirect: 'manual'});
    assert.equal(encodedAdmin.headers.get('x-test-worker-invoked'), '1');
    assert.ok([307, 308].includes(encodedAdmin.status));
    assert.equal(new URL(encodedAdmin.headers.get('location'), 'https://shop.test').pathname, '/admin');
    const checkout = await mf.dispatchFetch('https://shop.test/checkout');
    assert.equal(checkout.status, 200);
    assert.equal(checkout.headers.get('x-test-worker-invoked'), '1');
    assert.match(await checkout.text(), /id="shop-page"/);
    assert.match(checkout.headers.get('cache-control'), /private, no-store/);
  } finally { await mf.dispose(); }
});
