import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { chromium } from 'playwright';
import { importSQL } from './import-sql.mjs';
import { hash,randomToken,sign } from '../src/security.mjs';

const manifest=JSON.parse(await readFile('.private/products/manifest.json','utf8'));
assert.equal(manifest.complete,true);assert.equal(manifest.items.length,35);
const bundle=await build({entryPoints:['src/worker.mjs'],bundle:true,format:'esm',platform:'browser',write:false});
const secret='test-only-session-secret-for-all-protected-simulations';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-16',d1Databases:['DB'],r2Buckets:['SIMULATIONS'],bindings:{SESSION_SECRET:secret},serviceBindings:{ASSETS:async()=>new Response('asset')}}));
const browser=await chromium.launch();
const results=[];
try{
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('SIMULATIONS');
 for(const file of ['0001_commerce.sql','0002_import_state.sql','0003_payment_second_precision.sql','0004_fix_payment_trigger.sql','0005_restore_payment_window.sql']){
  for(const sql of unstable_splitSqlQuery(await readFile('migrations/'+file,'utf8')))await db.prepare(sql).run();
 }
 const now=new Date(),stamp=now.toISOString();
 for(const item of manifest.items){
  for(const sql of unstable_splitSqlQuery(importSQL(item,stamp)))await db.prepare(sql).run();
  await bucket.put(item.delivery_key,await readFile(item.delivery_file));
 }
 const orderId=crypto.randomUUID(),items=manifest.items.map(item=>item.id),expires=new Date(now.getTime()+900000).toISOString();
 await db.prepare('INSERT INTO orders(id,gmail,gmail_key,cart_key,cart_json,checkout_hash,payment_code,total_vnd,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(orderId,'protectedtest@gmail.com','protectedtest','all35',JSON.stringify(items),'test-checkout','BGZ123456789ABC',items.length*10000,stamp,expires).run();
 await db.prepare("UPDATE orders SET status='paid',paid_at=? WHERE id=?").bind(stamp,orderId).run();
 const device=randomToken();await db.prepare('UPDATE orders SET device_hash=? WHERE id=?').bind(await hash(device),orderId).run();
 const session=await sign({purpose:'session',order:orderId,generation:0,exp:Date.now()+3600000},secret);
 const cookie=`__Host-bgz-device=${device}; __Host-bgz-session=${session}`;
 const local=(await mf.ready).origin;
 const entitlements=(await db.prepare('SELECT e.id,i.product_id FROM entitlements e JOIN order_items i ON i.id=e.order_item_id WHERE e.order_id=?').bind(orderId).all()).results;
 assert.equal(entitlements.length,35);
 for(const item of manifest.items){
  const entitlement=entitlements.find(e=>e.product_id===item.id);assert.ok(entitlement,item.source_key);
  const start=await mf.dispatchFetch(local+'/api/entitlements/'+entitlement.id+'/start',{method:'POST',headers:{Origin:local,Cookie:cookie}});
  assert.equal(start.status,200,item.source_key+' start');
  const observation={filename:item.source_key,entitlement:entitlement.id,views:[]};
  for(const width of [1440,390]){
   const permit=await mf.dispatchFetch(local+'/api/entitlements/'+entitlement.id+'/play',{method:'POST',headers:{Origin:local,Cookie:cookie}});
   assert.equal(permit.status,200,item.source_key+' play');const play=await permit.json();
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   const domain=new URL(local).hostname;
   await context.addCookies([{name:'__Host-bgz-device',value:device,domain,path:'/',secure:true,httpOnly:true,sameSite:'Lax'},{name:'__Host-bgz-session',value:session,domain,path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);
   const response=await page.goto(local+play.url);assert.equal(response.status(),200,item.source_key+' runtime');
   await page.locator('#bgz-license').waitFor();
   const first=item.source_key==='ddos-simulation-tiktok-pro.html'?page.getByRole('button',{name:'Tấn công DDoS'}):page.locator('#run,#runBtn,#scanAction,#replayBtn').first();
   const clicked=await first.count()&&await first.isVisible()&&await first.isEnabled();
   assert.ok(clicked,item.source_key+' '+width+' primary control');
   await first.click();
   await page.waitForTimeout(250);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   observation.views.push({width,clicked:Boolean(clicked),overflow,errors});
   await context.close();
   assert.deepEqual(errors,[],item.source_key+' '+width+' page errors');
   assert.equal(overflow,false,item.source_key+' '+width+' overflow');
  }
  await db.prepare("UPDATE entitlements SET expires_at=? WHERE id=?").bind(new Date(Date.now()-1000).toISOString(),entitlement.id).run();
  const denied=await mf.dispatchFetch(local+'/api/entitlements/'+entitlement.id+'/play',{method:'POST',headers:{Origin:local,Cookie:cookie}});
  assert.equal(denied.status,410,item.source_key+' expiry');
  results.push(observation);console.log(`${results.length}/35 protected: ${item.source_key}`);
 }
 await mkdir('test-results/protected-simulations',{recursive:true});
 await writeFile('test-results/protected-simulations/results.json',JSON.stringify(results,null,2)+'\n');
 console.log('PASS: all 35 protected desktop/mobile runtime cycles');
}finally{await browser.close();await mf.dispose();}
