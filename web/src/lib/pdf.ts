import { ATTRIBUTIONS } from './config';
import {
	DIFFICULTY_COLORS,
	DIFFICULTY_LABELS,
	DIFFICULTY_LONG,
	SAC_WARNING,
	difficultyKey,
	difficultyText
} from './difficulty';
import { formatAtKm, formatGain, formatLoss, formatMinutesShort, kmNumber, slugify } from './format';
import type { TrailDetail } from './types';

/** jsPDF usa i font standard (WinAnsi): togliamo i caratteri che non esistono. */
function clean(text: string): string {
	return text
		.replace(/[−‐‑]/g, '-')
		.replace(/[’‘]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/[^\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2022\u20ac]/g, '');
}

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const SITE_URL = 'hikeups.vercel.app';

/** Righe "cosa aspettarti": pendenza, fondo, segnavia, difficoltà, durata. */
function expectations(t: TrailDetail): string[] {
	const d = t.descrizione ?? [];
	const find = (re: RegExp) => d.find((s) => re.test(s));
	const rows: (string | undefined)[] = [
		find(/^(La salita|Il percorso è quasi)/),
		find(/^(Il fondo|Si cammina)/),
		find(/^Segui i segnavia/),
		t.difficolta ? `Difficoltà ${t.difficolta}: ${DIFFICULTY_LONG[t.difficolta]}` : undefined,
		find(/^Ti servono/)
	];
	return rows.filter((r): r is string => !!r);
}

function hasGeometry(t: TrailDetail): boolean {
	return !t.campi_mancanti.includes('geometria');
}

