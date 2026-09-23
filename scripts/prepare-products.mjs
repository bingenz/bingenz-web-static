import { readdir,readFile,writeFile,mkdir } from 'node:fs/promises';
import { join,resolve,relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { minify } from 'html-minifier-terser';
import { chromium } from 'playwright';
import sharp from 'sharp';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export async function transform(html){
 const {document}=parseHTML(html);
 if(!document.querySelector('html')||!document.querySelector('body'))throw new Error('HTML document/body required');
 if(document.querySelector('script[src],link[href],iframe,object,embed,base'))throw new Error('External dependencies/embedded documents require explicit review');
 document.querySelectorAll('meta[name="author"],meta[name="generator"],meta[http-equiv]').forEach(n=>n.remove());
 for(const node of document.querySelectorAll('script,style'))node.textContent=node.textContent.replace(/\/\/[#@]\s*sourceMappingURL=.*$/gm,'').replace(/\/\*[#@]\s*sourceMappingURL=[\s\S]*?\*\//g,'');
 return minify(document.toString(),{collapseWhitespace:true,removeComments:true,removeRedundantAttributes:true,minifyCSS:true,
  // Separate script tags share top-level names. Mangle function locals only.
  minifyJS:{compress:{toplevel:false},mangle:{toplevel:false},format:{comments:false},sourceMap:false}});
}
async function scan(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await scan(p));else if(e.isFile()&&/\.html$/i.test(e.name))out.push(p);}return out.sort();}
export async function prepare(source){
 const root=resolve(source),files=await scan(root),output=resolve('.private/products');
 if(!files.length)throw new Error('No current HTML files found');
 await mkdir(output,{recursive:true});await mkdir('public/product-thumbnails',{recursive:true});
 const browser=await chromium.launch(),items=[];
 try{for(const file of files){
  const original=await readFile(file),html=original.toString('utf8');if(original.length>2097152)throw new Error('Original exceeds 2 MiB: '+file);
  const sourceKey=relative(root,file).replaceAll('\\','/'),digest=sha(original),id='sim_'+sha(sourceKey).slice(0,24);
  const slug=sourceKey.replace(/\.html$/i,'').replace(/[^a-zA-Z0-9-]+/g,'-').toLowerCase();
  const {document}=parseHTML(html),title=(document.querySelector('h1')?.textContent||document.title||slug).trim();
  const delivery=await transform(html),deliveryHash=sha(delivery),version='ver_'+sha(id+digest).slice(0,32);
  const originalFile=join(output,digest+'.original.html'),deliveryFile=join(output,deliveryHash+'.delivery.html');
  await writeFile(originalFile,original);await writeFile(deliveryFile,delivery);
  const thumbnail=`/product-thumbnails/${id}-${digest.slice(0,12)}.webp`;
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(deliveryFile).href);await page.waitForTimeout(300);
  if(errors.length)throw new Error(sourceKey+': '+errors.join('; '));
  const primary=page.locator('#run,#runBtn,#scanAction').first();
  if(await primary.count()&&await primary.isEnabled())await primary.click();
  await page.waitForTimeout(1200);
  const visual=page.locator('.viz,.diagram-panel,.sensor-area,.canvas-section,.scan-panel,.battery-scene').first();
  const capture=await visual.count()?await visual.screenshot():await page.locator('.stage').screenshot();
  await sharp(capture).resize(600,450,{fit:'contain',background:'#0b1320'}).webp({quality:86}).toFile('public'+thumbnail);
  await page.close();
  items.push({id,version,source_key:sourceKey,slug,title,sha256:digest,delivery_sha256:deliveryHash,bytes:original.length,delivery_bytes:Buffer.byteLength(delivery),
   original_key:`originals/${id}/${digest}.html`,delivery_key:`delivery/${id}/${deliveryHash}.html`,original_file:originalFile,delivery_file:deliveryFile,thumbnail});
  await writeFile(join(output,'manifest.json'),JSON.stringify({source:root,complete:false,items},null,2)+'\n');
  console.log(`${items.length}/${files.length} prepared: ${sourceKey}`);
 }
 await writeFile(join(output,'manifest.json'),JSON.stringify({source:root,complete:true,items},null,2)+'\n');
 // Public audit metadata never contains the HTML bodies.
 await writeFile('docs/commerce/PREPARED_PRODUCTS.json',JSON.stringify(items.map(({original_file,delivery_file,...item})=>item),null,2)+'\n');
 }finally{await browser.close();}
 return items;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(!process.argv[2])throw new Error('Usage: node scripts/prepare-products.mjs <current simulation directory>');
 await prepare(process.argv[2]);
}
