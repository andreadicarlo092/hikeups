import { setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { FALLBACK_STYLE_URL, STYLE_URL } from './config';

let initialized = false;

/** The bundler relocates MapLibre's chunks, so its worker must be emitted and registered explicitly. */
export function initMapLibre(): void {
	if (initialized) return;
	setWorkerUrl(maplibreWorkerUrl);
	initialized = true;
}

/** Stile vuoto: se OpenFreeMap non risponde, i punti di partenza restano comunque visibili e cliccabili. */
export const BLANK_STYLE: StyleSpecification = {
	version: 8,
	sources: {},
	glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
	layers: [{ id: 'sfondo', type: 'background', paint: { 'background-color': '#eef2ea' } }]
};

async function probe(url: string, timeoutMs: number): Promise<boolean> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: ctrl.signal });
		return res.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

/** OpenFreeMap has no SLA: probe the primary style, then the fallback, then use a blank style. */
export async function resolveStyleUrl(timeoutMs = 4000): Promise<string | StyleSpecification> {
	if (typeof location !== 'undefined' && new URL(location.href).searchParams.get('stile') === 'vuoto') return BLANK_STYLE;
	if (await probe(STYLE_URL, timeoutMs)) return STYLE_URL;
	if (await probe(FALLBACK_STYLE_URL, timeoutMs)) return FALLBACK_STYLE_URL;
	return BLANK_STYLE;
}
