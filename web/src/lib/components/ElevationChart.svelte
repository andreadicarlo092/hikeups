<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Chart,
		Filler,
		LineController,
		LineElement,
		LinearScale,
		PointElement,
		Tooltip
	} from 'chart.js';
	import type { ProfilePoint } from '$lib/types';

	let { profile, color = '#15803d' }: { profile: ProfilePoint[]; color?: string } = $props();
	let canvas: HTMLCanvasElement;

	Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip);

	onMount(() => {
		const chart = new Chart(canvas, {
			type: 'line',
			data: {
				datasets: [
					{
						data: profile.map((p) => ({ x: p.d_km, y: p.alt_m })),
						borderColor: color,
						backgroundColor: `${color}33`,
						fill: 'start',
						pointRadius: 0,
						borderWidth: 2,
						tension: 0.2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: { mode: 'index', intersect: false },
				scales: {
					x: { type: 'linear', title: { display: true, text: 'km' }, ticks: { maxTicksLimit: 8 } },
					y: { title: { display: true, text: 'm s.l.m.' }, ticks: { maxTicksLimit: 6 } }
				},
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => `${Number(items[0].parsed.x).toFixed(1)} km`,
							label: (item) => `${item.parsed.y} m`
						}
					}
				}
			}
		});
		return () => chart.destroy();
	});

	const min = $derived(profile.length ? Math.min(...profile.map((p) => p.alt_m)) : 0);
	const max = $derived(profile.length ? Math.max(...profile.map((p) => p.alt_m)) : 0);
</script>

<figure>
	<div class="wrap">
		<canvas bind:this={canvas} aria-label={`Profilo altimetrico: quota minima ${min} m, massima ${max} m`}
		></canvas>
	</div>
	<figcaption>Quota minima {min} m · massima {max} m (Copernicus GLO-30)</figcaption>
</figure>

<style>
	figure {
		margin: 0;
	}
	.wrap {
		position: relative;
		height: 200px;
	}
	figcaption {
		color: var(--muted);
		font-size: 0.85rem;
		margin-top: 0.3rem;
	}
</style>
