<script lang="ts">
	import { tick } from 'svelte';
	import DifficultyBadge from './DifficultyBadge.svelte';
	import TypeIcon from './TypeIcon.svelte';
	import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, DIFFICULTY_ORDER } from '$lib/difficulty';
	import { TYPE_LABELS, iconKind } from '$lib/icons';
	import { formatGain, formatKm, formatMinutes } from '$lib/format';
	import { TESTO_MANCANTE } from '$lib/config';
	import type { Difficulty, Trailhead, TrailheadPoint, TrailListItem } from '$lib/types';

	let {
		point,
		trailhead,
		loading,
		error,
		onselect,
		onclose
	}: {
		point: TrailheadPoint | null;
		trailhead: Trailhead | null;
		loading: boolean;
		error: string | null;
		onselect: (trail: TrailListItem) => void;
		onclose: () => void;
	} = $props();

	let heading: HTMLHeadingElement | undefined = $state();
	let filter: Difficulty | 'all' = $state('all');

	const nome = $derived(trailhead?.nome ?? point?.nome ?? '');
	const tipo = $derived(trailhead?.tipo ?? point?.tipo ?? 'inizio_sentiero');
	const quota = $derived(trailhead?.quota ?? point?.quota ?? null);
	const servizi = $derived(trailhead?.servizi ?? point?.servizi ?? null);
	const osmUrl = $derived(trailhead?.osm?.url ?? null);

	const present = $derived(new Set((trailhead?.sentieri ?? []).map((s) => s.difficolta)));
	const filtered = $derived(
		(trailhead?.sentieri ?? []).filter((s) => filter === 'all' || s.difficolta === filter)
	);

	$effect(() => {
		// nuovo punto: azzera il filtro e porta il focus sul titolo
		void point?.id;
		filter = 'all';
		tick().then(() => heading?.focus());
	});
</script>

