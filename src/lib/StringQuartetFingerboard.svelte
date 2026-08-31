<script lang="ts">
	import { createSynth } from './synth/useSynth.svelte';
	import {
		getStringFrequencyAtFret,
		type FingerboardPosition,
		type Instrument
	} from './string-quartet';

	let {
		instrument,
		layout,
		a4 = 442
	}: { instrument: Instrument; layout: FingerboardPosition[][]; a4?: number } = $props();

	const synth = createSynth({ waveform: 'sine', volume: 0.3, reverbMix: 0 });
	$effect(() => {
		synth.setOptions({ a4 });
	});
	const boardPadding = { left: 56, right: 18, top: 18, bottom: 18 };
	const importantFrets = new Set([0, 3, 5, 7, 9, 12, 14, 17, 19]);
	const maxVisiblePositionRatio = 1 - Math.pow(2, -19 / 12);

	let containerWidth = $state(0);
	let containerHeight = $state(220);
	let svgElement: SVGSVGElement | undefined = $state();
	let dragActive = $state(false);
	let activeStringIndex = $state<number | null>(null);
	let activePositionRatio = $state(0);
	let currentFrequency = $state<number | null>(null);
	let fretTotal = $derived(
		Math.max(...layout.flatMap((row) => row.map((position) => position.fretIndex)), 0)
	);
	let ratio = $derived(instrument.fingerboardLengthRatio ?? 1);
	let boardWidth = $derived(Math.max(containerWidth * ratio, 1));
	let boardHeight = $derived(
		Math.min(
			Math.max(
				containerHeight,
				instrument.strings.length * 32 + boardPadding.top + boardPadding.bottom
			),
			600
		)
	);
	let stringSpacing = $derived(
		(boardHeight - boardPadding.top - boardPadding.bottom) /
			Math.max(instrument.strings.length - 1, 1)
	);
	let fretScale = $derived(Math.max(boardWidth - boardPadding.left - boardPadding.right, 1));

	function clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	function fretRatio(fretIndex: number): number {
		if (fretIndex <= 0) return 0;
		return 1 - Math.pow(2, -fretIndex / 12);
	}

	function xForFret(fretIndex: number): number {
		return boardPadding.left + fretRatio(fretIndex) * fretScale;
	}

	function xForPositionRatio(positionRatio: number): number {
		return boardPadding.left + clamp(positionRatio, 0, maxVisiblePositionRatio) * fretScale;
	}

	function stringY(index: number): number {
		return boardPadding.top + (instrument.strings.length - 1 - index) * stringSpacing;
	}

	function getStringPitchAtPosition(x: number, y: number) {
		const visualStringIndex = clamp(
			Math.round((y - boardPadding.top) / stringSpacing),
			0,
			instrument.strings.length - 1
		);
		const stringIndex = instrument.strings.length - 1 - visualStringIndex;
		const positionRatio = clamp((x - boardPadding.left) / fretScale, 0, maxVisiblePositionRatio);
		const stringPitch = instrument.strings[stringIndex];
		const rawFrequency = getStringFrequencyAtFret(stringPitch.midi, 0, 1, a4);
		const frequency = rawFrequency / Math.max(1 - positionRatio, 0.00001);
		return { stringIndex, positionRatio, frequency };
	}

	function stopSynth() {
		synth.stopAll();
		currentFrequency = null;
		activeStringIndex = null;
	}

	function updatePointerFromEvent(event: PointerEvent) {
		if (!svgElement) return;

		const rect = svgElement.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * boardWidth;
		const y = ((event.clientY - rect.top) / rect.height) * boardHeight;
		const pointer = getStringPitchAtPosition(x, y);
		activeStringIndex = pointer.stringIndex;
		activePositionRatio = pointer.positionRatio;
		currentFrequency = pointer.frequency;
		synth.playFrequency(pointer.frequency);
	}

	function handlePointerDown(event: PointerEvent) {
		dragActive = true;
		event.preventDefault();
		svgElement?.setPointerCapture?.(event.pointerId);
		updatePointerFromEvent(event);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragActive) {
			return;
		}
		updatePointerFromEvent(event);
	}

	function handlePointerUp() {
		dragActive = false;
	}
</script>

