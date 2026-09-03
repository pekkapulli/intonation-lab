<script lang="ts">
	import StringQuartetFingerboard from '$lib/StringQuartetFingerboard.svelte';
	import WelcomeDialog from '$lib/WelcomeDialog.svelte';
	import { buildFingerboardLayout, getStringQuartetInstruments } from '$lib/string-quartet';
	import { startAudioEngine } from '$lib/synth/audioStart';

	const fretCount = 19;
	const a4Options = [415, 430, 440, 442, 444, 446];
	let a4Index = $state(3);
	let a4Hz = $derived(a4Options[a4Index]);
	let activeFrequencies = $state<Record<string, number | null>>({});
	let stopAllSignal = $state(0);
	let welcomeOpen = $state(true);
	let pageWidth = $state(0);
	let isCompactLayout = $derived(pageWidth <= 640);
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

	function handleInstrumentFrequencyChange(instrumentId: string, frequency: number | null) {
		activeFrequencies[instrumentId] = frequency;
	}

	async function handleWelcomeStart() {
		welcomeOpen = false;
		await startAudioEngine();
	}

	function stopAllNotes() {
		activeFrequencies = {};
		stopAllSignal += 1;
		const activeElement = document.activeElement;
		if (activeElement instanceof HTMLElement) {
			activeElement.blur();
		}
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			stopAllNotes();
		}
	}
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<WelcomeDialog bind:open={welcomeOpen} onClose={handleWelcomeStart} />

<div class="page-shell" bind:clientWidth={pageWidth} class:compact={isCompactLayout}>
	<header class="site-header" class:compact={isCompactLayout}>
		<div class="site-heading">
			<h1 class="site-title">The Sine Quartet</h1>
			<p class="credit-line">
				Made for exploration of string harmony by
				<a href="https://sharpestnote.com" target="_blank" rel="noreferrer"
					>Pekka Pulli from The Sharpest Note</a
				>
				in conversation with Vitor Vieira.
			</p>
		</div>
	</header>

	<header class="topbar" class:compact={isCompactLayout}>
		<div class="tuning-panel" class:compact={isCompactLayout} aria-label="A4 tuning configuration">
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

		<button type="button" class="stop-all-button" onclick={stopAllNotes} aria-keyshortcuts="Escape">
			Stop all notes <span class="shortcut">(esc)</span>
		</button>
	</header>

	<div class="instrument-stack" class:compact={isCompactLayout}>
		{#each instruments as instrument (instrument.name)}
			<section class="instrument-panel" class:compact={isCompactLayout}>
				<div class="instrument-body">
					<StringQuartetFingerboard
						layout={instrument.layout}
						{instrument}
						instrumentId={instrument.name}
						a4={a4Hz}
						compact={isCompactLayout}
						activeFrequencyByInstrument={activeFrequencies}
						{stopAllSignal}
						onFrequencyChange={handleInstrumentFrequencyChange}
					/>
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

	.site-header {
		display: flex;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.site-heading {
		display: grid;
		gap: 0.6rem;
		max-width: 760px;
	}

	.site-title {
		margin: 0;
		font-size: clamp(2.5rem, 5vw, 5.5rem);
		line-height: 0.95;
		letter-spacing: -0.06em;
		font-weight: 800;
		color: #f8fbff;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.credit-line {
		margin: 0;
		font-size: 1rem;
		line-height: 1.4;
		color: rgba(191, 219, 254, 0.8);
	}

	.credit-line a {
		color: #7dd3fc;
		text-decoration: none;
	}

	.credit-line a:hover {
		text-decoration: underline;
	}

	.stop-all-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.72rem 1rem;
		border: 1px solid rgba(248, 113, 113, 0.7);
		border-radius: 999px;
		background: rgba(127, 29, 29, 0.75);
		color: #fee2e2;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		cursor: pointer;
	}

	.shortcut {
		font-size: 0.72rem;
		opacity: 0.85;
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

	.instrument-stack {
		display: grid;
		grid-template-rows: repeat(4, minmax(0, 1fr));
		gap: 1.25rem;
		min-height: 600px;
		max-height: calc(100vh - 40px);
	}

	.instrument-stack.compact {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 0;
		max-height: none;
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

	.instrument-panel.compact {
		height: 480px;
		min-height: 300px;
		width: 100%;
	}

	.page-shell.compact {
		padding: 1rem 0.7rem 2.25rem;
		max-width: none;
	}

	.topbar.compact {
		flex-direction: column;
		align-items: stretch;
	}

	.tuning-panel.compact {
		min-width: 0;
	}

	.instrument-body {
		position: relative;
		display: flex;
		height: 100%;
		min-height: 0;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	@media (max-width: 860px) {
		.topbar {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
