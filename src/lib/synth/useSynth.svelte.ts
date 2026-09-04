import { frequencyFromNoteNumber, DEFAULT_A4 } from '../tuner/tune';
import { startAudioEngine } from './audioStart';
import { noteNameToMidi } from './noteUtils';
import type { BowedStringVoiceState, MelodyItem, SynthOptions, SynthVoice } from './types';
// @ts-expect-error - no type definitions available
import reverb from 'soundbank-reverb';

// Bowed-string spectra are broadly consistent with a 1/n decay envelope: strong
// fundamentals, then progressively weaker upper harmonics. The exact shape varies
// with bow pressure, bow position, and the instrument's body resonance, so the
// profiles below are intentionally gentle and realistic rather than overly bright.
const SOFT_PROFILE = [0, -7, -11, -14, -17, -20, -23, -25, -27, -29, -31, -33];
const ORDINARY_PROFILE = [0, -5, -8, -10, -12, -14, -16, -18, -20, -22, -24, -26];
const NEAR_BRIDGE_PROFILE = [0, -3, -5, -7, -9, -11, -13, -15, -17, -19, -21, -23];

type ActivePartial = {
	osc: OscillatorNode;
	gain: GainNode;
	harmonic: number;
};

type ActiveVoice = {
	masterGain: GainNode;
	partials: ActivePartial[];
	stop: () => void;
	update: (frequency: number, state: Partial<BowedStringVoiceState>) => void;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number): number {
	const x = clamp(value, 0, 1);
	return x * x * (3 - 2 * x);
}

function decibelToLinear(valueDb: number): number {
	return Math.pow(10, valueDb / 20);
}

function profileForPartial(partialNumber: number, profile: number[]): number {
	const profileIndex = partialNumber - 1;
	if (profileIndex < profile.length) {
		return profile[profileIndex];
	}
	return -2.5 * (profileIndex - 11) - 12;
}

export function getHarmonicProfile(
	partialNumber: number,
	bowPressure: number,
	bowPosition: number,
	bowSpeed: number
): number {
	const pressure = smoothstep(bowPressure);
	const position = smoothstep(bowPosition);
	const speed = smoothstep(bowSpeed);
	const harmonic = Math.max(1, partialNumber);

	const softDb = profileForPartial(harmonic, SOFT_PROFILE);
	const ordinaryDb = profileForPartial(harmonic, ORDINARY_PROFILE);
	const nearBridgeDb = profileForPartial(harmonic, NEAR_BRIDGE_PROFILE);
	const mixedDb = softDb + (ordinaryDb - softDb) * pressure;
	const brightDb = mixedDb + (nearBridgeDb - mixedDb) * position;
	const harmonicGain = decibelToLinear(brightDb);
	const speedBoost = 0.7 + speed * 1.2;
	const harmonicFalloff = 1 / Math.pow(harmonic, 0.82);
	const result = harmonicGain * speedBoost * harmonicFalloff;
	return clamp(result, 0, 1.5);
}

export function getHarmonicSpectrum(
	baseFrequency: number,
	bowPressure: number,
	bowPosition: number,
	bowSpeed: number,
	maxHarmonic = 12
) {
	const safeBase = Math.max(baseFrequency, 1);
	return Array.from({ length: Math.max(maxHarmonic, 1) }, (_, index) => {
		const harmonic = index + 1;
		const frequency = harmonic * safeBase;
		const amplitude = getHarmonicProfile(harmonic, bowPressure, bowPosition, bowSpeed);
		return {
			harmonic,
			frequency,
			amplitude
		};
	});
}

/**
 * Create a synth voice for playing melody items.
 *
 * IMPORTANT FOR SAFARI COMPATIBILITY:
 * - The playNote() method must be called from a user gesture event (click, touch) on first use
 * - Do NOT call playNote() from within an async callback or after any awaits initially
 * - Safari (especially iOS) requires AudioContext to be created/resumed from user interaction
 * - After the first user gesture, subsequent calls can be made without user interaction
 */
