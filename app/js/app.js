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
  document.getElementById('audio-view').classList.toggle('active', tab === 'audio');
  if (tab === 'map') {
    if (!mapView) {
      mapView = new MapView('map');
      renderMapFilters();
    }
    mapView.renderDay(dataset.dias[selectedDay]);
    mapView.invalidateSize();
  }
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
      html += `
        <div class="stop">
          <div class="stop-check ${done ? 'done' : ''}" data-id="${id}">${done ? '✓' : ''}</div>
          <div class="stop-body">
            <div>
              <span class="stop-name ${done ? 'done' : ''}">${s.n}</span>
              ${s.cn ? `<span class="stop-cn">${s.cn}</span>` : ''}
              ${s.opt ? '<span class="stop-badge badge-opt">opcional</span>' : ''}
            </div>
            ${meta.length ? `<div class="stop-meta">${meta.join('')}${s.mejor_momento ? `<span>· ${s.mejor_momento}</span>` : ''}</div>` : ''}
            ${s.notas_extra ? `<div class="stop-notas">${s.notas_extra}</div>` : ''}
            ${noteVal ? `<div class="stop-note-txt">📝 ${noteVal}</div>` : ''}
            <div class="stop-actions">
              <button class="stop-note-btn" data-noteid="${id}">${noteVal ? 'editar nota' : '+ nota'}</button>
              <button class="stop-audio-btn" data-audioid="${id}">🔊 escuchar ficha</button>
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

  document.querySelectorAll('.stop-audio-btn').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.audioid;
      const stop = findStopById(dataset, id) || (state.custom[selectedDay] || []).find((s) => (s.id || `custom-${selectedDay}-0`) === id);
      if (!stop) return;
      speak(buildAudioScript(stop), state.settings.ttsLang);
      logGeo(`🔊 reproducción manual: ${stop.n}`);
    };
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
