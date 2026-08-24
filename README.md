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
  "shape": "tee|shirt|polo|knit|blazer|overshirt|shell|chino|trouser|jogger|jeans|cargo|sneaker|derby|loafer|boot|belt|watch|glasses|glasses-angular|sunglasses",
  "colorName": "...", "hex": "#......", "fabric": "...", "formality": "casual|smart-casual|business-casual|elevated-casual|athleisure|escalation|...",
  "versatility": 1-5, "owned": true|false, "status": "keep|rescue|retire" }
```

For a roadmap (not-yet-owned) item, set `"owned": false` and add `"phase"` (30/90/180/365), `"tier"` ("essential"/"high-value"/"eventual"), and `"price"`.

Other editable files:
- `data/palette.json` — your colour palette and hypotheses
- `data/dictionary.json` — styling techniques (shows in the Dictionary and drives the Outfit Builder's toggles)
- `data/pairings.json` — curated outfit blocks with the colour reasoning written out
- `data/archetypes.json` — style archetype research and your match
- `data/framework.json` — condensed Phase 0 research

None of this requires touching `js/app.js` or `css/style.css` — the code just reads whatever is in these files.

## A deliberate technical choice, worth knowing

The Outfit Builder does **not** composite real product photography. The original brief specification called for a luminance-preserving recolour of real garment photos; building that required either scraping copyrighted product images (a licensing problem for something you're hosting) or you supplying photography for every piece. Instead, the figure is built from clean flat-vector garment shapes, coloured directly from each item's `hex`, layered with drop-shadows for depth and simple texture overlays for denim/knit. It's instant, free, no AI, no external requests — the same requirements the brief specified — just achieved with vector art instead of photo compositing. If you'd rather have photo-based rendering later, the `garmentLayer()` function in `js/app.js` is the one place that would need to change.

## Layer B (AI render)

Not yet wired up. When you're ready: it needs an image-generation API key (Gemini/Flux-class) that **you** supply — never hardcode a key into these files or commit one to a repo. Ask to have this added when you have a key in hand.
