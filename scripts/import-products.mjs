import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { sha } from './prepare-products.mjs';
import { importSQL } from './import-sql.mjs';
const args=process.argv.slice(2),remote=args.includes('--remote');
function option(name,fallback){const n=args.indexOf(name);return n>=0?args[n+1]:fallback;}
const config=option('--config','wrangler.local.toml'),bucket=option('--bucket','bingenz-commerce-local');
if(remote&&(!args.includes('--config')||!args.includes('--bucket')||config==='wrangler.local.toml'))throw new Error('Remote import requires explicit production/preview --config and --bucket');
if(!remote&&(config!=='wrangler.local.toml'||bucket!=='bingenz-commerce-local'))throw new Error('Local import must target the local-only config and bucket');
if(!/^[a-z0-9-]+$/.test(bucket))throw new Error('Invalid bucket');
const manifest=JSON.parse(await readFile('.private/products/manifest.json','utf8'));
if(!manifest.complete||!manifest.items.length)throw new Error('Preparation incomplete; rerun prepare-products');
async function wrangler(args){
 return new Promise((resolvePromise,reject)=>{
  const p=spawn(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...args,'--config',config],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);
  p.on('error',reject);p.on('close',code=>code===0?resolvePromise(output):reject(new Error('Wrangler failed: '+output)));
 });
}
const sql=[],now=new Date().toISOString(),target=remote?'--remote':'--local';
for(const item of manifest.items){
 const original=await readFile(item.original_file),delivery=await readFile(item.delivery_file);
 if(sha(original)!==item.sha256||sha(delivery)!==item.delivery_sha256)throw new Error('Prepared bytes changed: '+item.source_key);
 // Idempotent content-addressed puts. Publish DB pointers only after both objects exist.
 await wrangler(['r2','object','put',bucket+'/'+item.original_key,target,'--file',item.original_file,'--content-type','text/html; charset=utf-8','--cache-control','private, no-store']);
 await wrangler(['r2','object','put',bucket+'/'+item.delivery_key,target,'--file',item.delivery_file,'--content-type','text/html; charset=utf-8','--cache-control','private, no-store']);
 sql.push(importSQL(item,now));
 console.log('Uploaded '+item.source_key);
}
await mkdir('.private/products',{recursive:true});const file='.private/products/import.sql';await writeFile(file,sql.join('\n'));
await wrangler(['d1','execute','DB',target,'--file',file,'--yes']);
const result=await wrangler(['d1','execute','DB',target,'--command','SELECT count(*) products FROM products; SELECT count(*) versions FROM product_versions;','--json']);
await writeFile(`.private/products/import-${remote?'remote':'local'}-result.json`,result);
console.log(`Imported ${manifest.items.length} products into ${remote?'REMOTE':'local'} ${config}; verification saved privately.`);
