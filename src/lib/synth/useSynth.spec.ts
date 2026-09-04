import { describe, expect, it } from 'vitest';

import { getClosestNoteFromFrequency } from '../tuner/tune';
import { getHarmonicProfile, getHarmonicSpectrum } from './useSynth.svelte';

const MAX_PLAYABLE_FREQUENCY = 20000;

describe('bowed-string additive model', () => {
	it('makes higher pressure and bridge position brighter', () => {
		const soft = getHarmonicProfile(1, 0.1, 0.1, 0.2);
		const bright = getHarmonicProfile(1, 0.9, 0.9, 0.9);

		expect(bright).toBeGreaterThan(soft);
	});

	it('gives upper harmonics more energy under a bright bowing state', () => {
		const softUpperHarmonic = getHarmonicProfile(8, 0.1, 0.1, 0.1);
		const brightUpperHarmonic = getHarmonicProfile(8, 0.9, 0.9, 0.9);

		expect(brightUpperHarmonic).toBeGreaterThan(softUpperHarmonic);
	});

	it('keeps the ordinary bowed-string decay near a realistic 1/n envelope', () => {
		const harmonic2 = getHarmonicProfile(2, 0.45, 0.4, 0.5);
		const harmonic6 = getHarmonicProfile(6, 0.45, 0.4, 0.5);
		const harmonic10 = getHarmonicProfile(10, 0.45, 0.4, 0.5);

		expect(harmonic2).toBeGreaterThan(harmonic6);
		expect(harmonic6).toBeGreaterThan(harmonic10);
		expect(harmonic2 / harmonic6).toBeLessThan(8);
	});

	it('exports harmonic frequencies for an EQ-style visualization', () => {
		const spectrum = getHarmonicSpectrum(220, 0.5, 0.4, 0.6, 4);

		expect(spectrum.map((entry) => entry.harmonic)).toEqual([1, 2, 3, 4]);
		expect(spectrum.map((entry) => entry.frequency)).toEqual([220, 440, 660, 880]);
		expect(spectrum.every((entry) => entry.amplitude >= 0)).toBe(true);
	});

	it('uses the selected A4 reference when naming the nearest note', () => {
		expect(getClosestNoteFromFrequency(415, 415).midi).toBe(69);
		expect(getClosestNoteFromFrequency(415, 442).midi).toBe(68);
	});

	it('never includes harmonic frequencies above 20 kHz', () => {
		const spectrum = getHarmonicSpectrum(8000, 0.5, 0.4, 0.6, 12);

		expect(spectrum.every((entry) => entry.frequency <= MAX_PLAYABLE_FREQUENCY)).toBe(true);
		expect(spectrum.some((entry) => entry.frequency === MAX_PLAYABLE_FREQUENCY)).toBe(true);
	});
});
