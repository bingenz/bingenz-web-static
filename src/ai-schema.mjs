import migration from './ai-migration.json' with {type:'json'};
import {ensureGeminiSchema} from './gemini-schema.mjs';

async function schemaState(db) {
 const results=await db.batch([
  db.prepare('PRAGMA table_info(orders)'),
  db.prepare('PRAGMA table_info(gemini_plans)'),
  db.prepare("SELECT sql FROM sqlite_master WHERE name='validate_ai_family'")
 ]);
 const fields=results.slice(0,2).map(r=>r.results.some(c=>c.name==='product_family'));
 const trigger=results[2].results[0]?.sql;
 if(fields.every(Boolean)&&/product_family/.test(trigger||''))return 'ready';
 if(fields.some(Boolean)||trigger)throw new Error('ai_schema_partial');
 return 'pending';
}
export function createAiSchemaGuard(){
 const ready=new WeakSet(),inflight=new WeakMap();
 return async function ensureAiSchema(db){
  if(ready.has(db))return;
  if(inflight.has(db))return inflight.get(db);
  const task=(async()=>{
   await ensureGeminiSchema(db);
   if(await schemaState(db)==='pending'){
    try{
     await db.batch([...migration.statements.map(sql=>db.prepare(sql)),db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(migration.name)]);
    }catch(error){if(await schemaState(db)!=='ready')throw error;}
    if(await schemaState(db)!=='ready')throw new Error('ai_schema_not_ready');
   }
   ready.add(db);
  })();
  inflight.set(db,task);
  try{await task;}finally{inflight.delete(db);}
 };
}
export const ensureAiSchema=createAiSchemaGuard();
