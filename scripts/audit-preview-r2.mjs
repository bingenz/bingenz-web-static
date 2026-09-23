import { readFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const bucket='bingenz-commerce-preview',config='wrangler.preview.toml';
const manifest=JSON.parse(await readFile('.private/products/manifest.json','utf8'));
if(!manifest.complete||manifest.items.length!==35)throw new Error('Expected complete local manifest of 35 simulations');
const jobs=manifest.items.flatMap(item=>[
 {key:item.original_key,hash:item.sha256,bytes:item.bytes},
 {key:item.delivery_key,hash:item.delivery_sha256,bytes:item.delivery_bytes}
]);
const scratch=await mkdtemp(join(tmpdir(),'bgz-r2-audit-'));
let cursor=0,verified=0;
async function runWrangler(args){
 return new Promise((done,fail)=>{
  const child=spawn(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>output+=chunk.toString());
  child.on('error',fail);child.on('close',code=>code===0?done():fail(new Error(`Wrangler object read failed (${code}): ${output.slice(-1000)}`)));
 });
}
async function worker(){
 while(cursor<jobs.length){
  const index=cursor++,job=jobs[index],file=join(scratch,`object-${index}.html`);
  try{
   await runWrangler(['r2','object','get',`${bucket}/${job.key}`,'--remote','--file',file,'--config',config]);
   const bytes=await readFile(file),hash=createHash('sha256').update(bytes).digest('hex');
   if(bytes.length!==job.bytes||hash!==job.hash)throw new Error(`R2 integrity mismatch: ${job.key}`);
   verified++;
   if(verified%10===0||verified===jobs.length)console.log(`Verified ${verified}/${jobs.length} remote objects`);
  }finally{await unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 }
}
let outcomes;
try{outcomes=await Promise.allSettled([worker(),worker()]);}
finally{await rmdir(scratch);}
const failure=outcomes.find(result=>result.status==='rejected');
if(failure)throw failure.reason;
if(verified!==jobs.length)throw new Error(`Only ${verified}/${jobs.length} remote objects verified`);
console.log(`PASS: ${manifest.items.length} original/delivery pairs match local sizes and SHA-256 in isolated preview R2.`);
