// Viajemos · app principal — conecta dataset, estado local, agenda (L0+L1),
// mapa (L2) y audioguía por geolocalización (L3).

let dataset = null;
let state = null;
let selectedDay = 1;
let mapView = null;
let geofencer = null;
let saveTimer = null;

async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[sw] registro falló', e));
  }
  dataset = await loadDataset();
  state = await loadState();
  selectedDay = dataset.dias.findIndex((d) => d.stops.length > 0);
  if (selectedDay < 0) selectedDay = 0;

  wireTabs();
  wireAudioView();
  render();
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveState(state);
    flashSaved();
  }, 250);
}

function flashSaved() {
  const f = document.getElementById('save-flag');
  f.classList.add('show');
  setTimeout(() => f.classList.remove('show'), 900);
}

// ---------- TABS ----------
function wireTabs() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('agenda-view').classList.toggle('active', tab === 'agenda');
  document.getElementById('map-view').classList.toggle('active', tab === 'map');
  document.getElementById('logistics-view').classList.toggle('active', tab === 'logistics');
  document.getElementById('audio-view').classList.toggle('active', tab === 'audio');
  if (tab === 'map') {
    if (!mapView) {
      mapView = new MapView('map');
      renderMapFilters();
    }
    mapView.renderDay(dataset.dias[selectedDay]);
    mapView.invalidateSize();
  }
  if (tab === 'logistics') renderLogistics();
}

// ---------- RENDER GENERAL ----------
function render() {
  renderRouteStrip();
  renderDayNav();
  renderDayPanel();
  updateStats();
}

function updateStats() {
  let total = 0;
  dataset.dias.forEach((d, i) => { total += d.stops.length + (state.custom[i] || []).length; });
  document.getElementById('stat-stops').textContent = total;
  document.getElementById('stat-done').textContent = Object.values(state.done).filter(Boolean).length;
}

function renderRouteStrip() {
  const strip = document.getElementById('route-strip');
  strip.innerHTML = '';
  Object.entries(dataset.etapas).forEach(([k, v]) => {
    if (k === '0') return;
    const chip = document.createElement('div');
    chip.className = 'route-chip' + (dataset.dias[selectedDay].stage === Number(k) ? ' active' : '');
    chip.textContent = v;
    strip.appendChild(chip);
  });
}

