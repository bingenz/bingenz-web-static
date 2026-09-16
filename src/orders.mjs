import { iso,addSeconds,hash,randomToken,paymentCode,gmail,cookies,cookie,jsonBody,objectShape,originGuard,requireValue,json,HttpError } from './security.mjs';
import { first,all,stmt,run } from './db.mjs';
const CHECKOUT='__Host-bgz-checkout';
export async function catalog(env){return all(env.DB,`SELECT id,slug,title,description,category,price_vnd,duration_seconds,coalesce(activation_days,CAST((SELECT value FROM settings WHERE key='activation_days') AS INTEGER)) activation_days,thumbnail FROM products WHERE active=1 AND archived=0 AND current_version_id IS NOT NULL ORDER BY display_order,title`);}
async function turnstile(token,request,env){
 requireValue(typeof token==='string'&&token.length>0&&token.length<=2048,400,'turnstile_required');
 requireValue(env.TURNSTILE_SECRET_KEY,503,'configuration_required');
 const hosts=(env.TURNSTILE_HOSTNAMES||'').split(',').map(x=>x.trim()).filter(Boolean);
 requireValue(hosts.includes(new URL(request.url).hostname),503,'configuration_required');
 const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',signal:AbortSignal.timeout(10000),body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP')||undefined}),headers:{'Content-Type':'application/json'}});
 requireValue(res.ok,503,'turnstile_unavailable');const result=await res.json();
 requireValue(result.success===true&&result.action==='checkout'&&result.hostname===new URL(request.url).hostname,400,'turnstile_failed');
}
function view(o){return {id:o.id,payment_code:o.payment_code,total_vnd:o.total_vnd,status:o.status==='pending'&&o.expires_at<=iso()?'expired':o.status,expires_at:o.expires_at,server_now:iso()};}
export async function ownedOrder(request,env,id){
 const secret=cookies(request)[CHECKOUT];requireValue(secret&&secret.length<=100,404,'order_unavailable');
 const o=await first(env.DB,'SELECT * FROM orders WHERE id=? AND checkout_hash=?',id,await hash(secret));
 requireValue(o,404,'order_unavailable');return o;
}
export async function createOrder(request,env){
 originGuard(request);const b=await jsonBody(request);objectShape(b,['gmail','product_ids','turnstile_token']);
 const email=gmail(b.gmail);requireValue(Array.isArray(b.product_ids)&&b.product_ids.length>0&&b.product_ids.length<=200);
 requireValue(b.product_ids.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x)));
 requireValue(new Set(b.product_ids).size===b.product_ids.length,400,'duplicate_product');
 const now=iso(),since=addSeconds(now,-600),ids=[...b.product_ids].sort(),cartKey=await hash(JSON.stringify(ids));
 requireValue(env.ABUSE_HASH_KEY,503,'configuration_required');
 const ipKey=await hash(env.ABUSE_HASH_KEY+':ip:'+(request.headers.get('CF-Connecting-IP')||'local'));
 const emailKey=await hash(env.ABUSE_HASH_KEY+':gmail:'+email.canonical);
 for(const abuseKey of [ipKey,emailKey]) {
  const result=await stmt(env.DB,`INSERT INTO checkout_attempts SELECT ?,?,? WHERE (SELECT count(*) FROM checkout_attempts WHERE abuse_key=? AND created_at>?)<5 RETURNING id`,crypto.randomUUID(),abuseKey,now,abuseKey,since).first();
  requireValue(result,429,'checkout_rate_limit');
 }
 await turnstile(b.turnstile_token,request,env);
 await env.DB.batch([stmt(env.DB,`UPDATE orders SET status='expired' WHERE status='pending' AND expires_at<=?`,now),stmt(env.DB,'DELETE FROM checkout_attempts WHERE created_at<?',addSeconds(now,-86400))]);
 let o=await first(env.DB,`SELECT * FROM orders WHERE gmail_key=? AND cart_key=? AND status='pending'`,email.canonical,cartKey);
 const existingCookie=cookies(request)[CHECKOUT];
 if(o){const owned=existingCookie&&await hash(existingCookie)===o.checkout_hash;return json({...view(o),reused:true,claimable:!!owned},200);}
 const products=await all(env.DB,`SELECT price_vnd FROM products WHERE id IN (SELECT value FROM json_each(?)) AND active=1 AND archived=0 AND current_version_id IS NOT NULL`,JSON.stringify(ids));
 requireValue(products.length===ids.length,400,'product_unavailable');
 const secret=existingCookie&&/^[A-Za-z0-9_-]{43}$/.test(existingCookie)?existingCookie:randomToken();
 const id=crypto.randomUUID(),total=products.reduce((s,p)=>s+p.price_vnd,0);
 try{await run(env.DB,`INSERT INTO orders(id,gmail,gmail_key,cart_key,cart_json,checkout_hash,payment_code,total_vnd,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,id,email.address,email.canonical,cartKey,JSON.stringify(ids),await hash(secret),paymentCode(),total,now,addSeconds(now,900));}
 catch(e){
  o=await first(env.DB,`SELECT * FROM orders WHERE gmail_key=? AND cart_key=? AND status='pending'`,email.canonical,cartKey);
  if(o)return json({...view(o),reused:true,claimable:await hash(secret)===o.checkout_hash});
  if(String(e).includes('pending_limit'))throw new HttpError(429,'pending_limit');
  if(/invalid_total|inactive_product/.test(String(e)))throw new HttpError(409,'catalog_changed');throw e;
 }
 o=await first(env.DB,'SELECT * FROM orders WHERE id=?',id);
 return json({...view(o),claimable:true},201,{'Set-Cookie':cookie(CHECKOUT,secret)});
}
export async function orderStatus(request,env,id){return json(view(await ownedOrder(request,env,id)));}
export async function qr(request,env,id){
 const o=await ownedOrder(request,env,id);requireValue(o.status==='pending'&&o.expires_at>iso(),410,'order_expired');
 requireValue(env.BANK_ACCOUNT_NUMBER&&env.BANK_CODE==='TPBank',503,'payment_configuration_required');
 const url=new URL('https://qr.sepay.vn/img');url.search=new URLSearchParams({acc:env.BANK_ACCOUNT_NUMBER,bank:env.BANK_CODE,amount:String(o.total_vnd),des:o.payment_code}).toString();
 const res=await fetch(url,{redirect:'error'});requireValue(res.ok&&res.headers.get('Content-Type')?.startsWith('image/'),502,'qr_unavailable');
 return new Response(res.body,{headers:{'Content-Type':res.headers.get('Content-Type'),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
