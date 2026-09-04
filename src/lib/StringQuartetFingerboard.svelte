<script lang="ts">
	import FrequencySpectrum from './synth/FrequencySpectrum.svelte';
	import { createSynth } from './synth/useSynth.svelte';
	import {
		getInstrumentHarmonicOverlays,
		getStringFrequencyAtFret,
		getVisibleFretRatio,
		type FingerboardPosition,
		type Instrument
	} from './string-quartet';

	let {
		instrument,
		layout,
		a4 = 442,
		instrumentId = instrument.name,
		activeFrequencyByInstrument = {},
		stopAllSignal = 0,
		onFrequencyChange = () => {},
		compact = false
	}: {
		instrument: Instrument;
		layout: FingerboardPosition[][];
		a4?: number;
		instrumentId?: string;
		activeFrequencyByInstrument?: Record<string, number | null>;
		stopAllSignal?: number;
		onFrequencyChange?: (instrumentId: string, frequency: number | null) => void;
		compact?: boolean;
	} = $props();

	const synth = createSynth({ waveform: 'sine', volume: 0.3, reverbMix: 0 });
	let lastStopAllSignal = $state(0);
	let dragActive = $state(false);
	let dragPointerId: number | null = $state(null);
	let activeStringIndex = $state<number | null>(null);
	let activePositionRatio = $state(0);
	let currentFrequency = $state<number | null>(null);
	let containerWidth = $state(0);
	let containerHeight = $state(220);
	let svgElement: SVGSVGElement | undefined = $state();
	let compactLayout = $derived(compact);
	const boardPadding = $derived({
		left: 32,
		right: 32,
		top: compactLayout ? 40 : 24,
		bottom: compactLayout ? 40 : 18
	});
	const importantFrets = new Set([0, 3, 5, 7, 9, 12, 14, 17, 19]);
	const maxVisiblePositionRatio = 1 - Math.pow(2, -19 / 12);
	let fretTotal = $derived(
		Math.max(...layout.flatMap((row) => row.map((position) => position.fretIndex)), 0)
	);
	let otherInstrumentHarmonics = $derived(
		getInstrumentHarmonicOverlays(activeFrequencyByInstrument ?? {})
	);
	let boardWidth = $derived(Math.max(containerWidth, 1));
	$effect(() => {
		if (stopAllSignal !== lastStopAllSignal) {
			lastStopAllSignal = stopAllSignal;
			stopSynth();
		}
	});
	$effect(() => {
		synth.setOptions({ a4 });
		if (activeStringIndex !== null && activePositionRatio !== null) {
			const stringPitch = instrument.strings[activeStringIndex];
			const rawFrequency = getStringFrequencyAtFret(stringPitch.midi, 0, 1, a4);
			const updatedFrequency = rawFrequency / Math.max(1 - activePositionRatio, 0.00001);
			if (currentFrequency !== updatedFrequency) {
				currentFrequency = updatedFrequency;
				onFrequencyChange?.(instrumentId, updatedFrequency);
				synth.playFrequency(updatedFrequency);
			}
		}
	});
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
		compactLayout
			? (boardWidth - boardPadding.left - boardPadding.right) /
					Math.max(instrument.strings.length - 1, 1)
			: (boardHeight - boardPadding.top - boardPadding.bottom) /
					Math.max(instrument.strings.length - 1, 1)
	);
	let fretScale = $derived(
		compactLayout
			? Math.max(boardHeight - boardPadding.top - boardPadding.bottom, 1)
			: Math.max(boardWidth - boardPadding.left - boardPadding.right, 1)
	);

	function clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	function xForFret(fretIndex: number): number {
		const visibleRatio = getVisibleFretRatio(fretIndex, maxVisiblePositionRatio);
		return boardPadding.left + visibleRatio * fretScale;
	}

	function yForFret(fretIndex: number): number {
		const visibleRatio = getVisibleFretRatio(fretIndex, maxVisiblePositionRatio);
		return boardPadding.top + visibleRatio * fretScale;
	}

	function xForPositionRatio(positionRatio: number): number {
		const visualRatio = clamp(positionRatio / Math.max(maxVisiblePositionRatio, 0.00001), 0, 1);
		return boardPadding.left + visualRatio * fretScale;
	}

	function yForPositionRatio(positionRatio: number): number {
		const visualRatio = clamp(positionRatio / Math.max(maxVisiblePositionRatio, 0.00001), 0, 1);
		return boardPadding.top + visualRatio * fretScale;
	}

	function stringY(index: number): number {
		return boardPadding.top + (instrument.strings.length - 1 - index) * stringSpacing;
	}

	function stringX(index: number): number {
		return boardPadding.left + index * stringSpacing;
	}

	function getStringPitchAtPosition(x: number, y: number) {
		if (compactLayout) {
			const visualStringIndex = clamp(
				Math.round((x - boardPadding.left) / stringSpacing),
				0,
				instrument.strings.length - 1
			);
			const stringIndex = visualStringIndex;
			const visualRatio = clamp((y - boardPadding.top) / fretScale, 0, 1);
			const positionRatio = maxVisiblePositionRatio * visualRatio;
			const stringPitch = instrument.strings[stringIndex];
			const rawFrequency = getStringFrequencyAtFret(stringPitch.midi, 0, 1, a4);
			const frequency = rawFrequency / Math.max(1 - positionRatio, 0.00001);
			return { stringIndex, positionRatio, frequency };
		}

		const visualStringIndex = clamp(
			Math.round((y - boardPadding.top) / stringSpacing),
			0,
			instrument.strings.length - 1
		);
		const stringIndex = instrument.strings.length - 1 - visualStringIndex;
		const visualRatio = clamp((x - boardPadding.left) / fretScale, 0, 1);
		const positionRatio = maxVisiblePositionRatio * visualRatio;
		const stringPitch = instrument.strings[stringIndex];
		const rawFrequency = getStringFrequencyAtFret(stringPitch.midi, 0, 1, a4);
		const frequency = rawFrequency / Math.max(1 - positionRatio, 0.00001);
		return { stringIndex, positionRatio, frequency };
	}

	function stopSynth() {
		synth.stopAll();
		currentFrequency = null;
		activeStringIndex = null;
		onFrequencyChange?.(instrumentId, null);
	}

	function updatePointerFromEvent(event: PointerEvent) {
		if (!svgElement) return;

		const rect = svgElement.getBoundingClientRect();
		const x = clamp(
			((event.clientX - rect.left) / Math.max(rect.width, 1)) * boardWidth,
			0,
			boardWidth
		);
		const y = clamp(
			((event.clientY - rect.top) / Math.max(rect.height, 1)) * boardHeight,
			0,
			boardHeight
		);
		const pointer = getStringPitchAtPosition(x, y);
		activeStringIndex = pointer.stringIndex;
		activePositionRatio = pointer.positionRatio;
		currentFrequency = pointer.frequency;
		onFrequencyChange?.(instrumentId, pointer.frequency);
		synth.playFrequency(pointer.frequency);
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0 && event.pointerType !== 'touch') {
			return;
		}
		dragActive = true;
		dragPointerId = event.pointerId;
		event.preventDefault();
		svgElement?.setPointerCapture?.(event.pointerId);
		updatePointerFromEvent(event);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragActive || (dragPointerId !== null && event.pointerId !== dragPointerId)) {
			return;
		}
		updatePointerFromEvent(event);
	}

	function handlePointerUp(event?: PointerEvent) {
		dragActive = false;
		if (event && dragPointerId !== null && event.pointerId === dragPointerId) {
			svgElement?.releasePointerCapture?.(event.pointerId);
		}
		if (dragPointerId !== null && !event) {
			svgElement?.releasePointerCapture?.(dragPointerId);
		}
		dragPointerId = null;
	}

	function handlePointerCancel(event?: PointerEvent) {
		handlePointerUp(event);
	}
