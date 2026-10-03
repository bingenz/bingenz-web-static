import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {createGeminiSchemaGuard} from '../src/gemini-schema.mjs';
import migration from '../src/gemini-migration.json' with {type:'json'};
let mf;
before(()=>{mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-09-16',d1Databases:['success','failure','partial','manual']}));});
after(async()=>{await mf?.dispose();});
async function baseline(name){
 const db=await mf.getD1Database(name);
 await db.prepare('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').run();
 for(const file of ['0001_commerce.sql','0002_import_state.sql','0003_payment_second_precision.sql','0004_fix_payment_trigger.sql','0005_restore_payment_window.sql','0006_standardize_product_price.sql']){
  await db.batch([...unstable_splitSqlQuery(await readFile('migrations/'+file,'utf8')).map(sql=>db.prepare(sql)),db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(file)]);
 }
 await db.prepare("INSERT INTO products(id,slug,title,created_at,updated_at) VALUES ('existing','existing','Existing product','2026-01-01','2026-01-01')").run();
 await db.prepare("INSERT INTO product_versions VALUES ('v','existing',?,'original','delivery',123,'2026-01-01')").bind('a'.repeat(64)).run();
 await db.prepare("UPDATE products SET current_version_id='v'").run();
 await db.prepare(`INSERT INTO orders(id,gmail,gmail_key,cart_key,cart_json,checkout_hash,payment_code,total_vnd,created_at,expires_at) VALUES ('existing','existing@gmail.com','existing','cart','["existing"]','hash','BGZ23456789ABCD',9000,'2026-01-01T00:00:00.000Z','2026-01-01T00:15:00.000Z')`).run();
 return db;
}
test('bundled migration is exactly the reviewed SQL, split by the actual Wrangler parser',async()=>{
 assert.deepEqual(migration.statements,unstable_splitSqlQuery(await readFile('migrations/'+migration.name,'utf8')));
});
test('concurrent release startup applies migration once and preserves existing orders and payment fulfillment',async()=>{
 const db=await baseline('success');
 const old=(await db.prepare('SELECT * FROM order_items').all()).results;
 const guards=Array.from({length:4},()=>createGeminiSchemaGuard());
 await Promise.all(guards.flatMap(guard=>[guard(db),guard(db)]));
 assert.equal((await db.prepare('SELECT count(*) n FROM d1_migrations WHERE name=?').bind(migration.name).first()).n,1);
 assert.equal((await db.prepare('SELECT count(*) n FROM gemini_plans').first()).n,5);
 assert.deepEqual((await db.prepare('SELECT * FROM order_items').all()).results,old);
 assert.equal((await db.prepare('SELECT kind FROM orders').first()).kind,'simulation');
 await db.prepare("INSERT INTO payments(id,external_id,reference,payment_code,amount_vnd,transaction_at,received_at,direction,bank_valid,status) VALUES ('pay','1','ref','BGZ23456789ABCD',9000,'2026-01-01T00:01:00.000Z','2026-01-01T00:01:01.000Z','in',1,'candidate')").run();
 assert.equal((await db.prepare('SELECT status FROM orders').first()).status,'paid');
 assert.equal((await db.prepare('SELECT count(*) n FROM entitlements').first()).n,1);
 await createGeminiSchemaGuard()(db);
 assert.equal((await db.prepare('SELECT count(*) n FROM d1_migrations').first()).n,7);
});
test('failed migration rolls back schema and history atomically, then can retry',async()=>{
 const db=await baseline('failure');
 const wrapper={prepare:sql=>db.prepare(sql),batch:statements=>db.batch(statements.length>2?[...statements,db.prepare('INSERT INTO intentionally_missing_table VALUES (1)')]:statements)};
 await assert.rejects(createGeminiSchemaGuard()(wrapper));
 assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name='gemini_plans'").first(),null);
 assert.equal((await db.prepare('PRAGMA table_info(orders)').all()).results.some(c=>c.name==='kind'),false);
 assert.equal((await db.prepare('SELECT count(*) n FROM d1_migrations').first()).n,6);
 assert.equal((await db.prepare('SELECT count(*) n FROM order_items').first()).n,1);
 await createGeminiSchemaGuard()(db);
 assert.equal((await db.prepare('SELECT count(*) n FROM gemini_plans').first()).n,5);
});
test('partial schemas are refused without changing existing data',async()=>{
 const db=await baseline('partial');await db.prepare("ALTER TABLE orders ADD COLUMN kind TEXT DEFAULT 'simulation'").run();
 await assert.rejects(createGeminiSchemaGuard()(db),/gemini_schema_partial/);
 assert.equal((await db.prepare('SELECT count(*) n FROM d1_migrations').first()).n,6);
 assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name='gemini_plans'").first(),null);
});
test('a migration already applied by Wrangler is a no-op at runtime',async()=>{
 const db=await baseline('manual');await db.batch([...migration.statements.map(sql=>db.prepare(sql)),db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(migration.name)]);
 await db.prepare("UPDATE gemini_plans SET active=0 WHERE id='account-1'").run();
 await createGeminiSchemaGuard()(db);
 assert.equal((await db.prepare("SELECT active FROM gemini_plans WHERE id='account-1'").first()).active,0);
 assert.equal((await db.prepare('SELECT count(*) n FROM d1_migrations').first()).n,7);
});
