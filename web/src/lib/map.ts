import { addProtocol, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Protocol } from 'pmtiles';
import { FALLBACK_STYLE_URL, STYLE_URL } from './config';

let initialized = false;

/** The bundler relocates MapLibre's chunks, so its worker must be emitted and registered explicitly. */
export function initMapLibre(): void {
	if (initialized) return;
	setWorkerUrl(maplibreWorkerUrl);
	const protocol = new Protocol();
	addProtocol('pmtiles', protocol.tile);
	initialized = true;
}

/** OpenFreeMap has no SLA: probe the primary style, fall back to the second URL. */
export async function resolveStyleUrl(timeoutMs = 4000): Promise<string> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(STYLE_URL, { signal: ctrl.signal });
		if (res.ok) return STYLE_URL;
	} catch {
		/* fall through to fallback */
	} finally {
		clearTimeout(timer);
	}
	return FALLBACK_STYLE_URL;
}
