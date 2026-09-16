import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/audit-simulations.mjs <live-directory>');
async function scan(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await scan(path));
    else if (/\.html$/i.test(entry.name)) found.push(path);
  }
  return found.sort();
}
const inventory = [];
for (const path of await scan(root)) {
  const bytes = await readFile(path);
  const html = bytes.toString('utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const errors = [];
  for (const [index, script] of scripts.entries()) {
    if (/src=|type=["'](?:module|application\/)/i.test(script[1])) continue;
    try { new vm.Script(script[2], { filename: `${path}:script-${index}` }); }
    catch (error) { errors.push(error.message); }
  }
  inventory.push({
    filename: relative(root, path).replaceAll('\\', '/'),
    slug: relative(root, path).replace(/\.html$/i, '').replaceAll('\\', '-'),
    title: html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? null,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    scripts: scripts.length,
    scriptHashes: scripts.map(s => createHash('sha256').update(s[2]).digest('hex')),
    functions: [...html.matchAll(/function\s+([\w$]+)\s*\(/g)].map(m => m[1]),
    externalAssets: [...html.matchAll(/(?:src|href)=["'](https?[^"']+)/g)].map(m => m[1]),
    sensitiveAPIs: [...new Set(html.match(/\b(?:localStorage|sessionStorage|serviceWorker|fetch|XMLHttpRequest|WebSocket|eval|postMessage|getUserMedia)\b/g) ?? [])],
    syntaxErrors: errors,
  });
}
await writeFile('docs/commerce/SIMULATION_INVENTORY.json', JSON.stringify({ source: root, inventory }, null, 2) + '\n');
console.log(JSON.stringify(inventory.map(({filename,title,functions,externalAssets,sensitiveAPIs,syntaxErrors}) => ({filename,title,functions,externalAssets,sensitiveAPIs,syntaxErrors})), null, 2));
if (inventory.some(item => item.syntaxErrors.length)) process.exitCode = 1;