export function createSynth(options: SynthOptions = {}): SynthVoice {
	let audioContext: AudioContext | null = null;
	let masterGain: GainNode | null = null;
	let dryGain: GainNode | null = null;
	let wetGain: GainNode | null = null;
	let reverbNode: AudioNode | null = null;
	let continuousVoice: ActiveVoice | null = null;
	let lastActiveFrequency = 0;
	const activeVoices: ActiveVoice[] = [];

	let waveform: OscillatorType = options.waveform ?? 'sine';
	let a4 = options.a4 ?? DEFAULT_A4;
	let attack = options.attack ?? 0.03;
	let decay = options.decay ?? 0.18;
	let sustain = options.sustain ?? 0.72;
	let release = options.release ?? 0.09;
	let volume = options.volume ?? 0.32;
	let reverbMix = options.reverbMix ?? 0.22;
	let reverbDecay = options.reverbDecay ?? 2.2;
	let transpositionSemitones = options.transpositionSemitones ?? 0;
	let bowPressure = options.bowPressure ?? 0.45;
	let bowPosition = options.bowPosition ?? 0.4;
	let bowSpeed = options.bowSpeed ?? 0.5;
	let vibratoRate = options.vibratoRate ?? 5.2;
	let vibratoDepth = options.vibratoDepth ?? 0.016;
	let bodyColor = options.bodyColor ?? 'normal';

	function createAdditiveVoice(
		frequency: number,
		state: Partial<BowedStringVoiceState> = {},
		mode: 'continuous' | 'note' = 'continuous',
		durationSec = 0
	): ActiveVoice {
		if (!audioContext || !dryGain || !reverbNode) {
			throw new Error('[Synth] AudioContext not initialized');
		}

		const now = audioContext.currentTime;
		const masterGainNode = audioContext.createGain();
		const partials: ActivePartial[] = [];

		masterGainNode.connect(dryGain);
		masterGainNode.connect(reverbNode);
		masterGainNode.gain.setValueAtTime(0.0001, now);
		masterGainNode.gain.linearRampToValueAtTime(volume * 0.9, now + attack);

		const bodyColorBoost = bodyColor === 'soft' ? 0.75 : bodyColor === 'bright' ? 1.25 : 1;
		const partialLimit = frequency > 500 ? 28 : 32;
		for (let harmonic = 1; harmonic <= partialLimit; harmonic += 1) {
			const partialFrequency = frequency * harmonic;
			if (partialFrequency > audioContext.sampleRate * 0.46) {
				break;
			}

			const osc = audioContext.createOscillator();
			const partialGain = audioContext.createGain();
			osc.type = waveform;
			osc.frequency.setValueAtTime(partialFrequency, now);
			osc.connect(partialGain);
			partialGain.connect(masterGainNode);

			const amplitude =
				getHarmonicProfile(
					harmonic,
					state.bowPressure ?? bowPressure,
					state.bowPosition ?? bowPosition,
					state.bowSpeed ?? bowSpeed
				) *
				(0.55 + 0.45 / Math.max(1, harmonic * 0.7)) *
				bodyColorBoost;
			partialGain.gain.setValueAtTime(0.0001, now);
			partialGain.gain.linearRampToValueAtTime(amplitude * 0.3, now + attack);
			osc.start(now);
			partials.push({ osc, gain: partialGain, harmonic });
		}

		const stop = () => {
			const stopTime = audioContext?.currentTime ?? now;
			partials.forEach(({ osc, gain }) => {
				try {
					gain.gain.cancelScheduledValues(stopTime);
					gain.gain.setValueAtTime(gain.gain.value || 0.0001, stopTime);
					gain.gain.linearRampToValueAtTime(0.0001, stopTime + 0.04);
					osc.stop(stopTime + 0.04);
				} catch {
					// Ignore already stopped oscillators.
				}
			});
		};

		const update = (nextFrequency: number, nextState: Partial<BowedStringVoiceState>) => {
			if (!audioContext) return;
			const nowTime = audioContext.currentTime;
			const pressure = clamp(nextState.bowPressure ?? bowPressure, 0, 1);
			const position = clamp(nextState.bowPosition ?? bowPosition, 0, 1);
			const speed = clamp(nextState.bowSpeed ?? bowSpeed, 0, 1);
			const vibratoDepthValue = nextState.vibratoDepth ?? vibratoDepth;
			const rate = nextState.vibratoRate ?? vibratoRate;
			const modWidth = 1 + vibratoDepthValue * 12;

			partials.forEach(({ osc, gain, harmonic }) => {
				const targetPartial = nextFrequency * harmonic;
				const partialAmplitude =
					getHarmonicProfile(harmonic, pressure, position, speed) *
					(0.55 + 0.45 / Math.max(1, harmonic * 0.7)) *
					bodyColorBoost;
				const vibratoAmount = Math.sin(
					((nextFrequency * harmonic) / 440) * Math.PI * 2 * rate * (nowTime / 60)
				);
				const finalFrequency = targetPartial * (1 + vibratoAmount * vibratoDepthValue * modWidth);
				osc.frequency.cancelScheduledValues(nowTime);
				osc.frequency.setValueAtTime(osc.frequency.value || finalFrequency, nowTime);
				osc.frequency.linearRampToValueAtTime(finalFrequency, nowTime + 0.08);
				gain.gain.cancelScheduledValues(nowTime);
				gain.gain.setValueAtTime(gain.gain.value || partialAmplitude * 0.2, nowTime);
				gain.gain.linearRampToValueAtTime(partialAmplitude * 0.32, nowTime + 0.08);
			});
		};

		const voice: ActiveVoice = {
			masterGain: masterGainNode,
			partials,
			stop,
			update
		};

		if (mode === 'note') {
			const noteEndTime = now + Math.max(durationSec, 0.12);
			const releaseStart = Math.max(now + attack + decay, noteEndTime - release);
			masterGainNode.gain.cancelScheduledValues(now);
			masterGainNode.gain.setValueAtTime(0.0001, now);
			masterGainNode.gain.linearRampToValueAtTime(volume * 0.9, now + attack);
			masterGainNode.gain.linearRampToValueAtTime(sustain * volume * 0.82, now + attack + decay);
			masterGainNode.gain.setValueAtTime(sustain * volume * 0.82, releaseStart);
			masterGainNode.gain.linearRampToValueAtTime(0.0001, noteEndTime + release);
			partials.forEach(({ osc }) => {
				osc.stop(noteEndTime + release + 0.08);
			});
			activeVoices.push(voice);
			return voice;
		}

		activeVoices.push(voice);
		return voice;
	}

	/**
	 * Initialize audio context and audio graph if not already done.
	 * Must be called from user interaction on first use.
	 */
	async function ensureAudioContext() {
		const startedContext = await startAudioEngine();
		if (!startedContext) {
			throw new Error('[Synth] AudioContext is not available in this browser');
		}

		if (!audioContext) {
			audioContext = startedContext;

			dryGain = audioContext.createGain();
			wetGain = audioContext.createGain();
			masterGain = audioContext.createGain();

			reverbNode = reverb(audioContext);
			// @ts-expect-error - soundbank-reverb has time and wet properties
			reverbNode.time = reverbDecay;
			// @ts-expect-error - soundbank-reverb properties
			reverbNode.wet.value = 1;
			// @ts-expect-error - soundbank-reverb properties
			reverbNode.dry.value = 0;

			dryGain.gain.value = 1 - reverbMix;
			wetGain.gain.value = reverbMix;
			masterGain.gain.value = volume;

			dryGain.connect(masterGain);
			if (reverbNode) {
				reverbNode.connect(wetGain);
			}
			wetGain.connect(masterGain);
			masterGain.connect(audioContext.destination);
		}
	}

	function setVoiceState(
		voice: ActiveVoice,
		newFrequency: number,
		nextState: Partial<BowedStringVoiceState>
	) {
		const now = audioContext?.currentTime ?? 0;
		voice.update(newFrequency, nextState);
		if (continuousVoice === voice) {
			lastActiveFrequency = newFrequency;
			const pressure = clamp(nextState.bowPressure ?? bowPressure, 0, 1);
			const position = clamp(nextState.bowPosition ?? bowPosition, 0, 1);
			const speed = clamp(nextState.bowSpeed ?? bowSpeed, 0, 1);
			const targetGain = volume * (0.4 + pressure * 0.8 + speed * 0.4 + position * 0.2);
			voice.masterGain.gain.cancelScheduledValues(now);
			voice.masterGain.gain.setValueAtTime(voice.masterGain.gain.value || targetGain, now);
			voice.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.08);
		}
	}

	/**
	 * Play a single exact frequency continuously until stopped.
	 */
	async function playFrequency(frequency: number) {
		try {
			await ensureAudioContext();
		} catch (error) {
			console.error('[Synth] Failed to initialize audio context', error);
			return;
		}

		if (!audioContext || !dryGain || !reverbNode) {
			console.error('[Synth] AudioContext not initialized');
			return;
		}

		lastActiveFrequency = frequency;
		const state: Partial<BowedStringVoiceState> = {
			frequency,
			bowPressure,
			bowPosition,
			bowSpeed,
			vibratoRate,
			vibratoDepth,
			loudness: volume,
			noteOn: true
		};

		if (!continuousVoice) {
			continuousVoice = createAdditiveVoice(frequency, state, 'continuous');
			return;
		}

		setVoiceState(continuousVoice, frequency, state);
	}

	/**
	 * Play a single note from a MelodyItem
	 */
	async function playNote(item: MelodyItem, tempoBPM: number): Promise<void> {
		if (item.note === null) {
			const sixteenthMs = 60000 / tempoBPM / 4;
			const durationMs = item.length * sixteenthMs;
			await new Promise((resolve) => setTimeout(resolve, durationMs));
			return;
		}

		try {
			await ensureAudioContext();
		} catch (error) {
			console.error('[Synth] Failed to initialize audio context', error);
			return;
		}
		if (!audioContext || !dryGain || !reverbNode) {
			console.error('[Synth] AudioContext not initialized');
			return;
		}

		const writtenMidi = noteNameToMidi(item.note);
		if (writtenMidi === null) {
			console.error('[Synth] Invalid note name:', item.note);
			return;
		}

		const midi = writtenMidi + transpositionSemitones;
		const frequency = frequencyFromNoteNumber(midi, a4);
		const sixteenthMs = 60000 / tempoBPM / 4;
		const durationMs = item.length * sixteenthMs;
		const durationSec = durationMs / 1000;
		const voice = createAdditiveVoice(
			frequency,
			{
				bowPressure,
				bowPosition,
				bowSpeed,
				vibratoRate,
				vibratoDepth,
				loudness: volume,
				noteOn: true
			},
			'note',
			durationSec
		);
		const cleanup = () => {
			const index = activeVoices.indexOf(voice);
			if (index > -1) {
				activeVoices.splice(index, 1);
			}
			voice.stop();
		};
		voice.stop = () => {
			const stopTime = audioContext?.currentTime ?? 0;
			voice.partials.forEach(({ osc, gain }) => {
				try {
					gain.gain.cancelScheduledValues(stopTime);
					gain.gain.setValueAtTime(gain.gain.value || 0.0001, stopTime);
					gain.gain.linearRampToValueAtTime(0.0001, stopTime + 0.04);
					osc.stop(stopTime + 0.04);
				} catch {
					// Ignore if already stopped.
				}
			});
			voice.masterGain.disconnect();
		};
		setTimeout(cleanup, durationMs + 120);
		await new Promise((resolve) => setTimeout(resolve, durationMs));
	}

	/**
	 * Stop all currently playing notes
	 */
	function stopAll() {
		const now = audioContext?.currentTime ?? 0;
		for (const voice of activeVoices) {
			voice.stop();
		}
		activeVoices.length = 0;
		continuousVoice = null;
		if (masterGain) {
			masterGain.gain.cancelScheduledValues(now);
			masterGain.gain.setValueAtTime(volume, now);
		}
	}

	/**
	 * Check if the synth is currently playing
	 */
	function isPlaying(): boolean {
		return activeVoices.length > 0 || continuousVoice !== null;
	}

	/**
	 * Update synth options
	 */
	function setOptions(opts: Partial<SynthOptions>) {
		const previousA4 = a4;
		if (opts.waveform !== undefined) waveform = opts.waveform;
		if (opts.a4 !== undefined) a4 = opts.a4;
		if (opts.attack !== undefined) attack = opts.attack;
		if (opts.decay !== undefined) decay = opts.decay;
		if (opts.sustain !== undefined) sustain = opts.sustain;
		if (opts.release !== undefined) release = opts.release;
		if (opts.volume !== undefined) volume = opts.volume;
		if (opts.reverbMix !== undefined) {
			reverbMix = opts.reverbMix;
			if (dryGain && wetGain) {
				dryGain.gain.value = 1 - reverbMix;
				wetGain.gain.value = reverbMix;
			}
		}
		if (opts.reverbDecay !== undefined) {
			reverbDecay = opts.reverbDecay;
			if (reverbNode) {
				// @ts-expect-error - soundbank-reverb properties
				reverbNode.time = reverbDecay;
			}
		}
		if (opts.transpositionSemitones !== undefined)
			transpositionSemitones = opts.transpositionSemitones;
		if (opts.bowPressure !== undefined) bowPressure = opts.bowPressure;
		if (opts.bowPosition !== undefined) bowPosition = opts.bowPosition;
		if (opts.bowSpeed !== undefined) bowSpeed = opts.bowSpeed;
		if (opts.vibratoRate !== undefined) vibratoRate = opts.vibratoRate;
		if (opts.vibratoDepth !== undefined) vibratoDepth = opts.vibratoDepth;
		if (opts.bodyColor !== undefined) bodyColor = opts.bodyColor;
		if (continuousVoice && previousA4 !== a4 && lastActiveFrequency > 0) {
			const targetFrequency = lastActiveFrequency * (a4 / previousA4);
			setVoiceState(continuousVoice, targetFrequency, {
				bowPressure,
				bowPosition,
				bowSpeed,
				vibratoRate,
				vibratoDepth,
				loudness: volume,
				noteOn: true
			});
			lastActiveFrequency = targetFrequency;
		}
		for (const voice of activeVoices) {
			if (voice !== continuousVoice) {
				voice.update(lastActiveFrequency || 440, {
					bowPressure,
					bowPosition,
					bowSpeed,
					vibratoRate,
					vibratoDepth,
					loudness: volume,
					noteOn: true
				});
			}
		}
		if (masterGain) {
			const now = audioContext?.currentTime ?? 0;
			masterGain.gain.cancelScheduledValues(now);
			masterGain.gain.setValueAtTime(volume, now);
		}
	}

	return {
		playNote,
		playFrequency,
		stopAll,
		isPlaying,
		setOptions
	};
}
