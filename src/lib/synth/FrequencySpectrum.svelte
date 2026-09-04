<script lang="ts">
	import { scaleLinear, scaleLog } from 'd3-scale';
	import { noteNameFromMidi } from '../string-quartet';
	import { DEFAULT_A4, frequencyFromNoteNumber } from '../tuner/tune';
	import { getHarmonicSpectrum } from './useSynth.svelte';

	let {
		frequency = null,
		bowPressure = 0.45,
		bowPosition = 0.4,
		bowSpeed = 0.55,
		maxHarmonic = 12,
		width = 240,
		height = 120,
		title,
		onClose,
		empty = false,
		overlaySeries = [],
		overlayColor = 'rgba(255, 255, 255, 0.8)'
	}: {
		frequency?: number | null;
		bowPressure?: number;
		bowPosition?: number;
		bowSpeed?: number;
		maxHarmonic?: number;
		width?: number;
		height?: number;
		title?: string;
		onClose?: () => void;
		empty?: boolean;
		overlaySeries?: Array<{ harmonic: number; frequency: number; amplitude: number }>;
		overlayColor?: string;
	} = $props();

	const padding = { top: 6, right: 12, bottom: 20, left: 6 };
	const titleRowHeight = 28;
	const gradientId = `spectrum-gradient-${Math.random().toString(36).slice(2)}`;
	let containerWidth = $state(0);
	let containerHeight = $state(0);
	const chartWidth = $derived(Math.max(containerWidth || width, 1));
	const chartHeight = $derived(Math.max((containerHeight || height) - titleRowHeight, 1));

	function formatFrequency(value: number): string {
		if (value >= 1000) {
			return `${(value / 1000).toFixed(1)}k`;
		}
		return `${Math.round(value)}`;
	}

	const isEmpty = $derived(
		Boolean(empty || frequency === null || frequency === undefined || frequency <= 0)
	);
	const safeFrequency = $derived(Math.max(frequency ?? 1, 1));
	const closestNote = $derived.by(() => {
		if (isEmpty) {
			return null;
		}
		const nearestMidi = Math.round(69 + 12 * Math.log2(safeFrequency / DEFAULT_A4));
		const nearestFrequency = frequencyFromNoteNumber(nearestMidi, DEFAULT_A4);
		const cents = Math.round(1200 * Math.log2(safeFrequency / nearestFrequency));
		return {
			note: noteNameFromMidi(nearestMidi),
			cents
		};
	});
	const displayTitle = $derived.by(() => {
		if (title) {
			return title;
		}
		if (isEmpty) {
			return '—';
		}
		if (!closestNote) {
			return `${safeFrequency.toFixed(2)} Hz`;
		}
		const centsText =
			closestNote.cents === 0 ? '' : ` ${closestNote.cents > 0 ? '+' : ''}${closestNote.cents}¢`;
		return `${closestNote.note}${centsText} ${safeFrequency.toFixed(2)} Hz`;
	});
	const fixedMinFrequency = 60;
	const fixedMaxFrequency = 2400;
	const harmonicEntries = $derived(
		isEmpty
			? []
			: getHarmonicSpectrum(safeFrequency, bowPressure, bowPosition, bowSpeed, maxHarmonic)
	);
	const xScale = $derived.by(() =>
		scaleLog()
			.domain([fixedMinFrequency, fixedMaxFrequency])
			.range([padding.left, chartWidth - padding.right])
	);
	const amplitudeMax = $derived(Math.max(...harmonicEntries.map((entry) => entry.amplitude), 1));
	const yScale = $derived.by(() =>
		scaleLinear()
			.domain([0, amplitudeMax])
			.range([chartHeight - padding.bottom, padding.top + 10])
			.nice()
	);
	const baselineY = $derived(chartHeight - padding.bottom);
	const harmonicData = $derived(
		harmonicEntries
			.filter(
				(entry) => entry.frequency >= fixedMinFrequency && entry.frequency <= fixedMaxFrequency
			)
			.map((entry) => {
				const x = xScale(entry.frequency);
				const nextX = xScale(entry.frequency * 1.08);
				const prevX = xScale(entry.frequency / 1.08);
				const barWidth = Math.max(8, Math.abs(nextX - prevX) * 0.5);
				const amplitudeY = yScale(entry.amplitude);
				const barHeight = Math.max(0, baselineY - amplitudeY);
				return {
					...entry,
					x,
					barWidth,
					y: baselineY - barHeight,
					height: barHeight
				};
			})
	);
	const xTicks = $derived.by(() => {
		const tickValues = [60, 100, 200, 400, 800, 1600, 2000];
		return tickValues.filter((tick) => tick >= fixedMinFrequency && tick <= fixedMaxFrequency);
	});
	const overlayBars = $derived.by(() => {
		if (isEmpty || !overlaySeries.length) return [];
		return overlaySeries
			.filter(
				(entry) => entry.frequency >= fixedMinFrequency && entry.frequency <= fixedMaxFrequency
			)
			.map((entry) => {
				const x = xScale(entry.frequency);
				const nextX = xScale(entry.frequency * 1.05);
				const prevX = xScale(entry.frequency / 1.05);
				const widthValue = Math.max(3, Math.abs(nextX - prevX) * 0.65);
				const amplitudeY = yScale(entry.amplitude);
				const barHeight = Math.max(0, baselineY - amplitudeY);
				return {
					x,
					width: widthValue,
					y: baselineY - barHeight,
					height: barHeight
				};
			});
	});
