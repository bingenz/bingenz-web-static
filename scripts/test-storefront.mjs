import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch(),results=[];await mkdir('test-results/storefront',{recursive:true});
try{for(const width of [1440,390,360]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('[data-add]').first().waitFor();
 assert.equal(await page.locator('.product-card').count(),35);
 assert.equal(await page.locator('#cube-jump').evaluate(n=>n.nextElementSibling.id),'store');
 if(width<=600)assert.equal(await page.locator('#product-grid').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('[data-add]').first().click();assert.equal(await page.locator('[data-add]').first().isDisabled(),true);
 await page.locator('#shop-cart').click();await page.locator('dialog').waitFor();assert.equal(await page.locator('.cart-line').count(),1);
 await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.locator('dialog').count(),0);
 assert.equal(await page.locator('#shop-cart').evaluate(n=>n===document.activeElement),true);
 await page.reload();await page.locator('[data-add]').first().waitFor();assert.equal(await page.locator('#shop-cart').textContent(),'Giỏ hàng (1)');
 await page.locator('#shop-cart').click();await page.locator('[data-remove]').click();assert.match(await page.locator('#cart-content').textContent(),/đang trống/);await page.keyboard.press('Escape');
 await page.locator('#shop-search').fill('Quick Sort');assert.equal(await page.locator('.product-card').count(),1);await page.locator('#shop-search').fill('');
 await page.locator('#store').scrollIntoViewIfNeeded();await page.waitForTimeout(400);await page.screenshot({path:`test-results/storefront/${width}-light.png`});
 await page.locator('#themeToggleBtn').click();await page.locator('#store').scrollIntoViewIfNeeded();await page.waitForTimeout(400);await page.screenshot({path:`test-results/storefront/${width}-dark.png`});
 assert.deepEqual(errors,[]);results.push({width,products:35,columns:width<=600?2:4,cart:'pass',keyboard:'pass',overflow:false,errors});await page.close();
}}finally{await browser.close();}
await writeFile('docs/commerce/STOREFRONT_TESTS.json',JSON.stringify(results,null,2)+'\n');console.log(results);


