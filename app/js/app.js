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

  renderHero();
  wireTabs();
  wireAudioView();
  render();
  renderHoy();
}

// Cabecera genérica: todo sale del dataset (título, viajeros, fechas,
// número de jornadas/etapas). Así la app sirve para cualquier viaje sin
// tocar el HTML — solo hace falta sustituir data/trip.json.
function renderHero() {
  const titulo = dataset.app_titulo || dataset.proyecto || 'Viajemos';
  const tituloLocal = dataset.app_titulo_local || '';
  document.getElementById('page-title').textContent = `Viajemos · ${titulo}`;
  document.title = `Viajemos · ${titulo}`;
  document.getElementById('hero-title').innerHTML =
    `${escapeHtml(titulo)}${tituloLocal ? ` <span class="cn">${escapeHtml(tituloLocal)}</span>` : ''}`;

  const viajeros = (dataset.viajeros || []).join(' & ');
  const f = dataset.fechas || {};
  const rango = f.inicio && f.fin ? `${formatDateLong(f.inicio)} – ${formatDateLong(f.fin, true)}` : '';
  const noches = f.noches ? `${f.noches} noches` : '';
  document.getElementById('hero-sub').textContent = [viajeros, rango, noches].filter(Boolean).join(' · ');

  document.getElementById('stat-days').textContent = dataset.dias.length;
  const stageCount = Object.keys(dataset.etapas || {}).filter((k) => k !== '0').length;
  document.getElementById('stat-stages').textContent = stageCount;
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
  document.getElementById('hoy-view').classList.toggle('active', tab === 'hoy');
  document.getElementById('agenda-view').classList.toggle('active', tab === 'agenda');
  document.getElementById('map-view').classList.toggle('active', tab === 'map');
  document.getElementById('logistics-view').classList.toggle('active', tab === 'logistics');
  document.getElementById('audio-view').classList.toggle('active', tab === 'audio');
  if (tab === 'hoy') renderHoy();
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
    const stageNum = Number(k);
    const chip = document.createElement('div');
    chip.className = 'route-chip' + (dataset.dias[selectedDay].stage === stageNum ? ' active' : '');
    chip.innerHTML = `<span class="dot"></span><span class="lbl">${escapeHtml(v)}</span>`;
    // Salta al primer día de esa etapa — antes las etiquetas eran solo
    // decorativas, sin ninguna acción al tocarlas.
    chip.onclick = () => {
      const targetDay = dataset.dias.findIndex((d) => d.stage === stageNum);
      if (targetDay === -1) return;
      selectedDay = targetDay;
      render();
      renderHoy();
      if (mapView) mapView.renderDay(dataset.dias[selectedDay]);
      document.getElementById('day-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
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
    btn.onclick = () => { selectedDay = i; render(); renderHoy(); if (mapView) { mapView.renderDay(dataset.dias[selectedDay]); } document.getElementById('day-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
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
      // Solo las paradas del dataset original abren la ficha detallada
      // (openStopDetail busca con findStopById, que no conoce las paradas
      // añadidas a mano). idx < day.stops.length distingue unas de otras
      // dentro de allStops, que las concatena.
      const openable = idx < day.stops.length;
      html += `
        <div class="stop ${done ? 'done' : ''}">
          <div class="stop-num">${String(idx + 1).padStart(2, '0')}</div>
          <div class="stop-check ${done ? 'done' : ''}" data-id="${id}">${done ? '✓' : ''}</div>
          <div class="stop-body">
            <div class="${openable ? 'stop-clickable' : ''}" ${openable ? `data-openid="${s.id}"` : ''}>
              <div>
                <span class="stop-name ${done ? 'done' : ''}">${escapeHtml(s.n)}</span>
                ${s.cn ? `<span class="stop-cn">${escapeHtml(s.cn)}</span>` : ''}
                ${s.opt ? '<span class="stop-badge badge-opt">opcional</span>' : ''}
                ${openable ? '<span class="stop-chevron">›</span>' : ''}
              </div>
              ${meta.length ? `<div class="stop-meta">${meta.join('')}${s.mejor_momento ? `<span>· ${s.mejor_momento}</span>` : ''}</div>` : ''}
              ${s.notas_extra ? `<div class="stop-notas">${s.notas_extra}</div>` : ''}
            </div>
            ${noteVal ? `<div class="stop-note-txt">📝 ${escapeHtml(noteVal)}</div>` : ''}
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
  wireDayPanelEvents(panel, day);
}

// `panel` acota todas las búsquedas a la agenda: sin esto, los selectores
// pillaban también botones con la misma clase en la pestaña Logística
// (misma clase CSS, DOM compartido aunque la vista esté oculta).
function wireDayPanelEvents(panel, day) {
  panel.querySelectorAll('.stop-check').forEach((el) => {
    el.onclick = () => {
      state.done[el.dataset.id] = !state.done[el.dataset.id];
      persist();
      render();
      renderHoy();
    };
  });

  panel.querySelectorAll('.stop-clickable').forEach((el) => {
    el.onclick = () => openStopDetail(el.dataset.openid);
  });

  panel.querySelectorAll('.stop-audio-btn').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.audioid;
      const stop = findStopById(dataset, id) || (state.custom[selectedDay] || []).find((s) => s.id === id);
      if (!stop) return;
      speak(buildAudioScript(stop), state.settings.ttsLang);
      logGeo(`🔊 reproducción manual: ${stop.n}`);
    };
  });

  panel.querySelectorAll('.stop-map-btn').forEach((el) => {
    el.onclick = () => goToStopOnMap(el.dataset.mapid);
  });

  panel.querySelectorAll('.stop-note-btn').forEach((el) => {
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

// ---------- HOY — panel de entrada ----------
// Todo lo que se ve aquí sale de trip.json + el estado local (visitado).
// Nada de tiempo meteorológico, horarios de apertura ni gasto previsto
// todavía — eso necesita datos nuevos o un servicio externo, ver
// docs/Pendientes.
function renderHoy() {
  const panel = document.getElementById('hoy-panel');
  const day = dataset.dias[selectedDay];
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const nombre = (dataset.viajeros && dataset.viajeros[0]) ? dataset.viajeros[0].split(' ')[0] : '';

  const doneInDay = day.stops.filter((s) => state.done[s.id]).length;
  const next = nextUnvisitedStop(day, state.done);

  const accom = findCurrentAccommodation(dataset, selectedDay);
  const travelDay = nextTravelDay(dataset, selectedDay);
  const alerts = deriveAlerts(day);

  const fijoCount = day.stops.filter((s) => deriveStopBadge(s) === 'FIJO').length;
  const flexCount = day.stops.filter((s) => deriveStopBadge(s) === 'FLEXIBLE').length;
  const optCount = day.stops.filter((s) => deriveStopBadge(s) === 'OPCIONAL').length;
  const km = dayWalkingKm(day);
  const audioMin = dayAudioMinutes(day);

  let html = `
    <div class="hoy-greet">
      <div class="hoy-clock">${hh}:${mm}</div>
      <div class="hoy-greet-txt">${greeting}${nombre ? ', ' + escapeHtml(nombre.toUpperCase()) : ''}</div>
      <div class="hoy-day-line">${day.dow} ${formatDateLong(day.date)} · ${day.stage_name}</div>
      <div class="hoy-progress">JORNADA ${selectedDay + 1} DE ${dataset.dias.length} · ${doneInDay}/${day.stops.length} VISITADAS</div>
    </div>
  `;

  if (day.stops.length === 0) {
    html += `<div class="hoy-card"><div class="hoy-card-label">Día de vuelo</div><div class="sd-row">${day.note || 'Sin paradas fijas — jornada de traslado.'}</div></div>`;
  } else if (!next) {
    html += `<div class="hoy-card hoy-done">✓ Jornada completada — todas las paradas visitadas.</div>`;
  } else {
    const badge = deriveStopBadge(next);
    html += `
      <div class="hoy-card hoy-next">
        <div class="hoy-card-label">Próxima parada</div>
        <div class="hoy-next-name">${escapeHtml(next.n)}${next.cn ? ` <span class="stop-cn">${escapeHtml(next.cn)}</span>` : ''}<span class="stop-badge badge-opt">${badge}</span></div>
        ${next.ficha && next.ficha.gancho ? `<div class="sd-gancho">${next.ficha.gancho}</div>` : ''}
        ${next.mejor_momento ? `<div class="sd-row">${next.mejor_momento}</div>` : ''}
        ${next.notas_extra ? `<div class="sd-row">${next.notas_extra}</div>` : ''}
        <div class="sd-actions">
          <button class="btn primary" id="hoy-visit">✓ Marcar visitado</button>
          <button class="btn" id="hoy-ficha">Ver ficha</button>
        </div>
      </div>
    `;
  }

  const upcoming = day.stops.filter((s) => (!next || s.id !== next.id) && !state.done[s.id]);
  if (upcoming.length) {
    html += `<div class="hoy-card"><div class="hoy-card-label">Después</div>`;
    upcoming.forEach((s) => {
      html += `<div class="hoy-mini-row" data-openid="${s.id}"><span class="stop-badge badge-opt">${deriveStopBadge(s)}</span><span class="hoy-mini-name">${escapeHtml(s.n)}</span><span class="stop-chevron">›</span></div>`;
    });
    html += `</div>`;
  }

  html += `
    <div class="hoy-card">
      <div class="hoy-card-label">El día en cifras</div>
      <div class="hoy-stats-grid">
        <div class="hoy-stat"><b>${day.stops.length}</b><span>Paradas</span><i>${fijoCount} fijas · ${flexCount} flexibles · ${optCount} opcional${optCount === 1 ? '' : 'es'}</i></div>
        <div class="hoy-stat"><b>${km.toFixed(1)}</b><span>Km en línea recta</span><i>entre paradas consecutivas</i></div>
        <div class="hoy-stat"><b>${audioMin || '<1'}</b><span>Min. de audioguía</span><i>en las fichas de hoy</i></div>
      </div>
    </div>
  `;

  html += `
    <div class="hoy-card">
      <div class="hoy-card-label">Esta noche y el próximo traslado</div>
      ${accom ? `<div class="logi-row">🏨 <b>${escapeHtml(accom.n)}</b></div>` : `<div class="logi-row logi-pending">Alojamiento sin confirmar en el dataset.</div>`}
      ${travelDay ? `<div class="logi-row logi-travel">✈️ ${formatDateLong(travelDay.date)} · ${travelDay.note || travelDay.title}${travelDay.date !== day.date ? ` <span class="hoy-countdown">quedan ${daysBetween(day.date, travelDay.date)} día${daysBetween(day.date, travelDay.date) === 1 ? '' : 's'}</span>` : ' <span class="hoy-countdown">hoy</span>'}</div>` : ''}
    </div>
  `;

  html += `
    <div class="hoy-card">
      <div class="hoy-card-label">Requiere tu atención</div>
      ${alerts.length
        ? alerts.map((a) => `<div class="hoy-alert"><div class="hoy-alert-title">⚠ ${escapeHtml(a.title)}</div><div class="hoy-alert-reason">${escapeHtml(a.reason)}</div></div>`).join('')
        : `<div class="logi-row logi-pending">Sin alertas por ahora.</div>`}
    </div>
  `;

  panel.innerHTML = html;

  const visitBtn = document.getElementById('hoy-visit');
  if (visitBtn) visitBtn.onclick = () => {
    state.done[next.id] = true;
    persist();
    render();
    renderHoy();
  };
  const fichaBtn = document.getElementById('hoy-ficha');
  if (fichaBtn) fichaBtn.onclick = () => openStopDetail(next.id);
  panel.querySelectorAll('.hoy-mini-row').forEach((el) => {
    el.onclick = () => openStopDetail(el.dataset.openid);
  });
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

  // Multimedia: si la parada trae foto (`imagen`), se muestra sobre la
  // banda de color en vez de sustituirla — así funciona igual de bien con
  // 0 fotos que con todas. `galeria` es opcional, para más de una imagen.
  const bandStyle = stop.imagen ? '' : `style="background:${color}"`;
  const bandImg = stop.imagen
    ? `<img class="sd-band-img" src="${stop.imagen}" alt="" onerror="this.remove()">`
    : '';
  const galleryStrip = Array.isArray(stop.galeria) && stop.galeria.length
    ? `<div class="sd-gallery">${stop.galeria.map((src) => `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">`).join('')}</div>`
    : '';

  card.innerHTML = `
    <div class="sd-band" ${bandStyle}>
      ${bandImg}
      <button class="sd-close" id="sd-close">✕</button>
      <div class="sd-band-inner">
        <div class="sd-index">Parada ${index + 1} de ${total} · ${day.stage_name}</div>
        <div class="sd-title">${stop.n}${stop.cn ? ` <span class="sd-cn">${stop.cn}</span>` : ''}</div>
        <div class="sd-day">${formatDateShort(day.date)} · ${day.dow} · ${day.title}</div>
      </div>
    </div>
    <div class="sd-perf"></div>
    <div class="sd-body">
      ${stop.ficha && stop.ficha.gancho ? `<div class="sd-gancho">${stop.ficha.gancho}</div>` : ''}
      ${meta.length ? `<div class="stop-meta sd-meta">${meta.join('')}</div>` : ''}
      ${stop.mejor_momento ? `<div class="sd-row"><b>Mejor momento:</b> ${stop.mejor_momento}</div>` : ''}
      ${stop.notas_extra ? `<div class="sd-row">${stop.notas_extra}</div>` : ''}
      ${stop.opt ? `<div class="sd-row sd-opt">Parada opcional — según tiempo y energía.</div>` : ''}
      ${galleryStrip}

      ${stop.ficha ? `
        ${stop.ficha.contexto_historico ? `<div class="sd-row"><b>Contexto histórico</b>${stop.ficha.contexto_historico}</div>` : ''}
        ${stop.ficha.leyenda ? `<div class="sd-row"><b>Historia o leyenda</b>${stop.ficha.leyenda}</div>` : ''}
        ${stop.ficha.que_mirar ? `<div class="sd-row"><b>Qué mirar ahora mismo</b>${stop.ficha.que_mirar}</div>` : ''}
        ${stop.ficha.curiosidad ? `<div class="sd-row"><b>Curiosidad</b>${stop.ficha.curiosidad}</div>` : ''}
        ${stop.ficha.por_que_ruta ? `<div class="sd-row"><b>Por qué está en esta ruta</b>${stop.ficha.por_que_ruta}</div>` : ''}
      ` : ''}

      <div class="sd-note-block">
        <textarea class="stop-note-input" id="sd-note" placeholder="Nota, gasto, valoración, enlace a foto..."></textarea>
        <button class="btn" id="sd-note-save">Guardar nota</button>
      </div>

      <div class="sd-actions">
        <button class="btn ${done ? 'primary' : ''}" id="sd-visited">${done ? '✓ Visitado' : 'Marcar visitado'}</button>
        <button class="btn" id="sd-audio">🔊 Escuchar audioguía</button>
        ${hasCoords ? `<button class="btn" id="sd-map">🗺️ Ver en el mapa</button>` : ''}
      </div>

      ${(() => { const guion = (stop.ficha && stop.ficha.guion_audio) || stop.audio_texto; return guion ? `<div class="sd-audio-script"><div class="logi-label">Guion de la audioguía</div>${guion}</div>` : ''; })()}

      <div class="sd-nav">
        <button class="btn" id="sd-prev" ${prev ? '' : 'disabled'}>◀ ${prev ? prev.n : 'Anterior'}</button>
        <button class="btn" id="sd-next" ${next ? '' : 'disabled'}>${next ? next.n : 'Siguiente'} ▶</button>
      </div>
    </div>
  `;

  document.getElementById('sd-note').value = noteVal; // asignado como propiedad, no interpolado en el HTML — evita romper el markup si la nota trae "<" o "</textarea>"
  document.getElementById('sd-close').onclick = closeStopDetail;
  document.getElementById('sd-visited').onclick = () => {
    state.done[stop.id] = !state.done[stop.id];
    persist();
    renderStopDetail(stop);
    renderDayPanel();
    updateStats();
    renderHoy();
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
    renderHoy();
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
