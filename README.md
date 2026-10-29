# 🎼 piano-transcribe

> Toca el piano y mira las notas en una partitura, en vivo. Micrófono, entrada de línea o MIDI.

**[▶ Probar ahora](https://juliangdeveloper.github.io/piano-transcribe/)** · gratis, en el navegador, sin instalar

<img src="docs/screenshot.png" alt="piano-transcribe escribiendo notas en un pentagrama" width="320">

## Cómo se usa
- Pulsa **Escuchar**. Con el micrófono, el navegador pide permiso.
- En ⚙ eliges micrófono, MIDI (USB o Bluetooth) o entrada de línea.
- Arriba ves la nota, los cents y la claridad.
- Cada compás va en clave de sol; en clave de fa si todas sus notas están bajo el do central (C4), o en pentagrama doble si mezcla ambas. ♩=80 y 4/4.
- Al pulsar **Parar** la partitura se queda. Al volver a escuchar, empieza de cero.
- En iPhone el permiso del micrófono se pide en cada carga. Si el audio queda suspendido, toca la pantalla.

## Stack
JavaScript vanilla, Web Audio y Web MIDI; la partitura se dibuja con VexFlow. La detección corre en el dispositivo, en el motor `engine/v1/`, que otros proyectos cargan desde la página publicada.

```
python3 -m http.server 8000   # http://localhost:8000
npm test                       # Node, sin npm install
```

## Relacionado
🎹 [piano-magic](https://github.com/juliangdeveloper/piano-magic): combate RPG que se juega con el piano y usa este motor. [Jugar](https://juliangdeveloper.github.io/piano-magic/)

---

Más proyectos: https://juliangdeveloper.github.io/

Hecho con ❤️ y 🎼
