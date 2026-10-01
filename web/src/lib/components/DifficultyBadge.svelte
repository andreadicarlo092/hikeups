<script lang="ts">
	import { DIFFICULTY_COLORS, DIFFICULTY_LABELS, difficultyKey } from '$lib/difficulty';
	import type { Difficulty } from '$lib/types';

	let { difficulty }: { difficulty: Difficulty | null } = $props();
	const key = $derived(difficultyKey(difficulty));
</script>

<abbr class="badge" style:background={DIFFICULTY_COLORS[key]} title={DIFFICULTY_LABELS[key]}>{key}</abbr>

<style>
	.badge {
		display: inline-block;
		min-width: 2.6em;
		padding: 0.15em 0.4em;
		border-radius: 4px;
		color: #fff;
		font-weight: 700;
		font-size: 0.8rem;
		text-align: center;
		text-decoration: none;
		line-height: 1.4;
	}
</style>
