/* ============================================================
 * WesterosAPI — the data-access seam.
 *
 * Everything the details panel shows goes through these two
 * functions. Today they resolve from the bundled data; to wire
 * up a backend, replace the bodies with fetch() calls, e.g.:
 *
 *   async getPlaceDetails(id) {
 *     const res = await fetch(`/api/places/${id}`);
 *     if (!res.ok) throw new Error(res.statusText);
 *     return res.json();
 *   }
 *
 * Expected payload shape (see js/data/places.js):
 *   { id, name, region, type, seat, blurb, history, events: [[when, what], ...] }
 * ============================================================ */
(function () {
  'use strict';

  const byId = new Map(window.WesterosPlaces.map((p) => [p.id, p]));
  const regionById = new Map(window.WesterosGeo.REGIONS.map((r) => [r.id, r]));

  // small simulated latency so the panel's loading state stays honest
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  window.WesterosAPI = {
    async getPlaceDetails(id) {
      await delay(120);
      const p = byId.get(id);
      if (!p) throw new Error(`Unknown place: ${id}`);
      return p;
    },

    async getRegionDetails(id) {
      await delay(120);
      const r = regionById.get(id);
      if (!r) throw new Error(`Unknown region: ${id}`);
      return r;
    },
  };
})();
