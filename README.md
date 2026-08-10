# Viajemos · Copiloto "Ruta a China"

Proyecto independiente. No forma parte de Travel-OS/Audioguía.

PWA instalable de uso privado (Fauri & Antonio) que actúa como copiloto durante
el viaje a China del 25/08 al 10/09/2026: agenda, fichas de lugares, mapa y
audioguía activada por geolocalización. Consume un dataset ya exportado y
cerrado desde Notion — no sincroniza en vivo.

## Estructura

- `docs/Guion_de_trabajo_app_Ruta_a_China.md` — constitución del proyecto:
  fases, decisiones cerradas, estado actual.
- `docs/Especificacion_tecnica_para_Codex.md` — encargo técnico cerrado
  (Fases 1-4): alcance por capas (L0-L5), arquitectura, criterios de "hecho".
- `data/master_dataset.json` — dataset único de contenido: 17 días, 77
  paradas (70 con coordenadas), lugares favoritos no incluidos en el
  itinerario.
- `prototype/ruta_china_agenda.html` — prototipo de referencia de la capa L0
  (interacción/tono visual). No es base de código — usa `window.storage`,
  exclusivo de claude.ai.

## App en producción

**https://faurit-lab.github.io/viajemos-ruta-china/**

Repo público (necesario para GitHub Pages gratis) — contiene fechas, vuelos y
localizador de billete del viaje. Desplegado automáticamente en cada push a
`main` vía `.github/workflows/deploy-pages.yml`.

## Estado

Fases 1-4 cerradas. **Fase 5 (ejecución) en curso**, construida directamente
en `app/` (no por Codex): L0 Agenda, L1 Fichas enriquecidas, L2 Mapa (Leaflet)
y L3 Audioguía por geolocalización (TTS con Web Speech API) funcionando.
L4 Logística parcial. L5 Diario sin empezar (previsto para después del viaje).

Geocodificación: 76 de 77 paradas resueltas vía Nominatim/OSM. Solo queda
`Wulong Village y Tianbo Mansion` (parada opcional) pendiente de verificación
manual — ver `geocode_note` en `data/master_dataset.json`.

Pendiente: prueba de campo en móvil real (instalar, permisos de
geolocalización, radio de geofencing) y rediseño visual.
