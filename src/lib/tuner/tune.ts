export const DEFAULT_A4 = 442;

export function frequencyFromNoteNumber(noteNumber: number, a4 = DEFAULT_A4): number {
	return a4 * Math.pow(2, (noteNumber - 69) / 12);
}

export const frequencyFromMidi = frequencyFromNoteNumber;
