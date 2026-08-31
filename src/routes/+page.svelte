<script lang="ts">
	import StringQuartetFingerboard from '$lib/StringQuartetFingerboard.svelte';
	import { buildFingerboardLayout, getStringQuartetInstruments } from '$lib/string-quartet';

	const fretCount = 19;
	const a4Options = [415, 430, 440, 442, 444, 446];
	let a4Index = $state(3);
	let a4Hz = $derived(a4Options[a4Index]);
	const fingerboardRatios = {
		'Violin I': 0.72,
		'Violin II': 0.72,
		Viola: 0.84,
		Cello: 1
	};
	const instruments = getStringQuartetInstruments(fingerboardRatios).map((instrument) => ({
		...instrument,
		layout: buildFingerboardLayout(instrument, fretCount)
	}));
</script>

<div class="page-shell">
	<header class="topbar">
		<div>
			<h1>Intonation lab</h1>
		</div>

		<div class="tuning-panel" aria-label="A4 tuning configuration">
			<div class="space-between flex w-full flex-row">
				<label for="a4-slider">A4 reference</label>
				<div class="a4-readout ml-auto">{a4Hz} Hz</div>
			</div>
			<input
				id="a4-slider"
				type="range"
				min="0"
				max={a4Options.length - 1}
				step="1"
				bind:value={a4Index}
				list="a4-values"
			/>
			<datalist id="a4-values">
				{#each a4Options as option (option)}
					<option value={a4Options.indexOf(option)} label={String(option)}></option>
				{/each}
			</datalist>
		</div>
	</header>

	<div class="instrument-stack">
		{#each instruments as instrument (instrument.name)}
			<section class="instrument-panel">
				<div class="instrument-body">
					<div class="instrument-tag">{instrument.name}</div>
					<StringQuartetFingerboard layout={instrument.layout} {instrument} a4={a4Hz} />
				</div>
			</section>
		{/each}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		background: radial-gradient(circle at top, rgba(59, 130, 246, 0.18), transparent 35%), #020817;
		color: #e2e8f0;
		font-family: 'Segoe UI', sans-serif;
	}

	.page-shell {
		max-width: 1560px;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.tuning-panel {
		display: grid;
		gap: 0.5rem;
		min-width: min(420px, 100%);
		padding: 0.9rem 1rem;
		border: 1px solid rgba(148, 163, 184, 0.28);
		border-radius: 0.9rem;
		background: rgba(15, 23, 42, 0.82);
	}

	.tuning-panel label {
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: #bfdbfe;
		display: inline-block;
	}

	.tuning-panel input[type='range'] {
		width: 100%;
		accent-color: #7dd3fc;
	}

	.a4-readout {
		font-size: 0.72rem;
		font-weight: 700;
		color: #e0f2fe;
		text-align: right;
		display: inline-block;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 3rem);
		line-height: 1.1;
	}

	.instrument-stack {
		display: grid;
		grid-template-rows: repeat(4, minmax(0, 1fr));
		gap: 1.25rem;
		min-height: 600px;
		max-height: calc(100vh - 40px);
	}

	.instrument-panel {
		height: 100%;
		min-height: 0;
		background: rgba(15, 23, 42, 0.82);
		border: 1px solid rgba(148, 163, 184, 0.28);
		border-radius: 1rem;
		overflow: hidden;
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.32);
	}

	.instrument-body {
		position: relative;
		height: 100%;
		min-height: 0;
		padding: 0.75rem 0.85rem 0.85rem;
		box-sizing: border-box;
	}

	.instrument-tag {
		position: absolute;
		right: 0.8rem;
		top: 50%;
		transform: translateY(-50%) rotate(180deg);
		writing-mode: vertical-rl;
		padding: 0.5rem 0.45rem;
		border-radius: 0.7rem;
		background: rgba(25, 53, 111);
		border: 1px solid rgba(125, 211, 252, 0.42);
		color: #e0f2fe;
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		pointer-events: none;
		z-index: 100;
	}

	@media (max-width: 860px) {
		.topbar {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
