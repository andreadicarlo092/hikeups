<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AttributionControl,
		GeolocateControl,
		Map as MlMap,
		NavigationControl,
		type ExpressionSpecification,
		type MapGeoJSONFeature,
		type MapLayerMouseEvent
	} from 'maplibre-gl';
	import TrailheadPanel from '$lib/components/TrailheadPanel.svelte';
	import { DATA_ATTRIBUTION, LOMBARDIA_BOUNDS, absoluteAssetUrl, assetUrl } from '$lib/config';
	import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, difficultyColorExpression } from '$lib/difficulty';
	import { initMapLibre, resolveStyleUrl } from '$lib/map';
	import type { Trailhead, TrailSummary } from '$lib/types';

	let container: HTMLDivElement;
	let map: MlMap | undefined;
	let trailhead: Trailhead | null = $state(null);
	let panelOpen = $state(false);
	let loading = $state(false);
	let error: string | null = $state(null);
	let selectedTrailId: number | null = $state(null);

	const NONE: ExpressionSpecification = ['==', ['get', 'id'], -1];

	function setUrl(thId: number | null) {
		const url = new URL(location.href);
		if (thId === null) url.searchParams.delete('th');
		else url.searchParams.set('th', String(thId));
		history.replaceState(history.state, '', url);
	}

	function applyFilters() {
		if (!map?.getLayer('trails-trailhead')) return;
		const ids = trailhead?.trails.map((t) => t.id) ?? [];
		map.setFilter(
			'trails-trailhead',
			ids.length ? ['in', ['get', 'id'], ['literal', ids]] : NONE
		);
		map.setFilter(
			'trails-selected',
			selectedTrailId !== null ? ['==', ['get', 'id'], selectedTrailId] : NONE
		);
		map.setFilter(
			'trailheads-selected',
			trailhead ? ['==', ['get', 'id'], trailhead.id] : NONE
		);
	}

	let trailheadRequest: AbortController | null = null;

	async function openTrailhead(id: number, fly = false) {
		trailheadRequest?.abort();
		const request = new AbortController();
		trailheadRequest = request;
		panelOpen = true;
		loading = true;
		error = null;
		selectedTrailId = null;
		try {
			const res = await fetch(assetUrl(`/data/trailheads/${id}.json`), { signal: request.signal });
			if (!res.ok) throw new Error(String(res.status));
			const data = (await res.json()) as Trailhead;
			if (request.signal.aborted) return;
			trailhead = data;
			setUrl(id);
			if (fly && map) map.flyTo({ center: [data.lng, data.lat], zoom: 13 });
		} catch {
			if (request.signal.aborted) return;
			trailhead = null;
			error = 'Impossibile caricare questo punto di partenza.';
		} finally {
			if (trailheadRequest === request) {
				trailheadRequest = null;
				loading = false;
				applyFilters();
			}
		}
	}

	function closePanel() {
		trailheadRequest?.abort();
		trailheadRequest = null;
		loading = false;
		panelOpen = false;
		trailhead = null;
		selectedTrailId = null;
		error = null;
		setUrl(null);
		applyFilters();
	}

	function selectTrail(trail: TrailSummary) {
		selectedTrailId = selectedTrailId === trail.id ? null : trail.id;
		applyFilters();
	}

	function addOverlays(m: MlMap) {
		const firstSymbol = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;
		const font = ['Noto Sans Bold'];

		m.addSource('trails', { type: 'vector', url: `pmtiles://${absoluteAssetUrl('/tiles/trails.pmtiles')}` });
		m.addSource('trailheads', {
			type: 'vector',
			url: `pmtiles://${absoluteAssetUrl('/tiles/trailheads.pmtiles')}`
		});
		m.addSource('huts', { type: 'vector', url: `pmtiles://${absoluteAssetUrl('/tiles/huts.pmtiles')}` });

		const color = difficultyColorExpression as unknown as ExpressionSpecification;
		const width = (base: number): ExpressionSpecification => [
			'interpolate',
			['linear'],
			['zoom'],
			8,
			base * 0.6,
			12,
			base * 1.4,
			15,
			base * 2.6
		];

		m.addLayer(
			{
				id: 'trails-line',
				type: 'line',
				source: 'trails',
				'source-layer': 'trails',
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: { 'line-color': color, 'line-width': width(1.2), 'line-opacity': 0.75 }
			},
			firstSymbol
		);
		m.addLayer(
			{
				id: 'trails-trailhead',
				type: 'line',
				source: 'trails',
				'source-layer': 'trails',
				filter: NONE,
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: { 'line-color': color, 'line-width': width(2.2), 'line-opacity': 1 }
			},
			firstSymbol
		);
		m.addLayer(
			{
				id: 'trails-selected-casing',
				type: 'line',
				source: 'trails',
				'source-layer': 'trails',
				filter: NONE,
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: { 'line-color': '#fde047', 'line-width': width(5) }
			},
			firstSymbol
		);
		m.addLayer(
			{
				id: 'trails-selected',
				type: 'line',
				source: 'trails',
				'source-layer': 'trails',
				filter: NONE,
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: { 'line-color': color, 'line-width': width(2.6) }
			},
			firstSymbol
		);
		m.addLayer({
			id: 'trails-ref',
			type: 'symbol',
			source: 'trails',
			'source-layer': 'trails',
			minzoom: 13,
			layout: {
				'symbol-placement': 'line',
				'text-field': ['get', 'cai_ref'],
				'text-font': font,
				'text-size': 11
			},
			paint: { 'text-color': '#111827', 'text-halo-color': '#fff', 'text-halo-width': 2 }
		});
		m.addLayer({
			id: 'huts',
			type: 'circle',
			source: 'huts',
			'source-layer': 'huts',
			minzoom: 10,
			paint: {
				'circle-radius': 4,
				'circle-color': '#92400e',
				'circle-stroke-color': '#fff',
				'circle-stroke-width': 1.5
			}
		});
		m.addLayer({
			id: 'huts-label',
			type: 'symbol',
			source: 'huts',
			'source-layer': 'huts',
			minzoom: 13,
			layout: {
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Italic'],
				'text-size': 11,
				'text-offset': [0, 1.1],
				'text-anchor': 'top',
				'text-optional': true
			},
			paint: { 'text-color': '#78350f', 'text-halo-color': '#fff', 'text-halo-width': 1.5 }
		});

		const isCluster: ExpressionSpecification = ['has', 'point_count'];
		m.addLayer({
			id: 'trailheads-cluster',
			type: 'circle',
			source: 'trailheads',
			'source-layer': 'trailheads',
			filter: isCluster,
			paint: {
				'circle-color': '#14532d',
				'circle-opacity': 0.9,
				'circle-stroke-color': '#fff',
				'circle-stroke-width': 2,
				'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 13, 20, 18, 100, 26]
			}
		});
		m.addLayer({
			id: 'trailheads-cluster-count',
			type: 'symbol',
			source: 'trailheads',
			'source-layer': 'trailheads',
			filter: isCluster,
			layout: {
				'text-field': ['to-string', ['get', 'point_count']],
				'text-font': font,
				'text-size': 12,
				'text-allow-overlap': true
			},
			paint: { 'text-color': '#fff' }
		});
		m.addLayer({
			id: 'trailheads-point',
			type: 'circle',
			source: 'trailheads',
			'source-layer': 'trailheads',
			filter: ['!', isCluster],
			paint: {
				'circle-color': '#fff',
				'circle-stroke-color': '#14532d',
				'circle-stroke-width': 3,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 9]
			}
		});
		m.addLayer({
			id: 'trailheads-selected',
			type: 'circle',
			source: 'trailheads',
			'source-layer': 'trailheads',
			filter: NONE,
			paint: {
				'circle-color': '#14532d',
				'circle-stroke-color': '#fde047',
				'circle-stroke-width': 4,
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 14, 11]
			}
		});
		m.addLayer({
			id: 'trailheads-label',
			type: 'symbol',
			source: 'trailheads',
			'source-layer': 'trailheads',
			filter: ['!', isCluster],
			minzoom: 12,
			layout: {
				'text-field': ['get', 'name'],
				'text-font': font,
				'text-size': 12,
				'text-offset': [0, 1.2],
				'text-anchor': 'top',
				'text-optional': true
			},
			paint: { 'text-color': '#14532d', 'text-halo-color': '#fff', 'text-halo-width': 2 }
		});
		applyFilters();
	}

	function featureId(f: MapGeoJSONFeature): number {
		return Number(f.properties.id);
	}

	onMount(() => {
		initMapLibre();
		let disposed = false;
		const initialTh = Number(new URL(location.href).searchParams.get('th')) || null;

		resolveStyleUrl().then((style) => {
			if (disposed) return;
			const m = new MlMap({
				container,
				style,
				bounds: LOMBARDIA_BOUNDS,
				fitBoundsOptions: { padding: 20 },
				maxBounds: [5.5, 43.5, 14.5, 48],
				attributionControl: false
			});
			map = m;
			m.addControl(new AttributionControl({ compact: true, customAttribution: DATA_ATTRIBUTION }));
			m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
			m.addControl(
				new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
				'top-right'
			);

			m.on('style.load', () => addOverlays(m));
			m.on('load', () => {
				if (initialTh) openTrailhead(initialTh, true);
			});

			m.on('click', 'trailheads-cluster', (e: MapLayerMouseEvent) => {
				m.easeTo({ center: e.lngLat, zoom: Math.min(m.getZoom() + 2, 14) });
			});
			m.on('click', 'trailheads-point', (e: MapLayerMouseEvent) => {
				const f = e.features?.[0];
				if (f) openTrailhead(featureId(f));
			});
			m.on('click', (e) => {
				const hits = m.queryRenderedFeatures(e.point, {
					layers: ['trailheads-cluster', 'trailheads-point']
				});
				if (hits.length || !trailhead) return;
				const lines = m.queryRenderedFeatures(
					[
						[e.point.x - 6, e.point.y - 6],
						[e.point.x + 6, e.point.y + 6]
					],
					{ layers: ['trails-trailhead'] }
				);
				if (lines.length) {
					const id = featureId(lines[0]);
					const trail = trailhead.trails.find((t) => t.id === id);
					if (trail) selectTrail(trail);
				}
			});
			for (const layer of ['trailheads-cluster', 'trailheads-point', 'trails-trailhead']) {
				m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
				m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
			}
		});

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && panelOpen) closePanel();
		};
		window.addEventListener('keydown', onKey);
		return () => {
			disposed = true;
			window.removeEventListener('keydown', onKey);
			map?.remove();
		};
	});
