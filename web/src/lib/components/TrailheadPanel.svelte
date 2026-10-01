<script lang="ts">
	import { base } from '$app/paths';
	import DifficultyBadge from './DifficultyBadge.svelte';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import type { Trailhead, TrailSummary } from '$lib/types';

	let {
		trailhead,
		loading = false,
		error = null,
		selectedTrailId = null,
		onselect,
		onclose
	}: {
		trailhead: Trailhead | null;
		loading?: boolean;
		error?: string | null;
		selectedTrailId?: number | null;
		onselect: (trail: TrailSummary) => void;
		onclose: () => void;
	} = $props();

	let heading: HTMLHeadingElement | undefined = $state();

	$effect(() => {
		if (trailhead && heading) heading.focus();
	});
</script>

<section class="panel" aria-labelledby="panel-title" aria-busy={loading}>
	<div class="grabber" aria-hidden="true"></div>
	<header>
		{#if trailhead}
			<div>
				<h2 id="panel-title" tabindex="-1" bind:this={heading}>{trailhead.name}</h2>
				<p class="sub">
					{trailhead.trail_count}
					{trailhead.trail_count === 1 ? 'sentiero parte' : 'sentieri partono'} da qui
				</p>
			</div>
		{:else}
			<h2 id="panel-title">{loading ? 'Caricamento…' : 'Punto di partenza'}</h2>
		{/if}
		<button class="close" onclick={onclose} aria-label="Chiudi pannello">×</button>
	</header>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if trailhead}
		<ul class="trails">
			{#each trailhead.trails as trail (trail.id)}
				<li class:selected={trail.id === selectedTrailId}>
					<button class="row" onclick={() => onselect(trail)} aria-pressed={trail.id === selectedTrailId}>
						<DifficultyBadge difficulty={trail.difficulty} />
						<span class="body">
							<span class="name">{trail.name}</span>
							<span class="stats">
								{formatKm(trail.length_km)} · ↗ {formatMeters(trail.elevation_gain_m)} · ↘ {formatMeters(
									trail.elevation_loss_m
								)} · {formatDuration(trail.duration_hours)}
							</span>
						</span>
					</button>
					{#if trail.id === selectedTrailId}
						<a class="btn open" href={`${base}/trails/${trail.id}`}>Apri scheda sentiero →</a>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.panel {
		position: absolute;
		z-index: 2;
		background: #fff;
		display: flex;
		flex-direction: column;
		box-shadow: 0 -2px 16px rgb(0 0 0 / 0.18);
		left: 0;
		right: 0;
		bottom: 0;
		max-height: 55vh;
		border-radius: 14px 14px 0 0;
		padding-bottom: env(safe-area-inset-bottom);
	}
	@media (min-width: 768px) {
		.panel {
			top: 12px;
			left: 12px;
			bottom: 12px;
			right: auto;
			width: 380px;
			max-height: none;
			border-radius: 12px;
		}
		.grabber {
			display: none;
		}
	}
	.grabber {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: #d1d5db;
		margin: 8px auto 0;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem 1rem 0.5rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0;
		font-size: 1.15rem;
	}
	.sub {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.close {
		border: 0;
		background: none;
		font-size: 1.8rem;
		line-height: 1;
		cursor: pointer;
		min-width: 44px;
		min-height: 44px;
		color: var(--muted);
	}
	.error {
		color: #b91c1c;
		padding: 0 1rem;
	}
	.trails {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
	}
	li {
		border-bottom: 1px solid var(--line);
	}
	li.selected {
		background: #f0fdf4;
	}
	.row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		width: 100%;
		padding: 0.75rem 1rem;
		border: 0;
		background: none;
		font: inherit;
		text-align: left;
		cursor: pointer;
		color: inherit;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.name {
		font-weight: 600;
	}
	.stats {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.open {
		margin: 0 1rem 0.75rem 4.1rem;
	}
</style>