function renderDayNav() {
  const nav = document.getElementById('day-nav');
  nav.innerHTML = '';
  dataset.dias.forEach((d, i) => {
    const btn = document.createElement('div');
    btn.className = 'day-btn' + (i === selectedDay ? ' selected' : '') + (d.travel ? ' has-travel' : '');
    btn.innerHTML = `<span class="dn">${d.dow}</span><span class="dd">${formatDateShort(d.date).split('/')[0]}</span><span class="flag"></span>`;
    btn.onclick = () => { selectedDay = i; render(); if (mapView) { mapView.renderDay(dataset.dias[selectedDay]); } document.getElementById('day-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    nav.appendChild(btn);
  });
}

// ---------- AGENDA (L0 + L1) ----------
function renderDayPanel() {
  const day = dataset.dias[selectedDay];
  const panel = document.getElementById('day-panel');
  const allStops = day.stops.concat(state.custom[selectedDay] || []);

  let html = `
    <div class="day-title">${formatDateShort(day.date)} · ${day.dow} · ${day.title}</div>
    <div class="day-stage">${day.stage_name}</div>
    ${day.note ? `<p class="day-note">✈️ ${day.note}</p>` : '<div style="height:10px"></div>'}
  `;

  if (allStops.length === 0) {
    html += `<div class="empty-day">Día de vuelo, sin paradas fijas.</div>`;
  } else {
    allStops.forEach((s, idx) => {
      const id = s.id || `custom-${selectedDay}-${idx}`;
      const done = !!state.done[id];
      const noteVal = state.notes[id] || '';
      const meta = [];
      if (s.categoria) meta.push(`<span class="pill">${s.categoria}</span>`);
      if (s.prioridad) meta.push(`<span class="pill">${s.prioridad}</span>`);
      if (s.estado) meta.push(`<span class="pill">${s.estado}</span>`);
      if (s.tipo) meta.push(`<span class="pill pill-tipo">${s.tipo}</span>`);
      const hasCoords = typeof s.lat === 'number' && typeof s.lng === 'number';
      const openable = !!s.id; // solo las paradas del dataset abren ficha detallada
      html += `
        <div class="stop">
          <div class="stop-check ${done ? 'done' : ''}" data-id="${id}">${done ? '✓' : ''}</div>
          <div class="stop-body">
            <div class="${openable ? 'stop-clickable' : ''}" ${openable ? `data-openid="${s.id}"` : ''}>
              <div>
                <span class="stop-name ${done ? 'done' : ''}">${s.n}</span>
                ${s.cn ? `<span class="stop-cn">${s.cn}</span>` : ''}
                ${s.opt ? '<span class="stop-badge badge-opt">opcional</span>' : ''}
                ${openable ? '<span class="stop-chevron">›</span>' : ''}
              </div>
              ${meta.length ? `<div class="stop-meta">${meta.join('')}${s.mejor_momento ? `<span>· ${s.mejor_momento}</span>` : ''}</div>` : ''}
              ${s.notas_extra ? `<div class="stop-notas">${s.notas_extra}</div>` : ''}
            </div>
            ${noteVal ? `<div class="stop-note-txt">📝 ${noteVal}</div>` : ''}
            <div class="stop-actions">
              <button class="stop-note-btn" data-noteid="${id}">${noteVal ? 'editar nota' : '+ nota'}</button>
              <button class="stop-audio-btn" data-audioid="${id}">🔊 escuchar ficha</button>
              ${hasCoords ? `<button class="stop-map-btn" data-mapid="${s.id}">🗺️ ver en mapa</button>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }

  html += `
    <div class="add-stop-row">
      <button class="add-toggle" id="add-toggle">+ añadir parada a este día</button>
      <div class="add-form" id="add-form">
        <input type="text" id="new-name" placeholder="Nombre del lugar" />
        <input type="text" id="new-cn" placeholder="Nombre en chino (opcional)" />
        <div class="add-form-actions">
          <button class="btn primary" id="new-save">Guardar</button>
          <button class="btn" id="new-cancel">Cancelar</button>
        </div>
      </div>
    </div>
  `;

  panel.innerHTML = html;
  wireDayPanelEvents(day);
}

function wireDayPanelEvents(day) {
  document.querySelectorAll('.stop-check').forEach((el) => {
    el.onclick = () => {
      state.done[el.dataset.id] = !state.done[el.dataset.id];
      persist();
      render();
    };
  });

  document.querySelectorAll('.stop-clickable').forEach((el) => {
    el.onclick = () => openStopDetail(el.dataset.openid);
  });

  document.querySelectorAll('.stop-audio-btn').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.audioid;
      const stop = findStopById(dataset, id) || (state.custom[selectedDay] || []).find((s) => (s.id || `custom-${selectedDay}-0`) === id);
      if (!stop) return;
      speak(buildAudioScript(stop), state.settings.ttsLang);
      logGeo(`🔊 reproducción manual: ${stop.n}`);
    };
  });

  document.querySelectorAll('.stop-map-btn').forEach((el) => {
    el.onclick = () => goToStopOnMap(el.dataset.mapid);
  });

  document.querySelectorAll('.stop-note-btn').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.noteid;
      const body = el.closest('.stop-body');
      if (body.querySelector('.stop-note-input')) return;
      const existing = state.notes[id] || '';
      const ta = document.createElement('textarea');
      ta.className = 'stop-note-input';
      ta.value = existing;
      ta.placeholder = 'Nota, gasto, valoración, enlace a foto...';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'stop-note-btn';
      saveBtn.textContent = 'guardar nota';
      saveBtn.style.marginTop = '4px';
      saveBtn.onclick = () => {
        state.notes[id] = ta.value.trim();
        persist();
        render();
      };
      body.appendChild(ta);
      body.appendChild(saveBtn);
      ta.focus();
    };
  });

  const toggle = document.getElementById('add-toggle');
  const form = document.getElementById('add-form');
  toggle.onclick = () => form.classList.toggle('open');
  document.getElementById('new-cancel').onclick = () => {
    form.classList.remove('open');
    document.getElementById('new-name').value = '';
    document.getElementById('new-cn').value = '';
  };
  document.getElementById('new-save').onclick = () => {
    const name = document.getElementById('new-name').value.trim();
    const cn = document.getElementById('new-cn').value.trim();
    if (!name) return;
    if (!state.custom[selectedDay]) state.custom[selectedDay] = [];
    state.custom[selectedDay].push({ id: `custom-${selectedDay}-${Date.now()}`, n: name, cn, _stage: day.stage });
    persist();
    render();
  };
}

