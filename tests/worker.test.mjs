import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac,createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { chromium } from 'playwright';
import { transform } from '../scripts/prepare-products.mjs';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
let mf,db,adminKey,adminJwk;
const origin='https://shop.test',secret='test-only-webhook-signing-secret-for-local-fixtures';
const consumed=new Set();
before(async()=>{
 const keys=await generateKeyPair('RS256');adminKey=keys.privateKey;adminJwk={...await exportJWK(keys.publicKey),kid:'local-admin-test',alg:'RS256',use:'sig'};
 const bundle=await build({entryPoints:['src/worker.mjs'],bundle:true,format:'esm',platform:'browser',write:false});
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-16',d1Databases:['DB'],r2Buckets:['SIMULATIONS'],
  bindings:{TURNSTILE_SECRET_KEY:'fixture',TURNSTILE_HOSTNAMES:'shop.test',ABUSE_HASH_KEY:secret,SESSION_SECRET:secret,SEPAY_WEBHOOK_SECRET:secret,BANK_ACCOUNT_NUMBER:'test-destination',BANK_CODE:'TPBank',ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'local-admin-aud',ADMIN_EMAIL:'lengocthuan09@gmail.com'},
  serviceBindings:{ASSETS:async request=>{
   const file=new URL(request.url).pathname.slice(1),types={'commerce.html':'text/html','commerce.mjs':'text/javascript','commerce.css':'text/css','admin.html':'text/html','admin.mjs':'text/javascript','admin.css':'text/css','styles.css':'text/css'};
   return types[file]?new Response(await readFile('public/'+file),{headers:{'Content-Type':types[file]}}):new Response('static asset');
  }},
  outboundService:async req=>{
   if(new URL(req.url).hostname==='test.cloudflareaccess.com')return Response.json({keys:[adminJwk]});
   if(new URL(req.url).hostname==='qr.sepay.vn'){
    const url=new URL(req.url);
    assert.equal(url.searchParams.get('bank'),'TPBank');
    assert.equal(url.searchParams.get('acc'),'test-destination');
    assert.match(url.searchParams.get('des'),/^BGZ[A-Z0-9]{12}$/);
    return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="black"/></svg>',{headers:{'Content-Type':'image/svg+xml'}});
   }
   assert.equal(new URL(req.url).hostname,'challenges.cloudflare.com');
   const b=await req.json(),success=b.response.startsWith('valid-')&&!consumed.has(b.response);consumed.add(b.response);
   return Response.json({success,action:b.response==='valid-wrong-action'?'other':'checkout',hostname:b.response==='valid-wrong-host'?'evil.test':'shop.test'});
  }
 }));
 db=await mf.getD1Database('DB');
 // D1 exec is line-oriented; prepare accepts each complete trigger statement.
 for(const file of ['0001_commerce.sql','0002_import_state.sql','0003_payment_second_precision.sql']){
  const statements=unstable_splitSqlQuery(await readFile('migrations/'+file,'utf8'));
  for(const q of statements)await db.prepare(q).run();
 }
 for(const id of ['p','q','inactive']){
  await db.prepare('INSERT INTO products(id,slug,title,created_at,updated_at) VALUES (?,?,?,?,?)').bind(id,id,id,new Date().toISOString(),new Date().toISOString()).run();
  await db.prepare('INSERT INTO product_versions VALUES (?,?,?,?,?,?,?)').bind('v'+id,id,'a'.repeat(64),'original/'+id,'delivery/'+id,123,new Date().toISOString()).run();
  await db.prepare('UPDATE products SET current_version_id=?,active=? WHERE id=?').bind('v'+id,id==='inactive'?0:1,id).run();
 }
});
after(async()=>{await mf?.dispose();});
let ip=0;
function post(path,body,cookie='',extra={}){return mf.dispatchFetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.'+(++ip),Cookie:cookie,...extra},body:JSON.stringify(body)});}
async function adminToken(email='lengocthuan09@gmail.com',aud='local-admin-aud'){
 return new SignJWT({email,type:'app'}).setProtectedHeader({alg:'RS256',kid:'local-admin-test'}).setIssuer('https://test.cloudflareaccess.com').setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(adminKey);
}
async function checkout(gmail,ids=['p'],cookie=''){
 const response=await post('/api/orders',{gmail,product_ids:ids,turnstile_token:'valid-'+crypto.randomUUID()},cookie);
 return {response,body:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0]||cookie};
}
async function sendPayment(order,overrides={},externalId=Date.now()){
 const body={id:externalId,transferAmount:order.total_vnd,transferType:'in',accountNumber:'test-destination',referenceCode:'ref-'+externalId,code:order.payment_code,gateway:'TPBank',transactionDate:new Date(Date.now()+7*3600000).toISOString().slice(0,19).replace('T',' '),...overrides};
 const raw=JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000));
 return mf.dispatchFetch(origin+'/api/webhook/sepay',{method:'POST',body:raw,headers:{'X-SePay-Timestamp':timestamp,'X-SePay-Signature':'sha256='+createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex')}});
}
test('real Worker preserves assets, hides protected routes and rejects unauthenticated admin',async()=>{
 assert.equal(await (await mf.dispatchFetch(origin+'/')).text(),'static asset');
 assert.equal((await mf.dispatchFetch(origin+'/runtime/secret')).status,404);
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/orders')).status,403);
 assert.equal((await mf.dispatchFetch(origin+'/admin.html')).status,404);
 const catalog=await (await mf.dispatchFetch(origin+'/api/catalog')).json();assert.equal(catalog.products.length,2);
 assert.ok(!JSON.stringify(catalog).includes('delivery/'));
});
test('admin requires a signed exact-identity Access JWT and audits product edits',async()=>{
 const url=origin+'/admin/api/products/p';
 for(const token of [await adminToken('someone@gmail.com'),await adminToken('lengocthuan09@gmail.com','wrong-aud'),'forged']){
  assert.equal((await mf.dispatchFetch(url,{headers:{'Cf-Access-Jwt-Assertion':token}})).status,403);
 }
 const token=await adminToken(),headers={'Cf-Access-Jwt-Assertion':token};
 const dashboard=await mf.dispatchFetch(origin+'/admin/api/dashboard',{headers});assert.equal(dashboard.status,200);
 const page=await mf.dispatchFetch(origin+'/admin',{headers});assert.equal(page.status,200);assert.match(await page.text(),/Quản trị mô phỏng/);
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products',{headers})).status,200);
 const draft={method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({title:'Draft',slug:'new-draft',price_vnd:10000})};
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products',{...draft,headers:{...draft.headers,Origin:'https://evil.test'}})).status,403);
 const created=await mf.dispatchFetch(origin+'/admin/api/products',draft);assert.equal(created.status,201);
 const draftBody=await created.json();assert.equal(draftBody.product.active,0);assert.equal(draftBody.product.current_version_id,null);
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products',draft)).status,409);
 const emptyDraft=await mf.dispatchFetch(origin+'/admin/api/products',{...draft,body:JSON.stringify({title:'Disposable draft',slug:'disposable-draft',price_vnd:10000})});assert.equal(emptyDraft.status,201);
 const emptyId=(await emptyDraft.json()).product.id;
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products/'+emptyId,{method:'DELETE',headers:{...headers,Origin:origin}})).status,200);
 assert.equal((await db.prepare('SELECT count(*) n FROM products WHERE id=?').bind(emptyId).first()).n,0);
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE object_id=? AND action='product.delete'").bind(emptyId).first()).n,1);
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products/p',{method:'DELETE',headers:{...headers,Origin:origin}})).status,409);
 assert.equal((await db.prepare('SELECT count(*) n FROM admin_audit_logs WHERE action=? AND object_id=?').bind('product.create',draftBody.product.id).first()).n,1);
 assert.equal((await mf.dispatchFetch(origin+'/api/catalog')).status,200);
 assert.ok(!(await (await mf.dispatchFetch(origin+'/api/catalog')).text()).includes('new-draft'));
 const bulk={method:'PATCH',headers:{...headers,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ids:['p','q',draftBody.product.id],changes:{price_vnd:12000}})};
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products/bulk',{...bulk,body:JSON.stringify({ids:['p','p'],changes:{price_vnd:1}})})).status,400);
 const bulkResult=await (await mf.dispatchFetch(origin+'/admin/api/products/bulk',bulk)).json();assert.deepEqual(bulkResult.updated,['p','q',draftBody.product.id]);
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE action='product.bulk_update'").first()).n,3);
 const noVersion=await (await mf.dispatchFetch(origin+'/admin/api/products/bulk',{...bulk,body:JSON.stringify({ids:[draftBody.product.id],changes:{active:1}})})).json();assert.deepEqual(noVersion.skipped,[draftBody.product.id]);
 assert.equal((await db.prepare('SELECT active FROM products WHERE id=?').bind(draftBody.product.id).first()).active,0);
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products/bulk',{...bulk,body:JSON.stringify({ids:['p','q',draftBody.product.id],changes:{price_vnd:10000}})})).status,200);
 const original=Buffer.from('<!doctype html><html><body><!--development--><h1>Private test</h1><script>const value = 2 + 2; document.body.dataset.value = value;</script></body></html>');
 const delivery=Buffer.from(await transform(original.toString('utf8')));
 assert.ok(!delivery.toString().includes('development'));
 const digest=b=>createHash('sha256').update(b).digest('hex');
 const pkg={format:'bingenz-admin-html-v1',sha256:digest(original),delivery_sha256:digest(delivery),original_base64:original.toString('base64'),delivery_base64:delivery.toString('base64')};
 const uploadUrl=origin+'/admin/api/products/'+draftBody.product.id+'/upload',upload={method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(pkg)};
 assert.equal((await mf.dispatchFetch(uploadUrl,{...upload,body:JSON.stringify({...pkg,sha256:'a'.repeat(64)})})).status,400);
 const uploaded=await mf.dispatchFetch(uploadUrl,upload);assert.equal(uploaded.status,201);
 const version=(await uploaded.json()).version_id;
 assert.equal((await mf.dispatchFetch(uploadUrl,upload)).status,200);
 assert.equal((await db.prepare('SELECT current_version_id FROM products WHERE id=?').bind(draftBody.product.id).first()).current_version_id,version);
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products/'+draftBody.product.id,{method:'DELETE',headers:{...headers,Origin:origin}})).status,409);
 const stored=await db.prepare('SELECT original_key,delivery_key FROM product_versions WHERE id=?').bind(version).first();
 const privateBucket=await mf.getR2Bucket('SIMULATIONS');assert.ok(await privateBucket.head(stored.original_key));assert.ok(await privateBucket.head(stored.delivery_key));
 const previewUrl=origin+'/admin/api/products/'+draftBody.product.id+'/versions/'+version+'/preview';
 assert.equal((await mf.dispatchFetch(previewUrl)).status,403);
 const preview=await mf.dispatchFetch(previewUrl,{headers});assert.equal(preview.status,200);
 assert.match(preview.headers.get('Content-Security-Policy'),/sandbox allow-scripts/);
 assert.match(preview.headers.get('Cache-Control'),/no-store/);
 assert.equal(await preview.text(),delivery.toString());
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products/p/versions/'+version+'/preview',{headers})).status,404);
 assert.equal((await mf.dispatchFetch(origin+'/'+stored.delivery_key)).status,200); // Static asset fallback contains no paid source.
 assert.notEqual(await (await mf.dispatchFetch(origin+'/'+stored.delivery_key)).text(),delivery.toString());
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE action='product.upload' AND object_id=?").bind(draftBody.product.id).first()).n,1);
 const images=await readFile('docs/commerce/PREPARED_PRODUCTS.json','utf8'),imagePath='public'+JSON.parse(images)[0].thumbnail,imageBytes=await readFile(imagePath);
 const imageUrl=origin+'/admin/api/products/'+draftBody.product.id+'/thumbnail';
 const imageResponse=await mf.dispatchFetch(imageUrl,{method:'PUT',headers:{...headers,Origin:origin,'Content-Type':'image/webp'},body:imageBytes});assert.equal(imageResponse.status,200);
 const publicImage=(await imageResponse.json()).thumbnail;
 assert.equal((await mf.dispatchFetch(origin+publicImage)).status,200);
 assert.equal((await mf.dispatchFetch(origin+publicImage.replace(draftBody.product.id,'other'))).status,404);
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE action='product.thumbnail' AND object_id=?").bind(draftBody.product.id).first()).n,1);
 assert.equal((await mf.dispatchFetch(imageUrl,{method:'PUT',headers:{...headers,Origin:origin,'Content-Type':'image/webp'},body:Buffer.from('fake')})).status,400);
 const patch={method:'PATCH',headers:{...headers,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({price_vnd:12000,title:'Updated product'})};
 assert.equal((await mf.dispatchFetch(url,{...patch,headers:{...patch.headers,Origin:'https://evil.test'}})).status,403);
 const changed=await mf.dispatchFetch(url,patch);assert.equal(changed.status,200);
 assert.equal((await db.prepare('SELECT price_vnd FROM products WHERE id=?').bind('p').first()).price_vnd,12000);
 const audit=await db.prepare("SELECT actor,action,metadata FROM admin_audit_logs WHERE object_id='p' AND action='product.update'").first();
 assert.equal(audit.actor,'lengocthuan09@gmail.com');assert.equal(audit.action,'product.update');assert.equal(JSON.parse(audit.metadata).after.price_vnd,12000);
 assert.equal((await mf.dispatchFetch(url,{...patch,body:JSON.stringify({current_version_id:'vp'})})).status,400);
 assert.equal((await mf.dispatchFetch(url,{...patch,body:JSON.stringify({price_vnd:10000,title:'p'})})).status,200);
 await db.prepare('INSERT INTO product_versions VALUES (?,?,?,?,?,?,?)').bind('vp2','p','b'.repeat(64),'original/p2','delivery/p2',120,new Date().toISOString()).run();
 const versions=await (await mf.dispatchFetch(url+'/versions',{headers})).json();assert.equal(versions.versions.length,2);
 const rollback={method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({version_id:'vp2'})};
 assert.equal((await mf.dispatchFetch(url+'/versions',{...rollback,body:JSON.stringify({version_id:'vq'})})).status,404);
 assert.equal((await mf.dispatchFetch(url+'/versions',rollback)).status,200);
 assert.equal((await db.prepare('SELECT current_version_id FROM products WHERE id=?').bind('p').first()).current_version_id,'vp2');
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE action='product.rollback' AND object_id='p'").first()).n,1);
 assert.equal((await mf.dispatchFetch(url+'/versions',{...rollback,body:JSON.stringify({version_id:'vp'})})).status,200);
 const results=await (await mf.dispatchFetch(origin+'/admin/api/orders?q=paid%40gmail.com',{headers})).json();
 assert.ok(Array.isArray(results.orders));
 await db.prepare('INSERT INTO products(id,slug,title,created_at,updated_at) VALUES (?,?,?,?,?)').bind('sim_test','sim-test','Test',new Date().toISOString(),new Date().toISOString()).run();
 await db.prepare('INSERT INTO product_versions VALUES (?,?,?,?,?,?,?)').bind('ver_test','sim_test','c'.repeat(64),'original/test','delivery/test',120,new Date().toISOString()).run();
 await db.prepare('UPDATE products SET current_version_id=? WHERE id=?').bind('ver_test','sim_test').run();
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products/sim_test/versions',{headers})).status,200);
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/products/sim_test/versions',{...rollback,body:JSON.stringify({version_id:'ver_test'})})).status,200);
});
test('admin dashboard and product editor render in a browser with signed Access identity',async()=>{
 const browser=await chromium.launch();
 try{
  const token=await adminToken(),page=await browser.newPage({extraHTTPHeaders:{'Cf-Access-Jwt-Assertion':token},viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const local=(await mf.ready).origin;
  await page.goto(local+'/admin');await page.locator('#product-list option').first().waitFor({state:'attached'});
  assert.ok(await page.locator('#metrics article').count()>=8);
  const previewProduct=await db.prepare("SELECT id FROM products WHERE slug='new-draft'").first();
  await page.locator('#product-list').selectOption(previewProduct.id);
  await page.locator('#versions option').first().waitFor({state:'attached'});
  await page.locator('#preview-version').click();await page.locator('#preview-dialog').waitFor({state:'visible'});
  assert.equal(await page.frameLocator('#preview-frame').locator('h1').textContent(),'Private test');
  await page.locator('#close-preview').click();await page.locator('#preview-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.querySelector('#preview-frame').hasAttribute('src'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
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
 const adminHeaders={'Cf-Access-Jwt-Assertion':await adminToken()};
 const detail=await (await mf.dispatchFetch(origin+'/admin/api/orders/'+o.body.id,{headers:adminHeaders})).json();
 assert.equal(detail.order.status,'paid');assert.equal(detail.items.length,2);assert.equal(detail.items[0].price_vnd,10000);assert.equal(detail.payments[0].external_id,'7001');
 assert.ok(!JSON.stringify(detail).includes('checkout_hash'));assert.ok(!JSON.stringify(detail).includes('access_hash'));assert.ok(!JSON.stringify(detail).includes('device_hash'));
 const found=await (await mf.dispatchFetch(origin+'/admin/api/orders?q='+encodeURIComponent(o.body.payment_code),{headers:adminHeaders})).json();assert.ok(found.orders.some(row=>row.id===o.body.id));
 for(const query of ['ref-7001',detail.order.created_at.slice(0,10),'paid@gmail.com']){
  const result=await (await mf.dispatchFetch(origin+'/admin/api/orders?q='+encodeURIComponent(query),{headers:adminHeaders})).json();assert.ok(result.orders.some(row=>row.id===o.body.id));
 }
});
test('SePay second-precision timestamp matches an order created in that same second',async()=>{
 const o=await checkout('samesecond@gmail.com');assert.equal(o.response.status,201);
 const created=await db.prepare('SELECT created_at FROM orders WHERE id=?').bind(o.body.id).first();
 const vietnamTime=ms=>new Date(ms+7*3600000).toISOString().slice(0,19).replace('T',' ');
 const second=Date.parse(created.created_at);
 assert.equal((await sendPayment(o.body,{transactionDate:vietnamTime(second)},9012)).status,200);
 assert.equal((await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.body.id).first()).status,'paid');
 const earlier=await checkout('previoussecond@gmail.com');assert.equal(earlier.response.status,201);
 const prior=await db.prepare('SELECT created_at FROM orders WHERE id=?').bind(earlier.body.id).first();
 assert.equal((await sendPayment(earlier.body,{transactionDate:vietnamTime(Date.parse(prior.created_at)-1000)},9013)).status,200);
 assert.equal((await db.prepare('SELECT status FROM payments WHERE external_id=?').bind('9013').first()).status,'late');
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
 const adminHeaders={'Cf-Access-Jwt-Assertion':await adminToken(),Origin:origin,'Content-Type':'application/json'};
 const action=(path,body)=>mf.dispatchFetch(origin+'/admin/api/orders/'+o.body.id+path,{method:'POST',headers:adminHeaders,body:JSON.stringify(body)});
 assert.equal((await action('/notes',{note:' ' })).status,400);
 assert.equal((await action('/notes',{note:'Customer contacted support.'})).status,201);
 assert.equal((await action('/reissue',{note:'Confirmed by email',reset_device:true,customer_verified:false})).status,400);
 const reissued=await action('/reissue',{note:'Verified customer outside the site',reset_device:false,customer_verified:true});assert.equal(reissued.status,200);
 const replacement=(await reissued.json()).access_url;
 assert.ok(replacement&&replacement!==issued.access_url);
 const details=await (await mf.dispatchFetch(origin+'/admin/api/orders/'+o.body.id,{headers:adminHeaders})).json();
 assert.equal(details.order.device_bound,1);assert.equal(details.notes.length,2);
 assert.ok(details.notes.some(n=>n.note==='Verified customer outside the site'));
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE object_id=? AND action='access.reissue'").bind(o.body.id).first()).n,1);
 assert.equal((await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:jar}})).status,401);
 assert.equal((await mf.dispatchFetch(issued.access_url,{headers:{Cookie:jar},redirect:'manual'})).status,404);
 assert.equal((await mf.dispatchFetch(replacement,{redirect:'manual'})).status,403);
 const recovered=await mf.dispatchFetch(replacement,{headers:{Cookie:jar},redirect:'manual'});assert.equal(recovered.status,303);
 const recoveredJar=sessionCookies(recovered);assert.equal((await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:recoveredJar}})).status,200);
 const reset=await action('/reissue',{note:'Verified on support call; device lost',reset_device:true,customer_verified:true});assert.equal(reset.status,200);
 const resetUrl=(await reset.json()).access_url;
 assert.equal((await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:recoveredJar}})).status,401);
 assert.equal((await mf.dispatchFetch(replacement,{headers:{Cookie:recoveredJar},redirect:'manual'})).status,404);
 const fresh=await mf.dispatchFetch(resetUrl,{redirect:'manual'});assert.equal(fresh.status,303);
 assert.equal((await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:sessionCookies(fresh)}})).status,200);
 assert.equal((await db.prepare('SELECT device_hash FROM orders WHERE id=?').bind(o.body.id).first()).device_hash!==null,true);
});
test('activation deadline and active runtime expire independently on the server',async()=>{
 const o=await checkout('deadlinefixture@gmail.com',['p','q']);assert.equal(o.response.status,201);
 await db.prepare('UPDATE orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-2000).toISOString(),o.body.id).run();
 assert.equal((await sendPayment(o.body,{},9101)).status,200);
 const claimed=await post('/api/orders/'+o.body.id+'/claim',{},o.cookie);assert.equal(claimed.status,200);
 const jar=sessionCookies(claimed),initial=await (await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:jar}})).json();
 const [expiredBeforeStart,active]=initial.items;
 await db.prepare('UPDATE entitlements SET activation_deadline=? WHERE id=?').bind(new Date(Date.now()-1000).toISOString(),expiredBeforeStart.id).run();
 const list=await (await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:jar}})).json();
 assert.equal(list.items.find(e=>e.id===expiredBeforeStart.id).status,'activation_expired');
 assert.equal(list.items.find(e=>e.id===active.id).status,'not_started');
 assert.equal((await post('/api/entitlements/'+expiredBeforeStart.id+'/start',{},jar)).status,410);
 assert.equal((await db.prepare('SELECT started_at FROM entitlements WHERE id=?').bind(expiredBeforeStart.id).first()).started_at,null);
 const started=await post('/api/entitlements/'+active.id+'/start',{},jar);assert.equal(started.status,200);
 const permit=await (await post('/api/entitlements/'+active.id+'/play',{},jar)).json();
 const bucket=await mf.getR2Bucket('SIMULATIONS');await bucket.put('delivery/q','<html><body>deadline fixture</body></html>');
 assert.equal((await mf.dispatchFetch(origin+permit.url,{headers:{Cookie:jar}})).status,200);
 await db.prepare('UPDATE entitlements SET started_at=?,expires_at=? WHERE id=?').bind(new Date(Date.now()-20*60000).toISOString(),new Date(Date.now()-5*60000).toISOString(),active.id).run();
 assert.equal((await (await mf.dispatchFetch(origin+'/api/access',{headers:{Cookie:jar}})).json()).items.find(e=>e.id===active.id).status,'expired');
 assert.equal((await post('/api/entitlements/'+active.id+'/start',{},jar)).status,410);
 assert.equal((await post('/api/entitlements/'+active.id+'/play',{},jar)).status,410);
 assert.equal((await mf.dispatchFetch(origin+permit.url,{headers:{Cookie:jar}})).status,410);
});
test('expired unpaid checkout cannot serve QR or become paid from a late transfer',async()=>{
 const o=await checkout('expiredcheckout@gmail.com');assert.equal(o.response.status,201);
 const before=(await mf.dispatchFetch(origin+'/api/orders/'+o.body.id,{headers:{Cookie:o.cookie}}));assert.equal((await before.json()).status,'pending');
 await db.prepare('UPDATE orders SET created_at=?,expires_at=? WHERE id=?').bind(new Date(Date.now()-20*60000).toISOString(),new Date(Date.now()-5*60000).toISOString(),o.body.id).run();
 const status=await mf.dispatchFetch(origin+'/api/orders/'+o.body.id,{headers:{Cookie:o.cookie}});assert.equal((await status.json()).status,'expired');
 assert.equal((await mf.dispatchFetch(origin+'/api/orders/'+o.body.id+'/qr',{headers:{Cookie:o.cookie}})).status,410);
 assert.equal((await sendPayment(o.body,{},9102)).status,200);
 assert.equal((await db.prepare('SELECT status FROM payments WHERE external_id=?').bind('9102').first()).status,'late');
 assert.equal((await db.prepare('SELECT count(*) n FROM entitlements WHERE order_id=?').bind(o.body.id).first()).n,0);
 assert.equal((await post('/api/orders/'+o.body.id+'/claim',{},o.cookie)).status,409);
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
 assert.equal((await mf.dispatchFetch(origin+'/api/webhook/sepay',{method:'POST',body:'{}'})).status,401);
 assert.equal((await mf.dispatchFetch(origin+'/api/webhooks/sepay',{method:'POST',body:'{}'})).status,404);
 assert.equal((await db.prepare('SELECT count(*) n FROM payments').first()).n,before.n);
});
test('admin reconciliation requires explicit review, sufficient valid funds and audit',async()=>{
 const headers={'Cf-Access-Jwt-Assertion':await adminToken(),Origin:origin,'Content-Type':'application/json'};
 const listed=await (await mf.dispatchFetch(origin+'/admin/api/payments',{headers})).json();
 const over=listed.payments.find(p=>p.external_id==='8001'),under=listed.payments.find(p=>p.external_id==='8000'),wrong=listed.payments.find(p=>p.external_id==='8002'),unknown=listed.payments.find(p=>p.external_id==='8004');
 assert.ok(over&&under&&wrong&&unknown);assert.equal(unknown.order_id,null);
 const action=(payment,body)=>mf.dispatchFetch(origin+'/admin/api/payments/'+payment.id+'/reconcile',{method:'POST',headers,body:JSON.stringify(body)});
 const base={order_id:over.order_id,note:'Matched to bank statement manually',reviewed:true,accept_overpayment:false,accept_code_mismatch:false};
 assert.equal((await action(over,{...base,reviewed:false})).status,400);
 assert.equal((await action(over,base)).status,400);
 assert.equal((await action(under,{...base,order_id:under.order_id})).status,409);
 assert.equal((await action(wrong,{...base,order_id:wrong.order_id})).status,409);
 const accepted=await action(over,{...base,accept_overpayment:true});assert.equal(accepted.status,200,JSON.stringify({response:await accepted.text(),over,order:await db.prepare('SELECT id,status,total_vnd FROM orders WHERE id=?').bind(over.order_id).first()}));
 assert.equal((await action(over,{...base,accept_overpayment:true})).status,409);
 assert.equal((await db.prepare('SELECT count(*) n FROM entitlements WHERE order_id=?').bind(over.order_id).first()).n,1);
 const order=await db.prepare("SELECT id FROM orders WHERE gmail='case4@gmail.com'").first();
 const manual={...base,order_id:order.id,accept_code_mismatch:true};
 assert.equal((await action(unknown,{...manual,accept_code_mismatch:false})).status,400);
 assert.equal((await action(unknown,manual)).status,200);
 assert.equal((await db.prepare('SELECT status,order_id FROM payments WHERE id=?').bind(unknown.id).first()).order_id,order.id);
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE action='payment.reconcile' AND object_id=?").bind(unknown.id).first()).n,1);
});
test('admin refund records never transfer funds and can revoke entitlements',async()=>{
 const o=await checkout('refundfixture@gmail.com');assert.equal(o.response.status,201);
 await db.prepare('UPDATE orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-2000).toISOString(),o.body.id).run();
 await sendPayment(o.body,{},9010);
 const headers={'Cf-Access-Jwt-Assertion':await adminToken(),Origin:origin,'Content-Type':'application/json'};
 const request=body=>mf.dispatchFetch(origin+'/admin/api/orders/'+o.body.id+'/refunds',{method:'POST',headers,body:JSON.stringify(body)});
 assert.equal((await request({amount_vnd:10001,note:'Customer requested a refund'})).status,409);
 const created=await request({amount_vnd:6000,note:'Customer requested a partial refund'});assert.equal(created.status,201);
 const refund=(await created.json()).id;
 assert.equal((await request({amount_vnd:5000,note:'Another partial refund request'})).status,409);
 const complete=body=>mf.dispatchFetch(origin+'/admin/api/orders/'+o.body.id+'/refunds/'+refund+'/complete',{method:'POST',headers,body:JSON.stringify(body)});
 assert.equal((await complete({note:'Bank transfer verified manually',manual_transfer_confirmed:false,revoke_entitlements:true})).status,400);
 assert.equal((await db.prepare('SELECT status FROM refunds WHERE id=?').bind(refund).first()).status,'requested');
 const done=await complete({note:'Bank transfer verified manually',manual_transfer_confirmed:true,revoke_entitlements:true});assert.equal(done.status,200);
 assert.equal((await complete({note:'Bank transfer verified manually',manual_transfer_confirmed:true,revoke_entitlements:true})).status,409);
 assert.equal((await db.prepare('SELECT status,completed_at FROM refunds WHERE id=?').bind(refund).first()).status,'completed');
 assert.equal((await db.prepare('SELECT status FROM entitlements WHERE order_id=?').bind(o.body.id).first()).status,'revoked');
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE object_id=? AND action IN ('refund.request','refund.complete')").bind(refund).first()).n,2);
 assert.equal((await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.body.id).first()).status,'paid');
});
test('admin entitlement support actions are guarded and audited',async()=>{
 const o=await checkout('entitlementsupport@gmail.com',['p','q']);assert.equal(o.response.status,201);
 await db.prepare('UPDATE orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-2000).toISOString(),o.body.id).run();await sendPayment(o.body,{},9011);
 const rows=(await db.prepare('SELECT id,activation_deadline FROM entitlements WHERE order_id=? ORDER BY id').bind(o.body.id).all()).results,id=rows[0].id;
 const headers={'Cf-Access-Jwt-Assertion':await adminToken(),Origin:origin,'Content-Type':'application/json'};
 const action=body=>mf.dispatchFetch(origin+'/admin/api/entitlements/'+id+'/adjust',{method:'POST',headers,body:JSON.stringify(body)});
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/entitlements/'+id+'/adjust',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await action({action:'extend_activation',days:0,note:'Support adjusted the deadline'})).status,400);
 assert.equal((await action({action:'extend_activation',days:2,note:'Support adjusted the deadline'})).status,200);
 const extended=await db.prepare('SELECT activation_deadline FROM entitlements WHERE id=?').bind(id).first();assert.ok(extended.activation_deadline>rows[0].activation_deadline);
 await db.prepare("UPDATE entitlements SET activation_deadline=?,status='activation_expired' WHERE id=?").bind(new Date(Date.now()-86400000).toISOString(),id).run();
 assert.equal((await action({action:'reopen',days:1,note:'Verified activation issue'})).status,200);
 assert.equal((await db.prepare('SELECT status FROM entitlements WHERE id=?').bind(id).first()).status,'not_started');
 const started=new Date().toISOString(),expiry=new Date(Date.now()+900000).toISOString();
 await db.prepare("UPDATE entitlements SET status='active',started_at=?,expires_at=? WHERE id=?").bind(started,expiry,id).run();
 assert.equal((await action({action:'extend_active',seconds:900,note:'Support granted extra runtime'})).status,200);
 assert.ok((await db.prepare('SELECT expires_at FROM entitlements WHERE id=?').bind(id).first()).expires_at>expiry);
 assert.equal((await action({action:'revoke',note:'Customer requested access revocation'})).status,200);
 assert.equal((await action({action:'revoke',note:'Customer requested access revocation'})).status,409);
 assert.equal((await db.prepare('SELECT status FROM entitlements WHERE id=?').bind(id).first()).status,'revoked');
 assert.equal((await db.prepare("SELECT count(*) n FROM admin_audit_logs WHERE object_id=? AND action LIKE 'entitlement.%'").bind(id).first()).n,4);
 assert.equal((await db.prepare('SELECT count(*) n FROM support_notes WHERE order_id=?').bind(o.body.id).first()).n,4);
});
test('admin CSV exports stream complete pages and neutralize spreadsheet formulas',async()=>{
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/export/orders')).status,403);
 const now=new Date().toISOString();
 await db.prepare(`WITH RECURSIVE seq(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM seq WHERE i<502) INSERT INTO products(id,slug,title,created_at,updated_at) SELECT 'csv-'||printf('%04d',i),'csv-'||i,CASE WHEN i=0 THEN '=HYPERLINK("https://bad.test")' ELSE 'Export '||i END,?,? FROM seq`).bind(now,now).run();
 const headers={'Cf-Access-Jwt-Assertion':await adminToken()};
 const products=await mf.dispatchFetch(origin+'/admin/api/export/products',{headers});assert.equal(products.status,200);
 assert.match(products.headers.get('Content-Disposition'),/bingenz-products\.csv/);
 assert.match(products.headers.get('Cache-Control'),/no-store/);
 const bytes=new Uint8Array(await products.arrayBuffer());assert.deepEqual([...bytes.slice(0,3)],[239,187,191]);const csv=new TextDecoder().decode(bytes);
 assert.equal(csv.trim().split('\r\n').length>=504,true);
 assert.match(csv,/"'=HYPERLINK\(""https:\/\/bad\.test""\)"/);
 for(const name of ['orders','payments']){const response=await mf.dispatchFetch(origin+'/admin/api/export/'+name,{headers});assert.equal(response.status,200);assert.match(await response.text(),/"id"/);}
 assert.equal((await mf.dispatchFetch(origin+'/admin/api/export/secrets',{headers})).status,404);
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
test('browser unpaid checkout shows QR/countdown then polls into paid access',async()=>{
 const o=await checkout('browserpending@gmail.com');assert.equal(o.response.status,201);
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const local=(await mf.ready).origin,[name,value]=o.cookie.split('=');
  await page.context().addCookies([{name,value,domain:new URL(local).hostname,path:'/',secure:true,httpOnly:true,sameSite:'Strict'}]);
  await page.goto(local+'/checkout/'+o.body.id);
  await page.locator('#payment-state').waitFor();
  assert.match(await page.locator('.payment-code').innerText(),/^BGZ[A-Z0-9]{12}$/);
  assert.match(await page.locator('#pay-clock').innerText(),/^\d+:\d{2}$/);
  assert.match(await page.locator('.payment-layout h2').innerText(),/10[.,]000/);
  const qrResponse=await mf.dispatchFetch(origin+'/api/orders/'+o.body.id+'/qr',{headers:{Cookie:o.cookie}});
  assert.equal(qrResponse.status,200,await qrResponse.text());
  await page.locator('.payment-qr').evaluate(async image=>{if(!image.complete)await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});});
  assert.ok(await page.locator('.payment-qr').evaluate(image=>image.naturalWidth>0));
  assert.equal((await mf.dispatchFetch(origin+'/api/orders/'+o.body.id+'/qr')).status,404);
  await db.prepare('UPDATE orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-2000).toISOString(),o.body.id).run();
  assert.equal((await sendPayment(o.body,{},9103)).status,200);
  await page.locator('[data-start]').waitFor({timeoutMs:10000});
  assert.equal(new URL(page.url()).pathname,'/access');
  assert.equal(await page.locator('#copy-access').count(),1);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

