import type { Difficulty, DifficultyKey } from './types';

/** Colori scala CAI (schema §4). Testo sempre bianco. */
export const DIFFICULTY_COLORS: Record<DifficultyKey, string> = {
	T: '#2E9E4F',
	E: '#1F6FD6',
	EE: '#D62F2F',
	EEA: '#111111',
	nd: '#8A8F98'
};

export const DIFFICULTY_LABELS: Record<DifficultyKey, string> = {
	T: 'Turistico',
	E: 'Escursionistico',
	EE: 'Escursionisti Esperti',
	EEA: 'Escursionisti Esperti con Attrezzatura',
	nd: 'Difficoltà non disponibile'
};

/** Frase breve: tooltip e descrizione. */
export const DIFFICULTY_SHORT: Record<DifficultyKey, string> = {
	T: 'percorso facile, adatto a tutti.',
	E: 'sentiero escursionistico, serve un buon passo e scarponi.',
	EE: 'per escursionisti esperti, con tratti esposti.',
	EEA: 'per escursionisti esperti con attrezzatura, con tratti di ferrata.',
	nd: 'difficoltà non disponibile.'
};

/** Spiegazione in italiano semplice: modale, legenda, PDF. */
export const DIFFICULTY_LONG: Record<DifficultyKey, string> = {
	T: 'Percorso facile su stradine, mulattiere o sentieri ben tracciati. Pochi dislivelli. Bastano scarpe comode.',
	E: "Sentiero in montagna, anche ripido o con sassi. Non ci sono passaggi difficili. Servono scarponi, un po' di allenamento e abitudine a camminare in salita.",
	EE: 'Percorso impegnativo: può avere tratti ripidi, esposti o su roccia, dove usi anche le mani. Serve esperienza, equilibrio, assenza di vertigini e scarponi adatti.',
	EEA: 'Percorso con tratti di ferrata, con cavi o scale. Servono casco, imbracatura e kit da ferrata, oltre a esperienza e buona preparazione fisica. Se non sei esperto, vai con una guida.',
	nd: 'Informazione non disponibile, puoi completarla su OpenStreetMap.'
};

export const DIFFICULTY_ORDER: Difficulty[] = ['T', 'E', 'EE', 'EEA'];

export const SAC_WARNING = 'Difficoltà stimata dai dati OSM: controlla sul posto.';

export function difficultyKey(d: Difficulty | null | undefined): DifficultyKey {
	return d ?? 'nd';
}

/** Sigla da mostrare nei badge ("n.d." se mancante). */
export function difficultyText(d: Difficulty | null | undefined): string {
	return d ?? 'n.d.';
}
