const DASH = '–';

function nf(value: number, digits: number): string {
	return value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/** "4,3 km" — "circa 1,9 km" se stimato — "–" se mancante. */
export function formatKm(km: number | null | undefined, approx = false): string {
	if (km === null || km === undefined) return DASH;
	return `${approx ? 'circa ' : ''}${nf(km, 1)} km`;
}

/** Solo il numero ("4,3") per i grandi numeri del TLDR. */
export function kmNumber(km: number | null | undefined): string {
	return km === null || km === undefined ? DASH : nf(km, 1);
}

/** "+650 m" — "–" se mancante. */
export function formatGain(m: number | null | undefined): string {
	if (m === null || m === undefined) return DASH;
	return `+${nf(Math.round(m), 0)} m`;
}

export function formatLoss(m: number | null | undefined): string {
	if (m === null || m === undefined) return DASH;
	return `−${nf(Math.round(m), 0)} m`;
}

export function formatMeters(m: number | null | undefined): string {
	if (m === null || m === undefined) return DASH;
	return `${nf(Math.round(m), 0)} m`;
}

/** Posizione lungo il percorso: "km 1,8". */
export function formatAtKm(km: number | null | undefined): string {
	if (km === null || km === undefined) return '';
	return `km ${nf(km, 1)}`;
}

/** "2 h 45 min", "50 min", "3 h" — schema §5. */
export function formatMinutes(min: number | null | undefined): string {
	if (min === null || min === undefined) return DASH;
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m} min`;
	if (m === 0) return `${h} h`;
	return `${h} h ${m} min`;
}

/** Versione per i numeri grandi: "2 h 45", "50 min", "3 h". */
export function formatMinutesShort(min: number | null | undefined): string {
	if (min === null || min === undefined) return DASH;
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m} min`;
	if (m === 0) return `${h} h`;
	return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Formula CAI: t = km/4 + D+/400 (ore), arrotondata a 5 minuti (schema §5). */
export function caiMinutes(km: number | null, gainM: number | null): number | null {
	if (km === null || gainM === null) return null;
	const min = (km / 4 + gainM / 400) * 60;
	return Math.max(5, Math.round(min / 5) * 5);
}

export function slugify(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
