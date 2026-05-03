/**
 * PharmaInk — You / HMS navigation, sub-screens from You dashboard.
 */
(function () {
  const SCREENS = ['you', 'hms'];
  const TITLES = {
    you: 'You',
    hms: 'HMS',
  };

  const SUB_IDS = [
    'feeling', 'personal', 'symptoms', 'symptoms-iris', 'symptoms-manual',
    'dosage', 'doctor',
  ];
  const SUB_TITLES = {
    feeling: 'How are you feeling',
    personal: 'Personal data',
    symptoms: 'Track symptoms',
    'symptoms-iris': 'Chat with Iris',
    'symptoms-manual': 'Log symptoms',
    dosage: 'Current print dosage',
    doctor: 'Chat with a doctor',
  };

  const SUB_PARENT = {
    'symptoms-iris': 'symptoms',
    'symptoms-manual': 'symptoms',
  };

  const titleEl = document.getElementById('appTitle');
  const backBtn = document.getElementById('app-back-btn');
  const navEl = document.getElementById('app-nav');

  function screenEl(id) {
    return document.getElementById('screen-' + id);
  }

  function subScreenEl(id) {
    return document.getElementById('screen-sub-' + id);
  }

  function hideAllSubs() {
    SUB_IDS.forEach((id) => {
      const el = subScreenEl(id);
      if (!el) return;
      el.classList.remove('is-active');
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function setChromeMode(mode) {
    const isSub = mode === 'sub';
    if (navEl) navEl.hidden = isSub;
    if (backBtn) backBtn.hidden = !isSub;
  }

  function go(screenId, opts) {
    if (!SCREENS.includes(screenId)) return;
    const pushHash = opts && opts.pushHash !== false;
    hideAllSubs(); /* return from any You sub-screen */
    SCREENS.forEach((id) => {
      const el = screenEl(id);
      if (!el) return;
      const on = id === screenId;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    document.querySelectorAll('.app-nav-item[data-screen]').forEach((btn) => {
      const on = btn.dataset.screen === screenId;
      btn.classList.toggle('is-active', on);
      if (on) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    if (titleEl) titleEl.textContent = TITLES[screenId] || screenId;
    document.title = 'PharmaInk — ' + (TITLES[screenId] || screenId);
    setChromeMode('main');
    if (pushHash) {
      let h = '#' + screenId;
      if (screenId === 'hms') {
        const hm = opts && opts.hmsMode;
        h = hm === 'lab' ? '#hms-lab' : '#hms';
      }
      if (location.hash !== h) history.replaceState(null, '', h);
    }
    const hmsModeDetail =
      screenId === 'hms' ? ((opts && opts.hmsMode) === 'lab' ? 'lab' : 'print') : undefined;
    window.dispatchEvent(
      new CustomEvent('pharmaink:main-screen', { detail: { screen: screenId, hmsMode: hmsModeDetail } })
    );
    window.dispatchEvent(new Event('resize'));
  }

  function openSub(subId, opts) {
    if (!SUB_IDS.includes(subId)) return;
    const pushHash = opts && opts.pushHash !== false;
    hideAllSubs();
    SCREENS.forEach((id) => {
      const el = screenEl(id);
      if (!el) return;
      el.classList.remove('is-active');
      el.setAttribute('aria-hidden', 'true');
    });
    const sub = subScreenEl(subId);
    if (sub) {
      sub.classList.add('is-active');
      sub.setAttribute('aria-hidden', 'false');
    }
    activeSub = subId;
    if (titleEl) titleEl.textContent = SUB_TITLES[subId] || subId;
    document.title = 'PharmaInk — ' + (SUB_TITLES[subId] || subId);
    setChromeMode('sub');
    if (pushHash) {
      const h = '#sub-' + subId;
      if (location.hash !== h) history.replaceState(null, '', h);
    }
    window.dispatchEvent(new Event('resize'));
  }

  let activeSub = null;

  function closeSub() {
    if (activeSub && SUB_PARENT[activeSub]) {
      openSub(SUB_PARENT[activeSub]);
      return;
    }
    activeSub = null;
    go('you', { pushHash: true });
  }

  document.querySelectorAll('.app-nav-item[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.screen));
  });

  document.querySelectorAll('[data-hms-destination]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dest = btn.getAttribute('data-hms-destination');
      go('hms', { hmsMode: dest === 'lab' ? 'lab' : 'print' });
    });
  });

  document.querySelectorAll('[data-open-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-open-sub');
      if (id) openSub(id);
    });
  });

  document.querySelectorAll('[data-sym-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-sym-mode');
      if (mode === 'iris') {
        const flow = btn.getAttribute('data-iris-flow') || 'single';
        try {
          sessionStorage.setItem('irisFlow', flow);
        } catch (e) { /* ignore */ }
        openSub('symptoms-iris');
      } else if (mode === 'manual') openSub('symptoms-manual');
    });
  });

  if (backBtn) {
    backBtn.addEventListener('click', () => closeSub());
  }

  function fromHash() {
    const raw = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (!raw) return { type: 'main', id: 'you' };
    if (raw === 'hms-lab') return { type: 'main', id: 'hms', hmsMode: 'lab' };
    if (raw.startsWith('sub-')) {
      const sub = raw.replace(/^sub-/, '');
      if (SUB_IDS.includes(sub)) return { type: 'sub', id: sub };
    }
    if (SCREENS.includes(raw)) {
      if (raw === 'hms') return { type: 'main', id: 'hms', hmsMode: 'print' };
      return { type: 'main', id: raw };
    }
    return { type: 'main', id: 'you' };
  }

  function applyRoute() {
    const r = fromHash();
    if (r.type === 'sub') {
      openSub(r.id, { pushHash: false });
      return;
    }
    const opts = { pushHash: false };
    if (r.id === 'hms' && r.hmsMode) opts.hmsMode = r.hmsMode;
    go(r.id, opts);
  }

  window.addEventListener('hashchange', () => {
    applyRoute();
  });

  window.PharmaApp = { go, openSub, closeSub };

  applyRoute();
})();
