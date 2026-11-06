import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {createAiSchemaGuard} from '../src/ai-schema.mjs';
import migration from '../src/ai-migration.json' with {type:'json'};
let mf;
before(()=>{mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-16',d1Databases:['concurrent','rollback','partial','manual']}));});
after(async()=>{await mf?.dispose();});
async function baseline(name){
 const db=await mf.getD1Database(name);
 await db.prepare('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').run();
 for(const file of ['0001_commerce.sql','0002_import_state.sql','0003_payment_second_precision.sql','0004_fix_payment_trigger.sql','0005_restore_payment_window.sql','0006_standardize_product_price.sql','0007_gemini_orders.sql']){
  await db.batch([...unstable_splitSqlQuery(await readFile('migrations/'+file,'utf8')).map(sql=>db.prepare(sql)),db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(file)]);
 }
 await db.prepare("UPDATE gemini_plans SET price_vnd=88000 WHERE id='account-1'").run();
 await db.prepare(`INSERT INTO orders(id,gmail,gmail_key,cart_key,cart_json,checkout_hash,payment_code,total_vnd,created_at,expires_at,kind,gemini_plan_id,gemini_title,gemini_months)
 VALUES ('legacy','legacy@gmail.com','legacy','cart','["gemini:account-1"]','hash','BGZ23456789ABCD',88000,'2026-01-01T00:00:00.000Z','2026-01-01T00:15:00.000Z','gemini','account-1','Gemini Pro · Cấp tài khoản · 1 tháng',1)`).run();
 return db;
}
test('AI bundled migration matches SQL parsed by Wrangler',async()=>{
 assert.deepEqual(migration.statements,unstable_splitSqlQuery(await readFile('migrations/'+migration.name,'utf8')));
});
test('concurrent AI initialization preserves Gemini prices and snapshots and runs once',async()=>{
 const db=await baseline('concurrent');
 const before=await db.prepare("SELECT * FROM orders WHERE id='legacy'").first();
 const guards=Array.from({length:4},()=>createAiSchemaGuard());
 await Promise.all(guards.flatMap(guard=>[guard(db),guard(db)]));
 assert.deepEqual(await db.prepare("SELECT * FROM orders WHERE id='legacy'").first(),{...before,product_family:'gemini'});
 assert.equal((await db.prepare("SELECT price_vnd FROM gemini_plans WHERE id='account-1'").first()).price_vnd,88000);
 assert.deepEqual(await db.prepare("SELECT price_vnd,months,product_family FROM gemini_plans WHERE id='chatgpt-plus-1'").first(),{price_vnd:390000,months:1,product_family:'chatgpt'});
 assert.equal((await db.prepare('SELECT count(*) n FROM d1_migrations WHERE name=?').bind(migration.name).first()).n,1);
});
test('failed AI migration rolls back both schema and history and can retry',async()=>{
 const db=await baseline('rollback');
 const wrapper={prepare:sql=>db.prepare(sql),batch:statements=>db.batch(statements.length>3?[...statements,db.prepare('INSERT INTO intentionally_missing_table VALUES (1)')]:statements)};
 await assert.rejects(createAiSchemaGuard()(wrapper));
 assert.equal((await db.prepare('PRAGMA table_info(orders)').all()).results.some(c=>c.name==='product_family'),false);
 assert.equal((await db.prepare('SELECT count(*) n FROM gemini_plans').first()).n,5);
 assert.equal((await db.prepare('SELECT count(*) n FROM d1_migrations').first()).n,7);
 await createAiSchemaGuard()(db);
 assert.equal((await db.prepare('SELECT count(*) n FROM gemini_plans').first()).n,6);
});
test('partial AI schema is refused without repairing or changing legacy orders',async()=>{
 const db=await baseline('partial');
 await db.prepare("ALTER TABLE orders ADD COLUMN product_family TEXT DEFAULT 'gemini'").run();
 await assert.rejects(createAiSchemaGuard()(db),/ai_schema_partial/);
 assert.equal((await db.prepare('SELECT count(*) n FROM gemini_plans').first()).n,5);
 assert.equal((await db.prepare("SELECT total_vnd FROM orders WHERE id='legacy'").first()).total_vnd,88000);
});
test('CLI-preapplied AI migration preserves subsequent admin price changes',async()=>{
 const db=await baseline('manual');
 await db.batch([...migration.statements.map(sql=>db.prepare(sql)),db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(migration.name)]);
 await db.prepare("UPDATE gemini_plans SET price_vnd=400000 WHERE id='chatgpt-plus-1'").run();
 await createAiSchemaGuard()(db);
 assert.equal((await db.prepare("SELECT price_vnd FROM gemini_plans WHERE id='chatgpt-plus-1'").first()).price_vnd,400000);
 assert.equal((await db.prepare('SELECT count(*) n FROM d1_migrations').first()).n,8);
});
