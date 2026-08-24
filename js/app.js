// ---------- Data ----------
let ITEMS = [], PALETTE = null, DICTIONARY = [], ARCHETYPES = null, FRAMEWORK = null, PAIRINGS = [];

async function loadData() {
  const [items, palette, dictionary, pairings] = await Promise.all([
    fetch('data/items.json').then(r => r.json()),
    fetch('data/palette.json').then(r => r.json()),
    fetch('data/dictionary.json').then(r => r.json()),
    fetch('data/pairings.json').then(r => r.json()),
  ]);
  ITEMS = items; PALETTE = palette; DICTIONARY = dictionary; PAIRINGS = pairings;
  try { ARCHETYPES = await fetch('data/archetypes.json').then(r => r.json()); } catch (e) { ARCHETYPES = null; }
  try { FRAMEWORK = await fetch('data/framework.json').then(r => r.json()); } catch (e) { FRAMEWORK = null; }
}

const byId = id => ITEMS.find(i => i.id === id);
const owned = () => ITEMS.filter(i => i.owned);
const roadmap = () => ITEMS.filter(i => !i.owned);

// ---------- Silhouette compatibility ----------
// General menswear proportion principle: balance loose with fitted. Two loose/baggy
// pieces together add volume without a counterpoint (worse at 172cm, per §0.4's
// column-of-colour and rule-of-thirds logic already in the Framework) — so baggy-on-baggy
// is flagged as a hard rule, not just a soft warning.
const LOOSE_SILHOUETTES = ['baggy', 'relaxed'];
function isLoose(sil) { return LOOSE_SILHOUETTES.includes(sil); }
function silhouetteConflict(a, b) {
  if (!a || !b || !a.silhouette || !b.silhouette) return null;
  if (isLoose(a.silhouette) && isLoose(b.silhouette)) {
    return `${a.name} (${a.silhouette}) + ${b.name} (${b.silhouette}) — both loose adds volume without a counterpoint. Balance loose with fitted instead.`;
  }
  return null;
}
// Belt/shoe leather: the one exception-free coordination rule from the Dictionary.
function leatherConflict(a, b) {
  const leatherCats = ['footwear', 'accessory'];
  if (!leatherCats.includes(a.category) || !leatherCats.includes(b.category)) return null;
  const isBlack = i => (i.colorName || '').toLowerCase().includes('black');
  const isBrown = i => ['tan', 'brown'].some(w => (i.colorName || '').toLowerCase().includes(w));
  if ((isBlack(a) && isBrown(b)) || (isBrown(a) && isBlack(b))) {
    return `${a.name} (${a.colorName}) + ${b.name} (${b.colorName}) — never mix black and brown leather, the one exception-free coordination rule.`;
  }
  return null;
}
// Formality gap: a genuinely wide gap (athleisure paired with business-casual/
// escalation) reads as a mistake, not a look — but a moderate gap (jogger + polo)
// is completely normal, so the threshold is looser than the score panel's warning.
function formalityGapConflict(a, b) {
  const ra = FORMALITY_RANK[a.formality], rb = FORMALITY_RANK[b.formality];
  if (ra == null || rb == null) return null;
  if (Math.abs(ra - rb) >= 4) {
    return `${a.name} (${a.formality}) + ${b.name} (${b.formality}) — too wide a formality gap to read as deliberate.`;
  }
  return null;
}
// Festive wear (kurta etc.) is its own register per §0.2 — not mixed with Western basics.
// Only checked between torso/leg layers: footwear and accessories are formality-neutral
// (boots or loafers under a kurta is normal Indo-western styling, not a register clash).
function festiveConflict(a, b) {
  const registerCats = ['top', 'bottom', 'outerwear'];
  if (!registerCats.includes(a.category) || !registerCats.includes(b.category)) return null;
  if ((a.formality === 'festive') !== (b.formality === 'festive')) {
    return `${a.name} is festive wear — a separate formality register, not mixed with Western business-casual basics.`;
  }
  return null;
}
// Colour-track mixing (Deep Winter accent + Deep Autumn accent together) is a soft
// flag, not a hard exclude — real, but the swatch test is what actually resolves it.
function colorTrackSoftFlag(a, b) {
  const ca = classifyColor(a.hex), cb = classifyColor(b.hex);
  if (!ca.neutral && !cb.neutral && ca.fam !== 'other' && cb.fam !== 'other' && ca.fam !== cb.fam) {
    return `Mixes the Deep Winter and Deep Autumn palette tracks — worth a swatch test before committing (§Phase 3).`;
  }
  return null;
}
// The single shared compatibility check, used both to dim swatches in the builder
// and to drive the Suggested Pairings card — so "what's dimmed" and "what's
// suggested" always agree instead of drifting into two different rule sets.
function pairCompatibility(a, b) {
  const hard = [];
  [silhouetteConflict, leatherConflict, formalityGapConflict, festiveConflict].forEach(fn => {
    const r = fn(a, b);
    if (r) hard.push(r);
  });
  const soft = colorTrackSoftFlag(a, b);
  return { compatible: hard.length === 0, hard, soft };
}
function hardConflicts(candidate, againstItems) {
  const conflicts = [];
  againstItems.forEach(other => {
    if (!other || other.id === candidate.id) return;
    conflicts.push(...pairCompatibility(candidate, other).hard);
  });
  return conflicts;
}

// ---------- Nav ----------
function setupNav() {
  document.querySelectorAll('.nav-list button').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
}
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + id));
  document.querySelectorAll('.nav-list button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  location.hash = id;
  window.scrollTo(0, 0);
}

// ---------- Wardrobe ----------
function renderWardrobe() {
  const el = document.getElementById('wardrobe-grid');
  const cats = ['all', ...new Set(owned().map(i => i.category))];
  const bar = document.getElementById('wardrobe-filters');
  bar.innerHTML = cats.map(c => `<button class="filter-chip ${c==='all'?'active':''}" data-cat="${c}">${c}</button>`).join('');
  bar.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      bar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      draw(chip.dataset.cat);
    });
  });
  function draw(cat) {
    const list = owned().filter(i => cat === 'all' || i.category === cat);
    el.innerHTML = list.map(i => `
      <div class="card">
        <div class="card-swatch" style="background:${i.hex}"></div>
        <div class="card-head">
          <div>
            <div class="card-title">${i.name}${i.favorite ? ' ★' : ''}</div>
            <div class="card-meta">${i.brand} · ${i.colorName}</div>
          </div>
          <span class="tag ${i.status}">${i.status}</span>
        </div>
        <div class="field">${i.fabric}</div>
        <div class="field"><b>Formality:</b> ${i.formality} · <b>Versatility:</b> ${i.versatility}/5</div>
        ${i.note ? `<div class="field" style="color:var(--ink-faint);font-style:italic;">${i.note}</div>` : ''}
      </div>`).join('');
  }
  draw('all');
}