<div class="board-shell" bind:clientWidth={containerWidth} bind:clientHeight={containerHeight}>
	{#if currentFrequency !== null && currentFrequency > 0}
		<div class="frequency-readout" aria-label={`${currentFrequency.toFixed(2)} hertz`}>
			<span>{currentFrequency.toFixed(2)} Hz</span>
			<button type="button" class="stop-button" onclick={stopSynth} aria-label="Stop instrument">
				×
			</button>
		</div>
	{/if}
	<svg
		bind:this={svgElement}
		viewBox={`0 0 ${boardWidth} ${boardHeight}`}
		width={boardWidth}
		height={boardHeight}
		preserveAspectRatio="none"
		role="img"
		aria-label={`${instrument.name} fingerboard`}
		class="fingerboard-svg"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointerleave={handlePointerUp}
	>
		<g>
			{#each layout as row, stringIndex (row + '-' + stringIndex)}
				<line
					x1={boardPadding.left}
					y1={stringY(stringIndex)}
					x2={boardWidth - boardPadding.right}
					y2={stringY(stringIndex)}
					class="string-line"
				/>
			{/each}

			{#each Array.from({ length: fretTotal + 1 }, (_, index) => index) as fretIndex (fretIndex)}
				{#if fretIndex > 0 && fretIndex <= fretTotal}
					<line
						x1={xForFret(fretIndex)}
						y1={boardPadding.top - 10}
						x2={xForFret(fretIndex)}
						y2={boardHeight - boardPadding.bottom + 10}
						class={`fret-line ${importantFrets.has(fretIndex) ? 'marker-highlight' : ''}`}
					/>
				{/if}
			{/each}

			{#if activeStringIndex !== null}
				<line
					x1={xForPositionRatio(activePositionRatio)}
					y1={stringY(activeStringIndex) - 18}
					x2={xForPositionRatio(activePositionRatio)}
					y2={stringY(activeStringIndex) + 18}
					class="play-marker"
				/>
				<circle
					cx={xForPositionRatio(activePositionRatio)}
					cy={stringY(activeStringIndex)}
					r={7}
					class="play-dot"
				/>
			{/if}

			{#each layout as row, stringIndex (stringIndex)}
				{#each row as fret (stringIndex + '-' + fret.fretIndex)}
					{#if importantFrets.has(fret.fretIndex)}
						<text x={xForFret(fret.fretIndex) + 4} y={stringY(stringIndex) - 8} class="note-label"
							>{fret.note}</text
						>
					{/if}
				{/each}
			{/each}
		</g>
	</svg>
</div>

<style>
	.board-shell {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: flex-start;
		overflow-x: auto;
		padding: 0.35rem 0.4rem 0.5rem;
		background: rgba(2, 6, 23, 0.2);
		box-sizing: border-box;
		min-height: 0;
		max-height: 100%;
	}

	.frequency-readout {
		position: absolute;
		top: 0.7rem;
		right: 0.7rem;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(125, 211, 252, 0.45);
		color: #e0f2fe;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		z-index: 2;
	}

	.stop-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 1.15rem;
		width: 1.15rem;
		padding: 0;
		border: 1px solid rgba(248, 113, 113, 0.7);
		border-radius: 999px;
		background: rgba(127, 29, 29, 0.8);
		color: #fee2e2;
		font-size: 0.9rem;
		line-height: 1;
		cursor: pointer;
		pointer-events: auto;
	}

	.fingerboard-svg {
		display: block;
		height: auto;
		margin: 0;
		background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.8));
		border: 1px solid rgba(148, 163, 184, 0.28);
		border-radius: 0.8rem;
	}

	.string-line {
		stroke: rgba(191, 219, 254, 0.9);
		stroke-width: 2.4;
		stroke-linecap: round;
	}

	.fret-line {
		stroke: rgba(148, 163, 184, 0.4);
		stroke-width: 1;
		stroke-linecap: round;
	}

	.marker-highlight {
		stroke: rgba(125, 211, 252, 0.7);
		stroke-width: 1.5;
	}

	.note-label {
		fill: #dbeafe;
		font-size: 10px;
		font-weight: 700;
	}

	.fingerboard-svg {
		cursor: crosshair;
		user-select: none;
		touch-action: none;
	}

	.play-marker {
		stroke: rgba(125, 211, 252, 0.9);
		stroke-width: 1.5;
	}

	.play-dot {
		fill: rgba(125, 211, 252, 0.85);
		stroke: rgba(224, 242, 254, 0.9);
		stroke-width: 1;
	}
</style>
