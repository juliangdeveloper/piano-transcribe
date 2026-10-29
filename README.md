# 🎼 piano-transcribe

**Real-time pitch detection & sheet music engine for the browser: microphone or MIDI to notation, MIDI and MusicXML export, no server.**

> Motor open source de captura y escritura musical para la web: convierte lo que tocas en el piano (micrófono, MIDI o entrada de línea) en notas y partitura, en vivo y en el dispositivo.

**[▶ Probar la demo](https://juliangdeveloper.github.io/piano-transcribe/)** · la interfaz es una demo del motor

<img src="docs/screenshot.png" alt="Demo de piano-transcribe escribiendo notas en un pentagrama" width="320">

## Usar el motor en tu proyecto
El motor es un módulo ES sin DOM publicado en `engine/v1/`. Los cambios compatibles se publican ahí; uno incompatible irá a `engine/v2/`.

```javascript
const root = 'https://juliangdeveloper.github.io/piano-transcribe/engine/v1/';
const version = (await (await fetch(root + 'version.txt', { cache: 'no-store' })).text()).trim();
const engine = await import(root + 'capture.js?v=' + version);

const session = engine.createCapture({ profile: 'score', score: { bpm: 80, timeSig: '4/4', clef: 'treble' } });
const out = session.hop(frame, sampleRate, performance.now());
```

- Llama a `hop` cada `engine.HOP_MS` (20 ms) con un `Float32Array` de un `AnalyserNode` (`fftSize` 2048). Devuelve `out.events` (notas que empiezan o terminan) y `out.score` (compases con notas y silencios).
- Con MIDI o teclado usa `session.press('C4', 'midi', now)` y `session.release('C4', 'midi', now)`.
- `profile: 'combat'` limita el rango a C3–C6; `maxVoices: 2` permite dos notas a la vez con el micrófono.
- `engine.toMidi(session.score())` devuelve los bytes de un `.mid` y `engine.toMusicXML(session.score())` el texto de un `.musicxml`, con el tempo y el compás de la sesión.
- [`examples/minimal.html`](examples/minimal.html) escucha el micrófono y descarga el MIDI en unas 50 líneas.
- [piano-magic](https://github.com/juliangdeveloper/piano-magic) lo usa así para su combate.

### API (`engine/v1`, versión 1.13.0)
| Función | Qué hace |
| --- | --- |
| `createCapture(opts)` | Crea una sesión: `profile`, `maxVoices`, `a4` y `score: { bpm, timeSig, clef }`. |
| `session.hop` · `press` · `release` | Alimentan la sesión con audio o con notas MIDI/teclado. |
| `session.score()` · `setScore({ bpm, timeSig })` | Leen la partitura o cambian tempo y compás. |
| `session.held()` · `advance` · `releaseSource` · `reset` | Notas sonando, avanzar el tiempo, soltar una fuente y empezar de cero. |
| `toMidi(score)` · `toMusicXML(score)` | Exportan la partitura. |
| `detectPitch(buffer, sampleRate)` | Detecta la frecuencia de un bloque de audio. |
| `noteFromFreq` · `noteFromMidi` · `hzForNote` | Convierten entre Hz, número MIDI y nombre de nota. |
| `TEMPO` · `TIME_SIGNATURES` | Tempo de 40 a 208 y compases 2/4, 3/4, 4/4 y 6/8. |

## La demo
- Pulsa **Escuchar** y en ⚙ elige micrófono, MIDI o entrada de línea.
- En ⚙ eliges también el tempo (♩=60 a 144) y el compás (2/4, 3/4, 4/4 o 6/8).
- Arriba ves la nota, los cents y la claridad; abajo, la partitura en clave de sol, de fa o en pentagrama doble.
- **MIDI** y **MusicXML** descargan lo que tocaste.
- Si el micrófono falla o no tiene permiso, la demo dice por qué.
- **Parar** deja la partitura; al volver a escuchar empieza de cero.

## Estado y límites
- En curso.
- Probado con micrófono. MIDI y entrada de línea pasan pruebas simuladas, pero no se han probado con hardware.
- La polifonía es limitada: en acordes puede aparecer una nota que no se tocó (por ejemplo, un G#3 en La menor).
- El tempo y el compás se eligen a mano; no se detectan.

## Contribuir
El proyecto busca quien lo mejore y lo mantenga. Abre un issue o un PR, sobre todo en:
- Probar y corregir la entrada MIDI (USB y Bluetooth) y la entrada de línea.
- Polifonía y acordes más fiables.
- Detectar tempo y compás a partir de lo que se toca.
- Probar el MIDI y el MusicXML exportados en editores de partituras.

## Stack
JavaScript vanilla, Web Audio y Web MIDI; la partitura se dibuja con VexFlow. Sin dependencias de npm.

```
python3 -m http.server 8000
npm test
```

Licencia: [MIT](LICENSE). Incluye VexFlow (MIT) y la fuente Gonville (uso libre).

---

Más proyectos: https://juliangdeveloper.github.io/

Hecho con ❤️ y 🎼