// ---------- Palette ----------
function renderPalette() {
  const el = document.getElementById('palette-body');
  const swatch = (c) => `<div class="card" style="min-width:130px;"><div class="card-swatch" style="background:${c.hex}"></div><div class="card-title">${c.name}</div><div class="card-meta">${c.hex}</div></div>`;
  el.innerHTML = `
    <p class="field" style="font-size:.95rem;">${PALETTE.confidence}</p>
    <div class="dict-group-label">Core Neutrals — safe under either hypothesis</div>
    <div class="grid">${PALETTE.coreNeutrals.map(swatch).join('')}</div>
    ${PALETTE.hypotheses.map(h => `
      <div class="dict-group-label">${h.name}</div>
      <p class="field">${h.evidence}</p>
      <div class="grid">${h.colors.map(swatch).join('')}</div>
    `).join('')}
    <div class="section-block">
      <div class="section-title">Rules</div>
      <p class="field"><b>Ratio:</b> ${PALETTE.rules.ratio}</p>
      <p class="field"><b>Max colours per outfit:</b> ${PALETTE.rules.maxColors}</p>
      <p class="field">${PALETTE.rules.faceRule}</p>
    </div>
  `;
}

// ---------- Gap Analysis ----------
function renderGaps() {
  const el = document.getElementById('gap-body');
  const cats = ['top','bottom','outerwear','footwear','accessory'];
  const labels = {top:'Tops', bottom:'Bottoms', outerwear:'Outerwear', footwear:'Footwear', accessory:'Accessories'};
  el.innerHTML = cats.map(cat => {
    const ownedCount = owned().filter(i => i.category === cat).length;
    const roadmapCount = roadmap().filter(i => i.category === cat).length;
    const total = ownedCount + roadmapCount;
    const pct = total ? Math.round((ownedCount/total)*100) : 0;
    return `
      <div class="gap-row">
        <div class="gap-cat">${labels[cat]}</div>
        <div>
          <div class="gap-bar-track"><div class="gap-bar-fill" style="width:${pct}%"></div></div>
          <div class="gap-detail">${ownedCount} owned · ${roadmapCount} planned on the Roadmap</div>
        </div>
      </div>`;
  }).join('');
}

// ---------- Roadmap ----------
function renderRoadmap() {
  const el = document.getElementById('roadmap-body');
  const phases = [
    {p:30, label:'30 Days — Essential'},
    {p:90, label:'90 Days — High-value'},
    {p:180, label:'6 Months — Depth & Personality'},
    {p:365, label:'12 Months — Investment & Occasion'},
  ];
  el.innerHTML = phases.map(ph => {
    const items = roadmap().filter(i => i.phase === ph.p);
    if (!items.length) return '';
    return `
      <div class="phase-head"><h3 style="font-size:1.1rem;">${ph.label}</h3></div>
      ${items.map(i => `
        <div class="roadmap-item">
          <div class="roadmap-item-name">${i.name} — ${i.colorName}</div>
          <div class="roadmap-item-price">₹${i.price}</div>
          <div class="roadmap-item-detail">${i.fabric}${i.note ? ' — ' + i.note : ''}</div>
          ${i.construction ? `<div class="roadmap-item-detail"><b>Tell the tailor:</b> ${i.construction}</div>` : ''}
          <div class="roadmap-item-meta">
            <span class="tag ${i.tier === 'essential' ? 'essential' : i.tier === 'high-value' ? 'high' : 'eventual'}">${i.tier}</span>
            <span class="card-meta">${i.brand}</span>
            ${i.link ? `<a href="${i.link}" target="_blank" rel="noopener" class="roadmap-link">Buy / order link ↗</a>` : ''}
            <button class="owned-toggle" data-id="${i.id}">Mark owned</button>
          </div>
        </div>`).join('')}
    `;
  }).join('');
  el.querySelectorAll('.owned-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = byId(btn.dataset.id);
      item.owned = !item.owned;
      renderRoadmap(); renderWardrobe(); renderGaps(); populateBuilderOptions(); renderScores();
    });
  });
}

// ---------- Suggested Pairings (dynamic, rule-based — lives in the score panel) ----------
// Every top and bottom is guaranteed a real, visible answer: a "good" list (clean
// matches), a "caution" list (compatible but colour-track-mixing, flagged why), and
// a "bad" list (hard rule violations, shown deliberately rather than silently hidden —
// so it's obvious the engine is actually rejecting things, not passing everything).
function classifyPartners(item, candidates) {
  const scored = candidates
    .filter(c => c.id !== item.id)
    .map(c => ({ item: c, ...pairCompatibility(item, c) }));
  const good = scored.filter(x => x.compatible && !x.soft)
    .sort((a, b) => (b.item.owned - a.item.owned) || ((b.item.versatility||0) - (a.item.versatility||0)));
  const caution = scored.filter(x => x.compatible && x.soft)
    .sort((a, b) => b.item.owned - a.item.owned);
  const bad = scored.filter(x => !x.compatible)
    .sort((a, b) => b.item.owned - a.item.owned);
  return { good: good.slice(0, 5), caution: caution.slice(0, 3), bad: bad.slice(0, 4) };
}

// ---------- Complete Looks (curated, occasion-tagged — validated live against the same rules) ----------
// pairings.json holds the original hand-picked outfits with their occasion tags and written
// "why". They're never trusted blindly: every pair inside a look is re-checked against
// pairCompatibility() at render time, so if item data changes later and breaks a curated
// combo, it gets visibly flagged here instead of silently staying wrong.
const pairingsFilter = { occasion: 'all', ownedOnly: false };

function classifyLooks(occasion, ownedOnly) {
  return (PAIRINGS || [])
    .filter(p => occasion === 'all' || p.occasions.includes(occasion))
    .map(p => {
      const items = p.items.map(byId).filter(Boolean);
      const hard = [], soft = [];
      for (let a = 0; a < items.length; a++) {
        for (let b = a + 1; b < items.length; b++) {
          const r = pairCompatibility(items[a], items[b]);
          hard.push(...r.hard);
          if (r.soft) soft.push(r.soft);
        }
      }
      return { pairing: p, items, hard, soft, valid: hard.length === 0, allOwned: items.length === p.items.length && items.every(i => i.owned) };
    })
    .filter(x => !ownedOnly || x.allOwned)
    .sort((a, b) => (b.valid - a.valid) || (b.allOwned - a.allOwned));
}

function wearLook(look) {
  [...SLOTS, ...ACCESSORY_SLOTS].forEach(s => builderState[s] = null);
  look.items.map(byId).filter(Boolean).forEach(i => {
    if (i.category === 'top') builderState.top = i.id;
    else if (i.category === 'bottom') builderState.bottom = i.id;
    else if (i.category === 'outerwear') builderState.outerwear = i.id;
    else if (i.category === 'footwear') builderState.footwear = i.id;
    else if (i.category === 'accessory') {
      if (i.shape === 'belt') builderState.belt = i.id;
      else if (i.shape === 'watch') builderState.watch = i.id;
      else if (i.shape.startsWith('glasses')) builderState.glasses = i.id;
    }
  });
  populateBuilderOptions(); renderFigure(); renderScores();
}

