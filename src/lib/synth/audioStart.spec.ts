import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('audioStart', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		// @ts-expect-error - test setup only
		delete globalThis.AudioContext;
		// @ts-expect-error - test setup only
		delete globalThis.webkitAudioContext;
	});

	it('creates and resumes the browser audio context on a user gesture', async () => {
		const resume = vi.fn().mockResolvedValue(undefined);
		const fakeContext = { state: 'suspended', resume } as unknown as AudioContext;
		const AudioCtor = vi.fn(function FakeAudioContext() {
			return fakeContext;
		});

		Object.defineProperty(globalThis, 'AudioContext', {
			value: AudioCtor,
			configurable: true,
			writable: true
		});

		const { startAudioEngine } = await import('./audioStart');
		const result = await startAudioEngine();

		expect(result).toBe(fakeContext);
		expect(AudioCtor).toHaveBeenCalledTimes(1);
		expect(resume).toHaveBeenCalledTimes(1);
	});
});