</script>

<div class="spectrum-panel" bind:clientWidth={containerWidth} bind:clientHeight={containerHeight}>
	<div class="spectrum-header">
		<span class="spectrum-title">{displayTitle}</span>
		{#if onClose && !isEmpty}
			<button type="button" class="spectrum-close" onclick={onClose} aria-label="Close spectrum">
				×
			</button>
		{/if}
	</div>

	<svg width={chartWidth} height={chartHeight} role="img" aria-label="Frequency spectrum">
		<defs>
			<linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
				<stop offset="0%" stop-color="#7dd3fc" />
				<stop offset="100%" stop-color="#a78bfa" />
			</linearGradient>
		</defs>

		<line
			x1={padding.left}
			y1={baselineY}
			x2={chartWidth - padding.right}
			y2={baselineY}
			class="axis-line"
		/>
		<line x1={padding.left} y1={padding.top} x2={padding.left} y2={baselineY} class="axis-line" />

		{#each xTicks as tickFrequency (tickFrequency)}
			{@const x = xScale(tickFrequency)}
			<line x1={x} y1={baselineY} x2={x} y2={baselineY - 5} class="tick-line" />
			<text {x} y={chartHeight - 6} text-anchor="middle" class="tick-label"
				>{formatFrequency(tickFrequency)}</text
			>
		{/each}

		{#if overlayBars.length}
			{#each overlayBars as bar (bar.x + '-' + bar.width + '-' + bar.height)}
				<rect
					x={bar.x - bar.width / 2}
					y={bar.y}
					width={bar.width}
					height={bar.height}
					rx={1}
					fill={overlayColor}
					opacity={0.6}
				/>
			{/each}
		{/if}

		{#each harmonicData as entry, i (entry.harmonic)}
			<rect
				x={entry.x - entry.barWidth / 2}
				y={entry.y}
				width={entry.barWidth}
				height={entry.height}
				rx={2}
				fill={`url(#${gradientId})`}
				opacity={0.5 + entry.amplitude * 0.3}
			/>
			{#if i < 4}
				{@const labelY = Math.max(entry.y - 2, padding.top + 4)}
				<text x={entry.x} y={labelY} text-anchor="middle" class="harmonic-label">
					{Math.round(entry.frequency)}
				</text>
			{/if}
		{/each}
	</svg>
</div>

<style>
	.spectrum-panel {
		width: 100%;
		height: 100%;
		background: rgba(15, 23, 42);
		border: 1px solid rgba(125, 211, 252, 0.35);
		border-radius: 0.8rem;
		box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
		padding: 0.2rem;
		box-sizing: border-box;
	}

	.spectrum-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem 0.2rem;
	}

	.spectrum-title {
		display: block;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #e0f2fe;
	}

	.spectrum-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 1.25rem;
		width: 1.25rem;
		padding: 0;
		border: 1px solid rgba(248, 113, 113, 0.7);
		border-radius: 999px;
		background: rgba(127, 29, 29, 0.8);
		color: #fee2e2;
		font-size: 0.95rem;
		line-height: 1;
		cursor: pointer;
	}

	.spectrum-panel svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.axis-line {
		stroke: rgba(148, 163, 184, 0.7);
		stroke-width: 1;
	}

	.tick-line {
		stroke: rgba(148, 163, 184, 0.55);
		stroke-width: 1;
	}

	.tick-label {
		fill: #dbeafe;
		font-size: 10px;
		font-weight: 600;
	}

	.harmonic-label {
		fill: rgba(224, 242, 254, 0.92);
		font-size: 9px;
		font-weight: 600;
		pointer-events: none;
	}
</style>