// Compact rows, same visual language as the Suggested Pairings rows below — one look
// per line (swatches + name + occasion + verdict badge), expanding inline on click to
// show the "why", the exact rule reason if flagged, and the "Wear this" action. Keeps
// 20 curated looks from dominating the page the way full cards did.
let expandedLookId = null;

function renderCompleteLooks() {
  const el = document.getElementById('looks-panel');
  if (!el) return;
  const occasions = ['all', 'work', 'family', 'travel'];
  const chips = occasions.map(o => `<button class="filter-chip occasion-chip ${pairingsFilter.occasion === o ? 'active' : ''}" data-occasion="${o}">${o}</button>`).join('');
  const looks = classifyLooks(pairingsFilter.occasion, pairingsFilter.ownedOnly);

  const rows = looks.length ? looks.map(l => {
    const swatches = l.items.map(i => `<span class="suggest-swatch" style="background:${i.hex}" title="${i.name} — ${i.colorName}"></span>`).join('');
    const flag = !l.valid ? 'bad' : l.soft.length ? 'caution' : 'good';
    const badgeClass = flag === 'good' ? 'essential' : flag === 'caution' ? 'high' : 'adv';
    const badgeText = flag === 'good' ? 'passes' : flag === 'caution' ? 'caveat' : 'flagged';
    const expanded = expandedLookId === l.pairing.id;
    const missing = l.items.filter(i => !i.owned).map(i => i.name).join(', ');
    const detail = expanded ? `
      <div class="look-detail">
        <div class="pairing-why">${l.pairing.why}</div>
        ${!l.valid ? `<div class="score-note score-bad">No longer recommended: ${l.hard.join(' ')}</div>` : ''}
        ${l.soft.length ? `<div class="score-note score-warn">${l.soft.join(' ')}</div>` : ''}
        ${missing ? `<div class="pairing-missing">Needs from Roadmap: ${missing}</div>` : ''}
        <button class="wear-this-btn" data-look="${l.pairing.id}" ${l.valid ? '' : 'disabled'}>${l.valid ? 'Wear this' : "Can't wear — rules changed"}</button>
      </div>` : '';
    return `
      <div class="look-item">
        <button class="suggest-row flag-${flag}" data-look-toggle="${l.pairing.id}">
          <span class="suggest-swatches">${swatches}</span>
          <span class="suggest-label">${l.pairing.name}</span>
          <span class="tag neutral">${l.pairing.occasions.join('/')}</span>
          <span class="tag ${badgeClass}">${badgeText}</span>
        </button>
        ${detail}
      </div>`;
  }).join('') : `<div class="score-note">No curated looks tagged for this occasion yet.</div>`;

  el.innerHTML = `
    <div class="score-card">
      <h5>Complete Looks</h5>
      <div class="filter-bar" style="margin-bottom:.6rem;">${chips}</div>
      <label class="toggle-label" style="margin-bottom:0;"><input type="checkbox" id="looks-owned-only" ${pairingsFilter.ownedOnly ? 'checked' : ''}> Only show looks I can wear right now</label>
    </div>
    ${rows}
  `;
  el.querySelectorAll('.occasion-chip').forEach(chip => {
    chip.addEventListener('click', () => { pairingsFilter.occasion = chip.dataset.occasion; renderCompleteLooks(); });
  });
  const ownedOnlyCb = el.querySelector('#looks-owned-only');
  if (ownedOnlyCb) ownedOnlyCb.addEventListener('change', () => { pairingsFilter.ownedOnly = ownedOnlyCb.checked; renderCompleteLooks(); });
  el.querySelectorAll('[data-look-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.lookToggle;
      expandedLookId = expandedLookId === id ? null : id;
      renderCompleteLooks();
    });
  });
  el.querySelectorAll('.wear-this-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const look = PAIRINGS.find(p => p.id === btn.dataset.look);
      if (look) wearLook(look);
    });
  });
}

function renderSuggestedPairings() {
  const el = document.getElementById('pairings-panel');
  if (!el) return;
  const topItem = byId(builderState.top);
  const bottomItem = byId(builderState.bottom);
  const allTops = ITEMS.filter(i => i.category === 'top');
  const allBottoms = ITEMS.filter(i => i.category === 'bottom');

  const rowHtml = (x, slot, flag) => `
    <button class="suggest-row flag-${flag}" data-slot="${slot}" data-id="${x.item.id}" ${flag === 'bad' ? 'disabled' : ''}>
      <span class="suggest-swatch" style="background:${x.item.hex}"></span>
      <span class="suggest-label">${x.item.name} — ${x.item.colorName}</span>
      <span class="tag ${x.item.owned ? 'essential' : 'eventual'}">${x.item.owned ? 'owned' : 'roadmap'}</span>
      ${flag !== 'good' ? `<span class="suggest-reason">${flag === 'bad' ? x.hard.join(' ') : x.soft}</span>` : ''}
    </button>`;

  // Tiers now render as side-by-side columns (tier-row) instead of a stacked list,
  // since this panel spans the full builder width once it's its own row below.
  const tierCol = (items, slot, flag, label) => !items.length ? '' : `
    <div class="tier-col">
      <div class="pairing-tier-label ${flag}">${label}</div>
      ${items.map(x => rowHtml(x, slot, flag)).join('')}
    </div>`;
  const tierRow = (groups, slot) => {
    const cols = [
      tierCol(groups.good, slot, 'good', 'Works'),
      tierCol(groups.caution, slot, 'caution', 'Works, with a caveat'),
      tierCol(groups.bad, slot, 'bad', "Won't work"),
    ].join('');
    if (!groups.good.length && !groups.caution.length) return `<div class="score-note score-bad">Can't be paired — nothing in the wardrobe or roadmap is compatible.</div>`;
    return `<div class="tier-row">${cols}</div>`;
  };

  let body;
  if (!topItem && !bottomItem) {
    body = `<div class="score-note">Pick a top or bottom to see what genuinely works with it — and what's explicitly flagged as a bad match, not just silently left out.</div>`;
  } else if (topItem && !bottomItem) {
    body = tierRow(classifyPartners(topItem, allBottoms), 'bottom');
  } else if (bottomItem && !topItem) {
    body = tierRow(classifyPartners(bottomItem, allTops), 'top');
  } else {
    const verdict = pairCompatibility(topItem, bottomItem);
    const thisPairing = verdict.compatible
      ? `<div class="score-note score-good">This top + bottom passes every rule.</div>${verdict.soft ? `<div class="score-note score-warn">${verdict.soft}</div>` : ''}`
      : `<div class="score-note score-bad">Won't work: ${verdict.hard.join(' ')}</div>`;
    body = `
      ${thisPairing}
      <div class="pairing-tier-label good" style="margin-top:1rem;">Other bottoms for this top</div>
      ${tierRow(classifyPartners(topItem, allBottoms.filter(b => b.id !== bottomItem.id)), 'bottom')}
    `;
  }

  el.innerHTML = `<div class="score-card"><h5>Suggested Pairings</h5></div><div class="score-card">${body}</div>`;
  el.querySelectorAll('.suggest-row:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      builderState[btn.dataset.slot] = btn.dataset.id;
      populateBuilderOptions(); renderFigure(); renderScores();
    });
  });
}

