import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
const source = process.argv[2];
const { inventory } = JSON.parse(await readFile('docs/commerce/SIMULATION_INVENTORY.json','utf8'));
await mkdir('test-results/audit',{recursive:true});
const browser = await chromium.launch();
const results=[];
try {
  for (const item of inventory) {
    const html = await readFile(join(source,item.filename),'utf8');
    const {document} = parseHTML(html);
    const record={filename:item.filename, title:document.title, controls:[...document.querySelectorAll('button,input,select')].map(n=>({tag:n.tagName,id:n.id,text:n.textContent.trim(),type:n.getAttribute('type')})), views:[]};
    for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,reducedMotion:'reduce'});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.goto(pathToFileURL(join(source,item.filename)).href);
      await page.waitForTimeout(150);
      const primary=page.locator('#run, #runBtn, #scanAction, #replayBtn').first();
      if(await primary.count() && await primary.isEnabled()) await primary.click();
      // The original simulations implement reduced-motion timing for normal run cycles.
      await page.waitForTimeout(2500);
      const view=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth, status:document.querySelector('#status,.status-line')?.textContent, controls:[...document.querySelectorAll('.dock button,.dock select,.dock input')].map(n=>{const r=n.getBoundingClientRect();return {id:n.id,text:n.textContent.trim(),visible:r.width>0&&r.height>0,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};})}));
      await page.screenshot({path:`test-results/audit/${item.slug}-${viewport.width}.png`});
      record.views.push({viewport,...view,errors});
      await page.close();
    }
    results.push(record);
    await writeFile('docs/commerce/BASELINE_SIMULATION_TESTS.json',JSON.stringify(results,null,2)+'\n');
    console.log(`${item.filename}: ${record.views.every(v=>!v.errors.length&&!v.overflow)?'baseline pass':'REVIEW'}`);
  }
} finally {await browser.close();}