// ---------- FICHA DETALLADA (enlaza itinerario ↔ mapa ↔ audioguía) ----------
function openStopDetail(id) {
  const stop = findStopById(dataset, id);
  if (!stop) return;
  renderStopDetail(stop);
  document.getElementById('stop-overlay').classList.add('open');
}

function closeStopDetail() {
  document.getElementById('stop-overlay').classList.remove('open');
}

function renderStopDetail(stop) {
  const card = document.getElementById('stop-overlay-card');
  const day = dataset.dias[stop._dayIndex];
  const done = !!state.done[stop.id];
  const noteVal = state.notes[stop.id] || '';
  const hasCoords = typeof stop.lat === 'number' && typeof stop.lng === 'number';
  const { prev, next, index, total } = sequenceNeighbors(dataset, stop.id);
  const color = STAGE_COLORS[stop._stage] || '#B23A2E';

  const meta = [];
  if (stop.categoria) meta.push(`<span class="pill">${stop.categoria}</span>`);
  if (stop.prioridad) meta.push(`<span class="pill">${stop.prioridad}</span>`);
  if (stop.estado) meta.push(`<span class="pill">${stop.estado}</span>`);
  if (stop.tipo) meta.push(`<span class="pill pill-tipo">${stop.tipo}</span>`);

  card.innerHTML = `
    <div class="sd-band" style="background:${color}">
      <button class="sd-close" id="sd-close">✕</button>
      <div class="sd-band-inner">
        <div class="sd-index">Parada ${index + 1} de ${total} · ${day.stage_name}</div>
        <div class="sd-title">${stop.n}${stop.cn ? ` <span class="sd-cn">${stop.cn}</span>` : ''}</div>
        <div class="sd-day">${formatDateShort(day.date)} · ${day.dow} · ${day.title}</div>
      </div>
    </div>
    <div class="sd-body">
      ${meta.length ? `<div class="stop-meta sd-meta">${meta.join('')}</div>` : ''}
      ${stop.mejor_momento ? `<div class="sd-row"><b>Mejor momento:</b> ${stop.mejor_momento}</div>` : ''}
      ${stop.notas_extra ? `<div class="sd-row">${stop.notas_extra}</div>` : ''}
      ${stop.opt ? `<div class="sd-row sd-opt">Parada opcional — según tiempo y energía.</div>` : ''}
      ${stop.audio_texto ? `<div class="sd-audio-script"><div class="logi-label">Guion de la audioguía</div>${stop.audio_texto}</div>` : ''}

      <div class="sd-note-block">
        <textarea class="stop-note-input" id="sd-note" placeholder="Nota, gasto, valoración, enlace a foto...">${noteVal}</textarea>
        <button class="btn" id="sd-note-save">Guardar nota</button>
      </div>

      <div class="sd-actions">
        <button class="btn ${done ? 'primary' : ''}" id="sd-visited">${done ? '✓ Visitado' : 'Marcar visitado'}</button>
        <button class="btn" id="sd-audio">🔊 Escuchar audioguía</button>
        ${hasCoords ? `<button class="btn" id="sd-map">🗺️ Ver en el mapa</button>` : ''}
      </div>

      <div class="sd-nav">
        <button class="btn" id="sd-prev" ${prev ? '' : 'disabled'}>◀ ${prev ? prev.n : 'Anterior'}</button>
        <button class="btn" id="sd-next" ${next ? '' : 'disabled'}>${next ? next.n : 'Siguiente'} ▶</button>
      </div>
    </div>
  `;

  document.getElementById('sd-close').onclick = closeStopDetail;
  document.getElementById('sd-visited').onclick = () => {
    state.done[stop.id] = !state.done[stop.id];
    persist();
    renderStopDetail(stop);
    renderDayPanel();
    updateStats();
  };
  document.getElementById('sd-audio').onclick = () => {
    speak(buildAudioScript(stop), state.settings.ttsLang);
    logGeo(`🔊 reproducción manual: ${stop.n}`);
  };
  document.getElementById('sd-note-save').onclick = () => {
    state.notes[stop.id] = document.getElementById('sd-note').value.trim();
    persist();
    renderDayPanel();
    flashSaved();
  };
  if (hasCoords) {
    document.getElementById('sd-map').onclick = () => {
      closeStopDetail();
      goToStopOnMap(stop.id);
    };
  }
  if (prev) document.getElementById('sd-prev').onclick = () => jumpToStop(prev.id);
  if (next) document.getElementById('sd-next').onclick = () => jumpToStop(next.id);
}

