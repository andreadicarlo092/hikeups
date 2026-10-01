import type { Difficulty } from './types';

export const DIFFICULTY_COLORS: Record<Difficulty | '?', string> = {
	T: '#15803d',
	E: '#1d4ed8',
	EE: '#b91c1c',
	EEA: '#111827',
	'?': '#6b7280'
};

export const DIFFICULTY_LABELS: Record<Difficulty | '?', string> = {
	T: 'Turistico',
	E: 'Escursionistico',
	EE: 'Escursionisti Esperti',
	EEA: 'Esperti con Attrezzatura',
	'?': 'Difficoltà non indicata'
};

export function difficultyKey(d: Difficulty | null): Difficulty | '?' {
	return d ?? '?';
}

/** MapLibre `match` expression colouring lines by the `difficulty` tile property. */
export const difficultyColorExpression = [
	'match',
	['get', 'difficulty'],
	'T',
	DIFFICULTY_COLORS.T,
	'E',
	DIFFICULTY_COLORS.E,
	'EE',
	DIFFICULTY_COLORS.EE,
	'EEA',
	DIFFICULTY_COLORS.EEA,
	DIFFICULTY_COLORS['?']
] as const;
