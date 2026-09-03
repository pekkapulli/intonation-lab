# Bowed-String Additive Synth Voice Specification

## Goal

Create a convincing Web Audio bowed-string voice for the app: a single, responsive, slightly imperfect instrument tone that emphasizes harmonic content and live movement rather than a generic synth waveform. This voice should feel like a bowed string instrument, not a sawtooth with a filter strapped on.

The design goal is to capture the perception of a violin, viola, or cello through:

- a dense, controllable harmonic series
- subtle noise from the bow
- changing brightness with bow pressure and bow position
- body resonance from the instrument itself
- vibrato and slow timbral drift over time
- a note onset that feels like a real bow attack, not an instant waveform switch

## Core design: dynamic additive synthesis

The voice is based on a dynamic additive model, not a subtractive synth with a single oscillator. Each note is generated from a bank of partials whose amplitudes vary continuously as the bowing state changes.

### 1. Partial bank

- Use 24–40 partials per note in the primary voice
- Partial count should scale down for high notes to avoid aliasing and excessive CPU load
- Fundamental plus integer harmonics are the primary source of tone
- Partial amplitudes are controlled in decibels and interpolated smoothly
- Upper harmonics are allowed to lag behind changes in bow pressure and position for realism

Example harmonic profiles for the first 12 partials (relative amplitudes in dB):

```ts
const softSulTasto = [0, -9, -13, -18, -22, -26, -30, -35, -39, -43, -47, -51];
const ordinary = [0, -7, -11, -15, -18, -22, -25, -29, -32, -36, -40, -44];
const nearBridge = [0, -4, -7, -10, -12, -15, -18, -21, -24, -27, -30, -33];
```

These tables represent the harmonic weight of the sound at different bow states. The voice interpolates between states instead of switching abruptly.

### 2. Bow-state controls

The voice should expose continuous performance parameters rather than only note/velocity/volume:

- `bowPressure`: 0..1
  - higher pressure = louder, brighter, more upper partial energy, slightly more noise
- `bowPosition`: 0..1
  - 0 = over fingerboard / soft, darker timbre
  - 1 = near bridge / brighter, more attack and upper harmonics
- `bowSpeed`: 0..1
  - controls sustained level and brightness, especially during the note body
- `vibratoRate`: 0..10 Hz
- `vibratoDepth`: 0..0.05 or cents equivalent
- `bowDirection`: upward/downward or on/off state for reversal gesture
- `noteGate`: attack / sustain / release state

These controls are not just UI knobs. They define the actual harmonic and temporal movement of the sound.

## Sound architecture

The voice should be built as a multi-stage signal chain:

1. `fundamental + harmonic partial bank`
2. `filtered bow noise`
3. `body resonators or short measured impulse response`
4. `master gain / optional room reverb`

### Stage 1: Additive tone source

- generate sine partials for each active harmonic
- each partial has its own phase and amplitude envelope
- amplitude is shaped by the current bow state
- total output is the sum of all active partials
- the fundamental should remain stable, while upper partials are slightly more dynamic

### Stage 2: Bow noise

- add a very quiet broadband noise layer
- filter it with a moving band-pass or high-pass response
- increase noise at high bow pressure, fast bow speed, and near-bridge position
- the noise should be subtle and never become a hissy synth texture

### Stage 3: Body coloration

A bowed string needs resonant body behaviour. Use one of these:

- 3–6 lightly resonant peaking filters tuned for violin/viola/cello body colour
- or a short measured bridge/body impulse response in a `ConvolverNode`

The body stage should not be a dramatic reverb. It should add a little acoustic complexity and spectral shaping without washing out the note.

### Stage 4: Vibrato and drift

- vibrato should be applied to the fundamental frequency, and all partials should move coherently
- vibrato onset should be delayed slightly after note attack
- small slow pitch drift or detuning can be used for realism, but it must remain musical and restrained
- avoid exaggerated heavy detune; a single responsive voice is more convincing than a synthetic unison stack

## Temporal behaviour

### Note attack

On attack, the voice should not simply jump to full-spectrum tone.

- the fundamental should rise first
- upper partials should come in with a controlled, slightly delayed rise
- there should be a brief friction/transient gesture from bow noise
- the onset may include a tiny amount of transient brightness and edge

### Sustained note body

Once established, the note should continue to evolve.

- bow pressure gradually changes brightness and level
- bow position changes harmonic tilt
- spectral balance should move smoothly while the note is held
- bow reversal should produce a short noisy transition and slight harmonic change

### Release

- release should not be an abrupt cut
- the harmonic content should slowly fade
- noise should decay with the note
- body resonance should ring gently for a short time

## Implementation constraints

### CPU budget

This is feasible in modern browsers when implemented correctly.

- For one bowed voice: 24–40 partials is a modest load
- For a small polyphonic setup: 6–8 notes at 16–24 partials each is still practical
- The implementation should not create one `OscillatorNode` per partial per note
- A single `AudioWorklet` or a scheduled partial synthesizer is preferred over naive `OscillatorNode` fan-out

### Recommended engine

This voice should be implemented in a single worklet-based additive engine:

- one engine handles all partial summation for active voices
- each voice keeps its own phase, amplitude envelope, and bow state
- one output stage handles body resonance and optional room processing

This is the right balance between realism and performance.

## API contract

The voice should expose musical controls, not just a fixed waveform parameter.

```ts
interface BowedStringVoiceState {
  frequency: number;
  bowPressure: number; // 0..1
  bowPosition: number; // 0..1
  bowSpeed: number; // 0..1
  vibratoRate: number; // Hz
  vibratoDepth: number; // cents or normalized depth
  loudness: number; // 0..1
  noteOn: boolean;
}
```

### Expected public methods

```ts
createBowedStringVoice(): {
  startNote(frequency: number, state: Partial<BowedStringVoiceState>): void;
  updateNote(frequency: number, state: Partial<BowedStringVoiceState>): void;
  stopNote(): void;
  setBodyColor(color: 'soft' | 'normal' | 'bright'): void;
  setGain(level: number): void;
}
```

This keeps the voice configurable at the musical control layer while allowing implementation details to live in the AudioWorklet.

## Design principles

- The sound is driven by harmonic content, not a single waveform shape
- Bow movement should feel continuous and musical
- Spectral colour should vary with bowing behaviour in a plausible way
- realism comes from history and state transitions, not just a static harmonic table
- a single slightly imperfect voice is more convincing than a synthetic thick stack

## Acceptance criteria

The synth voice should be considered successful when:

- a note clearly reads as bowed string rather than saw/square synth
- brightness changes with bow pressure and position in a believable manner
- the sound has a discernible body resonance and subtle noise floor
- vibrato feels organic rather than mechanical
- attack and release do not sound like a simple ADSR pulse
- the result remains pleasant and pedagogically clear for pitch practice without becoming over-produced or film-score-like

## Out of scope

This specification does not aim to recreate a full orchestral string section or a physical model of the entire instrument. It aims to produce a convincing solo bowed-string timbre suitable for pitch learning and musical feedback.

The long-term evolution path is:

1. additive bowed-string voice
2. richer harmonic profile tables for violin, viola, and cello
3. optional body IR or measured resonator
4. later upgrade to a true bowed digital waveguide or physical model if the product requires a deeper instrument simulation
