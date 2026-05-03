// ═══════════════════════════════════════════════════════════════
// PharmaInk pattern generator (Generate screen)
// ═══════════════════════════════════════════════════════════════
// SEEDED RNG  (xorshift32 — fast, deterministic, non-zero)
// ═══════════════════════════════════════════════════════════════
function createRng(seed) {
  let s = ((seed | 0) ^ 0x9e3779b9) >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════════
const S = {
  desiredDose:  20,
  dotDose:      0.10,
  printWidth:   0.5,
  printHeight:  3.0,
  dpi:          300,
  prompt:       'mandala',
  seed:         12345,
  numDesigns:   1,
};

function calcMetrics() {
  const requiredDots   = Math.round(S.desiredDose / S.dotDose);
  const physW  = Math.round(S.printWidth  * S.dpi);
  const physH  = Math.round(S.printHeight * S.dpi);
  const maxCap = physW * physH;
  const density       = maxCap > 0 ? (requiredDots / maxCap) * 100 : Infinity;
  const dotsPerCopy   = Math.floor(requiredDots / S.numDesigns);
  const dosePerCopy   = +(S.desiredDose / S.numDesigns).toFixed(4);
  return { requiredDots, physW, physH, maxCap, density, dotsPerCopy, dosePerCopy };
}

// ═══════════════════════════════════════════════════════════════
// CANVAS SIZING
// ═══════════════════════════════════════════════════════════════
function getCanvasDims() {
  const mainEl = document.getElementById('main');
  if (!mainEl || mainEl.offsetWidth < 8 || mainEl.offsetHeight < 8) {
    const vw = window.innerWidth || 400;
    const aspect = S.printWidth / S.printHeight;
    let cw = Math.min(280, vw - 48);
    let ch = Math.round(cw / aspect);
    if (ch > 420) {
      ch = 420;
      cw = Math.max(64, Math.round(ch * aspect));
    }
    return { cw: Math.max(64, cw), ch: Math.max(64, ch) };
  }
  const narrow = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 899px)').matches;
  const padX = narrow ? 32 : 80;
  const vw = window.innerWidth || 400;
  const vh = window.innerHeight || 700;
  const headerEl = document.getElementById('app-header');
  const navEl = document.getElementById('app-nav');
  const chromeY = narrow
    ? (headerEl?.offsetHeight || 52) + (navEl?.offsetHeight || 56) + 32
    : 0;
  const padY = narrow ? 200 + chromeY * 0.35 : 180;
  const avW = Math.max(200, Math.min((mainEl.clientWidth || vw) - padX, vw - 16));
  const avH = Math.max(200, narrow ? vh - padY : (mainEl.clientHeight || vh) - padY);
  const cap = narrow
    ? Math.min(420, vw - 24, Math.max(240, vh * 0.52))
    : 680;
  const MAX = Math.min(avW, avH, cap);

  const aspect = S.printWidth / S.printHeight;
  let cw, ch;
  if (aspect >= 1) {
    cw = MAX;
    ch = Math.max(8, Math.round(MAX / aspect));
  } else {
    ch = MAX;
    cw = Math.max(8, Math.round(MAX * aspect));
  }
  return { cw, ch };
}

// ═══════════════════════════════════════════════════════════════
// WEIGHT GENERATORS
// ═══════════════════════════════════════════════════════════════

// Heart — mathematical heart curve
function genHeart(w, h, rng) {
  const f = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * 2.8;
      const ny = -(y / h - 0.45) * 2.8;
      // (x²+y²−1)³ − x²y³ ≤ 0 defines inside of heart
      const v = Math.pow(nx*nx + ny*ny - 1, 3) - nx*nx * Math.pow(ny, 3);
      const outline = Math.exp(-Math.abs(v) * 5);
      const fill    = v <= 0 ? 0.38 + 0.28 * rng() : 0;
      f[y * w + x] = Math.min(1, Math.max(outline * 1.1, fill));
    }
  }
  return f;
}

// Waves — stacked sinusoidal bands
function genWaves(w, h, rng) {
  const f = new Float32Array(w * h);
  const N = 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let i = 0; i < N; i++) {
        const freq  = (i + 1) * Math.PI * 3 / w;
        const phase = i * 1.73;
        const yc    = h * (i + 0.5) / N;
        const amp   = h * Math.max(0.015, 0.075 - i * 0.006);
        const wy    = yc + Math.sin(x * freq + phase) * amp;
        const sig   = h * 0.012;
        v += Math.exp(-Math.pow(y - wy, 2) / (2 * sig * sig)) * (1 - i * 0.07);
      }
      f[y * w + x] = Math.min(1, v) * (0.85 + 0.15 * rng());
    }
  }
  return f;
}

