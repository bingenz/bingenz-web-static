import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { chromium } from 'playwright';
let mf,db;
const origin='https://shop.test',secret='test-only-webhook-signing-secret-for-local-fixtures';
const consumed=new Set();
before(async()=>{
 const bundle=await build({entryPoints:['src/worker.mjs'],bundle:true,format:'esm',platform:'browser',write:false});
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-16',d1Databases:['DB'],r2Buckets:['SIMULATIONS'],
  bindings:{TURNSTILE_SECRET_KEY:'fixture',TURNSTILE_HOSTNAMES:'shop.test',ABUSE_HASH_KEY:secret,SESSION_SECRET:secret,SEPAY_WEBHOOK_SECRET:secret,BANK_ACCOUNT_NUMBER:'test-destination',BANK_CODE:'TPBank'},
  serviceBindings:{ASSETS:async request=>{
   const file=new URL(request.url).pathname.slice(1),types={'commerce.html':'text/html','commerce.mjs':'text/javascript','commerce.css':'text/css','styles.css':'text/css'};
   return types[file]?new Response(await readFile('public/'+file),{headers:{'Content-Type':types[file]}}):new Response('static asset');
  }},
  outboundService:async req=>{
   assert.equal(new URL(req.url).hostname,'challenges.cloudflare.com');
   const b=await req.json(),success=b.response.startsWith('valid-')&&!consumed.has(b.response);consumed.add(b.response);
   return Response.json({success,action:b.response==='valid-wrong-action'?'other':'checkout',hostname:b.response==='valid-wrong-host'?'evil.test':'shop.test'});
  }
 }));
 db=await mf.getD1Database('DB');
 // D1 exec is line-oriented; prepare accepts each complete trigger statement.
 const sql=await readFile('migrations/0001_commerce.sql','utf8');
 const statements=unstable_splitSqlQuery(sql);
 for(const q of statements)await db.prepare(q).run();
 for(const id of ['p','q','inactive']){
  await db.prepare('INSERT INTO products(id,slug,title,created_at,updated_at) VALUES (?,?,?,?,?)').bind(id,id,id,new Date().toISOString(),new Date().toISOString()).run();
  await db.prepare('INSERT INTO product_versions VALUES (?,?,?,?,?,?,?)').bind('v'+id,id,'a'.repeat(64),'original/'+id,'delivery/'+id,123,new Date().toISOString()).run();
  await db.prepare('UPDATE products SET current_version_id=?,active=? WHERE id=?').bind('v'+id,id==='inactive'?0:1,id).run();
 }
});
after(async()=>{await mf?.dispose();});
let ip=0;
function post(path,body,cookie='',extra={}){return mf.dispatchFetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.'+(++ip),Cookie:cookie,...extra},body:JSON.stringify(body)});}
async function checkout(gmail,ids=['p'],cookie=''){
 const response=await post('/api/orders',{gmail,product_ids:ids,turnstile_token:'valid-'+crypto.randomUUID()},cookie);
 return {response,body:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0]||cookie};
}
async function sendPayment(order,overrides={},externalId=Date.now()){
 const body={id:externalId,transferAmount:order.total_vnd,transferType:'in',accountNumber:'test-destination',referenceCode:'ref-'+externalId,code:order.payment_code,gateway:'TPBank',transactionDate:new Date(Date.now()+7*3600000).toISOString().slice(0,19).replace('T',' '),...overrides};
 const raw=JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000));
 return mf.dispatchFetch(origin+'/api/webhooks/sepay',{method:'POST',body:raw,headers:{'X-SePay-Timestamp':timestamp,'X-SePay-Signature':'sha256='+createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex')}});
}
test('real Worker preserves assets, hides protected routes and rejects unauthenticated admin',async()=>{
 assert.equal(await (await mf.dispatchFetch(origin+'/')).text(),'static asset');
 assert.equal((await mf.dispatchFetch(origin+'/runtime/secret')).status,404);
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/orders')).status,503);
 const catalog=await (await mf.dispatchFetch(origin+'/api/catalog')).json();assert.equal(catalog.products.length,2);
 assert.ok(!JSON.stringify(catalog).includes('delivery/'));
});
test('checkout rejects tampering, inactive products, duplicate carts and wrong origin',async()=>{
 const b={gmail:'test@gmail.com',product_ids:['p'],turnstile_token:'valid-'+crypto.randomUUID()};
 assert.equal((await post('/api/orders',{...b,price_vnd:1})).status,400);
 assert.equal((await post('/api/orders',{...b,product_ids:['p','p']})).status,400);
 assert.equal((await checkout('inactive@gmail.com',['inactive'])).response.status,400);
 assert.equal((await post('/api/orders',b,'',{Origin:'https://evil.test'})).status,403);
});
test('pending reuse retains checkout ownership and server price/expiration',async()=>{
 const first=await checkout('Buyer.Name+one@gmail.com');assert.equal(first.response.status,201);assert.equal(first.body.total_vnd,10000);
 assert.ok(Math.abs(Date.parse(first.body.expires_at)-Date.parse(first.body.server_now)-900000)<2000);
 const second=await checkout('buyername+two@gmail.com',['p'],first.cookie);
 assert.equal(second.body.id,first.body.id);assert.equal(second.body.claimable,true);
 const other=await checkout('buyer.name@gmail.com');assert.equal(other.body.id,first.body.id);assert.equal(other.body.claimable,false);
 assert.equal((await mf.dispatchFetch(origin+'/api/orders/'+first.body.id)).status,404);
 const own=await mf.dispatchFetch(origin+'/api/orders/'+first.body.id,{headers:{Cookie:first.cookie}});assert.equal(own.status,200);assert.ok(!(await own.text()).includes('gmail'));
});
test('Turnstile wrong action/host and replay fail closed',async()=>{
 for(const token of ['invalid','valid-wrong-action','valid-wrong-host']){
  const res=await post('/api/orders',{gmail:crypto.randomUUID().replaceAll('-','')+'@gmail.com',product_ids:['p'],turnstile_token:token});
  assert.equal(res.status,400);assert.equal((await res.json()).error,'turnstile_failed');
 }
 const body={gmail:'replay@gmail.com',product_ids:['p'],turnstile_token:'valid-once'};
 assert.equal((await post('/api/orders',body)).status,201);assert.equal((await post('/api/orders',body)).status,400);
});
test('signed payment is atomic, immutable and idempotent in real D1',async()=>{
 const o=await checkout('paid@gmail.com',['p','q']);
 // SePay timestamps have second precision; move fixture creation back a second.
 await db.prepare('UPDATE orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-2000).toISOString(),o.body.id).run();
 const responses=await Promise.all([sendPayment(o.body,{},7001),sendPayment(o.body,{},7001)]);
 assert.ok(responses.every(x=>x.status===200));
 assert.equal((await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.body.id).first()).status,'paid');
 assert.equal((await db.prepare('SELECT count(*) n FROM entitlements WHERE order_id=?').bind(o.body.id).first()).n,2);
 assert.equal((await db.prepare("SELECT count(*) n FROM payments WHERE external_id='7001'").first()).n,1);
});
function sessionCookies(response){return response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
test('claim, token exchange, device binding, atomic independent starts and private R2',async()=>{
 const o=await checkout('access@gmail.com',['p','q']);
 await db.prepare('UPDATE orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-2000).toISOString(),o.body.id).run();
 await sendPayment(o.body,{},7002);
 const c=await post('/api/orders/'+o.body.id+'/claim',{},o.cookie);assert.equal(c.status,200);
 const issued=await c.json(),jar=sessionCookies(c);assert.ok(issued.access_url);
 const stored=await db.prepare('SELECT access_hash FROM orders WHERE id=?').bind(o.body.id).first();assert.ok(!issued.access_url.includes(stored.access_hash));
 assert.equal((await mf.dispatchFetch(issued.access_url,{redirect:'manual'})).status,403);
 const exchanged=await mf.dispatchFetch(issued.access_url,{headers:{Cookie:jar},redirect:'manual'});assert.equal(exchanged.status,303);assert.equal(exchanged.headers.get('Location'),'/access');
 const retry=await post('/api/orders/'+o.body.id+'/claim',{},o.cookie);assert.equal((await retry.json()).already_issued,true);
 const list=await (await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:jar}})).json();assert.equal(list.items.length,2);
 const id=list.items[0].id,secondId=list.items[1].id;
 const starts=await Promise.all([post('/api/entitlements/'+id+'/start',{},jar),post('/api/entitlements/'+id+'/start',{},jar)]);
 const firstStart=await starts[0].json(),secondStart=await starts[1].json();assert.equal(firstStart.expires_at,secondStart.expires_at);
 assert.equal(Date.parse(firstStart.expires_at)-Date.parse(firstStart.started_at),900000);
 assert.equal((await db.prepare('SELECT started_at FROM entitlements WHERE id=?').bind(secondId).first()).started_at,null);
 const bucket=await mf.getR2Bucket('SIMULATIONS');await bucket.put('delivery/p','<html><body>paid source</body></html>');await bucket.put('delivery/q','<html><body>paid source</body></html>');
 const permit=await (await post('/api/entitlements/'+id+'/play',{},jar)).json();
 assert.equal((await mf.dispatchFetch(origin+permit.url)).status,401);
 const delivered=await mf.dispatchFetch(origin+permit.url,{headers:{Cookie:jar}});assert.equal(delivered.status,200);
 assert.match(delivered.headers.get('Content-Security-Policy'),/sandbox allow-scripts/);assert.match(delivered.headers.get('Cache-Control'),/no-store/);
 const html=await delivered.text();assert.ok(html.includes('BGZ-'));assert.ok(!html.includes('gmail'));
 await db.prepare("UPDATE entitlements SET status='revoked' WHERE id=?").bind(id).run();
 assert.equal((await mf.dispatchFetch(origin+permit.url,{headers:{Cookie:jar}})).status,410);
 await db.prepare('UPDATE orders SET generation=generation+1,access_hash=NULL,device_hash=NULL WHERE id=?').bind(o.body.id).run();
 assert.equal((await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:jar}})).status,401);
 assert.equal((await mf.dispatchFetch(issued.access_url,{headers:{Cookie:jar},redirect:'manual'})).status,404);
});
test('payment mismatch cases remain unfulfilled and invalid HMAC does not persist',async()=>{
 const cases=[['underpaid',{transferAmount:9999}],['overpaid',{transferAmount:10001}],['wrong_bank',{accountNumber:'other'}],['outgoing',{transferType:'out'}],['unknown_code',{code:'BGZ222222222222'}],['late',{transactionDate:'2020-01-01 00:00:00'}]];
 for(let i=0;i<cases.length;i++){
  const [status,override]=cases[i],o=await checkout('case'+i+'@gmail.com');
  await db.prepare('UPDATE orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-2000).toISOString(),o.body.id).run();
  assert.equal((await sendPayment(o.body,override,8000+i)).status,200);
  assert.equal((await db.prepare('SELECT status FROM payments WHERE external_id=?').bind(String(8000+i)).first()).status,status);
  assert.equal((await db.prepare('SELECT count(*) n FROM entitlements WHERE order_id=?').bind(o.body.id).first()).n,0);
 }
 const before=await db.prepare('SELECT count(*) n FROM payments').first();
 assert.equal((await mf.dispatchFetch(origin+'/api/webhooks/sepay',{method:'POST',body:'{}'})).status,401);
 assert.equal((await db.prepare('SELECT count(*) n FROM payments').first()).n,before.n);
});
test('browser paid-access claim, Start confirmation and sandbox runtime work together',async()=>{
 const o=await checkout('browser@gmail.com');
 await db.prepare('UPDATE orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-2000).toISOString(),o.body.id).run();await sendPayment(o.body,{},9001);
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const local=(await mf.ready).origin;
  const [name,value]=o.cookie.split('=');await page.context().addCookies([{name,value,domain:new URL(local).hostname,path:'/',secure:true,httpOnly:true,sameSite:'Strict'}]);
  await page.goto(local+'/checkout/'+o.body.id);await page.locator('[data-start]').waitFor();
  assert.equal(new URL(page.url()).pathname,'/access');assert.equal(await page.locator('#copy-access').count(),1);
  await page.locator('[data-start]').click();await page.locator('dialog').waitFor();await page.locator('#cancel-start').click();
  assert.equal((await db.prepare('SELECT started_at FROM entitlements WHERE order_id=?').bind(o.body.id).first()).started_at,null);
  await page.locator('[data-start]').click();await page.locator('#confirm-start').click();await page.locator('iframe').waitFor();
  assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
  await page.frameLocator('iframe').locator('#bgz-license').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

