<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AttributionControl,
		GeolocateControl,
		LngLatBounds,
		Map as MlMap,
		NavigationControl,
		type GeoJSONSource,
		type MapGeoJSONFeature,
		type MapLayerMouseEvent
	} from 'maplibre-gl';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import TrailheadPanel from '$lib/components/TrailheadPanel.svelte';
	import TrailModal from '$lib/components/TrailModal.svelte';
	import TypeIcon from '$lib/components/TypeIcon.svelte';
	import { ATTRIBUTIONS, DATA_ATTRIBUTION, PILOT_BOUNDS } from '$lib/config';
	import { loadIndex, loadSearchExtra, loadTrail, loadTrailhead } from '$lib/data';
	import { TRAILHEAD_TYPES, TYPE_COLORS, TYPE_LABELS, drawMapIcon, iconKind } from '$lib/icons';
	import { initMapLibre, resolveStyleUrl } from '$lib/map';
	import { buildSearchItems, type SearchItem } from '$lib/search';
	import type { TrailDetail, Trailhead, TrailheadIndex, TrailheadPoint, TrailListItem } from '$lib/types';

	let container: HTMLDivElement;
	let map: MlMap | undefined;
	let index: TrailheadIndex | null = $state(null);
	let indexError: string | null = $state(null);
	let searchItems: SearchItem[] = $state([]);

	let point: TrailheadPoint | null = $state(null);
	let trailhead: Trailhead | null = $state(null);
	let thLoading = $state(false);
	let thError: string | null = $state(null);

	let modalOpen = $state(false);
	let trail: TrailDetail | null = $state(null);
	let trailLoading = $state(false);
	let trailError: string | null = $state(null);

	let thRequest: AbortController | null = null;
	let trailRequest: AbortController | null = null;

	const SRC = 'trailheads';

	function setUrl(params: Record<string, string | null>) {
		const url = new URL(location.href);
		for (const [k, v] of Object.entries(params)) {
			if (v === null) url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		history.replaceState(history.state, '', url);
	}

	function highlight() {
		if (!map?.getLayer('th-selected')) return;
		map.setFilter('th-selected', ['==', ['get', 'id'], point?.id ?? '']);
	}

	function focusPoint(p: { lat: number; lon: number }) {
		if (!map) return;
		const narrow = window.matchMedia('(max-width: 767px)').matches;
		map.flyTo({
			center: [p.lon, p.lat],
			zoom: Math.max(map.getZoom(), 13),
			padding: narrow ? { bottom: Math.round(window.innerHeight * 0.3), top: 0, left: 0, right: 0 } : { left: 200, top: 0, right: 0, bottom: 0 }
		});
	}

	async function openPoint(id: string, fly = true) {
		const p = index?.punti.find((x) => x.id === id);
		if (!p) return;
		thRequest?.abort();
		const req = new AbortController();
		thRequest = req;
		point = p;
		trailhead = null;
		thError = null;
		thLoading = true;
		setUrl({ th: id, t: null });
		highlight();
		if (fly) focusPoint(p);
		try {
			const data = await loadTrailhead(id, req.signal);
			if (req.signal.aborted) return;
			trailhead = data;
		} catch {
			if (req.signal.aborted) return;
			thError = 'Non riesco a caricare questo punto di partenza. Riprova tra poco.';
		} finally {
			if (thRequest === req) {
				thRequest = null;
				thLoading = false;
			}
		}
	}

	function closePanel() {
		thRequest?.abort();
		thRequest = null;
		thLoading = false;
		point = null;
		trailhead = null;
		thError = null;
		setUrl({ th: null, t: null });
		highlight();
	}

	async function openTrail(trailId: string) {
		trailRequest?.abort();
		const req = new AbortController();
		trailRequest = req;
		modalOpen = true;
		trailLoading = true;
		trailError = null;
		trail = null;
		setUrl({ t: trailId });
		try {
			const data = await loadTrail(trailId, req.signal);
			if (req.signal.aborted) return;
			trail = data;
		} catch {
			if (req.signal.aborted) return;
			trailError = 'Non riesco a caricare questo sentiero. Riprova tra poco.';
		} finally {
			if (trailRequest === req) {
				trailRequest = null;
				trailLoading = false;
			}
		}
	}

	function closeModal() {
		trailRequest?.abort();
		trailRequest = null;
		modalOpen = false;
		trail = null;
		trailLoading = false;
		trailError = null;
		setUrl({ t: null });
	}

	function onPick(item: SearchItem) {
		if (item.trailId) {
			openPoint(item.thId, true).then(() => openTrail(item.trailId!));
		} else {
			openPoint(item.thId, true);
		}
	}

	function geojson(idx: TrailheadIndex) {
		return {
			type: 'FeatureCollection' as const,
			features: idx.punti.map((p) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
				properties: { id: p.id, nome: p.nome, tipo: p.tipo, n: p.n_sentieri }
			}))
		};
	}

	function addLayers(m: MlMap, idx: TrailheadIndex) {
		for (const tipo of TRAILHEAD_TYPES) {
			const name = `th-${tipo}`;
			if (!m.hasImage(name)) m.addImage(name, drawMapIcon(iconKind(tipo)), { pixelRatio: 2 });
		}
		if (m.getSource(SRC)) return;
		m.addSource(SRC, {
			type: 'geojson',
			data: geojson(idx),
			cluster: true,
			clusterRadius: 50,
			clusterMaxZoom: 12
		});
		// cluster a zoom basso
		m.addLayer({
			id: 'th-cluster',
			type: 'circle',
			source: SRC,
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': '#14532d',
				'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30],
				'circle-stroke-width': 3,
				'circle-stroke-color': '#ffffff'
			}
		});
		m.addLayer({
			id: 'th-cluster-count',
			type: 'symbol',
			source: SRC,
			filter: ['has', 'point_count'],
			layout: {
				'text-field': ['get', 'point_count_abbreviated'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 14,
				'text-allow-overlap': true
			},
			paint: { 'text-color': '#ffffff' }
		});
		// anello di selezione
		m.addLayer({
			id: 'th-selected',
			type: 'circle',
			source: SRC,
			filter: ['==', ['get', 'id'], ''],
			paint: {
				'circle-radius': 26,
				'circle-color': '#fde047',
				'circle-opacity': 0.55,
				'circle-stroke-color': '#f59e0b',
				'circle-stroke-width': 3
			}
		});
		m.addLayer({
			id: 'th-point',
			type: 'symbol',
			source: SRC,
			filter: ['!', ['has', 'point_count']],
			layout: {
				'icon-image': ['concat', 'th-', ['get', 'tipo']],
				'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.75, 14, 1],
				'icon-allow-overlap': true
			}
		});
		// nomi in un layer separato: se i font non si caricano, le icone restano visibili
		m.addLayer({
			id: 'th-label',
			type: 'symbol',
			source: SRC,
			minzoom: 12,
			filter: ['!', ['has', 'point_count']],
			layout: {
				'text-field': ['get', 'nome'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 12,
				'text-offset': [0, 1.5],
				'text-anchor': 'top',
				'text-optional': true,
				'text-max-width': 9
			},
			paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1.8 }
		});
		highlight();
	}

	function fit(m: MlMap, idx: TrailheadIndex | null, animate = false) {
		const pts = idx?.punti ?? [];
		let b: [number, number, number, number] | null = null;
		if (pts.length > 1) {
			const bb = new LngLatBounds([pts[0].lon, pts[0].lat], [pts[0].lon, pts[0].lat]);
			for (const p of pts) bb.extend([p.lon, p.lat]);
			b = [bb.getWest(), bb.getSouth(), bb.getEast(), bb.getNorth()];
		} else if (idx?.area?.bbox) b = idx.area.bbox;
		m.fitBounds(b ?? PILOT_BOUNDS, { padding: 60, maxZoom: 13, animate });
	}

	onMount(() => {
		initMapLibre();
		let disposed = false;
		const params = new URL(location.href).searchParams;
		const initialTh = params.get('th');
		const initialT = params.get('t');

		const indexPromise = loadIndex().catch(() => {
			indexError = 'Non riesco a caricare i punti di partenza.';
			return null;
		});

		Promise.all([resolveStyleUrl(), indexPromise]).then(([style, idx]) => {
			if (disposed) return;
			index = idx;
			const m = new MlMap({
				container,
				style,
				bounds: idx?.area?.bbox ?? PILOT_BOUNDS,
				fitBoundsOptions: { padding: 40 },
				attributionControl: false,
				dragRotate: false,
				pitchWithRotate: false
			});
			map = m;
			m.touchZoomRotate.disableRotation();
			m.addControl(new AttributionControl({ compact: true, customAttribution: 'Quote: Copernicus DEM' }));
			m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
			m.addControl(
				new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
				'top-right'
			);

			if (idx) {
				const setup = () => addLayers(m, idx);
				m.on('style.load', setup);
				if (initialTh) {
					openPoint(initialTh, false).then(() => {
						if (initialT) openTrail(initialT);
					});
				} else if (initialT) openTrail(initialT);
			}

			m.on('click', 'th-cluster', async (e: MapLayerMouseEvent) => {
				const f = e.features?.[0] as MapGeoJSONFeature | undefined;
				if (!f) return;
				const src = m.getSource(SRC) as GeoJSONSource;
				const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id as number);
				m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.5 });
			});
			m.on('click', 'th-point', (e: MapLayerMouseEvent) => {
				const f = e.features?.[0];
				if (f) openPoint(String(f.properties.id), false);
			});
			for (const layer of ['th-cluster', 'th-point']) {
				m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
				m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
			}
		});

		// Ricerca: carica in background i file dei punti (pochi nel pilota) + indice opzionale
		indexPromise.then(async (idx) => {
			if (!idx || disposed) return;
			searchItems = buildSearchItems(idx, []);
			const [extra, ths] = await Promise.all([
				loadSearchExtra(),
				Promise.all(idx.punti.slice(0, 120).map((p) => loadTrailhead(p.id).catch(() => null)))
			]);
			if (disposed) return;
			searchItems = buildSearchItems(
				idx,
				ths.filter((t): t is Trailhead => !!t),
				extra
			);
		});

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !modalOpen && point) closePanel();
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
	<title>hikeups — punti di partenza dei sentieri</title>
	<meta
		name="description"
		content="Scegli un punto di partenza e scopri i sentieri CAI che partono da lì: difficoltà, durata, km, dislivello e scheda PDF."
	/>
	<meta property="og:title" content="hikeups — punti di partenza dei sentieri" />
	<meta property="og:type" content="website" />
