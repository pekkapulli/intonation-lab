type BrowserAudioContextConstructor = typeof AudioContext;

type AudioGlobal = typeof globalThis & {
	AudioContext?: BrowserAudioContextConstructor;
	webkitAudioContext?: BrowserAudioContextConstructor;
};

let sharedAudioContext: AudioContext | null = null;

export function getAudioContextConstructor(): BrowserAudioContextConstructor | null {
	const audioGlobal = globalThis as AudioGlobal;
	return audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext ?? null;
}

export async function startAudioEngine(): Promise<AudioContext | null> {
	const AudioCtor = getAudioContextConstructor();
	if (!AudioCtor) {
		return null;
	}

	if (!sharedAudioContext) {
		sharedAudioContext = new AudioCtor();
	}

	if (sharedAudioContext.state === 'suspended') {
		await sharedAudioContext.resume();
	}

	return sharedAudioContext;
}
