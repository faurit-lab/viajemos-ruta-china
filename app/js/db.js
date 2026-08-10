// Viajemos · IndexedDB wrapper
// Almacena estado local: visitas, notas, paradas añadidas a mano,
// ajustes y (a futuro) audios TTS pregenerados en caché.

const DB_NAME = 'viajemos-db';
const DB_VERSION = 1;
const STORES = ['kv', 'audioCache'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(store, key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const STATE_KEY = 'state';

const DEFAULT_STATE = {
  done: {},        // stopId -> bool (visitado)
  notes: {},        // stopId -> texto libre
  custom: {},       // dayIndex -> [ {id, n, cn, categoria...} ] paradas añadidas en el viaje
  audioPlayed: {},  // stopId -> timestamp del último disparo de audio por geofencing
  settings: {
    geofenceRadius: 120,   // metros, ver spec L3 (ajustar en Beijing si hace falta)
    ttsLang: 'es-ES',
    geoEnabled: false
  }
};

async function loadState() {
  const saved = await idbGet('kv', STATE_KEY);
  if (!saved) return structuredClone(DEFAULT_STATE);
  // merge por si se añaden campos nuevos en versiones futuras
  return {
    ...structuredClone(DEFAULT_STATE),
    ...saved,
    settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) }
  };
}

async function saveState(state) {
  await idbSet('kv', STATE_KEY, state);
}

// Caché de audio pregenerado (futuro): guarda un Blob de audio por stopId.
async function getCachedAudio(stopId) {
  return idbGet('audioCache', stopId);
}
async function setCachedAudio(stopId, blob) {
  return idbSet('audioCache', stopId, blob);
}
