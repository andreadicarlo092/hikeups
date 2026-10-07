import { env } from '$env/dynamic/public';

export const STYLE_URL = env.PUBLIC_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
export const FALLBACK_STYLE_URL =
	env.PUBLIC_FALLBACK_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
/** Base URL for /data. Empty = same origin; set to a CDN origin in production. */
export const ASSET_BASE = (env.PUBLIC_ASSET_BASE || '').replace(/\/$/, '');

/** Area pilota: Esino Lario / Grigna settentrionale [ovest, sud, est, nord]. Sovrascritta da area.bbox di trailheads.json. */
export const PILOT_BOUNDS: [number, number, number, number] = [9.33, 45.94, 9.42, 46.02];

export const ATTRIBUTIONS = [
	{ label: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
	{
		label: 'Copernicus DEM',
		href: 'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM'
	},
	{ label: 'OpenFreeMap', href: 'https://openfreemap.org' }
] as const;

/** HTML per il controllo attribuzioni di MapLibre. */
export const DATA_ATTRIBUTION = ATTRIBUTIONS.map(
	(a) => `<a href="${a.href}" target="_blank" rel="noopener">${a.label}</a>`
).join(' · ');

/** Testo standard per il dato mancante (schema §0). */
export const TESTO_MANCANTE = 'Informazione non disponibile, puoi completarla su OpenStreetMap.';

export function assetUrl(path: string): string {
	return `${ASSET_BASE}${path}`;
}
