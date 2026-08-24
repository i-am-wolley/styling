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

- `data/pairings.json` — curated "Complete Looks", each with a `name`, `occasions` (`work`/`family`/`travel`), an `items` list of ids, and a written `why`

`data/pairings.json` is loaded, but never trusted blindly: the Outfit Builder re-checks every item pair inside each curated look against the same `pairCompatibility()` rules used everywhere else, on every render. A look only shows a "Wear this" button if it still passes; if item data changes later and breaks one, it's shown disabled with the exact reason instead of silently staying wrong. This is on top of, not instead of, the live Suggested Pairings panel below it — Complete Looks is for browsing full outfits by occasion, Suggested Pairings is for "what goes with this one piece I just picked." Add a new curated look by adding an entry with real item ids from `items.json`; if the ids don't form a rule-passing combination, it'll show up flagged rather than being hidden.

None of this requires touching `js/app.js` or `css/style.css` — the code just reads whatever is in these files.

## A deliberate technical choice, worth knowing

The Outfit Builder does **not** composite real product photography. The original brief specification called for a luminance-preserving recolour of real garment photos; building that required either scraping copyrighted product images (a licensing problem for something you're hosting) or you supplying photography for every piece. Instead, the figure is built from clean flat-vector garment shapes, coloured directly from each item's `hex`, layered with drop-shadows for depth and simple texture overlays for denim/knit. It's instant, free, no AI, no external requests — the same requirements the brief specified — just achieved with vector art instead of photo compositing. If you'd rather have photo-based rendering later, the `garmentLayer()` function in `js/app.js` is the one place that would need to change.

## Layer B (AI render)

Wired up under the "Render on Me (AI)" tab in the Outfit Builder. It needs your own reference photo and your own Gemini API key, entered in the browser — both stay in browser memory/localStorage only, never written to a file or committed. Nothing is sent anywhere except the direct browser→Google API call you trigger by clicking Render.