function renderPairingsPanel() {
  renderCompleteLooks();
  renderSuggestedPairings();
}

// ---------- Dictionary ----------
function renderDictionary() {
  const el = document.getElementById('dictionary-body');
  const groups = [...new Set(DICTIONARY.map(d => d.group))];
  el.innerHTML = groups.map(g => `
    <div class="dict-group-label">${g}</div>
    <div class="grid">
      ${DICTIONARY.filter(d => d.group === g).map(d => `
        <div class="dict-card">
          <div class="card-head"><span class="card-title">${d.name}</span>${d.difficulty !== 'n/a' ? `<span class="tag ${d.difficulty==='easy'?'easy':d.difficulty==='moderate'?'mod':'adv'}">${d.difficulty}</span>` : ''}</div>
          <p class="field"><b>Mechanics:</b> ${d.mechanics}</p>
          <p class="field"><b>Effect:</b> ${d.effect}</p>
          ${d.use ? `<p class="field"><b>Use:</b> ${d.use}</p>` : ''}
          ${d.avoid ? `<p class="field"><b>Avoid:</b> ${d.avoid}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ---------- Framework ----------
function renderFramework() {
  const el = document.getElementById('framework-body');
  if (FRAMEWORK && FRAMEWORK.sections) {
    el.innerHTML = FRAMEWORK.sections.map(s => `<h3>${s.title}</h3><p>${s.body}</p>`).join('');
  } else {
    el.innerHTML = `<p class="field">Full research is in <b>Research/Phase 0 - Framework.md</b> in the project folder — this page summarizes it once linked into <code>data/framework.json</code>.</p>`;
  }
}

// ---------- Archetypes ----------
function renderArchetypes() {
  const el = document.getElementById('archetype-body');
  if (!ARCHETYPES) {
    el.innerHTML = `<p class="field">Research in progress — this section populates once Phase 6's archetype research completes.</p>`;
    return;
  }
  el.innerHTML = `
    ${ARCHETYPES.recommendation ? `
      <div class="pairing-card" style="border-left:3px solid var(--accent);">
        <div class="pairing-name">Recommended for you</div>
        <p class="pairing-why">${ARCHETYPES.recommendation}</p>
      </div>` : ''}
    <div class="grid">
      ${ARCHETYPES.archetypes.map(a => `
        <div class="card">
          <div class="card-title">${a.name}</div>
          <p class="field">${a.summary}</p>
          <p class="field"><b>Cost reality:</b> ${a.cost}</p>
          <p class="field" style="color:var(--ink-faint);font-style:italic;">${a.limitation}</p>
        </div>
      `).join('')}
    </div>
  `;
}

// ---------- Outfit Builder ----------
const SLOTS = ['top','bottom','outerwear','footwear'];
const ACCESSORY_SLOTS = ['belt','watch','glasses'];
const builderState = { top:null, bottom:null, outerwear:null, footwear:null, belt:null, watch:null, glasses:null, tuck:'untucked', roll:'down', breakStyle:'half' };

const SLOT_HELP = {
  top: 'Tees, shirts, polos, knitwear — worn on the torso.',
  bottom: 'Trousers, chinos, joggers, jeans, cargo.',
  outerwear: 'Layers worn over a top — overshirts, monsoon shells. No blazer: confirmed you never wear one in office, even for escalation.',
  footwear: 'Shoes and boots.',
  belt: 'Waist accessory — shown matched to shoe leather where relevant.',
  watch: 'Wrist accessory.',
  glasses: 'Eyewear — optical or sun.',
};
function currentlySelectedItems(excludeSlot) {
  return [...SLOTS, ...ACCESSORY_SLOTS]
    .filter(s => s !== excludeSlot)
    .map(s => byId(builderState[s]))
    .filter(Boolean);
}

function populateBuilderOptions() {
  const panel = document.getElementById('slot-panel');
  const accCats = { belt:'belt', watch:'watch', glasses:'glasses' };
  let html = '';
  SLOTS.forEach(slot => {
    const cat = slot === 'outerwear' ? 'outerwear' : slot === 'footwear' ? 'footwear' : slot;
    const options = ITEMS.filter(i => i.category === cat);
    const against = currentlySelectedItems(slot);
    html += `<div class="slot-group"><h4>${slot}</h4><div class="slot-help">${SLOT_HELP[slot]}</div><div class="swatch-row" data-slot="${slot}">
      <button class="swatch-btn none ${!builderState[slot] ? 'selected' : ''}" data-id="" title="none">–</button>
      ${options.map(i => {
        const conflicts = hardConflicts(i, against);
        const title = `${i.brand} ${i.name} — ${i.colorName}${conflicts.length ? '\n⚠ ' + conflicts.join('\n⚠ ') : ''}`;
        return `<button class="swatch-btn ${builderState[slot]===i.id?'selected':''} ${conflicts.length?'conflict':''}" data-id="${i.id}" style="background:${i.hex}" title="${title}"></button>`;
      }).join('')}
    </div></div>`;
  });
  Object.entries(accCats).forEach(([slot, shapeCat]) => {
    const options = ITEMS.filter(i => i.category === 'accessory' && i.shape.startsWith(shapeCat));
    const against = currentlySelectedItems(slot);
    html += `<div class="slot-group"><h4>${slot}</h4><div class="slot-help">${SLOT_HELP[slot]}</div><div class="swatch-row" data-slot="${slot}">
      <button class="swatch-btn none ${!builderState[slot] ? 'selected' : ''}" data-id="" title="none">–</button>
      ${options.map(i => {
        const conflicts = hardConflicts(i, against);
        const title = `${i.name}${conflicts.length ? '\n⚠ ' + conflicts.join('\n⚠ ') : ''}`;
        return `<button class="swatch-btn ${builderState[slot]===i.id?'selected':''} ${conflicts.length?'conflict':''}" data-id="${i.id}" style="background:${i.hex}" title="${title}"></button>`;
      }).join('')}
    </div></div>`;
  });
  html += `
    <div class="slot-group"><h4>Tuck</h4><div class="swatch-row">
      ${['untucked','full','french'].map(t => `<button class="filter-chip ${builderState.tuck===t?'active':''}" data-tuck="${t}" style="font-size:.7rem;">${t}</button>`).join('')}
    </div></div>
    <div class="slot-group"><h4>Sleeve Roll</h4><div class="swatch-row">
      ${['down','casual','italian','high'].map(r => `<button class="filter-chip ${builderState.roll===r?'active':''}" data-roll="${r}" style="font-size:.7rem;">${r}</button>`).join('')}
    </div></div>
    <div class="slot-group"><h4>Trouser Break</h4><div class="swatch-row">
      ${['no','quarter','half','full'].map(b => `<button class="filter-chip ${builderState.breakStyle===b?'active':''}" data-break="${b}" style="font-size:.7rem;">${b}</button>`).join('')}
    </div></div>
  `;
  panel.innerHTML = html;

  panel.querySelectorAll('.swatch-row[data-slot] .swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = btn.closest('.swatch-row').dataset.slot;
      builderState[slot] = btn.dataset.id || null;
      populateBuilderOptions(); renderFigure(); renderScores();
    });
  });
  panel.querySelectorAll('[data-tuck]').forEach(b => b.addEventListener('click', () => { builderState.tuck = b.dataset.tuck; populateBuilderOptions(); renderFigure(); renderScores(); }));
  panel.querySelectorAll('[data-roll]').forEach(b => b.addEventListener('click', () => { builderState.roll = b.dataset.roll; populateBuilderOptions(); renderFigure(); renderScores(); }));
  panel.querySelectorAll('[data-break]').forEach(b => b.addEventListener('click', () => { builderState.breakStyle = b.dataset.break; populateBuilderOptions(); renderFigure(); renderScores(); }));
}

