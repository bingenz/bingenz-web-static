import { HttpError, json, jsonBody, objectShape, requireValue, iso } from './security.mjs';
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
  const rows=await env.DB.prepare(`SELECT o.id,o.gmail,o.total_vnd,o.status,o.payment_code,o.created_at,o.expires_at,o.paid_at,p.external_id,
   (SELECT group_concat(title, ', ') FROM order_items WHERE order_id=o.id) products
   FROM orders o LEFT JOIN payments p ON p.id=o.paid_payment_id
   WHERE ?='' OR o.id=? OR o.gmail LIKE ? ESCAPE '\\' OR o.payment_code=? OR p.external_id=?
   ORDER BY o.created_at DESC LIMIT 100`).bind(q,q,'%'+q.replace(/[\\%_]/g,'\\$&')+'%',q.toUpperCase(),q).all();
  return json({orders:rows.results});
 }
 const product=path.match(/^\/admin\/api\/products\/([a-z0-9_-]{1,64})$/);
 const versions=path.match(/^\/admin\/api\/products\/([a-z0-9_-]{1,64})\/versions$/);
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
