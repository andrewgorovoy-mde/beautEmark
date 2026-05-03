/**
 * Symptom tracker — Iris voice flow + manual rating + trend charts.
 */
(function () {

// ── Trend chart rendering ───────────────────────────────────────

/** Axis labels on canvas charts — keep ≥12px CSS px for age-related vision changes */
const CHART_AXIS_FONT = '13px "Source Sans 3", system-ui, sans-serif';

/** Aligned to core palette: Ink, Cream, Monarch, Blush */
const TREND_COLORS = {
  'hot-flashes': { line: '#E6C2AC', fill: 'rgba(230,194,172,0.14)', dot: '#c9a896' },
  'sleep':       { line: '#DF9221', fill: 'rgba(223,146,33,0.12)', dot: '#b5770e' },
  'mood':        { line: '#c9a896', fill: 'rgba(201,168,150,0.14)', dot: '#8A857D' },
  'fatigue':     { line: '#A39D94', fill: 'rgba(163,157,148,0.14)', dot: '#6E6A64' },
  'headache':    { line: '#E8B04E', fill: 'rgba(232,176,78,0.12)', dot: '#DF9221' },
  'joint-pain':  { line: '#C9C3BB', fill: 'rgba(201,195,187,0.14)', dot: '#8A857D' },
  'brain-fog':   { line: '#8A857D', fill: 'rgba(138,133,125,0.12)', dot: '#5C5954' },
  'dryness':     { line: '#EDD4C6', fill: 'rgba(237,212,198,0.18)', dot: '#c9a896' },
  'weight':      { line: '#D4C4B8', fill: 'rgba(212,196,184,0.14)', dot: '#8A857D' },
  'heart':       { line: '#E6C2AC', fill: 'rgba(230,194,172,0.16)', dot: '#c9a896' },
};

/** Same ordering as aggregate chart & personal slider (indices 1–6). */
const AGG_SYMPTOMS = ['hot-flashes', 'sleep', 'mood', 'fatigue', 'headache', 'joint-pain'];

/** Mock Iris-style transcriptions per symptom, one per day (14). */
const MOCK_TRANSCRIPTION_BY_DAY = {
  'hot-flashes': [
    'Voice memo: “Woke up drenched around 3am — couldn’t cool down for an hour.”',
    '“Flushed badly during my afternoon meeting; had to step outside.”',
    '“Only a light wave this evening — better than yesterday.”',
    '“Night sweats came back; kept the fan on high all night.”',
    '“Heat started after coffee, faded by lunch.”',
    '“Feeling cooler overall; one short flash at bedtime.”',
    '“Pretty bad wave after my walk — had to sit on a bench.”',
    '“Mild warmth, nothing I couldn’t manage.”',
    '“Sweating through my shirt on the train — embarrassing.”',
    '“Hot flash then a chill — same old roller coaster.”',
    '“Barely noticed today; logging as mild.”',
    '“Woke twice from overheating.”',
    '“Face burning in the grocery line for maybe ten minutes.”',
    '“Fewer episodes than last week — noting improvement.”',
  ],
  'sleep': [
    '“Slept straight through — first time in a while.”',
    '“Woke at 4am and stared at the ceiling for an hour.”',
    '“Took ages to fall asleep; mind wouldn’t switch off.”',
    '“Napped in the afternoon because last night was rough.”',
    '“Restless legs kept me up; felt groggy all day.”',
    '“Solid seven hours — I’ll take it.”',
    '“Woke from a nightmare and couldn’t get back under.”',
    '“Dozed on and off; not restorative.”',
    '“Earplugs helped — finally some quiet.”',
    '“Up twice for the bathroom, then wide awake.”',
    '“Slept deeply until the alarm — rare win.”',
    '“Tossed and turned; partner noticed.”',
    '“Fell asleep early, woke too early.”',
    '“Melatonin might have helped — unsure.”',
  ],
  'mood': [
    '“Felt weepy at breakfast for no clear reason.”',
    '“Irritable at small things — sorry to my family.”',
    '“Calm and steady today; grateful.”',
    '“Anxious before the doctor call.”',
    '“Low and flat; hard to enjoy anything.”',
    '“Snapped at a coworker — not like me.”',
    '“Laughing with a friend — mood lifted.”',
    '“Cried in the car after work.”',
    '“Neutral — neither up nor down.”',
    '“Felt hopeful after my walk.”',
    '“Overwhelmed by chores; shut down.”',
    '“Short fuse all morning, better after lunch.”',
    '“Felt peaceful reading before bed.”',
    '“Roller coaster day — hard to predict.”',
  ],
  'fatigue': [
    '“Dragged myself through the morning; coffee didn’t touch it.”',
    '“Energy crashed after lunch — wanted a nap under my desk.”',
    '“Decent energy until about 3pm, then hit a wall.”',
    '“Heavy legs climbing the stairs.”',
    '“Felt almost normal — celebrated small wins.”',
    '“Brain and body both tired; skipped the gym.”',
    '“Pushed through work but paid for it later.”',
    '“Woke up tired; stayed tired.”',
    '“Short walk helped a little.”',
    '“Could barely keep eyes open on the sofa.”',
    '“Better than yesterday — still not great.”',
    '“Afternoon slump worse than usual.”',
    '“Managed a light workout; proud of that.”',
    '“Ran on fumes; in bed by nine.”',
  ],
  'headache': [
    '“Dull ache behind my eyes most of the day.”',
    '“Clear — no headache at all.”',
    '“Migraine-ish; dark room and water helped.”',
    '“Tension at the temples after screen time.”',
    '“Woke with a headache; faded by noon.”',
    '“Pressure when I bent over — sinus-y.”',
    '“Sharp pain for an hour; then gone.”',
    '“Low-grade all afternoon.”',
    '“Dehydration maybe — drank more water.”',
    '“Pounding before a storm; barometric?”',
    '“Neck tightness into a headache.”',
    '“Medication took the edge off.”',
    '“Skipped caffeine; head felt clearer.”',
    '“Annoying but manageable.”',
  ],
  'joint-pain': [
    '“Stiff getting out of bed; knees complained.”',
    '“Hips ached after sitting too long.”',
    '“Hands stiff while typing — warmed up slowly.”',
    '“Back twinge lifting groceries.”',
    '“Surprisingly loose after yoga.”',
    '“Left shoulder nagging all day.”',
    '“Ankles sore after standing in line.”',
    '“Joint pain mild — noting it anyway.”',
    '“Rainy day; everything felt creaky.”',
    '“Better mobility than last week.”',
    '“Ibuprofen when it flared at dinner.”',
    '“Worse in the cold walk home.”',
    '“Foam roller helped my lower back.”',
    '“Sharp knee pain going downstairs — careful.”',
  ],
};

function generateSampleData() {
  const now = new Date();
  const days = 14;

  function pts(base, variance, trend) {
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const drift = trend * (i / days);
      const noise = (Math.random() - 0.5) * variance;
      let v = Math.round((base + drift + noise) * 10) / 10;
      v = Math.max(1, Math.min(5, Math.round(v)));
      out.push({ date: d, value: v });
    }
    return out;
  }

  const raw = {
    'hot-flashes': pts(3.6, 1.4, -1.0),
    'sleep':       pts(2.8, 1.0, -0.4),
    'mood':        pts(3.0, 1.2, -0.8),
    'fatigue':     pts(3.2, 1.2, -0.5),
    'headache':    pts(2.0, 1.4, -0.2),
    'joint-pain':  pts(2.6, 0.8, 0.1),
  };

  AGG_SYMPTOMS.forEach(function (sym) {
    const lines = MOCK_TRANSCRIPTION_BY_DAY[sym];
    if (!lines || !raw[sym]) return;
    raw[sym] = raw[sym].map(function (p, i) {
      return { date: p.date, value: p.value, note: lines[i] || 'No transcription logged for this day.' };
    });
  });

  return raw;
}

function getTrend(points) {
  if (points.length < 4) return 'stable';
  const half = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, half).reduce((s, p) => s + p.value, 0) / half;
  const secondHalf = points.slice(half).reduce((s, p) => s + p.value, 0) / (points.length - half);
  const diff = secondHalf - firstHalf;
  if (diff < -0.4) return 'improving';
  if (diff > 0.4) return 'worsening';
  return 'stable';
}

