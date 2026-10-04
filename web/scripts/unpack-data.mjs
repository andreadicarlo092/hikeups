// Scompatta i dati del pilota (web/pilot-data/data.b64.0, .1, ...) in web/static/data.
// Serve al build di anteprima su Vercel: web/static/data e' ignorato da git perche' di norma
// lo genera l'ETL (scripts/sync-data.sh). Il file contiene, in base64, un unico JSON {percorso: oggetto}
// compresso con brotli. Per rigenerarlo: node scripts/pack-data.mjs
import { brotliDecompressSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(web, 'pilot-data');
const parts = readdirSync(dir).filter((f) => /^data\.b64\.\d+$/.test(f)).sort((a, b) => Number(a.split('.')[2]) - Number(b.split('.')[2]));
const b64 = parts.map((f) => readFileSync(join(dir, f), 'utf8')).join('').replace(/\s+/g, '');
const bundle = JSON.parse(brotliDecompressSync(Buffer.from(b64, 'base64')).toString('utf8'));
const out = join(web, 'static', 'data');
rmSync(out, { recursive: true, force: true });
let n = 0;
for (const [rel, obj] of Object.entries(bundle)) {
	const p = join(out, rel);
	mkdirSync(dirname(p), { recursive: true });
	writeFileSync(p, JSON.stringify(obj));
	n++;
}
console.log(`dati del pilota: ${n} file scritti in static/data`);
