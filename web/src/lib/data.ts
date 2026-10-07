import { assetUrl } from './config';
import type { TrailDetail, Trailhead, TrailheadIndex } from './types';

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
	const res = await fetch(assetUrl(path), { signal });
	if (!res.ok) throw new Error(String(res.status));
	return (await res.json()) as T;
}

export const loadIndex = (signal?: AbortSignal) => getJson<TrailheadIndex>('/data/trailheads.json', signal);
export const loadTrailhead = (id: string, signal?: AbortSignal) =>
	getJson<Trailhead>(`/data/trailheads/${encodeURIComponent(id)}.json`, signal);
export const loadTrail = (id: string, signal?: AbortSignal) =>
	getJson<TrailDetail>(`/data/trails/${encodeURIComponent(id)}.json`, signal);

/** Indice di ricerca opzionale (st4): sentieri e rifugi. Se non c'è, la ricerca usa solo i punti. */
export interface SearchEntry {
	tipo: 'sentiero' | 'rifugio';
	nome: string;
	ref?: string | null;
	/** Punto di partenza da aprire al click. */
	th_id: string;
	trail_id?: string;
	lat?: number;
	lon?: number;
	difficolta?: string | null;
}

export async function loadSearchExtra(signal?: AbortSignal): Promise<SearchEntry[]> {
	try {
		const res = await fetch(assetUrl('/data/search.json'), { signal });
		if (!res.ok) return [];
		const data = await res.json();
		return Array.isArray(data) ? data : (data.voci ?? []);
	} catch {
		return [];
	}
}
