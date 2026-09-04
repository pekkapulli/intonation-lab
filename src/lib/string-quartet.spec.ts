import { describe, expect, it } from 'vitest';

import {
	type Instrument,
	type StringPitch,
	getStringQuartetInstruments,
	buildFingerboardLayout,
	noteNameFromMidi,
	isValidQuartetSetup,
	getStringFrequencyAtFret,
	getInstrumentHarmonicOverlays,
	getVisibleFretRatio,
	getBoardSelectionForPointer
} from '$lib/string-quartet';

describe('string quartet tunings', () => {
	it('uses standard quartet tuning in the correct octaves', () => {
		const instruments = getStringQuartetInstruments();

		expect(instruments.map((instrument: Instrument) => instrument.name)).toEqual([
			'Violin I',
			'Violin II',
			'Viola',
			'Cello'
		]);
		expect(instruments.map((instrument: Instrument) => instrument.id)).toEqual([
			'violin-i',
			'violin-ii',
			'viola',
			'cello'
		]);

		expect(instruments[0].strings.map((string: StringPitch) => string.note)).toEqual([
			'G3',
			'D4',
			'A4',
			'E5'
		]);
		expect(instruments[1].strings.map((string: StringPitch) => string.note)).toEqual([
			'G3',
			'D4',
			'A4',
			'E5'
		]);
		expect(instruments[2].strings.map((string: StringPitch) => string.note)).toEqual([
			'C3',
			'G3',
			'D4',
			'A4'
		]);
		expect(instruments[3].strings.map((string: StringPitch) => string.note)).toEqual([
			'C2',
			'G2',
			'D3',
			'A3'
		]);
	});

	it('maps note names to MIDI values in the expected octaves', () => {
		expect(noteNameFromMidi(55)).toBe('G3');
		expect(noteNameFromMidi(62)).toBe('D4');
		expect(noteNameFromMidi(69)).toBe('A4');
		expect(noteNameFromMidi(76)).toBe('E5');
		expect(noteNameFromMidi(48)).toBe('C3');
		expect(noteNameFromMidi(36)).toBe('C2');
	});

	it('places each note at the right semitone offset along the fingerboard', () => {
		const violin = getStringQuartetInstruments()[0];
		const layout = buildFingerboardLayout(violin, 13);

		expect(layout[0][0].note).toBe('G3');
		expect(layout[0][3].note).toBe('A#3');
		expect(layout[0][5].note).toBe('C4');
		expect(layout[0][12].note).toBe('G4');
	});

	it('maps visible fret spacing using the correct logarithmic fret ratio', () => {
		const maxVisiblePositionRatio = 1 - Math.pow(2, -19 / 12);
		expect(getVisibleFretRatio(0, maxVisiblePositionRatio)).toBe(0);
		expect(getVisibleFretRatio(12, maxVisiblePositionRatio)).toBeCloseTo(
			0.5 / maxVisiblePositionRatio,
			6
		);
		expect(getVisibleFretRatio(19, maxVisiblePositionRatio)).toBeCloseTo(1, 6);
	});

	it('selects the lowest and highest notes when a pointer is in the board padding', () => {
		const maxVisiblePositionRatio = 1 - Math.pow(2, -19 / 12);
		const boardPadding = { left: 32, right: 32, top: 24, bottom: 18 };
		const boardWidth = 420;
		const boardHeight = 220;
		const stringCount = 4;
		const stringSpacing =
			(boardHeight - boardPadding.top - boardPadding.bottom) / (stringCount - 1);
		const fretScale = boardWidth - boardPadding.left - boardPadding.right;

		expect(
			getBoardSelectionForPointer({
				x: 12,
				y: 120,
				compactLayout: false,
				boardWidth,
				boardHeight,
				boardPadding,
				stringCount,
				stringSpacing,
				fretScale,
				maxVisiblePositionRatio
			})
		).toMatchObject({ positionRatio: 0 });
		expect(
			getBoardSelectionForPointer({
				x: 408,
				y: 120,
				compactLayout: false,
				boardWidth,
				boardHeight,
				boardPadding,
				stringCount,
				stringSpacing,
				fretScale,
				maxVisiblePositionRatio
			})
		).toMatchObject({ positionRatio: maxVisiblePositionRatio });
		expect(
			getBoardSelectionForPointer({
				x: 220,
				y: 10,
				compactLayout: false,
				boardWidth,
				boardHeight,
				boardPadding,
				stringCount,
				stringSpacing,
				fretScale,
				maxVisiblePositionRatio
			})
		).toMatchObject({ stringIndex: stringCount - 1 });
		expect(
			getBoardSelectionForPointer({
				x: 220,
				y: 210,
				compactLayout: false,
				boardWidth,
				boardHeight,
				boardPadding,
				stringCount,
				stringSpacing,
				fretScale,
				maxVisiblePositionRatio
			})
		).toMatchObject({ stringIndex: 0 });
	});

	it('calculates frequency from the full string length and fret position', () => {
		const a4 = 442;
		const openStringFrequency = getStringFrequencyAtFret(55, 0, 1, a4);
		const fifthFrequency = getStringFrequencyAtFret(55, 7, 1, a4);
		const octaveFrequency = getStringFrequencyAtFret(55, 12, 1, a4);

		expect(openStringFrequency).toBeCloseTo(196.888617, 6);
		expect(fifthFrequency).toBeCloseTo(294.999608, 6);
		expect(octaveFrequency).toBeCloseTo(393.777233, 6);
	});

	it('keeps the quartet configuration internally consistent', () => {
		expect(isValidQuartetSetup(getStringQuartetInstruments())).toBe(true);
	});

	it('allows the fingerboard lengths to be configured with cello at full length', () => {
		const instruments = getStringQuartetInstruments({
			'Violin I': 0.72,
			'Violin II': 0.72,
			Viola: 0.84,
			Cello: 1
		});

		expect(instruments[0].fingerboardLengthRatio).toBe(0.72);
		expect(instruments[1].fingerboardLengthRatio).toBe(0.72);
		expect(instruments[2].fingerboardLengthRatio).toBe(0.84);
		expect(instruments[3].fingerboardLengthRatio).toBe(1);
	});

	it('sends every active instrument to every board without filtering by instrument name', () => {
		const activeFrequencies = {
			'Violin I': 220,
			'Violin II': 330,
			Viola: 440,
			Cello: null
		};

		const overlays = getInstrumentHarmonicOverlays(activeFrequencies);
		const instrumentIds = new Set(overlays.map((entry) => entry.instrumentId));

		expect(instrumentIds).toEqual(new Set(['Violin I', 'Violin II', 'Viola']));
		expect(
			overlays.some((entry) => entry.instrumentId === 'Violin I' && entry.harmonic === 1)
		).toBe(true);
		expect(
			overlays.some((entry) => entry.instrumentId === 'Violin II' && entry.harmonic === 2)
		).toBe(true);
		expect(overlays.some((entry) => entry.instrumentId === 'Viola' && entry.harmonic === 3)).toBe(
			true
		);
	});

	it('excludes the current instrument from overlay bars when using instrument ids', () => {
		const activeFrequencies = {
			'violin-i': 220,
			'violin-ii': 330,
			viola: 440,
			cello: null
		};

		const overlays = getInstrumentHarmonicOverlays(activeFrequencies, 12, 'violin-i');
		expect(overlays.some((entry) => entry.instrumentId === 'violin-i')).toBe(false);
		expect(overlays.some((entry) => entry.instrumentId === 'violin-ii')).toBe(true);
		expect(overlays.some((entry) => entry.instrumentId === 'viola')).toBe(true);
	});
});
