// Web Audio API synthesis — no external files needed

/**
 * Recupera/cria um AudioContext reutilizavel e garante estado "running".
 * Usa vendor prefix webkitAudioContext quando necessario.
 */
function getCtx(ref: React.MutableRefObject<AudioContext | null>): AudioContext | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!ref.current) ref.current = new AC();
  if (ref.current.state === 'suspended') ref.current.resume();
  return ref.current;
}

/** Dramatic orchestral hit — dark fantasy / LOTR style */
export function playEpicOpen(ref: React.MutableRefObject<AudioContext | null>) {
  const ctx = getCtx(ref);
  if (!ctx) return;
  const t = ctx.currentTime;

  // ── Percussion noise burst (epic drum) ──
  const bufLen = Math.floor(ctx.sampleRate * 0.55);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.2);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 110;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(1.0, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  noise.connect(nf); nf.connect(ng); ng.connect(ctx.destination);
  noise.start(t);

  // ── Brass chord swell (C major voicing) ──
  [130.81, 164.81, 196, 261.63, 329.63].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1000;
    const gain = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + i * 0.045);
    gain.gain.linearRampToValueAtTime(0.065, t + 0.3 + i * 0.045);
    gain.gain.setValueAtTime(0.065, t + 1.4);
    gain.gain.linearRampToValueAtTime(0, t + 2.6);
    osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 2.7);
  });

  // ── High choir shimmer ──
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + 0.2 + i * 0.07);
    gain.gain.linearRampToValueAtTime(0.028, t + 0.55 + i * 0.07);
    gain.gain.linearRampToValueAtTime(0, t + 2.6);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t + 0.2); osc.stop(t + 2.7);
  });

  // ── Low drone rumble ──
  const drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 55;
  const dg = ctx.createGain();
  dg.gain.setValueAtTime(0, t); dg.gain.linearRampToValueAtTime(0.18, t + 0.4);
  dg.gain.linearRampToValueAtTime(0, t + 2.5);
  drone.connect(dg); dg.connect(ctx.destination);
  drone.start(t); drone.stop(t + 2.7);
}

/** Great Horn of Gondor — 3-note brass call (D3 long · D3 short · A3 long) */
export function playHornOfGondor(ref: React.MutableRefObject<AudioContext | null>) {
  const ctx = getCtx(ref);
  if (!ctx) return;
  const t = ctx.currentTime;

  const notes = [
    { freq: 146.83, start: 0,    dur: 0.85, vol: 0.30 },
    { freq: 146.83, start: 0.75, dur: 0.28, vol: 0.24 },
    { freq: 220.00, start: 0.95, dur: 1.15, vol: 0.35 },
  ];

  notes.forEach(({ freq, start, dur, vol }) => {
    const osc = ctx.createOscillator();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.3;
    const gain = ctx.createGain();
    // Vibrato
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
    const vg = ctx.createGain(); vg.gain.value = 5;
    vib.connect(vg); vg.connect(osc.frequency);
    vib.start(t + start); vib.stop(t + start + dur + 0.2);

    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, t + start);
    gain.gain.setValueAtTime(0, t + start);
    gain.gain.linearRampToValueAtTime(vol, t + start + 0.1);
    gain.gain.setValueAtTime(vol * 0.88, t + start + dur - 0.1);
    gain.gain.linearRampToValueAtTime(0, t + start + dur + 0.2);
    osc.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
    osc.start(t + start); osc.stop(t + start + dur + 0.3);
  });
}

/**
 * Toca audio de abertura de pack a partir de arquivo estatico.
 * Em caso de falha (arquivo ausente, bloqueio de autoplay, etc.), aplica fallback para sintese via playEpicOpen.
 */
export function playPackOpeningMusic(ref: React.MutableRefObject<AudioContext | null>) {
  const audio = new Audio('/audio/pack_open.mp3');
  audio.volume = 0.6;
  
  audio.play().catch((err) => {
    console.warn('Custom pack audio failed or missing, falling back to synth:', err);
    playEpicOpen(ref);
  });
}

/**
 * Perfect Roll Fanfare — Lucky Pack Moment.
 * Composicao sintetizada em tres atos:
 * 1) Impacto percussivo grave (golpe de destino)
 * 2) Arpejo ascendente dourado (harpa celestial)
 * 3) Acorde sustentado de coro (triado maior luminoso)
 */
export function playPerfectRollFanfare(ref: React.MutableRefObject<AudioContext | null>) {
  const ctx = getCtx(ref);
  if (!ctx) return;
  const t = ctx.currentTime;

  // ── ACT 1: Thunderous impact ──
  const bufLen = Math.floor(ctx.sampleRate * 0.8);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.8);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 80;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(1.4, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  noise.connect(nf); nf.connect(ng); ng.connect(ctx.destination);
  noise.start(t);

  // Sub-bass boom
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 40;
  const subG = ctx.createGain();
  subG.gain.setValueAtTime(0.5, t);
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  sub.connect(subG); subG.connect(ctx.destination);
  sub.start(t); sub.stop(t + 1);

  // ── ACT 2: Golden harp arpeggio (ascending) ──
  // C major pentatonic: C4 E4 G4 C5 E5 G5 C6
  const harpNotes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
  harpNotes.forEach((freq, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    const gain = ctx.createGain();
    const delay = 0.35 + i * 0.11;
    gain.gain.setValueAtTime(0, t + delay);
    gain.gain.linearRampToValueAtTime(0.12, t + delay + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.9);
    osc.frequency.setValueAtTime(freq, t + delay);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t + delay); osc.stop(t + delay + 1);
  });

  // ── ACT 3: Triumphant choir swell ──
  const choirFreqs = [130.81, 164.81, 196.0, 261.63, 329.63, 392.0, 523.25];
  choirFreqs.forEach((freq, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    // Add slight detune for warmth
    osc.detune.value = (i % 2 === 0 ? 1 : -1) * 4;
    const gain = ctx.createGain();
    const start = 1.1 + i * 0.05;
    gain.gain.setValueAtTime(0, t + start);
    gain.gain.linearRampToValueAtTime(0.04, t + start + 0.3);
    gain.gain.setValueAtTime(0.04, t + 3.5);
    gain.gain.linearRampToValueAtTime(0, t + 4.5);
    osc.frequency.setValueAtTime(freq, t + start);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t + start); osc.stop(t + 4.8);
  });

  // Shimmer high bells (overtones)
  [2093, 2637.02, 3135.96].forEach((freq, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    const gain = ctx.createGain();
    const start = 1.0 + i * 0.18;
    gain.gain.setValueAtTime(0, t + start);
    gain.gain.linearRampToValueAtTime(0.02, t + start + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + start + 2.5);
    osc.frequency.setValueAtTime(freq, t + start);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t + start); osc.stop(t + start + 2.8);
  });
}

// Required for JSX in this file context (just for linting)
import React from 'react';
void React;