// Mandala — radial symmetry with concentric rings, petals, spokes
function genMandala(w, h, rng) {
  const f  = new Float32Array(w * h);
  const cx = w / 2, cy = h / 2;
  const R  = Math.min(w, h) * 0.46;
  const sym = 8;
  const TP  = 2 * Math.PI;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const r  = Math.sqrt(dx * dx + dy * dy);
      if (r >= R) { f[y * w + x] = 0; continue; }
      const th = Math.atan2(dy, dx);

      let v = 0;
      // Concentric rings
      for (let k = 1; k <= 5; k++) {
        const rk = R * k / 6;
        const s  = R * 0.022;
        v += Math.exp(-Math.pow(r - rk, 2) / (2 * s * s));
      }
      // Petals
      const petalMask = Math.exp(-Math.pow(r - R * 0.55, 2) / (2 * Math.pow(R * 0.18, 2)));
      v += ((Math.cos(sym * th) + 1) / 2) * petalMask;
      // Spokes
      v += Math.pow(Math.abs(Math.cos(sym * th / 2)), 10) * (1 - r / R) * 0.7;
      // Centre dot
      v += Math.exp(-r * r / (2 * Math.pow(R * 0.055, 2))) * 2;

      f[y * w + x] = Math.min(1, v * 0.55) * (0.9 + 0.1 * rng());
    }
  }
  return f;
}

// Geometric — checkerboard border/fill with diagonal accent
function genGeometric(w, h, rng) {
  const f    = new Float32Array(w * h);
  const cell = Math.min(w, h) / 10;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx  = (x % cell) / cell;
      const fy  = (y % cell) / cell;
      const ed  = Math.min(fx, 1 - fx, fy, 1 - fy) * 2; // 0 at edge → 1 at centre
      const cx2 = Math.floor(x / cell);
      const cy2 = Math.floor(y / cell);
      const chk = (cx2 + cy2) & 1;
      const v   = chk === 0 ? Math.pow(1 - ed, 2.5) : Math.pow(ed, 2.5) * 0.65;
      f[y * w + x] = v * (0.9 + 0.1 * rng());
    }
  }
  return f;
}

// Spiral — Archimedean spiral
function genSpiral(w, h, rng) {
  const f   = new Float32Array(w * h);
  const cx  = w / 2, cy = h / 2;
  const R   = Math.min(w, h) * 0.46;
  const turns = 6;
  const TP  = 2 * Math.PI;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const r  = Math.sqrt(dx * dx + dy * dy);
      if (r >= R || r < 1) { f[y * w + x] = 0; continue; }
      const th = (Math.atan2(dy, dx) + TP) % TP;
      let minD = Infinity;
      for (let t = 0; t <= turns; t++) {
        const sr = R * (th + t * TP) / (turns * TP);
        minD = Math.min(minD, Math.abs(r - sr));
      }
      const sig = R * 0.023;
      f[y * w + x] = Math.exp(-minD * minD / (2 * sig * sig)) * (0.85 + 0.15 * rng());
    }
  }
  return f;
}

// Stars — gaussian star spots + milky-way diffuse band
function genStars(w, h, rng) {
  const f = new Float32Array(w * h);
  const nStars = Math.max(18, Math.round(Math.min(w, h) / 5));
  const stars  = Array.from({ length: nStars }, () => ({
    x: rng() * w,
    y: rng() * h,
    r: (Math.pow(rng(), 2) * 0.11 + 0.012) * Math.min(w, h),
    b: 0.45 + rng() * 0.55,
  }));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (const s of stars) {
        const dx = x - s.x, dy = y - s.y;
        v += s.b * Math.exp(-(dx * dx + dy * dy) / (2 * s.r * s.r));
      }
      const bandY = h / 2 + Math.sin(x * 0.012) * h * 0.1;
      v += 0.14 * Math.exp(-Math.pow(y - bandY, 2) / (2 * Math.pow(h * 0.22, 2)));
      f[y * w + x] = Math.min(1, v) * (0.72 + 0.28 * rng());
    }
  }
  return f;
}

