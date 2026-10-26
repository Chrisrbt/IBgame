// ============================================
// AUDIO - Procedural music and sound effects (Web Audio, no files)
// ============================================

const AudioCtx = {
    ctx: null,
    master: null,
    musicBus: null,
    sfxBus: null,
    noiseBuffer: null,
    muted: Storage.get('nelbosco_muted', false),

    // Must be called from a user gesture (browser autoplay policy)
    init() {
        if (!this.ctx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return;
            this.ctx = new Ctor();

            const comp = this.ctx.createDynamicsCompressor();
            comp.threshold.value = -14;
            comp.ratio.value = 4;
            comp.connect(this.ctx.destination);

            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 0.9;
            this.master.connect(comp);

            this.musicBus = this.ctx.createGain();
            this.musicBus.gain.value = 0.42;
            this.musicBus.connect(this.master);

            this.sfxBus = this.ctx.createGain();
            this.sfxBus.gain.value = 0.8;
            this.sfxBus.connect(this.master);

            // One second of white noise, reused by every noisy sound
            const len = this.ctx.sampleRate;
            this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

            Music.onReady();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    get ready() {
        return !!this.ctx;
    },

    toggleMute() {
        this.muted = !this.muted;
        Storage.set('nelbosco_muted', this.muted);
        if (this.master) {
            const t = this.ctx.currentTime;
            this.master.gain.cancelScheduledValues(t);
            this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.05);
        }
        return this.muted;
    },

    // Basic oscillator voice with an envelope; `slide` bends the pitch over the note
    tone(freq, dur, { type = 'square', vol = 0.1, slide = null, attack = 0.005, when = 0, dest = null } = {}) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + when;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vol, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(dest || this.sfxBus);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    },

    noise(dur, { vol = 0.1, filter = 'lowpass', freq = 1200, q = 1, when = 0, slide = null, dest = null } = {}) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + when;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const f = this.ctx.createBiquadFilter();
        f.type = filter;
        f.frequency.setValueAtTime(freq, t);
        if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
        f.Q.value = q;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f);
        f.connect(gain);
        gain.connect(dest || this.sfxBus);
        src.start(t);
        src.stop(t + dur + 0.05);
    },

    // Kept for compatibility with older call sites
    play(freq, duration, type = 'square', volume = 0.1) {
        this.tone(freq, duration, { type, vol: volume });
    },
};

