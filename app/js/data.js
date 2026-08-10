// Viajemos · Carga y normalización del dataset
// Fuente única de verdad: data/master_dataset.json (ver docs/Especificacion_tecnica_para_Codex.md, sección 2)

const CATEGORIES = ['Paisaje', 'Patrimonio', 'Barrio', 'Gastronomía', 'Fotografía', 'Compras', 'Logística', 'Imprescindible'];

const STAGE_COLORS = {
  0: '#6B6255', 1: '#B23A2E', 2: '#3E6459', 3: '#B98A2E',
  4: '#B23A2E', 5: '#3E6459', 6: '#B98A2E', 7: '#B23A2E'
};

let DATASET = null;

async function loadDataset() {
  if (DATASET) return DATASET;
  const res = await fetch('./data/master_dataset.json');
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

function formatDateShort(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