// Cross — pharmacy / medical cross
function genCross(w, h, rng) {
  const f   = new Float32Array(w * h);
  const cx  = w / 2, cy = h / 2;
  const aw  = Math.min(w, h) * 0.14;  // arm half-width
  const ah  = Math.min(w, h) * 0.44;  // arm half-length

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
      const inV = dx < aw && dy < ah;
      const inH = dy < aw && dx < ah;
      if (!inV && !inH) { f[y * w + x] = 0; continue; }
      // Soft gradient from edge → centre
      const edgeDist = inV ? (aw - dx) / aw : (aw - dy) / aw;
      f[y * w + x] = Math.sqrt(Math.max(0, edgeDist)) * (0.85 + 0.15 * rng());
    }
  }
  return f;
}

// Butterfly — polar butterfly curve
function genButterfly(w, h, rng) {
  const f     = new Float32Array(w * h);
  const cx    = w / 2, cy = h / 2;
  const scale = Math.min(w, h) / 4.8;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / scale;
      const dy = -(y - cy) / scale;
      const r  = Math.sqrt(dx * dx + dy * dy);
      if (r < 0.05) { f[y * w + x] = 0.5; continue; }
      const th = Math.atan2(dy, dx);
      // r = e^(sin θ) − 2 cos(4θ) + sin⁵((2θ−π)/24)
      const rExp = Math.exp(Math.sin(th))
                 - 2 * Math.cos(4 * th)
                 + Math.pow(Math.sin((2 * th - Math.PI) / 24), 5);
      if (rExp < 0) { f[y * w + x] = 0; continue; }
      const dist = Math.abs(r - rExp / 2.5);
      const sig  = 0.08;
      f[y * w + x] = Math.exp(-dist * dist / (2 * sig * sig)) * (0.82 + 0.18 * rng());
    }
  }
  return f;
}

// Tree — recursive fractal branches rasterised with gaussian kernel
function genTree(w, h, rng) {
  const f    = new Float32Array(w * h);
  const segs = [];

  function branch(x1, y1, angle, len, depth) {
    if (depth === 0 || len < 2) return;
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 - Math.sin(angle) * len;
    segs.push({ x1, y1, x2, y2, sig: Math.max(0.9, depth * 0.65) });
    const spread = 0.32 + rng() * 0.28;
    branch(x2, y2, angle - spread, len * 0.7, depth - 1);
    branch(x2, y2, angle + spread, len * 0.7, depth - 1);
  }

  branch(w / 2, h * 0.93, Math.PI / 2, h * 0.25, 8);

  for (const seg of segs) {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const len   = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(len * 1.5);
    const r     = Math.ceil(seg.sig * 3);

    for (let t = 0; t <= steps; t++) {
      const px = seg.x1 + dx * t / steps;
      const py = seg.y1 + dy * t / steps;
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          const tx = Math.round(px + ox), ty = Math.round(py + oy);
          if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
          const v   = Math.exp(-(ox * ox + oy * oy) / (2 * seg.sig * seg.sig));
          const idx = ty * w + tx;
          f[idx] = Math.min(1, f[idx] + v * 0.6);
        }
      }
    }
  }

  for (let i = 0; i < w * h; i++) f[i] *= (0.9 + 0.1 * rng());
  return f;
}

// Random — smooth value noise
function genRandom(w, h, rng) {
  const f   = new Float32Array(w * h);
  const sc  = Math.min(w, h) / 6;
  const gw  = Math.ceil(w / sc) + 2;
  const gh  = Math.ceil(h / sc) + 2;
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  function sm(t) { return t * t * (3 - 2 * t); }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / sc, gy = y / sc;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const tx = sm(gx - ix),   ty = sm(gy - iy);
      const v00 = grid[iy * gw + ix]       || 0;
      const v10 = grid[iy * gw + ix + 1]   || 0;
      const v01 = grid[(iy + 1) * gw + ix] || 0;
      const v11 = grid[(iy + 1) * gw + ix + 1] || 0;
      const val = (v00 * (1 - tx) + v10 * tx) * (1 - ty)
                + (v01 * (1 - tx) + v11 * tx) * ty;
      f[y * w + x] = val * (0.8 + 0.2 * rng());
    }
  }
  return f;
}

