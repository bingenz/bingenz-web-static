import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base='https://bingenz-commerce-preview.lnth.workers.dev';
const manifest=JSON.parse(await readFile('.private/products/manifest.json','utf8'));
const catalogResponse=await fetch(base+'/api/catalog');assert.equal(catalogResponse.status,200);
const catalog=await catalogResponse.json();assert.equal(catalog.products.length,35);
const image=await fetch(base+catalog.products[0].thumbnail);assert.equal(image.status,200);assert.match(image.headers.get('Content-Type'),/^image\/webp/);
const privateObject=await fetch(base+'/'+manifest.items[0].delivery_key,{redirect:'manual'});assert.equal(privateObject.status,404);
for(const [path,status] of [['/admin.html',404],['/api/access',401],['/access/recovery',200],['/checkout/11111111-1111-1111-1111-111111111111',200]]){
 const response=await fetch(base+path,{redirect:'manual'});assert.equal(response.status,status,path);
}
const admin=await fetch(base+'/admin',{redirect:'manual'});
assert.ok([401,403,503].includes(admin.status),`/admin must fail closed, got ${admin.status}`);
const invalid=await fetch(base+'/access/'+'A'.repeat(43),{redirect:'manual'});
assert.equal(invalid.status,303);assert.equal(invalid.headers.get('Location'),'/access/recovery');
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/');await page.locator('#product-grid .product-card').first().waitFor();
 assert.equal(await page.locator('#product-grid .product-card').count(),35);
 assert.equal(await page.locator('#product-grid').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length),2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto(base+'/access/recovery');
 assert.match(await page.locator('#commerce-content').innerText(),/Liên hệ hỗ trợ/);
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
console.log('PASS: isolated preview catalog 35, mobile storefront, private R2 denial, recovery shell, admin fail-closed; no provider/payment flow exercised.');