function trendLabel(t) {
  if (t === 'improving') return '↓ Improving';
  if (t === 'worsening') return '↑ Worsening';
  return '— Stable';
}

function formatShortDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function drawTrendChart(canvas, points, colors) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padL = 0, padR = 0, padT = 6, padB = 6;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const minVal = 1, maxVal = 5;

  function xOf(i) { return padL + (i / (points.length - 1)) * plotW; }
  function yOf(v) { return padT + plotH - ((v - minVal) / (maxVal - minVal)) * plotH; }

  // Grid lines (severity 1-5)
  ctx.strokeStyle = 'rgba(26,26,24,0.06)';
  ctx.lineWidth = 1;
  for (let v = 1; v <= 5; v++) {
    const y = Math.round(yOf(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }

  // Fill area under curve
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(points[0].value));
  for (let i = 1; i < points.length; i++) {
    const x0 = xOf(i - 1), y0 = yOf(points[i - 1].value);
    const x1 = xOf(i), y1 = yOf(points[i].value);
    const cpx = (x0 + x1) / 2;
    ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
  }
  ctx.lineTo(xOf(points.length - 1), h - padB);
  ctx.lineTo(xOf(0), h - padB);
  ctx.closePath();
  ctx.fillStyle = colors.fill;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(points[0].value));
  for (let i = 1; i < points.length; i++) {
    const x0 = xOf(i - 1), y0 = yOf(points[i - 1].value);
    const x1 = xOf(i), y1 = yOf(points[i].value);
    const cpx = (x0 + x1) / 2;
    ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
  }
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Dots
  points.forEach((p, i) => {
    const x = xOf(i);
    const y = yOf(p.value);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.strokeStyle = colors.dot;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Last-point emphasis
  const lastX = xOf(points.length - 1);
  const lastY = yOf(points[points.length - 1].value);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = colors.line;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

let trendsRendered = false;
let sampleDataCache = null;

function getSampleData() {
  if (!sampleDataCache) sampleDataCache = generateSampleData();
  return sampleDataCache;
}

// ── Personal data: all symptoms chart + slider + transcriptions ─────────
let personalHighlightSlider = 0;
let personalSelectedDay = null;
let personalChartGeom = null;

function getSliderLabel(sliderVal) {
  if (sliderVal === 0) return 'All symptoms';
  const sym = AGG_SYMPTOMS[sliderVal - 1];
  return SYMPTOM_LABELS[sym] || sym;
}

function buildPersonalSliderTicks() {
  const ticks = document.getElementById('personalSliderTicks');
  if (!ticks) return;
  const labels = ['All', 'Hot', 'Sleep', 'Mood', 'Fatigue', 'Head', 'Joint'];
  ticks.innerHTML = labels.map(function (t) {
    return '<span>' + t + '</span>';
  }).join('');
}

function renderPersonalTranscriptionPanel() {
  const panel = document.getElementById('personalTranscriptionPanel');
  const dateEl = document.getElementById('personalTranscriptionDate');
  const bodyEl = document.getElementById('personalTranscriptionBody');
  const hint = document.getElementById('personalTranscriptionHint');
  if (!panel || !dateEl || !bodyEl) return;

  if (personalSelectedDay === null) {
    panel.hidden = true;
    if (hint) hint.hidden = false;
    return;
  }

  const data = getSampleData();
  const days = data[AGG_SYMPTOMS[0]].length;
  const idx = Math.max(0, Math.min(days - 1, personalSelectedDay));
  const d = data[AGG_SYMPTOMS[0]][idx].date;

  dateEl.textContent = formatShortDate(d) + ' · voice notes';

  if (personalHighlightSlider === 0) {
    bodyEl.innerHTML = AGG_SYMPTOMS.map(function (sym) {
      const pt = data[sym][idx];
      const label = SYMPTOM_LABELS[sym] || sym;
      return (
        '<div class="personal-transcription-panel__item">' +
          '<div class="personal-transcription-panel__sym">' + label + '</div>' +
          '<blockquote class="personal-transcription-panel__quote">' + escapeHtml(pt.note || '—') + '</blockquote>' +
        '</div>'
      );
    }).join('');
  } else {
    const sym = AGG_SYMPTOMS[personalHighlightSlider - 1];
    const pt = data[sym][idx];
    const label = SYMPTOM_LABELS[sym] || sym;
    bodyEl.innerHTML =
      '<div class="personal-transcription-panel__item">' +
        '<div class="personal-transcription-panel__sym">' + label + '</div>' +
        '<blockquote class="personal-transcription-panel__quote">' + escapeHtml(pt.note || '—') + '</blockquote>' +
      '</div>';
  }

  panel.hidden = false;
  if (hint) hint.hidden = true;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function drawPersonalAllSymptomsChart() {
  const canvas = document.getElementById('personalAllSymptomsChart');
  if (!canvas) return;

  const data = getSampleData();
  const days = data[AGG_SYMPTOMS[0]].length;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padL = 42;
  const padR = 10;
  const padT = 14;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const minVal = 1;
  const maxVal = 5;

  function xOf(i) {
    return padL + (i / (days - 1)) * plotW;
  }
  function yOf(v) {
    return padT + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;
  }

  personalChartGeom = { padL, padR, padT, padB, plotW, plotH, days, w, h, xOf, yOf, minVal, maxVal };

    ctx.fillStyle = '#F4F0E6';
  ctx.fillRect(0, 0, w, h);

  ctx.font = CHART_AXIS_FONT;
  ctx.fillStyle = '#8A857D';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  [1, 3, 5].forEach(function (v) {
    const y = yOf(v);
    ctx.fillText(v === 1 ? 'Low' : v === 3 ? 'Mid' : 'High', padL - 6, y);
    ctx.strokeStyle = 'rgba(26, 26, 24, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(y) + 0.5);
    ctx.lineTo(w - padR, Math.round(y) + 0.5);
    ctx.stroke();
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelIdxs = [0, Math.floor(days / 2), days - 1];
  labelIdxs.forEach(function (i) {
    ctx.fillText(formatShortDate(data[AGG_SYMPTOMS[0]][i].date), xOf(i), h - padB + 6);
  });

  const avgPoints = [];
  for (let i = 0; i < days; i++) {
    let sum = 0;
    let count = 0;
    AGG_SYMPTOMS.forEach(function (sym) {
      if (data[sym] && data[sym][i]) {
        sum += data[sym][i].value;
        count++;
      }
    });
    avgPoints.push({ value: Math.round((sum / (count || 1)) * 10) / 10 });
  }

  function drawLine(pts, color, lineWidth, alpha) {
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(pts[0].value));
    for (let i = 1; i < pts.length; i++) {
      const x0 = xOf(i - 1);
      const y0 = yOf(pts[i - 1].value);
      const x1 = xOf(i);
      const y1 = yOf(pts[i].value);
      const cpx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (personalHighlightSlider === 0) {
    AGG_SYMPTOMS.forEach(function (sym) {
      const pts = data[sym];
      if (!pts) return;
      const col = TREND_COLORS[sym] || TREND_COLORS.fatigue;
      drawLine(pts, col.line, 2, 0.5);
    });
    drawLine(avgPoints, '#1A1A18', 2.8, 1);
  } else {
    const focusSym = AGG_SYMPTOMS[personalHighlightSlider - 1];
    AGG_SYMPTOMS.forEach(function (sym) {
      const pts = data[sym];
      if (!pts) return;
      const col = TREND_COLORS[sym] || TREND_COLORS.fatigue;
      const isFocus = sym === focusSym;
      drawLine(pts, col.line, isFocus ? 3 : 1.5, isFocus ? 1 : 0.18);
    });
  }

  function drawDots(pts, color, radius) {
    for (let i = 0; i < pts.length; i++) {
      const x = xOf(i);
      const y = yOf(pts[i].value);
      const selected = personalSelectedDay === i;
      ctx.beginPath();
      ctx.arc(x, y, selected ? radius + 2 : radius, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.stroke();
      if (selected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(26, 26, 24, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  if (personalHighlightSlider === 0) {
    drawDots(avgPoints, '#1A1A18', 3.5);
  } else {
    const focusSym = AGG_SYMPTOMS[personalHighlightSlider - 1];
    drawDots(data[focusSym], (TREND_COLORS[focusSym] || TREND_COLORS.fatigue).line, 4);
  }
}

function nearestDayFromClientX(canvas, clientX) {
  if (!personalChartGeom) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const g = personalChartGeom;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < g.days; i++) {
    const d = Math.abs(g.xOf(i) - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function initPersonalSymptomChart() {
  const canvas = document.getElementById('personalAllSymptomsChart');
  const slider = document.getElementById('personalSymptomSlider');
  const sliderValEl = document.getElementById('personalSliderValue');
  if (!canvas) return;

  buildPersonalSliderTicks();

  if (slider && !slider._personalBound) {
    slider._personalBound = true;
    slider.addEventListener('input', function () {
      personalHighlightSlider = parseInt(slider.value, 10) || 0;
      if (sliderValEl) sliderValEl.textContent = getSliderLabel(personalHighlightSlider);
      slider.setAttribute('aria-valuetext', getSliderLabel(personalHighlightSlider));
      drawPersonalAllSymptomsChart();
      renderPersonalTranscriptionPanel();
    });
  }

  if (!canvas._personalBound) {
    canvas._personalBound = true;
    canvas.addEventListener('click', function (e) {
      const idx = nearestDayFromClientX(canvas, e.clientX);
      if (idx === null) return;
      personalSelectedDay = idx;
      drawPersonalAllSymptomsChart();
      renderPersonalTranscriptionPanel();
    });
  }

  personalHighlightSlider = slider ? parseInt(slider.value, 10) || 0 : 0;
  if (sliderValEl) sliderValEl.textContent = getSliderLabel(personalHighlightSlider);
  requestAnimationFrame(function () {
    drawPersonalAllSymptomsChart();
  });
}

function initTrends() {
  if (trendsRendered) return;
  trendsRendered = true;
  initPersonalSymptomChart();
}

// Trigger trend charts when Personal data screen becomes visible
const personalScreen = document.getElementById('screen-sub-personal');
if (personalScreen) {
  const obs = new MutationObserver(() => {
    if (personalScreen.classList.contains('is-active')) {
      initTrends();
      requestAnimationFrame(function () {
        drawPersonalAllSymptomsChart();
      });
    }
  });
  obs.observe(personalScreen, { attributes: true, attributeFilter: ['class'] });
  if (personalScreen.classList.contains('is-active')) {
    initTrends();
    requestAnimationFrame(function () {
      drawPersonalAllSymptomsChart();
    });
  }
}

window.addEventListener('resize', () => {
  if (trendsRendered) drawPersonalAllSymptomsChart();
  if (aggregateRendered) renderAggregateChart();
});

// ── Aggregate chart (You dashboard) ─────────────────────────────
let aggregateRendered = false;

function renderAggregateChart() {
  const canvas = document.getElementById('aggregateChart');
  if (!canvas) return;
  aggregateRendered = true;

  const data = getSampleData();
  const days = data[AGG_SYMPTOMS[0]].length;

  // Compute daily average severity across all symptom categories
  const avgPoints = [];
  for (let i = 0; i < days; i++) {
    let sum = 0, count = 0;
    AGG_SYMPTOMS.forEach(sym => {
      if (data[sym] && data[sym][i]) {
        sum += data[sym][i].value;
        count++;
      }
    });
    avgPoints.push({
      date: data[AGG_SYMPTOMS[0]][i].date,
      value: Math.round((sum / (count || 1)) * 10) / 10,
    });
  }

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padL = 40, padR = 8, padT = 14, padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const minVal = 1, maxVal = 5;

  function xOf(i) { return padL + (i / (days - 1)) * plotW; }
  function yOf(v) { return padT + plotH - ((v - minVal) / (maxVal - minVal)) * plotH; }

  // Y-axis labels
  ctx.font = CHART_AXIS_FONT;
  ctx.fillStyle = '#8A857D';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  [1, 3, 5].forEach(v => {
    const y = yOf(v);
    ctx.fillText(v === 1 ? 'Low' : v === 3 ? 'Mid' : 'High', padL - 6, y);
    ctx.strokeStyle = 'rgba(26, 26, 24, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(y) + 0.5);
    ctx.lineTo(w - padR, Math.round(y) + 0.5);
    ctx.stroke();
  });

  // X-axis dates
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#8A857D';
  const labelIdxs = [0, Math.floor(days / 2), days - 1];
  labelIdxs.forEach(i => {
    ctx.fillText(formatShortDate(avgPoints[i].date), xOf(i), h - padB + 6);
  });

  // Individual symptom lines (thin, transparent)
  AGG_SYMPTOMS.forEach(sym => {
    const pts = data[sym];
    if (!pts) return;
    const col = TREND_COLORS[sym] || TREND_COLORS['fatigue'];
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(pts[0].value));
    for (let i = 1; i < pts.length; i++) {
      const x0 = xOf(i - 1), y0 = yOf(pts[i - 1].value);
      const x1 = xOf(i), y1 = yOf(pts[i].value);
      ctx.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1);
    }
    ctx.strokeStyle = col.line;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Aggregate average line (bold)
  const aggColor = '#1A1A18';
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(avgPoints[0].value));
  for (let i = 1; i < avgPoints.length; i++) {
    const x0 = xOf(i - 1), y0 = yOf(avgPoints[i - 1].value);
    const x1 = xOf(i), y1 = yOf(avgPoints[i].value);
    ctx.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1);
  }
  ctx.strokeStyle = aggColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dots on aggregate
  avgPoints.forEach((p, i) => {
    const x = xOf(i), y = yOf(p.value);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = aggColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Last dot emphasis
  const last = avgPoints[avgPoints.length - 1];
  const lx = xOf(avgPoints.length - 1), ly = yOf(last.value);
  ctx.beginPath();
  ctx.arc(lx, ly, 5, 0, Math.PI * 2);
  ctx.fillStyle = aggColor;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Legend
  const legend = document.getElementById('aggregateLegend');
  if (legend && !legend.hasChildNodes()) {
    const items = [
      { label: 'Average', color: aggColor, thick: true },
      ...AGG_SYMPTOMS.map(sym => ({
        label: SYMPTOM_LABELS[sym],
        color: TREND_COLORS[sym]?.line || '#999',
        thick: false,
      })),
    ];
    items.forEach(it => {
      const el = document.createElement('span');
      el.className = 'you-aggregate__legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'you-aggregate__swatch';
      swatch.style.background = it.color;
      swatch.style.opacity = it.thick ? '1' : '0.5';
      if (it.thick) swatch.style.width = '14px';
      el.appendChild(swatch);
      el.appendChild(document.createTextNode(it.label));
      legend.appendChild(el);
    });
  }
}

// Render aggregate chart on first paint of the You dashboard
function tryRenderAggregate() {
  const youScreen = document.getElementById('screen-you');
  if (youScreen && youScreen.classList.contains('is-active')) {
    requestAnimationFrame(renderAggregateChart);
  }
}

const youScreen = document.getElementById('screen-you');
if (youScreen) {
  const aggObs = new MutationObserver(tryRenderAggregate);
  aggObs.observe(youScreen, { attributes: true, attributeFilter: ['class'] });
  if (youScreen.classList.contains('is-active')) {
    requestAnimationFrame(renderAggregateChart);
  }
}
window.addEventListener('load', tryRenderAggregate);

// ── Symptom keyword parser ──────────────────────────────────────
// Keywords sorted longest-first so multi-word phrases match before sub-strings.
const SYMPTOM_KEYWORDS = {
  'hot-flashes': ['hot flashes', 'hot flash', 'hot flush', 'hot flushes', 'night sweat', 'night sweats', 'flushing', 'sweating'],
  'sleep':       ['couldn\'t sleep', 'can\'t sleep', 'insomnia', 'woke up', 'restless', 'sleep'],
  'mood':        ['mood swing', 'mood swings', 'anxious', 'anxiety', 'irritable', 'depressed', 'emotional', 'crying', 'mood', 'sad'],
  'fatigue':     ['low energy', 'no energy', 'worn out', 'fatigue', 'exhausted', 'drained', 'tired'],
  'headache':    ['head hurts', 'head pain', 'headache', 'headaches', 'migraine', 'migraines'],
  'joint-pain':  ['back pain', 'joint pain', 'joint', 'stiff', 'sore', 'knees', 'hips', 'pain'],
  'brain-fog':   ['brain fog', 'foggy', 'can\'t concentrate', 'can\'t focus', 'forgetful', 'memory', 'confused', 'cloudy head', 'fuzzy head', 'scatter-brained', 'scatterbrained'],
  'dryness':     ['dry skin', 'dryness', 'dry eyes', 'vaginal dryness', 'dry mouth'],
  'weight':      ['weight gain', 'gained weight', 'bloating', 'bloated', 'swelling'],
  'heart':       ['heart racing', 'heart pounding', 'palpitation', 'palpitations', 'racing heart'],
};

const SYMPTOM_LABELS = {
  'hot-flashes': 'Hot flashes',
  'sleep': 'Sleep impact',
  'mood': 'Mood',
  'fatigue': 'Fatigue',
  'headache': 'Headache',
  'joint-pain': 'Joint pain',
  'brain-fog': 'Brain fog',
  'dryness': 'Dryness',
  'weight': 'Weight / bloating',
  'heart': 'Heart palpitations',
};

// Sentiment tiers — matched against a window of words around the symptom keyword.
// Order matters. Default is 3; weak words like "really"/"very" no longer auto-bump to 4
// (that was the main cause of everything landing on 4).
const SEV_5 = [
  'horrific', 'horrifying', 'unbearable', 'excruciating', 'worst',
  'agonizing', 'crippling', 'debilitating', 'intolerable', 'extreme',
  'absolutely terrible', 'absolutely awful', 'can\'t function', 'can\'t take it',
  'worst ever', 'worst i\'ve', 'worst i have', 'off the charts',
  'did not get a single minute of sleep', 'didn\'t get a single minute of sleep',
  'didnt get a single minute of sleep', 'not a single minute of sleep',
  'not one minute of sleep',
];
// High severity — keep tight; avoid vague tokens ("heavy", "all day", "a lot of") that match neutral speech
const SEV_4 = [
  'terrible', 'awful', 'severe', 'intense', 'brutal', 'horrible',
  'miserable', 'dreadful', 'really bad', 'very bad', 'so bad',
  'pretty bad', 'quite bad', 'major flare', 'significant pain',
  'couldn\'t sleep at all', 'didn\'t sleep at all', 'no sleep',
  'kept me up all night', 'up all night', 'woke me constantly',
  'nonstop pain', 'constant pain', 'unrelenting',
];
const SEV_3_EXPLICIT = [
  'moderate', 'medium', 'fair', 'so-so', 'so so', 'average',
  'not great', 'not good', 'could be better', 'getting by',
  'some discomfort', 'a fair amount', 'in the middle',
];
const SEV_2 = [
  'a little', 'a bit', 'slight', 'mild', 'minor', 'light',
  'not too bad', 'not that bad', 'manageable', 'tolerable',
  'just a touch', 'touch of', 'faint', 'brief', 'small',
  'occasional', 'on and off', 'comes and goes', 'subtle',
  'low-grade', 'low grade', 'barely', 'hardly',
];
const SEV_1 = [
  'barely noticeable', 'almost nothing', 'tiny', 'negligible',
  'very mild', 'very slight', 'very minor', 'very faint',
  'hardly any', 'nearly gone', 'practically gone', 'went away quickly',
];

/** Only these bump default 3 → 4 (generic "really"/"very" are too common in normal speech). */
const STRONG_INTENSIFIERS = [
  'extremely', 'incredibly', 'absolutely', 'utterly', 'desperately',
  'profoundly', 'unbearably', 'intensely', 'severely',
];
/** Nudge mild wording up one step (e.g. 2 → 3), not 3 → 4. */
const SOFT_INTENSIFIERS = [
  'really', 'very', 'pretty', 'quite', 'rather', 'fairly',
];
const DIMINISHERS = [
  'not really', 'not very', 'not too', 'not that',
  'kind of', 'sort of', 'somewhat', 'a little bit',
];

function scoreSeverity(windowText) {
  const w = windowText.toLowerCase();

  // Downgrade common negated phrases ("not that bad", "not really severe")
  if (/\bnot\s+(really|very|that|too)\s+(bad|terrible|awful|horrible|severe)\b/.test(w)) {
    return 2;
  }
  if (/\bnot\s+(too|that)\s+bad\b/.test(w)) return 2;
  if (/\bno\s+big\s+deal\b/.test(w) || /\bnothing\s+serious\b/.test(w)) return 2;

  if (SEV_1.some(m => w.includes(m))) return 1;
  if (SEV_5.some(m => w.includes(m))) return 5;
  if (SEV_4.some(m => w.includes(m))) return 4;
  if (SEV_3_EXPLICIT.some(m => w.includes(m))) return 3;
  if (SEV_2.some(m => w.includes(m))) {
    let s = 2;
    if (STRONG_INTENSIFIERS.some(x => w.includes(x))) s = 4;
    else if (SOFT_INTENSIFIERS.some(x => w.includes(x))) s = 3;
    return Math.min(5, s);
  }

  let base = 3;
  if (STRONG_INTENSIFIERS.some(x => w.includes(x))) base = Math.min(5, base + 1);
  if (DIMINISHERS.some(m => w.includes(m))) base = Math.max(1, base - 1);
  return base;
}

function parseSymptoms(text) {
  const lower = text.toLowerCase();
  const found = [];
  const matched = new Set();

  // Split text into clause-like segments so sentiment stays local to each mention.
  // Splitting on "and", commas, periods, semicolons, "also", "plus", "but" keeps
  // modifiers from bleeding across separate symptom mentions.
  const segments = lower.split(/[.,;!?\n]+|\band\b|\balso\b|\bplus\b|\bbut\b|\bthen\b/);

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    for (const [sym, keywords] of Object.entries(SYMPTOM_KEYWORDS)) {
      if (matched.has(sym)) continue;

      for (const kw of keywords) {
        const idx = trimmed.indexOf(kw);
        if (idx === -1) continue;

        matched.add(sym);

        const severity = scoreSeverity(trimmed);

        // Build a human-readable excerpt from the original-case text
        const fullIdx = lower.indexOf(kw);
        const excerptStart = Math.max(0, fullIdx - 25);
        const excerptEnd = Math.min(text.length, fullIdx + kw.length + 25);
        const excerpt = text.slice(excerptStart, excerptEnd).trim();

        found.push({ symptom: sym, severity, excerpt });
        break;
      }
    }
  }

  // Second pass: scan full text for any categories missed by segment splitting
  // (handles cases where the split mangled a keyword, e.g. "hot" + "flashes")
  for (const [sym, keywords] of Object.entries(SYMPTOM_KEYWORDS)) {
    if (matched.has(sym)) continue;

    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx === -1) continue;

      matched.add(sym);

      const wStart = Math.max(0, idx - 50);
      const wEnd = Math.min(lower.length, idx + kw.length + 50);
      const severity = scoreSeverity(lower.slice(wStart, wEnd));

      const excerptStart = Math.max(0, idx - 25);
      const excerptEnd = Math.min(text.length, idx + kw.length + 25);
      const excerpt = text.slice(excerptStart, excerptEnd).trim();

      found.push({ symptom: sym, severity, excerpt });
      break;
    }
  }

  return found;
}

// ── Iris voice state machine ────────────────────────────────────
const API_BASE = (location.port === '8766')
  ? location.origin
  : location.protocol + '//' + location.hostname + ':8766';

const els = {
  idle:          document.getElementById('irisIdle'),
  recording:     document.getElementById('irisRecording'),
  transcribing:  document.getElementById('irisTranscribing'),
  review:        document.getElementById('irisReview'),
  saved:         document.getElementById('irisSaved'),
  savedSevere:   document.getElementById('irisSavedSevere'),
  recBtn:        document.getElementById('irisRecBtn'),
  stopBtn:       document.getElementById('irisStopBtn'),
  timer:         document.getElementById('irisTimer'),
  transcript:    document.getElementById('irisTranscript'),
  parsedList:    document.getElementById('irisParsedList'),
  noSymptoms:    document.getElementById('irisNoSymptoms'),
  rerecordBtn:   document.getElementById('irisRerecordBtn'),
  confirmBtn:    document.getElementById('irisConfirmBtn'),
  doctorChatBtn: document.getElementById('irisDoctorChatBtn'),
  savedDismissBtn: document.getElementById('irisSavedDismissBtn'),
  stepBadge:     document.getElementById('irisStepBadge'),
  promptText:    document.getElementById('irisPromptText'),
  hintText:      document.getElementById('irisHintText'),
  recordingLead: document.getElementById('irisRecordingLead'),
};

/** True when logged severities suggest follow-up with care team (4–5 scale). */
function isSeverityConcerning(entries) {
  if (!entries || entries.length === 0) return false;
  return entries.some(function (e) {
    const n = Number(e.severity);
    return !Number.isNaN(n) && n >= 4;
  });
}

let irisSavedTimer = null;

function clearIrisSavedTimer() {
  if (irisSavedTimer) {
    clearTimeout(irisSavedTimer);
    irisSavedTimer = null;
  }
}

function dismissIrisSaved() {
  clearIrisSavedTimer();
  resetIrisSession();
  if (els.savedSevere) els.savedSevere.hidden = true;
  showState('idle');
}

function openDoctorFromSymptoms() {
  if (window.PharmaApp && typeof window.PharmaApp.openSub === 'function') {
    window.PharmaApp.openSub('doctor');
  }
  dismissIrisSaved();
}

/** Scripted guided check-in (same order as prompts). */
const GUIDED_STEPS = [
  { id: 'sleep', prompt: 'How did you sleep last night?' },
  { id: 'flashes', prompt: 'Have you had any hot flashes or night sweats today?' },
  { id: 'else', prompt: 'Anything else on your mind — mood, energy, aches, or stress?' },
];

let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let recordStart = 0;
let irisAudioCtx = null;
let irisWaveAnalyser = null;
let irisWaveSource = null;
let irisWaveRaf = null;
let irisWaveSmoothed = null;
let irisWaveResizeHandler = null;
let parsedResults = [];
let guidedStepIndex = 0;
let guidedTurns = [];
/** Plain-text Q/A log for POST /api/symptoms guided_transcript */
let irisGuidedSessionText = null;

function getIrisFlow() {
  try {
    const f = sessionStorage.getItem('irisFlow');
    return f === 'guided' ? 'guided' : 'single';
  } catch (e) {
    return 'single';
  }
}

function formatGuidedTranscriptForSave(turns) {
  return turns.map(function (t) {
    return 'Q: ' + t.prompt + '\nA: ' + t.text;
  }).join('\n\n');
}

function applyIdlePrompt() {
  const flow = getIrisFlow();
  if (flow === 'guided') {
    if (els.stepBadge) {
      els.stepBadge.hidden = false;
      els.stepBadge.textContent = 'Question ' + (guidedStepIndex + 1) + ' of ' + GUIDED_STEPS.length;
    }
    if (els.promptText) els.promptText.textContent = GUIDED_STEPS[guidedStepIndex].prompt;
    if (els.hintText) els.hintText.textContent = 'Tap the button and answer in a few sentences.';
  } else {
    if (els.stepBadge) els.stepBadge.hidden = true;
    if (els.promptText) els.promptText.textContent = 'Tap to describe how you feel';
    if (els.hintText) els.hintText.textContent = 'Iris will listen and log your symptoms.';
  }
}

function resetIrisSession() {
  guidedStepIndex = 0;
  guidedTurns = [];
  irisGuidedSessionText = null;
  applyIdlePrompt();
}

function onIrisScreenActivated() {
  clearIrisSavedTimer();
  stopIrisWaveform();
  if (els.savedSevere) els.savedSevere.hidden = true;
  resetIrisSession();
  showState('idle');
}

function showState(name) {
  ['idle', 'recording', 'transcribing', 'review', 'saved'].forEach(s => {
    const el = els[s];
    if (el) el.hidden = (s !== name);
  });
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

const IRIS_WAVE_BARS = 48;

function stopIrisWaveform() {
  if (irisWaveResizeHandler) {
    window.removeEventListener('resize', irisWaveResizeHandler);
    irisWaveResizeHandler = null;
  }
  if (irisWaveRaf) {
    cancelAnimationFrame(irisWaveRaf);
    irisWaveRaf = null;
  }
  if (irisWaveSource) {
    try {
      irisWaveSource.disconnect();
    } catch (e) { /* ignore */ }
    irisWaveSource = null;
  }
  irisWaveAnalyser = null;
  if (irisAudioCtx) {
    irisAudioCtx.close().catch(function () {});
    irisAudioCtx = null;
  }
}

function resizeIrisWaveCanvas(canvas) {
  const wrap = canvas && canvas.parentElement;
  if (!wrap || !canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(wrap.clientWidth * dpr);
  const h = Math.floor(72 * dpr);
  if (w < 1) return;
  canvas.width = w;
  canvas.height = h;
}

function startIrisWaveform(stream) {
  const canvas = document.getElementById('irisWaveCanvas');
  if (!canvas) return;

  stopIrisWaveform();

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  irisAudioCtx = new AC();
  irisWaveAnalyser = irisAudioCtx.createAnalyser();
  irisWaveAnalyser.fftSize = 512;
  irisWaveAnalyser.smoothingTimeConstant = 0.72;
  irisWaveSource = irisAudioCtx.createMediaStreamSource(stream);
  irisWaveSource.connect(irisWaveAnalyser);

  if (irisAudioCtx.state === 'suspended') {
    irisAudioCtx.resume().catch(function () {});
  }

  resizeIrisWaveCanvas(canvas);
  irisWaveSmoothed = new Float32Array(IRIS_WAVE_BARS);

  irisWaveResizeHandler = function () {
    resizeIrisWaveCanvas(canvas);
  };
  window.addEventListener('resize', irisWaveResizeHandler);

  const ctx = canvas.getContext('2d');
  const dataArray = new Uint8Array(irisWaveAnalyser.frequencyBinCount);

  function draw() {
    if (!irisWaveAnalyser || !canvas) return;
    irisWaveAnalyser.getByteFrequencyData(dataArray);
    const w = canvas.width;
    const h = canvas.height;
    const barCount = IRIS_WAVE_BARS;
    const binCount = dataArray.length;

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      const start = Math.floor((i / barCount) * binCount);
      const end = Math.floor(((i + 1) / barCount) * binCount);
      const n = Math.max(1, end - start);
      for (let j = start; j < end; j++) sum += dataArray[j];
      const raw = sum / n / 255;
      irisWaveSmoothed[i] = irisWaveSmoothed[i] * 0.55 + raw * 0.45;
    }

    ctx.clearRect(0, 0, w, h);
    const gap = w * 0.008;
    const totalGap = gap * (barCount - 1);
    const barW = (w - totalGap) / barCount;
    const mid = h / 2;
    const maxHalf = h * 0.42;

    for (let i = 0; i < barCount; i++) {
      const v = irisWaveSmoothed[i];
      const half = Math.max(2 / h, v) * maxHalf;
      const x = i * (barW + gap);
      const r = Math.min(barW / 2, 3 * (window.devicePixelRatio || 1));
      const top = mid - half;
      const bh = half * 2;
      const grd = ctx.createLinearGradient(x, top, x, top + bh);
      grd.addColorStop(0, 'rgba(223, 146, 33, 0.95)');
      grd.addColorStop(0.5, 'rgba(181, 119, 14, 0.98)');
      grd.addColorStop(1, 'rgba(230, 194, 172, 0.9)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, top, barW, bh, r);
      } else {
        ctx.rect(x, top, barW, bh);
      }
      ctx.fill();
    }

    if (irisWaveAnalyser) {
      irisWaveRaf = requestAnimationFrame(draw);
    }
  }

  draw();
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMime() });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      stopIrisWaveform();
      stream.getTracks().forEach(t => t.stop());
      onRecordingDone();
    };
    mediaRecorder.start();
    recordStart = Date.now();
    timerInterval = setInterval(() => {
      if (els.timer) els.timer.textContent = formatTime(Date.now() - recordStart);
    }, 250);
    if (els.recordingLead) {
      els.recordingLead.textContent = getIrisFlow() === 'guided' ? 'Listening for your answer…' : 'Listening…';
    }
    showState('recording');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        startIrisWaveform(stream);
      });
    });
  } catch (err) {
    console.error('[iris] mic error', err);
    alert('Could not access microphone. Please allow microphone access and try again.');
  }
}

function getSupportedMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function stopRecording() {
  clearInterval(timerInterval);
  stopIrisWaveform();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

async function onRecordingDone() {
  showState('transcribing');

  const blob = new Blob(audioChunks, { type: audioChunks[0]?.type || 'audio/webm' });
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');

  try {
    const res = await fetch(API_BASE + '/api/transcribe', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    const text = (data.text || '').trim();
    if (!text) {
      alert('Could not detect any speech. Please try again.');
      showState('idle');
      return;
    }

    if (getIrisFlow() === 'guided') {
      const step = GUIDED_STEPS[guidedStepIndex];
      guidedTurns.push({ prompt: step.prompt, text: text });
      guidedStepIndex++;
      if (guidedStepIndex < GUIDED_STEPS.length) {
        applyIdlePrompt();
        showState('idle');
        return;
      }
      const combined = guidedTurns.map(function (t) { return t.text; }).join(' ');
      irisGuidedSessionText = formatGuidedTranscriptForSave(guidedTurns);
      showReview(combined, { guidedTurns: guidedTurns.slice() });
      return;
    }

    irisGuidedSessionText = null;
    showReview(text);
  } catch (err) {
    console.error('[iris] transcribe error', err);
    alert('Transcription failed. Is the server running on port 8766?');
    showState('idle');
  }
}

function showReview(text, opts) {
  const guidedList = opts && opts.guidedTurns;
  if (guidedList && guidedList.length && els.transcript) {
    els.transcript.innerHTML = guidedList.map(function (t) {
      return (
        '<div class="iris-guided-turn">' +
          '<p class="iris-guided-turn__q">' + escHtml(t.prompt) + '</p>' +
          '<blockquote class="iris-guided-turn__a">&ldquo;' + escHtml(t.text) + '&rdquo;</blockquote>' +
        '</div>'
      );
    }).join('');
  } else if (els.transcript) {
    els.transcript.textContent = '"' + text + '"';
  }
  parsedResults = parseSymptoms(text);
  renderParsedCards();
  showState('review');
}

function renderParsedCards() {
  if (!els.parsedList) return;
  els.parsedList.innerHTML = '';

  if (parsedResults.length === 0) {
    if (els.noSymptoms) els.noSymptoms.hidden = false;
    if (els.confirmBtn) els.confirmBtn.hidden = true;
    return;
  }
  if (els.noSymptoms) els.noSymptoms.hidden = true;
  if (els.confirmBtn) els.confirmBtn.hidden = false;

  parsedResults.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'iris-parsed-card';

    const label = SYMPTOM_LABELS[item.symptom] || item.symptom;

    card.innerHTML =
      '<div class="iris-parsed-card__head">' +
        '<span class="iris-parsed-card__name">' + escHtml(label) + '</span>' +
      '</div>' +
      '<div class="iris-parsed-card__sev" data-idx="' + idx + '">' +
        [1,2,3,4,5].map(n =>
          '<button type="button" class="sym-rate__btn' + (n === item.severity ? ' is-selected' : '') +
          '" data-sev="' + n + '">' + n +
          (n === 1 ? '<span>Mild</span>' : n === 3 ? '<span>Mod</span>' : n === 5 ? '<span>Severe</span>' : '') +
          '</button>'
        ).join('') +
      '</div>';

    card.querySelectorAll('.sym-rate__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sev = parseInt(btn.dataset.sev);
        parsedResults[idx].severity = sev;
        card.querySelectorAll('.sym-rate__btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
      });
    });

    els.parsedList.appendChild(card);
  });
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function confirmSymptoms() {
  if (parsedResults.length === 0) return;
  const now = new Date().toISOString();
  const entries = parsedResults.map(r => ({
    symptom: r.symptom,
    severity: r.severity,
    note: r.excerpt,
    timestamp: now,
  }));

  const payload = { entries: entries };
  if (irisGuidedSessionText && irisGuidedSessionText.trim()) {
    payload.guided_transcript = irisGuidedSessionText.trim();
  }

  try {
    await fetch(API_BASE + '/api/symptoms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[iris] save error', err);
  }

  const severe = isSeverityConcerning(entries);
  clearIrisSavedTimer();
  if (els.savedSevere) els.savedSevere.hidden = !severe;
  showState('saved');
  if (severe) {
    return;
  }
  irisSavedTimer = setTimeout(function () {
    irisSavedTimer = null;
    resetIrisSession();
    showState('idle');
  }, 2200);
}

// ── Wire up buttons ─────────────────────────────────────────────
if (els.recBtn) els.recBtn.addEventListener('click', startRecording);
if (els.stopBtn) els.stopBtn.addEventListener('click', stopRecording);
if (els.rerecordBtn) els.rerecordBtn.addEventListener('click', function () {
  resetIrisSession();
  showState('idle');
});
if (els.confirmBtn) els.confirmBtn.addEventListener('click', confirmSymptoms);
if (els.doctorChatBtn) els.doctorChatBtn.addEventListener('click', openDoctorFromSymptoms);
if (els.savedDismissBtn) els.savedDismissBtn.addEventListener('click', dismissIrisSaved);

const irisScreen = document.getElementById('screen-sub-symptoms-iris');
if (irisScreen) {
  const irisObs = new MutationObserver(function () {
    if (irisScreen.classList.contains('is-active')) onIrisScreenActivated();
  });
  irisObs.observe(irisScreen, { attributes: true, attributeFilter: ['class'] });
  if (irisScreen.classList.contains('is-active')) onIrisScreenActivated();
}

// ── Manual rating (unchanged logic) ─────────────────────────────
const manualList = document.getElementById('symManualList');
const ratePanel = document.getElementById('symManualRate');
const rateTitle = document.getElementById('symRateTitle');
const rateBack = document.getElementById('symRateBack');
const rateConfirm = document.getElementById('symRateConfirm');
const symRateDoctorCta = document.getElementById('symRateDoctorCta');
const symManualDoctorBtn = document.getElementById('symManualDoctorBtn');

if (manualList) {
  manualList.querySelectorAll('[data-symptom]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sym = btn.getAttribute('data-symptom');
      showRating(sym);
    });
  });
}

