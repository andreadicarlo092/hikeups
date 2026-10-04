// Test del PDF in Node: node web/scripts/test_pdf.mjs <trail.json> <out_dir>
import { build } from 'esbuild';
import { readFileSync, mkdirSync, statSync, readdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

// argv[2]: file trail.json oppure cartella di trail.json (li prova tutti)
const input = resolve(process.argv[2]);
const trails = statSync(input).isDirectory()
	? readdirSync(input).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(resolve(input, f), 'utf8')))
	: [JSON.parse(readFileSync(input, 'utf8'))];
const outDir = resolve(process.argv[3] ?? '/tmp/pdf-test');
mkdirSync(outDir, { recursive: true });
// Il bundle sta dentro web/node_modules così 'jspdf' si risolve; il PDF va in outDir.
const bundle = resolve(import.meta.dirname, '../node_modules/.cache/pdf-test/pdf.bundle.mjs');
const lib = resolve(import.meta.dirname, '../src/lib');
const stubConfig = {
	name: 'stub-config',
	setup(b) {
		b.onResolve({ filter: /^\.\/config$/ }, () => ({ path: 'cfg', namespace: 'stub' }));
		b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
			contents: `export const ATTRIBUTIONS=[{label:'© OpenStreetMap contributors'},{label:'Copernicus DEM'},{label:'OpenFreeMap'}];`,
			loader: 'js'
		}));
	}
};
await build({
	entryPoints: [resolve(lib, 'pdf.ts')],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outfile: bundle,
	plugins: [stubConfig],
	external: ['jspdf'],
	logLevel: 'error'
});
process.chdir(outDir);
const { downloadTrailPdf } = await import(bundle);
for (const trail of trails) {
	await downloadTrailPdf(trail);
	// più punti di partenza condividono lo stesso nome file: rinomino con l'id per non sovrascrivere
	const nuovo = readdirSync('.').find((f) => f.endsWith('.pdf') && !f.startsWith('t-'));
	if (nuovo && trails.length > 1) renameSync(nuovo, `${trail.id}.pdf`);
}
console.log('ok', trails.length);
