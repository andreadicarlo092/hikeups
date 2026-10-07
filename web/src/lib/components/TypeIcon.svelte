<script lang="ts">
	import { ICON_PATHS, TYPE_COLORS, type IconKind } from '$lib/icons';

	let {
		kind,
		size = 20,
		filled = false
	}: { kind: IconKind; size?: number; /** cerchio colorato dietro il glifo */ filled?: boolean } = $props();
</script>

{#if filled}
	<span class="chip" style:background={TYPE_COLORS[kind]} style:width="{size}px" style:height="{size}px">
		<svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} aria-hidden="true" focusable="false">
			<path d={ICON_PATHS[kind]} fill="#fff" fill-rule="evenodd" />
		</svg>
	</span>
{:else}
	<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
		<path d={ICON_PATHS[kind]} fill={TYPE_COLORS[kind]} fill-rule="evenodd" />
	</svg>
{/if}

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		flex: none;
	}
	svg {
		flex: none;
	}
</style>