</script>

<div class="visual-layout" class:compact={compactLayout}>
	<div class="board-shell" bind:clientWidth={containerWidth} bind:clientHeight={containerHeight}>
		<div class="instrument-tag">{instrument.name}</div>
		<svg
			bind:this={svgElement}
			width={boardWidth}
			height={boardHeight}
			preserveAspectRatio="none"
			role="img"
			aria-label={`${instrument.name} fingerboard`}
			class="fingerboard-svg"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerCancel}
		>
			<g>
				{#each layout as row, stringIndex (row + '-' + stringIndex)}
					{#if compactLayout}
						<line
							x1={stringX(stringIndex)}
							y1={boardPadding.top}
							x2={stringX(stringIndex)}
							y2={yForFret(fretTotal)}
							class="string-line"
						/>
					{:else}
						<line
							x1={boardPadding.left}
							y1={stringY(stringIndex)}
							x2={xForFret(fretTotal)}
							y2={stringY(stringIndex)}
							class="string-line"
						/>
					{/if}
				{/each}

				{#each Array.from({ length: fretTotal + 1 }, (_, index) => index) as fretIndex (fretIndex)}
					{#if fretIndex > 0 && fretIndex <= fretTotal}
						{#if compactLayout}
							<line
								x1={boardPadding.left - 10}
								y1={yForFret(fretIndex)}
								x2={boardWidth - boardPadding.right + 10}
								y2={yForFret(fretIndex)}
								class={`fret-line ${importantFrets.has(fretIndex) ? 'marker-highlight' : ''}`}
							/>
						{:else}
							<line
								x1={xForFret(fretIndex)}
								y1={boardPadding.top - 10}
								x2={xForFret(fretIndex)}
								y2={boardHeight - boardPadding.bottom + 10}
								class={`fret-line ${importantFrets.has(fretIndex) ? 'marker-highlight' : ''}`}
							/>
						{/if}
					{/if}
				{/each}

				{#if activeStringIndex !== null}
					{#if compactLayout}
						<line
							x1={stringX(activeStringIndex) - 18}
							y1={yForPositionRatio(activePositionRatio)}
							x2={stringX(activeStringIndex) + 18}
							y2={yForPositionRatio(activePositionRatio)}
							class="play-marker"
						/>
						<circle
							cx={stringX(activeStringIndex)}
							cy={yForPositionRatio(activePositionRatio)}
							r={7}
							class="play-dot"
						/>
					{:else}
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
				{/if}

				{#each layout as row, stringIndex (stringIndex)}
					{#each row as fret (stringIndex + '-' + fret.fretIndex)}
						{#if importantFrets.has(fret.fretIndex)}
							{#if compactLayout}
								<text
									x={stringX(stringIndex) + 4}
									y={yForFret(fret.fretIndex) + 4}
									class="note-label"
								>
									{fret.note}
								</text>
							{:else}
								<text
									x={xForFret(fret.fretIndex) + 4}
									y={stringY(stringIndex) - 8}
									class="note-label">{fret.note}</text
								>
							{/if}
						{/if}
					{/each}
				{/each}
			</g>
		</svg>
	</div>

	<div class="spectrum-shell" class:compact={compactLayout}>
		<FrequencySpectrum
			frequency={currentFrequency}
			bowPressure={clamp(0.25 + (activePositionRatio ?? 0) * 0.8, 0, 1)}
			bowPosition={activePositionRatio ?? 0}
			bowSpeed={0.55}
			maxHarmonic={12}
			onClose={currentFrequency !== null ? stopSynth : undefined}
			empty={currentFrequency === null}
			overlaySeries={otherInstrumentHarmonics}
			overlayColor="rgba(255, 255, 255, 0.8)"
		/>
	</div>
</div>

<style>
	.visual-layout {
		display: flex;
		align-items: stretch;
		gap: 0;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.visual-layout.compact {
		flex-direction: row;
		align-items: stretch;
	}

	.board-shell {
		position: relative;
		flex: 1 1 auto;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: flex-start;
		overflow-x: auto;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
		min-height: 0;
	}

	.visual-layout.compact .board-shell {
		flex: 1 1 50%;
		width: 50%;
		max-width: 50%;
		padding-top: 2rem;
	}

	.spectrum-shell {
		height: 100%;
		flex: 0 0 320px;
		display: flex;
		align-items: stretch;
		justify-content: center;
		max-width: 50%;
		padding: 0;
		margin: 0;
	}

	.spectrum-shell.compact {
		flex: 1 1 50%;
		width: 50%;
		max-width: 50%;
		height: min(100%, 240px);
		max-height: 240px;
		align-self: center;
		padding-top: 1rem;
	}

	.fingerboard-svg {
		display: block;
		width: 100%;
		height: 100%;
		max-height: 100%;
		margin: 0;
		padding: 0;
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

	.instrument-tag {
		position: absolute;
		left: -0.4rem;
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
		z-index: 1;
	}

	.visual-layout.compact .instrument-tag {
		top: 0.75rem;
		left: 0.75rem;
		transform: none;
		writing-mode: horizontal-tb;
	}

	.harmonic-panel {
		fill: rgba(15, 23, 42, 0.75);
		stroke: rgba(125, 211, 252, 0.45);
		stroke-width: 1;
	}

	.harmonic-title {
		fill: #e0f2fe;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.harmonic-bar {
		stroke: rgba(224, 242, 254, 0.35);
		stroke-width: 0.6;
	}

	.harmonic-label {
		fill: #dbeafe;
		font-size: 8px;
		font-weight: 700;
	}

	.play-dot {
		fill: rgba(125, 211, 252, 0.85);
		stroke: rgba(224, 242, 254, 0.9);
		stroke-width: 1;
	}
</style>
