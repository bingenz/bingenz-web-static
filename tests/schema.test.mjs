import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function fixture(){
 const db=new DatabaseSync(':memory:');for(const file of ['0001_commerce.sql','0002_import_state.sql','0003_payment_second_precision.sql','0004_fix_payment_trigger.sql','0005_restore_payment_window.sql','0006_standardize_product_price.sql'])db.exec(readFileSync('migrations/'+file,'utf8'));
 db.exec(`INSERT INTO products(id,slug,title,created_at,updated_at) VALUES ('p','p','Demo','2026-01-01','2026-01-01');
 INSERT INTO product_versions VALUES ('v','p','${'a'.repeat(64)}','original','delivery',123,'2026-01-01');
 UPDATE products SET current_version_id='v';`);
 return db;
}
function order(db){db.prepare(`INSERT INTO orders(id,gmail,gmail_key,cart_key,cart_json,checkout_hash,payment_code,total_vnd,created_at,expires_at) VALUES ('o','a@gmail.com','a','cart','["p"]','hash','BGZ23456789ABCD',9000,'2026-01-01T00:00:00.000Z','2026-01-01T00:15:00.000Z')`).run();}
test('migration snapshots prices and atomic payment fulfillment deduplicates',()=>{
 const db=fixture();order(db);db.exec('UPDATE products SET price_vnd=20000');
 assert.equal(db.prepare('SELECT price_vnd FROM order_items').get().price_vnd,9000);
 const pay=db.prepare(`INSERT INTO payments(id,external_id,reference,payment_code,amount_vnd,transaction_at,received_at,direction,bank_valid,status) VALUES (?,?,?,'BGZ23456789ABCD',9000,'2026-01-01T00:01:00.000Z','2026-01-01T00:01:01.000Z','in',1,'candidate')`);
 pay.run('a','a','a');assert.equal(db.prepare('SELECT status FROM orders').get().status,'paid');
 assert.equal(db.prepare('SELECT count(*) n FROM entitlements').get().n,1);
 assert.throws(()=>pay.run('b','a','b'));pay.run('c','c','c');
 assert.equal(db.prepare('SELECT status FROM payments WHERE id=?').get('c').status,'already_paid');
 assert.equal(db.prepare('SELECT count(*) n FROM entitlements').get().n,1);db.close();
});
test('database refuses client price tampering and duplicate product cart',()=>{
 const db=fixture();
 const sql=`INSERT INTO orders(id,gmail,gmail_key,cart_key,cart_json,checkout_hash,payment_code,total_vnd,created_at,expires_at) VALUES ('o','a@gmail.com','a','cart',?,'hash','BGZ23456789ABCD',?,'2026-01-01','2026-01-02')`;
 assert.throws(()=>db.prepare(sql).run('["p"]',1),/invalid_total/);
 assert.throws(()=>db.prepare(sql).run('["p","p"]',18000),/duplicate_product/);db.close();
});
