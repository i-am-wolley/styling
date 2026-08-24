// ---------- Data ----------
let ITEMS = [], PALETTE = null, DICTIONARY = [], PAIRINGS = [], ARCHETYPES = null, FRAMEWORK = null;

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
          <div class="roadmap-item-meta">
            <span class="tag ${i.tier === 'essential' ? 'essential' : i.tier === 'high-value' ? 'high' : 'eventual'}">${i.tier}</span>
            <span class="card-meta">${i.brand}</span>
            <button class="owned-toggle" data-id="${i.id}">Mark owned</button>
          </div>
        </div>`).join('')}
    `;
  }).join('');
  el.querySelectorAll('.owned-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = byId(btn.dataset.id);
      item.owned = !item.owned;
      renderRoadmap(); renderWardrobe(); renderGaps(); populateBuilderOptions();
    });
  });
}

// ---------- Pairings ----------
function renderPairings() {
  const el = document.getElementById('pairings-body');
  el.innerHTML = PAIRINGS.map(p => {
    const items = p.items.map(byId).filter(Boolean);
    return `
      <div class="pairing-card">
        <div class="pairing-head">
          <div class="pairing-name">${p.name}</div>
          <div class="pairing-occasion">${p.occasion}</div>
        </div>
        <div class="pairing-swatches">${items.map(i => `<div class="pairing-swatch" style="background:${i.hex}" title="${i.name}"></div>`).join('')}</div>
        <div class="pairing-why">${p.whyItWorks}</div>
        <div class="pairing-rule">${p.colorRule}</div>
      </div>`;
  }).join('');
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

function populateBuilderOptions() {
  const panel = document.getElementById('slot-panel');
  const accCats = { belt:'belt', watch:'watch', glasses:'glasses' };
  let html = '';
  SLOTS.forEach(slot => {
    const cat = slot === 'outerwear' ? 'outerwear' : slot === 'footwear' ? 'footwear' : slot;
    const options = ITEMS.filter(i => i.category === cat);
    html += `<div class="slot-group"><h4>${slot}</h4><div class="swatch-row" data-slot="${slot}">
      <button class="swatch-btn none ${!builderState[slot] ? 'selected' : ''}" data-id="" title="none">–</button>
      ${options.map(i => `<button class="swatch-btn ${builderState[slot]===i.id?'selected':''}" data-id="${i.id}" style="background:${i.hex}" title="${i.brand} ${i.name} — ${i.colorName}"></button>`).join('')}
    </div></div>`;
  });
  Object.entries(accCats).forEach(([slot, shapeCat]) => {
    const options = ITEMS.filter(i => i.category === 'accessory' && i.shape.startsWith(shapeCat));
    html += `<div class="slot-group"><h4>${slot}</h4><div class="swatch-row" data-slot="${slot}">
      <button class="swatch-btn none ${!builderState[slot] ? 'selected' : ''}" data-id="" title="none">–</button>
      ${options.map(i => `<button class="swatch-btn ${builderState[slot]===i.id?'selected':''}" data-id="${i.id}" style="background:${i.hex}" title="${i.name}"></button>`).join('')}
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
        <path d="M68,60 L132,60 L138,${sleeveEnd} L120,93 L120,178 L80,178 L80,93 L62,${sleeveEnd} Z" fill="${hex}" stroke="#00000022"/>
        ${texturePattern(fab)}
      `);
    }
    case 'shirt': case 'overshirt': case 'knit': {
      const sleeveEnd = builderState.roll === 'high' ? 78 : builderState.roll === 'italian' ? 118 : builderState.roll === 'casual' ? 140 : 185;
      const collar = shape !== 'knit' ? `<path d="M92,55 L100,68 L108,55" fill="none" stroke="#00000030" stroke-width="1.4"/>` : '';
      const hemY = builderState.tuck === 'untucked' ? 195 : 180;
      return g(`
        <path d="M66,58 L134,58 L156,${sleeveEnd} L142,${sleeveEnd-6} L128,90 L128,${hemY} L72,${hemY} L72,90 L58,${sleeveEnd-6} L44,${sleeveEnd} Z" fill="${hex}" stroke="#00000022"/>
        ${collar}
        ${texturePattern(fab)}
      `);
    }
    case 'polo': {
      const sleeveEnd = builderState.roll === 'high' ? 78 : 100;
      const hemY = builderState.tuck === 'untucked' ? 195 : 180;
      return g(`
        <path d="M68,60 L132,60 L140,${sleeveEnd} L122,93 L122,${hemY} L78,${hemY} L78,93 L60,${sleeveEnd} Z" fill="${hex}" stroke="#00000022"/>
        <line x1="98" y1="60" x2="98" y2="76" stroke="#00000030" stroke-width="1.2"/>
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

// ---------- Scoring engine ----------
const FORMALITY_RANK = {
  'athleisure':0, 'athletic':0, 'streetwear':1, 'rugged-casual':1, 'casual':2,
  'elevated-casual':3, 'smart-casual':3, 'utility':3, 'business-casual':4, 'escalation':5,
  'everyday':null, 'versatile':null
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

function colorFamily(hex) {
  const all = [...PALETTE.coreNeutrals.map(c=>({...c,fam:'neutral'})), ...PALETTE.hypotheses[0].colors.map(c=>({...c,fam:'winter'})), ...PALETTE.hypotheses[1].colors.map(c=>({...c,fam:'autumn'}))];
  const match = all.find(c => c.hex.toLowerCase() === hex.toLowerCase());
  return match ? match.fam : 'other';
}

function renderScores() {
  const panel = document.getElementById('score-panel');
  const active = SLOTS.map(s => byId(builderState[s])).filter(Boolean);
  if (!active.length) {
    panel.innerHTML = `<div class="score-card"><h5>Score</h5><div class="score-note">Pick at least a top and bottom to see live feedback.</div></div>`;
    return;
  }

  // Colour harmony
  const hexes = active.map(i => i.hex);
  const fams = hexes.map(colorFamily);
  const nonNeutral = fams.filter(f => f !== 'neutral');
  const winterCount = nonNeutral.filter(f => f === 'winter').length;
  const autumnCount = nonNeutral.filter(f => f === 'autumn').length;
  let colorScore, colorNote, colorClass;
  if (hexes.length !== new Set(hexes).size + 0 && nonNeutral.length <= 1) {
    colorScore = 'Clean'; colorClass='score-good'; colorNote = 'Neutral-anchored with at most one statement colour — safe under either palette hypothesis.';
  } else if (winterCount > 0 && autumnCount > 0) {
    colorScore = 'Untested'; colorClass='score-warn'; colorNote = 'Mixing a Deep Winter colour with a Deep Autumn colour in the same outfit — fine as a personal choice, but this combination hasn\'t been validated by the swatch test yet.';
  } else if (nonNeutral.length >= 3) {
    colorScore = 'Busy'; colorClass='score-warn'; colorNote = `${nonNeutral.length} non-neutral colours at once exceeds the 3-colour ceiling from §0.3 — consider dropping one to a neutral.`;
  } else {
    colorScore = 'Good'; colorClass='score-good'; colorNote = 'Within the palette rules — a neutral base with a deliberate accent.';
  }

  // Formality
  const ranks = active.map(i => FORMALITY_RANK[i.formality]).filter(r => r !== null && r !== undefined);
  const minRank = ranks.length ? Math.min(...ranks) : null;
  const maxRank = ranks.length ? Math.max(...ranks) : null;
  const rankLabels = ['Athleisure / Loungewear','Casual','Casual','Elevated Casual','Business Casual','Escalation / Client-ready'];
  let formalityNote = '';
  if (maxRank !== null && minRank !== null && maxRank - minRank >= 3) {
    formalityNote = `Formality mismatch: pairing something as dressed-up as ${rankLabels[maxRank]} with something as casual as ${rankLabels[minRank]} reads as a mistake, not a style choice — this is the exact failure mode flagged in Phase 2 (blazer + jogger, or Derby + athleisure trouser).`;
  }
  const formalityLabel = minRank !== null ? rankLabels[minRank] : '—';

  // Proportion
  const proportionNotes = [];
  const bottomItem = byId(builderState.bottom);
  if (bottomItem && bottomItem.shape === 'jogger') proportionNotes.push('Elastic-waist jogger reads athleisure regardless of what it\'s paired with (Phase 2\'s core finding).');
  if (builderState.breakStyle === 'full') proportionNotes.push('Full break is the single most leg-shortening trouser choice for a 172cm frame (§0.4) — consider quarter or no-break.');
  if (builderState.outerwear && !builderState.top) proportionNotes.push('Outerwear with no base layer selected — pick a top to see the full silhouette.');
  const outerItem = byId(builderState.outerwear);
  if (outerItem && outerItem.shape === 'blazer' && bottomItem && ['athleisure','athletic'].includes(bottomItem.formality)) {
    proportionNotes.push('A blazer over athleisure trousers is a direct formality contradiction — the jacket signals escalation, the trouser cancels it.');
  }

  // Climate
  const climateHits = [];
  active.forEach(i => {
    const fab = (i.fabric||'').toLowerCase();
    CLIMATE_KEYWORDS.forEach(ck => { if (fab.includes(ck.k)) climateHits.push(ck); });
  });
  const climateScoreVal = climateHits.reduce((s,c)=>s+c.score,0);
  const climateLabel = climateScoreVal > 0 ? 'Bangalore-suited' : climateScoreVal < 0 ? 'Caution' : 'Neutral';
  const climateClass = climateScoreVal > 0 ? 'score-good' : climateScoreVal < 0 ? 'score-warn' : '';

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
    <div class="score-card"><h5>Proportion (172cm)</h5>${proportionNotes.length ? proportionNotes.map(n=>`<div class="score-note score-warn">${n}</div>`).join('') : '<div class="score-note score-good">No warnings.</div>'}</div>
    <div class="score-card"><h5>Climate Suitability</h5><div class="score-value ${climateClass}">${climateLabel}</div>${climateHits.map(c=>`<div class="score-note">${c.note}</div>`).join('')}</div>
    ${suggestion ? `<div class="technique-suggest">${suggestion}</div>` : ''}
  `;
}

// ---------- Init ----------
async function init() {
  await loadData();
  setupNav();
  renderWardrobe();
  renderPalette();
  renderGaps();
  renderRoadmap();
  renderPairings();
  renderDictionary();
  renderFramework();
  renderArchetypes();
  populateBuilderOptions();
  renderFigure();
  renderScores();
  const initial = location.hash.replace('#','') || 'wardrobe';
  showView(initial);
}
init();