<section class="panel" aria-labelledby="th-title" aria-busy={loading}>
	<div class="grabber" aria-hidden="true"></div>
	<header>
		<div class="icon"><TypeIcon kind={iconKind(tipo)} size={34} filled /></div>
		<div class="head">
			<h2 id="th-title" tabindex="-1" bind:this={heading}>{nome}</h2>
			<p class="sub">
				{TYPE_LABELS[iconKind(tipo)]}{#if quota !== null}
					· {quota} m{/if}
			</p>
			{#if servizi && (servizi.parcheggio || servizi.acqua || servizi.rifugio)}
				<ul class="services" aria-label="Servizi vicini">
					{#if servizi.parcheggio}<li><TypeIcon kind="parcheggio" size={16} /> Parcheggio</li>{/if}
					{#if servizi.rifugio}<li><TypeIcon kind="rifugio" size={16} /> Rifugio</li>{/if}
					{#if servizi.acqua}<li><span class="drop" aria-hidden="true"></span> Acqua</li>{/if}
				</ul>
			{/if}
		</div>
		<button class="close" type="button" onclick={onclose} aria-label="Chiudi">×</button>
	</header>

	<div class="body">
		{#if loading}
			<p class="state" role="status">Caricamento dei sentieri…</p>
		{:else if error}
			<p class="state err" role="alert">{error}</p>
		{:else if trailhead}
			{#if trailhead.sentieri.length === 0}
				<p class="state">Nessun sentiero segnato parte da qui. {TESTO_MANCANTE}</p>
			{:else}
				<p class="count">
					{trailhead.sentieri.length}
					{trailhead.sentieri.length === 1 ? 'sentiero parte' : 'sentieri partono'} da qui
				</p>
				{#if present.size > 1}
					<div class="filters" role="group" aria-label="Filtra per difficoltà">
						<button type="button" class="chip" class:on={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}
							>Tutti</button
						>
						{#each DIFFICULTY_ORDER.filter((d) => present.has(d)) as d (d)}
							<button
								type="button"
								class="chip"
								class:on={filter === d}
								aria-pressed={filter === d}
								style:--c={DIFFICULTY_COLORS[d]}
								title={DIFFICULTY_LABELS[d]}
								onclick={() => (filter = filter === d ? 'all' : d)}>{d}</button
							>
						{/each}
					</div>
				{/if}
				<ul class="trails">
					{#each filtered as s (s.id)}
						<li>
							<button type="button" class="row" onclick={() => onselect(s)}>
								<DifficultyBadge difficulty={s.difficolta} />
								<span class="main">
									<span class="name">{s.nome}{#if s.ref}<span class="ref"> · {s.ref}</span>{/if}</span>
									<span class="stats">
										<span><b>{s.durata_txt ?? formatMinutes(s.durata_min)}</b></span>
										<span>{formatKm(s.km, s.km_stimato)}</span>
										<span>↗ {formatGain(s.dislivello_pos)}</span>
									</span>
									{#if s.arrivo}<span class="to">→ {s.arrivo}</span>{/if}
								</span>
								<span class="chev" aria-hidden="true">›</span>
							</button>
						</li>
					{:else}
						<li class="state">Nessun sentiero con questa difficoltà.</li>
					{/each}
				</ul>
			{/if}
			{#if osmUrl}
				<p class="osm"><a href={osmUrl} target="_blank" rel="noopener">Vedi il punto su OpenStreetMap</a></p>
			{/if}
		{/if}
	</div>
</section>

<style>
	.panel {
		position: absolute;
		z-index: 3;
		left: 0;
		right: 0;
		bottom: calc(var(--credits-h, 0px) + env(safe-area-inset-bottom));
		max-height: 58vh;
		display: flex;
		flex-direction: column;
		background: #fff;
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -4px 20px rgb(0 0 0 / 0.25);
	}
	.grabber {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: #d1d5db;
		margin: 8px auto 0;
		flex: none;
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		padding: 0.6rem 0.4rem 0.5rem 1rem;
		border-bottom: 1px solid var(--line);
		flex: none;
	}
	.icon {
		padding-top: 2px;
	}
	.head {
		flex: 1;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.25;
	}
	h2:focus {
		outline: none;
	}
	.sub {
		margin: 0.1rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.services {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.8rem;
		margin: 0.35rem 0 0;
		padding: 0;
		list-style: none;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.services li {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.drop {
		width: 10px;
		height: 10px;
		background: #0284c7;
		border-radius: 50% 50% 50% 0;
		transform: rotate(-45deg);
	}
	.close {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		font-size: 1.8rem;
		line-height: 1;
		cursor: pointer;
		color: var(--muted);
		flex: none;
	}
	.body {
		overflow-y: auto;
		padding: 0.4rem 0.6rem 0.8rem;
		overscroll-behavior: contain;
	}
	.count {
		margin: 0.3rem 0.4rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.filters {
		display: flex;
		gap: 0.4rem;
		padding: 0.2rem 0.4rem 0.5rem;
		flex-wrap: wrap;
	}
	.chip {
		min-width: 44px;
		min-height: 36px;
		padding: 0 0.8rem;
		border-radius: 18px;
		border: 2px solid var(--c, var(--green-900));
		background: #fff;
		color: var(--c, var(--green-900));
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.chip.on {
		background: var(--c, var(--green-900));
		color: #fff;
	}
	.trails {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		min-height: 64px;
		padding: 0.55rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: #fff;
		font: inherit;
		text-align: left;
		cursor: pointer;
		color: var(--ink);
	}
	.row:hover {
		background: #f0fdf4;
		border-color: #86efac;
	}
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.name {
		font-weight: 600;
		font-size: 0.95rem;
		line-height: 1.25;
	}
	.ref {
		color: var(--muted);
		font-weight: 500;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.8rem;
		font-size: 0.85rem;
		color: var(--ink);
	}
	.to {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.chev {
		font-size: 1.6rem;
		color: var(--muted);
	}
	.state {
		padding: 0.8rem 0.4rem;
		color: var(--muted);
		margin: 0;
	}
	.err {
		color: #b91c1c;
	}
	.osm {
		margin: 0.8rem 0.4rem 0;
		font-size: 0.8rem;
	}
	@media (min-width: 768px) {
		.panel {
			top: 76px;
			left: 12px;
			right: auto;
			bottom: calc(var(--credits-h, 0px) + 12px);
			width: 380px;
			max-height: none;
			border-radius: 12px;
			box-shadow: 0 4px 20px rgb(0 0 0 / 0.25);
		}
		.grabber {
			display: none;
		}
		header {
			padding-top: 0.9rem;
		}
	}
</style>
