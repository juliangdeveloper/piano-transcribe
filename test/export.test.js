'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const PPQ = 480;
const MICROS_PER_MINUTE = 60000000;

async function engine() {
  return import(path.join('file://', __dirname, '..', 'engine', 'v1', 'capture.js'));
}

function readVar(bytes, at) {
  let value = 0;
  let b;
  do {
    b = bytes[at++];
    value = (value << 7) | (b & 0x7f);
  } while (b & 0x80);
  return { value, at };
}

function parseMidi(bytes) {
  const text = (a, b) => String.fromCharCode(...bytes.slice(a, b));
  const u32 = (a) => ((bytes[a] << 24) | (bytes[a + 1] << 16) | (bytes[a + 2] << 8) | bytes[a + 3]) >>> 0;
  const u16 = (a) => (bytes[a] << 8) | bytes[a + 1];
  assert.strictEqual(text(0, 4), 'MThd');
  assert.strictEqual(u32(4), 6);
  const header = { format: u16(8), tracks: u16(10), ppq: u16(12) };
  assert.strictEqual(text(14, 18), 'MTrk');
  const length = u32(18);
  assert.strictEqual(22 + length, bytes.length);
  const events = [];
  let at = 22;
  let tick = 0;
  while (at < bytes.length) {
    const delta = readVar(bytes, at);
    at = delta.at;
    tick += delta.value;
    const status = bytes[at++];
    if (status === 0xff) {
      const type = bytes[at++];
      const len = readVar(bytes, at);
      at = len.at;
      events.push({ tick, meta: type, data: Array.from(bytes.slice(at, at + len.value)) });
      at += len.value;
    } else {
      events.push({ tick, kind: status & 0xf0, note: bytes[at], velocity: bytes[at + 1] });
      at += 2;
    }
  }
  return { header, events };
}

function wellFormed(xml) {
  const body = xml.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '');
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[4]) continue;
    if (m[1]) assert.strictEqual(stack.pop(), m[2]);
    else stack.push(m[2]);
  }
  assert.deepStrictEqual(stack, []);
  assert.ok(!/<[^>]*</.test(body.replace(/<[^>]*>/g, '')));
}

function sample(mod, opts) {
  const s = mod.createCapture({ profile: 'score', maxVoices: 2, score: opts });
  s.press('C4', 'key', 0);
  s.release('C4', 'key', 1000);
  s.press('E4', 'key', 1000);
  s.press('G4', 'key', 1000);
  s.release('E4', 'key', 2000);
  s.release('G4', 'key', 2000);
  s.press('F#4', 'key', 2000);
  s.release('F#4', 'key', 4000);
  return s.score();
}

test('toMidi escribe un SMF formato 0 con tempo, compás y notas', async () => {
  const mod = await engine();
  const score = sample(mod, { bpm: 60, timeSig: '3/4' });
  const midi = parseMidi(mod.toMidi(score));
  assert.deepStrictEqual(midi.header, { format: 0, tracks: 1, ppq: PPQ });
  const tempo = midi.events.find((e) => e.meta === 0x51);
  assert.strictEqual(MICROS_PER_MINUTE / ((tempo.data[0] << 16) | (tempo.data[1] << 8) | tempo.data[2]), 60);
  const sig = midi.events.find((e) => e.meta === 0x58);
  assert.deepStrictEqual(sig.data.slice(0, 2), [3, 2]);
  assert.strictEqual(midi.events[midi.events.length - 1].meta, 0x2f);
  const ons = midi.events.filter((e) => e.kind === 0x90).map((e) => [e.tick, e.note]);
  const offs = midi.events.filter((e) => e.kind === 0x80).map((e) => [e.tick, e.note]);
  assert.deepStrictEqual(ons, [[0, 60], [PPQ, 64], [PPQ, 67], [2 * PPQ, 66]]);
  assert.deepStrictEqual(offs, [[PPQ, 60], [2 * PPQ, 64], [2 * PPQ, 67], [4 * PPQ, 66]]);
  for (let i = 1; i < midi.events.length; i++) assert.ok(midi.events[i].tick >= midi.events[i - 1].tick);
});

test('toMidi une las notas ligadas entre compases en un solo sonido', async () => {
  const mod = await engine();
  const score = sample(mod, { bpm: 60, timeSig: '3/4' });
  assert.ok(score.measures[0].notes.some((n) => n.tie));
  const midi = parseMidi(mod.toMidi(score));
  assert.strictEqual(midi.events.filter((e) => e.kind === 0x90 && e.note === 66).length, 1);
});

test('toMidi respeta el tempo elegido', async () => {
  const mod = await engine();
  const midi = parseMidi(mod.toMidi(sample(mod, { bpm: 120, timeSig: '4/4' })));
  const tempo = midi.events.find((e) => e.meta === 0x51).data;
  assert.strictEqual((tempo[0] << 16) | (tempo[1] << 8) | tempo[2], MICROS_PER_MINUTE / 120);
  assert.deepStrictEqual(midi.events.find((e) => e.meta === 0x58).data.slice(0, 2), [4, 2]);
});

test('toMusicXML genera un partwise 4.0 bien formado con compás, tempo y ligaduras', async () => {
  const mod = await engine();
  const score = sample(mod, { bpm: 60, timeSig: '3/4' });
  const xml = mod.toMusicXML(score, { title: 'Prueba <1> & "2"' });
  wellFormed(xml);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"'));
  assert.ok(xml.includes('<score-partwise version="4.0">'));
  assert.ok(xml.includes('<work-title>Prueba &lt;1&gt; &amp; &quot;2&quot;</work-title>'));
  assert.ok(xml.includes('<divisions>4</divisions>'));
  assert.ok(xml.includes('<time><beats>3</beats><beat-type>4</beat-type></time>'));
  assert.ok(xml.includes('<per-minute>60</per-minute>'));
  assert.ok(xml.includes('<sound tempo="60"/>'));
  assert.strictEqual((xml.match(/<measure /g) || []).length, score.measures.length);
  assert.strictEqual((xml.match(/<chord\/>/g) || []).length, 1);
  assert.ok(xml.includes('<step>F</step><alter>1</alter><octave>4</octave>'));
  assert.strictEqual((xml.match(/<tie type="start"\/>/g) || []).length, 1);
  assert.strictEqual((xml.match(/<tie type="stop"\/>/g) || []).length, 1);
  for (const m of xml.split('<measure ').slice(1)) {
    const own = m.replace(/<note><chord\/>[\s\S]*?<\/note>/g, '');
    const sum = [...own.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((a, d) => a + Number(d[1]), 0);
    assert.strictEqual(sum, 12);
  }
});

test('toMusicXML con partitura vacía produce un compás de silencio', async () => {
  const mod = await engine();
  const score = mod.createCapture({ profile: 'score', score: { timeSig: '6/8' } }).score();
  const xml = mod.toMusicXML(score);
  wellFormed(xml);
  assert.ok(xml.includes('<rest measure="yes"/><duration>12</duration>'));
  assert.ok(xml.includes('<beats>6</beats><beat-type>8</beat-type>'));
});
