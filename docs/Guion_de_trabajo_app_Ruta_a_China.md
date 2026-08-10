# Guion de trabajo · App paralela "Ruta a China"

> Documento vivo. Sirve de constitución del proyecto: qué vamos a construir, en qué orden, y cuándo pasa el testigo a Codex. No se entrega nada a Codex hasta cerrar la Fase 4.

---

## 0 · Principio rector

Travel OS (Notion) sigue siendo la fuente de verdad operativa del viaje real. La app paralela **lee y reorganiza** esa información para un uso distinto (agenda ágil, fichas de lugares, posible mapa) pero **no escribe nunca en Notion** y no compite con Travel OS. Si en el futuro hace falta sincronizar algo, será en un solo sentido: Notion → app.

---

## 1 · Inventario de fuentes ya localizadas

| Fuente | Contenido | Estado |
|---|---|---|
| Notion · Itinerario cerrado (26/08–09/09) | 7 etapas, 76 fichas, orden fijo de lugares por día | ✅ volcado ya en la agenda actual (artifact) |
| Notion · Base **"Lugares y favoritos · Ruta China"** | Ficha rica por lugar: Categoría, Nombre chino, Mejor momento, Mapa (URL), Nodo, Estado, Prioridad, Notas, Público (checkbox) | 🟡 localizada, **pendiente de extraer fila por fila** |
| Notion · Guías privadas por destino (Beijing 2.0, Zhangjiajie/Wulingyuan, Fenghuang, Chongqing, Yangshuo/Guilin, Guangzhou, Shenzhen) | Contenido narrativo/logístico por destino | 🟡 localizadas, sin leer en detalle todavía |
| Notion · "Mapa y favoritos" | Mapa real con numeración propia por día | 🟡 localizada, sin extraer coordenadas |
| Notion · Agenda diaria / Tareas y decisiones / Reservas | Estado operativo real (reservas, pendientes) | 🟡 disponible si se decide reflejar estado de reservas en la app |
| Google Drive · Documento Maestro v1 (.docx) | Filosofía del viaje, datos generales, nodos | ✅ ya incorporado al resumen |
| Google Drive · billete Air China (PDF) | Vuelos, localizador E6DSEJ, pasajeros | ✅ ya incorporado |

**Conclusión:** lo que falta de verdad antes de programar nada más es volcar la base **"Lugares y favoritos"** completa (probablemente ~76+ filas) con sus campos de categoría/prioridad/estado/nombre chino/mapa. Es el dato que le da profundidad real a la app (hoy la agenda solo tiene nombre + nombre chino + opcional).

---

## 1bis · Visión de producto: copiloto de viaje por capas

No es solo una agenda. Es un **copiloto de viaje**: la app detecta dónde estás y activa contenido — empezando por audio — al llegar a cada lugar ya fichado. Se construye por capas, cada una apoyada en la anterior. No hay que construirlas todas de golpe; el orden importa porque cada capa depende de que la anterior esté sólida.

| Capa | Qué añade | Depende de |
|---|---|---|
| **L0 · Agenda** | Itinerario por día, marcar visitado, notas (ya existe, prototipo actual) | — |
| **L1 · Fichas enriquecidas** | Categoría, nombre chino, prioridad, estado, mejor momento, notas — el dataset ya extraído de "Lugares y favoritos" | L0 |
| **L2 · Mapa interactivo** | Cada lugar con coordenadas reales, capas por etapa/categoría, ruta del día | L1 (necesita lat/long por lugar, hoy no la tenemos — solo URLs de mapa de Notion) |
| **L3 · Audioguía por geolocalización** | Al entrar en el radio de un lugar marcado, se dispara el audio de su ficha | L2 (necesita las coordenadas del mapa) + contenido de audio por lugar |
| **L4 · Logística en capas** | Transporte, alojamiento, reservas, horarios — superpuesto al mapa/agenda | L1, puede ir en paralelo a L2/L3 |
| **L5 · Diario y gastos** | Registro real de visitas, fotos, gasto, valoraciones — modo "después del viaje" | L0/L1, se activa al final |

**Implicación técnica importante de la L3:** disparar audio por geolocalización en segundo plano de forma fiable normalmente requiere una **app instalable real** (PWA con permisos de ubicación en background, o app nativa) — un artifact web de pestaña abierta no puede despertar por geofencing si el móvil está bloqueado o la pestaña en segundo plano. Esto condiciona el "cómo se usa" y hay que decidirlo antes de especificar la L3.

**Contenido de audio:** hay que decidir si el audio se genera (texto a voz a partir de las fichas y notas ya recopiladas) o se graba a mano. Genera menos trabajo pero conviene decidirlo pronto porque cambia el formato de dato de cada ficha (texto guion vs archivo de audio).

## 2 · Fases del proyecto

### Fase 1 · Consolidación de datos — ✅ CERRADA (10/08/2026)
- Extraídas las 63 filas de "Lugares y favoritos · Ruta China" (Notion) con sus 9 campos completos.
- Dataset guardado en `lugares_y_favoritos.json`.
- **Reparto por nodo:** Zhangjiajie/Wulingyuan 12 · Guangzhou 9 · Beijing 8 · Chongqing 8 · Hong Kong 6 · Yangshuo/Guilin 6 · Macao 5 · Shenzhen 5 · Fenghuang 4.
- **Reparto por estado:** Diseñado 46 · Candidato 9 · Confirmado 8. (Ninguna marcada aún como Visitado — normal, el viaje no ha empezado.)
- **Reparto por categoría:** Barrio 15 · Fotografía 12 · Patrimonio 12 · Paisaje 11 · Gastronomía 6 · Imprescindible 5 · Compras 2.
- **Reparto por prioridad:** Especial 27 · Máxima 25 · Normal 7 · Opcional 4.
- **Aviso importante:** 11 de las 63 fichas pertenecen a Hong Kong y Macao, que el itinerario cerrado (Fase 0) ya excluyó de la ruta vigente. Quedan en el dataset como referencia para un viaje futuro, pero **no deben aparecer en la agenda activa**.
- Pendiente menor: la base tiene 63 fichas, no 76 como decía el conteo de "itinerario cerrado" — son dos cosas distintas (76 = paradas por día en el itinerario; 63 = fichas enriquecidas de lugares). Antes de fusionar hay que decidir cómo casan ambos números (ver Fase 2).

