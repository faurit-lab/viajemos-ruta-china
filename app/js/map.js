// Viajemos · L2 — Mapa interactivo (Leaflet + OpenStreetMap)
// Capas activables por categoría; numeración por orden del día activo,
// igual que en los mapas reales de Notion (ver spec sección 1, L2).

class MapView {
  constructor(containerId) {
    this.map = L.map(containerId, { zoomControl: true }).setView([30, 112], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);
    this.markers = [];
    this.markersById = {};
    this.activeCategories = new Set(CATEGORIES);

    // Delegación: los popups se crean dinámicamente, así que el botón de
    // audio dentro de cada uno se conecta a la reproducción global (geo.js)
    // en cuanto Leaflet abre el popup.
    this.map.on('popupopen', (e) => {
      const btn = e.popup.getElement().querySelector('.pm-audio-btn');
      if (!btn) return;
      btn.onclick = () => {
        const stop = allStopsWithCoords(DATASET).find((s) => s.id === btn.dataset.audioid);
        if (stop) speak(buildAudioScript(stop));
      };
    });
  }

  _icon(number, color, dimmed) {
    return L.divIcon({
      className: 'stop-marker',
      html: `<div class="marker-pin" style="background:${color};opacity:${dimmed ? 0.35 : 1}">${number}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  clear() {
    this.markers.forEach((m) => this.map.removeLayer(m));
    this.markers = [];
    this.markersById = {};
  }

  renderDay(day) {
    this.clear();
    const bounds = [];
    const stopsWithCoords = day.stops.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number');

    stopsWithCoords.forEach((s, i) => {
      const dimmed = s.categoria && !this.activeCategories.has(s.categoria);
      const color = STAGE_COLORS[s._stage] || '#B23A2E';
      const marker = L.marker([s.lat, s.lng], { icon: this._icon(i + 1, color, dimmed) });
      const catLine = s.categoria ? `<div class="pm-cat">${s.categoria}${s.prioridad ? ' · ' + s.prioridad : ''}</div>` : '';
      marker.bindPopup(
        `<div class="pm-popup"><b>${s.n}</b>${s.cn ? ` <span class="pm-cn">${s.cn}</span>` : ''}${catLine}` +
        `<button class="pm-audio-btn" data-audioid="${s.id}">🔊 escuchar</button></div>`
      );
      marker.addTo(this.map);
      this.markers.push(marker);
      this.markersById[s.id] = marker;
      bounds.push([s.lat, s.lng]);
    });

    if (bounds.length) {
      this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }

  setCategoryFilter(categories) {
    this.activeCategories = new Set(categories);
  }

  // Enlace ficha → mapa: centra y abre el popup de una parada concreta.
  // Devuelve true si la parada estaba entre los marcadores ya pintados.
  focusStop(stopId) {
    const marker = this.markersById[stopId];
    if (!marker) return false;
    this.map.flyTo(marker.getLatLng(), 17, { duration: 0.6 });
    setTimeout(() => marker.openPopup(), 350);
    return true;
  }

  invalidateSize() {
    setTimeout(() => this.map.invalidateSize(), 50);
  }
}
