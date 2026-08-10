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
  const parts = [stop.n];
  if (stop.categoria) parts.push(`Categoría: ${stop.categoria}.`);
  if (stop.mejor_momento) parts.push(stop.mejor_momento);
  if (stop.notas_extra) parts.push(stop.notas_extra);
  return parts.join('. ');
}

function speak(text, lang) {
  if (!('speechSynthesis' in window)) {
    console.warn('[geo] Web Speech API no disponible en este navegador.');
    return false;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang || 'es-ES';
  utter.rate = 0.98;
  window.speechSynthesis.speak(utter);
  return true;
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