</svelte:head>

<main class="app" class:open={!!point}>
	<h1 class="visually-hidden">hikeups — mappa dei punti di partenza dei sentieri</h1>
	<div class="map" bind:this={container} role="region" aria-label="Mappa dei punti di partenza"></div>

	<div class="top">
		<SearchBar items={searchItems} onpick={onPick} />
	</div>

	{#if !point}
		<div class="hint" role="note">
			{#if indexError}
				<span class="bad">{indexError}</span>
			{:else}
				<strong>{index?.area?.nome ?? 'hikeups'}</strong>
				<span>Tocca un punto di partenza per vedere i sentieri che partono da lì.</span>
				{#if index?.esempio}
					<span class="demo">Dati di esempio: non sono sentieri reali.</span>
				{/if}
			{/if}
		</div>
		<ul class="legend" aria-label="Tipi di punto di partenza">
			{#each TRAILHEAD_TYPES as t (t)}
				<li><TypeIcon kind={t} size={18} filled /> {TYPE_LABELS[t]}</li>
			{/each}
		</ul>
	{/if}

	{#if point}
		<TrailheadPanel {point} {trailhead} loading={thLoading} error={thError} onselect={(s: TrailListItem) => openTrail(s.id)} onclose={closePanel} />
	{/if}

	<footer class="credits">
		{#each ATTRIBUTIONS as a, i (a.label)}<a href={a.href} target="_blank" rel="noopener">{a.label}</a>{i < ATTRIBUTIONS.length - 1 ? ' · ' : ''}{/each}
	</footer>

	{#if modalOpen}
		<TrailModal {trail} loading={trailLoading} error={trailError} onclose={closeModal} onopentrail={openTrail} />
	{/if}
</main>

<style>
	.app {
		position: fixed;
		inset: 0;
		--credits-h: 24px;
	}
	.map {
		position: absolute;
		inset: 0 0 var(--credits-h) 0;
	}
	.top {
		position: absolute;
		z-index: 4;
		top: 10px;
		left: 10px;
		right: 60px;
		max-width: 420px;
	}
	.hint {
		position: absolute;
		z-index: 1;
		left: 10px;
		top: 68px;
		max-width: min(340px, calc(100% - 80px));
		background: #fff;
		padding: 0.55rem 0.8rem;
		border-radius: 10px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.15);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.88rem;
	}
	.hint strong {
		color: var(--green-900);
		font-size: 1rem;
	}
	.demo {
		color: #92400e;
		font-weight: 600;
	}
	.bad {
		color: #b91c1c;
	}
	.legend {
		position: absolute;
		z-index: 1;
		left: 10px;
		bottom: calc(var(--credits-h) + 10px);
		margin: 0;
		padding: 0.4rem 0.6rem;
		list-style: none;
		background: #fff;
		border-radius: 10px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.15);
		font-size: 0.78rem;
		display: none;
	}
	.legend li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.1rem 0;
	}
	.credits {
		position: absolute;
		z-index: 5;
		left: 0;
		right: 0;
		bottom: 0;
		height: var(--credits-h);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		background: #fff;
		border-top: 1px solid var(--line);
		font-size: 0.72rem;
		color: var(--muted);
		padding-bottom: env(safe-area-inset-bottom);
		box-sizing: content-box;
	}
	.credits a {
		color: var(--muted);
	}
	:global(.maplibregl-ctrl-bottom-right),
	:global(.maplibregl-ctrl-bottom-left) {
		z-index: 1;
	}
	@media (min-width: 768px) {
		.legend {
			display: block;
		}
		.top {
			width: 380px;
			right: auto;
		}
		.hint {
			top: 72px;
		}
		.app.open :global(.maplibregl-ctrl-top-right) {
			z-index: 1;
		}
	}
</style>
