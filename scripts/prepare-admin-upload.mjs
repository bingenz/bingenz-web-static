import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,basename,join } from 'node:path';
import { createHash } from 'node:crypto';
import { transform } from './prepare-products.mjs';

const source=process.argv[2];
if(!source||!/\.html$/i.test(source))throw new Error('Usage: node scripts/prepare-admin-upload.mjs <trusted-simulation.html>');
const bytes=await readFile(resolve(source));
if(!bytes.length||bytes.length>2097152)throw new Error('HTML must be 1 byte to 2 MiB');
const original=bytes.toString('utf8');
if(!Buffer.from(original).equals(bytes))throw new Error('HTML must be valid UTF-8');
const delivery=Buffer.from(await transform(original),'utf8');
if(!delivery.length||delivery.length>2097152)throw new Error('Prepared HTML exceeds 2 MiB');
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const packageData={format:'bingenz-admin-html-v1',sha256:sha(bytes),delivery_sha256:sha(delivery),original_base64:bytes.toString('base64'),delivery_base64:delivery.toString('base64')};
const output=resolve('.private/admin-upload');await mkdir(output,{recursive:true});
const file=join(output,basename(source).replace(/\.html$/i,'')+'-'+packageData.sha256.slice(0,12)+'.json');
await writeFile(file,JSON.stringify(packageData));
console.log(`Prepared private admin upload: ${file}`);
