# Guion de lo que queda · Viajemos (Ruta a China)

> Sesión del 10/08/2026. Retomamos a las 19:00. Orden sugerido de arriba a abajo:
> primero cerrar lo técnico/funcional, el diseño va al final.

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

## 3 · L4 · Logística en capas (parcial → completar)
Hoy solo se ven las notas de vuelo/traslado por día (`day.note`). Falta
superponer de forma estructurada:
- [ ] Alojamientos por etapa (noches, nombre, ya hay 2 geocodificados:
      Orange Hotel Zhangjiajie y Shenzhoujie International Hotel).
- [ ] Ventanas de compra de billetes ya identificadas (si las hay en el
      Documento Maestro / billete Air China).
- [ ] Decidir si esto vive en la ficha del día, en la ficha de la parada, o
      en una vista propia.

## 4 · L5 · Diario y gastos (no iniciado)
Pospuesto a después del viaje según la spec original — no es prioritario
ahora. Cuando toque: registro de gasto real, fotos, valoración por parada.

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
