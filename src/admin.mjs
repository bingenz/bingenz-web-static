import { HttpError, json, jsonBody, objectShape, requireValue, iso, hash, randomToken } from './security.mjs';
import { stmt } from './db.mjs';

const editable=['slug','title','description','category','price_vnd','duration_seconds','activation_days','active','archived','display_order'];
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const productFields='id,slug,title,description,category,price_vnd,duration_seconds,activation_days,active,archived,display_order,thumbnail,current_version_id,updated_at';
function validateProduct(input){
 for(const [key,value] of Object.entries(input)){
  const valid=key==='slug'?typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length<=120:
   key==='title'?typeof value==='string'&&value.trim().length>0&&value.length<=200:
   ['description','category'].includes(key)?typeof value==='string'&&value.length<=(key==='description'?4000:100):
   key==='price_vnd'?integer(value,1,100000000):key==='duration_seconds'?integer(value,60,86400):
   key==='activation_days'?value===null||integer(value,1,365):
   ['active','archived'].includes(key)?value===0||value===1:integer(value,-100000,100000);
  requireValue(valid,400,'invalid_product');
 }
}

export async function adminRoute(request,env,actor,path){
 const method=request.method,url=new URL(request.url);
 if(path==='/admin/api/dashboard'&&method==='GET'){
  const [revenue,orders,payments,entitlements,recent,best]=await env.DB.batch([
   stmt(env.DB,`SELECT coalesce(sum(CASE WHEN paid_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day') THEN total_vnd END),0) today_vnd,coalesce(sum(CASE WHEN paid_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days') THEN total_vnd END),0) week_vnd,coalesce(sum(CASE WHEN paid_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days') THEN total_vnd END),0) month_vnd FROM orders WHERE status='paid'`),
   stmt(env.DB,`SELECT sum(CASE WHEN status='paid' THEN 1 ELSE 0 END) paid,sum(CASE WHEN status='pending' AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 1 ELSE 0 END) pending,sum(CASE WHEN status='pending' AND expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 1 ELSE 0 END) expired_pending FROM orders`),
   stmt(env.DB,`SELECT count(*) n FROM payments WHERE status NOT IN ('matched','reconciled')`),
   stmt(env.DB,`SELECT count(*) n FROM entitlements WHERE status='active' AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')`),
   stmt(env.DB,`SELECT id,gmail,total_vnd,paid_at FROM orders WHERE status='paid' ORDER BY paid_at DESC LIMIT 10`),
   stmt(env.DB,`SELECT i.product_id,i.title,count(*) sold FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='paid' GROUP BY i.product_id ORDER BY sold DESC LIMIT 10`)
  ]);
  return json({revenue:revenue.results[0],orders:orders.results[0],manual_review_payments:payments.results[0].n,active_entitlements:entitlements.results[0].n,recent_orders:recent.results,best_sellers:best.results});
 }
 if(path==='/admin/api/products'&&method==='GET'){
  const products=await env.DB.prepare(`SELECT ${productFields} FROM products ORDER BY display_order,title LIMIT 250`).all();
  return json({products:products.results});
 }
 if(path==='/admin/api/products'&&method==='POST'){
  const input=await jsonBody(request,8192);objectShape(input,['slug','title','description','category','price_vnd','duration_seconds','activation_days','display_order']);
  requireValue(typeof input.slug==='string'&&typeof input.title==='string',400,'invalid_product');validateProduct(input);
  const existing=await env.DB.prepare('SELECT id FROM products WHERE slug=?').bind(input.slug).first();
  if(existing)throw new HttpError(409,'slug_exists');
  const now=iso(),id='prod_'+crypto.randomUUID().replaceAll('-','');
  const created={id,slug:input.slug,title:input.title.trim(),description:input.description??'',category:input.category??'',price_vnd:input.price_vnd??10000,duration_seconds:input.duration_seconds??900,activation_days:input.activation_days??null,active:0,archived:0,display_order:input.display_order??0,thumbnail:'',current_version_id:null,updated_at:now};
  await env.DB.batch([
   stmt(env.DB,`INSERT INTO products(id,slug,title,description,category,price_vnd,duration_seconds,activation_days,active,archived,display_order,thumbnail,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,0,?,'',?,?)`,id,created.slug,created.title,created.description,created.category,created.price_vnd,created.duration_seconds,created.activation_days,created.display_order,now,now),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) VALUES (?,?,?,?,?,?,?)`,crypto.randomUUID(),actor,'product.create','product',id,now,JSON.stringify({after:created}))
  ]);
  return json({product:created},201);
 }
 if(path==='/admin/api/products/bulk'&&method==='PATCH'){
  const input=await jsonBody(request,8192);objectShape(input,['ids','changes']);
  requireValue(Array.isArray(input.ids)&&input.ids.length>=1&&input.ids.length<=25&&new Set(input.ids).size===input.ids.length&&input.ids.every(id=>typeof id==='string'&&/^[a-z0-9_-]{1,64}$/.test(id)),400,'invalid_selection');
  objectShape(input.changes,['active','price_vnd','duration_seconds','activation_days','display_order','category']);
  const fields=Object.keys(input.changes);requireValue(fields.length>=1);validateProduct(input.changes);
  const placeholders=input.ids.map(()=>'?').join(',');
  const rows=await env.DB.prepare(`SELECT ${productFields} FROM products WHERE id IN (${placeholders})`).bind(...input.ids).all();
  requireValue(rows.results.length===input.ids.length,404,'not_found');
  const byId=new Map(rows.results.map(row=>[row.id,row])),now=iso(),batch=[];
  for(const id of input.ids){
   const before=byId.get(id),after={...before,...input.changes,updated_at:now};
   batch.push(stmt(env.DB,`UPDATE products SET ${fields.map(k=>k+'=?').join(',')},updated_at=? WHERE id=? AND updated_at=?${input.changes.active===1?' AND current_version_id IS NOT NULL':''}`,...fields.map(k=>input.changes[k]),now,id,before.updated_at));
   batch.push(stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) SELECT ?,?,'product.bulk_update','product',?,?,? WHERE changes()=1`,crypto.randomUUID(),actor,id,now,JSON.stringify({before,after})));
  }
  const result=await env.DB.batch(batch);
  const updated=input.ids.filter((_,i)=>result[2*i].meta.changes===1);
  return json({updated,skipped:input.ids.filter(id=>!updated.includes(id))});
 }
 if(path==='/admin/api/orders'&&method==='GET'){
  const q=(url.searchParams.get('q')||'').trim();requireValue(q.length<=254);
  const term='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
  const rows=await env.DB.prepare(`SELECT o.id,o.gmail,o.total_vnd,o.status,o.payment_code,o.created_at,o.expires_at,o.paid_at,p.external_id,
   (SELECT group_concat(title, ', ') FROM order_items WHERE order_id=o.id) products
   FROM orders o LEFT JOIN payments p ON p.id=o.paid_payment_id
   WHERE ?='' OR o.id=? OR o.gmail LIKE ? ESCAPE '\\' OR o.payment_code=? OR p.external_id=?
   OR o.created_at LIKE ? ESCAPE '\\'
   OR EXISTS(SELECT 1 FROM payments x WHERE x.order_id=o.id AND (x.reference LIKE ? ESCAPE '\\' OR x.external_id=?))
   OR EXISTS(SELECT 1 FROM order_items i JOIN products product ON product.id=i.product_id WHERE i.order_id=o.id AND (i.title LIKE ? ESCAPE '\\' OR product.slug LIKE ? ESCAPE '\\'))
   ORDER BY o.created_at DESC LIMIT 100`).bind(q,q,term,q.toUpperCase(),q,term,term,q,term,term).all();
  return json({orders:rows.results});
 }
 if(path==='/admin/api/payments'&&method==='GET'){
  const q=(url.searchParams.get('q')||'').trim();requireValue(q.length<=200,400,'invalid_search');
  const term='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
  const rows=await env.DB.prepare(`SELECT p.id,p.external_id,p.reference,p.payment_code,p.amount_vnd,p.transaction_at,p.received_at,p.direction,p.bank_valid,p.status,p.order_id,p.note,o.gmail,o.total_vnd order_total_vnd,o.status order_status FROM payments p LEFT JOIN orders o ON o.id=p.order_id WHERE p.status NOT IN ('matched','reconciled') AND (?='' OR p.external_id=? OR p.reference LIKE ? ESCAPE '\\' OR p.payment_code=? OR o.gmail LIKE ? ESCAPE '\\') ORDER BY p.received_at DESC LIMIT 100`).bind(q,q,term,q.toUpperCase(),term).all();
  return json({payments:rows.results});
 }
 const reconcile=path.match(/^\/admin\/api\/payments\/([a-f0-9-]{36})\/reconcile$/);
 if(reconcile&&method==='POST'){
  const input=await jsonBody(request,4096);objectShape(input,['order_id','note','reviewed','accept_overpayment','accept_code_mismatch']);
  requireValue(typeof input.order_id==='string'&&/^[a-f0-9-]{36}$/.test(input.order_id)&&typeof input.note==='string'&&input.note.trim().length>=10&&input.note.length<=2000&&input.reviewed===true&&typeof input.accept_overpayment==='boolean'&&typeof input.accept_code_mismatch==='boolean',400,'reconciliation_confirmation_required');
  const payment=await env.DB.prepare('SELECT * FROM payments WHERE id=?').bind(reconcile[1]).first();
  const target=await env.DB.prepare('SELECT id,payment_code,total_vnd,status FROM orders WHERE id=?').bind(input.order_id).first();
  if(!payment||!target)throw new HttpError(404,'not_found');
  requireValue(payment.direction==='in'&&payment.bank_valid===1&&(payment.order_id===null||payment.order_id===target.id),409,'payment_not_eligible');
  requireValue(!['matched','reconciled','outgoing','wrong_bank'].includes(payment.status)&&target.status==='pending'&&payment.amount_vnd>=target.total_vnd,409,'payment_not_eligible');
  requireValue(payment.amount_vnd===target.total_vnd||input.accept_overpayment,400,'overpayment_confirmation_required');
  requireValue(payment.payment_code===target.payment_code||input.accept_code_mismatch,400,'code_mismatch_confirmation_required');
  const now=iso(),paymentId=payment.id;
  const result=await env.DB.batch([
   stmt(env.DB,`UPDATE orders SET status='paid',paid_at=?,paid_payment_id=? WHERE id=? AND status='pending' AND total_vnd<=? AND EXISTS(SELECT 1 FROM payments WHERE id=? AND status=? AND direction='in' AND bank_valid=1 AND (order_id IS NULL OR order_id=?)) RETURNING id`,now,paymentId,target.id,payment.amount_vnd,paymentId,payment.status,target.id),
   stmt(env.DB,`UPDATE payments SET status='reconciled',order_id=?,note=?,reconciled_at=?,reconciled_by=? WHERE id=? AND changes()=1`,target.id,input.note.trim(),now,actor,paymentId),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) SELECT ?,?,'payment.reconcile','payment',?,?,? WHERE changes()=1`,crypto.randomUUID(),actor,paymentId,now,JSON.stringify({order_id:target.id,amount_vnd:payment.amount_vnd,order_total_vnd:target.total_vnd,previous_status:payment.status,code_mismatch:payment.payment_code!==target.payment_code,overpayment:payment.amount_vnd>target.total_vnd,note:input.note.trim()}))
  ]);
  if(result[0].results.length!==1)throw new HttpError(409,'reconciliation_conflict');
  return json({order_id:target.id,payment_id:paymentId,status:'reconciled'});
 }
 const order=path.match(/^\/admin\/api\/orders\/([a-f0-9-]{36})$/);
 const refundRequest=path.match(/^\/admin\/api\/orders\/([a-f0-9-]{36})\/refunds$/);
 if(refundRequest&&method==='POST'){
  const input=await jsonBody(request,4096);objectShape(input,['amount_vnd','note']);
  requireValue(integer(input.amount_vnd,1,100000000)&&typeof input.note==='string'&&input.note.trim().length>=10&&input.note.length<=2000,400,'refund_request_invalid');
  const target=await env.DB.prepare("SELECT id,total_vnd FROM orders WHERE id=? AND status='paid'").bind(refundRequest[1]).first();
  if(!target)throw new HttpError(404,'paid_order_required');
  const id=crypto.randomUUID(),now=iso();
  const result=await env.DB.batch([
   stmt(env.DB,`INSERT INTO refunds(id,order_id,status,amount_vnd,recorded_at,actor,note) SELECT ?,?,'requested',?,?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='paid' AND total_vnd>=?+(SELECT coalesce(sum(amount_vnd),0) FROM refunds WHERE order_id=? AND status IN ('requested','completed'))) RETURNING id`,id,target.id,input.amount_vnd,now,actor,input.note.trim(),target.id,input.amount_vnd,target.id),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) SELECT ?,?,'refund.request','refund',?,?,? WHERE changes()=1`,crypto.randomUUID(),actor,id,now,JSON.stringify({order_id:target.id,amount_vnd:input.amount_vnd,note:input.note.trim()}))
  ]);
  if(result[0].results.length!==1)throw new HttpError(409,'refund_limit_exceeded');
  return json({id,status:'requested',recorded_at:now},201);
 }
 const refundComplete=path.match(/^\/admin\/api\/orders\/([a-f0-9-]{36})\/refunds\/([a-f0-9-]{36})\/complete$/);
 if(refundComplete&&method==='POST'){
  const input=await jsonBody(request,4096);objectShape(input,['note','revoke_entitlements','manual_transfer_confirmed']);
  requireValue(input.manual_transfer_confirmed===true&&typeof input.revoke_entitlements==='boolean'&&typeof input.note==='string'&&input.note.trim().length>=10&&input.note.length<=2000,400,'manual_refund_confirmation_required');
  const before=await env.DB.prepare("SELECT r.id,r.amount_vnd,r.status,o.status order_status FROM refunds r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND r.order_id=?").bind(refundComplete[2],refundComplete[1]).first();
  if(!before)throw new HttpError(404,'not_found');
  requireValue(before.status==='requested'&&before.order_status==='paid',409,'refund_not_pending');
  const now=iso();
  const result=await env.DB.batch([
   stmt(env.DB,`UPDATE refunds SET status='completed',completed_at=?,note=note||'\nHoàn tất: '||?,actor=? WHERE id=? AND order_id=? AND status='requested' RETURNING id`,now,input.note.trim(),actor,before.id,refundComplete[1]),
   stmt(env.DB,`UPDATE entitlements SET status='revoked' WHERE order_id=? AND ?=1 AND EXISTS(SELECT 1 FROM refunds WHERE id=? AND status='completed' AND completed_at=?) AND status!='revoked'`,refundComplete[1],Number(input.revoke_entitlements),before.id,now),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) SELECT ?,?,'refund.complete','refund',?,?,? WHERE EXISTS(SELECT 1 FROM refunds WHERE id=? AND status='completed' AND completed_at=?)`,crypto.randomUUID(),actor,before.id,now,JSON.stringify({order_id:refundComplete[1],amount_vnd:before.amount_vnd,revoke_entitlements:input.revoke_entitlements,note:input.note.trim()}),before.id,now)
  ]);
  if(result[0].results.length!==1)throw new HttpError(409,'refund_changed');
  return json({id:before.id,status:'completed',completed_at:now});
 }
 const noteRoute=path.match(/^\/admin\/api\/orders\/([a-f0-9-]{36})\/notes$/);
 if(noteRoute&&method==='POST'){
  const input=await jsonBody(request,4096);objectShape(input,['note']);
  requireValue(typeof input.note==='string'&&input.note.trim().length>=1&&input.note.length<=2000,400,'note_required');
  const target=await env.DB.prepare('SELECT id FROM orders WHERE id=?').bind(noteRoute[1]).first();
  if(!target)throw new HttpError(404,'not_found');
  const id=crypto.randomUUID(),now=iso();
  await env.DB.batch([
   stmt(env.DB,'INSERT INTO support_notes(id,order_id,actor,note,created_at) VALUES (?,?,?,?,?)',id,target.id,actor,input.note.trim(),now),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) VALUES (?,?,?,?,?,?,?)`,crypto.randomUUID(),actor,'support.note','order',target.id,now,JSON.stringify({note_id:id}))
  ]);
  return json({id,created_at:now},201);
 }
 const reissue=path.match(/^\/admin\/api\/orders\/([a-f0-9-]{36})\/reissue$/);
 if(reissue&&method==='POST'){
  const input=await jsonBody(request,4096);objectShape(input,['note','reset_device','customer_verified']);
  requireValue(input.customer_verified===true&&typeof input.reset_device==='boolean'&&typeof input.note==='string'&&input.note.trim().length>=10&&input.note.length<=2000,400,'verification_note_required');
  const before=await env.DB.prepare("SELECT id,generation,device_hash FROM orders WHERE id=? AND status='paid'").bind(reissue[1]).first();
  if(!before)throw new HttpError(404,'paid_order_required');
  const token=randomToken(),now=iso(),id=crypto.randomUUID();
  const result=await env.DB.batch([
   stmt(env.DB,`UPDATE orders SET access_hash=?,access_issued_at=?,generation=generation+1,device_hash=CASE WHEN ?=1 THEN NULL ELSE device_hash END WHERE id=? AND status='paid' AND generation=?`,await hash(token),now,Number(input.reset_device),before.id,before.generation),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) SELECT ?,?,'access.reissue','order',?,?,? WHERE changes()=1`,crypto.randomUUID(),actor,before.id,now,JSON.stringify({from_generation:before.generation,to_generation:before.generation+1,reset_device:input.reset_device})),
   stmt(env.DB,`INSERT INTO support_notes(id,order_id,actor,note,created_at) SELECT ?,?,?,?,? WHERE changes()=1`,id,before.id,actor,input.note.trim(),now)
  ]);
  if(result[0].meta.changes!==1)throw new HttpError(409,'order_changed');
  return json({access_url:new URL('/access/'+token,request.url).href,device_reset:input.reset_device});
 }
 if(order&&method==='GET'){
  const o=await env.DB.prepare(`SELECT id,gmail,payment_code,total_vnd,status,created_at,expires_at,paid_at,paid_payment_id,access_issued_at,generation,CASE WHEN device_hash IS NULL THEN 0 ELSE 1 END device_bound FROM orders WHERE id=?`).bind(order[1]).first();
  if(!o)throw new HttpError(404,'not_found');
  const [items,payments,notes,refunds]=await env.DB.batch([
   stmt(env.DB,`SELECT i.id,i.product_id,i.version_id,i.title,i.price_vnd,i.duration_seconds,i.activation_days,e.id entitlement_id,e.status entitlement_status,e.activation_deadline,e.started_at,e.expires_at FROM order_items i LEFT JOIN entitlements e ON e.order_item_id=i.id WHERE i.order_id=? ORDER BY i.title`,o.id),
   stmt(env.DB,`SELECT id,external_id,reference,payment_code,amount_vnd,transaction_at,received_at,direction,bank_valid,status,note,reconciled_at,reconciled_by FROM payments WHERE order_id=? OR payment_code=? ORDER BY received_at DESC LIMIT 100`,o.id,o.payment_code),
   stmt(env.DB,`SELECT id,actor,note,created_at FROM support_notes WHERE order_id=? ORDER BY created_at DESC LIMIT 50`,o.id),
   stmt(env.DB,`SELECT id,status,amount_vnd,recorded_at,completed_at,actor,note FROM refunds WHERE order_id=? ORDER BY recorded_at DESC LIMIT 50`,o.id)
  ]);
  return json({order:o,items:items.results,payments:payments.results,notes:notes.results,refunds:refunds.results});
 }
 const product=path.match(/^\/admin\/api\/products\/([a-z0-9_-]{1,64})$/);
 const versions=path.match(/^\/admin\/api\/products\/([a-z0-9_-]{1,64})\/versions$/);
 const upload=path.match(/^\/admin\/api\/products\/([a-z0-9_-]{1,64})\/upload$/);
 const thumbnail=path.match(/^\/admin\/api\/products\/([a-z0-9_-]{1,64})\/thumbnail$/);
 if(thumbnail&&method==='PUT'){
  requireValue((request.headers.get('Content-Type')||'').split(';')[0]==='image/webp',415,'webp_required');
  requireValue(Number(request.headers.get('Content-Length')||0)<=1048576,413,'image_too_large');
  const reader=request.body?.getReader();requireValue(reader,400,'image_required');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw new HttpError(413,'image_too_large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
  const chunk=String.fromCharCode(...bytes.slice(12,16));
  const riffSize=size>=8?(bytes[4]|bytes[5]<<8|bytes[6]<<16|bytes[7]<<24)>>>0:0;
  requireValue(size>=20&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(chunk)&&riffSize===size-8,400,'invalid_webp');
  const before=await env.DB.prepare('SELECT id,thumbnail FROM products WHERE id=?').bind(thumbnail[1]).first();
  if(!before)throw new HttpError(404,'not_found');
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const key=`thumbnails/${before.id}/${digest}.webp`,url=`/api/thumbnails/${before.id}/${digest}.webp`;
  if(before.thumbnail===url)return json({thumbnail:url,unchanged:true});
  await env.SIMULATIONS.put(key,bytes,{httpMetadata:{contentType:'image/webp',cacheControl:'public, max-age=31536000, immutable'}});
  const now=iso();await env.DB.batch([
   stmt(env.DB,'UPDATE products SET thumbnail=?,updated_at=? WHERE id=?',url,now,before.id),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) VALUES (?,?,?,?,?,?,?)`,crypto.randomUUID(),actor,'product.thumbnail','product',before.id,now,JSON.stringify({from:before.thumbnail,to:url}))
  ]);
  return json({thumbnail:url});
 }
 if(upload&&method==='POST'){
  const id=upload[1],input=await jsonBody(request,6000000);
  objectShape(input,['format','original_base64','delivery_base64','sha256','delivery_sha256']);
  requireValue(input.format==='bingenz-admin-html-v1'&&/^[a-f0-9]{64}$/.test(input.sha256||'')&&/^[a-f0-9]{64}$/.test(input.delivery_sha256||''),400,'invalid_package');
  const decode=value=>{
   requireValue(typeof value==='string'&&value.length>0&&value.length<=2800000&&/^[A-Za-z0-9+/]+={0,2}$/.test(value),400,'invalid_package');
   try{const binary=atob(value),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));requireValue(bytes.length>0&&bytes.length<=2097152,413,'html_too_large');return bytes;}
   catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'invalid_package');}
  };
  const original=decode(input.original_base64),delivery=decode(input.delivery_base64);
  const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  requireValue(await digest(original)===input.sha256&&await digest(delivery)===input.delivery_sha256,400,'hash_mismatch');
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(delivery);}catch{throw new HttpError(400,'invalid_delivery');}
  requireValue(/<html[\s>]/i.test(text)&&/<body[\s>]/i.test(text)&&!/<(?:script\s+[^>]*src|iframe|object|embed|base)\b/i.test(text)&&!/sourceMappingURL/i.test(text),400,'invalid_delivery');
  const before=await env.DB.prepare('SELECT id,current_version_id FROM products WHERE id=?').bind(id).first();
  if(!before)throw new HttpError(404,'not_found');
  const existing=await env.DB.prepare('SELECT id FROM product_versions WHERE product_id=? AND sha256=?').bind(id,input.sha256).first();
  if(existing)return json({version_id:existing.id,unchanged:true});
  const version='ver_'+(await hash(id+input.sha256)).slice(0,32),now=iso();
  const originalKey=`originals/${id}/${input.sha256}.html`,deliveryKey=`delivery/${id}/${input.delivery_sha256}.html`;
  // Content-addressed private writes complete before the database can reference either object.
  await env.SIMULATIONS.put(originalKey,original,{httpMetadata:{contentType:'text/html; charset=utf-8',cacheControl:'private, no-store'}});
  await env.SIMULATIONS.put(deliveryKey,delivery,{httpMetadata:{contentType:'text/html; charset=utf-8',cacheControl:'private, no-store'}});
  await env.DB.batch([
   stmt(env.DB,'INSERT INTO product_versions(id,product_id,sha256,original_key,delivery_key,bytes,created_at) VALUES (?,?,?,?,?,?,?)',version,id,input.sha256,originalKey,deliveryKey,original.length,now),
   stmt(env.DB,'UPDATE products SET current_version_id=?,updated_at=? WHERE id=?',version,now,id),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) VALUES (?,?,?,?,?,?,?)`,crypto.randomUUID(),actor,'product.upload','product',id,now,JSON.stringify({from:before.current_version_id,to:version,sha256:input.sha256,delivery_sha256:input.delivery_sha256}))
  ]);
  return json({version_id:version,sha256:input.sha256},201);
 }
 if(versions&&method==='GET'){
  const p=await env.DB.prepare('SELECT id,current_version_id FROM products WHERE id=?').bind(versions[1]).first();
  if(!p)throw new HttpError(404,'not_found');
  const rows=await env.DB.prepare('SELECT id,sha256,bytes,created_at FROM product_versions WHERE product_id=? ORDER BY created_at DESC').bind(p.id).all();
  return json({current_version_id:p.current_version_id,versions:rows.results});
 }
 if(versions&&method==='POST'){
  const input=await jsonBody(request,1024);objectShape(input,['version_id']);
  requireValue(typeof input.version_id==='string'&&/^[a-z0-9_-]{1,128}$/.test(input.version_id),400,'invalid_version');
  const before=await env.DB.prepare('SELECT id,current_version_id FROM products WHERE id=?').bind(versions[1]).first();
  if(!before)throw new HttpError(404,'not_found');
  const target=await env.DB.prepare('SELECT id FROM product_versions WHERE id=? AND product_id=?').bind(input.version_id,before.id).first();
  if(!target)throw new HttpError(404,'not_found');
  if(before.current_version_id===target.id)return json({current_version_id:target.id,unchanged:true});
  const updated=iso();
  const result=await env.DB.batch([
   stmt(env.DB,'UPDATE products SET current_version_id=?,updated_at=? WHERE id=? AND current_version_id=?',target.id,updated,before.id,before.current_version_id),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata)
   SELECT ?,?,'product.rollback','product',?,?,? WHERE changes()=1`,crypto.randomUUID(),actor,before.id,updated,JSON.stringify({from:before.current_version_id,to:target.id}))
  ]);
  if(result[0].meta.changes!==1)throw new HttpError(409,'product_changed');
  return json({current_version_id:target.id});
 }
 if(product&&method==='PATCH'){
  const id=product[1],input=await jsonBody(request,8192);objectShape(input,editable);
  requireValue(Object.keys(input).length>0);
  validateProduct(input);
  const before=await env.DB.prepare(`SELECT ${productFields} FROM products WHERE id=?`).bind(id).first();
  if(!before)throw new HttpError(404,'not_found');
  const updated=iso(),fields=Object.keys(input);
  const after={...before,...input,updated_at:updated};
  // D1 batch is one transaction: a successful edit cannot exist without its audit row.
  await env.DB.batch([
   stmt(env.DB,`UPDATE products SET ${fields.map(k=>k+'=?').join(',')},updated_at=? WHERE id=?`,...fields.map(k=>input[k]),updated,id),
   stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata) VALUES (?,?,?,?,?,?,?)`,crypto.randomUUID(),actor,'product.update','product',id,updated,JSON.stringify({before,after}))
  ]);
  return json({product:after});
 }
 throw new HttpError(404,'not_found');
}
