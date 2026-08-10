# Viajemos

Copiloto de viaje: PWA instalable, uso privado, que combina agenda por días,
fichas de lugares, mapa interactivo, audioguía por geolocalización y
logística en un solo sitio. **El código (`app/`) es genérico — no es una app
de China.** El viaje concreto vive entero en `app/data/trip.json`; para
reutilizarla en otro viaje (Italia, Francia, el que sea) se sustituye ese
archivo y un par de líneas de branding, sin tocar el resto del código.

Proyecto independiente. No forma parte de Travel-OS/Audioguía.

## Cómo reutilizar la app para otro viaje

Todo el contenido específico de un viaje vive en estos archivos — son los
únicos que hay que tocar para "instalar" un viaje nuevo:

1. **`app/data/trip.json`** — el contenido: título, viajeros, fechas, etapas,
   días, paradas. Mismo esquema que el actual (ver sección siguiente).
2. **`app/manifest.json`** — `name` y `description` (el navegador los lee
   antes de que cargue el JS, por eso no pueden salir del dataset).
3. **`app/icons/icon-192.png` y `icon-512.png`** — opcional, si se quiere un
   icono distinto al genérico actual.

Todo lo demás (agenda, mapa, audioguía, logística, ficha detallada, Service
Worker) ya lee el título, las fechas, el número de jornadas/etapas y las 77
paradas directamente del JSON — no hay ningún "Ruta a China" quemado en el
HTML ni en el JS de `app/`.

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
          "notas_extra"?, "audio_texto"?, "geocode_pending"? }
      ]
    }
  ],
  "lugares_sin_geolocalizar"?, "lugares_favoritos_no_incluidos_en_itinerario"?
}
```

Todos los campos de una parada salvo `id` y `n` son opcionales — la app no
rompe si faltan (ver L1 en la especificación técnica).

## Estructura del repo

- `app/` — la PWA en sí (genérica, ver arriba).
- `data/master_dataset.json` — dataset **fuente** de este viaje (Ruta a
  China), el que se edita y desde el que se copia a `app/data/trip.json`.
- `docs/` — guion de trabajo, especificación técnica, guion de pendientes.
- `prototype/` — prototipo de referencia de la capa L0, histórico, no es
  base de código.

## Punto de restauración

**`v1.0-estable`** (10/08/2026, commit `009a87e`) — versión confirmada por el
usuario tras probarla en el móvil, previa a la genericación del código.

```bash
git checkout v1.0-estable -- .
```

o para volver del todo a ese punto: `git reset --hard v1.0-estable`
(perdería los commits posteriores, usar con cuidado).

## App en producción (viaje actual: Ruta a China)

**https://faurit-lab.github.io/viajemos-ruta-china/**

Repo público (necesario para GitHub Pages gratis) — contiene fechas, vuelos y
localizador de billete del viaje. Desplegado automáticamente en cada push a
`main` vía `.github/workflows/deploy-pages.yml`.

## Estado

L0 Agenda, L1 Fichas enriquecidas, L2 Mapa (Leaflet), L3 Audioguía por
geolocalización (TTS con Web Speech API) y L4 Logística (parcial) —
funcionando. L5 Diario sin empezar (previsto para después del viaje).

Geocodificación: 76 de 77 paradas resueltas vía Nominatim/OSM. Solo queda
`Wulong Village y Tianbo Mansion` (parada opcional) pendiente de verificación
manual — ver `geocode_note` en `data/master_dataset.json`.

Pendiente: rediseño visual (aparcado a propósito hasta cerrar lo funcional).
