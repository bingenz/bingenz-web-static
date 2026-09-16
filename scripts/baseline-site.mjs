import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
await mkdir('test-results/audit',{recursive:true});
const browser=await chromium.launch();
const results=[];
try {
 for(const width of [1440,390,360]) {
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2] || pathToFileURL(resolve('public/index.html')).href);
  await page.locator('#cube-jump').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#cube-jump h2').textContent(),'Cube Jump Online');
  await page.locator('#themeToggleBtn').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#themeToggleBtn').click();
  for(const [trigger,modal] of [['.service-dark','#devModal'],['.comm-join-btn','#communityPopup'],['a[onclick*="zaloOpenPopup"]','#zaloPopup']]) {
    await page.locator(trigger).click();assert(await page.locator(modal).isVisible());
    await page.keyboard.press('Escape');assert(!(await page.locator(modal).isVisible()));
  }
  await page.locator('#contactFab').click();await page.locator('#contactFabPopup').waitFor({state:'visible'});const contactVisible=await page.locator('#contactFabPopup').isVisible();
  await page.keyboard.press('Escape');
  const images=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  assert(!overflow);assert.deepEqual(errors,[]);
  await page.screenshot({path:`test-results/audit/site-${width}.png`,fullPage:true});
  results.push({width,errors,overflow,images,theme:'pass',modals:'pass',contact:contactVisible?'pass':'FAIL: icon click closes popup',cubeJump:'present'});
  await page.close();
 }
 await writeFile(process.argv[2]?'docs/commerce/REGRESSION_SITE_TESTS.json':'docs/commerce/BASELINE_SITE_TESTS.json',JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results));
} finally {await browser.close();}
