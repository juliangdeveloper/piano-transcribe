'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Input = require('../js/input.js');

const SAMPLE_RATE = 48000;
const FRAME = 2048;
const HARMONICS = [1, 0.55, 0.32, 0.18, 0.11, 0.07, 0.04, 0.025];
const INHARMONICITY = 0.00015;
const DECAY_PER_HOP = 0.03;
const MIC_LEVEL = 0.06;
const LINE_LEVEL = 0.22;

async function engine() {
  return import(path.join('file://', __dirname, '..', 'engine', 'v1', 'capture.js'));
}

function hz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function pcm(midis, hop, hopMs, level) {
  const buf = new Float32Array(FRAME);
  const offset = hop * hopMs * SAMPLE_RATE / 1000;
  const amp = level * Math.exp(-hop * DECAY_PER_HOP);
  for (const midi of midis) {
    const f0 = hz(midi);
    for (let i = 0; i < FRAME; i++) {
      const t = (i + offset) / SAMPLE_RATE;
      let s = 0;
      for (let k = 0; k < HARMONICS.length; k++) {
        const n = k + 1;
        s += HARMONICS[k] * Math.sin(2 * Math.PI * n * f0 * Math.sqrt(1 + INHARMONICITY * n * n) * t + 0.3 * k);
      }
      buf[i] += amp * s;
    }
  }
  return buf;
}

function silence() {
  return new Float32Array(FRAME);
}

function gain(buf, g) {
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] * g;
  return out;
}

function play(mod, session, chords, opts) {
  const o = Object.assign({ hops: 40, rest: 15, level: LINE_LEVEL, gain: 1 }, opts);
  const ons = [];
  let t = 0;
  const step = (buf) => {
    session.hop(gain(buf, o.gain), SAMPLE_RATE, t * mod.HOP_MS).events.forEach((e) => {
      if (e.type === 'on' && e.fresh !== false) ons.push(e.pitch);
    });
    t++;
  };
  for (const chord of chords) {
    for (let i = 0; i < o.hops; i++) step(pcm(chord, i, mod.HOP_MS, o.level));
    for (let i = 0; i < o.rest; i++) step(silence());
  }
  return { ons, end: t * mod.HOP_MS };
}

function scorePitches(score) {
  const out = [];
  for (const m of score.measures) for (const n of m.notes) if (!n.rest && !(out.length && n === out[out.length - 1])) out.push(...n.pitches);
  return out;
}

function fakeMidiAccess(names) {
  const inputs = new Map();
  names.forEach((name, i) => inputs.set('in-' + i, { type: 'input', connection: i === 0 ? 'closed' : 'open', name, onmidimessage: null }));
  inputs.set('out-0', { type: 'output', connection: 'open', name: 'Salida' });
  return { inputs, onstatechange: null };
}

test('audio PCM simulado de una nota llega a la partitura', async () => {
  const mod = await engine();
  const session = mod.createCapture({ profile: 'score', maxVoices: 2 });
  const run = play(mod, session, [[69]]);
  assert.deepStrictEqual(run.ons, ['A4']);
  assert.ok(scorePitches(session.score()).includes('A4'));
});

test('una melodía PCM simulada se escribe en orden', async () => {
  const mod = await engine();
  const session = mod.createCapture({ profile: 'score', maxVoices: 2 });
  const run = play(mod, session, [[60], [64], [67]]);
  assert.deepStrictEqual(run.ons, ['C4', 'E4', 'G4']);
  const written = scorePitches(session.score()).filter((p, i, a) => a.indexOf(p) === i);
  assert.deepStrictEqual(written, ['C4', 'E4', 'G4']);
});

test('silencio PCM no escribe notas', async () => {
  const mod = await engine();
  const session = mod.createCapture({ profile: 'score', maxVoices: 2 });
  for (let i = 0; i < 50; i++) assert.deepStrictEqual(session.hop(silence(), SAMPLE_RATE, i * mod.HOP_MS).events, []);
  assert.deepStrictEqual(scorePitches(session.score()), []);
});

test('entrada de línea simulada se detecta con la ganancia de línea', async () => {
  const mod = await engine();
  const session = mod.createCapture({ profile: 'score', maxVoices: 2 });
  const run = play(mod, session, [[57]], { level: LINE_LEVEL, gain: Input.preampGain('line') });
  assert.deepStrictEqual(run.ons, ['A3']);
});

test('micrófono simulado de nivel bajo se detecta con la ganancia de micrófono', async () => {
  const mod = await engine();
  const session = mod.createCapture({ profile: 'score', maxVoices: 2 });
  const run = play(mod, session, [[64]], { level: MIC_LEVEL, gain: Input.preampGain('mic') });
  assert.deepStrictEqual(run.ons, ['E4']);
  const peak = (buf) => buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const mic = peak(gain(pcm([64], 0, mod.HOP_MS, MIC_LEVEL), Input.preampGain('mic')));
  const line = peak(gain(pcm([64], 0, mod.HOP_MS, LINE_LEVEL), Input.preampGain('line')));
  assert.ok(mic > line / 2 && mic < line * 2);
});

test('Web MIDI simulado: el teclado escribe notas y acordes sin hardware', async () => {
  const mod = await engine();
  const access = fakeMidiAccess(['Teclado cerrado', 'Piano USB']);
  const input = Input.pickMidiInput(access);
  assert.strictEqual(input.name, 'Piano USB');
  const session = mod.createCapture({ profile: 'score', maxVoices: 2, score: { bpm: 60, timeSig: '4/4' } });
  let clock = 0;
  input.onmidimessage = (e) => {
    const msg = Input.decodeMidi(e.data);
    if (!msg) return;
    if (msg.type === 'on') session.press(msg.midi, 'midi', clock);
    else session.release(msg.midi, 'midi', clock);
  };
  const send = (bytes, at) => { clock = at; input.onmidimessage({ data: new Uint8Array(bytes) }); };
  send([0x90, 60, 90], 0);
  send([0x80, 60, 0], 1000);
  send([0x90, 64, 90], 1000);
  send([0x90, 67, 90], 1000);
  send([0xb0, 64, 127], 1500);
  send([0x90, 64, 0], 2000);
  send([0x80, 67, 0], 2000);
  send([0x90, 72, 90], 2000);
  send([0x80, 72, 0], 4000);
  const notes = session.score().measures[0].notes;
  assert.deepStrictEqual(notes.map((n) => [n.pitches.join('+'), n.duration]), [['C4', 'q'], ['E4+G4', 'q'], ['C5', 'h']]);
  assert.deepStrictEqual(session.held(), []);
  const midi = mod.toMidi(session.score());
  assert.strictEqual(String.fromCharCode(...midi.slice(0, 4)), 'MThd');
  assert.ok(mod.toMusicXML(session.score()).includes('<chord/>'));
});

test('La menor (A3 C4 E4) se escribe con sus tres notas y sin G#3 fantasma', { todo: 'reportado en piano real; la síntesis aún no reproduce el G#3 y hoy se pierde el C4' }, async () => {
  const mod = await engine();
  const session = mod.createCapture({ profile: 'score', maxVoices: 2 });
  const run = play(mod, session, [[57, 60, 64]], { hops: 50 });
  assert.ok(!run.ons.includes('G#3'));
  assert.deepStrictEqual(run.ons.slice().sort(), ['A3', 'C4', 'E4']);
});
