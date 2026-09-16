import { readBody,verifyWebhook,requireValue,hash,iso,json } from './security.mjs';
import { stmt } from './db.mjs';
export function transactionTime(value){
 requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value),400,'invalid_transaction_time');
 const time=Date.parse(value.replace(' ','T')+'+07:00');requireValue(Number.isFinite(time),400,'invalid_transaction_time');
 requireValue(new Date(time+7*3600000).toISOString().slice(0,19)===value.replace(' ','T'),400,'invalid_transaction_time');
 return new Date(time).toISOString();
}
export async function webhook(request,env){
 requireValue(new URL(request.url).protocol==='https:'||new URL(request.url).hostname==='localhost'||new URL(request.url).hostname==='127.0.0.1',400,'https_required');
 const raw=await readBody(request,32768),now=iso(),bodyHash=await hash(raw);
 if(!await verifyWebhook(raw,request.headers,env.SEPAY_WEBHOOK_SECRET)) {
  // Do not store an untrusted body or attacker-provided ID in the event log.
  console.warn(JSON.stringify({event:'webhook_rejected',reason:'signature'}));
  return json({success:false},401);
 }
 let b;try{b=JSON.parse(raw);}catch{return json({success:false},400);}
 requireValue(b&&typeof b==='object'&&Number.isSafeInteger(b.id)&&b.id>0,400,'invalid_transaction');
 requireValue(Number.isSafeInteger(b.transferAmount)&&b.transferAmount>=0&&b.transferAmount<=100000000000,400,'invalid_amount');
 requireValue(['in','out'].includes(b.transferType)&&typeof b.accountNumber==='string'&&b.accountNumber.length<=64,400,'invalid_transaction');
 requireValue(typeof b.referenceCode==='string'&&b.referenceCode.length<=200,400,'invalid_reference');
 const code=typeof b.code==='string'&&/^BGZ[A-Z0-9]{12}$/.test(b.code)?b.code:null;
 requireValue(env.BANK_ACCOUNT_NUMBER&&env.BANK_CODE,503,'payment_configuration_required');
 const bankValid=b.accountNumber===env.BANK_ACCOUNT_NUMBER&&b.gateway===env.BANK_CODE?1:0;
 const txAt=transactionTime(b.transactionDate),id=crypto.randomUUID();
 await env.DB.batch([
  stmt(env.DB,`INSERT INTO payments(id,external_id,reference,payment_code,amount_vnd,transaction_at,received_at,direction,bank_valid,status) VALUES (?,?,?,?,?,?,?,?,?,'candidate') ON CONFLICT(external_id) DO NOTHING`,id,String(b.id),b.referenceCode,code,b.transferAmount,txAt,now,b.transferType,bankValid),
  stmt(env.DB,`INSERT INTO webhook_events(id,external_id,received_at,outcome,body_hash) VALUES (?,?,?,'accepted',?)`,crypto.randomUUID(),String(b.id),now,bodyHash)
 ]);
 return json({success:true});
}
