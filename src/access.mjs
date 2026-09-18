import { iso,hash,randomToken,sign,verify,cookies,cookie,originGuard,requireValue,json } from './security.mjs';
import { first,all,stmt } from './db.mjs';
import { ownedOrder } from './orders.mjs';
const DEVICE='__Host-bgz-device',SESSION='__Host-bgz-session';
const accessCookie=(name,value)=>cookie(name,value).replace('SameSite=Strict','SameSite=Lax');
async function sessionHeaders(order,device,env){
 const token=await sign({purpose:'session',order:order.id,generation:order.generation,exp:Date.now()+30*86400000},env.SESSION_SECRET);
 const headers=new Headers({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});
 headers.append('Set-Cookie',accessCookie(DEVICE,device));headers.append('Set-Cookie',accessCookie(SESSION,token));return headers;
}
export async function claim(request,env,id){
 originGuard(request);const order=await ownedOrder(request,env,id);requireValue(order.status==='paid',409,'payment_pending');
 const jar=cookies(request),device=jar[DEVICE]||jar['__Host-bgz-checkout'];
 requireValue(device&&/^[A-Za-z0-9_-]{43}$/.test(device),403,'device_required');
 const deviceHash=await hash(device),token=randomToken();
 const changed=await stmt(env.DB,`UPDATE orders SET access_hash=?,access_issued_at=?,device_hash=? WHERE id=? AND status='paid' AND access_hash IS NULL AND (device_hash IS NULL OR device_hash=?) RETURNING id`,await hash(token),iso(),deviceHash,id,deviceHash).first();
 const current=await first(env.DB,'SELECT * FROM orders WHERE id=?',id);
 requireValue(current.status==='paid'&&current.device_hash===deviceHash,403,'device_mismatch');
 const headers=await sessionHeaders(current,device,env);headers.set('Content-Type','application/json');
 // Retry after a lost response restores this device's session, never duplicates fulfillment.
 return new Response(JSON.stringify({access_url:changed?new URL('/access/'+token,request.url).href:null,already_issued:!changed}),{headers});
}
export async function exchange(request,env,token){
 requireValue(/^[A-Za-z0-9_-]{43}$/.test(token),404,'access_unavailable');
 const tokenHash=await hash(token),order=await first(env.DB,"SELECT * FROM orders WHERE access_hash=? AND status='paid'",tokenHash);
 requireValue(order,404,'access_unavailable');
 const existing=cookies(request)[DEVICE],device=existing&&/^[A-Za-z0-9_-]{43}$/.test(existing)?existing:randomToken(),deviceHash=await hash(device);
 const bound=await stmt(env.DB,`UPDATE orders SET device_hash=? WHERE id=? AND access_hash=? AND status='paid' AND (device_hash IS NULL OR device_hash=?) RETURNING id,generation`,deviceHash,order.id,tokenHash,deviceHash).first();
 requireValue(bound,403,'device_mismatch');
 const headers=await sessionHeaders({...order,generation:bound.generation},device,env);headers.set('Location','/access');return new Response(null,{status:303,headers});
}
export async function customer(request,env){
 const jar=cookies(request),session=await verify(jar[SESSION],env.SESSION_SECRET,'session');
 requireValue(session&&jar[DEVICE],401,'access_required');
 const deviceHash=await hash(jar[DEVICE]);
 const order=await first(env.DB,"SELECT id,generation,payment_code,device_hash FROM orders WHERE id=? AND generation=? AND device_hash=? AND status='paid'",session.order,session.generation,deviceHash);
 requireValue(order,401,'access_required');return order;
}
export function entitlementState(e,now=iso()){
 if(e.status==='revoked')return 'revoked';
 if(e.started_at)return e.expires_at>now?'active':'expired';
 return e.activation_deadline>now?'not_started':'activation_expired';
}
export async function accessList(request,env){
 const order=await customer(request,env),items=await all(env.DB,`SELECT e.id,e.status,e.activation_deadline,e.started_at,e.expires_at,i.title,i.duration_seconds,i.product_id,p.thumbnail,p.slug FROM entitlements e JOIN order_items i ON i.id=e.order_item_id JOIN products p ON p.id=i.product_id WHERE e.order_id=?`,order.id);
 return json({order_code:order.payment_code,server_now:iso(),items:items.map(e=>({...e,status:entitlementState(e)}))});
}
export async function start(request,env,id){
 originGuard(request);const order=await customer(request,env),now=iso();
 await stmt(env.DB,`UPDATE entitlements SET status='active',started_at=?,expires_at=strftime('%Y-%m-%dT%H:%M:%fZ',?,'+'||(SELECT duration_seconds FROM order_items WHERE id=order_item_id)||' seconds') WHERE id=? AND order_id=? AND status='not_started' AND started_at IS NULL AND activation_deadline>? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='paid' AND generation=? AND device_hash=?)`,now,now,id,order.id,now,order.id,order.generation,order.device_hash).run();
 const e=await first(env.DB,'SELECT * FROM entitlements WHERE id=? AND order_id=?',id,order.id);requireValue(e,404,'entitlement_unavailable');
 requireValue(entitlementState(e)==='active',410,'entitlement_expired');
 return json({id,status:'active',started_at:e.started_at,expires_at:e.expires_at,server_now:iso()});
}
export async function activeEntitlement(env,order,id){
 const e=await first(env.DB,`SELECT e.*,i.version_id,v.delivery_key FROM entitlements e JOIN order_items i ON i.id=e.order_item_id JOIN product_versions v ON v.id=i.version_id JOIN orders o ON o.id=e.order_id WHERE e.id=? AND e.order_id=? AND o.status='paid' AND o.generation=? AND o.device_hash=?`,id,order.id,order.generation,order.device_hash);
 requireValue(e,404,'entitlement_unavailable');requireValue(entitlementState(e)==='active',410,'entitlement_expired');return e;
}
export async function playPermit(request,env,id){
 originGuard(request);const order=await customer(request,env),e=await activeEntitlement(env,order,id);
 const token=await sign({purpose:'play',entitlement:id,order:order.id,generation:order.generation,device:order.device_hash,exp:Math.min(Date.now()+60000,Date.parse(e.expires_at))},env.SESSION_SECRET);
 return json({url:'/runtime/'+id+'?permit='+encodeURIComponent(token),expires_at:e.expires_at,server_now:iso()});
}
export async function runtime(request,env,id){
 const order=await customer(request,env),permit=await verify(new URL(request.url).searchParams.get('permit'),env.SESSION_SECRET,'play');
 requireValue(permit&&permit.entitlement===id&&permit.order===order.id&&permit.generation===order.generation&&permit.device===order.device_hash,403,'play_denied');
 const e=await activeEntitlement(env,order,id),object=await env.SIMULATIONS.get(e.delivery_key);requireValue(object,503,'content_unavailable');
 requireValue(object.size<=2097152,503,'content_unavailable');
 const html=await object.text();
 // R2 reads may outlive an expiry, revocation or access-link rotation.
 const current=await activeEntitlement(env,order,id);
 const marker='BGZ-'+id.slice(0,8),remaining=Math.max(0,Date.parse(current.expires_at)-Date.now());
 const injection=`<div id="bgz-license" style="position:fixed;top:4px;right:8px;font:10px system-ui;color:#b8bcc8;opacity:.65;z-index:2147483647;pointer-events:none">${marker}</div><script>/* license:${id} */setTimeout(()=>{document.body.replaceChildren(Object.assign(document.createElement('p'),{textContent:'Đã hết hạn. Mua lại để tiếp tục.'}));},${remaining});</script>`;
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts"};
 return new Response(html.replace(/<\/body\s*>/i,injection+'</body>'),{headers});
}
