/* ============================================================
 * WesterosMap — a small, dependency-free SVG map engine.
 *
 *  - pan (drag / touch), zoom (wheel / pinch / dblclick / buttons)
 *  - Google-Maps-style level of detail: place markers appear in
 *    tiers as you zoom in; big cartographic labels fade out
 *  - markers keep constant screen size (counter-scaled by 1/k)
 *  - emits onPlaceClick / onRegionClick / onHover callbacks
 * ============================================================ */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const GEO = window.WesterosGeo;

  // zoom (relative to fitted scale) at which each tier appears
  const TIER_AT = { 1: 0, 2: 1.75, 3: 3.1 };
  const LABEL_FADE_AT = 2.4;      // region/sea display names fade past this
  const SEA_TIER_AT = { 1: 0, 2: 1.4, 3: 2.6 };
  const SEA_TIER_MAX = { 1: 3.2, 2: Infinity, 3: Infinity };

  const MARKER_GLYPHS = {
    capital: 'M0,-7 L1.9,-1.9 L7,0 L1.9,1.9 L0,7 L-1.9,1.9 L-7,0 L-1.9,-1.9 Z',
    city:    'M-4.5,-4.5 H4.5 V4.5 H-4.5 Z',
    castle:  'M-4.5,4 V-2 H-2.7 V-4.5 H-1.2 V-2 H1.2 V-4.5 H2.7 V-2 H4.5 V4 Z',
    ruin:    'M-4.5,4 V-2 H-2.7 V-4.5 H-1.2 V-2 H1.2 V-4.5 H2.7 V-2 H4.5 V4 Z',
    town:    'M0,-3.2 A3.2,3.2 0 1,0 0.001,-3.2 Z',
    landmark:'M0,-5 L5,0 L0,5 L-5,0 Z',
  };

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /**
   * Organic coastlines: recursively subdivide each edge, displacing the
   * midpoint along the edge normal by a deterministic pseudo-random amount.
   * The displacement is derived from the edge's endpoint coordinates in
   * *canonical* order, so two regions traversing their shared border in
   * opposite directions produce byte-identical points — no gaps, ever.
   */
  function roughen(src, closed, rounds = 2, amp = 0.12, minLen = 14) {
    let cur = src;
    for (let r = 0; r < rounds; r++) {
      const out = [];
      const n = cur.length, edges = closed ? n : n - 1;
      for (let i = 0; i < edges; i++) {
        const a = cur[i], b = cur[(i + 1) % n];
        out.push(a);
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        if (len < minLen) continue;
        const fwd = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
        const p = fwd ? a : b, q = fwd ? b : a;
        let h = Math.sin(p[0] * 127.1 + p[1] * 311.7 + q[0] * 74.7 + q[1] * 269.5) * 43758.5453;
        h = 2 * (h - Math.floor(h)) - 1;                 // [-1, 1]
        const s = (fwd ? 1 : -1) * h * amp * len;
        out.push([(a[0] + b[0]) / 2 + (dy / len) * s, (a[1] + b[1]) / 2 - (dx / len) * s]);
      }
      if (!closed) out.push(cur[n - 1]);
      cur = out;
    }
    return cur;
  }

  class WesterosMap {
    constructor(container, places, callbacks) {
      this.container = container;
      this.places = places;
      this.cb = callbacks || {};
      this.k = 1; this.tx = 0; this.ty = 0;
      this.k0 = 1;
      this.markers = [];
      this.pointers = new Map();
      this.moved = false;
      this._raf = null;
      this._anim = null;

      this._build();
      this._bind();
      this.fit();
    }

    /* ------------------------------------------------ building ---- */
    _build() {
      const svg = el('svg', { class: 'wmap', width: '100%', height: '100%' }, this.container);
      this.svg = svg;

      const defs = el('defs', {}, svg);
      // parchment grain
      const noise = el('filter', { id: 'grain', x: '0%', y: '0%', width: '100%', height: '100%' }, defs);
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', result: 'n' }, noise);
      el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.5 0' }, noise);
      // soft shadow under the landmass
      const sh = el('filter', { id: 'landshadow', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
      el('feDropShadow', { dx: '0', dy: '4', stdDeviation: '7', 'flood-color': '#0d2b33', 'flood-opacity': '0.45' }, sh);
      // sea gradient
      const grad = el('radialGradient', { id: 'seaGrad', cx: '50%', cy: '42%', r: '75%' }, defs);
      el('stop', { offset: '0%', 'stop-color': '#88aeb4' }, grad);
      el('stop', { offset: '70%', 'stop-color': '#75a0a8' }, grad);
      el('stop', { offset: '100%', 'stop-color': '#5d8791' }, grad);
      // wave pattern
      const wave = el('pattern', { id: 'waves', width: '110', height: '70', patternUnits: 'userSpaceOnUse' }, defs);
      el('path', { d: 'M8,18 q9,-7 18,0 q9,7 18,0 M62,50 q9,-7 18,0 q9,7 18,0', fill: 'none', stroke: '#f2efe4', 'stroke-opacity': '0.14', 'stroke-width': '1.4', 'stroke-linecap': 'round' }, wave);

      const F = GEO.FRAME;
      const fclip = el('clipPath', { id: 'frameClip' }, defs);
      el('rect', { x: F.x, y: F.y, width: F.w, height: F.h }, fclip);

      this.vp = el('g', {}, svg);
      // everything on the chart is clipped to the frame; the world "ends" here
      this.world = el('g', { 'clip-path': 'url(#frameClip)' }, this.vp);

      // --- sea ---
      el('rect', { x: F.x, y: F.y, width: F.w, height: F.h, fill: 'url(#seaGrad)' }, this.world);
      el('rect', { x: F.x, y: F.y, width: F.w, height: F.h, fill: 'url(#waves)' }, this.world);

      // organic coastlines, computed once (shared borders stay identical)
      const RPOLYS = GEO.REGIONS.map((r) => r.polys.map((p) => roughen(p, true)));

      // --- land ---
      const land = el('g', { filter: 'url(#landshadow)' }, this.world);
      // pale "shallows" halo drawn under the fills
      for (const rp of RPOLYS)
        for (const poly of rp)
          el('polygon', { points: pts(poly), fill: 'none', stroke: '#d8e4de', 'stroke-opacity': '0.5', 'stroke-width': '10', 'stroke-linejoin': 'round' }, land);

      this.regionEls = [];
      GEO.REGIONS.forEach((r, ri) => {
        const g = el('g', { class: 'region', 'data-region': r.id }, land);
        for (const poly of RPOLYS[ri])
          el('polygon', {
            points: pts(poly), fill: r.color,
            stroke: '#57422d', 'stroke-width': '1.1', 'stroke-linejoin': 'round',
            'vector-effect': 'non-scaling-stroke',
          }, g);
        g.addEventListener('click', (e) => {
          if (this.moved) return;
          e.stopPropagation();
          if (this.cb.onRegionClick) this.cb.onRegionClick(r);
        });
        this.regionEls.push(g);
      });
      // parchment grain over the land only (subtle)
      const grain = el('g', { style: 'pointer-events:none', opacity: '0.14', filter: 'url(#grain)' }, this.world);
      for (const rp of RPOLYS)
        for (const poly of rp) el('polygon', { points: pts(poly) }, grain);

      // --- water features ---
      const waterG = el('g', { style: 'pointer-events:none' }, this.world);
      for (const lake of GEO.LAKES)
        el('polygon', { points: pts(roughen(lake.pts, true)), fill: '#7ba4ac', stroke: '#57787f', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' }, waterG);
      for (const isle of GEO.LAKE_ISLES)
        el('polygon', { points: pts(isle.pts), fill: '#b6c4a2', stroke: '#57422d', 'stroke-width': '0.8', 'vector-effect': 'non-scaling-stroke' }, waterG);
      for (const river of GEO.RIVERS)
        el('polyline', {
          points: pts(roughen(river.pts, false, 2, 0.1)), fill: 'none', stroke: '#6d99a2',
          'stroke-width': river.major ? 2.2 : 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          'vector-effect': 'non-scaling-stroke', opacity: '0.9',
        }, waterG);

      // --- roads ---
      const roadG = el('g', { style: 'pointer-events:none' }, this.world);
      for (const road of GEO.ROADS)
        el('polyline', {
          points: pts(roughen(road.pts, false, 1, 0.07)), fill: 'none', stroke: '#8a6a44', 'stroke-width': 1,
          'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke', opacity: '0.5',
        }, roadG);

      // --- political borders (dashed) ---
      const borderG = el('g', { style: 'pointer-events:none' }, this.world);
      for (const b of GEO.BORDERS)
        el('polyline', {
          points: pts(roughen(b, false)), fill: 'none', stroke: '#7c3b2e', 'stroke-width': 1.4,
          'stroke-dasharray': '7 4 2 4', 'vector-effect': 'non-scaling-stroke', opacity: '0.75',
        }, borderG);

      // --- the Wall (roughened like the region border beneath it, so the
      // ice line and the political line coincide exactly) ---
      const wallPts = pts(roughen(GEO.WALL, false));
      el('polyline', { points: wallPts, fill: 'none', stroke: '#41606e', 'stroke-width': 7.5, 'stroke-linecap': 'round', opacity: 0.35, style: 'pointer-events:none' }, this.world);
      el('polyline', { points: wallPts, fill: 'none', stroke: '#eaf4f8', 'stroke-width': 5.5, 'stroke-linecap': 'round', style: 'pointer-events:none' }, this.world);

      // --- terrain glyphs (mountains, trees) ---
      const decoG = el('g', { class: 'decor', style: 'pointer-events:none' }, this.world);
      for (const d of GEO.DECOR) {
        d.pts.forEach(([x, y], i) => {
          const s = 0.8 + ((i * 37) % 5) * 0.11;   // deterministic size jitter
          const g = el('g', { transform: `translate(${x} ${y}) scale(${s})` }, decoG);
          if (d.type === 'mtn') {
            el('path', { d: 'M-9,5 L0,-8 L9,5 Z', fill: '#cbbb96', stroke: '#7d6547', 'stroke-width': '1.1', 'stroke-linejoin': 'round' }, g);
            el('path', { d: 'M0,-8 L3,5', fill: 'none', stroke: '#7d6547', 'stroke-width': '0.7', opacity: '0.6' }, g);
          } else {
            el('path', { d: 'M0,5 L0,1 M-4.5,2 L0,-6.5 L4.5,2 Z', fill: '#9fb287', stroke: '#5d6b48', 'stroke-width': '1', 'stroke-linejoin': 'round' }, g);
          }
        });
      }

      // --- cartographic labels ---
      this.regionLabelG = el('g', { class: 'region-labels', style: 'pointer-events:none' }, this.world);
      for (const L of GEO.REGION_LABELS)
        el('text', {
          x: L.x, y: L.y, class: 'region-label', 'font-size': L.size,
          'text-anchor': 'middle', transform: `rotate(${L.rot} ${L.x} ${L.y})`,
        }, this.regionLabelG).textContent = L.text;

      this.seaLabels = GEO.SEA_LABELS.map((L) => {
        const t = el('text', {
          x: L.x, y: L.y, class: 'sea-label', 'font-size': L.size,
          'text-anchor': 'middle', transform: `rotate(${L.rot} ${L.x} ${L.y})`,
          style: 'pointer-events:none',
        }, this.world);
        t.textContent = L.text;
        return { el: t, tier: L.tier };
      });

      this._buildFlourishes();

      // --- place markers (topmost) ---
      this.markerG = el('g', {}, this.world);
      for (const p of this.places) {
        // born hidden and pre-positioned; the first LOD pass reveals its tier
        const g = el('g', {
          class: `marker t-${p.type} hidden`, 'data-id': p.id,
          transform: `translate(${p.x} ${p.y})`,
        }, this.markerG);
        el('circle', { class: 'marker-hit', cx: 0, cy: 0, r: 14, fill: 'transparent' }, g);
        const glyph = el('path', { class: 'marker-glyph', d: MARKER_GLYPHS[p.type] || MARKER_GLYPHS.town }, g);
        if (p.type === 'ruin') glyph.setAttribute('class', 'marker-glyph ruin');
        // Essos hugs the map's east edge — put labels on the left so they
        // don't run off the frame.
        const left = p.region === 'essos';
        const label = el('text', {
          class: `marker-label ml-${p.type}`,
          x: left ? -10 : 10, y: 4,
          'text-anchor': left ? 'end' : 'start',
        }, g);
        label.textContent = p.name;
        g.addEventListener('click', (e) => {
          if (this.moved) return;
          e.stopPropagation();
          if (this.cb.onPlaceClick) this.cb.onPlaceClick(p);
        });
        g.addEventListener('pointerenter', (e) => this.cb.onHover && this.cb.onHover(p, e));
        g.addEventListener('pointermove', (e) => this.cb.onHover && this.cb.onHover(p, e));
        g.addEventListener('pointerleave', () => this.cb.onHover && this.cb.onHover(null));
        this.markers.push({ p, el: g, visible: null });
      }

      // --- neatline: the chart's decorative border, outside the clip ---
      el('rect', {
        x: F.x, y: F.y, width: F.w, height: F.h, fill: 'none',
        stroke: '#3a2d1d', 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke',
        style: 'pointer-events:none',
      }, this.vp);
      el('rect', {
        x: F.x + 7, y: F.y + 7, width: F.w - 14, height: F.h - 14, fill: 'none',
        stroke: '#57422d', 'stroke-width': 1, 'stroke-opacity': 0.7,
        'vector-effect': 'non-scaling-stroke', style: 'pointer-events:none',
      }, this.vp);

      svg.addEventListener('click', () => {
        if (!this.moved && this.cb.onBackgroundClick) this.cb.onBackgroundClick();
      });
    }

    _buildFlourishes() {
      // compass rose (bottom right, in the Summer Sea)
      const c = el('g', { class: 'compass', transform: 'translate(880 1240)', style: 'pointer-events:none' }, this.world);
      el('circle', { r: 34, fill: 'none', stroke: '#e9e2cd', 'stroke-width': 1.2, opacity: 0.8 }, c);
      el('circle', { r: 27, fill: 'none', stroke: '#e9e2cd', 'stroke-width': 0.6, opacity: 0.6 }, c);
      for (let i = 0; i < 8; i++) {
        const a = (i * 45 * Math.PI) / 180, long = i % 2 === 0;
        const r1 = long ? 32 : 20;
        el('path', {
          d: `M0,0 L${Math.sin(a - 0.12) * 7},${-Math.cos(a - 0.12) * 7} L${Math.sin(a) * r1},${-Math.cos(a) * r1} L${Math.sin(a + 0.12) * 7},${-Math.cos(a + 0.12) * 7} Z`,
          fill: long ? '#e9e2cd' : '#a9c2c4', opacity: 0.85,
        }, c);
      }
      const n = el('text', { y: -40, 'text-anchor': 'middle', class: 'compass-n' }, c);
      n.textContent = 'N';

      // title cartouche (bottom left, in the Sunset Sea)
      const t = el('g', { class: 'cartouche', transform: 'translate(155 1245)', style: 'pointer-events:none' }, this.world);
      el('rect', { x: -145, y: -46, width: 290, height: 96, fill: '#efe7d2', stroke: '#57422d', 'stroke-width': 1.4, rx: 3, opacity: 0.94 }, t);
      el('rect', { x: -138, y: -39, width: 276, height: 82, fill: 'none', stroke: '#8a6a44', 'stroke-width': 0.8, rx: 2 }, t);
      const t1 = el('text', { y: -10, 'text-anchor': 'middle', class: 'cart-title' }, t);
      t1.textContent = 'WESTEROS ATLAS';
      const t2 = el('text', { y: 12, 'text-anchor': 'middle', class: 'cart-sub' }, t);
      t2.textContent = 'The Seven Kingdoms & the Narrow Sea';
      const t3 = el('text', { y: 32, 'text-anchor': 'middle', class: 'cart-sub2' }, t);
      t3.textContent = 'as drawn in the 300th year After Conquest';
    }

    /* --------------------------------------------- view control ---- */
    fit() {
      const r = this.container.getBoundingClientRect();
      const F = GEO.FRAME;
      const pad = 24;
      const raw = Math.min((r.width - pad) / F.w, (r.height - pad) / F.h);
      this._degenerate = !(raw > 0.02);   // container not really laid out yet
      this.k0 = Math.max(raw, 0.01);
      this.k = this.k0;
      this.tx = (r.width - F.w * this.k) / 2 - F.x * this.k;
      this.ty = (r.height - F.h * this.k) / 2 - F.y * this.k;
      this._apply();
    }

    // Keep the frame covering the viewport: no panning into the void.
    // If the frame is smaller than the viewport on an axis, center it.
    _clampTxTy(tx, ty, k, r) {
      const F = GEO.FRAME;
      if (F.w * k <= r.width) tx = (r.width - F.w * k) / 2 - F.x * k;
      else tx = clamp(tx, r.width - (F.x + F.w) * k, -F.x * k);
      if (F.h * k <= r.height) ty = (r.height - F.h * k) / 2 - F.y * k;
      else ty = clamp(ty, r.height - (F.y + F.h) * k, -F.y * k);
      return [tx, ty];
    }

    zoomBy(factor, cx, cy) {
      const r = this.container.getBoundingClientRect();
      this.zoomAt(cx ?? r.width / 2, cy ?? r.height / 2, this.k * factor);
    }

    zoomAt(mx, my, k2) {
      this._interacted = true;
      k2 = clamp(k2, this.k0, this.k0 * 16);
      this.tx = mx - ((mx - this.tx) * k2) / this.k;
      this.ty = my - ((my - this.ty) * k2) / this.k;
      this.k = k2;
      this._apply();
    }

    flyTo(x, y, zRel, done) {
      this._interacted = true;
      const r = this.container.getBoundingClientRect();
      const k2 = clamp(this.k0 * zRel, this.k0, this.k0 * 16);
      const from = { k: this.k, tx: this.tx, ty: this.ty };
      const [ttx, tty] = this._clampTxTy(r.width / 2 - x * k2, r.height / 2 - y * k2, k2, r);
      const to = { k: k2, tx: ttx, ty: tty };
      if (this._anim) cancelAnimationFrame(this._anim);
      if (document.hidden) {   // no animation frames in background tabs: jump
        this.k = to.k; this.tx = to.tx; this.ty = to.ty;
        this._apply();
        if (done) done();
        return;
      }
      const t0 = performance.now(), dur = 750;
      const step = (now) => {
        const t = ease(clamp((now - t0) / dur, 0, 1));
        this.k = from.k + (to.k - from.k) * t;
        this.tx = from.tx + (to.tx - from.tx) * t;
        this.ty = from.ty + (to.ty - from.ty) * t;
        this._apply();
        if (t < 1) this._anim = requestAnimationFrame(step);
        else { this._anim = null; if (done) done(); }
      };
      this._anim = requestAnimationFrame(step);
    }

    _apply() {
      // rAF doesn't fire in hidden/background tabs — write synchronously
      // there so the map is correct the moment the tab becomes visible.
      if (document.hidden) { this._applyNow(); return; }
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = null;
        this._applyNow();
      });
    }

    _applyNow() {
      if (!this._degenerate) {
        const r = this.container.getBoundingClientRect();
        [this.tx, this.ty] = this._clampTxTy(this.tx, this.ty, this.k, r);
      }
      this.vp.setAttribute('transform', `translate(${this.tx} ${this.ty}) scale(${this.k})`);
      this._updateLOD();
      if (this.cb.onView) this.cb.onView(this.k / this.k0);
    }

    _updateLOD() {
      const z = this.k / this.k0;
      const inv = 1 / this.k;
      for (const m of this.markers) {
        const show = z >= TIER_AT[m.p.tier];
        if (show) m.el.setAttribute('transform', `translate(${m.p.x} ${m.p.y}) scale(${inv})`);
        if (show !== m.visible) {
          m.visible = show;
          m.el.classList.toggle('hidden', !show);
        }
      }
      this.regionLabelG.style.opacity = z > LABEL_FADE_AT ? 0.16 : 0.85;
      for (const s of this.seaLabels) {
        const on = z >= SEA_TIER_AT[s.tier] && z <= SEA_TIER_MAX[s.tier];
        s.el.style.opacity = on ? 0.75 : 0;
      }
    }

    /* ------------------------------------------------- input ------ */
    _bind() {
      const svg = this.svg;
      svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = this.container.getBoundingClientRect();
        const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
        this.zoomAt(e.clientX - r.left, e.clientY - r.top, this.k * f);
      }, { passive: false });

      svg.addEventListener('dblclick', (e) => {
        e.preventDefault();
        const r = this.container.getBoundingClientRect();
        this.zoomAt(e.clientX - r.left, e.clientY - r.top, this.k * 1.9);
      });

      svg.addEventListener('pointerdown', (e) => {
        // Don't capture yet — capturing retargets the eventual `click` to the
        // svg, which would swallow marker/region clicks. Capture on first move.
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.moved = false;
        if (this.pointers.size === 2) {
          const [a, b] = [...this.pointers.values()];
          this._pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.k };
        }
        svg.classList.add('grabbing');
      });

      svg.addEventListener('pointermove', (e) => {
        const prev = this.pointers.get(e.pointerId);
        if (!prev) return;
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
        if (this.moved && !svg.hasPointerCapture(e.pointerId)) {
          try { svg.setPointerCapture(e.pointerId); } catch (_) { /* pointer may be gone */ }
        }

        if (this.pointers.size === 1) {
          this._interacted = true;
          this.tx += dx; this.ty += dy;
          this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          this._apply();
        } else if (this.pointers.size === 2) {
          this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const [a, b] = [...this.pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const r = this.container.getBoundingClientRect();
          const mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
          this.zoomAt(mid.x, mid.y, this._pinch.k * (d / this._pinch.d));
        }
      });

      const up = (e) => {
        this.pointers.delete(e.pointerId);
        if (this.pointers.size === 0) svg.classList.remove('grabbing');
        // let click handlers read this.moved first, then reset
        setTimeout(() => { this.moved = false; }, 0);
      };
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', up);

      // Re-fit whenever the container is (re)sized, until the user has
      // taken control of the view — also covers containers that are 0×0
      // at construction time (e.g. panels that lay out after load).
      new ResizeObserver(() => {
        if (!this._interacted || this._degenerate) this.fit();
        else this._apply();
      }).observe(this.container);
    }
  }

  window.WesterosMap = WesterosMap;
})();