### Fase 2 · Alcance funcional — CERRADA ✅
Alcance confirmado: **agenda + fichas + mapa interactivo + audioguía geolocalizada + logística por capas** (ver sección 1bis), construido de forma incremental.

Decisiones cerradas:
- **Audio:** voz generada (TTS) a partir del texto de cada ficha. No se graban audios propios.
- **Instalación:** el objetivo final **es una PWA instalable de verdad**, con permisos de ubicación en segundo plano, para que el audio se dispare solo al llegar a un lugar aunque el móvil esté bloqueado.

Preguntas menores que siguen abiertas, no bloquean el arranque de la Fase 3:
- Idioma único (español) o también en otro idioma para el audio.
- Coordenadas: faltan lat/long reales por lugar — hoy solo tenemos URLs de mapa de Notion. Hay que geocodificar cada ficha o revisar si "Mapa y favoritos" de Notion ya las trae.
- Uso solo entre vosotros dos, o previsto compartir en algún momento.
- Si se refleja el estado real de reservas (Confirmado/Pendiente) dentro de la app, o se queda solo en Travel OS.

### Fase 3 y 4 · Arquitectura técnica y especificación — CERRADAS ✅
Todo esto queda resuelto en el documento **`Especificacion_tecnica_para_Codex.md`**, que es ya el encargo cerrado: capas de construcción en orden obligatorio, arquitectura (PWA + Service Worker + IndexedDB + Leaflet + TTS pregenerado), dataset único de contenido (`master_dataset.json`, 17 días / 77 paradas / 70 con coordenadas), prototipo de referencia (no reutilizable como base de código), y criterios de "hecho" antes del 25/08/2026.

### Fase 5 · Ejecución con Codex — LISTA PARA ARRANCAR
Con la especificación cerrada, este es el punto en el que se le da la orden a Codex. Los tres archivos a entregarle son:
1. `Especificacion_tecnica_para_Codex.md` — el encargo.
2. `master_dataset.json` — el contenido.
3. `ruta_china_agenda.html` — referencia de interacción de la L0 (no como código base).

Mi papel a partir de aquí: revisar lo que produzca Codex contra esta especificación y contra los datos reales de Notion/Drive, y avisar de cualquier desviación.

### Fase 6 · QA y cierre
- Revisión conjunta contra el itinerario real.
- Prueba de uso en móvil (es la agenda que usaréis en el viaje).
- Congelar versión antes del 25/08.

### Fase 5 · Ejecución — EN CURSO (10/08/2026)
En vez de encargar la construcción a Codex, se decidió que Claude construyera directamente la PWA en `app/`, siguiendo la especificación técnica cerrada. Avance:
- ✅ **L0 Agenda**: 17 días navegables, marcar visitado, notas libres, añadir paradas — persistido en IndexedDB.
- ✅ **L1 Fichas enriquecidas**: categoría/prioridad/estado/mejor momento/notas, se muestran solo cuando existen.
- ✅ **L2 Mapa**: Leaflet + OpenStreetMap, marcadores numerados por día, filtro por categoría.
- ✅ **L3 Audioguía por geolocalización**: geofencing con radio configurable (120 m por defecto), dispara TTS vía Web Speech API (decisión: sin backend, funciona offline en la mayoría de Android/Chrome), botón manual de prueba por ficha.
- 🟡 **L4 Logística**: parcial — se muestran notas de vuelo/traslado por día, falta superponer alojamientos y ventanas de compra de billetes de forma estructurada.
- ⬜ **L5 Diario**: no iniciado (previsto para después del viaje, como marca la spec).
- ✅ **Geocodificación**: resuelto vía Nominatim/OSM — 76 de 77 paradas con coordenadas (antes 70). Solo queda `Wulong Village y Tianbo Mansion` sin resolver (parada opcional, nombre ambiguo en OSM — ver `geocode_note` en el dataset).

Probado en navegador (servidor local): las 3 vistas cargan sin errores de consola, el mapa pinta correctamente, marcar visitado y la reproducción de audio funcionan.

**Pendiente para considerar el encargo cerrado:**
1. Desplegar en hosting HTTPS real (geolocalización y Service Worker no funcionan en local ni sobre HTTP) — pendiente de decidir proveedor con el usuario antes de publicar nada.
2. Prueba de campo en móvil real (instalar, activar audioguía, verificar el radio de geofencing en Beijing con paradas próximas entre sí).
3. Resolver manualmente la coordenada de Wulong Village si se decide activar esa parada opcional.
4. Rediseño visual (pendiente, fuera del alcance de esta fase — el tono actual hereda el prototipo de referencia).

---

## 3 · Estado actual

**Fases 1 a 4 cerradas. Fase 5 en curso**, construida directamente por Claude (no por Codex). Dataset fusionado y geocodificado al 99% (76/77), app funcional en las 4 capas prioritarias (L0-L3), pendiente de despliegue en hosting real y prueba de campo.
