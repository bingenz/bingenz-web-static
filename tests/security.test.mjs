import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { gmail,paymentCode,randomToken,hash,sign,verify,verifyWebhook,jsonBody } from '../src/security.mjs';
import { transactionTime } from '../src/payments.mjs';
const secret='test-only-signing-key-not-a-production-credential';
test('Gmail aliases are canonicalized only for abuse detection',()=>{
 assert.deepEqual(gmail(' Buyer.Name+tag@gmail.com '),{address:'buyer.name+tag@gmail.com',canonical:'buyername'});
 for(const v of ['a@evil.com','a@gmail.com.evil','a..b@gmail.com','@gmail.com'])assert.throws(()=>gmail(v));
});
test('credentials and payment codes have cryptographic opaque formats',async()=>{
 const codes=new Set(Array.from({length:1000},paymentCode));assert.equal(codes.size,1000);
 for(const c of codes)assert.match(c,/^BGZ[A-Z0-9]{12}$/);
 assert.match(randomToken(),/^[A-Za-z0-9_-]{43}$/);assert.equal((await hash(randomToken())).length,64);
});
test('signed sessions reject tampering, wrong purpose and expiration',async()=>{
 const t=await sign({purpose:'session',exp:Date.now()+60000},secret);
 assert.ok(await verify(t,secret,'session'));
 assert.equal(await verify(t,secret,'play'),null);
 assert.equal(await verify(t+'a',secret,'session'),null);
 assert.equal(await verify(await sign({purpose:'session',exp:1},secret),secret,'session'),null);
});
test('SePay HMAC authenticates exact raw bytes and rejects stale/future timestamps',async()=>{
 const raw='{"id":1}',now=Date.now(),t=String(Math.floor(now/1000));
 const headers=new Headers({'X-SePay-Timestamp':t,'X-SePay-Signature':'sha256='+createHmac('sha256',secret).update(t+'.'+raw).digest('hex')});
 assert.equal(await verifyWebhook(raw,headers,secret,now),true);
 assert.equal(await verifyWebhook(raw+' ',headers,secret,now),false);
 assert.equal(await verifyWebhook(raw,headers,secret,now+301000),false);
 assert.equal(await verifyWebhook(raw,headers,secret,now-301000),false);
});
test('transaction date rejects normalized impossible calendar dates',()=>{
 assert.equal(transactionTime('2026-09-17 07:00:00'),'2026-09-17T00:00:00.000Z');
 assert.throws(()=>transactionTime('2026-02-30 07:00:00'));
});
test('request byte limit is enforced even without Content-Length',async()=>{
 await assert.rejects(jsonBody(new Request('https://example.com',{method:'POST',headers:{'Content-Type':'application/json'},body:'"'+'x'.repeat(100)+'"'}),10),e=>e.status===413);
});