</script>

<svelte:head>
	<title>Trail Explorer — sentieri della Lombardia</title>
	<meta
		name="description"
		content="Scegli un punto di partenza e scopri tutti i sentieri CAI che partono da lì: difficoltà, lunghezza, dislivello, tempo e GPX."
	/>
	<meta property="og:title" content="Trail Explorer — sentieri della Lombardia" />
	<meta property="og:type" content="website" />
</svelte:head>

<main class="app">
	<h1 class="visually-hidden">Trail Explorer — mappa dei sentieri della Lombardia</h1>
	<div class="map" bind:this={container} role="region" aria-label="Mappa dei sentieri"></div>

	{#if !panelOpen}
		<div class="hint" role="note">
			<strong>Trail Explorer</strong>
			<span>Tocca un punto di partenza <span class="dot" aria-hidden="true"></span> per vedere i sentieri.</span>
		</div>
	{/if}

	<details class="legend">
		<summary>Legenda</summary>
		<ul>
			{#each ['T', 'E', 'EE', 'EEA', '?'] as const as d (d)}
				<li><span class="swatch" style:background={DIFFICULTY_COLORS[d]}></span>{d} — {DIFFICULTY_LABELS[d]}</li>
			{/each}
			<li><span class="hut" aria-hidden="true"></span>Rifugio / bivacco</li>
		</ul>
	</details>

	{#if panelOpen}
		<TrailheadPanel {trailhead} {loading} {error} {selectedTrailId} onselect={selectTrail} onclose={closePanel} />
	{/if}
</main>

<style>
	.app {
		position: fixed;
		inset: 0;
	}
	.map {
		position: absolute;
		inset: 0;
	}
	.hint {
		position: absolute;
		z-index: 1;
		left: 12px;
		top: 12px;
		max-width: calc(100% - 80px);
		background: #fff;
		padding: 0.6rem 0.8rem;
		border-radius: 10px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.15);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.9rem;
	}
	.hint strong {
		color: var(--green-900);
		font-size: 1rem;
	}
	.dot {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 3px solid #14532d;
		background: #fff;
		vertical-align: -1px;
	}
	.legend {
		position: absolute;
		z-index: 1;
		right: 10px;
		bottom: 34px;
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.15);
		padding: 0.4rem 0.7rem;
		font-size: 0.85rem;
	}
	.legend summary {
		cursor: pointer;
		font-weight: 600;
		min-height: 28px;
		line-height: 28px;
	}
	.legend ul {
		list-style: none;
		margin: 0.3rem 0 0;
		padding: 0;
	}
	.legend li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.1rem 0;
	}
	.swatch {
		width: 18px;
		height: 4px;
		border-radius: 2px;
	}
	.hut {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #92400e;
		margin: 0 4px;
	}
	@media (max-width: 767px) {
		.legend {
			bottom: auto;
			top: 120px;
		}
	}
</style>
