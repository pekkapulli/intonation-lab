import { frequencyFromNoteNumber } from './tuner/tune';

export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type StringPitch = {
	note: string;
	midi: number;
	stringIndex: number;
};

export type Instrument = {
	name: string;
	strings: StringPitch[];
	lowestNote: string;
	highestNote: string;
	fingerboardLengthRatio: number;
};

export type FingerboardPosition = {
	stringIndex: number;
	fretIndex: number;
	note: string;
	midi: number;
	position: number;
	positionRatio: number;
};

const BASE_NOTE_TO_MIDI: Record<NoteName, number> = {
	C: 0,
	'C#': 1,
	D: 2,
	'D#': 3,
	E: 4,
	F: 5,
	'F#': 6,
	G: 7,
	'G#': 8,
	A: 9,
	'A#': 10,
	B: 11
};

const NOTE_NAMES = Object.keys(BASE_NOTE_TO_MIDI) as NoteName[];

export function noteNameFromMidi(midi: number): string {
	const normalizedMidi = ((midi % 12) + 12) % 12;
	const octave = Math.floor(midi / 12) - 1;
	const note = NOTE_NAMES[normalizedMidi];
	return `${note}${octave}`;
}

export const STRING_QUARTET_FINGERBOARD_LENGTHS: Record<string, number> = {
	'Violin I': 0.72,
	'Violin II': 0.72,
	Viola: 0.84,
	Cello: 1
};

export function getStringQuartetInstruments(
	config: Partial<Record<string, number>> = {}
): Instrument[] {
	const instrumentLengths = { ...STRING_QUARTET_FINGERBOARD_LENGTHS, ...config };

	const violinStrings: StringPitch[] = [
		{ note: 'G3', midi: 55, stringIndex: 0 },
		{ note: 'D4', midi: 62, stringIndex: 1 },
		{ note: 'A4', midi: 69, stringIndex: 2 },
		{ note: 'E5', midi: 76, stringIndex: 3 }
	];

	const violaStrings: StringPitch[] = [
		{ note: 'C3', midi: 48, stringIndex: 0 },
		{ note: 'G3', midi: 55, stringIndex: 1 },
		{ note: 'D4', midi: 62, stringIndex: 2 },
		{ note: 'A4', midi: 69, stringIndex: 3 }
	];

	const celloStrings: StringPitch[] = [
		{ note: 'C2', midi: 36, stringIndex: 0 },
		{ note: 'G2', midi: 43, stringIndex: 1 },
		{ note: 'D3', midi: 50, stringIndex: 2 },
		{ note: 'A3', midi: 57, stringIndex: 3 }
	];

	return [
		{
			name: 'Violin I',
			strings: violinStrings,
			lowestNote: violinStrings[0].note,
			highestNote: violinStrings[violinStrings.length - 1].note,
			fingerboardLengthRatio: instrumentLengths['Violin I'] ?? 1
		},
		{
			name: 'Violin II',
			strings: violinStrings,
			lowestNote: violinStrings[0].note,
			highestNote: violinStrings[violinStrings.length - 1].note,
			fingerboardLengthRatio: instrumentLengths['Violin II'] ?? 1
		},
		{
			name: 'Viola',
			strings: violaStrings,
			lowestNote: violaStrings[0].note,
			highestNote: violaStrings[violaStrings.length - 1].note,
			fingerboardLengthRatio: instrumentLengths['Viola'] ?? 1
		},
		{
			name: 'Cello',
			strings: celloStrings,
			lowestNote: celloStrings[0].note,
			highestNote: celloStrings[celloStrings.length - 1].note,
			fingerboardLengthRatio: instrumentLengths['Cello'] ?? 1
		}
	];
}

export function getFretPositionRatio(fretIndex: number): number {
	if (fretIndex <= 0) {
		return 0;
	}
	return 1 - Math.pow(2, -fretIndex / 12);
}

export function getStringFrequencyAtFret(
	openStringMidi: number,
	fretIndex: number,
	fullStringLength = 1,
	a4 = 442
): number {
	if (fullStringLength <= 0) {
		throw new Error('Full string length must be greater than zero.');
	}

	const openFrequency = frequencyFromNoteNumber(openStringMidi, a4);
	if (fretIndex <= 0) {
		return openFrequency;
	}

	const vibratingLength = fullStringLength * Math.pow(2, -fretIndex / 12);
	return openFrequency * (fullStringLength / vibratingLength);
}

export function buildFingerboardLayout(
	instrument: Instrument,
	fretCount: number
): FingerboardPosition[][] {
	return instrument.strings.map((pitch, stringIndex) => {
		const row: FingerboardPosition[] = [];
		for (let fretIndex = 0; fretIndex <= fretCount; fretIndex += 1) {
			const midi = pitch.midi + fretIndex;
			row.push({
				stringIndex,
				fretIndex,
				note: noteNameFromMidi(midi),
				midi,
				position: fretIndex,
				positionRatio: getFretPositionRatio(fretIndex)
			});
		}
		return row;
	});
}

export function isValidQuartetSetup(instruments: Instrument[]): boolean {
	return (
		instruments.length === 4 &&
		instruments.every((instrument) => instrument.strings.length === 4) &&
		instruments[0].strings.every(
			(string, index) => string.note === getStringQuartetInstruments()[0].strings[index].note
		) &&
		instruments[1].strings.every(
			(string, index) => string.note === getStringQuartetInstruments()[0].strings[index].note
		) &&
		instruments[2].strings.every(
			(string, index) => string.note === getStringQuartetInstruments()[2].strings[index].note
		) &&
		instruments[3].strings.every(
			(string, index) => string.note === getStringQuartetInstruments()[3].strings[index].note
		)
	);
}

export function getStringRingMapping(): Record<string, string[]> {
	const instruments = getStringQuartetInstruments();
	return Object.fromEntries(
		instruments.map((instrument) => [
			instrument.name,
			instrument.strings.map((pitch) => pitch.note)
		])
	);
}
