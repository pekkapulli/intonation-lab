export interface MelodyItem {
	note: string | null;
	length: number;
}

export interface BowedStringVoiceState {
	frequency: number;
	bowPressure: number; // 0..1
	bowPosition: number; // 0..1
	bowSpeed: number; // 0..1
	vibratoRate: number; // Hz
	vibratoDepth: number; // normalized or cents-like depth
	loudness: number; // 0..1
	noteOn: boolean;
}

export interface SynthOptions {
	waveform?: OscillatorType; // legacy compatibility
	a4?: number; // Reference A4 frequency (default 442)
	attack?: number; // Attack time in seconds
	decay?: number; // Decay time in seconds
	sustain?: number; // Sustain level (0-1)
	release?: number; // Release time in seconds
	volume?: number; // Master volume (0-1)
	reverbMix?: number; // Reverb wet/dry mix (0 = dry, 1 = wet)
	reverbDecay?: number; // Reverb decay time (1-10 seconds)
	transpositionSemitones?: number; // written -> sounding (e.g. -7 for French Horn)
	bowPressure?: number;
	bowPosition?: number;
	bowSpeed?: number;
	vibratoRate?: number;
	vibratoDepth?: number;
	bodyColor?: 'soft' | 'normal' | 'bright';
	lowPassCutoff?: number;
}

export interface SynthVoice {
	/**
	 * Play a single note from a MelodyItem
	 * @param item The melody item containing note and duration information
	 * @param tempoBPM The tempo in beats per minute for calculating duration
	 */
	playNote: (item: MelodyItem, tempoBPM: number) => Promise<void>;

	/**
	 * Play an exact frequency indefinitely until stopped.
	 */
	playFrequency: (frequency: number) => void;

	/**
	 * Stop all currently playing notes
	 */
	stopAll: () => void;

	/**
	 * Check if the synth is currently playing
	 */
	isPlaying: () => boolean;

	/**
	 * Update synth options
	 */
	setOptions: (options: Partial<SynthOptions>) => void;
}
