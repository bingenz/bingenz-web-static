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
 const stored=await db.prepare('SELECT original_key,delivery_key FROM product_versions WHERE id=?').bind(version).first();
 const privateBucket=await mf.getR2Bucket('SIMULATIONS');assert.ok(await privateBucket.head(stored.original_key));assert.ok(await privateBucket.head(stored.delivery_key));
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

