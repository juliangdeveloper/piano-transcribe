'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Input = require('../js/input.js');

function domError(name) {
  const err = new Error(name);
  err.name = name;
  return err;
}

test('sin dispositivo de entrada se informa que no hay micrófono', () => {
  for (const name of ['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError']) {
    assert.strictEqual(Input.micErrorMessage(domError(name)), Input.MIC_ERROR.NOT_FOUND);
  }
  assert.match(Input.MIC_ERROR.NOT_FOUND, /^No se encontró micrófono/);
});

test('el permiso denegado se distingue de la falta de micrófono', () => {
  for (const name of ['NotAllowedError', 'PermissionDeniedError', 'SecurityError']) {
    assert.strictEqual(Input.micErrorMessage(domError(name)), Input.MIC_ERROR.DENIED);
  }
  assert.match(Input.MIC_ERROR.DENIED, /^Permiso denegado/);
  assert.notStrictEqual(Input.MIC_ERROR.DENIED, Input.MIC_ERROR.NOT_FOUND);
});

test('micrófono ocupado y errores desconocidos tienen su propio mensaje', () => {
  assert.strictEqual(Input.micErrorMessage(domError('NotReadableError')), Input.MIC_ERROR.BUSY);
  assert.strictEqual(Input.micErrorMessage(domError('TypeError')), 'No se pudo abrir el micrófono (TypeError).');
  assert.strictEqual(Input.micErrorMessage(null), 'No se pudo abrir el micrófono.');
  assert.strictEqual(Input.micErrorMessage({}), 'No se pudo abrir el micrófono.');
});

test('decodeMidi interpreta note on, note off y note on con velocidad 0', () => {
  assert.deepStrictEqual(Input.decodeMidi([0x90, 60, 100]), { type: 'on', midi: 60, velocity: 100 });
  assert.deepStrictEqual(Input.decodeMidi([0x93, 61, 1]), { type: 'on', midi: 61, velocity: 1 });
  assert.deepStrictEqual(Input.decodeMidi([0x80, 60, 64]), { type: 'off', midi: 60, velocity: 0 });
  assert.deepStrictEqual(Input.decodeMidi([0x90, 60, 0]), { type: 'off', midi: 60, velocity: 0 });
  assert.strictEqual(Input.decodeMidi([0xb0, 64, 127]), null);
  assert.strictEqual(Input.decodeMidi([0xf8]), null);
  assert.strictEqual(Input.decodeMidi(null), null);
});

test('pickMidiInput prefiere la entrada abierta y si no, la primera', () => {
  const access = (list) => ({ inputs: new Map(list.map((x, i) => [String(i), x])) });
  const a = { type: 'input', connection: 'closed', name: 'A' };
  const b = { type: 'input', connection: 'open', name: 'B' };
  const out = { type: 'output', connection: 'open', name: 'O' };
  assert.strictEqual(Input.pickMidiInput(access([out, a, b])), b);
  assert.strictEqual(Input.pickMidiInput(access([out, a])), a);
  assert.strictEqual(Input.pickMidiInput(access([out])), null);
  assert.strictEqual(Input.pickMidiInput(null), null);
});

test('la entrada de línea no lleva la ganancia del micrófono', () => {
  assert.strictEqual(Input.preampGain('line'), Input.PREAMP_GAIN.line);
  assert.strictEqual(Input.preampGain('mic'), Input.PREAMP_GAIN.mic);
  assert.strictEqual(Input.preampGain('otro'), Input.PREAMP_GAIN.mic);
  assert.ok(Input.PREAMP_GAIN.mic > Input.PREAMP_GAIN.line);
});
