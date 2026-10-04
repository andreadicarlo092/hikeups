<script lang="ts">
	import { tick } from 'svelte';
	import DifficultyBadge from './DifficultyBadge.svelte';
	import { ATTRIBUTIONS, TESTO_MANCANTE } from '$lib/config';
	import {
		DIFFICULTY_COLORS,
		DIFFICULTY_LABELS,
		DIFFICULTY_LONG,
		DIFFICULTY_ORDER,
		SAC_WARNING,
		difficultyKey
	} from '$lib/difficulty';
	import { formatAtKm, formatGain, formatKm, formatLoss, formatMeters, kmNumber } from '$lib/format';
	import type { TrailDetail } from '$lib/types';

	let {
		trail,
		loading,
		error,
		onclose,
		onopentrail
	}: {
		trail: TrailDetail | null;
		loading: boolean;
		error: string | null;
		onclose: () => void;
		onopentrail: (trailId: string) => void;
	} = $props();

	let dialog: HTMLDivElement | undefined = $state();
	let scroller: HTMLDivElement | undefined = $state();
	let pdfBusy = $state(false);
	let pdfError = $state(false);

	const key = $derived(difficultyKey(trail?.difficolta));
	const missing = $derived(trail?.campi_mancanti ?? []);
	const MISSING_LABELS: Record<string, string> = {
		nome: 'il nome del sentiero',
		ref: 'il numero del sentiero',
		difficolta: 'la difficoltà',
		fondo: 'il fondo del sentiero',
		segnavia: 'i segnavia',
		arrivo: "il punto d'arrivo",
		rifugi: 'i rifugi',
		acqua: "le fonti d'acqua",
		incroci: 'gli incroci',
		quota_partenza: 'la quota di partenza',
		quota_arrivo: "la quota d'arrivo",
		geometria: 'il tracciato completo'
	};
	// l'acqua vuota è normale (porta acqua): non la chiediamo come dato mancante nel riquadro, ma se è elencata la mostriamo
	const missingLabels = $derived(missing.map((m) => MISSING_LABELS[m]).filter(Boolean));
	const editUrl = $derived(
		trail?.osm_rel_id ? `https://www.openstreetmap.org/edit?relation=${trail.osm_rel_id}` : null
	);
	const showDurationNote = $derived(trail?.durata_min !== null && trail?.durata_min !== undefined);

	$effect(() => {
		// nuovo sentiero: torna in cima e porta il focus nel dialogo
		void trail?.id;
		if (scroller) scroller.scrollTop = 0;
		tick().then(() => dialog?.focus());
	});

	$effect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = prev);
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
			return;
		}
		if (e.key !== 'Tab' || !dialog) return;
		const f = [...dialog.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]')].filter(
			(el) => !el.hasAttribute('disabled')
		);
		if (!f.length) return;
		const first = f[0];
		const last = f[f.length - 1];
		if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	async function downloadPdf() {
		if (!trail || pdfBusy) return;
		pdfBusy = true;
		pdfError = false;
		try {
			const { downloadTrailPdf } = await import('$lib/pdf');
			await downloadTrailPdf(trail);
		} catch (e) {
			console.error(e);
			pdfError = true;
		} finally {
			pdfBusy = false;
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div
		class="modal"
		role="dialog"
		aria-modal="true"
		aria-labelledby="tr-title"
		aria-busy={loading}
		tabindex="-1"
		bind:this={dialog}
		onkeydown={onKey}
	>
		<header>
			<div class="titles">
				<h2 id="tr-title">{trail ? trail.nome : 'Sentiero'}{#if trail?.ref}<span class="ref"> · {trail.ref}</span>{/if}</h2>
				{#if trail}
					<p class="route">
						Da <b>{trail.partenza.nome ?? 'punto di partenza'}</b>{#if trail.partenza.quota !== null}{' '}({trail.partenza.quota} m){/if}{#if trail.arrivo?.nome}{' '}a <b>{trail.arrivo.nome}</b>{#if trail.arrivo.quota !== null}{' '}({trail.arrivo.quota} m){/if}{/if}{#if trail.anello}{' '}· giro ad anello{/if}
					</p>
				{/if}
			</div>
			<button type="button" class="close" onclick={onclose} aria-label="Chiudi">×</button>
		</header>

		<div class="scroll" bind:this={scroller}>
			{#if loading}
				<p class="state" role="status">Caricamento del sentiero…</p>
			{:else if error}
				<p class="state err" role="alert">{error}</p>
			{:else if trail}
				<!-- TLDR -->
				<section class="tldr" aria-label="In breve">
					<dl class="nums">
						<div class="cell">
							<dt>Difficoltà</dt>
							<dd><DifficultyBadge difficulty={trail.difficolta} large /></dd>
							<span class="cap">{DIFFICULTY_LABELS[key]}</span>
						</div>
						<div class="cell">
							<dt>{trail.anello ? 'Giro completo' : 'Salita'}</dt>
							<dd class="big">{trail.tldr.durata_txt ?? '–'}</dd>
						</div>
						<div class="cell">
							<dt>Distanza</dt>
							<dd class="big">{kmNumber(trail.km)}<small> km</small></dd>
							{#if trail.km_stimato}<span class="cap">stimata</span>{/if}
						</div>
						<div class="cell">
							<dt>Dislivello</dt>
							<dd class="big">{formatGain(trail.dislivello_pos)}</dd>
						</div>
					</dl>
					<p class="phrase">{trail.tldr.frase}</p>
					{#if showDurationNote}
						<p class="note">
							Durata stimata con la formula CAI (4 km/h in piano, 400 m/h in salita). Soste escluse.
						</p>
					{/if}
				</section>

				<!-- Descrizione -->
				{#if trail.descrizione.length}
					<section>
						<h3>Descrizione</h3>
						<ul class="desc">
							{#each trail.descrizione as frase}
								<li>{frase}</li>
							{/each}
						</ul>
					</section>
				{/if}

				<!-- Difficoltà -->
				{#if trail.difficolta}
					<section>
						<h3>Difficoltà</h3>
						{#if trail.difficolta_fonte === 'sac_scale'}
							<p class="warn">{SAC_WARNING}</p>
						{/if}
						<ul class="legend">
							{#each DIFFICULTY_ORDER as d (d)}
								<li class:current={d === trail.difficolta}>
									<span class="lb" style:background={DIFFICULTY_COLORS[d]}>{d}</span>
									<span>
										<b>{DIFFICULTY_LABELS[d]}</b>{#if d === trail.difficolta}<em> · questo sentiero</em>{/if}<br />
										{DIFFICULTY_LONG[d]}
									</span>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<!-- Rifugi -->
				{#if trail.rifugi.length}
					<section>
						<h3>Rifugi raggiungibili</h3>
						<ul class="cards">
							{#each trail.rifugi as r}
								<li>
									<b>{r.nome ?? 'Rifugio senza nome'}</b>
									<span class="meta">
										{#if r.km_dal_via !== null}{formatAtKm(r.km_dal_via)}{/if}
										{#if r.quota !== null}· {formatMeters(r.quota)}{/if}
										{#if !r.sul_percorso && r.distanza_dal_sentiero_m !== null}
											· a {r.distanza_dal_sentiero_m} m dal sentiero{:else if r.sul_percorso}
											· sul percorso{/if}
									</span>
									{#if r.accanto_a}<span class="meta">Accanto a {r.accanto_a}</span>{/if}
									{#if r.sito || r.telefono}
										<span class="meta">
											{#if r.sito}<a href={r.sito} target="_blank" rel="noopener">Sito</a>{/if}
											{#if r.telefono}<a href="tel:{r.telefono.replace(/\s+/g, '')}">{r.telefono}</a>{/if}
										</span>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<!-- Incroci -->
				{#if trail.incroci.length}
					<section>
						<h3>Sentieri che si incrociano</h3>
						<ul class="cards">
							{#each trail.incroci as c}
								<li>
									{#if c.trail_id}
										<button type="button" class="link-row" onclick={() => onopentrail(c.trail_id!)}>
											<DifficultyBadge difficulty={c.difficolta} />
											<span class="lt">
												<b>{c.nome ?? `Sentiero ${c.ref ?? ''}`}{#if c.ref && c.nome} · {c.ref}{/if}</b>
												<span class="meta">{formatAtKm(c.km_dal_via)}</span>
											</span>
											<span aria-hidden="true">›</span>
										</button>
									{:else}
										<div class="link-row static">
											<DifficultyBadge difficulty={c.difficolta} />
											<span class="lt">
												<b>{c.nome ?? `Sentiero ${c.ref ?? ''}`}{#if c.ref && c.nome} · {c.ref}{/if}</b>
												<span class="meta">{formatAtKm(c.km_dal_via)}</span>
											</span>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<!-- Acqua -->
				{#if trail.acqua.length}
					<section>
						<h3>Acqua lungo il percorso</h3>
						<ul class="cards">
							{#each trail.acqua as a}
								<li>
									<b>{a.nome ?? (a.tipo ? a.tipo[0].toUpperCase() + a.tipo.slice(1) : 'Fonte')}</b>
									<span class="meta">
										{formatAtKm(a.km_dal_via)}
										{#if a.distanza_dal_sentiero_m !== null}· a {a.distanza_dal_sentiero_m} m dal sentiero{/if}
									</span>
								</li>
							{/each}
						</ul>
						<p class="note">Non sappiamo se la fonte è sempre attiva. Porta comunque dell'acqua.</p>
					</section>
				{/if}

				<!-- Dati mancanti -->
				{#if missingLabels.length}
					<section class="missing">
						<h3>Dati mancanti</h3>
						<p>{TESTO_MANCANTE}</p>
						<p class="what">Mancano: {missingLabels.join(', ')}.</p>
						<p class="links">
							{#if editUrl}<a href={editUrl} target="_blank" rel="noopener">Modifica su OpenStreetMap</a>{/if}
							{#if trail.osm_url}<a href={trail.osm_url} target="_blank" rel="noopener">Vedi il sentiero su OpenStreetMap</a>{/if}
						</p>
					</section>
				{:else if trail.osm_url}
					<p class="osm"><a href={trail.osm_url} target="_blank" rel="noopener">Vedi il sentiero su OpenStreetMap</a></p>
				{/if}

				<p class="credits">
					Dati: {#each ATTRIBUTIONS as a, i}<a href={a.href} target="_blank" rel="noopener">{a.label}</a>{i < ATTRIBUTIONS.length - 1 ? ' · ' : ''}{/each}
				</p>
			{/if}
		</div>

		{#if trail}
			<footer>
				<button type="button" class="btn pdf" onclick={downloadPdf} disabled={pdfBusy}>
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
						><path d="M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4L11 12.200zM5 18h14v3H5z" fill="currentColor" /></svg
					>
					{pdfBusy ? 'Preparo il PDF…' : 'Scarica PDF'}
				</button>
				{#if pdfError}<span class="err" role="alert">Non sono riuscito a creare il PDF. Riprova.</span>{/if}
			</footer>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
		background: rgb(17 24 39 / 0.55);
		display: flex;
		align-items: stretch;
		justify-content: center;
	}
	.modal {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: 100dvh;
		background: #fff;
		outline: none;
		margin-top: 24px;
		border-radius: 16px 16px 0 0;
		align-self: flex-end;
		height: calc(100dvh - 24px);
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.9rem 0.4rem 0.6rem 1rem;
		border-bottom: 1px solid var(--line);
		flex: none;
	}
	.titles {
		flex: 1;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.25rem;
		line-height: 1.2;
	}
	.ref {
		color: var(--muted);
		font-weight: 500;
	}
	.route {
		margin: 0.3rem 0 0;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.close {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		color: var(--muted);
		flex: none;
	}
	.scroll {
		flex: 1;
		overflow-y: auto;
		padding: 0 1rem 1rem;
		overscroll-behavior: contain;
	}
	.state {
		padding: 1.5rem 0;
		color: var(--muted);
	}
	.err {
		color: #b91c1c;
	}
	section {
		padding-top: 1.1rem;
	}
	h3 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}
	.tldr {
		padding-top: 0.9rem;
	}
	.nums {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem 0.6rem;
		margin: 0;
		padding: 0.9rem 0.7rem;
		border: 2px solid var(--ink);
		border-radius: 14px;
	}
	.cell {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		min-width: 0;
	}
	dt {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		order: 2;
	}
	dd {
		margin: 0;
		order: 1;
	}
	.cap {
		order: 3;
		font-size: 0.75rem;
		color: var(--muted);
		line-height: 1.2;
	}
	.big {
		font-size: clamp(1.15rem, 5.2vw, 2.2rem);
		font-weight: 800;
		line-height: 1.15;
		white-space: nowrap;
	}
	.big small {
		font-size: 0.5em;
		font-weight: 700;
	}
	.phrase {
		margin: 0.9rem 0 0;
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1.3;
	}
	.note {
		margin: 0.5rem 0 0;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.desc {
		margin: 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		line-height: 1.4;
	}
	.warn {
		margin: 0 0 0.6rem;
		padding: 0.5rem 0.7rem;
		background: #fef3c7;
		border-radius: 8px;
		font-size: 0.88rem;
	}
	.legend {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.legend li {
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		padding: 0.5rem;
		border-radius: 10px;
		font-size: 0.88rem;
		line-height: 1.35;
	}
	.legend li.current {
		background: #f3f4f6;
		outline: 2px solid var(--ink);
	}
	.legend em {
		font-style: normal;
		color: var(--muted);
	}
	.lb {
		flex: none;
		min-width: 3em;
		padding: 0.15em 0.4em;
		border-radius: 6px;
		color: #fff;
		font-weight: 800;
		text-align: center;
		font-size: 0.85rem;
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.cards > li {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 10px;
	}
	.cards > li:has(.link-row) {
		padding: 0;
	}
	.meta {
		font-size: 0.85rem;
		color: var(--muted);
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.6rem;
	}
	.link-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		min-height: 52px;
		padding: 0.5rem 0.7rem;
		border: 0;
		background: transparent;
		font: inherit;
		text-align: left;
		cursor: pointer;
		color: var(--ink);
		border-radius: 10px;
	}
	button.link-row:hover {
		background: #f0fdf4;
	}
	.link-row.static {
		cursor: default;
	}
	.lt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.missing {
		margin-top: 1.1rem;
		padding: 0.8rem 0.9rem;
		background: #f9fafb;
		border: 1px dashed #9ca3af;
		border-radius: 10px;
	}
	.missing h3 {
		margin-bottom: 0.3rem;
	}
	.missing p {
		margin: 0.2rem 0;
		font-size: 0.9rem;
	}
	.missing .what {
		color: var(--muted);
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		margin-top: 0.4rem !important;
	}
	.osm {
		margin: 1rem 0 0;
		font-size: 0.85rem;
	}
	.credits {
		margin: 1.2rem 0 0;
		font-size: 0.78rem;
		color: var(--muted);
	}
	footer {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.7rem 1rem calc(0.7rem + env(safe-area-inset-bottom));
		border-top: 1px solid var(--line);
		background: #fff;
	}
	.pdf {
		flex: 1;
		justify-content: center;
		font-size: 1.05rem;
	}
	.pdf:disabled {
		opacity: 0.7;
		cursor: progress;
	}
	@media (min-width: 768px) {
		.backdrop {
			align-items: center;
		}
		.modal {
			width: 680px;
			max-width: calc(100vw - 32px);
			height: auto;
			max-height: calc(100dvh - 48px);
			margin: 0;
			align-self: center;
			border-radius: 16px;
			box-shadow: 0 10px 40px rgb(0 0 0 / 0.35);
		}
		.nums {
			grid-template-columns: repeat(4, 1fr);
		}
		.pdf {
			flex: none;
			min-width: 220px;
		}
	}
</style>
