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
