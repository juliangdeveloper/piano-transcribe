'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Meta = require('../js/meta.js');
const SLUG = 'piano-transcribe';
const NOW = new Date('2026-10-23T18:00:00.000Z');
const ENV = (storage) => ({ localStorage: storage, now: NOW, force: true, window: { location: { search: '' }, parent: null } });
const KEY = 'meta.v1.piano-transcribe';

function mem(seed) {
  const data = Object.assign({}, seed || {});
  return {
    data,
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
}

function update(storage, logros) {
  
  return Meta.metaUpdate(SLUG, '9.9.9', { stats: {}, logros }, ENV(storage));
}

function backfill(storage) {
  
  return Meta.metaBackfill(SLUG, '9.9.9', () => ({ stats: {}, logros: [] }), ENV(storage));
}

test.beforeEach(() => Meta.metaSetProyecto(null));
test.after(() => Meta.metaSetProyecto(null));

test('PROYECTO is a valid block within the shared ranges', () => {
  assert.deepStrictEqual(Meta.metaProyecto(Meta.PROYECTO), Object.assign({}, Meta.PROYECTO));
  assert.ok(Array.from(Meta.PROYECTO.objetivo).length <= 140);
});

test('backfill and updates write the proyecto block outside stats', () => {
  const storage = mem();
  backfill(storage);
  const stored = JSON.parse(storage.getItem(KEY));
  assert.strictEqual(stored.v, 1);
  assert.deepStrictEqual(stored.proyecto, Object.assign({}, Meta.PROYECTO));
  assert.strictEqual('proyecto' in stored.stats, false);
  const other = mem({ [KEY]: storage.getItem(KEY) });
  update(other, ['first_note']);
  const again = JSON.parse(other.getItem(KEY));
  assert.deepStrictEqual(again.proyecto, Object.assign({}, Meta.PROYECTO));
  assert.ok(again.logros.includes('first_note'));
});

test('an invalid block is left out and never throws', () => {
  const P = Meta.PROYECTO;
  const bad = [
    'x', [], {},
    Object.assign({}, P, { objetivo: '' }),
    Object.assign({}, P, { objetivo: 'a'.repeat(141) }),
    Object.assign({}, P, { objetivo: 5 }),
    Object.assign({}, P, { fase: 0 }), Object.assign({}, P, { fase: 8 }),
    Object.assign({}, P, { fase: 2.5 }), Object.assign({}, P, { fase: '4' }),
    Object.assign({}, P, { fase_estado: -1 }), Object.assign({}, P, { fase_estado: 5 }),
    Object.assign({}, P, { fases_completadas: 7 }), Object.assign({}, P, { fases_completadas: NaN }),
    { get objetivo() { throw new Error('boom'); } }
  ];
  for (const p of bad) {
    assert.strictEqual(Meta.metaProyecto(p), null);
    const storage = mem();
    Meta.metaSetProyecto(p);
    assert.doesNotThrow(() => update(storage, ['first_note']));
    const stored = JSON.parse(storage.getItem(KEY));
    assert.strictEqual('proyecto' in stored, false);
    assert.ok(stored.logros.includes('first_note'));
  }
});

test('an old record without proyecto is still valid and gains the block on open', () => {
  const old = {
    v: 1, slug: 'piano-transcribe', version: '1.12.2', updatedAt: '2026-01-01T00:00:00.000Z',
    stats: { sessions: 7 }, logros: ['first_note'], hitos: { first_note: '2026-01-01T00:00:00.000Z' }
  };
  const storage = mem({ [KEY]: JSON.stringify(old) });
  const rec = backfill(storage);
  assert.strictEqual(storage.getItem(KEY + '.corrupt'), null);
  assert.strictEqual(rec.hitos.first_note, '2026-01-01T00:00:00.000Z');
  assert.deepStrictEqual(rec.logros, ['first_note']);
  assert.strictEqual(rec.stats.sessions, 7);
  assert.deepStrictEqual(rec.proyecto, Object.assign({}, Meta.PROYECTO));
  assert.strictEqual(rec.proyecto.fase, 6);
  assert.strictEqual(rec.proyecto.fase_estado, 1);
  assert.strictEqual(rec.proyecto.fases_completadas, 5);
});

test('backfill rewrites a different fase and keeps stats, logros and hitos', () => {
  const stale = { objetivo: 'Objetivo anterior.', fase: 3, fase_estado: 1, fases_completadas: 2, tipo: 'recurso' };
  const old = {
    v: 1, slug: 'piano-transcribe', version: '0.0.1', updatedAt: '2026-01-01T00:00:00.000Z',
    stats: { sessions: 4, notes_captured_total: 9 },
    logros: ['first_session', 'first_note'],
    hitos: { first_note: '2026-01-01T00:00:00.000Z', first_session: '2026-01-02T00:00:00.000Z' },
    proyecto: Object.assign({ extra: 1 }, stale)
  };
  const storage = mem({ [KEY]: JSON.stringify(old) });
  const rec = backfill(storage);
  assert.deepStrictEqual(rec.proyecto, Object.assign({}, Meta.PROYECTO));
  assert.strictEqual(rec.proyecto.fase, Meta.FASE.LANZAMIENTO_Y_MANTENIMIENTO);
  assert.strictEqual(rec.proyecto.fase_estado, Meta.ESTADO_FASE.EN_CURSO);
  assert.strictEqual(rec.proyecto.fases_completadas, 5);
  assert.strictEqual(rec.proyecto.objetivo, Meta.PROYECTO.objetivo);
  assert.strictEqual(rec.stats.sessions, 4);
  assert.strictEqual(rec.stats.notes_captured_total, 9);
  assert.deepStrictEqual(rec.logros, old.logros);
  assert.deepStrictEqual(rec.hitos, old.hitos);
  assert.strictEqual(storage.getItem(KEY + '.corrupt'), null);
  const again = backfill(storage);
  assert.strictEqual(again.updatedAt, rec.updatedAt);
  assert.deepStrictEqual(again.stats, rec.stats);
  assert.deepStrictEqual(again.hitos, old.hitos);
});

test('a stored record with a different proyecto gets the current block on the next write', () => {
  const stale = { objetivo: 'Objetivo anterior.', fase: 2, fase_estado: 3, fases_completadas: 1 };
  const old = {
    v: 1, slug: 'piano-transcribe', version: '0.0.1', updatedAt: '2026-01-01T00:00:00.000Z',
    stats: {}, logros: ['first_note'], hitos: { first_note: '2026-01-01T00:00:00.000Z' },
    proyecto: Object.assign({ extra: 1 }, stale)
  };
  const storage = mem({ [KEY]: JSON.stringify(old) });
  update(storage, []);
  const rec = JSON.parse(storage.getItem(KEY));
  assert.deepStrictEqual(rec.proyecto, Object.assign({}, Meta.PROYECTO));
  assert.strictEqual(rec.hitos['first_note'], '2026-01-01T00:00:00.000Z');
  assert.strictEqual(storage.getItem(KEY + '.corrupt'), null);

  Meta.metaSetProyecto({ fase: 9 });
  const second = mem({ [KEY]: JSON.stringify(old) });
  update(second, []);
  assert.strictEqual('proyecto' in JSON.parse(second.getItem(KEY)), false);
});

test('fase 7 (Descartada) is accepted', () => {
  const D = Object.assign({}, Meta.PROYECTO, { fase: 7, fase_estado: 4 });
  assert.deepStrictEqual(Meta.metaProyecto(D), D);
});

test('tipo is optional, independent of fase, and must be a TIPO_PROYECTO value', () => {
  assert.strictEqual('tipo' in Meta.metaProyecto(Object.assign({}, Meta.PROYECTO, { tipo: undefined })), false);
  for (const tipo of Object.values(Meta.TIPO_PROYECTO)) {
    for (const fase of Object.values(Meta.FASE)) {
      const p = Object.assign({}, Meta.PROYECTO, { fase, tipo });
      assert.deepStrictEqual(Meta.metaProyecto(p), p);
    }
  }
  for (const tipo of ['', 'Proyecto', 'otro', 1, null, {}, []]) {
    assert.strictEqual(Meta.metaProyecto(Object.assign({}, Meta.PROYECTO, { tipo })), null);
  }
});

test('a stored proyecto with an invalid tipo is tolerated and replaced on the next write', () => {
  const stale = { objetivo: 'Objetivo anterior.', fase: 2, fase_estado: 3, fases_completadas: 1, tipo: 'no_vale' };
  const old = {
    v: 1, slug: 'piano-transcribe', version: '0.0.1', updatedAt: '2026-01-01T00:00:00.000Z',
    stats: {}, logros: ['first_note'], hitos: { first_note: '2026-01-01T00:00:00.000Z' },
    proyecto: Object.assign({ extra: 1 }, stale)
  };
  const storage = mem({ [KEY]: JSON.stringify(old) });
  update(storage, []);
  const rec = JSON.parse(storage.getItem(KEY));
  assert.deepStrictEqual(rec.proyecto, Object.assign({}, Meta.PROYECTO));
  assert.strictEqual(rec.hitos['first_note'], '2026-01-01T00:00:00.000Z');
  assert.strictEqual(storage.getItem(KEY + '.corrupt'), null);

  Meta.metaSetProyecto(Object.assign({}, Meta.PROYECTO, { tipo: 'no_vale' }));
  const second = mem({ [KEY]: JSON.stringify(old) });
  update(second, []);
  assert.strictEqual('proyecto' in JSON.parse(second.getItem(KEY)), false);
});

test('an old record without tipo gains a valid tipo on the next write and keeps stats and hitos', () => {
  Meta.metaSetProyecto(Object.assign({}, Meta.PROYECTO, { tipo: Meta.TIPO_PROYECTO.RECURSO }));
  const stale = { objetivo: 'Objetivo anterior.', fase: 2, fase_estado: 3, fases_completadas: 1 };
  const old = {
    v: 1, slug: 'piano-transcribe', version: '0.0.1', updatedAt: '2026-01-01T00:00:00.000Z',
    stats: { sessions: 7 }, logros: ['first_note'], hitos: { first_note: '2026-01-01T00:00:00.000Z' },
    proyecto: Object.assign({ extra: 1 }, stale)
  };
  const storage = mem({ [KEY]: JSON.stringify(old) });
  Meta.metaUpdate(SLUG, '9.9.9', { stats: {}, logros: [], declared: [{ key: 'sessions', tipo: Meta.TIPO_STAT.TOTAL_ACUMULADO }] }, ENV(storage));
  const rec = JSON.parse(storage.getItem(KEY));
  assert.deepStrictEqual(rec.proyecto, Object.assign({}, Meta.PROYECTO, { tipo: 'recurso' }));
  assert.strictEqual(rec.hitos['first_note'], '2026-01-01T00:00:00.000Z');
  assert.strictEqual(storage.getItem(KEY + '.corrupt'), null);
  assert.strictEqual(rec.stats.sessions, 7);

  Meta.metaSetProyecto({ fase: 9 });
  const second = mem({ [KEY]: JSON.stringify(old) });
  update(second, []);
  assert.strictEqual('proyecto' in JSON.parse(second.getItem(KEY)), false);
});

test('the written proyecto block carries tipo recurso', () => {
  const stale = { objetivo: 'Objetivo anterior.', fase: 2, fase_estado: 3, fases_completadas: 1 };
  const old = {
    v: 1, slug: 'piano-transcribe', version: '0.0.1', updatedAt: '2026-01-01T00:00:00.000Z',
    stats: {}, logros: ['first_note'], hitos: { first_note: '2026-01-01T00:00:00.000Z' },
    proyecto: Object.assign({ extra: 1 }, stale)
  };
  const storage = mem({ [KEY]: JSON.stringify(old) });
  update(storage, []);
  const rec = JSON.parse(storage.getItem(KEY));
  assert.strictEqual(Meta.PROYECTO.tipo, Meta.TIPO_PROYECTO.RECURSO);
  assert.strictEqual(rec.proyecto.tipo, 'recurso');
  assert.deepStrictEqual(rec.proyecto, Object.assign({}, Meta.PROYECTO));
  assert.strictEqual(rec.hitos['first_note'], '2026-01-01T00:00:00.000Z');
  assert.strictEqual(storage.getItem(KEY + '.corrupt'), null);

  Meta.metaSetProyecto({ fase: 9 });
  const second = mem({ [KEY]: JSON.stringify(old) });
  update(second, []);
  assert.strictEqual('proyecto' in JSON.parse(second.getItem(KEY)), false);
});
