// Viajemos · Carga y normalización del dataset
// Fuente única de verdad: data/trip.json — un solo viaje activo a la vez.
// Para reutilizar la app en otro viaje (Italia, Francia...) basta con
// sustituir este archivo por uno con la misma estructura (ver
// docs/Especificacion_tecnica_para_Codex.md, sección 2, y el README) —
// nada del resto del código asume que el viaje es a China.

const CATEGORIES = ['Paisaje', 'Patrimonio', 'Barrio', 'Gastronomía', 'Fotografía', 'Compras', 'Logística', 'Imprescindible'];

const STAGE_COLORS = {
  0: '#6B6255', 1: '#B23A2E', 2: '#3E6459', 3: '#B98A2E',
  4: '#B23A2E', 5: '#3E6459', 6: '#B98A2E', 7: '#B23A2E'
};

let DATASET = null;

async function loadDataset() {
  if (DATASET) return DATASET;
  const res = await fetch('./data/trip.json');
  const raw = await res.json();

  // Asigna id secuencial estable de respaldo si falta, y precalcula la etapa efectiva.
  raw.dias.forEach((day, di) => {
    day._index = di;
    day.stops.forEach((s, si) => {
      if (!s.id) s.id = `d${di}-s${si}`;
      s._stage = (typeof s.stage === 'number') ? s.stage : day.stage;
      s._dayIndex = di;
    });
  });

  DATASET = raw;
  return raw;
}

function allStopsWithCoords(dataset) {
  const out = [];
  dataset.dias.forEach((day) => {
    day.stops.forEach((s) => {
      if (typeof s.lat === 'number' && typeof s.lng === 'number') {
        out.push(s);
      }
    });
  });
  return out;
}

function findStopById(dataset, id) {
  for (const day of dataset.dias) {
    const found = day.stops.find((s) => s.id === id);
    if (found) return found;
  }
  return null;
}

// Secuencia plana de todas las paradas reales del itinerario, en el orden
// en que aparecen día a día — es la "capa itinerario" que conecta ficha,
// mapa y audioguía: permite navegar "anterior/siguiente parada" sin
// importar en qué día del viaje esté cada una.
let SEQUENCE_CACHE = null;
function buildSequence(dataset) {
  if (SEQUENCE_CACHE) return SEQUENCE_CACHE;
  const seq = [];
  dataset.dias.forEach((day) => {
    day.stops.forEach((s) => seq.push(s));
  });
  SEQUENCE_CACHE = seq;
  return seq;
}

// Viajemos · L4 — Logística en capas
// Agrupa por etapa lo que YA existe en el dataset (traslados y alojamientos
// marcados con tipo:"alojamiento"). No inventa hoteles ni ventanas de
// compra que no estén en el dataset — donde falte, se marca explícitamente
// como pendiente en vez de rellenar con datos supuestos.
function buildLogistics(dataset) {
  const stages = Object.keys(dataset.etapas).map(Number).sort((a, b) => a - b);
  return stages.map((stageNum) => {
    const stageDays = dataset.dias.filter((d) => d.stage === stageNum);
    const travelNotes = stageDays.filter((d) => d.travel && d.note).map((d) => ({ date: d.date, dow: d.dow, note: d.note }));
    const accommodations = [];
    stageDays.forEach((day) => {
      day.stops.forEach((s) => {
        if (s.tipo === 'alojamiento') accommodations.push({ date: day.date, stop: s });
      });
    });
    return {
      stageNum,
      stageName: dataset.etapas[stageNum],
      // Días de itinerario asignados a esta etapa (no es lo mismo que
      // "noches de hotel": algunos días de traslado no implican pernocta
      // en el destino de llegada — evitamos inferir noches sin dato explícito).
      dayCount: stageNum === 0 ? 0 : stageDays.length,
      travelNotes,
      accommodations
    };
  });
}

// Viajemos · "Hoy" — panel de entrada, lo que toca ahora mismo.
// Todo lo de aquí sale de datos que ya existen; nada se inventa. Lo que
// necesitaría datos nuevos (horarios de apertura, cómo llegar, gasto
// previsto) o un servicio externo (tiempo meteorológico) queda fuera a
// propósito — ver docs/Pendientes.

function haversineKm(lat1, lng1, lat2, lng2) {
  return haversineMeters(lat1, lng1, lat2, lng2) / 1000;
}

