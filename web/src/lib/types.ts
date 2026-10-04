export type Difficulty = 'T' | 'E' | 'EE' | 'EEA';
export type DifficultyKey = Difficulty | 'nd';

export type TrailheadType = 'parcheggio' | 'stazione' | 'rifugio' | 'inizio_sentiero' | 'bus';

export interface Services {
	parcheggio: boolean;
	acqua: boolean;
	rifugio: boolean;
}

/** Una voce di `trailheads.json` (indice leggero caricato all'avvio). */
export interface TrailheadPoint {
	id: string;
	nome: string;
	tipo: TrailheadType;
	lat: number;
	lon: number;
	quota: number | null;
	n_sentieri: number;
	servizi: Services;
}

export interface TrailheadIndex {
	version: number;
	generato_il: string;
	/** true nei dati di esempio usati per lo sviluppo: la UI mostra un avviso. */
	esempio?: boolean;
	area: { nome: string; bbox: [number, number, number, number] };
	attribuzioni: string[];
	punti: TrailheadPoint[];
}

export interface TrailListItem {
	id: string;
	nome: string;
	ref: string | null;
	difficolta: Difficulty | null;
	difficolta_fonte: 'cai_scale' | 'sac_scale' | 'via_ferrata' | null;
	km: number | null;
	km_stimato?: boolean;
	dislivello_pos: number | null;
	dislivello_neg: number | null;
	durata_min: number | null;
	durata_txt: string | null;
	arrivo: string | null;
	tag: string[];
}

/** `trailheads/{id}.json` */
export interface Trailhead {
	id: string;
	nome: string;
	tipo: TrailheadType;
	lat: number;
	lon: number;
	quota: number | null;
	osm: { tipo: string; id: number; url: string } | null;
	servizi: Services;
	sentieri: TrailListItem[];
	campi_mancanti: string[];
}

export interface Rifugio {
	nome: string | null;
	osm?: string | null;
	km_dal_via: number | null;
	quota: number | null;
	distanza_dal_sentiero_m: number | null;
	sul_percorso: boolean;
	sito?: string | null;
	telefono?: string | null;
	aperto?: string | null;
	/** Nome del rifugio accanto al quale si trova (bivacchi vicini a un rifugio). */
	accanto_a?: string | null;
}

export interface Incrocio {
	km_dal_via: number | null;
	lat?: number;
	lon?: number;
	trail_rel_id?: number;
	nome: string | null;
	ref: string | null;
	difficolta: Difficulty | null;
	trail_id: string | null;
	tratto_comune_m?: number;
}

export interface PuntoAcqua {
	tipo: string | null;
	nome: string | null;
	km_dal_via: number | null;
	distanza_dal_sentiero_m: number | null;
	lat?: number;
	lon?: number;
}

export interface TrailEndpoint {
	id?: string;
	nome: string | null;
	quota: number | null;
	lat?: number;
	lon?: number;
}

/** `trails/{trail_id}.json` */
export interface TrailDetail {
	id: string;
	osm_rel_id: number | null;
	osm_url: string | null;
	nome: string;
	ref: string | null;
	partenza: TrailEndpoint;
	arrivo: TrailEndpoint | null;
	difficolta: Difficulty | null;
	difficolta_fonte: 'cai_scale' | 'sac_scale' | 'via_ferrata' | null;
	km: number | null;
	km_stimato?: boolean;
	dislivello_pos: number | null;
	dislivello_neg: number | null;
	quota_max?: number | null;
	quota_min?: number | null;
	durata_min: number | null;
	durata_ritorno_min: number | null;
	durata_txt: string | null;
	durata_ritorno_txt: string | null;
	fondo: string | null;
	segnavia: string | null;
	anello: boolean;
	tldr: {
		difficolta: Difficulty | null;
		durata_txt: string | null;
		km: number | null;
		dislivello_pos: number | null;
		frase: string;
	};
	descrizione: string[];
	rifugi: Rifugio[];
	incroci: Incrocio[];
	acqua: PuntoAcqua[];
	campi_mancanti: string[];
	attribuzioni?: string[];
}
