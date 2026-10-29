'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

async function engine() {
  return import(path.join('file://', __dirname, '..', 'engine', 'v1', 'capture.js'));
}

function layout(score) {
  return score.measures.map((m) => m.notes.map((n) => n.pitch + ':' + n.duration + (n.tie ? '~' : '')).join(' ')).join(' | ');
}

const PUBLIC = [
  'API', 'HOP_MS', 'INTERFACE', 'TEMPO', 'TIME_SIGNATURES', 'VERSION',
  'createCapture', 'default', 'denyMessage', 'detectPitch', 'hzForNote',
  'noteFromFreq', 'noteFromMidi', 'sessionType', 'statusLine', 'toMidi', 'toMusicXML'
];

test('engine/v1 expone solo la superficie pública estable', async () => {
  const mod = await engine();
  assert.deepStrictEqual(Object.keys(mod).sort(), PUBLIC.slice().sort());
  assert.ok(Object.isFrozen(mod.default));
  assert.ok(Object.isFrozen(mod.API));
  for (const name of PUBLIC) if (name !== 'default') assert.strictEqual(mod.default[name], mod[name], name);
});

test('API declara nombre, interfaz, versión y punto de entrada', async () => {
  const mod = await engine();
  assert.deepStrictEqual(Object.keys(mod.API).sort(), ['entry', 'interface', 'name', 'tempo', 'timeSignatures', 'version']);
  assert.strictEqual(mod.API.name, 'piano-transcribe/engine');
  assert.strictEqual(mod.API.interface, mod.INTERFACE);
  assert.strictEqual(mod.API.version, mod.VERSION);
  assert.match(mod.VERSION, /^\d+\.\d+\.\d+$/);
  assert.strictEqual(typeof mod[mod.API.entry], 'function');
});

test('la sesión de createCapture tiene la forma estable', async () => {
  const mod = await engine();
  const s = mod.createCapture({ profile: 'score', maxVoices: 2 });
  for (const fn of ['hop', 'press', 'release', 'advance', 'releaseSource', 'reset', 'score', 'setScore', 'scoreOptions', 'held']) {
    assert.strictEqual(typeof s[fn], 'function', fn);
  }
  const out = s.press('C4', 'key', 0);
  assert.deepStrictEqual(Object.keys(out).sort(), ['events', 'held', 'reading', 'score']);
  const score = s.score();
  for (const k of ['bpm', 'timeSig', 'timeSigStr', 'clef', 'measures']) assert.ok(k in score, k);
});

test('tempo y compás se validan y se aplican a la escritura', async () => {
  const mod = await engine();
  const s = mod.createCapture({ profile: 'score', score: { bpm: 60, timeSig: '3/4' } });
  assert.deepStrictEqual(s.scoreOptions(), { bpm: 60, timeSig: '3/4', clef: 'treble' });
  s.press('C4', 'key', 0);
  s.release('C4', 'key', 2000);
  s.press('D4', 'key', 2000);
  s.release('D4', 'key', 4000);
  assert.strictEqual(s.score().timeSigStr, '3/4');
  assert.strictEqual(layout(s.score()), 'C4:h D4:q~ | D4:q');
  assert.strictEqual(layout(s.setScore({ bpm: 120, timeSig: '4/4' })), 'C4:w | D4:w');
  assert.strictEqual(layout(s.setScore({ bpm: 60, timeSig: '2/4' })), 'C4:h | D4:h');
  assert.deepStrictEqual(s.scoreOptions(), { bpm: 60, timeSig: '2/4', clef: 'treble' });
  assert.strictEqual(s.setScore({ bpm: 5 }).bpm, mod.TEMPO.MIN);
  assert.strictEqual(s.setScore({ bpm: 999 }).bpm, mod.TEMPO.MAX);
  assert.strictEqual(s.setScore({ bpm: 'x' }).bpm, mod.TEMPO.DEFAULT);
  assert.strictEqual(s.setScore({ timeSig: '7/3' }).timeSigStr, '4/4');
  assert.strictEqual(s.setScore({ timeSig: '6/8' }).timeSigStr, '6/8');
  assert.deepStrictEqual(Array.from(mod.TIME_SIGNATURES), ['2/4', '3/4', '4/4', '6/8']);
});