function texturePattern(fabric, hex) {
  fabric = (fabric || '').toLowerCase();
  if (fabric.includes('denim')) return `<g stroke="#00000030" stroke-width="0.6">${Array.from({length:6}).map((_,i)=>`<line x1="${68+i*10}" y1="185" x2="${68+i*10-8}" y2="395"/>`).join('')}</g>`;
  if (fabric.includes('pique') || fabric.includes('knit') || fabric.includes('wool')) return `<g stroke="#00000018" stroke-width="0.5">${Array.from({length:8}).map((_,i)=>`<line x1="66" y1="${65+i*13}" x2="134" y2="${65+i*13}"/>`).join('')}</g>`;
  return '';
}

function garmentLayer(item) {
  if (!item) return '';
  const hex = item.hex, shape = item.shape, fab = item.fabric;
  const g = (inner, extra='') => `<g filter="url(#dshadow)" ${extra}>${inner}</g>`;

  switch (shape) {
    case 'tee': {
      const sleeveEnd = builderState.roll === 'high' ? 78 : 100;
      return g(`
        <path d="M62,58 L138,58 L148,${sleeveEnd} L126,94 L126,180 L74,180 L74,94 L52,${sleeveEnd} Z" fill="${hex}" stroke="#00000022"/>
        ${texturePattern(fab)}
      `);
    }
    case 'shirt': case 'overshirt': case 'knit': {
      const sleeveEnd = builderState.roll === 'high' ? 78 : builderState.roll === 'italian' ? 118 : builderState.roll === 'casual' ? 140 : 186;
      const collar = shape !== 'knit' ? `<path d="M90,54 L100,70 L110,54" fill="none" stroke="#00000030" stroke-width="1.4"/>` : '';
      const hemY = builderState.tuck === 'untucked' ? 198 : 182;
      return g(`
        <path d="M60,56 L140,56 L164,${sleeveEnd} L148,${sleeveEnd-6} L132,92 L132,${hemY} L68,${hemY} L68,92 L52,${sleeveEnd-6} L36,${sleeveEnd} Z" fill="${hex}" stroke="#00000022"/>
        ${collar}
        ${texturePattern(fab)}
      `);
    }
    case 'polo': {
      const sleeveEnd = builderState.roll === 'high' ? 78 : 100;
      const hemY = builderState.tuck === 'untucked' ? 198 : 182;
      return g(`
        <path d="M62,58 L138,58 L148,${sleeveEnd} L128,94 L128,${hemY} L72,${hemY} L72,94 L52,${sleeveEnd} Z" fill="${hex}" stroke="#00000022"/>
        <line x1="98" y1="58" x2="98" y2="76" stroke="#00000030" stroke-width="1.2"/>
        <circle cx="98" cy="66" r="1.3" fill="#00000040"/><circle cx="98" cy="72" r="1.3" fill="#00000040"/>
        ${texturePattern(fab)}
      `);
    }
    case 'blazer': {
      return g(`
        <path d="M64,56 L96,64 L100,80 L104,64 L136,56 L158,100 L140,108 L132,90 L132,192 L68,192 L68,90 L60,108 L42,100 Z" fill="${hex}" stroke="#00000030"/>
        <path d="M96,64 L88,110 L100,80 Z" fill="#00000018"/>
        <path d="M104,64 L112,110 L100,80 Z" fill="#00000018"/>
      `, 'opacity="0.98"');
    }
    case 'kurta': {
      return g(`
        <path d="M70,58 L130,58 L150,100 L134,108 L124,90 L124,230 L76,230 L76,90 L66,108 L50,100 Z" fill="${hex}" stroke="#00000022"/>
        <line x1="94" y1="58" x2="94" y2="80" stroke="#00000030" stroke-width="1"/>
        <line x1="106" y1="58" x2="106" y2="80" stroke="#00000030" stroke-width="1"/>
      `);
    }
    case 'shell': {
      return g(`<path d="M66,56 L134,56 L154,98 L138,106 L130,88 L130,190 L70,190 L70,88 L62,106 L46,98 Z" fill="${hex}" stroke="#00000030"/>`);
    }
    case 'chino': case 'trouser': {
      const shoeY = builderState.breakStyle === 'no' ? 396 : builderState.breakStyle === 'quarter' ? 400 : builderState.breakStyle === 'half' ? 404 : 410;
      return g(`
        <path d="M74,186 L98,186 L96,${shoeY} L78,${shoeY} Z" fill="${hex}" stroke="#00000022"/>
        <path d="M102,186 L126,186 L122,${shoeY} L104,${shoeY} Z" fill="${hex}" stroke="#00000022"/>
        ${texturePattern(fab)}
      `);
    }
    case 'jogger': {
      return g(`
        <path d="M74,186 L98,186 L92,370 L84,370 L80,392 L72,392 L78,370 Z" fill="${hex}" stroke="#00000022"/>
        <path d="M102,186 L126,186 L120,392 L112,392 L108,370 L100,370 Z" fill="${hex}" stroke="#00000022"/>
        <rect x="72" y="386" width="12" height="8" fill="#00000025"/>
        <rect x="108" y="386" width="12" height="8" fill="#00000025"/>
        <line x1="90" y1="190" x2="94" y2="198" stroke="#00000035" stroke-width="1"/>
        <line x1="110" y1="190" x2="106" y2="198" stroke="#00000035" stroke-width="1"/>
      `);
    }
    case 'jeans': {
      const shoeY = 404;
      return g(`
        <path d="M74,186 L98,186 L96,${shoeY} L78,${shoeY} Z" fill="${hex}" stroke="#00000022"/>
        <path d="M102,186 L126,186 L122,${shoeY} L104,${shoeY} Z" fill="${hex}" stroke="#00000022"/>
        <line x1="80" y1="190" x2="78" y2="${shoeY-4}" stroke="#ffffff30" stroke-width="1"/>
        <line x1="120" y1="190" x2="122" y2="${shoeY-4}" stroke="#ffffff30" stroke-width="1"/>
      `);
    }
    case 'cargo': {
      const shoeY = 404;
      return g(`
        <path d="M74,186 L98,186 L96,${shoeY} L78,${shoeY} Z" fill="${hex}" stroke="#00000022"/>
        <path d="M102,186 L126,186 L122,${shoeY} L104,${shoeY} Z" fill="${hex}" stroke="#00000022"/>
        <rect x="62" y="240" width="14" height="20" fill="#00000020" stroke="#00000030"/>
        <rect x="124" y="240" width="14" height="20" fill="#00000020" stroke="#00000030"/>
      `);
    }
    case 'sneaker': case 'derby': case 'loafer': {
      return g(`
        <path d="M64,${404} L100,${404} L104,418 L58,418 Z" fill="${hex}" stroke="#00000030"/>
        <path d="M100,${404} L136,${404} L142,418 L96,418 Z" fill="${hex}" stroke="#00000030"/>
      `);
    }
    case 'boot': {
      return g(`
        <path d="M64,392 L100,392 L104,418 L58,418 Z" fill="${hex}" stroke="#00000030"/>
        <path d="M100,392 L136,392 L142,418 L96,418 Z" fill="${hex}" stroke="#00000030"/>
      `);
    }
    case 'belt': {
      return g(`<rect x="72" y="183" width="56" height="7" fill="${hex}" stroke="#00000030"/>`);
    }
    case 'watch': {
      return g(`<circle cx="152" cy="188" r="4.5" fill="${hex}" stroke="#00000040"/>`);
    }
    case 'glasses': {
      return g(`<g fill="none" stroke="${hex}" stroke-width="2.4"><circle cx="90" cy="26" r="8"/><circle cx="110" cy="26" r="8"/><line x1="98" y1="26" x2="102" y2="26"/></g>`);
    }
    case 'glasses-angular': {
      return g(`<g fill="none" stroke="${hex}" stroke-width="2.4"><rect x="82" y="20" width="16" height="11" rx="1.5"/><rect x="102" y="20" width="16" height="11" rx="1.5"/><line x1="98" y1="25" x2="102" y2="25"/></g>`);
    }
    case 'sunglasses': {
      return g(`<g fill="${hex}" opacity="0.9"><circle cx="90" cy="26" r="8"/><circle cx="110" cy="26" r="8"/></g>`);
    }
    default: return '';
  }
}

