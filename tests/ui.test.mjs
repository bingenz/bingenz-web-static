import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

test('public navigation uses a mobile-only four-item dock without a floating support button', async () => {
  const [html, styles] = await Promise.all([
    readFile('public/index.html', 'utf8'),
    readFile('public/styles.css', 'utf8')
  ]);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(html);
    await page.addStyleTag({ content: styles });
    assert.equal(await page.locator('#bottomBar .bottom-bar-btn').count(), 4);
    assert.equal(await page.locator('#contactFab').count(), 0);
    assert.equal(await page.locator('#bottomBar').evaluate(node => getComputedStyle(node).display), 'none');

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#bottomBar').evaluate(node => getComputedStyle(node).display), 'flex');
    const targets = await page.locator('#bottomBar .bottom-bar-btn').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    assert.ok(targets.every(target => target.width >= 44 && target.height >= 44));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally {
    await browser.close();
  }
});

test('customer commerce UI no longer relies on platform glyph icons', async () => {
  const source = await Promise.all([
    readFile('public/commerce.html', 'utf8'),
    readFile('public/shop.html', 'utf8'),
    readFile('public/commerce.mjs', 'utf8')
  ]);
  assert.doesNotMatch(source.join('\n'), /[☾☀▣◇☎×]/u);
});

test('home uses one mobile cart entry and keeps action SVGs bounded', async () => {
  const [html, styles, commerceStyles, commerceScript] = await Promise.all([
    readFile('public/index.html', 'utf8'),
    readFile('public/styles.css', 'utf8'),
    readFile('public/commerce.css', 'utf8'),
    readFile('public/commerce.mjs', 'utf8')
  ]);
  assert.doesNotMatch(commerceScript, /home-section-cart/);
  assert.match(html, /Biến ý tưởng thành/);
  assert.match(styles, /\.action-arrow[^}]*width:18px!important[^}]*height:18px!important/);
  assert.match(commerceStyles, /\.floating-cart\s*\{/);
  assert.match(html, /styles\.css\?v=20261002-1/);
});

test('mobile hero and game CTAs stay compact and GitHub follows the dark theme', async () => {
  const [html, styles] = await Promise.all([
    readFile('public/index.html', 'utf8'),
    readFile('public/styles.css', 'utf8')
  ]);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(html);
    await page.addStyleTag({ content: styles });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });

    const dimensions = await page.evaluate(() => {
      const measure = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      };
      const githubPath = document.querySelector('.hero-social-stat[aria-label="GitHub"] path');
      return {
        hero: measure('.hero-cta-button'),
        game: measure('.game-web-button'),
        githubFill: getComputedStyle(githubPath).fill
      };
    });

    assert.ok(dimensions.hero.width <= 220 && dimensions.hero.height <= 44);
    assert.ok(dimensions.game.width <= 220 && dimensions.game.height <= 44);
    assert.notEqual(dimensions.githubFill, 'rgb(0, 0, 0)');
  } finally {
    await browser.close();
  }
});
