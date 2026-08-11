# Especificación técnica · Copiloto de viaje "Ruta a China"

> Documento de encargo para Codex. Cierra las Fases 1-4 del guion de trabajo. No es negociable en su alcance salvo que el usuario lo reabra explícitamente; sí lo son los detalles de implementación que se dejan a criterio de Codex y se marcan como tal.

---

## 0 · Qué es esto

Una PWA (Progressive Web App) instalable, uso privado de dos personas (Fauri y Antonio), que actúa como copiloto durante un viaje real a China del 25/08 al 10/09/2026. No sustituye a Travel OS (Notion), que sigue siendo la fuente de verdad operativa de reservas y logística — esta app **consume** esa información ya organizada y la convierte en una experiencia de uso en movimiento: agenda, fichas de lugares, mapa y audioguía activada por geolocalización.

No se conecta a Notion en vivo. Se parte de un dataset ya exportado y cerrado (ver sección 2). Si en el futuro se decide sincronizar, será tema aparte, fuera de este encargo.

---

## 1 · Alcance por capas (orden de construcción obligatorio)

Construir en este orden. Cada capa debe funcionar y validarse antes de empezar la siguiente.

### L0 · Agenda
- Vista por día (17 días, 25/08–10/09) y por etapa (7 etapas + días de vuelo).
- Cada parada: nombre, nombre chino, marcar visitado, nota libre.
- Ya existe un prototipo de referencia de esta capa (ver sección 3) — no partir de cero en el diseño de interacción, sí reconstruir el código para el entorno PWA final.

### L1 · Fichas enriquecidas
- Cada parada muestra, cuando el dato exista: categoría, prioridad, estado (Confirmado/Diseñado/Candidato/Visitado), mejor momento del día, notas de planificación.
- Estos campos vienen del dataset ya fusionado (sección 2). No todas las paradas del itinerario tienen ficha enriquecida todavía — mostrar solo lo que exista, sin inventar datos.

### L2 · Mapa interactivo
- Leaflet + OpenStreetMap (sin coste, sin API key).
- Capas activables por etapa y por categoría (Paisaje, Patrimonio, Barrio, Gastronomía, Fotografía, Compras, Logística, Imprescindible).
- Cada parada del día activo se pinta en el mapa con su orden numerado, igual que en los mapas reales de Notion.
- **70 de las 77 paradas ya tienen lat/long en el dataset.** Quedan 7 pendientes (hoteles y puntos genéricos) — resolver con geocodificación antes de dar la capa por cerrada.
- Las coordenadas del dataset son de referencia (Beijing verificado directamente contra Amap; el resto son de fuentes generales). Antes de construir el geofencing de la L3, pasar un script de validación que compare cada coordenada contra un geocoder (Nominatim/OSM es suficiente) y corrija desviaciones grandes.

### L3 · Audioguía por geolocalización
- Al entrar en un radio de ~120 m de una parada marcada, se dispara el audio generado de su ficha. Ajustar el radio si hay paradas muy próximas entre sí (caso Beijing: 4 puntos en pocas manzanas).
- Audio generado por TTS a partir del texto de cada ficha (nombre + notas + motivo), no grabaciones humanas.
- Los audios se generan y se guardan de antemano (no en directo durante el viaje) para que funcionen sin cobertura — China tiene tramos con conectividad limitada (parques naturales, zonas rurales).
- Requiere permisos de geolocalización en segundo plano y Service Worker activo — de ahí que la app deba ser instalable de verdad (ver sección 4).
- Idioma: español (único idioma confirmado; no se pide inglés ni chino en el audio).

### L4 · Logística en capas
- Superponer sobre el mapa/agenda: transporte entre etapas, alojamientos, ventanas de compra de billetes ya identificadas en el dataset (ver `notas_extra` de cada día).
- No requiere sincronizar con las bases de Reservas de Notion en esta fase — se puede añadir manualmente lo que ya está confirmado (ver Documento Maestro y billetes, sección 2).

### L5 · Diario y gastos (modo posterior al viaje)
- Se activa después del viaje: registrar gasto real, fotos, valoración por parada.
- No es prioritario para el lanzamiento antes del 25/08 — puede entregarse en una segunda iteración.

**Objetivo para el 25/08/2026:** L0 + L1 + L2 + L3 funcionando de forma fiable. L4 puede llegar parcial. L5 es posterior.

---

## 2 · Dataset de contenido (fuente única de verdad para el contenido de la app)

Archivo: `master_dataset.json` (adjunto a este encargo).

**Actualización: el dataset ya incluye el contenido narrativo de la L1 y L3, no solo el índice.** 48 de las 77 paradas tienen un objeto `ficha` embebido con: gancho de apertura, contexto histórico, leyenda o historia destacada, qué mirar en el momento, curiosidad, por qué está en la ruta, y el `guion_audio` ya redactado y listo para pasar por TTS (entre 250 y 650 palabras, 2 a 5 minutos hablado). Las paradas que comparten una misma ficha narrativa (por ejemplo, varias paradas de una misma noche en Fenghuang) llevan además el campo `ficha_compartida_con`, indicando el nombre de la ficha original.

Estructura ampliada de cada parada:
```
{
  "id", "n" (nombre), "cn" (nombre chino), "lat", "lng",
  "stage", "opt"?, "tipo"?, "geocode_pending"?,
  "categoria"?, "prioridad"?, "estado"?, "mejor_momento"?,
  "notas_extra"?, "mapa_notion_url"?,
  "ficha"?: {
    "gancho", "contexto_historico", "leyenda", "que_mirar",
    "curiosidad", "por_que_ruta", "dato_clave"?, "guion_audio",
    "tiene_audio_completo", "ficha_compartida_con"?
  }
}
```

