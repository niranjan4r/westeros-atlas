# Westeros Atlas — An Interactive Map of the Seven Kingdoms

A dependency-free, static frontend app: a hand-drawn SVG map of Westeros
(A Song of Ice and Fire) with Google-Maps-style interaction. The western
shore of Essos — Braavos, Pentos, Myr, Tyrosh, Lys, Volantis — runs off
the map's eastern edge, and panning is clamped to the chart's neatline.

## Features

- **Pan & zoom** — drag, mouse wheel, pinch, double-click, or the `+ / − / ⌂` controls.
- **Level of detail** — like Google Maps, only the ten great seats show when zoomed
  out; major castles, cities and towns appear at mid zoom; minor seats, ruins and
  landmarks appear up close. Sea and realm names fade in/out with zoom too.
- **Clear borders** — each of the nine realms (plus the lands beyond the Wall) is a
  distinctly tinted polygon; political borders are dashed red lines, and neighbouring
  realms share the exact same border geometry so nothing ever gaps or overlaps.
- **Click anything** — clicking a place opens a details panel with its seat, history
  and major events; clicking open land opens the realm's details and a list of its
  notable places. ~100 places ship with the app.
- **Search** — find any place by name and fly to it.
- Rivers, roads (Kingsroad, Roseroad, Goldroad…), mountains, forests, the Wall,
  a compass rose and a title cartouche, because a map should be pretty.
- **Organic coastlines** — polygons are deterministically subdivided and jittered
  at render time (`roughen()` in `js/map.js`); shared borders are displaced from
  canonical edge coordinates, so neighbouring regions still match exactly.
- **A finite chart** — the map is clipped to a decorative neatline frame and
  panning/zooming is clamped to it; no infinite scrolling into empty sea.
- An unofficial-fan-work disclaimer is shown in the footer.

## Running it

It's fully static — no build step.

```sh
# either just open the file…
open index.html

# …or serve it (nicer URLs, no file:// quirks)
python3 -m http.server 4173
# → http://localhost:4173
```

## Structure

```
index.html          page shell (header, search, panel, legend, controls)
css/style.css       all styling
js/data/regions.js  region polygons (from shared border segments), rivers,
                    roads, lakes, terrain decorations, cartographic labels
js/data/places.js   ~100 places: coords, tier (zoom level), type, lore details
js/api.js           WesterosAPI — the backend seam (see below)
js/map.js           WesterosMap — SVG pan/zoom/LOD engine, no dependencies
js/app.js           wiring: panel, tooltip, search, zoom controls
```

## Wiring up a backend later

The details panel never reads the data files directly — everything goes through
`js/api.js`:

```js
WesterosAPI.getPlaceDetails(id)  // → Promise<{ id, name, region, type, seat, blurb, history, events }>
WesterosAPI.getRegionDetails(id) // → Promise<{ id, name, house, seat, words, blurb, color }>
```

To serve details from a backend, replace those two function bodies with `fetch()`
calls (a commented example is in the file). The panel already handles the loading
and error states. `events` is a list of `[when, what]` pairs.

Adding a place is one entry in `js/data/places.js` — give it `x/y` map
coordinates, a `tier` (1 = always visible, 2 = mid zoom, 3 = close zoom), a
`type` (`capital | city | castle | town | ruin | landmark`), and its lore.
