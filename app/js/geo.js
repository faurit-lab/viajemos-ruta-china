// Viajemos · L3 — Audioguía por geolocalización
//
// MVP: TTS en vivo con Web Speech API (funciona offline en la mayoría de
// Android/Chrome una vez el motor de voz está instalado en el dispositivo;
// ver docs/Especificacion_tecnica_para_Codex.md sección 4 — opción elegida
// por ser "sin backend, sin coste"). Vía de mejora futura: pregenerar audios
// en la nube y cachearlos como Blob en IndexedDB (db.js ya deja el store
// `audioCache` preparado para ese salto sin tocar el resto de la app).

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildAudioScript(stop) {
  // `ficha.guion_audio` (ficha 2.0, investigada y redactada para hablarse,
  // ver trips/china-2026/docs) es el guion definitivo cuando existe. Si la
  // parada no tiene ficha rica todavía, se cae a `audio_texto` (guion corto)
  // y por último a concatenar los campos sueltos, para no dejar el audio mudo.
  if (stop.ficha && stop.ficha.guion_audio) return stop.ficha.guion_audio;
  if (stop.audio_texto) return stop.audio_texto;
  const parts = [stop.n];
  if (stop.categoria) parts.push(`Categoría: ${stop.categoria}.`);
  if (stop.mejor_momento) parts.push(stop.mejor_momento);
  if (stop.notas_extra) parts.push(stop.notas_extra);
  return parts.join('. ');
}

// El dispositivo suele arrancar con voces ya cargadas, pero en algunos
// navegadores (sobre todo Chrome) `getVoices()` devuelve vacío la primera
// vez y se rellena de forma asíncrona con el evento `voiceschanged`.
let _voicesCache = null;
function getVoicesReady() {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500); // por si el evento nunca llega
  });
}

// Elige la voz en español que suene menos robótica de las disponibles en
// el dispositivo, en vez de dejar que el navegador use la que le caiga
// por defecto (la causa de esa voz "nerviosa" que sonaba antes).
async function pickSpanishVoice(lang) {
  if (_voicesCache) return _voicesCache;
  const voices = await getVoicesReady();
  const esVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('es'));
  const preferred = ['google', 'mónica', 'monica', 'paulina', 'microsoft', 'helena', 'laura', 'natural'];
  const best =
    esVoices.find((v) => preferred.some((p) => v.name.toLowerCase().includes(p))) ||
    esVoices.find((v) => v.lang.toLowerCase() === (lang || 'es-es').toLowerCase()) ||
    esVoices[0] ||
    null;
  _voicesCache = best;
  return best;
}

// `opts.rate` — velocidad (0.7-1.3). Como el Web Speech API no permite
// cambiar la velocidad de una reproducción ya empezada, un cambio de
// velocidad solo se nota en la siguiente vez que se llama a speak().
// `opts.onstart`/`onend`/`onerror` — eventos reales del motor de voz, para
// que el reproductor sepa de verdad cuándo empieza y termina cada parada
// (nada de simular el avance con un temporizador falso).
async function speak(text, lang, opts) {
  opts = opts || {};
  if (!('speechSynthesis' in window)) {
    console.warn('[geo] Web Speech API no disponible en este navegador.');
    if (opts.onerror) opts.onerror(new Error('Web Speech API no disponible'));
    return false;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang || 'es-ES';
  utter.rate = opts.rate || 0.88;  // más pausado — la voz por defecto sonaba nerviosa/atropellada
  utter.pitch = 1.0;
  const voice = await pickSpanishVoice(lang);
  if (voice) utter.voice = voice;
  if (opts.onstart) utter.onstart = opts.onstart;
  if (opts.onend) utter.onend = opts.onend;
  if (opts.onerror) utter.onerror = opts.onerror;
  window.speechSynthesis.speak(utter);
  return true;
}

function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

class Geofencer {
  constructor({ dataset, state, radiusMeters, onTrigger, onError }) {
    this.dataset = dataset;
    this.state = state;
    this.radius = radiusMeters || 120;
    this.onTrigger = onTrigger;
    this.onError = onError;
    this.watchId = null;
    this.cooldownMs = 5 * 60 * 1000; // no repetir el mismo audio antes de 5 min
  }

  start() {
    if (!('geolocation' in navigator)) {
      this.onError && this.onError(new Error('Geolocalización no disponible en este navegador.'));
      return;
    }
    if (this.watchId != null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._handlePosition(pos),
      (err) => this.onError && this.onError(err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  stop() {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  _handlePosition(pos) {
    const { latitude, longitude } = pos.coords;
    const stops = allStopsWithCoords(this.dataset);
    const now = Date.now();
    for (const stop of stops) {
      const dist = haversineMeters(latitude, longitude, stop.lat, stop.lng);
      if (dist <= this.radius) {
        const last = this.state.audioPlayed[stop.id];
        if (!last || now - last > this.cooldownMs) {
          this.state.audioPlayed[stop.id] = now;
          this.onTrigger && this.onTrigger(stop, dist);
        }
      }
    }
  }
}
