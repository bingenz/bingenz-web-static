import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {importSQL} from '../scripts/import-sql.mjs';
import {transform} from '../scripts/prepare-products.mjs';
test('import resumes after partial version insert and preserves metadata/rollback',()=>{
 const db=new DatabaseSync(':memory:');
 for(const file of ['0001_commerce.sql','0002_import_state.sql'])db.exec(readFileSync('migrations/'+file,'utf8'));
 const item={id:'p',source_key:'p.html',slug:'p',title:"Product's title",thumbnail:'/thumb.webp',version:'v1',sha256:'a'.repeat(64),original_key:'original1',delivery_key:'delivery1',bytes:100};
 db.exec(importSQL(item,'2026-01-01'));db.exec("UPDATE products SET title='Edited',price_vnd=20000");
 db.exec(importSQL(item,'2026-01-02'));assert.equal(db.prepare('SELECT count(*) n FROM product_versions').get().n,1);
 assert.equal(db.prepare('SELECT title FROM products').get().title,'Edited');
 const next={...item,version:'v2',sha256:'b'.repeat(64),original_key:'original2',delivery_key:'delivery2'};
 const partial=importSQL(next,'2026-01-03').split('\n');db.exec(partial.slice(0,2).join('\n'));
 db.exec(importSQL(next,'2026-01-04'));assert.equal(db.prepare('SELECT current_version_id FROM products').get().current_version_id,'v2');
 db.exec("UPDATE products SET current_version_id='v1'");db.exec(importSQL(next,'2026-01-05'));
 assert.equal(db.prepare('SELECT current_version_id FROM products').get().current_version_id,'v1');
 assert.equal(db.prepare('SELECT count(*) n FROM product_versions').get().n,2);db.close();
});
test('safe transform removes development metadata and keeps cross-script globals',async()=>{
 const html='<!doctype html><html><head><meta name="author" content="private"></head><body><!-- secret comment --><script>const sharedValue=4;</script><script>function readValue(){return sharedValue;} console.log(readValue());</script></body></html>';
 const out=await transform(html);assert.ok(!out.includes('private'));assert.ok(!out.includes('secret comment'));assert.ok(out.includes('sharedValue'));
 await assert.rejects(transform('<html><body><script src="https://evil.test/x.js"></script></body></html>'));
});
