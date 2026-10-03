import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const plans=[['account-1',1,79000],['account-3',3,219000],['account-6',6,399000],['personal-12',12,995000],['personal-18',18,1299000]].map(([id,months,price_vnd])=>({id,months,price_vnd,title:'Gemini Pro · '+(id.startsWith('account')?'Cấp tài khoản':'Nâng chính chủ')+' · '+months+' tháng'}));
const id='11111111-1111-1111-1111-111111111111';
async function fixture(page){
 let order,status='pending',submitted;
 await page.addInitScript(()=>{window.turnstile={render:(el,options)=>{setTimeout(()=>options.callback('fixture-token'),0);return 'widget';},remove:()=>{},reset:()=>{}};});
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(url.hostname!=='localhost')return route.fulfill({status:204,body:''});
  if(path==='/api/catalog')return route.fulfill({json:{products:[]}});
  if(path==='/api/gemini/plans')return route.fulfill({json:{plans,turnstile_site_key:'fixture'}});
  if(path==='/api/orders'&&request.method()==='POST'){
   submitted=request.postDataJSON();const plan=plans.find(p=>p.id===submitted.plan_id);
   order={id,kind:'gemini',payment_code:'BGZ23456789ABCD',total_vnd:plan.price_vnd,claimable:true,expires_at:new Date(Date.now()+900000).toISOString(),items:[plan]};
   return route.fulfill({status:201,json:order});
  }
  if(path==='/api/orders/'+id)return route.fulfill({json:{...order,status,server_now:new Date().toISOString(),...(status==='pending'?{payment_destination:{bank_code:'TPBank',account_name:'LOCAL TEST',account_number:'0000000000'}}:{})}});
  if(path==='/api/orders/'+id+'/qr')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="black"/></svg>'});
  try{
   const file=path==='/'?'index.html':path.slice(1);
   const type=file.endsWith('.svg')?'image/svg+xml':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.jpg')?'image/jpeg':'text/html';
   return route.fulfill({contentType:type,body:await readFile('public/'+file)});
  }catch{return route.fulfill({status:404,body:''});}
 });
 return {paid:()=>{status='paid';},expired:()=>{status='expired';},submitted:()=>submitted};
}
test('Gemini responsive cards, supplied icons, selectors, checkout, paid support and resume',async()=>{
 const browser=await chromium.launch();await mkdir('test-results/gemini',{recursive:true});
 try{
  for(const width of [1440,390,360]){
   const page=await browser.newPage({viewport:{width,height:1000},permissions:['clipboard-read','clipboard-write']});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=await fixture(page);
   await page.goto('http://localhost/');
   assert.equal(await page.locator('#cube-jump + #gemini-pro').count(),1);
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.locator('#gemini-pro').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('.gemini-product-icons img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
    await page.locator('#gemini-pro').screenshot({path:`test-results/gemini/cards-${width}-${theme}.png`,style:".topbar,.bottom-bar{visibility:hidden!important}"});
   }
   const account=page.locator('[data-gemini-category="account"]'),premium=page.locator('[data-gemini-category="personal"]');
   for(const plan of plans){const card=plan.id.startsWith('account')?account:premium;await card.locator('label').filter({has:page.locator('input[value="'+plan.id+'"]')}).click();assert.equal(await card.locator('[data-gemini-price]').textContent(),new Intl.NumberFormat('vi-VN').format(plan.price_vnd)+'đ');}
   await page.locator('.gemini-support [data-gemini-copy]').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'0898908101');
   await premium.locator('[data-gemini-buy]').click();
   await page.locator('#gemini-email').fill('customer@gmail.com');await page.getByRole('button',{name:'Tạo mã QR thanh toán'}).click();
   await page.locator('.gemini-qr').waitFor();assert.equal(f.submitted().plan_id,'personal-18');
   assert.equal(await page.locator('#gemini-selected-price').textContent(),'1.299.000đ');
   assert.equal(await page.locator('#gemini-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   await page.locator('#gemini-dialog').screenshot({path:`test-results/gemini/checkout-${width}.png`});
   f.paid();await page.waitForFunction(()=>document.querySelector('#gemini-payment-state').textContent.includes('Đã thanh toán'),{},{timeout:12000});
   assert.equal(await page.locator('.gemini-qr').count(),0);
   assert.equal(await page.locator('.gemini-zalo-link').getAttribute('href'),'https://zalo.me/0898908101');
   await page.locator('#gemini-order-code button').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'BGZ23456789ABCD');
   await page.keyboard.press('Escape');assert.equal(await premium.locator('[data-gemini-buy]').evaluate(el=>el===document.activeElement),true);
   await page.reload();await page.locator('#gemini-resume').click();await page.locator('.gemini-success').waitFor();
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
});
test('Expired Gemini order removes QR and reduced-motion disables premium effects',async()=>{
 const browser=await chromium.launch();try{
  const page=await browser.newPage({viewport:{width:360,height:800},reducedMotion:'reduce'});const f=await fixture(page);await page.goto('http://localhost/');
  assert.equal(await page.locator('.gemini-premium').evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
  await page.locator('[data-gemini-buy]').first().click();await page.locator('#gemini-email').fill('expired@gmail.com');await page.getByRole('button',{name:'Tạo mã QR thanh toán'}).click();await page.locator('.gemini-qr').waitFor();
  f.expired();await page.waitForFunction(()=>document.querySelector('#gemini-payment-state').textContent.includes('hết thời gian'),{},{timeout:12000});assert.equal(await page.locator('.gemini-qr').count(),0);
  await page.keyboard.press('Escape');
 }finally{await browser.close();}
});
