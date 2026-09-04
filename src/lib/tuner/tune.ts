export const DEFAULT_A4 = 442;

export function frequencyFromNoteNumber(noteNumber: number, a4 = DEFAULT_A4): number {
	return a4 * Math.pow(2, (noteNumber - 69) / 12);
}

export function getClosestNoteFromFrequency(
	frequency: number,
	a4 = DEFAULT_A4
): { midi: number; frequency: number; cents: number } {
	const safeFrequency = Math.max(frequency, Number.EPSILON);
	const nearestMidi = Math.round(69 + 12 * Math.log2(safeFrequency / a4));
	const nearestFrequency = frequencyFromNoteNumber(nearestMidi, a4);
	const cents = Math.round(1200 * Math.log2(safeFrequency / nearestFrequency));

	return {
		midi: nearestMidi,
		frequency: nearestFrequency,
		cents
	};
}

export const frequencyFromMidi = frequencyFromNoteNumber;