Notas de uso:
- `lugares_favoritos_no_incluidos_en_itinerario` son 46 lugares de la base "Lugares y favoritos" de Notion (candidatos, Hong Kong/Macao de referencia futura, etc.) que no están en el itinerario cerrado. No forman parte del itinerario oficial — no mostrarlos en la agenda principal, pero pueden guardarse para una función futura de "añadir parada candidata".
- **29 paradas siguen sin `ficha`** — sobre todo puntos secundarios dentro de un mismo bloque (por ejemplo, paradas sueltas dentro del casco de Fenghuang que ya comparten contexto con la ficha principal de esa noche, o partes menores de mercados en Shenzhen/Guangzhou). Para el lanzamiento, estas paradas se muestran en la app solo con nombre y nombre chino — sin sección de historia ni botón de audio — y no bloquean el criterio de "hecho" de la L1/L3, que se cumple con las paradas principales.
- Cualquier parada nueva que se añada durante el viaje (la app debe permitir esto, igual que el prototipo) entra sin `ficha` — el campo es opcional en el modelo de datos, nunca obligatorio.
- Fuente completa de las 35 fichas redactadas, con las 9 secciones originales (incluyendo curiosidades y justificación completa por lugar) en `Ficha_lugar_plantilla_y_piloto.md`, adjunto también. `master_dataset.json` contiene la versión ya estructurada y lista para consumir por código; el .md es la referencia legible para revisión humana.

---

## 3 · Prototipo de referencia (no es la base de código final)

Adjunto: `ruta_china_agenda.html`. Es un artifact autocontenido de claude.ai — usa `window.storage`, que **no existe fuera de claude.ai**. Sirve solo como:
- Referencia de interacción para la capa L0 (navegación por día, marcar visitado, notas, añadir parada).
- Referencia de tono visual (paleta, tipografía) — no obligatoria, Codex puede proponer dirección visual propia siempre que sea coherente y cuidada.

No portar el código tal cual. Reescribir sobre la arquitectura real de la sección 4.

---

## 4 · Arquitectura técnica

- **Tipo de proyecto:** PWA instalable. `manifest.json` + Service Worker obligatorios desde el primer commit.
- **Hosting:** requiere HTTPS real (la geolocalización y el Service Worker no funcionan sobre HTTP ni sobre el entorno de artifacts de claude.ai). Elegir el proveedor de hosting es decisión de Codex/usuario en el momento de desplegar — no se fija aquí.
- **Almacenamiento local:** IndexedDB (no `localStorage` para el dataset completo, por volumen de audios cacheados). Debe funcionar offline.
- **Mapa:** Leaflet + tiles de OpenStreetMap.
- **Geolocalización:** Geolocation API + lógica de geofencing propia (comparar posición actual contra lat/long de cada parada, radio configurable).
- **TTS:** a decidir por Codex entre Web Speech API (gratis, sin backend, calidad variable) o un servicio de síntesis en la nube con audios pre-generados y cacheados (mejor calidad y funciona offline, tiene coste). Dado el requisito de funcionar sin cobertura, **se recomienda pre-generar y cachear los audios**, no generarlos en directo con Web Speech API.
- **Sin backend propio obligatorio** salvo que se elija un servicio de TTS en la nube que lo requiera para la generación previa de audios.

---

## 5 · Fuentes originales (para contexto, no para que Codex las consulte directamente)

- Notion "Travel OS · Ruta a China" — sistema operativo del viaje real, no tocar.
- Notion "Itinerario cerrado · app Ruta a China" — origen del itinerario de 77 fichas.
- Notion "Lugares y favoritos · Ruta China" — origen del enriquecimiento (categoría/prioridad/estado).
- Notion "Mapa y favoritos" y páginas "Mapa real" por día — origen de las coordenadas verificadas.
- Google Drive: Documento Maestro v1, billete Air China (localizador E6DSEJ).

Todo esto ya está resumido y volcado en `master_dataset.json`; Codex no necesita acceso a Notion ni Drive para este encargo.

---

## 6 · Criterios de "hecho" antes del 25/08/2026

- [ ] La app se instala desde el navegador móvil (Añadir a pantalla de inicio) y abre sin conexión.
- [ ] Las 17 jornadas y 77 paradas se navegan correctamente (L0).
- [ ] Las fichas muestran el enriquecimiento y el contenido narrativo disponible (48 de 77 paradas) sin romper cuando falta (L1).
- [ ] El mapa pinta las paradas del día activo con capas por categoría (L2).
- [ ] Al simular la llegada a una parada con `guion_audio` disponible (o físicamente, en pruebas de campo), se dispara su audio generado por TTS (L3).
- [ ] Las 7 coordenadas pendientes están resueltas o explícitamente descartadas con motivo.
- [ ] Los audios de las 48 paradas con `guion_audio` están pregenerados y cacheados antes del viaje — no se generan en directo.
- [ ] Funciona sin cobertura de datos una vez instalada y con contenido cacheado.

---

## 7 · Fuera de alcance explícito de este encargo

- Sincronización en vivo con Notion.
- Publicación pública o multiusuario más allá de Fauri y Antonio.
- L4 completo (logística) y L5 (diario/gastos) — se abordan después del lanzamiento inicial.
- Traducción del audio a otros idiomas.