function renderFigure() {
  if (typeof aiState !== 'undefined' && aiState.mode === 'ai') {
    const s = document.getElementById('ai-status');
    if (s && aiState.lastImage) { aiState.status = 'Outfit changed — click Render to update the AI image.'; aiState.error = false; renderAIPanel(); }
    return;
  }
  const stage = document.getElementById('figure-stage');
  const bottom = byId(builderState.bottom);
  const footwear = byId(builderState.footwear);
  const top = byId(builderState.top);
  const outerwear = byId(builderState.outerwear);
  const belt = byId(builderState.belt);
  const watch = byId(builderState.watch);
  const glasses = byId(builderState.glasses);

  stage.innerHTML = `
  <svg viewBox="0 0 200 460" role="img" aria-label="Outfit preview figure">
    <defs>
      <filter id="dshadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.22"/>
      </filter>
    </defs>
    <g fill="none" stroke="currentColor" stroke-width="1" opacity="0.28">
      <circle cx="100" cy="28" r="20"/>
      <line x1="100" y1="48" x2="100" y2="60"/>
      <path d="M60,60 Q100,48 140,60 L155,105 L100,190 L45,105 Z"/>
      <path d="M75,188 L75,405 M125,188 L125,405"/>
      <path d="M60,418 L100,418 L100,405 M140,418 L100,418"/>
    </g>
    ${garmentLayer(bottom)}
    ${garmentLayer(footwear)}
    ${garmentLayer(top)}
    ${garmentLayer(belt)}
    ${garmentLayer(outerwear)}
    ${garmentLayer(watch)}
    ${garmentLayer(glasses)}
  </svg>`;
}

// ---------- Layer B: AI render ("on me") ----------
// Nothing here ever writes your photo or API key to a file — both live only
// in this browser's memory/localStorage, and are sent only to Google's Gemini
// API directly from your browser when you click Render.
const aiState = {
  mode: 'vector',
  photoDataUrl: localStorage.getItem('wa_photo') || null,
  apiKey: localStorage.getItem('wa_apikey') || '',
  model: localStorage.getItem('wa_model') || 'gemini-2.5-flash-image',
  lastImage: null,
  status: '',
  error: false,
};

function setupStageTabs() {
  document.querySelectorAll('.stage-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      aiState.mode = tab.dataset.mode;
      document.querySelectorAll('.stage-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.getElementById('figure-stage').style.display = aiState.mode === 'vector' ? 'flex' : 'none';
      document.getElementById('ai-panel').classList.toggle('active', aiState.mode === 'ai');
      if (aiState.mode === 'ai') renderAIPanel();
    });
  });
}

function outfitCacheKey() {
  const ids = SLOTS.concat(ACCESSORY_SLOTS).map(s => builderState[s] || '-').join('|');
  return `wa_render_${ids}_${builderState.tuck}_${builderState.roll}_${builderState.breakStyle}`;
}

function outfitPromptText() {
  const parts = [...SLOTS, ...ACCESSORY_SLOTS].map(s => byId(builderState[s])).filter(Boolean);
  const desc = parts.map(i => `${i.colorName} ${i.brand} ${i.name} (${i.fabric})`).join(', ');
  return `Photorealistic full-body photo of the same person shown in the reference photo, keeping their face and identity accurate and unchanged. They are wearing: ${desc || 'their current clothing'}. Tuck style: ${builderState.tuck}. Trouser break: ${builderState.breakStyle}. Natural daylight, neutral studio or office background, business-casual context, standing pose, realistic fabric drape and fit.`;
}

function renderAIPanel() {
  const el = document.getElementById('ai-panel');
  el.innerHTML = `
    <div class="ai-field">
      <label>Your reference photo</label>
      <input type="file" id="ai-photo-input" accept="image/*">
      ${aiState.photoDataUrl ? `<img class="ai-photo-preview" src="${aiState.photoDataUrl}">` : ''}
      <label class="ai-checkbox"><input type="checkbox" id="ai-remember-photo" ${localStorage.getItem('wa_photo') ? 'checked' : ''}> Remember this photo in my browser (localStorage) — never committed to the repo</label>
    </div>
    <div class="ai-field">
      <label>Gemini API key</label>
      <input type="password" id="ai-key-input" placeholder="Paste your own key — never hardcoded, never saved to any file" value="${aiState.apiKey}">
      <label class="ai-checkbox"><input type="checkbox" id="ai-remember-key" ${localStorage.getItem('wa_apikey') ? 'checked' : ''}> Remember key in this browser</label>
      <div class="ai-hint">Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.</div>
    </div>
    <div class="ai-field">
      <label>Model</label>
      <input type="text" id="ai-model-input" value="${aiState.model}">
      <div class="ai-hint">Defaults to a current image-capable Gemini model. If rendering fails with a model-not-found error, check Google AI Studio for the current model name and update this field.</div>
    </div>
    <button class="ai-render-btn" id="ai-render-btn">Render this outfit on me</button>
    <div class="ai-status ${aiState.error ? 'error' : ''}" id="ai-status">${aiState.status}</div>
    <div class="ai-privacy">Your photo and key live only in this browser (memory, or localStorage if you check "remember"). They're sent only to Google's API when you click Render — never written to any file, never part of what gets committed to git.</div>
  `;
  document.getElementById('ai-photo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { aiState.photoDataUrl = reader.result; renderAIPanel(); };
    reader.readAsDataURL(file);
  });
  document.getElementById('ai-render-btn').addEventListener('click', runAIRender);
}

