# Viajemos

Copiloto de viaje: PWA instalable, uso privado, que combina agenda por días,
fichas de lugares, mapa interactivo, audioguía por geolocalización y
logística en un solo sitio. **El código (`app/`) es genérico.** Cada viaje
concreto es un paquete de datos independiente en `trips/`; activar uno es
copiar su `trip.json` a `app/data/trip.json` y desplegar — nada más cambia.

Proyecto independiente. No forma parte de Travel-OS/Audioguía.

## Estructura del repo

```
Viajemos/
├── app/                    ← la PWA (genérica, sin nada de un viaje concreto)
│   └── data/trip.json      ← copia del viaje ACTIVO (la app solo lee esto)
├── trips/                  ← un paquete de datos por viaje
│   └── china-2026/
│       ├── trip.json       ← fuente de verdad de este viaje
│       ├── docs/           ← guion de trabajo, spec técnica, pendientes
│       └── prototype/      ← prototipo de referencia (histórico, no es código base)
└── scripts/
    └── activar-viaje.js    ← copia trips/<nombre>/trip.json → app/data/trip.json
```

`app/` no sabe nada de China, Italia ni de ningún viaje concreto — todo el
título, fechas, itinerario y paradas salen de `app/data/trip.json` en
tiempo de ejecución (ver `app/js/data.js` y `renderHero()`/`renderHoy()`
en `app/js/app.js`).

## Cómo dar de alta un viaje nuevo

1. Crea `trips/<nombre>/trip.json` con el mismo esquema que
   `trips/china-2026/trip.json` (ver más abajo). Opcionalmente,
   `trips/<nombre>/docs/` y `trips/<nombre>/prototype/` si aplica.
2. Actívalo:
   ```bash
   node scripts/activar-viaje.js <nombre>
   ```
3. Actualiza `app/manifest.json` (`name` y `description` — el navegador los
   lee antes de que cargue el JS, por eso no pueden salir del dataset) y,
   si quieres, `app/icons/*.png`.
4. `git add -A && git commit -m "Activar viaje: <nombre>" && git push` —
   el despliegue a GitHub Pages es automático.

El viaje anterior no se pierde: sigue en `trips/<nombre-anterior>/`, listo
para reactivarse cuando toque.

### Esquema de `trip.json`

```
{
  "proyecto", "app_titulo", "app_titulo_local" (opcional, texto en el idioma
    local — dejar "" si no aplica),
  "viajeros": [...], "fechas": { "inicio", "fin", "noches" },
  "vuelos_internacionales", "etapas": { "0": "...", "1": "...", ... },
  "dias": [
    { "date", "dow", "stage", "stage_name", "title", "travel"?, "note"?,
      "stops": [
        { "id", "n", "cn"?, "lat"?, "lng"?, "stage"?, "opt"?, "tipo"?,
          "categoria"?, "prioridad"?, "estado"?, "mejor_momento"?,
          "notas_extra"?, "audio_texto"?, "imagen"?, "galeria"?,
          "geocode_pending"? }
      ]
    }
  ],
  "lugares_sin_geolocalizar"?, "lugares_favoritos_no_incluidos_en_itinerario"?
}
```

Todos los campos de una parada salvo `id` y `n` son opcionales — la app no
rompe si faltan (ver L1 en la especificación técnica, dentro de cada
`trips/<viaje>/docs/`).

**Multimedia:** `imagen` (foto de cabecera de la ficha) y `galeria` (array
de fotos adicionales) son opcionales — sin ellas, la ficha muestra la banda
de color por etapa, como ahora. El Service Worker las cachea solas la
primera vez que se cargan, no hace falta tocar `sw.js`.

## Puntos de restauración

Cada hito importante queda marcado con un tag de git — para volver a uno:

```bash
git checkout <tag> -- .
```

o para volver del todo (pierde los commits posteriores, cuidado):
`git reset --hard <tag>`

- **`v1.3-estructura-viajes`** (10/08/2026) — reorganización en `trips/`,
  script `activar-viaje.js`, pantalla "Hoy" añadida.
- `v1.2-diseno-manifiesto` — dirección visual "Manifiesto de viaje" aplicada.
- `v1.1-generico` — shell sin nada de China hardcodeado, soporte multimedia.
- `v1.0-estable` — primera versión probada en móvil, previa a la genericación.

## App en producción (viaje activo: Ruta a China)

**https://faurit-lab.github.io/viajemos-ruta-china/**

Repo público (necesario para GitHub Pages gratis) — contiene fechas, vuelos y
localizador de billete del viaje. Desplegado automáticamente en cada push a
`main` vía `.github/workflows/deploy-pages.yml`.

## Estado

Hoy (panel de entrada), Agenda (L0+L1), Mapa (L2), Audioguía por
geolocalización (L3, TTS con Web Speech API) y Logística (L4, parcial) —
funcionando. Alertas automáticas derivadas del dataset. Diario (L5) sin
empezar (previsto para después del viaje).

Geocodificación: 76 de 77 paradas resueltas vía Nominatim/OSM. Solo queda
`Wulong Village y Tianbo Mansion` (parada opcional) pendiente de
verificación manual — ver `geocode_note` en `trips/china-2026/trip.json`.

Pendiente: rediseño visual — el usuario pidió tonos más claros que el actual
(feedback del 10/08, sesión noche, todavía no aplicado); tiempo
meteorológico en vivo (servicio externo, al final); horarios de apertura,
cómo llegar y gasto previsto (necesitan datos nuevos, no inventados).
