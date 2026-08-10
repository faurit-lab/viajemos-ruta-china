# Guion de lo que queda · Viajemos (Ruta a China)

> Sesión del 10/08/2026. Retomamos a las 19:00. Orden sugerido de arriba a abajo:
> primero cerrar lo técnico/funcional, el diseño va al final.
>
> **Nota de reorganización (10/08, noche):** este documento y el resto del
> paquete de China se movieron a `trips/china-2026/` — la app ahora es
> genérica (`app/`) y cada viaje vive en su propia carpeta bajo `trips/`.
> Ver `README.md` en la raíz del repo. El dataset ya no se llama
> `master_dataset.json`, es `trip.json` dentro de esta misma carpeta.

---

## 1 · Verificación en campo (antes de tocar nada más)
- [ ] Confirmar que la instalación "Añadir a pantalla de inicio" funcionó en el móvil.
- [ ] Probar el toggle de audioguía real: activar, aceptar permiso de ubicación,
      comprobar que no salta ningún error.
- [ ] Simular/probar el disparo de audio en al menos una parada (botón manual
      "🔊 escuchar audioguía" ya vale como prueba rápida sin moverse).
- [ ] Ojo especial a Beijing día 26-27/08: 4 paradas muy próximas entre sí —
      con el radio de 120 m por defecto, comprobar que no se disparan varias
      a la vez o con falsos positivos. Ajustar el slider de radio si hace falta.

## 2 · Datos pendientes
- [ ] `Wulong Village y Tianbo Mansion` (parada opcional, día 29/08) sigue sin
      coordenada fiable — la geocodificación automática dio un resultado a
      ~9 km del clúster de Yangjiajie. Si se activa esa parada, geocodificar
      a mano (Amap/Baidu) y actualizar `data/master_dataset.json` (campo
      `geocode_note` ya explica el motivo).
- [ ] Revisar si se quiere reflejar el estado real de reservas (Confirmado/
      Pendiente) dentro de la app o dejarlo solo en Travel OS/Notion —
      pregunta que quedó abierta en el guion original y nunca se cerró.
- [ ] Decidir si se quiere audio también en otro idioma (hoy solo español).

## 3 · L4 · Logística en capas — ✅ hecho (10/08, sesión 19:00)
Nueva pestaña "🧳 Logística": tarjeta de vuelos internacionales + una
tarjeta por etapa con traslados y alojamiento, enlazada al mapa. Solo
refleja lo que YA está en el dataset (no se inventaron hoteles):
- ✅ Orange Hotel Zhangjiajie y Shenzhoujie International Hotel, con botón
  directo al mapa.
- ✅ Fenghuang, Chongqing, Yangshuo, Guangzhou y Shenzhen: **decisión del
  usuario, no dato pendiente** — en esas etapas van sin alojamiento
  concertado a propósito (viajan libres). El mensaje "sin confirmar" en la
  app es correcto y se queda así salvo que decidan reservar algo concreto.
- ⬜ Ventanas de compra de billetes: no había ningún dato de esto en
  `master_dataset.json` pese a lo que decía la spec — si existen, están
  solo en el Documento Maestro (Google Drive) y habría que traerlas.

## 4 · L5 · Diario y gastos (no iniciado)
Pospuesto a después del viaje según la spec original — no es prioritario
ahora. Cuando toque: registro de gasto real, fotos, valoración por parada.

## 3bis · Guiones de audio — ✅ hecho (10/08, sesión 19:00)
Se detectó que el audio de 50 de las 77 paradas solo decía el nombre (no
había más texto en el dataset). Se redactó un guion narrativo de 4-6 frases
por parada (campo `audio_texto`), con conocimiento general de cada lugar
(son destinos turísticos documentados), y `buildAudioScript()` en `geo.js`
ahora usa ese campo. El texto también se puede leer en la ficha detallada,
no solo escuchar.

**⚠️ Importante — revisar antes de dar por bueno:** el contenido histórico/
cultural lo redacté yo con conocimiento general, no viene de una fuente
verificada del viaje. Los datos duros y cifras concretas (alturas, fechas,
metros) conviene contrastarlos antes de confiar en ellos al 100% durante
el viaje — especialmente si algo suena muy específico. Nada de esto afecta
a la logística real (horarios, reservas, coordenadas), que sigue viniendo
solo del dataset original.

## 4bis · Pantalla "Hoy" — ✅ hecho (10/08, sesión noche)
Fusionado el contenido de una propuesta de Claude Design (`hoy-claro-standalone.html`,
compartida por el usuario) con nuestro sistema visual "Manifiesto de viaje" —
se descartó la paleta crema/terracota del original por ser el look genérico
que ya evitamos antes. Nueva pestaña "☀️ Hoy", primera en la navegación:
- Próxima parada (por orden, no hay horas exactas por parada todavía),
  progreso del día, botón directo a marcar visitado/ver ficha.
- Lista "Después" con el resto de paradas pendientes del día.
- "El día en cifras": nº de paradas (fijas/flexibles/opcionales), km en
  línea recta entre paradas consecutivas (Haversine real, no estimación de
  ruta a pie) y minutos de audioguía (derivado de la longitud real de los
  `audio_texto`).
- Alojamiento vigente + próximo traslado con cuenta en días.
- **Alertas automáticas**, derivadas de datos existentes (paradas opcionales/
  candidatas, notas con palabras clave como "pendiente"/"apertura") — no se
  inventa ningún texto nuevo.

Explícitamente fuera por ahora (según lo decidido con el usuario):
- Tiempo meteorológico en vivo — servicio externo, se deja para el final.
- Horarios de apertura, cómo llegar en transporte, gasto previsto — necesitan
  campos nuevos en el dataset que el usuario tiene que ir dando.

## 5 · Rediseño visual (al final, como se acordó)
- [ ] Definir dirección visual real — hoy hereda paleta/tono del prototipo
      de referencia (papel/sello/jade), útil como base pero "sin diseñar".
- [ ] Fotos por parada: el dataset no trae imágenes. Decidir fuente (subir
      fotos propias, generar, o dejarlo sin foto y usar solo la banda de
      color por etapa como ahora).
- [ ] Revisar la ficha detallada, el mapa y la vista de audioguía ya
      construidas — la interacción está cerrada, lo que falta es estética.
- [ ] Iconografía propia en vez de emojis (🔊 🗺️ 🗓️) si se quiere más pulido.

## 6 · Técnico / infraestructura, menor
- [ ] El Service Worker cachea de forma "cache-first con actualización en
      segundo plano": tras un despliegue nuevo, el móvil puede tardar un
      recarga extra en ver la versión más reciente. No bloquea nada, pero
      hay que saberlo al probar cambios recién publicados.
- [ ] Sin backend propio — se mantiene así salvo que se decida TTS en la
      nube pregenerado (ver spec técnica, sección 4) por calidad de voz.

---

## Ya cerrado (para no repetir)
- ✅ L0 Agenda, L1 Fichas, L2 Mapa, L3 Audioguía (geofencing + TTS) — funcionando.
- ✅ Ficha detallada enlazando agenda ↔ mapa ↔ audioguía, con navegación
  secuencial "anterior/siguiente" a través de las 77 paradas.
- ✅ 76/77 coordenadas geocodificadas.
- ✅ Desplegado en producción: https://faurit-lab.github.io/viajemos-ruta-china/
  (HTTPS real, instalable, Service Worker activo).
