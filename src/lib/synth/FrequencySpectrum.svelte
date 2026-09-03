<script lang="ts">
	import { scaleLinear, scaleLog } from 'd3-scale';
	import { getHarmonicSpectrum } from './useSynth.svelte';

	let {
		frequency = 440,
		bowPressure = 0.45,
		bowPosition = 0.4,
		bowSpeed = 0.55,
		maxHarmonic = 12,
		width = 240,
		height = 120,
		overlaySeries = [],
		overlayColor = 'rgba(255, 255, 255, 0.8)'
	}: {
		frequency?: number;
		bowPressure?: number;
		bowPosition?: number;
		bowSpeed?: number;
		maxHarmonic?: number;
		width?: number;
		height?: number;
		overlaySeries?: Array<{ harmonic: number; frequency: number; amplitude: number }>;
		overlayColor?: string;
	} = $props();

	const padding = { top: 6, right: 12, bottom: 20, left: 12 };
	const gradientId = `spectrum-gradient-${Math.random().toString(36).slice(2)}`;

	function formatFrequency(value: number): string {
		if (value >= 1000) {
			return `${(value / 1000).toFixed(1)}k`;
		}
		return `${Math.round(value)}`;
	}

	const safeFrequency = $derived(Math.max(frequency, 1));
	const fixedMinFrequency = 60;
	const fixedMaxFrequency = 2000;
	const harmonicEntries = $derived(
		getHarmonicSpectrum(safeFrequency, bowPressure, bowPosition, bowSpeed, maxHarmonic)
	);
	const xScale = $derived.by(() =>
		scaleLog()
			.domain([fixedMinFrequency, fixedMaxFrequency])
			.range([padding.left, width - padding.right])
	);
	const amplitudeMax = $derived(Math.max(...harmonicEntries.map((entry) => entry.amplitude), 1));
	const yScale = $derived.by(() =>
		scaleLinear()
			.domain([0, amplitudeMax])
			.range([height - padding.bottom, padding.top + 10])
			.nice()
	);
	const baselineY = $derived(height - padding.bottom);
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
		if (!overlaySeries.length) return [];
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

<div class="spectrum-panel">
	<svg
		{width}
		{height}
		viewBox={`0 0 ${width} ${height}`}
		role="img"
		aria-label="Frequency spectrum"
	>
		<defs>
			<linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
				<stop offset="0%" stop-color="#7dd3fc" />
				<stop offset="100%" stop-color="#a78bfa" />
			</linearGradient>
		</defs>

		<line
			x1={padding.left}
			y1={height - padding.bottom}
			x2={width - padding.right}
			y2={height - padding.bottom}
			class="axis-line"
		/>
		<line
			x1={padding.left}
			y1={padding.top}
			x2={padding.left}
			y2={height - padding.bottom}
			class="axis-line"
		/>

		{#each xTicks as tickFrequency (tickFrequency)}
			{@const x = xScale(tickFrequency)}
			<line x1={x} y1={baselineY} x2={x} y2={baselineY - 5} class="tick-line" />
			<text {x} y={height - 2} text-anchor="middle" class="tick-label"
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
		position: absolute;
		right: 0.7rem;
		bottom: 0.7rem;
		background: rgba(15, 23, 42);
		border: 1px solid rgba(125, 211, 252, 0.35);
		border-radius: 0.8rem;
		box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
		padding: 0.2rem;
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
		font-size: 8px;
		font-weight: 600;
	}

	.harmonic-label {
		fill: rgba(224, 242, 254, 0.92);
		font-size: 9px;
		font-weight: 600;
		pointer-events: none;
	}
</style>
