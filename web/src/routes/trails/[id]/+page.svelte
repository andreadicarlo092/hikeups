<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import DifficultyBadge from '$lib/components/DifficultyBadge.svelte';
	import ElevationChart from '$lib/components/ElevationChart.svelte';
	import TrailMap from '$lib/components/TrailMap.svelte';
	import { assetUrl } from '$lib/config';
	import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, difficultyKey } from '$lib/difficulty';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import type { Trail } from '$lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const meta = $derived(data.trail);
	const color = $derived(DIFFICULTY_COLORS[difficultyKey(meta.difficulty)]);
	let full: Trail | null = $state(null);
	let loadError = $state(false);
	let shareMsg = $state('');

	const description = $derived(
		`${meta.difficulty ?? '?'} · ${formatKm(meta.length_km)} · ↗ ${formatMeters(meta.elevation_gain_m)} · ${formatDuration(meta.duration_hours)}` +
			(meta.trailheads.length ? ` · partenza da ${meta.trailheads[0].name}` : '')
	);
	const backHref = $derived(meta.trailheads.length ? `${base}/?th=${meta.trailheads[0].id}` : `${base}/`);

	onMount(async () => {
		try {
			const res = await fetch(assetUrl(`/data/trails/${meta.id}.json`));
			if (!res.ok) throw new Error(String(res.status));
			full = await res.json();
		} catch {
			loadError = true;
		}
	});

	async function share() {
		const url = location.href;
		if (navigator.share) {
			try {
				await navigator.share({ title: meta.name, text: description, url });
				return;
			} catch {
				/* user cancelled: fall back to copy */
			}
		}
		await navigator.clipboard.writeText(url);
		shareMsg = 'Link copiato negli appunti';
	}
</script>

<svelte:head>
	<title>{meta.name} — Trail Explorer</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={meta.name} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="article" />
</svelte:head>

<main class="sheet">
	<nav><a href={backHref}>← Torna alla mappa</a></nav>

	<header>
		<p class="ref">
			<DifficultyBadge difficulty={meta.difficulty} />
			{#if meta.cai_ref}<span>Sentiero n. {meta.cai_ref}</span>{/if}
			<span class="muted">{DIFFICULTY_LABELS[difficultyKey(meta.difficulty)]}</span>
		</p>
		<h1>{meta.name}</h1>
		{#if meta.from || meta.to}
			<p class="muted">{[meta.from, meta.to].filter(Boolean).join(' → ')}</p>
		{/if}
	</header>

	<dl class="stats">
		<div><dt>Lunghezza</dt><dd>{formatKm(meta.length_km)}</dd></div>
		<div><dt>Dislivello +</dt><dd>{formatMeters(meta.elevation_gain_m)}</dd></div>
		<div><dt>Dislivello −</dt><dd>{formatMeters(meta.elevation_loss_m)}</dd></div>
		<div><dt>Tempo CAI</dt><dd>{formatDuration(meta.duration_hours)}</dd></div>
	</dl>

	<div class="actions">
		<a class="btn" href={assetUrl(meta.gpx_url)} download={`${meta.id}.gpx`}>Scarica GPX</a>
		<a class="btn secondary" href={meta.osm_url} target="_blank" rel="noopener">Apri in OpenStreetMap</a>
		<button class="btn secondary" onclick={share}>Condividi</button>
		<span class="muted" role="status">{shareMsg}</span>
	</div>

	{#if loadError}
		<p role="alert">Impossibile caricare percorso e profilo.</p>
	{:else if full}
		<section aria-labelledby="map-h">
			<h2 id="map-h">Percorso</h2>
			<TrailMap trail={full} {color} />
			<p class="muted legend">
				<span class="dot start"></span> Inizio · <span class="dot end"></span> Fine
			</p>
		</section>
		<section aria-labelledby="profile-h">
			<h2 id="profile-h">Profilo altimetrico</h2>
			<ElevationChart profile={full.elevation_profile} {color} />
		</section>
	{:else}
		<p class="muted" aria-live="polite">Caricamento percorso…</p>
	{/if}

	{#if meta.description}
		<section aria-labelledby="desc-h">
			<h2 id="desc-h">Descrizione</h2>
			<p>{meta.description}</p>
		</section>
	{/if}

	{#if meta.trailheads.length}
		<section aria-labelledby="th-h">
			<h2 id="th-h">Punti di partenza</h2>
			<ul>
				{#each meta.trailheads as th (th.id)}
					<li><a href={`${base}/?th=${th.id}`}>{th.name}</a></li>
				{/each}
			</ul>
		</section>
	{/if}

	<footer class="muted">
		<p>
			Tempo stimato con la formula CAI (km / 4 + dislivello / 400).
			{#if meta.difficulty_source !== 'cai_scale'}
				Difficoltà {meta.difficulty ? `stimata da ${meta.difficulty_source}` : 'non indicata su OSM'}.
			{/if}
			{#if meta.operator}Gestore: {meta.operator}.{/if}
		</p>
		<p>
			Dati © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>
			(ODbL). Qualcosa non torna? <a href={meta.osm_url} target="_blank" rel="noopener">Correggilo su OSM</a>.
		</p>
	</footer>
</main>

<style>
	.sheet {
		max-width: 760px;
		margin: 0 auto;
		padding: 1rem 1rem 3rem;
		padding-bottom: calc(3rem + env(safe-area-inset-bottom));
	}
	nav a {
		display: inline-block;
		padding: 0.5rem 0;
		min-height: 44px;
		font-weight: 600;
	}
	h1 {
		margin: 0.3rem 0;
		font-size: 1.6rem;
		line-height: 1.2;
	}
	h2 {
		font-size: 1.1rem;
		margin: 1.6rem 0 0.6rem;
	}
	.ref {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin: 0.5rem 0 0;
		font-weight: 600;
	}
	.muted {
		color: var(--muted);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin: 1rem 0;
	}
	@media (max-width: 520px) {
		.stats {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.stats div {
		background: #f3f4f6;
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
	}
	dt {
		font-size: 0.8rem;
		color: var(--muted);
	}
	dd {
		margin: 0.15rem 0 0;
		font-size: 1.15rem;
		font-weight: 700;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.legend {
		font-size: 0.85rem;
	}
	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		vertical-align: -1px;
	}
	.dot.start {
		background: #15803d;
	}
	.dot.end {
		background: #111827;
	}
	footer {
		margin-top: 2rem;
		font-size: 0.85rem;
		border-top: 1px solid var(--line);
	}
</style>