// ===== SOUND EFFECTS =====
const Sfx = {
    step(onStone) {
        AudioCtx.noise(0.05, { vol: onStone ? 0.05 : 0.035, filter: 'bandpass', freq: onStone ? 900 : 500, q: 1.5 });
    },
    bump() {
        AudioCtx.tone(90, 0.06, { type: 'square', vol: 0.03 });
    },
    blip() {
        AudioCtx.tone(700 + Math.random() * 120, 0.025, { type: 'square', vol: 0.012 });
    },
    pickup() {
        [660, 880, 1320].forEach((f, i) => AudioCtx.tone(f, 0.12, { type: 'square', vol: 0.06, when: i * 0.07 }));
    },
    crystal() {
        [523, 784, 1047, 1568].forEach((f, i) => AudioCtx.tone(f, 0.5, { type: 'triangle', vol: 0.08, when: i * 0.09 }));
        AudioCtx.tone(2093, 0.8, { type: 'sine', vol: 0.03, when: 0.35 });
    },
    door() {
        AudioCtx.noise(0.35, { vol: 0.08, filter: 'bandpass', freq: 300, q: 4, slide: 140 });
        AudioCtx.tone(110, 0.3, { type: 'sawtooth', vol: 0.03, slide: 80 });
    },
    locked() {
        AudioCtx.tone(180, 0.08, { type: 'square', vol: 0.06 });
        AudioCtx.tone(150, 0.12, { type: 'square', vol: 0.06, when: 0.09 });
    },
    lever(on) {
        AudioCtx.noise(0.06, { vol: 0.08, filter: 'highpass', freq: 2000 });
        AudioCtx.tone(on ? 420 : 260, 0.12, { type: 'square', vol: 0.05, when: 0.03 });
    },
    tile(order) {
        AudioCtx.tone(330 * Math.pow(1.26, order - 1), 0.25, { type: 'triangle', vol: 0.09 });
    },
    puzzle() {
        [523, 659, 784, 1047].forEach((f, i) => AudioCtx.tone(f, 0.3, { type: 'triangle', vol: 0.08, when: i * 0.1 }));
    },
    error() {
        AudioCtx.tone(160, 0.35, { type: 'sawtooth', vol: 0.06, slide: 70 });
    },
    scary() {
        AudioCtx.tone(70, 1.4, { type: 'sawtooth', vol: 0.07, slide: 45 });
        AudioCtx.tone(74, 1.4, { type: 'sawtooth', vol: 0.05, slide: 48 });
        AudioCtx.noise(1.2, { vol: 0.05, filter: 'lowpass', freq: 400, slide: 80 });
    },
    hurt() {
        AudioCtx.tone(300, 0.25, { type: 'square', vol: 0.09, slide: 90 });
        AudioCtx.noise(0.15, { vol: 0.08, filter: 'lowpass', freq: 1500 });
    },
    heal() {
        [392, 494, 587, 784].forEach((f, i) => AudioCtx.tone(f, 0.35, { type: 'sine', vol: 0.08, when: i * 0.08 }));
    },
    orb() {
        AudioCtx.tone(880, 0.2, { type: 'sine', vol: 0.08, slide: 1760 });
    },
    shoot() {
        AudioCtx.tone(1200, 0.18, { type: 'triangle', vol: 0.08, slide: 400 });
        AudioCtx.noise(0.12, { vol: 0.04, filter: 'highpass', freq: 3000 });
    },
    bossShot() {
        AudioCtx.tone(220, 0.15, { type: 'sawtooth', vol: 0.025, slide: 110 });
    },
    bossHit() {
        AudioCtx.noise(0.3, { vol: 0.14, filter: 'lowpass', freq: 2500, slide: 200 });
        AudioCtx.tone(140, 0.3, { type: 'square', vol: 0.08, slide: 60 });
    },
    roar() {
        AudioCtx.tone(110, 1.0, { type: 'sawtooth', vol: 0.09, slide: 55 });
        AudioCtx.tone(117, 1.0, { type: 'sawtooth', vol: 0.07, slide: 50 });
        AudioCtx.noise(0.9, { vol: 0.08, filter: 'bandpass', freq: 600, q: 2, slide: 150 });
    },
    warn() {
        AudioCtx.tone(520, 0.08, { type: 'square', vol: 0.03 });
    },
    erupt() {
        AudioCtx.noise(0.25, { vol: 0.09, filter: 'lowpass', freq: 900, slide: 120 });
    },
    bossDie() {
        for (let i = 0; i < 6; i++) {
            AudioCtx.noise(0.5, { vol: 0.1, filter: 'lowpass', freq: 1800 - i * 200, when: i * 0.25 });
        }
        AudioCtx.tone(400, 2.4, { type: 'sawtooth', vol: 0.08, slide: 40 });
    },
    portal() {
        AudioCtx.tone(200, 1.2, { type: 'sine', vol: 0.08, slide: 800 });
        AudioCtx.tone(300, 1.2, { type: 'sine', vol: 0.05, slide: 1200, when: 0.1 });
    },
    win() {
        [523, 659, 784, 1047, 1319].forEach((f, i) => AudioCtx.tone(f, 0.4, { type: 'triangle', vol: 0.08, when: i * 0.12 }));
    },
};

// ===== MUSIC =====
// Patterns are space separated steps: note name (A4, C#5, Bb3), chord (A3+C4+E4),
// '_' holds the previous note, '.' is a rest.
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteToMidi(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) return null;
    let n = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return n + (parseInt(m[3], 10) + 1) * 12;
}

function parsePattern(str) {
    const tokens = str.trim().split(/\s+/).filter(t => t !== '|');
    const steps = [];
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok === '.' || tok === '_') { steps.push(null); continue; }
        let len = 1;
        while (tokens[i + len] === '_') len++;
        steps.push({ notes: tok.split('+').map(noteToMidi).filter(n => n !== null), len });
    }
    return steps;
}

