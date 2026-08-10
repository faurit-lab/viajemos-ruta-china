#!/usr/bin/env node
// Viajemos · activa un viaje: copia trips/<nombre>/trip.json a app/data/trip.json
// (el archivo que la PWA carga en tiempo de ejecución).
//
// Uso:
//   node scripts/activar-viaje.js china-2026
//
// Para dar de alta un viaje nuevo (Italia, Francia...): crea
// trips/<nombre>/trip.json con el mismo esquema (ver README.md), y opcional
// -mente trips/<nombre>/docs/ y trips/<nombre>/prototype/ si aplica.

const fs = require('fs');
const path = require('path');

const nombre = process.argv[2];
if (!nombre) {
  console.error('Uso: node scripts/activar-viaje.js <nombre-del-viaje>');
  const disponibles = fs.readdirSync(path.join(__dirname, '..', 'trips'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  console.error('Viajes disponibles en trips/:', disponibles.join(', ') || '(ninguno)');
  process.exit(1);
}

const origen = path.join(__dirname, '..', 'trips', nombre, 'trip.json');
const destino = path.join(__dirname, '..', 'app', 'data', 'trip.json');

if (!fs.existsSync(origen)) {
  console.error(`No existe ${origen}`);
  process.exit(1);
}

fs.copyFileSync(origen, destino);
const data = JSON.parse(fs.readFileSync(destino, 'utf8'));
console.log(`✅ Activado "${nombre}" → app/data/trip.json`);
console.log(`   ${data.app_titulo || data.proyecto} · ${data.dias.length} días · ${data.dias.reduce((a, d) => a + d.stops.length, 0)} paradas`);
console.log('   Recuerda actualizar app/manifest.json (name/description) y hacer commit + push.');