// Navega la ficha detallada a otra parada de la secuencia, cambiando de
// día en la agenda de fondo si hace falta — así la ficha, el día activo y
// el mapa quedan siempre coherentes entre sí.
function jumpToStop(stopId) {
  const stop = findStopById(dataset, stopId);
  if (!stop) return;
  if (stop._dayIndex !== selectedDay) {
    selectedDay = stop._dayIndex;
    render();
    if (mapView) mapView.renderDay(dataset.dias[selectedDay]);
  }
  renderStopDetail(stop);
}

// Enlace ficha → mapa: cambia a la pestaña Mapa, se asegura de estar en el
// día correcto y centra/abre el popup de la parada.
function goToStopOnMap(stopId) {
  const stop = findStopById(dataset, stopId);
  if (!stop) return;
  if (stop._dayIndex !== selectedDay) {
    selectedDay = stop._dayIndex;
    render();
  }
  switchTab('map');
  setTimeout(() => mapView.focusStop(stopId), 150);
}

// ---------- MAPA (L2) ----------
function renderMapFilters() {
  const wrap = document.getElementById('map-filters');
  wrap.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const chip = document.createElement('div');
    chip.className = 'chip-toggle on';
    chip.textContent = cat;
    chip.dataset.cat = cat;
    chip.onclick = () => {
      chip.classList.toggle('on');
      const active = Array.from(wrap.querySelectorAll('.chip-toggle.on')).map((c) => c.dataset.cat);
      mapView.setCategoryFilter(active);
      mapView.renderDay(dataset.dias[selectedDay]);
    };
    wrap.appendChild(chip);
  });
}