function showRating(sym) {
  if (!ratePanel || !rateTitle) return;
  rateTitle.textContent = SYMPTOM_LABELS[sym] || sym;
  ratePanel.removeAttribute('hidden');
  if (manualList) manualList.hidden = true;
  if (rateConfirm) rateConfirm.hidden = true;
  if (symRateDoctorCta) symRateDoctorCta.hidden = true;
  ratePanel.querySelectorAll('.sym-rate__btn').forEach(b => b.classList.remove('is-selected'));
}

function hideRating() {
  if (ratePanel) ratePanel.hidden = true;
  if (manualList) manualList.hidden = false;
  if (symRateDoctorCta) symRateDoctorCta.hidden = true;
}

if (rateBack) rateBack.addEventListener('click', hideRating);

if (ratePanel) {
  ratePanel.querySelectorAll('.sym-rate__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ratePanel.querySelectorAll('.sym-rate__btn').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');

      const sym = rateTitle ? rateTitle.textContent : '';
      const sev = parseInt(btn.dataset.sev);
      const symKey = Object.entries(SYMPTOM_LABELS).find(([, v]) => v === sym)?.[0] || sym;

      fetch(API_BASE + '/api/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [{ symptom: symKey, severity: sev, note: 'manual entry', timestamp: new Date().toISOString() }]
        }),
      }).catch(e => console.warn('[manual] save error', e));

      if (rateConfirm) {
        rateConfirm.removeAttribute('hidden');
        if (symRateDoctorCta) symRateDoctorCta.hidden = !(sev >= 4);
        rateConfirm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });
}

