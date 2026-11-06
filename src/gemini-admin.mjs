import {HttpError,json,jsonBody,objectShape,requireValue,iso} from './security.mjs';
import {stmt} from './db.mjs';
const scope=includeAll=>includeAll?'1':"product_family='gemini'";
const snapshotQuery=includeAll=>`SELECT json_group_array(json_object('id',id,'price_vnd',price_vnd)) snapshot FROM (SELECT id,price_vnd FROM gemini_plans WHERE ${scope(includeAll)} ORDER BY id)`;
export async function geminiPrices(env,includeAll=false){
 const snapshotSql=snapshotQuery(includeAll);
 const [plans,snapshot]=await env.DB.batch([
  stmt(env.DB,`SELECT id,title,category,months,price_vnd,active,product_family FROM gemini_plans WHERE ${scope(includeAll)} ORDER BY product_family,months`),
  stmt(env.DB,snapshotSql)
 ]);
 return {plans:plans.results,snapshot:snapshot.results[0].snapshot};
}
export async function updateGeminiPrices(request,env,actor,includeAll=false){
 const snapshotSql=snapshotQuery(includeAll);
 const input=await jsonBody(request,16384);objectShape(input,['prices','snapshot']);
 requireValue(Array.isArray(input.prices)&&input.prices.length>0&&input.prices.length<=50&&typeof input.snapshot==='string'&&input.snapshot.length<=8192,400,'invalid_gemini_prices');
 for(const price of input.prices){
  objectShape(price,['id','price_vnd']);
  requireValue(typeof price.id==='string'&&/^[a-z0-9-]{1,64}$/.test(price.id)&&Number.isSafeInteger(price.price_vnd)&&price.price_vnd>=1&&price.price_vnd<=100000000,400,'invalid_gemini_prices');
 }
 requireValue(new Set(input.prices.map(p=>p.id)).size===input.prices.length,400,'invalid_gemini_prices');
 const current=await env.DB.prepare(snapshotSql).first();
 if(current.snapshot!==input.snapshot)throw new HttpError(409,'gemini_prices_changed');
 const before=JSON.parse(current.snapshot);
 requireValue(before.length===input.prices.length&&before.every(p=>input.prices.some(v=>v.id===p.id)),400,'invalid_gemini_prices');
 const prices=JSON.stringify(input.prices),now=iso();
 const result=await env.DB.batch([
  stmt(env.DB,`WITH guard AS MATERIALIZED (SELECT (${snapshotSql})=? ok), prices AS (SELECT json_extract(value,'$.id') id,json_extract(value,'$.price_vnd') price_vnd FROM json_each(?))
   UPDATE gemini_plans SET price_vnd=(SELECT price_vnd FROM prices WHERE prices.id=gemini_plans.id)
   WHERE (SELECT ok FROM guard) AND ${scope(includeAll)} RETURNING id`,input.snapshot,prices),
  stmt(env.DB,`INSERT INTO admin_audit_logs(id,actor,action,object_type,object_id,created_at,metadata)
   SELECT ?,?,'${includeAll?'ai.prices.update':'gemini.prices.update'}','gemini_plans','prices',?,? WHERE changes()=?`,crypto.randomUUID(),actor,now,JSON.stringify({before,after:input.prices}),before.length)
 ]);
 if(result[0].results.length!==before.length)throw new HttpError(409,'gemini_prices_changed');
 const catalog=await geminiPrices(env,includeAll);
 return json(catalog);
}