// Text — render word on offscreen canvas, use darkness as weight
function genText(w, h, text, rng) {
  const oc  = document.createElement('canvas');
  oc.width  = w; oc.height = h;
  const ox  = oc.getContext('2d');
  ox.fillStyle = '#fff';
  ox.fillRect(0, 0, w, h);
  ox.fillStyle = '#000';
  let fs = Math.min(w * 0.8, h * 0.65);
  ox.font = `900 ${fs}px sans-serif`;
  ox.textAlign = 'center';
  ox.textBaseline = 'middle';
  const tw = ox.measureText(text).width;
  if (tw > w * 0.92) {
    fs = Math.floor(fs * w * 0.92 / tw);
    ox.font = `900 ${fs}px sans-serif`;
  }
  ox.fillText(text, w / 2, h / 2);
  const d = ox.getImageData(0, 0, w, h).data;
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    f[i] = Math.min(1, (255 - d[i * 4]) / 255 + rng() * 0.06);
  }
  return f;
}

// ═══════════════════════════════════════════════════════════════
// IMAGE UPLOAD → SILHOUETTE WEIGHT MAP
// ═══════════════════════════════════════════════════════════════
let _uploadedImage = null; // HTMLImageElement or null

function setUploadedImage(img) {
  _uploadedImage = img;
}

function clearUploadedImage() {
  _uploadedImage = null;
}

function genFromImage(w, h, img, rng) {
  const oc = document.createElement('canvas');
  oc.width = w;
  oc.height = h;
  const ctx = oc.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  // Fit image into canvas preserving aspect ratio
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const ox = (w - dw) / 2;
  const oy = (h - dh) / 2;
  ctx.drawImage(img, ox, oy, dw, dh);

  const data = ctx.getImageData(0, 0, w, h).data;
  const f = new Float32Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Luminance → darkness as weight (darker = more dots)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const darkness = 1 - lum;
    // Threshold to silhouette: anything darker than 50% gray → strong weight
    const sil = darkness > 0.3 ? Math.min(1, darkness * 1.4) : darkness * 0.3;
    f[i] = Math.min(1, sil + rng() * 0.04);
  }
  return f;
}

// ═══════════════════════════════════════════════════════════════
// PROMPT PARSER
// ═══════════════════════════════════════════════════════════════
const KEYWORDS = {
  heart:     ['heart','love','valentine','amor','romance','love'],
  stars:     ['star','galaxy','space','constellation','cosmos','nebula','astronomy','night sky'],
  waves:     ['wave','ocean','water','sea','lake','river','flow','ripple','tide','aqua'],
  mandala:   ['mandala','radial','circular','lotus','zen','medallion','bloom','flower','kaleidoscope'],
  geometric: ['geometric','grid','hex','hexagon','diamond','polygon','mosaic','tile','lattice','pattern'],
  spiral:    ['spiral','swirl','vortex','helix','twirl','spin','tornado','whirl'],
  cross:     ['cross','plus','medical','pharma','health','clinic','rx'],
  butterfly: ['butterfly','wings','moth','flutter'],
  tree:      ['tree','nature','plant','forest','leaf','branch','organic','roots','botanical'],
};

function parseStyle(prompt) {
  const p = prompt.toLowerCase().trim();
  // "text: WORD" or "word: WORD"
  const tm = p.match(/^(?:text|word|letter)[:\s]+(.+)$/);
  if (tm) return { type: 'text', val: tm[1].trim().toUpperCase().slice(0, 12) };

  for (const [style, kws] of Object.entries(KEYWORDS)) {
    if (kws.some(k => p.includes(k))) return { type: style };
  }
  // Short alphanumeric → treat as text label
  if (/^[a-z0-9!?&$]+$/i.test(p) && p.length <= 10) {
    return { type: 'text', val: p.toUpperCase() };
  }
  return { type: 'random' };
}

function generateWeights(cw, ch, prompt, seed) {
  const rng = createRng(seed);
  if (_uploadedImage) return genFromImage(cw, ch, _uploadedImage, rng);
  const s   = parseStyle(prompt);
  switch (s.type) {
    case 'heart':     return genHeart(cw, ch, rng);
    case 'waves':     return genWaves(cw, ch, rng);
    case 'mandala':   return genMandala(cw, ch, rng);
    case 'geometric': return genGeometric(cw, ch, rng);
    case 'spiral':    return genSpiral(cw, ch, rng);
    case 'stars':     return genStars(cw, ch, rng);
    case 'cross':     return genCross(cw, ch, rng);
    case 'butterfly': return genButterfly(cw, ch, rng);
    case 'tree':      return genTree(cw, ch, rng);
    case 'text':      return genText(cw, ch, s.val, rng);
    default:          return genRandom(cw, ch, rng);
  }
}

