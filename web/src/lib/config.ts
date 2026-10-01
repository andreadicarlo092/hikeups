import { base } from '$app/paths';
import { env } from '$env/dynamic/public';

export const STYLE_URL = env.PUBLIC_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
export const FALLBACK_STYLE_URL =
	env.PUBLIC_FALLBACK_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
/** Base URL for /data and /tiles. Defaults to the app's own base path; set to a CDN origin in production. */
export const ASSET_BASE = (env.PUBLIC_ASSET_BASE || base).replace(/\/$/, '');

export const LOMBARDIA_BOUNDS: [number, number, number, number] = [8.49, 44.68, 11.43, 46.64];

export const DATA_ATTRIBUTION =
	'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> (ODbL) · Quote: Copernicus GLO-30';

export function assetUrl(path: string): string {
	return `${ASSET_BASE}${path}`;
}

export function absoluteAssetUrl(path: string): string {
	if (/^https?:\/\//.test(ASSET_BASE)) return `${ASSET_BASE}${path}`;
	const origin = typeof location !== 'undefined' ? location.origin : '';
	return `${origin}${ASSET_BASE}${path}`;
}
