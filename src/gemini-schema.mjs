import migration from './gemini-migration.json' with {type:'json'};

// A release-specific migration through the Worker's existing D1 binding.
// No request data or externally supplied SQL is used. D1 batch is atomic,
// including its migration-history marker; concurrent isolates safely retry
// only after verifying the complete schema committed by the winning isolate.
async function schemaState(db) {
 const [columns,objects] = await db.batch([
  db.prepare('PRAGMA table_info(orders)'),
  db.prepare("SELECT name,sql FROM sqlite_master WHERE name IN ('gemini_plans','validate_order','snapshot_order','validate_gemini_order','d1_migrations')")
 ]);
 const names=new Set(columns.results.map(c=>c.name)),definitions=new Map(objects.results.map(o=>[o.name,o.sql]));
 const fields=['kind','gemini_plan_id','gemini_title','gemini_months'];
 const ready=fields.every(k=>names.has(k))&&definitions.has('gemini_plans')&&definitions.has('validate_gemini_order')&&
  ['validate_order','snapshot_order'].every(k=>/WHEN\s+NEW\.kind\s*=\s*'simulation'/i.test(definitions.get(k)||''));
 if(ready)return 'ready';
 // Refuse a partially migrated or unknown database; never guess at repairs.
 if(fields.some(k=>names.has(k))||definitions.has('gemini_plans')||definitions.has('validate_gemini_order'))throw new Error('gemini_schema_partial');
 if(!names.has('cart_json')||!definitions.has('validate_order')||!definitions.has('snapshot_order')||!definitions.has('d1_migrations'))throw new Error('gemini_schema_baseline_required');
 return 'pending';
}
export function createGeminiSchemaGuard(){
 const ready=new WeakSet(),inflight=new WeakMap();
 return async function ensureGeminiSchema(db){
  if(ready.has(db))return;
  if(inflight.has(db))return inflight.get(db);
  const task=(async()=>{
   if(await schemaState(db)==='pending'){
    try{
     await db.batch([
      ...migration.statements.map(sql=>db.prepare(sql)),
      db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(migration.name)
     ]);
    }catch(error){
     // Another isolate may have completed the exact migration meanwhile.
     if(await schemaState(db)!=='ready')throw error;
    }
    if(await schemaState(db)!=='ready')throw new Error('gemini_schema_not_ready');
   }
   ready.add(db);
  })();
  inflight.set(db,task);
  try{await task;}finally{inflight.delete(db);}
 };
}
export const ensureGeminiSchema=createGeminiSchemaGuard();
