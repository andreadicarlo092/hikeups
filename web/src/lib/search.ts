import type { Difficulty, Trailhead, TrailheadIndex } from './types';
import type { SearchEntry } from './data';
import type { IconKind } from './icons';
import { TYPE_LABELS } from './icons';

export interface SearchItem {
	kind: IconKind;
	nome: string;
	sub: string;
	thId: string;
	trailId?: string;
	lat: number | null;
	lon: number | null;
	difficolta?: Difficulty | null;
	haystack: string;
}

export function normalize(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[’']/g, ' ')
		.replace(/[^a-z0-9 ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const HUT_RE = /\b(rifugio|capanna|bivacco|baita|rif)\b/i;

/** Costruisce l'elenco locale: punti di partenza, rifugi e sentieri. */
export function buildSearchItems(
	index: TrailheadIndex,
	trailheads: Trailhead[],
	extra: SearchEntry[] = []
): SearchItem[] {
	const items: SearchItem[] = [];
	const huts = new Set<string>();
	const byId = new Map(index.punti.map((p) => [p.id, p]));

	for (const p of index.punti) {
		items.push({
			kind: p.tipo,
			nome: p.nome,
			sub: `${TYPE_LABELS[p.tipo]} · ${p.n_sentieri} ${p.n_sentieri === 1 ? 'sentiero' : 'sentieri'}`,
			thId: p.id,
			lat: p.lat,
			lon: p.lon,
			haystack: normalize(p.nome)
		});
		if (p.tipo === 'rifugio') huts.add(normalize(p.nome));
	}

	const addHut = (nome: string, thId: string, lat: number | null, lon: number | null, from: string) => {
		const n = normalize(nome);
		if (!n || huts.has(n)) return;
		huts.add(n);
		items.push({
			kind: 'rifugio',
			nome,
			sub: `Rifugio · raggiungibile da ${from}`,
			thId,
			lat,
			lon,
			haystack: n
		});
	};

	for (const th of trailheads) {
		const p = byId.get(th.id);
		for (const s of th.sentieri) {
			const label = s.ref ? `${s.nome} (${s.ref})` : s.nome;
			items.push({
				kind: 'sentiero',
				nome: label,
				sub: `Sentiero · parte da ${th.nome}`,
				thId: th.id,
				trailId: s.id,
				lat: p?.lat ?? th.lat,
				lon: p?.lon ?? th.lon,
				difficolta: s.difficolta,
				haystack: normalize(`${s.nome} ${s.ref ?? ''} ${s.arrivo ?? ''}`)
			});
			if (s.arrivo && HUT_RE.test(s.arrivo)) addHut(s.arrivo, th.id, null, null, th.nome);
		}
	}

	for (const e of extra) {
		if (e.tipo === 'rifugio') {
			addHut(e.nome, e.th_id, e.lat ?? null, e.lon ?? null, byId.get(e.th_id)?.nome ?? 'un punto di partenza');
		} else {
			items.push({
				kind: 'sentiero',
				nome: e.ref ? `${e.nome} (${e.ref})` : e.nome,
				sub: `Sentiero · parte da ${byId.get(e.th_id)?.nome ?? 'un punto di partenza'}`,
				thId: e.th_id,
				trailId: e.trail_id,
				lat: e.lat ?? byId.get(e.th_id)?.lat ?? null,
				lon: e.lon ?? byId.get(e.th_id)?.lon ?? null,
				haystack: normalize(`${e.nome} ${e.ref ?? ''}`)
			});
		}
	}
	return items;
}

const KIND_ORDER: Record<string, number> = { sentiero: 2, rifugio: 1 };

export function searchItems(items: SearchItem[], query: string, limit = 8): SearchItem[] {
	const q = normalize(query);
	if (q.length < 2) return [];
	const tokens = q.split(' ');
	const scored: { item: SearchItem; score: number }[] = [];
	for (const item of items) {
		if (!tokens.every((t) => item.haystack.includes(t))) continue;
		let score = 0;
		const n = normalize(item.nome);
		if (n.startsWith(q)) score += 50;
		else if (n.includes(q)) score += 25;
		if (item.haystack.split(' ').some((w) => w.startsWith(tokens[0]))) score += 10;
		score -= (KIND_ORDER[item.kind] ?? 0) * 2;
		score -= item.nome.length / 100;
		scored.push({ item, score });
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, limit).map((s) => s.item);
}
