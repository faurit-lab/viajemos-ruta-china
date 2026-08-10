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

## Estado

Fases 1-4 cerradas. **Fase 5 (ejecución) lista para arrancar**: construir la
PWA real siguiendo la especificación técnica, en el orden de capas L0→L5.

Pendiente antes de dar la Fase 5 por cerrada: resolver las 7 coordenadas sin
geocodificar (ver `lugares_sin_geolocalizar` en el dataset).