if (symManualDoctorBtn) {
  symManualDoctorBtn.addEventListener('click', function () {
    if (window.PharmaApp && typeof window.PharmaApp.openSub === 'function') {
      window.PharmaApp.openSub('doctor');
    }
  });
}

// ── Doctor chat mock replies ────────────────────────────────────
const DOC_REPLIES = [
  'Thanks for letting me know, Sarah. I want to make sure we stay on top of this. Can you keep logging your symptoms daily so I can see the full picture?',
  'That\u2019s helpful context. Based on what you\u2019re describing, let\u2019s have you do a urine test to check your hormone levels. I\u2019ll send the requisition over.',
  'I hear you \u2014 that sounds really frustrating. Let\u2019s review your latest symptom trends together at your next visit and see if a dosage adjustment is warranted.',
  'Noted. In the meantime, try to keep a consistent sleep schedule and stay hydrated. Sometimes small lifestyle changes can take the edge off while we fine-tune things.',
  'I\u2019ve reviewed your recent logs. Your progesterone looks stable, but the hot flash frequency is up. Let\u2019s discuss options \u2014 I\u2019ll block some time this week.',
];

let docReplyIdx = 0;
const docForm = document.getElementById('docChatForm');
const docInput = document.getElementById('docChatInput');
const docMessages = document.getElementById('docMessages');

