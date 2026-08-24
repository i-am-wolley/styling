# Wardrobe Architect

Your personal stylist site — built from Phases 0–5 of the project. Plain HTML/CSS/JS, no build step, no framework.

## Running it locally

Browsers block `fetch()` of local JSON files opened via `file://`, so you need a tiny local server — this is normal for any static site, not specific to this one.

```
cd site
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Hosting it for real

Any static host works — this is a plain folder of HTML/CSS/JS/JSON:
- **GitHub Pages**: push this folder to a repo, enable Pages on it, done.
- **Vercel / Netlify**: drag-and-drop the `site` folder or connect the repo — no build command needed.

## Adding or editing pieces

Everything you own or plan to buy lives in `data/items.json` — one object per garment. Add a new one by copying an existing entry and changing the fields:

```json
{ "id": "unique-id", "name": "...", "brand": "...", "category": "top|bottom|outerwear|footwear|accessory",
  "shape": "tee|shirt|polo|knit|blazer|overshirt|shell|chino|trouser|jogger|jeans|cargo|sneaker|derby|loafer|boot|belt|watch|glasses|glasses-angular|sunglasses|kurta",
  "silhouette": "slim|tapered|regular|tailored|relaxed|baggy", "colorName": "...", "hex": "#......", "fabric": "...",
  "formality": "casual|smart-casual|business-casual|elevated-casual|athleisure|escalation|festive|...",
  "versatility": 1-5, "owned": true|false, "status": "keep|rescue|retire" }
```

`silhouette` drives the Outfit Builder's compatibility rules directly — two `relaxed`/`baggy` pieces together get dimmed as a silhouette conflict, and the Suggested Pairings card only recommends partners that pass this (plus a formality-gap check and, for festive pieces, keeping that register separate from Western basics). Leave `silhouette` off an item if it doesn't meaningfully apply (footwear, most accessories) — the rule simply skips items without it.

For a roadmap (not-yet-owned) item, set `"owned": false` and add `"phase"` (30/90/180/365), `"tier"` ("essential"/"high-value"/"eventual"), and `"price"`.

Other editable files:
- `data/palette.json` — your colour palette and hypotheses
- `data/dictionary.json` — styling techniques (shows in the Dictionary and drives the Outfit Builder's toggles)
- `data/archetypes.json` — style archetype research and your match
- `data/framework.json` — condensed Phase 0 research

`data/pairings.json` is no longer loaded — Suggested Pairings is now computed live from the rules above instead of a curated list, so every top and bottom gets a real, rule-checked answer (or an explicit "can't be paired") instead of only the combinations someone hand-picked in advance. The file is left in the repo in case you want to mine its written reasoning later, but nothing reads it.

None of this requires touching `js/app.js` or `css/style.css` — the code just reads whatever is in these files.

## A deliberate technical choice, worth knowing

The Outfit Builder does **not** composite real product photography. The original brief specification called for a luminance-preserving recolour of real garment photos; building that required either scraping copyrighted product images (a licensing problem for something you're hosting) or you supplying photography for every piece. Instead, the figure is built from clean flat-vector garment shapes, coloured directly from each item's `hex`, layered with drop-shadows for depth and simple texture overlays for denim/knit. It's instant, free, no AI, no external requests — the same requirements the brief specified — just achieved with vector art instead of photo compositing. If you'd rather have photo-based rendering later, the `garmentLayer()` function in `js/app.js` is the one place that would need to change.

## Layer B (AI render)

Wired up under the "Render on Me (AI)" tab in the Outfit Builder. It needs your own reference photo and your own Gemini API key, entered in the browser — both stay in browser memory/localStorage only, never written to a file or committed. Nothing is sent anywhere except the direct browser→Google API call you trigger by clicking Render.