const MusicTracks = {
    title: {
        bpm: 64, perBeat: 2,
        voices: [
            { wave: 'triangle', vol: 0.12, pluck: 1.4, pattern:
                'A4 . E5 . C5 . B4 . A4 . E5 . D5 . C5 . | B4 . E5 . C5 . A4 . G#4 . B4 . E4 _ _ _' },
            { wave: 'sine', vol: 0.09, pluck: 0, pattern:
                'A2 _ _ _ _ _ _ _ F2 _ _ _ _ _ _ _ | D2 _ _ _ _ _ _ _ E2 _ _ _ _ _ _ _' },
            { wave: 'sine', vol: 0.03, pluck: 0, detune: 8, pattern:
                'A3+C4+E4 _ _ _ _ _ _ _ F3+A3+C4 _ _ _ _ _ _ _ | D3+F3+A3 _ _ _ _ _ _ _ E3+G#3+B3 _ _ _ _ _ _ _' },
        ],
    },
    forest: {
        bpm: 56, perBeat: 2,
        voices: [
            { wave: 'sine', vol: 0.1, pluck: 2.2, pattern:
                'E5 . . . D5 . . . C5 . . . . . . . | A4 . . . C5 . . . B4 . . . . . . . | ' +
                'E5 . . . G5 . . . F5 . E5 . D5 . . . | C5 . . . B4 . . . A4 _ _ _ . . . .' },
            { wave: 'triangle', vol: 0.07, pluck: 0, pattern:
                'A2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | F2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | ' +
                'C3 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | E2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _' },
            { wave: 'sine', vol: 0.025, pluck: 0, detune: 10, pattern:
                'A3+E4 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | F3+C4 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | ' +
                'C4+G4 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | E3+B3 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _' },
        ],
        drums: { wind: 'x . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . x . . . . . . . . . . . . . . . . . . . . . . . . . . . . .' },
    },
    // Creepy music box
    house: {
        bpm: 92, perBeat: 2,
        voices: [
            { wave: 'triangle', vol: 0.1, pluck: 0.9, pattern:
                'D5 F5 A5 F5 D5 F5 A5 F5 | C#5 E5 A5 E5 C#5 E5 A5 E5 | D5 F5 A5 D6 C6 A5 F5 D5 | E5 G5 Bb5 G5 C#5 E5 A5 .' },
            { wave: 'sine', vol: 0.05, pluck: 1.2, pattern:
                'D6 . . . . . . . | . . . . E6 . . . | F6 . . . . . . . | G6 . . . A5 . . .' },
            { wave: 'sine', vol: 0.09, pluck: 0, pattern:
                'D3 _ _ _ _ _ _ _ | A2 _ _ _ _ _ _ _ | Bb2 _ _ _ _ _ _ _ | A2 _ _ _ _ _ _ _' },
        ],
    },
    otherworld: {
        bpm: 70, perBeat: 2,
        voices: [
            { wave: 'sine', vol: 0.09, pluck: 0, vibrato: 6, pattern:
                'G5 _ _ _ . . F#5 _ _ _ . . . . . . | Eb5 _ _ . D5 _ _ _ _ _ . . . . . . | ' +
                'G5 _ _ _ . . Ab5 _ _ _ . . . . . . | F#5 _ _ _ _ _ _ _ _ _ . . . . . .' },
            { wave: 'sawtooth', vol: 0.05, pluck: 0, filter: 380, detune: 7, pattern:
                'C2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | Db2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | ' +
                'C2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | B1 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _' },
            { wave: 'triangle', vol: 0.04, pluck: 0.5, pattern:
                '. . . . . . . . C6 . . . . . . . | . . . . . . . . . . . . Db6 . . . | ' +
                '. . . . . . . . . . . . . . . . | . . . . G6 . . . . . . . . . . .' },
        ],
        drums: { heart: 'x . x . . . . . . . . . . . . .' },
    },
    gallery: {
        bpm: 72, perBeat: 2,
        voices: [
            { wave: 'triangle', vol: 0.09, pluck: 1.3, pattern:
                'E5 . B4 . C5 . D5 . C5 . B4 . A4 . . . | A4 . C5 . E5 . D5 . C5 . B4 . . . . . | ' +
                'G#4 . B4 . C5 . D5 . E5 . C5 . A4 . . . | A4 _ _ _ . . . . . . . . . . . .' },
            { wave: 'sine', vol: 0.08, pluck: 0, pattern:
                'A2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | F2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | ' +
                'E2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ | A2 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _' },
        ],
    },
    boss: {
        bpm: 152, perBeat: 2,
        voices: [
            { wave: 'sawtooth', vol: 0.07, pluck: 0.25, filter: 1400, pattern:
                'E2 E2 E3 E2 E2 D3 E2 B2 | E2 E2 E3 E2 G2 F#2 E2 D2 | C2 C2 C3 C2 C2 B2 C2 G2 | D2 D2 D3 D2 B1 B2 D#2 F#2' },
            { wave: 'square', vol: 0.05, pluck: 0, filter: 2600, pattern:
                'E4 _ G4 _ B4 _ A4 G4 | F#4 _ _ _ D4 _ _ _ | E4 _ G4 _ C5 _ B4 A4 | B4 _ _ _ D#5 _ F#5 _ | ' +
                'G5 _ F#5 _ E5 _ D5 _ | E5 _ _ _ B4 _ _ _ | C5 _ B4 _ A4 _ G4 _ | F#4 _ _ _ D#4 _ B3 _' },
            { wave: 'triangle', vol: 0.04, pluck: 0, detune: 9, pattern:
                'E3+G3+B3 _ _ _ _ _ _ _ | E3+G3+B3 _ _ _ _ _ _ _ | C3+E3+G3 _ _ _ _ _ _ _ | B2+D#3+F#3 _ _ _ _ _ _ _' },
        ],
        drums: {
            kick:  'x . x . x . x . x . x . x . x x',
            snare: '. . x . . . x . . . x . . . x .',
            hat:   'x x x x x x x x x x x x x x x x',
        },
    },
    calm: {
        bpm: 66, perBeat: 2,
        voices: [
            { wave: 'triangle', vol: 0.1, pluck: 1.6, pattern:
                'E5 . G5 . C6 _ _ . B5 . G5 . A5 _ _ . | G5 . E5 . F5 . D5 . E5 _ _ _ . . . .' },
            { wave: 'sine', vol: 0.09, pluck: 0, pattern:
                'C3 _ _ _ _ _ _ _ F2 _ _ _ _ _ _ _ | G2 _ _ _ _ _ _ _ C3 _ _ _ _ _ _ _' },
            { wave: 'sine', vol: 0.03, pluck: 0, detune: 6, pattern:
                'C4+E4+G4 _ _ _ _ _ _ _ F3+A3+C4 _ _ _ _ _ _ _ | G3+B3+D4 _ _ _ _ _ _ _ C4+E4+G4 _ _ _ _ _ _ _' },
        ],
    },
    victory: {
        bpm: 96, perBeat: 2,
        voices: [
            { wave: 'triangle', vol: 0.1, pluck: 0.8, pattern:
                'C5 E5 G5 C6 G5 E5 C5 E5 | F4 A4 C5 F5 C5 A4 F4 A4 | G4 B4 D5 G5 D5 B4 G4 B4 | C5 E5 G5 C6 E6 _ _ _' },
            { wave: 'square', vol: 0.025, pluck: 0, filter: 1800, pattern:
                'E5 _ _ _ G5 _ _ _ | A5 _ _ _ F5 _ _ _ | D5 _ _ _ G5 _ _ _ | E5 _ _ _ C5 _ _ _' },
            { wave: 'sine', vol: 0.09, pluck: 0, pattern:
                'C3 _ _ _ _ _ _ _ | F2 _ _ _ _ _ _ _ | G2 _ _ _ _ _ _ _ | C3 _ _ _ _ _ _ _' },
        ],
        drums: { kick: 'x . . . x . . .', hat: '. . x . . . x .' },
    },
};