// ---------- LOGÍSTICA (L4) ----------
// Superpone sobre el itinerario lo que ya está confirmado (vuelos
// internacionales, traslados entre etapas, alojamientos geocodificados).
// No inventa hoteles ni ventanas de billete que no estén en el dataset —
// donde falte el dato se marca explícitamente como pendiente.
function renderLogistics() {
  const panel = document.getElementById('logistics-panel');
  const logistics = buildLogistics(dataset);
  const vi = dataset.vuelos_internacionales;

  let html = `
    <div class="logi-card logi-flights">
      <h3>✈️ Vuelos internacionales</h3>
      <div class="logi-flight-row"><b>Ida</b> · ${vi.ida.vuelo} · ${vi.ida.origen} → ${vi.ida.destino} · ${vi.ida.fecha} ${vi.ida.salida}</div>
      <div class="logi-flight-row"><b>Vuelta</b> · ${vi.vuelta.vuelo} · ${vi.vuelta.origen} → ${vi.vuelta.destino} · ${vi.vuelta.fecha} ${vi.vuelta.salida}${vi.vuelta.llegada ? ' · llegada ' + vi.vuelta.llegada : ''}</div>
    </div>
  `;

  logistics.forEach((stage) => {
    if (stage.stageNum === 0) return; // ya cubierto en la tarjeta de vuelos
    html += `
      <div class="logi-card">
        <h3>${stage.stageName} <span class="logi-nights">${stage.dayCount} ${stage.dayCount === 1 ? 'día' : 'días'} de itinerario</span></h3>
        ${stage.travelNotes.map((t) => `<div class="logi-row logi-travel">✈️ <b>${formatDateShort(t.date)} ${t.dow}</b> · ${t.note}</div>`).join('')}
        <div class="logi-accom-block">
          <div class="logi-label">Alojamiento</div>
          ${stage.accommodations.length
            ? stage.accommodations.map((a) => `<div class="logi-row">🏨 <b>${a.stop.n}</b>${a.stop.cn ? ` <span class="stop-cn">${a.stop.cn}</span>` : ''} <span class="logi-muted">· desde ${formatDateShort(a.date)}</span>${a.stop.id ? ` <button class="stop-map-btn" data-mapid="${a.stop.id}">🗺️ ver</button>` : ''}</div>`).join('')
            : `<div class="logi-row logi-pending">Sin confirmar todavía en el dataset.</div>`}
        </div>
      </div>
    `;
  });

  panel.innerHTML = html;
  panel.querySelectorAll('.stop-map-btn').forEach((el) => {
    el.onclick = () => goToStopOnMap(el.dataset.mapid);
  });
}

// ---------- AUDIOGUÍA (L3) ----------
function logGeo(msg) {
  const log = document.getElementById('geo-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  entry.textContent = `[${time}] ${msg}`;
  if (log.firstChild && log.firstChild.textContent === 'Sin actividad todavía.') log.innerHTML = '';
  log.prepend(entry);
}

function wireAudioView() {
  const slider = document.getElementById('radius-slider');
  const radiusValue = document.getElementById('radius-value');
  slider.value = state.settings.geofenceRadius;
  radiusValue.textContent = state.settings.geofenceRadius;
  slider.oninput = () => {
    radiusValue.textContent = slider.value;
    state.settings.geofenceRadius = Number(slider.value);
    if (geofencer) geofencer.radius = state.settings.geofenceRadius;
    persist();
  };

  const toggleBtn = document.getElementById('geo-toggle');
  const dot = document.getElementById('geo-status-dot');
  const text = document.getElementById('geo-status-text');

  toggleBtn.onclick = () => {
    if (geofencer && geofencer.watchId != null) {
      geofencer.stop();
      dot.classList.remove('on');
      text.textContent = 'Desactivada';
      toggleBtn.textContent = 'Activar';
      logGeo('Audioguía desactivada.');
    } else {
      geofencer = new Geofencer({
        dataset,
        state,
        radiusMeters: state.settings.geofenceRadius,
        onTrigger: (stop, dist) => {
          speak(buildAudioScript(stop), state.settings.ttsLang);
          logGeo(`🔊 disparo automático: ${stop.n} (${Math.round(dist)} m)`);
        },
        onError: (err) => logGeo(`⚠️ error de geolocalización: ${err.message || err}`)
      });
      geofencer.start();
      dot.classList.add('on');
      text.textContent = 'Activa';
      toggleBtn.textContent = 'Desactivar';
      logGeo('Audioguía activada — escuchando ubicación.');
    }
  };
}

boot();
