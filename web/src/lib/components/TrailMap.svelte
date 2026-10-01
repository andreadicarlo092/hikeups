<script lang="ts">
	import { onMount } from 'svelte';
	import { AttributionControl, LngLatBounds, Map as MlMap, NavigationControl } from 'maplibre-gl';
	import { DATA_ATTRIBUTION } from '$lib/config';
	import { initMapLibre, resolveStyleUrl } from '$lib/map';
	import type { Trail } from '$lib/types';

	let { trail, color }: { trail: Trail; color: string } = $props();
	let container: HTMLDivElement;

	onMount(() => {
		initMapLibre();
		let map: MlMap | undefined;
		let disposed = false;
		resolveStyleUrl().then((style) => {
			if (disposed) return;
			const coords = trail.geometry.coordinates;
			const bounds = coords.reduce(
				(b, c) => b.extend(c),
				new LngLatBounds(coords[0], coords[0])
			);
			map = new MlMap({
				container,
				style,
				bounds,
				fitBoundsOptions: { padding: 30 },
				attributionControl: false,
				cooperativeGestures: true
			});
			map.addControl(new AttributionControl({ compact: true, customAttribution: DATA_ATTRIBUTION }));
			map.addControl(new NavigationControl({ showCompass: false }));
			map.on('style.load', () => {
				if (!map) return;
				map.addSource('trail', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: trail.geometry } });
				map.addSource('ends', {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: [
							{ type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: [trail.start.lng, trail.start.lat] } },
							{ type: 'Feature', properties: { kind: 'end' }, geometry: { type: 'Point', coordinates: [trail.end.lng, trail.end.lat] } }
						]
					}
				});
				map.addLayer({ id: 'trail-casing', type: 'line', source: 'trail', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#fff', 'line-width': 7 } });
				map.addLayer({ id: 'trail-line', type: 'line', source: 'trail', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 4 } });
				map.addLayer({
					id: 'trail-ends',
					type: 'circle',
					source: 'ends',
					paint: {
						'circle-radius': 7,
						'circle-color': ['match', ['get', 'kind'], 'start', '#15803d', '#111827'],
						'circle-stroke-color': '#fff',
						'circle-stroke-width': 2.5
					}
				});
			});
		});
		return () => {
			disposed = true;
			map?.remove();
		};
	});
</script>

<div class="map" bind:this={container} role="img" aria-label={`Mappa del percorso ${trail.name}`}></div>

<style>
	.map {
		height: 320px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--line);
	}
</style>