// ═══════════════════════════════════════════════════════════════
// EXACT DOT PLACEMENT — histogram threshold method  O(n)
// ═══════════════════════════════════════════════════════════════
function placeDots(weights, n, total) {
  n = Math.min(n, total);
  const result = new Uint8Array(total).fill(255); // all white
  if (n === 0) return result;
  if (n === total) { result.fill(0); return result; }

  // Build histogram
  const BINS = 65536;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < total; i++) {
    hist[Math.min(BINS - 1, weights[i] * BINS | 0)]++;
  }

  // Scan from top bin downward to find threshold
  let cumAbove = 0, thBin = 0;
  for (let b = BINS - 1; b >= 0; b--) {
    if (cumAbove + hist[b] >= n) { thBin = b; break; }
    cumAbove += hist[b];
  }

  // Mark above-threshold pixels black, collect at-threshold
  const atTh = [];
  for (let i = 0; i < total; i++) {
    const b = Math.min(BINS - 1, weights[i] * BINS | 0);
    if (b > thBin) result[i] = 0;
    else if (b === thBin) atTh.push(i);
  }

  // Partial Fisher-Yates: randomly select exactly (n − cumAbove) from atTh
  const need = Math.min(n - cumAbove, atTh.length);
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(Math.random() * (atTh.length - i));
    const tmp = atTh[i]; atTh[i] = atTh[j]; atTh[j] = tmp;
    result[atTh[i]] = 0;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// METRICS UI
// ═══════════════════════════════════════════════════════════════
function updateMetrics(m) {
  const elDots = document.getElementById('mDots');
  if (elDots) elDots.textContent = m.requiredDots.toLocaleString();
  const elDotsPer = document.getElementById('mDotsPerCopy');
  if (elDotsPer) {
    elDotsPer.textContent = S.numDesigns > 1 ? `${m.dotsPerCopy.toLocaleString()} per copy` : '';
  }

  const dEl = document.getElementById('mDensity');
  if (dEl) {
    dEl.textContent = isFinite(m.density) ? m.density.toFixed(2) + '%' : '∞';
    dEl.className = 'm-val' + (m.requiredDots > m.maxCap ? ' danger' : '');
  }
  const elDoseCopy = document.getElementById('mDosePerCopy');
  if (elDoseCopy) {
    elDoseCopy.textContent = S.numDesigns > 1 ? `${m.dosePerCopy} µg per copy` : '';
  }

  const elCap = document.getElementById('mCap');
  if (elCap) elCap.textContent = m.maxCap.toLocaleString() + ' dots';

  const bar = document.getElementById('densityBar');
  if (bar) {
    const pct = Math.min(100, isFinite(m.density) ? m.density : 100);
    bar.style.width = pct + '%';
    bar.style.background = m.requiredDots > m.maxCap ? 'var(--danger)' : 'var(--accent)';
  }
}

function updateHmsSummary(style, N) {
  const m = calcMetrics();
  const st = _uploadedImage ? 'Custom image' : (style.type + (style.val ? ` "${style.val}"` : ''));
  const summary = `${S.desiredDose} µg · ${st} · ${m.requiredDots.toLocaleString()} dots`;

  const doseLine = document.getElementById('hmsDoseLine');
  if (doseLine) doseLine.textContent = summary;
}

// ═══════════════════════════════════════════════════════════════
// RENDER PIPELINE
// ═══════════════════════════════════════════════════════════════
const canvas = document.getElementById('patternCanvas');
const ctx    = canvas.getContext('2d');
let renderTimer = null;

function render() {
  const gen = document.getElementById('screen-hms');
  if (gen && !gen.classList.contains('is-active')) return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(_doRender, 45);
}

