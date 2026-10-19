import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const dist = path.resolve('dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html not found — run `npm run build` first');
  process.exit(1);
}
const out = path.resolve('nabey-bryushko-yandex.zip');
const output = fs.createWriteStream(out);
const archive = archiver('zip', { zlib: { level: 9 } });
output.on('close', () => console.log(`${out} — ${(archive.pointer() / 1024).toFixed(0)} KB`));
archive.on('error', (e) => {
  throw e;
});
archive.pipe(output);
archive.directory(dist, false);
await archive.finalize();
