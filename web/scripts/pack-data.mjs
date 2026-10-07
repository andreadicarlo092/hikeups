// Impacchetta web/static/data in web/pilot-data/data.b64.N (vedi scripts/unpack-data.mjs).
import { brotliCompressSync, constants } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] || join(web, 'static', 'data');
const bundle = {};
function walk(dir) {
	for (const name of readdirSync(dir).sort()) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p);
		else bundle[relative(src, p).split('\\').join('/')] = JSON.parse(readFileSync(p, 'utf8'));
	}
}
walk(src);
const dest = join(web, 'pilot-data');
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const packed = brotliCompressSync(Buffer.from(JSON.stringify(bundle)), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
const lines = packed.toString('base64').match(/.{1,100}/g);
const PER_FILE = 48;
for (let i = 0, k = 0; i < lines.length; i += PER_FILE, k++) {
	writeFileSync(join(dest, `data.b64.${k}`), lines.slice(i, i + PER_FILE).join('\n') + '\n');
}
console.log(`${Object.keys(bundle).length} file -> ${lines.length} righe base64 in pilot-data/`);