function _doRender() {
  const m    = calcMetrics();
  updateMetrics(m);

  const errEl = document.getElementById('errorMsg');
  if (m.requiredDots > m.maxCap) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = `⚠  Dosage exceeds print capacity — ${m.requiredDots.toLocaleString()} dots needed, `
        + `but maximum is ${m.maxCap.toLocaleString()} at `
        + `${S.printWidth}"×${S.printHeight}" @ ${S.dpi} DPI.`;
    }
    const lo = document.getElementById('loadingOverlay');
    if (lo) lo.style.display = 'none';
    return;
  }
  if (errEl) errEl.style.display = 'none';

  // ── Tile layout ──────────────────────────────────────────────
  const N = S.numDesigns;
  const { cw, ch } = getCanvasDims();

  // Tile along the longer physical axis for best visual fit
  const tileVertical = S.printHeight >= S.printWidth;
  let tileW, tileH, cols, rows;
  if (tileVertical) {
    cols  = 1; rows = N;
    tileW = cw;
    tileH = Math.max(4, Math.floor(ch / N));
  } else {
    rows  = 1; cols = N;
    tileH = ch;
    tileW = Math.max(4, Math.floor(cw / N));
  }

  // Final canvas size snapped to exact multiples (no fractional tile)
  const finalW = tileW * cols;
  const finalH = tileH * rows;
  canvas.width  = finalW;
  canvas.height = finalH;

  const loadStart = document.getElementById('loadingOverlay');
  if (loadStart) loadStart.style.display = 'flex';

  // Defer heavy work so the loading overlay renders first
  requestAnimationFrame(() => {
    const totalPixels = finalW * finalH;
    const img  = ctx.createImageData(finalW, finalH);
    const d    = img.data;
    // Pre-fill white
    for (let i = 0; i < d.length; i += 4) { d[i] = d[i+1] = d[i+2] = 255; d[i+3] = 255; }

    // Distribute dots evenly; last tile absorbs any rounding remainder
    const baseN    = Math.floor(m.requiredDots / N);
    const tileArea = tileW * tileH;
    let   totalPlaced = 0;

    for (let t = 0; t < N; t++) {
      const col = t % cols;
      const row = Math.floor(t / cols);
      const ox  = col * tileW;   // pixel offset x in full canvas
      const oy  = row * tileH;   // pixel offset y in full canvas

      // Last tile absorbs remainder so total is exact
      const thisDots = (t === N - 1)
        ? (m.requiredDots - totalPlaced)
        : baseN;
      totalPlaced += thisDots;

      // Generate weights and place dots for this tile
      const weights = generateWeights(tileW, tileH, S.prompt, S.seed);
      const pixels  = placeDots(weights, Math.min(thisDots, tileArea), tileArea);

      // Blit tile into full canvas ImageData
      for (let ty = 0; ty < tileH; ty++) {
        for (let tx = 0; tx < tileW; tx++) {
          const v   = pixels[ty * tileW + tx];
          const idx = ((oy + ty) * finalW + (ox + tx)) * 4;
          d[idx] = d[idx+1] = d[idx+2] = v;
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // Draw subtle separator lines between copies
    if (N > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232, 224, 210, 0.45)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      for (let t = 1; t < N; t++) {
        const col = t % cols;
        const row = Math.floor(t / cols);
        ctx.beginPath();
        if (tileVertical) {
          const y = row * tileH - 0.5;
          ctx.moveTo(0, y); ctx.lineTo(finalW, y);
        } else {
          const x = col * tileW - 0.5;
          ctx.moveTo(x, 0); ctx.lineTo(x, finalH);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    const loadEl = document.getElementById('loadingOverlay');
    if (loadEl) loadEl.style.display = 'none';

    const style = parseStyle(S.prompt);
    const tagEl = document.getElementById('styleTag');
    if (tagEl) {
      tagEl.textContent =
        `Style: ${style.type}${style.val ? ' "' + style.val + '"' : ''}  ·  ${N}× copy`;
    }

    const infoEl = document.getElementById('infoBar');
    if (infoEl) {
      infoEl.textContent =
      `Canvas ${finalW}×${finalH} px  ·  Print ${S.printWidth}"×${S.printHeight}" @ ${S.dpi} DPI  ·  `
      + `${m.requiredDots.toLocaleString()} total dots  ·  ${m.dotsPerCopy.toLocaleString()} per copy  ·  `
      + `${m.density.toFixed(3)}% density`;
    }

    updateHmsSummary(style, N);
    window.dispatchEvent(new Event('pharmaink:rendered'));
  });
}

// ═══════════════════════════════════════════════════════════════
// UI — PROMPT (simplified — no sliders, copies, or action buttons)
// ═══════════════════════════════════════════════════════════════
function applyPrompt() {
  S.prompt = (document.getElementById('promptInput')?.value || '').trim() || 'random';
  S.seed   = Date.now();
  render();
}

// Rerender on resize
window.addEventListener('resize', render);

// ═══════════════════════════════════════════════════════════════
// HMS API (catalog / external callers)
// ═══════════════════════════════════════════════════════════════
window.PharmaPattern = {
  setPromptAndApply(prompt) {
    clearUploadedImage();
    const input = document.getElementById('promptInput');
    if (!input) return;
    input.value = prompt;
    applyPrompt();
  },
  setImageAndRender(imgEl) {
    setUploadedImage(imgEl);
    S.seed = Date.now();
    render();
  },
  clearImage() {
    clearUploadedImage();
    render();
  },
};

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
window.addEventListener('load', render);