// Suma la distancia en línea recta entre paradas consecutivas del día que
// tengan coordenadas — aproximado (no es ruta real a pie), pero derivado
// de datos reales, no un número inventado.
function dayWalkingKm(day) {
  const withCoords = day.stops.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number');
  let km = 0;
  for (let i = 1; i < withCoords.length; i++) {
    km += haversineKm(withCoords[i - 1].lat, withCoords[i - 1].lng, withCoords[i].lat, withCoords[i].lng);
  }
  return km;
}

// Estima minutos de audioguía sumando las palabras de audio_texto de las
// paradas del día, a un ritmo de habla pausado (~130 palabras/min, acorde
// con la velocidad de voz configurada en geo.js).
function dayAudioMinutes(day) {
  const words = day.stops.reduce((acc, s) => {
    const guion = (s.ficha && s.ficha.guion_audio) || s.audio_texto;
    return acc + (guion ? guion.split(/\s+/).length : 0);
  }, 0);
  return Math.round(words / 130);
}

// FIJO / FLEXIBLE / OPCIONAL — derivado de campos que ya existen (opt,
// estado), no un dato nuevo que haya que rellenar a mano.
function deriveStopBadge(stop) {
  if (stop.opt) return 'OPCIONAL';
  if (stop.estado === 'Confirmado') return 'FIJO';
  return 'FLEXIBLE';
}

function nextUnvisitedStop(day, doneMap) {
  return day.stops.find((s) => !doneMap[s.id]) || null;
}

// Busca el alojamiento vigente a partir de un día: primero mira si el
// propio día tiene una parada tipo "alojamiento"; si no, mira hacia atrás
// en la misma etapa (el hotel se reserva el día de llegada y se usa varias
// noches sin repetirse cada día en el dataset).
function findCurrentAccommodation(dataset, dayIndex) {
  const stage = dataset.dias[dayIndex].stage;
  for (let i = dayIndex; i >= 0; i--) {
    const day = dataset.dias[i];
    if (day.stage !== stage) break;
    const found = day.stops.find((s) => s.tipo === 'alojamiento');
    if (found) return found;
  }
  return null;
}

// Próximo día con traslado (travel:true) a partir de dayIndex, inclusive.
function nextTravelDay(dataset, dayIndex) {
  for (let i = dayIndex; i < dataset.dias.length; i++) {
    if (dataset.dias[i].travel) return dataset.dias[i];
  }
  return null;
}

// Cuenta días de calendario entre dos fechas ISO (solo fecha, no hora —
// por eso es "N días", no una cuenta atrás exacta en horas).
function daysBetween(isoFrom, isoTo) {
  const a = new Date(isoFrom + 'T00:00:00');
  const b = new Date(isoTo + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Alertas automáticas: derivadas de paradas opcionales/candidatas del día
// (dependen de tiempo/energía) y de notas que mencionan entradas o franjas
// horarias sin confirmar todavía — no se inventa ningún texto, solo se
// resalta lo que ya está escrito en el dataset.
const ALERT_KEYWORDS = ['pendiente', 'pendientes', 'sin abrir', 'franja horaria', 'apertura', 'sale a la venta'];
function deriveAlerts(day) {
  const alerts = [];
  day.stops.forEach((s) => {
    if ((s.opt || s.estado === 'Candidato') && s.notas_extra) {
      alerts.push({ title: `${s.n} depende de la energía/tiempo`, reason: s.notas_extra });
    } else if (s.notas_extra && ALERT_KEYWORDS.some((k) => s.notas_extra.toLowerCase().includes(k))) {
      alerts.push({ title: `${s.n}: revisar antes de ir`, reason: s.notas_extra });
    }
  });
  return alerts;
}

function sequenceNeighbors(dataset, stopId) {
  const seq = buildSequence(dataset);
  const idx = seq.findIndex((s) => s.id === stopId);
  if (idx === -1) return { prev: null, next: null, index: -1, total: seq.length };
  return {
    prev: idx > 0 ? seq[idx - 1] : null,
    next: idx < seq.length - 1 ? seq[idx + 1] : null,
    index: idx,
    total: seq.length
  };
}

// Escapa texto libre (notas escritas por el usuario) antes de interpolarlo
// en HTML — sin esto, una nota con "<" o "</div>" rompía el layout de la
// ficha o de la agenda.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDateShort(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const MONTH_NAMES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function formatDateLong(iso, withYear) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_NAMES_ES[m - 1]}${withYear ? ' ' + y : ''}`;
}
