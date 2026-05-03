/**
 * HMS — device hub: print (patch) + lab (blood estradiol), timer, carousel, cooldown.
 */
(function () {
  const LS_PRINT = 'pharmaink_hms_last_print_ms';
  const LS_PRINTER = 'pharmaink_hms_printer_connected';
  const LS_PATTERN = 'pharmaink_hms_pattern';
  const LS_ESTRADIOL = 'pharmaink_hms_estradiol_readings';

  const COOLDOWN_MS = 16 * 60 * 60 * 1000;
  const MAX_READINGS = 24;

  /** Archimedean spiral path (viewBox 24×24) — black stroke, matches carousel size via CSS */
  const SPIRAL_ICON_SVG =
    '<svg class="hms-carousel__icon-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">' +
    '<path fill="none" stroke="#1A1A18" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="' +
    'M12.00,12.00L12.15,12.04L12.26,12.16L12.32,12.34L12.29,12.54L12.16,12.75L11.94,12.92L11.65,13.02L11.30,13.01L10.94,12.89L10.60,12.63L10.33,12.25L10.17,11.78L10.15,11.23L10.30,10.67L10.63,10.14L11.13,9.70L11.76,9.40L12.50,9.28L13.28,9.37L14.04,9.70L14.71,10.25L15.23,10.99L15.54,11.89L15.59,12.88L15.35,13.89L14.83,14.83L14.04,15.62L13.03,16.18L11.87,16.46L10.63,16.41L9.41,16.01L8.32,15.26L7.44,14.22L6.85,12.94L6.64,11.51L6.82,10.04L7.42,8.63L8.39,7.40L9.70,6.46L11.26,5.89L12.95,5.76L14.65,6.11L16.24,6.92L17.57,8.15L18.54,9.74L19.06,11.57L19.07,13.52L18.54,15.43L17.49,17.17L15.98,18.58L14.11,19.56L12.00,20.00' +
    '"/></svg>';

  /** Preset patterns only; custom art uses upload flow. */
  const CATALOG = [
    { id: 'mandala', label: 'Mandala', icon: '\u2299' },
    { id: 'cross',   label: 'Cross',   icon: '\u271A' },
    { id: 'spiral',  label: 'Spiral',  iconHtml: SPIRAL_ICON_SVG },
  ];

  const CATALOG_IDS = CATALOG.map(function (c) { return c.id; });

  const hmsEditor = document.getElementById('hmsEditor');
  const printBtn = document.getElementById('hmsPrintBtn');
  const cooldownText = document.getElementById('hmsCooldownText');
  const timerValue = document.getElementById('hmsTimerValue');
  const timerSub = document.getElementById('hmsTimerSub');
  const carousel = document.getElementById('hmsCarousel');
  const panelPrint = document.getElementById('hmsPanelPrint');
  const panelLab = document.getElementById('hmsPanelLab');
  const footerPrint = document.getElementById('hmsFooterPrint');
  const footerLab = document.getElementById('hmsFooterLab');
  const tabPrint = document.getElementById('hmsModeTabPrint');
  const tabLab = document.getElementById('hmsModeTabLab');
  const hmsLabValue = document.getElementById('hmsLabValue');
  const hmsLabMeta = document.getElementById('hmsLabMeta');
  const hmsLabFooterStatus = document.getElementById('hmsLabFooterStatus');
  const hmsLabMeasureBtn = document.getElementById('hmsLabMeasureBtn');
  const hmsLabSparkCanvas = document.getElementById('hmsLabSparkCanvas');
  const hmsLabSparkEmpty = document.getElementById('hmsLabSparkEmpty');
  const youEstradiolValue = document.getElementById('youEstradiolValue');
  const youEstradiolDate = document.getElementById('youEstradiolDate');
  const hmsLabInsightCard = document.getElementById('hmsLabInsightCard');
  const hmsLabInsightText = document.getElementById('hmsLabInsightText');
  const hmsLabInsightBadge = document.getElementById('hmsLabInsightBadge');
  const hmsLabInsightDoctorBtn = document.getElementById('hmsLabInsightDoctorBtn');

  /** Soft band for prototype insight only — not medical advice. */
  var INSIGHT_OK_LOW = 15;
  var INSIGHT_OK_HIGH = 45;

  function getReadings() {
    try {
      var raw = localStorage.getItem(LS_ESTRADIOL);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (r) {
        return r && typeof r.ts === 'number' && typeof r.pgMl === 'number';
      });
    } catch (e) {
      return [];
    }
  }

  function saveReadings(arr) {
    try {
      localStorage.setItem(LS_ESTRADIOL, JSON.stringify(arr.slice(-MAX_READINGS)));
    } catch (e) { /* ignore */ }
  }

  function formatReadingDate(ts) {
    var d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    var now = new Date();
    var sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    var t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return 'Today, ' + t;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + t;
  }

  function setInsightBadge(kind, label) {
    if (!hmsLabInsightBadge) return;
    hmsLabInsightBadge.textContent = label;
    hmsLabInsightBadge.classList.remove(
      'hms-lab-insights__badge--neutral',
      'hms-lab-insights__badge--positive',
      'hms-lab-insights__badge--alert'
    );
    hmsLabInsightBadge.classList.add('hms-lab-insights__badge--' + kind);
  }

  function updateLabInsight(readings) {
    if (!hmsLabInsightText || !hmsLabInsightCard) return;
    var last = readings.length ? readings[readings.length - 1] : null;
    hmsLabInsightCard.classList.remove(
      'hms-lab-insights--neutral',
      'hms-lab-insights--positive',
      'hms-lab-insights--alert'
    );

    if (!last) {
      hmsLabInsightCard.classList.add('hms-lab-insights--neutral');
      setInsightBadge('neutral', 'Waiting for data');
      hmsLabInsightText.textContent =
        'Run a blood test to see how your estradiol lines up with your transdermal pattern. We will note here whether things look on track or worth discussing with your care team.';
      if (hmsLabInsightDoctorBtn) hmsLabInsightDoctorBtn.hidden = true;
      return;
    }

    var v = last.pgMl;
    if (v >= INSIGHT_OK_LOW && v <= INSIGHT_OK_HIGH) {
      hmsLabInsightCard.classList.add('hms-lab-insights--positive');
      setInsightBadge('positive', 'On track');
      hmsLabInsightText.textContent =
        'Your latest estradiol fits what we often see when the transdermal tattoos are working as intended. Keep following the plan your clinician set for you.';
      if (hmsLabInsightDoctorBtn) hmsLabInsightDoctorBtn.hidden = true;
    } else {
      hmsLabInsightCard.classList.add('hms-lab-insights--alert');
      setInsightBadge('alert', 'Needs attention');
      hmsLabInsightText.textContent =
        'This result is outside the usual band for your current pattern. Please contact your care team soon — they may want to adjust dose or timing.';
      if (hmsLabInsightDoctorBtn) hmsLabInsightDoctorBtn.hidden = false;
    }
  }

  function updateLabDisplays() {
    var readings = getReadings();
    var last = readings.length ? readings[readings.length - 1] : null;

    if (hmsLabValue) hmsLabValue.textContent = last ? String(Math.round(last.pgMl)) : '—';
    if (hmsLabMeta) {
      hmsLabMeta.textContent = last
        ? 'Last measurement: ' + formatReadingDate(last.ts) + '.'
        : 'No readings yet. Run a test when your care team recommends it.';
    }
    if (youEstradiolValue) youEstradiolValue.textContent = last ? Math.round(last.pgMl) + ' pg/mL' : '—';
    if (youEstradiolDate) {
      youEstradiolDate.textContent = last ? formatReadingDate(last.ts) : 'No readings yet';
    }

    updateLabInsight(readings);
    renderSparkline(readings);
  }

  function renderSparkline(readings) {
    if (!hmsLabSparkCanvas) return;
    var ctx = hmsLabSparkCanvas.getContext('2d');
    var rect = hmsLabSparkCanvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = rect.width;
    var h = rect.height;
    if (w < 2 || h < 2) return;
    hmsLabSparkCanvas.width = w * dpr;
    hmsLabSparkCanvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    if (!readings.length) {
      if (hmsLabSparkEmpty) hmsLabSparkEmpty.hidden = false;
      return;
    }
    if (hmsLabSparkEmpty) hmsLabSparkEmpty.hidden = true;

    var vals = readings.map(function (r) { return r.pgMl; });
    var minV = Math.min.apply(null, vals);
    var maxV = Math.max.apply(null, vals);
    var pad = 8;
    var span = maxV - minV || 1;
    var n = vals.length;
    ctx.strokeStyle = 'rgba(223, 146, 33, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var x = pad + (i / Math.max(1, n - 1)) * (w - pad * 2);
      var y = pad + (1 - (vals[i] - minV) / span) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    vals.forEach(function (v, i) {
      var x = pad + (i / Math.max(1, n - 1)) * (w - pad * 2);
      var y = pad + (1 - (v - minV) / span) * (h - pad * 2);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#DF9221';
      ctx.fill();
    });
  }

  var measureBusy = false;

  function setLabMeasureBusy(busy) {
    measureBusy = busy;
    if (!hmsLabMeasureBtn) return;
    hmsLabMeasureBtn.disabled = busy;
    hmsLabMeasureBtn.classList.toggle('is-disabled', busy);
    if (hmsLabFooterStatus) {
      hmsLabFooterStatus.textContent = busy ? 'Measuring… keep the cartridge in place.' : 'Ready when you are';
    }
  }

  function runDemoMeasure() {
    if (measureBusy) return;
    setLabMeasureBusy(true);
    window.setTimeout(function () {
      var pg = 18 + Math.random() * 22;
      var readings = getReadings();
      readings.push({ ts: Date.now(), pgMl: pg });
      saveReadings(readings);
      updateLabDisplays();
      setLabMeasureBusy(false);
    }, 2200);
  }

  function setMode(mode, opts) {
    var isLab = mode === 'lab';
    if (panelPrint) panelPrint.hidden = isLab;
    if (panelLab) panelLab.hidden = !isLab;
    if (footerPrint) footerPrint.hidden = isLab;
    if (footerLab) footerLab.hidden = !isLab;
    if (tabPrint) {
      tabPrint.classList.toggle('is-active', !isLab);
      tabPrint.setAttribute('aria-selected', !isLab ? 'true' : 'false');
    }
    if (tabLab) {
      tabLab.classList.toggle('is-active', isLab);
      tabLab.setAttribute('aria-selected', isLab ? 'true' : 'false');
    }
    if (isLab) {
      updateLabDisplays();
      window.setTimeout(function () {
        renderSparkline(getReadings());
      }, 50);
    } else {
      window.dispatchEvent(new Event('resize'));
    }
  }

  function syncModeFromApp(detail) {
    if (!detail || detail.screen !== 'hms') return;
    setMode(detail.hmsMode === 'lab' ? 'lab' : 'print', {});
  }

  document.querySelectorAll('.hms-mode-tab[data-hms-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var m = btn.getAttribute('data-hms-mode');
      if (window.PharmaApp && typeof window.PharmaApp.go === 'function') {
        window.PharmaApp.go('hms', { hmsMode: m === 'lab' ? 'lab' : 'print' });
      }
    });
  });

  window.addEventListener('pharmaink:main-screen', function (e) {
    syncModeFromApp(e.detail);
  });

  if (hmsLabMeasureBtn) {
    hmsLabMeasureBtn.addEventListener('click', runDemoMeasure);
  }

  window.PharmaHMS = {
    setMode: setMode,
    getReadings: getReadings,
  };

  function getPrintTime() {
    const v = parseInt(localStorage.getItem(LS_PRINT) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  }

  function getSelectedPattern() {
    var raw = localStorage.getItem(LS_PATTERN) || 'mandala';
    if (CATALOG_IDS.indexOf(raw) === -1) {
      try {
        localStorage.setItem(LS_PATTERN, 'mandala');
      } catch (e) { /* ignore */ }
      return 'mandala';
    }
    return raw;
  }

  function setSelectedPattern(id) {
    if (CATALOG_IDS.indexOf(id) === -1) return;
    localStorage.setItem(LS_PATTERN, id);
    if (window.PharmaPattern && typeof window.PharmaPattern.setPromptAndApply === 'function') {
      window.PharmaPattern.setPromptAndApply(id);
    }
    renderCarousel();
  }

  // ── Timer ─────────────────────────────────────────────────────
  function formatElapsed(ms) {
    if (ms <= 0) return { value: '--:--', sub: 'No prints yet' };
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return {
      value: h + 'h ' + String(m).padStart(2, '0') + 'm',
      sub: h >= 16 ? 'Ready for next print' : 'Next print in ' + formatRemaining(COOLDOWN_MS - ms),
    };
  }

  function formatRemaining(ms) {
    if (ms <= 0) return '0m';
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  function updateTimer() {
    const last = getPrintTime();
    const elapsed = last ? Date.now() - last : 0;
    const t = formatElapsed(elapsed);
    if (timerValue) timerValue.textContent = t.value;
    if (timerSub) timerSub.textContent = t.sub;
  }

  // ── Print bar ─────────────────────────────────────────────────
  function msUntilCanPrint() {
    const last = getPrintTime();
    if (!last) return 0;
    return Math.max(0, COOLDOWN_MS - (Date.now() - last));
  }

  function updatePrintBar() {
    const wait = msUntilCanPrint();
    const inCooldown = wait > 0;
    const last = getPrintTime();

    let msg = '';
    if (!last) {
      msg = 'No prints yet';
    } else if (inCooldown) {
      msg = 'Next print available in ' + formatRemaining(wait);
    } else {
      msg = 'Ready to print';
    }

    if (cooldownText) cooldownText.textContent = msg;

    const allow = !inCooldown;
    if (printBtn) {
      printBtn.disabled = !allow;
      printBtn.classList.toggle('is-disabled', !allow);
    }
  }

  // ── Carousel ──────────────────────────────────────────────────
  function renderCarousel() {
    if (!carousel) return;
    const selected = getSelectedPattern();
    carousel.innerHTML = '';

    CATALOG.forEach(function (item) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'hms-carousel__card' + (item.id === selected ? ' is-selected' : '');

      var iconInner = item.iconHtml != null ? item.iconHtml : item.icon;
      card.innerHTML =
        '<span class="hms-carousel__icon">' + iconInner + '</span>' +
        '<span class="hms-carousel__label">' + item.label + '</span>';

      card.addEventListener('click', function () {
        setSelectedPattern(item.id);
      });

      carousel.appendChild(card);
    });
  }

  // ── Upload button / zone toggle ────────────────────────────────
  var uploadZoneWrap = document.getElementById('hmsUploadZone');
  var uploadBtn = document.getElementById('hmsUploadBtn');
  var imgZone = document.getElementById('imgUploadZone');
  var imgInput = document.getElementById('imgFileInput');
  var imgEmpty = document.getElementById('imgUploadEmpty');
  var imgPreviewWrap = document.getElementById('imgUploadPreview');
  var imgPreviewImg = document.getElementById('imgPreviewImg');
  var imgClearBtn = document.getElementById('imgClearBtn');
  var imgApplyBtn = document.getElementById('imgApplyBtn');
  var imgCancelBtn = document.getElementById('imgCancelBtn');

  function openUploadZone() {
    if (uploadZoneWrap) {
      uploadZoneWrap.removeAttribute('hidden');
      uploadZoneWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function closeUploadZone() {
    clearImageUpload();
    if (uploadZoneWrap) uploadZoneWrap.hidden = true;
  }

  if (uploadBtn) uploadBtn.addEventListener('click', openUploadZone);
  if (imgCancelBtn) imgCancelBtn.addEventListener('click', closeUploadZone);

  if (imgZone && imgInput) {
    imgZone.addEventListener('click', function (e) {
      if (e.target === imgClearBtn || e.target.closest('.img-upload__clear')) return;
      imgInput.click();
    });

    imgInput.addEventListener('change', function () {
      var file = imgInput.files && imgInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        showImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function showImagePreview(dataUrl) {
    if (!imgPreviewImg || !imgEmpty || !imgPreviewWrap || !imgApplyBtn) return;
    imgPreviewImg.src = dataUrl;
    imgEmpty.hidden = true;
    imgPreviewWrap.hidden = false;
    imgApplyBtn.hidden = false;
  }

  function clearImageUpload() {
    if (imgEmpty) imgEmpty.hidden = false;
    if (imgPreviewWrap) imgPreviewWrap.hidden = true;
    if (imgApplyBtn) imgApplyBtn.hidden = true;
    if (imgInput) imgInput.value = '';
    if (window.PharmaPattern) window.PharmaPattern.clearImage();
  }

  if (imgClearBtn) {
    imgClearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      clearImageUpload();
    });
  }

  if (imgApplyBtn) {
    imgApplyBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!imgPreviewImg || !imgPreviewImg.src) return;
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        if (window.PharmaPattern) window.PharmaPattern.setImageAndRender(img);
        if (uploadZoneWrap) uploadZoneWrap.hidden = true;
      };
      img.src = imgPreviewImg.src;
    });
  }

  // ── Preview tabs (close-up / full strip) ──────────────────────
  var closeupCanvas = document.getElementById('hmsCloseupCanvas');
  var previewCloseup = document.getElementById('hmsPreviewCloseup');
  var previewFull = document.getElementById('hmsPreviewFull');

  document.querySelectorAll('.hms-preview-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var mode = tab.dataset.preview;
      document.querySelectorAll('.hms-preview-tab').forEach(function (t) {
        t.classList.toggle('is-active', t === tab);
      });
      if (previewCloseup) previewCloseup.hidden = (mode !== 'closeup');
      if (previewFull) previewFull.hidden = (mode !== 'full');
    });
  });

  /**
   * Close-up: show the dot pattern shape without over-zooming. We trim excess white around
   * the ink, enforce a minimum crop size so sparse patterns stay readable, then scale with
   * "contain" into the preview. Full strip still shows the full rectangular tattoo.
   */
  function renderCloseup() {
    var src = document.getElementById('patternCanvas');
    if (!closeupCanvas || !src || src.width < 2) return;

    var dpr = window.devicePixelRatio || 1;
    var rect = closeupCanvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    closeupCanvas.width = w * dpr;
    closeupCanvas.height = h * dpr;
    var ctx = closeupCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    var iw = src.width;
    var ih = src.height;
    var sx = 0;
    var sy = 0;
    var sw = iw;
    var sh = ih;

    var inkThreshold = 248;
    var minSide = Math.min(iw, ih);
    var minCropSide = Math.max(48, minSide * 0.5);

    try {
      var sctx = src.getContext('2d');
      var imgData = sctx.getImageData(0, 0, iw, ih);
      var d = imgData.data;
      var minX = iw;
      var minY = ih;
      var maxX = -1;
      var maxY = -1;
      for (var y = 0; y < ih; y++) {
        var row = y * iw * 4;
        for (var x = 0; x < iw; x++) {
          var i = row + x * 4;
          var lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (lum < inkThreshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX >= minX && maxY >= minY) {
        var pad = Math.max(4, Math.round(minSide * 0.025));
        var bx0 = Math.max(0, minX - pad);
        var by0 = Math.max(0, minY - pad);
        var bx1 = Math.min(iw, maxX + pad + 1);
        var by1 = Math.min(ih, maxY + pad + 1);
        sw = bx1 - bx0;
        sh = by1 - by0;
        var cx = bx0 + sw / 2;
        var cy = by0 + sh / 2;

        sw = Math.max(sw, minCropSide);
        sh = Math.max(sh, minCropSide);
        sx = Math.floor(cx - sw / 2);
        sy = Math.floor(cy - sh / 2);
        if (sx < 0) sx = 0;
        if (sy < 0) sy = 0;
        if (sx + sw > iw) sx = iw - sw;
        if (sy + sh > ih) sy = ih - sh;
        if (sx < 0) sx = 0;
        if (sy < 0) sy = 0;
        sw = Math.min(sw, iw - sx);
        sh = Math.min(sh, ih - sy);
      }
    } catch (e) {
      /* full canvas */
    }

    ctx.imageSmoothingEnabled = false;
    var scale = Math.min(w / sw, h / sh);
    var dw = sw * scale;
    var dh = sh * scale;
    var dx = (w - dw) / 2;
    var dy = (h - dh) / 2;
    ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  // Re-render close-up after every pattern render completes
  window.addEventListener('pharmaink:rendered', renderCloseup);
  window.addEventListener('resize', function () {
    setTimeout(renderCloseup, 100);
    if (panelLab && !panelLab.hidden) renderSparkline(getReadings());
  });

  // ── Print ─────────────────────────────────────────────────────
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      if (printBtn.disabled) return;
      localStorage.setItem(LS_PRINT, String(Date.now()));
      updateTimer();
      updatePrintBar();
    });
  }

  // ── Init ──────────────────────────────────────────────────────
  renderCarousel();
  if (window.PharmaPattern && typeof window.PharmaPattern.setPromptAndApply === 'function') {
    window.PharmaPattern.setPromptAndApply(getSelectedPattern());
  }
  updateTimer();
  updatePrintBar();

  setInterval(function () {
    updateTimer();
    updatePrintBar();
  }, 1000);

  window.addEventListener('storage', function (e) {
    if (e.key === LS_PRINT || e.key === LS_PRINTER || e.key === LS_PATTERN) {
      updateTimer();
      updatePrintBar();
      renderCarousel();
    }
    if (e.key === LS_ESTRADIOL) updateLabDisplays();
  });

  // ── Init lab UI + mode from hash (runs after app.js route) ────
  function applyInitialHmsMode() {
    var hmsEl = document.getElementById('screen-hms');
    if (!hmsEl || !hmsEl.classList.contains('is-active')) return;
    var raw = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (raw === 'hms-lab') setMode('lab', {});
    else setMode('print', {});
  }
  applyInitialHmsMode();
  updateLabDisplays();
})();