function formatNow() {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let h = d.getHours(), ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + h + ':' + min + ' ' + ampm;
}

function addDocMsg(text, who) {
  if (!docMessages) return;
  const wrap = document.createElement('div');
  wrap.className = 'doc-msg doc-msg--' + who;
  if (who === 'doc') {
    wrap.innerHTML = '<div class="doc-msg__avatar">DC</div>';
  }
  const bubble = document.createElement('div');
  bubble.className = 'doc-msg__bubble';
  if (who === 'doc') {
    const name = document.createElement('p');
    name.className = 'doc-msg__name';
    name.textContent = 'Dr. Chen';
    bubble.appendChild(name);
  }
  const p = document.createElement('p');
  p.textContent = text;
  bubble.appendChild(p);
  const time = document.createElement('span');
  time.className = 'doc-msg__time';
  time.textContent = formatNow();
  bubble.appendChild(time);
  wrap.appendChild(bubble);
  docMessages.appendChild(wrap);
  wrap.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

if (docForm) {
  docForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const text = (docInput.value || '').trim();
    if (!text) return;
    addDocMsg(text, 'user');
    docInput.value = '';
    setTimeout(function () {
      const reply = DOC_REPLIES[docReplyIdx % DOC_REPLIES.length];
      docReplyIdx++;
      addDocMsg(reply, 'doc');
    }, 800);
  });
}

})();
