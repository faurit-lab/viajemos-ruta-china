# Viajemos — guion para diseño

App genérica de copiloto de viaje (móvil, PWA). Un viaje activo a la vez,
contenido intercambiable. 5 pestañas fijas abajo, todas comparten un mismo
estado (visitado, notas, día activo).

## Las 5 pestañas (nav inferior)

1. **Hoy** — pantalla de entrada. Qué toca ahora: próxima parada, progreso
   del día, alertas, cifras del día, alojamiento/próximo traslado.
2. **Agenda** — los días del viaje en orden, cada uno con su lista de
   paradas (fichas compactas).
3. **Mapa** — las paradas del día activo sobre Leaflet/OSM, con capas por
   categoría.
4. **Logística** — vuelos, traslados y alojamiento por etapa.
5. **Audioguía** — activar/desactivar geolocalización, radio de disparo,
   log de actividad.

## La ficha (unidad central — vive en 3 tamaños)

1. **Fila de agenda** (compacta): nombre + nombre local, círculo de
   visitado, etiquetas (categoría/prioridad/estado si existen), acciones
   rápidas (nota, audio, mapa).
2. **Popup de mapa** (mínima): nombre + categoría + botón de audio.
3. **Ficha detallada** (overlay a pantalla completa): la misma parada con
   todo — foto o color por etapa, meta completo, nota editable, guion de
   audioguía, y navegación ◀ ▶ a la parada anterior/siguiente **del viaje
   entero**, no solo del día.

Las tres muestran la misma parada — son distintos niveles de zoom sobre el
mismo dato, no fichas independientes.

## Cómo se enlazan entre sí

- Tocar una fila de agenda → abre la ficha detallada.
- Ficha detallada → "Ver en el mapa" → cambia a la pestaña Mapa, centra y
  abre el popup de esa parada.
- Ficha detallada → "Escuchar audioguía" → reproduce voz (aquí también
  desde el popup de mapa y desde la tarjeta "próxima parada" de Hoy).
- Ficha detallada → ◀ ▶ → salta a la parada anterior/siguiente, cambiando
  de día de fondo si hace falta.
- Etiqueta de etapa (franja superior de Agenda) → salta al primer día de
  esa etapa.
- Hoy → "próxima parada" y lista "Después" → abren la misma ficha detallada.
- Marcar visitado desde cualquier sitio (fila, ficha, Hoy) actualiza los
  tres a la vez.

## Estado que se comparte en todas partes

Visitado, notas, radio de audioguía, día activo — es el mismo dato en las
5 pestañas, nunca una copia local por pantalla.

## Lo que de verdad necesita ojo de diseño ahora

- **Paleta más clara** (pedido explícito — el "Manifiesto de viaje" actual
  quedó bien pero demasiado oscuro/saturado).
- Iconografía del nav inferior (hoy son emoji de marcador de posición).
- Cómo se ve una ficha SIN foto vs CON foto (ambos casos son reales).
- Jerarquía visual dentro de la ficha detallada: hay bastante información
  apilada (meta, nota, acciones, guion de audio, navegación) — cómo
  respira.

## Lo que NO hace falta rediseñar

La estructura/interacción ya está cerrada y probada (agenda ↔ mapa ↔
audioguía ↔ logística ↔ Hoy) — esto es piel, no esqueleto.
