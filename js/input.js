'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Input = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIC_ERROR = Object.freeze({
    NOT_FOUND: 'No se encontró micrófono. Conecta uno o elige otra fuente en ⚙.',
    DENIED: 'Permiso denegado: el navegador bloqueó el micrófono. Actívalo en sus ajustes.',
    BUSY: 'El micrófono está ocupado por otra app. Ciérrala y vuelve a intentar.',
    GENERIC: 'No se pudo abrir el micrófono'
  });
  var NOT_FOUND_NAMES = Object.freeze(['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError', 'ConstraintNotSatisfiedError']);
  var DENIED_NAMES = Object.freeze(['NotAllowedError', 'PermissionDeniedError', 'SecurityError']);
  var BUSY_NAMES = Object.freeze(['NotReadableError', 'TrackStartError', 'AbortError']);
  var PREAMP_GAIN = Object.freeze({ mic: 4, line: 1 });
  var MIDI_STATUS = Object.freeze({ MASK: 0xf0, NOTE_ON: 0x90, NOTE_OFF: 0x80 });
  var MIDI_INPUT = Object.freeze({ TYPE: 'input', OPEN: 'open' });

  function micErrorMessage(err) {
    var name = err && err.name ? String(err.name) : '';
    if (NOT_FOUND_NAMES.indexOf(name) >= 0) return MIC_ERROR.NOT_FOUND;
    if (DENIED_NAMES.indexOf(name) >= 0) return MIC_ERROR.DENIED;
    if (BUSY_NAMES.indexOf(name) >= 0) return MIC_ERROR.BUSY;
    return MIC_ERROR.GENERIC + (name ? ' (' + name + ')' : '') + '.';
  }

  function preampGain(mode) {
    return mode === 'line' ? PREAMP_GAIN.line : PREAMP_GAIN.mic;
  }

  function decodeMidi(data) {
    if (!data || data.length < 2) return null;
    var status = data[0] & MIDI_STATUS.MASK;
    var midi = data[1];
    var velocity = data.length > 2 ? data[2] : 0;
    if (status === MIDI_STATUS.NOTE_ON && velocity > 0) return { type: 'on', midi: midi, velocity: velocity };
    if (status === MIDI_STATUS.NOTE_OFF || status === MIDI_STATUS.NOTE_ON) return { type: 'off', midi: midi, velocity: 0 };
    return null;
  }

  function pickMidiInput(access) {
    if (!access || !access.inputs) return null;
    var first = null;
    var inputs = access.inputs.values();
    for (var it = inputs.next(); !it.done; it = inputs.next()) {
      var inp = it.value;
      if (inp.type === MIDI_INPUT.TYPE) {
        if (inp.connection === MIDI_INPUT.OPEN) return inp;
        if (!first) first = inp;
      }
    }
    return first;
  }

  return {
    MIC_ERROR: MIC_ERROR,
    PREAMP_GAIN: PREAMP_GAIN,
    MIDI_STATUS: MIDI_STATUS,
    micErrorMessage: micErrorMessage,
    preampGain: preampGain,
    decodeMidi: decodeMidi,
    pickMidiInput: pickMidiInput
  };
});