export async function downloadTrailPdf(t: TrailDetail): Promise<void> {
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
	const W = 210;
	const M = 14;
	const CW = W - 2 * M;
	const ink: [number, number, number] = [17, 24, 39];
	const grey: [number, number, number] = [107, 114, 128];
	let y = M;

	const text = (s: string, x: number, yy: number, opts?: { align?: 'left' | 'center' | 'right' }) =>
		doc.text(clean(s), x, yy, opts);
	const wrap = (s: string, width: number): string[] => doc.splitTextToSize(clean(s), width) as string[];
	const PT = 0.3528; // mm per punto

	// 1. Intestazione
	doc.setTextColor(...ink);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(12);
	text('hikeups', M, y + 3);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(10);
	doc.setTextColor(...grey);
	text(new Date().toLocaleDateString('it-IT'), W - M, y + 3, { align: 'right' });
	doc.setDrawColor(200, 204, 210);
	doc.setLineWidth(0.3);
	doc.line(M, y + 6, W - M, y + 6);
	y += 15;

	// 2. Titolo
	doc.setTextColor(...ink);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(26);
	const title = t.ref && !t.nome.includes(t.ref) ? `${t.nome} (${t.ref})` : t.nome;
	const titleLines = wrap(title, CW).slice(0, 2);
	for (const line of titleLines) {
		text(line, M, y + 8);
		y += 26 * PT * 1.15;
	}
	y += 1;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(12);
	const q = (v: number | null | undefined) => (v !== null && v !== undefined ? ` (${v} m)` : '');
	const route =
		`Da ${t.partenza.nome ?? 'punto di partenza'}${q(t.partenza.quota)}` +
		(t.arrivo?.nome ? ` a ${t.arrivo.nome}${q(t.arrivo.quota)}` : '') +
		(t.anello ? ' - giro ad anello' : '');
	for (const line of wrap(route, CW).slice(0, 2)) {
		text(line, M, y + 5);
		y += 12 * PT * 1.3;
	}
	y += 6;

	// 3. Riquadro TLDR: 4 colonne
	const boxH = 50;
	doc.setDrawColor(...ink);
	doc.setLineWidth(0.8);
	doc.roundedRect(M, y, CW, boxH, 2, 2);
	const colW = CW / 4;
	doc.setLineWidth(0.3);
	doc.setDrawColor(200, 204, 210);
	for (let i = 1; i < 4; i++) doc.line(M + colW * i, y + 5, M + colW * i, y + boxH - 5);

	const key = difficultyKey(t.difficolta);
	const cols: { big: string; label: string; sub?: string; approx?: boolean }[] = [
		{ big: difficultyText(t.difficolta), label: 'DIFFICOLTÀ', sub: DIFFICULTY_LABELS[key] },
		{ big: formatMinutesShort(t.durata_min), label: t.anello ? 'GIRO COMPLETO' : 'SALITA' },
		{ big: kmNumber(t.km), label: t.km_stimato ? 'KM (STIMATI)' : 'DISTANZA KM' },
		{
			big: formatGain(t.dislivello_pos),
			label: 'DISLIVELLO IN SALITA',
			// stessa fonte e stesso valore della scheda: dislivello_neg, senza arrotondamenti
			sub: t.dislivello_neg !== null && t.dislivello_neg >= 50 ? `${formatLoss(t.dislivello_neg)} in discesa` : undefined
		}
	];
	cols.forEach((c, i) => {
		const cx = M + colW * i + colW / 2;
		const maxW = colW - 6;
		const cy = y + 25;
		if (i === 0) {
			const [r, g, b] = hexToRgb(DIFFICULTY_COLORS[key]);
			doc.setFillColor(r, g, b);
			doc.roundedRect(cx - maxW / 2 + 2, y + 8, maxW - 4, 26, 2, 2, 'F');
			doc.setTextColor(255, 255, 255);
		} else {
			doc.setTextColor(...ink);
		}
		doc.setFont('helvetica', 'bold');
		let fs = 48;
		doc.setFontSize(fs);
		const inner = i === 0 ? maxW - 8 : maxW;
		while (doc.getTextWidth(clean(c.big)) > inner && fs > 18) {
			fs -= 2;
			doc.setFontSize(fs);
		}
		text(c.big, cx, i === 0 ? y + 27 : cy + 3, { align: 'center' });
		doc.setTextColor(...grey);
		doc.setFontSize(9);
		doc.setFont('helvetica', 'bold');
		if (i === 0 && c.sub) {
			doc.setFont('helvetica', 'normal');
			const subLines = wrap(c.sub, colW - 4).slice(0, 2);
			subLines.forEach((l, k) => text(l, cx, y + 38 + k * 3.6, { align: 'center' }));
			doc.setFont('helvetica', 'bold');
			text(c.label, cx, y + boxH - 2, { align: 'center' });
		} else {
			text(c.label, cx, y + 40, { align: 'center' });
			if (c.sub) {
				doc.setFont('helvetica', 'normal');
				text(c.sub, cx, y + 44.5, { align: 'center' });
			}
		}
	});
	y += boxH + 8;

	// Frase TLDR
	doc.setTextColor(...ink);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(16);
	for (const line of wrap(t.tldr.frase, CW).slice(0, 3)) {
		text(line, M, y + 5);
		y += 16 * PT * 1.3;
	}
	y += 7;

	// Sezione con etichetta a sinistra
	const section = (label: string, body: string) => {
		doc.setFontSize(12);
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(...ink);
		const lw = doc.getTextWidth(clean(label)) + 3;
		text(label, M, y + 4.5);
		doc.setFont('helvetica', 'normal');
		const lines = wrap(body, CW - lw);
		lines.forEach((l, i) => text(l, M + lw, y + 4.5 + i * 5.4));
		y += Math.max(1, lines.length) * 5.4 + 2.5;
	};

	// 4. Cosa aspettarti
	const exp = expectations(t);
	if (exp.length) {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(10);
		doc.setTextColor(...grey);
		text('COSA ASPETTARTI', M, y + 3);
		y += 7;
		doc.setFontSize(12);
		doc.setTextColor(...ink);
		for (const row of exp) {
			doc.setFont('helvetica', 'normal');
			const lines = wrap(row, CW - 6).slice(0, 2);
			doc.setFont('helvetica', 'bold');
			text('•', M + 1, y + 4.5);
			doc.setFont('helvetica', 'normal');
			lines.forEach((l, i) => text(l, M + 6, y + 4.5 + i * 5.2));
			y += lines.length * 5.2 + 2;
		}
		y += 4;
	}

	// 5. Rifugi
	if (t.rifugi.length) {
		// I bivacchi vicini a un rifugio non contano a parte: li citiamo accanto al rifugio.
		const principali = t.rifugi.filter((r) => !r.accanto_a);
		const satelliti = t.rifugi.filter((r) => r.accanto_a);
		const voce = (r: (typeof t.rifugi)[number]) => {
			const km = r.km_dal_via !== null && r.km_dal_via !== undefined ? ` (${formatAtKm(r.km_dal_via)})` : '';
			const vicini = satelliti.filter((s) => s.accanto_a === r.nome && s.nome).map((s) => s.nome);
			return `${r.nome ?? 'rifugio senza nome'}${km}${vicini.length ? `, con accanto ${vicini.join(' e ')}` : ''}`;
		};
		// satelliti il cui rifugio non e' in elenco: li mostriamo comunque
		const orfani = satelliti.filter((s) => !principali.some((p) => p.nome === s.accanto_a));
		section('Rifugi:', [...principali, ...orfani].map(voce).join('; '));
	} else if (hasGeometry(t) && !t.campi_mancanti.includes('rifugi')) {
		section('Rifugi:', 'nessuno lungo il percorso.');
	}
	// 6. Acqua
	if (t.acqua.length) {
		const kms = t.acqua.map((a) => formatAtKm(a.km_dal_via)).filter(Boolean);
		section('Acqua:', kms.length ? `${kms.join(', ')}.` : `${t.acqua.length} fonti lungo il percorso.`);
	} else {
		section('Acqua:', 'non risultano fonti, porta acqua con te.');
	}
	// 7. Incroci
	if (t.incroci.length) {
		section(
			'Incroci:',
			t.incroci
				.slice(0, 3)
				.map((c) => `sentiero ${c.ref ?? c.nome ?? '?'}${c.km_dal_via !== null ? ` (${formatAtKm(c.km_dal_via)})` : ''}`)
				.join(', ')
		);
	}
	// 8. Attrezzatura
	if (t.difficolta === 'EE' || t.difficolta === 'EEA') {
		y += 1;
		const msg =
			t.difficolta === 'EEA'
				? 'Servono casco, imbracatura e kit da ferrata.'
				: 'Servono scarponi e attenzione dove il terreno è esposto.';
		doc.setDrawColor(...ink);
		doc.setLineWidth(0.8);
		doc.rect(M, y, CW, 11);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(12);
		doc.setTextColor(...ink);
		text(msg, M + 4, y + 7);
		y += 14;
	}

	// 9. Piè di pagina
	const footer: string[] = [
		`Durata stimata con la formula CAI (km/4 + dislivello/400), soste escluse. Controlla il meteo prima di partire.` +
			(t.difficolta_fonte === 'sac_scale' ? ` ${SAC_WARNING}` : ''),
		`Dati: ${ATTRIBUTIONS.map((a) => a.label).join(' · ')}. ${SITE_URL}`
	];
	if (t.campi_mancanti.some((c) => c !== 'acqua')) {
		footer.unshift('Alcune informazioni non sono disponibili: puoi completarle su OpenStreetMap.');
	}
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(...grey);
	const fLines = footer.flatMap((f) => wrap(f, CW));
	const fy = 297 - M - fLines.length * 3.9;
	doc.setDrawColor(200, 204, 210);
	doc.setLineWidth(0.3);
	doc.line(M, fy - 2, W - M, fy - 2);
	fLines.forEach((l, i) => text(l, M, fy + 2 + i * 3.9));

	const file = `hikeups-${slugify(t.nome) || 'sentiero'}${t.ref ? `-${slugify(t.ref)}` : ''}.pdf`;
	doc.save(file);
}