async function runAIRender() {
  const keyInput = document.getElementById('ai-key-input').value.trim();
  const modelInput = document.getElementById('ai-model-input').value.trim();
  const rememberPhoto = document.getElementById('ai-remember-photo').checked;
  const rememberKey = document.getElementById('ai-remember-key').checked;
  aiState.apiKey = keyInput; aiState.model = modelInput || aiState.model;

  if (rememberPhoto && aiState.photoDataUrl) { try { localStorage.setItem('wa_photo', aiState.photoDataUrl); } catch(e) {} }
  else localStorage.removeItem('wa_photo');
  if (rememberKey && aiState.apiKey) localStorage.setItem('wa_apikey', aiState.apiKey);
  else localStorage.removeItem('wa_apikey');
  if (modelInput) localStorage.setItem('wa_model', modelInput);

  if (!aiState.photoDataUrl) { aiState.status = 'Upload a reference photo first.'; aiState.error = true; renderAIPanel(); return; }
  if (!aiState.apiKey) { aiState.status = 'Enter your Gemini API key first — the Vector Preview tab works with no key at all.'; aiState.error = true; renderAIPanel(); return; }

  const cacheKey = outfitCacheKey();
  const cached = localStorage.getItem(cacheKey);
  if (cached) { aiState.lastImage = cached; aiState.status = 'Loaded from cache — this exact outfit was already rendered.'; aiState.error = false; showAIImage(cached); renderAIPanel(); return; }

  aiState.status = 'Rendering… this calls Google\'s Gemini API directly from your browser and can take 10-20 seconds.'; aiState.error = false; renderAIPanel();

  try {
    const [, mime, b64] = aiState.photoDataUrl.match(/^data:(.+);base64,(.+)$/);
    const body = {
      contents: [{ parts: [
        { text: outfitPromptText() },
        { inline_data: { mime_type: mime, data: b64 } }
      ]}]
    };
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiState.model}:generateContent?key=${aiState.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) { const t = await resp.text(); throw new Error(`API error ${resp.status}: ${t.slice(0,200)}`); }
    const data = await resp.json();
    const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data || p.inlineData);
    const inline = imgPart?.inline_data || imgPart?.inlineData;
    if (!inline) throw new Error('No image returned — the model may not support image output, or the prompt was refused.');
    const dataUrl = `data:${inline.mime_type || inline.mimeType};base64,${inline.data}`;
    try { localStorage.setItem(cacheKey, dataUrl); } catch (e) { /* storage full — render still shows, just won't cache */ }
    aiState.lastImage = dataUrl; aiState.status = 'Rendered.'; aiState.error = false;
    showAIImage(dataUrl);
  } catch (err) {
    aiState.status = `Couldn't render: ${err.message}. Falling back to the Vector Preview.`; aiState.error = true;
  }
  renderAIPanel();
}

function showAIImage(dataUrl) {
  const stage = document.getElementById('figure-stage');
  stage.innerHTML = `<img src="${dataUrl}" alt="AI render of the selected outfit">`;
}

// ---------- Scoring engine ----------
const FORMALITY_RANK = {
  'athleisure':0, 'athletic':0, 'streetwear':1, 'rugged-casual':1, 'casual':2,
  'elevated-casual':3, 'smart-casual':3, 'utility':3, 'business-casual':4, 'escalation':5,
  'everyday':null, 'versatile':null, 'festive':null
};
const CLIMATE_KEYWORDS = [
  { k: 'viscose', note: 'Poly-viscose can dry slowly in monsoon humidity', score: -1 },
  { k: 'tropical wool', note: 'Holds shape through AC-to-street cycles', score: 1 },
  { k: 'fresco', note: 'High-twist weave — genuinely tropical-suited', score: 1 },
  { k: 'linen', note: 'Breathable, good humidity performance', score: 1 },
  { k: 'poplin', note: 'Light, breathable daily fabric', score: 1 },
  { k: 'dwr', note: 'Water-repellent — monsoon-ready', score: 1 },
  { k: 'ripstop', note: 'Durable, sheds water well', score: 1 },
  { k: 'wool', note: 'Check weight — standard wool runs warm outside AC', score: 0 },
  { k: 'denim', note: 'Slower-drying if caught in rain', score: 0 },
];

function hexToRgb(hex) {
  const h = hex.replace('#','');
  return { r: parseInt(h.substring(0,2),16), g: parseInt(h.substring(2,4),16), b: parseInt(h.substring(4,6),16) };
}
function hexToHsl(hex) {
  let { r, g, b } = hexToRgb(hex); r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch (max) {
      case r: h = (g-b)/d + (g<b?6:0); break;
      case g: h = (b-r)/d + 2; break;
      default: h = (r-g)/d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}
function rgbDist(hexA, hexB) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);
}
// Real classification: desaturated/near-white/near-black = neutral; otherwise
// find the nearest named palette colour (by RGB distance) to tag a family,
// falling back to 'other' when nothing is a close match.
function classifyColor(hex) {
  const { s, l } = hexToHsl(hex);
  if (s < 0.18 || l > 0.87 || l < 0.14) return { neutral: true, fam: 'neutral' };
  const winter = PALETTE.hypotheses.find(h => h.id === 'winter').colors;
  const autumn = PALETTE.hypotheses.find(h => h.id === 'autumn').colors;
  let best = null, bestFam = null, bestDist = Infinity;
  winter.forEach(c => { const d = rgbDist(hex, c.hex); if (d < bestDist) { bestDist = d; best = c; bestFam = 'winter'; } });
  autumn.forEach(c => { const d = rgbDist(hex, c.hex); if (d < bestDist) { bestDist = d; best = c; bestFam = 'autumn'; } });
  return { neutral: false, fam: bestDist < 95 ? bestFam : 'other', nearest: best ? best.name : null };
}