const Music = {
    current: null,
    currentName: null,
    trackGain: null,
    step: 0,
    nextTime: 0,
    timer: null,
    tempoScale: 1,
    pending: null,
    compiled: {},

    onReady() {
        if (this.pending) {
            const name = this.pending;
            this.pending = null;
            this.play(name);
        }
    },

    compile(name) {
        if (this.compiled[name]) return this.compiled[name];
        const def = MusicTracks[name];
        const track = {
            bpm: def.bpm,
            perBeat: def.perBeat,
            voices: def.voices.map(v => ({ ...v, steps: parsePattern(v.pattern) })),
            drums: {},
        };
        for (const k in (def.drums || {})) {
            track.drums[k] = def.drums[k].trim().split(/\s+/).map(c => c === 'x');
        }
        this.compiled[name] = track;
        return track;
    },

    play(name) {
        if (!MusicTracks[name]) return;
        if (!AudioCtx.ready) { this.pending = name; return; }
        if (this.currentName === name) return;
        this.fadeOutCurrent(1.2);

        const ctx = AudioCtx.ctx;
        this.current = this.compile(name);
        this.currentName = name;
        this.tempoScale = 1;
        this.step = 0;
        this.trackGain = ctx.createGain();
        this.trackGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        this.trackGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.0);
        this.trackGain.connect(AudioCtx.musicBus);
        this.nextTime = ctx.currentTime + 0.1;

        if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    },

    stop(fade = 1.0) {
        this.pending = null;
        this.fadeOutCurrent(fade);
        this.current = null;
        this.currentName = null;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },

    fadeOutCurrent(fade) {
        if (!this.trackGain || !AudioCtx.ctx) return;
        const g = this.trackGain;
        const t = AudioCtx.ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
        setTimeout(() => g.disconnect(), (fade + 0.5) * 1000);
        this.trackGain = null;
    },

    setTempoScale(s) {
        this.tempoScale = s;
    },

    tick() {
        if (!this.current || !AudioCtx.ctx) return;
        const ctx = AudioCtx.ctx;
        // Tab was hidden: skip ahead instead of firing a burst of late notes
        if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
        const stepDur = 60 / (this.current.bpm * this.tempoScale) / this.current.perBeat;
        while (this.nextTime < ctx.currentTime + 0.15) {
            this.scheduleStep(this.step, this.nextTime, stepDur);
            this.nextTime += stepDur;
            this.step++;
        }
    },

    scheduleStep(step, time, stepDur) {
        const tr = this.current;
        for (const v of tr.voices) {
            const s = v.steps[step % v.steps.length];
            if (!s) continue;
            for (const midi of s.notes) this.note(v, midi, time, s.len * stepDur);
        }
        for (const kind in tr.drums) {
            const pat = tr.drums[kind];
            if (pat[step % pat.length]) this.drum(kind, time);
        }
    },

    note(v, midi, time, dur) {
        const ctx = AudioCtx.ctx;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        const out = ctx.createGain();
        let node = out;
        if (v.filter) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = v.filter;
            f.connect(out);
            node = f;
        }
        const detunes = v.detune ? [-v.detune, v.detune] : [0];
        const vol = v.vol / detunes.length;
        const end = v.pluck ? time + v.pluck : time + dur + 0.25;

        out.gain.setValueAtTime(0.0001, time);
        out.gain.linearRampToValueAtTime(vol, time + (v.pluck ? 0.006 : 0.08));
        if (v.pluck) {
            out.gain.exponentialRampToValueAtTime(0.0001, end);
        } else {
            out.gain.setValueAtTime(vol, time + Math.max(0.09, dur - 0.05));
            out.gain.linearRampToValueAtTime(0.0001, end);
        }
        out.connect(this.trackGain);

        for (const d of detunes) {
            const osc = ctx.createOscillator();
            osc.type = v.wave;
            osc.frequency.value = freq;
            osc.detune.value = d;
            if (v.vibrato) {
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 5;
                lfoGain.gain.value = v.vibrato;
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfo.start(time);
                lfo.stop(end + 0.05);
            }
            osc.connect(node);
            osc.start(time);
            osc.stop(end + 0.05);
        }
    },

    drum(kind, time) {
        const ctx = AudioCtx.ctx;
        const out = ctx.createGain();
        out.connect(this.trackGain);
        if (kind === 'kick' || kind === 'heart') {
            const osc = ctx.createOscillator();
            const vol = kind === 'heart' ? 0.35 : 0.5;
            osc.frequency.setValueAtTime(kind === 'heart' ? 80 : 130, time);
            osc.frequency.exponentialRampToValueAtTime(38, time + 0.18);
            out.gain.setValueAtTime(vol, time);
            out.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
            osc.connect(out);
            osc.start(time);
            osc.stop(time + 0.35);
            return;
        }
        const src = ctx.createBufferSource();
        src.buffer = AudioCtx.noiseBuffer;
        src.loop = kind === 'wind';
        const f = ctx.createBiquadFilter();
        let vol = 0.1, len = 0.05;
        if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1800; vol = 0.22; len = 0.16; }
        else if (kind === 'hat') { f.type = 'highpass'; f.frequency.value = 7000; vol = 0.05; len = 0.04; }
        else if (kind === 'wind') { f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.7; vol = 0.05; len = 6; }
        out.gain.setValueAtTime(kind === 'wind' ? 0.0001 : vol, time);
        if (kind === 'wind') out.gain.linearRampToValueAtTime(vol, time + 2.5);
        out.gain.exponentialRampToValueAtTime(0.0001, time + len);
        src.connect(f);
        f.connect(out);
        src.start(time);
        src.stop(time + len + 0.05);
    },
};
