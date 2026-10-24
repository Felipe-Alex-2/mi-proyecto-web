import { readdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const root = 'dist/web/browser';
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}
const files = (await walk(root)).filter(
  (path) => !path.endsWith('.map') && !path.endsWith('precache.js') && !path.endsWith('sw.js'),
);
const hash = createHash('sha256');
for (const path of files.sort()) hash.update(await readFile(path));
const urls = files.map((path) => '/' + path.slice(root.length + 1).replaceAll('\\', '/'));
await writeFile(
  join(root, 'precache.js'),
  `self.__VESTA_VERSION=${JSON.stringify(hash.digest('hex').slice(0, 16))};self.__VESTA_PRECACHE=${JSON.stringify(urls)};`,
);
console.log(`PWA: ${urls.length} recursos preparados para instalación offline.`);