function renderScores() {
  const panel = document.getElementById('score-panel');
  const active = SLOTS.map(s => byId(builderState[s])).filter(Boolean);
  if (!active.length) {
    panel.innerHTML = `<div class="score-card"><h5>Score</h5><div class="score-note">Pick at least a top and bottom to see live feedback.</div></div>`;
    renderPairingsPanel();
    return;
  }

  // Colour harmony — real classification per item, not exact-hex lookup
  const classified = active.map(i => ({ item: i, ...classifyColor(i.hex) }));
  const accents = classified.filter(c => !c.neutral);
  const winterAccents = accents.filter(c => c.fam === 'winter');
  const autumnAccents = accents.filter(c => c.fam === 'autumn');
  let colorScore, colorNote, colorClass;
  if (accents.length === 0) {
    colorScore = 'All Neutral'; colorClass = 'score-good';
    colorNote = 'Every piece reads as neutral — very safe. Add one accent piece if you want more personality.';
  } else if (accents.length === 1) {
    colorScore = 'Clean'; colorClass = 'score-good';
    colorNote = `One deliberate accent (${accents[0].item.colorName}) against a neutral base — squarely in the 60/30/10 zone.`;
  } else if (accents.length === 2 && winterAccents.length > 0 && autumnAccents.length > 0) {
    colorScore = 'Untested'; colorClass = 'score-warn';
    colorNote = `${winterAccents[0].item.colorName} (Deep Winter track) and ${autumnAccents[0].item.colorName} (Deep Autumn track) together — fine as a personal choice, but this specific pairing hasn't been validated by the swatch test yet.`;
  } else if (accents.length === 2) {
    colorScore = 'Bold, deliberate'; colorClass = 'score-good';
    colorNote = `Two accents (${accents.map(a=>a.item.colorName).join(', ')}) — bolder than the safe default, but from the same palette track.`;
  } else {
    colorScore = 'Busy'; colorClass = 'score-warn';
    colorNote = `${accents.length} non-neutral colours at once (${accents.map(a=>a.item.colorName).join(', ')}) exceeds the 3-colour ceiling from §0.3 — consider dropping one to a neutral.`;
  }

  // Formality
  const ranks = active.map(i => FORMALITY_RANK[i.formality]).filter(r => r !== null && r !== undefined);
  const minRank = ranks.length ? Math.min(...ranks) : null;
  const maxRank = ranks.length ? Math.max(...ranks) : null;
  const rankLabels = ['Athleisure / Loungewear','Casual','Casual','Elevated Casual','Business Casual','Escalation / Client-ready'];
  let formalityNote = '';
  if (maxRank !== null && minRank !== null && maxRank - minRank >= 3) {
    formalityNote = `Formality mismatch: pairing something as dressed-up as ${rankLabels[maxRank]} with something as casual as ${rankLabels[minRank]} reads as a mistake, not a style choice — this is the exact failure mode flagged in Phase 2 (Derby + athleisure trouser).`;
  }
  const formalityLabel = minRank !== null ? rankLabels[minRank] : '—';

  // Proportion
  const proportionNotes = [];
  const bottomItem = byId(builderState.bottom);
  if (bottomItem && bottomItem.shape === 'jogger') proportionNotes.push('Elastic-waist jogger reads athleisure regardless of what it\'s paired with (Phase 2\'s core finding).');
  if (builderState.breakStyle === 'full') proportionNotes.push('Full break is the single most leg-shortening trouser choice for a 172cm frame (§0.4) — consider quarter or no-break.');
  if (builderState.outerwear && !builderState.top) proportionNotes.push('Outerwear with no base layer selected — pick a top to see the full silhouette.');

  // Climate
  const climateHits = [];
  active.forEach(i => {
    const fab = (i.fabric||'').toLowerCase();
    CLIMATE_KEYWORDS.forEach(ck => { if (fab.includes(ck.k)) climateHits.push(ck); });
  });
  const climateScoreVal = climateHits.reduce((s,c)=>s+c.score,0);
  const climateLabel = climateScoreVal > 0 ? 'Bangalore-suited' : climateScoreVal < 0 ? 'Caution' : 'Neutral';
  const climateClass = climateScoreVal > 0 ? 'score-good' : climateScoreVal < 0 ? 'score-warn' : '';

  // Silhouette balance — loose vs fitted, the rule you specifically asked to have checked
  const silhouetteItems = active.filter(i => i.silhouette);
  let silhouetteLabel = '—', silhouetteClass = '', silhouetteNotes = [];
  if (silhouetteItems.length >= 2) {
    for (let a = 0; a < silhouetteItems.length; a++) {
      for (let b = a + 1; b < silhouetteItems.length; b++) {
        const c = silhouetteConflict(silhouetteItems[a], silhouetteItems[b]);
        if (c) silhouetteNotes.push(c);
      }
    }
    const looseCount = silhouetteItems.filter(i => isLoose(i.silhouette)).length;
    if (silhouetteNotes.length) {
      silhouetteLabel = 'Too much volume'; silhouetteClass = 'score-warn';
    } else if (looseCount === 1) {
      silhouetteLabel = 'Balanced'; silhouetteClass = 'score-good';
      silhouetteNotes.push('One loose piece against fitted/regular pieces — classic proportion balance.');
    } else {
      silhouetteLabel = 'Clean'; silhouetteClass = 'score-good';
      silhouetteNotes.push('All fitted/regular — safe, no volume conflict.');
    }
  } else {
    silhouetteNotes.push('Pick at least two pieces with known silhouettes to check balance.');
  }

  // Technique suggestion
  let suggestion = '';
  const topItem = byId(builderState.top);
  if (topItem && (topItem.shape === 'shirt' || topItem.shape === 'polo') && builderState.roll === 'down') {
    suggestion = minRank >= 4 ? 'Try the Italian Roll — polished enough for a business-casual register.' : 'Try the Casual Roll for an easy weekend read.';
  } else if (topItem && topItem.shape === 'tee' && builderState.tuck !== 'untucked') {
    suggestion = 'Tees read better untucked with a straight hem — try switching the tuck style.';
  }

  panel.innerHTML = `
    <div class="score-card"><h5>Colour Harmony</h5><div class="score-value ${colorClass}">${colorScore}</div><div class="score-note">${colorNote}</div></div>
    <div class="score-card"><h5>Formality Tier</h5><div class="score-value">${formalityLabel}</div>${formalityNote ? `<div class="score-note score-warn">${formalityNote}</div>` : ''}</div>
    <div class="score-card"><h5>Silhouette Balance</h5><div class="score-value ${silhouetteClass}">${silhouetteLabel}</div>${silhouetteNotes.map(n=>`<div class="score-note ${silhouetteClass}">${n}</div>`).join('')}</div>
    <div class="score-card"><h5>Proportion (172cm)</h5>${proportionNotes.length ? proportionNotes.map(n=>`<div class="score-note score-warn">${n}</div>`).join('') : '<div class="score-note score-good">No warnings.</div>'}</div>
    <div class="score-card"><h5>Climate Suitability</h5><div class="score-value ${climateClass}">${climateLabel}</div>${climateHits.map(c=>`<div class="score-note">${c.note}</div>`).join('')}</div>
    ${suggestion ? `<div class="technique-suggest">${suggestion}</div>` : ''}
  `;
  renderPairingsPanel();
}

// ---------- Init ----------
async function init() {
  await loadData();
  setupNav();
  renderWardrobe();
  renderPalette();
  renderGaps();
  renderRoadmap();
  renderDictionary();
  renderFramework();
  renderArchetypes();
  populateBuilderOptions();
  setupStageTabs();
  renderFigure();
  renderScores();
  const initial = location.hash.replace('#','') || 'wardrobe';
  showView(initial);
}
init();
