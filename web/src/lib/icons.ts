import type { TrailheadType } from './types';

export type IconKind = TrailheadType | 'sentiero';

/** Tracciati su griglia 24x24, da riempire con fill-rule evenodd. Usati sia dal componente SVG sia da Path2D sulla mappa. */
export const ICON_PATHS: Record<IconKind, string> = {
	parcheggio: 'M8 5h5.5a4 4 0 0 1 0 8H11v6H8V5zm3 2.5v3h2.5a1.5 1.5 0 0 0 0-3H11z',
	rifugio: 'M12 4 3 12h2.5v8h5v-5h3v5h5v-8H21z',
	stazione:
		'M7 4h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3l1.5 2h-2l-1.5-2h-4l-1.5 2h-2L8 18a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2zm0 2v4h10V6H7zm1.5 8a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm7 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
	bus: 'M6 4h12a2 2 0 0 1 2 2v10a1 1 0 0 1-1 1v2h-2.5v-2h-9v2H5v-2a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2zm0 2v4h12V6H6zm2 7.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm8 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
	inizio_sentiero: 'M6 3h2v18H6zM9 4h10l-3 4.5 3 4.5H9z',
	sentiero:
		'M6.5 21a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM17.5 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM8.2 14.6 11 9.5l3.2 3.4 1.9-2.2 1.5 1.3-3.3 3.9-3.1-3.3-1.6 2.9z'
};

export const TYPE_COLORS: Record<IconKind, string> = {
	parcheggio: '#475569',
	stazione: '#7c3aed',
	rifugio: '#b45309',
	inizio_sentiero: '#0f766e',
	bus: '#0e7490',
	sentiero: '#15803d'
};

export const TYPE_LABELS: Record<IconKind, string> = {
	parcheggio: 'Parcheggio',
	stazione: 'Stazione',
	rifugio: 'Rifugio',
	inizio_sentiero: 'Inizio sentiero',
	bus: 'Fermata bus',
	sentiero: 'Sentiero'
};

export const TRAILHEAD_TYPES: TrailheadType[] = ['parcheggio', 'stazione', 'rifugio', 'inizio_sentiero', 'bus'];

export function iconKind(tipo: string): IconKind {
	return tipo in ICON_PATHS ? (tipo as IconKind) : 'inizio_sentiero';
}

/** Disegna un'icona tonda (cerchio colorato, glifo bianco) per map.addImage. */
export function drawMapIcon(kind: IconKind, size = 36, ratio = 2): ImageData {
	const px = size * ratio;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = px;
	const ctx = canvas.getContext('2d')!;
	ctx.scale(ratio, ratio);
	ctx.beginPath();
	ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
	ctx.fillStyle = TYPE_COLORS[kind];
	ctx.fill();
	ctx.lineWidth = 3;
	ctx.strokeStyle = '#ffffff';
	ctx.stroke();
	const s = (size - 10) / 24;
	ctx.translate(5, 5);
	ctx.scale(s, s);
	ctx.fillStyle = '#ffffff';
	ctx.fill(new Path2D(ICON_PATHS[kind]), 'evenodd');
	return ctx.getImageData(0, 0, px, px);
}
