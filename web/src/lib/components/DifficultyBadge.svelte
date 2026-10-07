<script lang="ts">
	import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, difficultyKey, difficultyText } from '$lib/difficulty';
	import type { Difficulty } from '$lib/types';

	let { difficulty, large = false }: { difficulty: Difficulty | null; large?: boolean } = $props();
	const key = $derived(difficultyKey(difficulty));
</script>

<abbr class="badge" class:large style:background={DIFFICULTY_COLORS[key]} title={DIFFICULTY_LABELS[key]}
	>{difficultyText(difficulty)}</abbr
>

<style>
	.badge {
		display: inline-block;
		min-width: 2.6em;
		padding: 0.15em 0.4em;
		border-radius: 6px;
		color: #fff;
		font-weight: 800;
		font-size: 0.85rem;
		text-align: center;
		text-decoration: none;
		line-height: 1.4;
		flex: none;
	}
	.large {
		font-size: clamp(1.6rem, 7vw, 2.2rem);
		line-height: 1.2;
		padding: 0.1em 0.5em;
		min-width: 2.4em;
		border-radius: 10px;
	}
</style>
