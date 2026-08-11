Ya tenemos una app funcionando con un sistema visual propio, aprobado y en
producción — no partas de cero ni propongas una paleta nueva. Esto es un
encargo de ampliación, no de rediseño desde cero.

## No repitas la paleta crema/terracota/serif

Las dos veces anteriores propusiste `#FAF6EC` (crema) + `#B5342A` (terracota)
+ `Source Serif 4`. Es la paleta por defecto de "app de viaje bonita" y ya la
descartamos dos veces — no la vuelvas a proponer, en ninguna variante.

## Nuestra paleta real (acláramela, no la cambies)

```
--ink:        #14181C   (grafito, no negro puro)
--ink-soft:   #5B6169
--paper:      #F3F2EE   (papel cálido, no crema)
--paper-2:    #E8E6DF
--line:       #D8D5CB
--card:       #FFFFFF
--accent:     #FF5A1F   (naranja señal — el único acento, úsalo con cuidado)
--done:       #3F7D5C   (verde, solo para estado "visitado")
```

Tipografía: monoespaciada del sistema (`SF Mono`/`JetBrains Mono`/`Roboto
Mono`) para cabeceras, etiquetas y datos (horas, coordenadas, números) —
sans del sistema para texto de lectura. Sin serif en ningún sitio.

**Lo que sí quiero que hagas con la paleta: aclárala.** Súbele luminosidad
al fondo y baja el contraste general un punto — sigue siendo grafito sobre
papel, no negro sobre blanco puro, pero más ligero de lo que está ahora en
producción. No la sustituyas por otra cosa.

## Qué diseñar (solo dos pantallas nuevas, no toques el resto)

Ya tenemos Hoy, Agenda, Mapa, Logística funcionando y aprobadas. Añade
solo estas dos, en el mismo lenguaje visual (billete de embarque / manifiesto
de tránsito: numeración tabular, etiquetas en mono, líneas discontinuas tipo
ticket, sin degradados ni sombras pesadas):

1. **Destino** — portada editorial de la etapa activa (ciudad + nombre local
   + foto o banda de color si no hay foto). Zonas clave, contexto rápido.
   No existía, es un hueco real.

2. **Audioguía — reproductor de parada.** Esto es lo más importante:
   diseña la UI asumiendo que el audio es **texto leído por voz del
   dispositivo (TTS), no un archivo de audio con archivo/duración fija**.
   No hay `currentTime`/`duration` reales que mostrar con precisión — evita
   un scrubber que finja saber la posición exacta. En su lugar: estado
   simple (reproduciendo / en pausa / parado), transcripción completa
   visible con la frase actual resaltada si es razonable estimarla por
   tiempo transcurrido, cola de paradas del día con marcador de
   completado, control de velocidad (si el dispositivo lo soporta).
   **No simules la reproducción con un temporizador falso** — diseña la
   UI para conectarse a eventos reales (inicio, fin, cambio de frase), y
   dilo así en el handoff para quien lo implemente.

## Formato de entrega

Como la vez pasada: paquete descargable con README de handoff. Si el
archivo `.dc.html` depende de `support.js` u otro runtime propio, inclúyelo
en el zip — la vez anterior faltaba y no pude verlo renderizado, solo leí
las plantillas.

## Contexto de la app real (por si hace falta)

Repo: `faurit-lab/viajemos-ruta-china`. Estructura y relaciones entre
pantallas: ver `GUION_DISENO.md` en la raíz del repo (ya te lo pasé antes,
sigue vigente).
