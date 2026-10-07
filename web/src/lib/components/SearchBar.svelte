<script lang="ts">
	import TypeIcon from './TypeIcon.svelte';
	import DifficultyBadge from './DifficultyBadge.svelte';
	import { searchItems, type SearchItem } from '$lib/search';

	let { items, onpick }: { items: SearchItem[]; onpick: (item: SearchItem) => void } = $props();

	let query = $state('');
	let open = $state(false);
	let active = $state(-1);
	let input: HTMLInputElement;

	const results = $derived(searchItems(items, query));
	const showList = $derived(open && query.trim().length >= 2);

	function pick(item: SearchItem) {
		onpick(item);
		query = '';
		open = false;
		active = -1;
		input?.blur();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = Math.min(active + 1, results.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === 'Enter') {
			const item = results[active >= 0 ? active : 0];
			if (item) {
				e.preventDefault();
				pick(item);
			}
		} else if (e.key === 'Escape') {
			open = false;
			active = -1;
		}
	}
</script>

<div class="search" role="search">
	<label class="visually-hidden" for="q">Cerca punti di partenza, rifugi e sentieri</label>
	<div class="field">
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
			><path
				d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"
				fill="#4b5563"
			/></svg
		>
		<input
			id="q"
			bind:this={input}
			bind:value={query}
			type="search"
			placeholder="Cerca parcheggio, rifugio o sentiero…"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			role="combobox"
			aria-expanded={showList}
			aria-controls="search-list"
			aria-autocomplete="list"
			aria-activedescendant={active >= 0 ? `sr-${active}` : undefined}
			onfocus={() => (open = true)}
			oninput={() => {
				open = true;
				active = -1;
			}}
			onblur={() => setTimeout(() => (open = false), 150)}
			onkeydown={onKey}
		/>
	</div>
	{#if showList}
		<ul id="search-list" class="list" role="listbox">
			{#each results as r, i (r.kind + r.thId + (r.trailId ?? '') + r.nome)}
				<li id="sr-{i}" role="option" aria-selected={i === active}>
					<button type="button" class:active={i === active} onmousedown={(e) => e.preventDefault()} onclick={() => pick(r)}>
						<TypeIcon kind={r.kind} size={26} filled />
						<span class="txt">
							<span class="name">{r.nome}</span>
							<span class="sub">{r.sub}</span>
						</span>
						{#if r.kind === 'sentiero'}<DifficultyBadge difficulty={r.difficolta ?? null} />{/if}
					</button>
				</li>
			{:else}
				<li class="none" role="option" aria-selected="false">Nessun risultato per «{query}».</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.search {
		position: relative;
		width: 100%;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.2);
		padding: 0 0.75rem;
		min-height: 48px;
	}
	input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: transparent;
		font: inherit;
		font-size: 1rem; /* 16px: evita lo zoom su iOS */
		min-height: 44px;
		color: var(--ink);
	}
	.field:focus-within {
		outline: 3px solid var(--focus);
	}
	.list {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		margin: 0;
		padding: 4px;
		list-style: none;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
		max-height: min(60vh, 420px);
		overflow-y: auto;
	}
	button {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		min-height: 52px;
		padding: 0.4rem 0.5rem;
		border: 0;
		border-radius: 8px;
		background: transparent;
		font: inherit;
		text-align: left;
		cursor: pointer;
		color: var(--ink);
	}
	button:hover,
	button.active {
		background: #f0fdf4;
	}
	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-weight: 600;
		font-size: 0.95rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		font-size: 0.78rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.none {
		padding: 0.8rem;
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
