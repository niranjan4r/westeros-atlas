/* ============================================================
 * App wiring: map ⇄ details panel ⇄ search ⇄ tooltip
 * ============================================================ */
(function () {
  'use strict';

  const PLACES = window.WesterosPlaces;
  const REGIONS = window.WesterosGeo.REGIONS;
  const regionById = new Map(REGIONS.map((r) => [r.id, r]));

  const $ = (sel) => document.querySelector(sel);
  const panel = $('#panel');
  const panelBody = $('#panel-body');
  const tooltip = $('#tooltip');
  const searchInput = $('#search');
  const searchResults = $('#search-results');

  const TYPE_LABEL = {
    capital: 'Great Seat', city: 'City', castle: 'Castle',
    town: 'Town', ruin: 'Ruin', landmark: 'Landmark',
  };

  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ------------------------------------------------------- map ---- */
  const map = new window.WesterosMap($('#map'), PLACES, {
    onPlaceClick: (p) => openPlace(p.id, true),
    onRegionClick: (r) => openRegion(r.id),
    onBackgroundClick: closePanel,
    onHover: showTooltip,
    onView: (z) => { $('#zoom-readout').textContent = z.toFixed(1) + '×'; },
  });

  $('#zoom-in').addEventListener('click', () => map.zoomBy(1.45));
  $('#zoom-out').addEventListener('click', () => map.zoomBy(1 / 1.45));
  $('#zoom-fit').addEventListener('click', () => { map.fit(); closePanel(); });

  /* --------------------------------------------------- tooltip ---- */
  function showTooltip(place, evt) {
    if (!place) { tooltip.classList.remove('on'); return; }
    tooltip.innerHTML = `<strong>${esc(place.name)}</strong><span>${esc(TYPE_LABEL[place.type])} · ${esc(regionById.get(place.region).name)}</span>`;
    tooltip.classList.add('on');
    const pad = 14;
    const r = document.body.getBoundingClientRect();
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + 230 > r.width) x = evt.clientX - 230 - 4;
    if (y + 60 > r.height) y = evt.clientY - 60;
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }

  /* ----------------------------------------------------- panel ---- */
  function openPanel() {
    panel.classList.add('open');
    tooltip.classList.remove('on');   // touch devices: don't leave a stuck tooltip
  }
  function closePanel() { panel.classList.remove('open'); }
  $('#panel-close').addEventListener('click', closePanel);

  function loadingHTML(title) {
    return `<div class="panel-loading"><div class="spinner"></div>Consulting the maesters on ${esc(title)}…</div>`;
  }

  async function openPlace(id, fly) {
    const p = PLACES.find((x) => x.id === id);
    if (!p) return;
    openPanel();
    panelBody.innerHTML = loadingHTML(p.name);
    if (fly) {
      const zTarget = p.tier === 1 ? 3.6 : p.tier === 2 ? 4.2 : 5.2;
      const zRel = Math.max(map.k / map.k0, zTarget);
      let targetY = p.y;
      // On small screens the details panel is a bottom sheet covering the
      // lower ~55% — aim the place at the visible upper portion instead.
      if (window.matchMedia('(max-width: 700px)').matches) {
        const h = $('#map').getBoundingClientRect().height;
        targetY += (0.26 * h) / (map.k0 * zRel);
      }
      map.flyTo(p.x, targetY, zRel);
    }
    try {
      const d = await window.WesterosAPI.getPlaceDetails(id);
      const region = regionById.get(d.region);
      panelBody.innerHTML = `
        <div class="ptype ptype-${esc(d.type)}">${esc(TYPE_LABEL[d.type])}</div>
        <h2>${esc(d.name)}</h2>
        <button class="region-chip" data-region="${esc(d.region)}" style="--chip:${region.color}">
          ${esc(region.name)}
        </button>
        ${d.seat ? `<p class="seat">${esc(d.seat)}</p>` : ''}
        <p class="blurb">${esc(d.blurb)}</p>
        <h3>History</h3>
        <p class="hist">${esc(d.history)}</p>
        ${d.events && d.events.length ? `
          <h3>Major events</h3>
          <ul class="events">
            ${d.events.map(([when, what]) =>
              `<li><span class="ev-when">${esc(when)}</span><span class="ev-what">${esc(what)}</span></li>`).join('')}
          </ul>` : ''}`;
      panelBody.querySelector('.region-chip')
        .addEventListener('click', (e) => openRegion(e.currentTarget.dataset.region));
    } catch (err) {
      panelBody.innerHTML = `<p class="panel-error">The ravens were lost in a storm. (${esc(err.message)})</p>`;
    }
  }

  async function openRegion(id) {
    openPanel();
    const r0 = regionById.get(id);
    panelBody.innerHTML = loadingHTML(r0 ? r0.name : id);
    try {
      const r = await window.WesterosAPI.getRegionDetails(id);
      const seats = PLACES.filter((p) => p.region === id)
        .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
      panelBody.innerHTML = `
        <div class="ptype">Realm</div>
        <h2>${esc(r.name)}</h2>
        <div class="region-swatch" style="--chip:${r.color}"></div>
        <p class="seat">${esc(r.house)}</p>
        <p class="words">${esc(r.words)}</p>
        <p class="blurb">${esc(r.blurb)}</p>
        <h3>Notable places</h3>
        <ul class="place-list">
          ${seats.map((p) => `<li><button class="place-link" data-id="${esc(p.id)}">${esc(p.name)}</button><span>${esc(TYPE_LABEL[p.type])}</span></li>`).join('')}
        </ul>`;
      panelBody.querySelectorAll('.place-link').forEach((b) =>
        b.addEventListener('click', () => openPlace(b.dataset.id, true)));
    } catch (err) {
      panelBody.innerHTML = `<p class="panel-error">The ravens were lost in a storm. (${esc(err.message)})</p>`;
    }
  }

  /* ---------------------------------------------------- search ---- */
  let searchIdx = -1;
  function runSearch(q) {
    q = q.trim().toLowerCase();
    searchIdx = -1;
    if (!q) { searchResults.classList.remove('on'); searchResults.innerHTML = ''; return; }
    const hits = PLACES
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs || a.tier - b.tier || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
    if (!hits.length) {
      searchResults.innerHTML = '<div class="sr-empty">No such place is known to the maesters.</div>';
      searchResults.classList.add('on');
      return;
    }
    searchResults.innerHTML = hits.map((p) =>
      `<button class="sr-item" data-id="${esc(p.id)}">
         <span class="sr-name">${esc(p.name)}</span>
         <span class="sr-meta">${esc(TYPE_LABEL[p.type])} · ${esc(regionById.get(p.region).name)}</span>
       </button>`).join('');
    searchResults.classList.add('on');
    searchResults.querySelectorAll('.sr-item').forEach((b) =>
      b.addEventListener('click', () => pickSearch(b.dataset.id)));
  }

  function pickSearch(id) {
    searchResults.classList.remove('on');
    searchInput.value = '';
    openPlace(id, true);
  }

  searchInput.addEventListener('input', (e) => runSearch(e.target.value));
  searchInput.addEventListener('keydown', (e) => {
    const items = [...searchResults.querySelectorAll('.sr-item')];
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      searchIdx = (searchIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === searchIdx));
    } else if (e.key === 'Enter') {
      pickSearch(items[Math.max(searchIdx, 0)].dataset.id);
    } else if (e.key === 'Escape') {
      searchResults.classList.remove('on');
      searchInput.blur();
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) searchResults.classList.remove('on');
  });
})();
