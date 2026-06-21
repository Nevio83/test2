/**
 * cookie-consent.js — Eigener DSGVO-Cookie-Consent-Banner (kein Drittanbieter).
 *
 * - Zeigt beim ersten Besuch einen Banner mit zwei Optionen:
 *     „Alle akzeptieren"  -> erweitertes Tracking erlaubt (maios_cookie_consent = 'all')
 *     „Nur notwendige"    -> nur anonymes Aufrufe-Tracking (maios_cookie_consent = 'essential')
 * - Speichert die Einwilligung in localStorage inkl. Zeitstempel (12 Monate gueltig).
 * - Stellt window.MaiosConsent bereit, damit view-tracker.js das Consent-Level lesen kann.
 * - Loggt jede Entscheidung an /api/track/consent (fuer die Auswertung im Admin-Dashboard).
 * - Laedt seine eigene CSS-Datei selbst -> in den Seiten genuegt EIN <script>-Include.
 *
 * Bewusst framework-frei und defensiv (alle Fehler werden verschluckt), damit der
 * Shop nie blockiert wird.
 */
(function () {
  'use strict';

  var STORE_KEY = 'maios_cookie_consent';        // 'all' | 'essential'
  var STORE_TS = 'maios_cookie_consent_ts';      // Zeitstempel der Einwilligung
  var VISITOR_KEY = 'maios_visitor';             // markiert wiederkehrende Besucher (nur bei 'all')
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;    // 12 Monate -> danach erneut fragen

  // Admin-Bereich braucht keinen Banner
  if (location.pathname.indexOf('a29715347575') !== -1) return;

  // ── Persistenz-Helfer ──────────────────────────────────────────
  function readConsent() {
    try {
      var level = localStorage.getItem(STORE_KEY);
      if (level !== 'all' && level !== 'essential') return null;
      var ts = parseInt(localStorage.getItem(STORE_TS) || '0', 10);
      if (!ts || (Date.now() - ts) > MAX_AGE_MS) return null; // abgelaufen -> neu fragen
      return level;
    } catch (e) {
      return null;
    }
  }

  function writeConsent(level) {
    try {
      localStorage.setItem(STORE_KEY, level);
      localStorage.setItem(STORE_TS, String(Date.now()));
      if (level === 'all' && !localStorage.getItem(VISITOR_KEY)) {
        // Erstbesuch mit voller Zustimmung -> Besucher-Marke setzen
        localStorage.setItem(VISITOR_KEY, String(Date.now()));
      }
    } catch (e) { /* localStorage evtl. blockiert -> ignorieren */ }
  }

  // ── Oeffentliche Consent-API (von view-tracker.js genutzt) ──────
  var listeners = [];
  window.MaiosConsent = {
    level: function () { return readConsent(); },
    hasDecision: function () { return readConsent() !== null; },
    allowsTracking: function () { return readConsent() === 'all'; },
    isReturning: function () {
      try { return !!localStorage.getItem(VISITOR_KEY); } catch (e) { return false; }
    },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    reopen: function () { showBanner(); }
  };

  function emitChange(level) {
    try {
      var ev = new CustomEvent('maios:consent', { detail: { level: level } });
      window.dispatchEvent(ev);
    } catch (e) { /* aelterer Browser */ }
    listeners.forEach(function (fn) { try { fn(level); } catch (e) { /* Listener-Fehler ignorieren */ } });
  }

  // ── CSS selbst laden (Pfad aus dem eigenen <script>-src ableiten) ──
  function injectCss() {
    try {
      var me = document.currentScript ||
        document.querySelector('script[src*="cookie-consent.js"]');
      var base = '';
      if (me && me.getAttribute('src')) {
        base = me.getAttribute('src').replace(/cookie-consent\.js.*$/, '');
      }
      if (document.querySelector('link[href*="cookie-consent.css"]')) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = base + 'cookie-consent.css?v=1.0';
      document.head.appendChild(link);
      return base;
    } catch (e) { return ''; }
  }
  var BASE = injectCss();

  // Pfad zur Datenschutzerklaerung relativ zur Seite bestimmen
  function privacyHref() {
    return location.pathname.indexOf('/infos/') !== -1
      ? 'datenschutz.html'
      : 'infos/datenschutz.html';
  }

  // ── Consent-Entscheidung an den Server melden (Auswertung im Dashboard) ──
  function logConsent(level) {
    try {
      var sid = null;
      try { sid = sessionStorage.getItem('maios_sid'); } catch (e) { /* kein sessionStorage */ }
      var payload = JSON.stringify({ level: level, session_id: sid, path: location.pathname });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track/consent', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/track/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) { /* Logging darf nie stoeren */ }
  }

  // ── DOM ─────────────────────────────────────────────────────────
  var bannerEl = null;
  var reopenEl = null;

  function buildBanner() {
    if (bannerEl) return bannerEl;
    var b = document.createElement('div');
    b.className = 'maios-cc-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-live', 'polite');
    b.setAttribute('aria-label', 'Cookie-Einwilligung');
    b.innerHTML =
      '<div class="maios-cc-inner">' +
        '<div class="maios-cc-icon" aria-hidden="true">🍪</div>' +
        '<div class="maios-cc-text">' +
          '<p class="maios-cc-title">Wir respektieren Ihre Privatsphäre</p>' +
          '<p class="maios-cc-desc">Wir verwenden Cookies, um den Shop bereitzustellen und – mit Ihrer ' +
          'Zustimmung – Besuche anonym auszuwerten, um unser Angebot zu verbessern. ' +
          'Sie können selbst entscheiden. Mehr dazu in unserer ' +
          '<a href="' + privacyHref() + '">Datenschutzerklärung</a>.</p>' +
        '</div>' +
        '<div class="maios-cc-actions">' +
          '<button type="button" class="maios-cc-btn maios-cc-btn-essential" data-cc="essential">Nur notwendige</button>' +
          '<button type="button" class="maios-cc-btn maios-cc-btn-accept" data-cc="all">Alle akzeptieren</button>' +
        '</div>' +
      '</div>';
    b.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-cc')) {
        choose(t.getAttribute('data-cc'));
      }
    });
    document.body.appendChild(b);
    bannerEl = b;
    return b;
  }

  function buildReopen() {
    if (reopenEl) return reopenEl;
    var r = document.createElement('button');
    r.type = 'button';
    r.className = 'maios-cc-reopen';
    r.setAttribute('aria-label', 'Cookie-Einstellungen ändern');
    r.setAttribute('title', 'Cookie-Einstellungen');
    r.textContent = '🍪';
    r.addEventListener('click', showBanner);
    document.body.appendChild(r);
    reopenEl = r;
    return r;
  }

  function showBanner() {
    var b = buildBanner();
    if (reopenEl) reopenEl.classList.remove('maios-cc-visible');
    // doppeltes requestAnimationFrame -> sauberer Slide-in beim ersten Anzeigen
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { b.classList.add('maios-cc-show'); });
    });
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('maios-cc-show');
    buildReopen().classList.add('maios-cc-visible');
  }

  function choose(level) {
    if (level !== 'all' && level !== 'essential') return;
    writeConsent(level);
    hideBanner();
    logConsent(level);
    emitChange(level);
  }

  // ── Start ───────────────────────────────────────────────────────
  function init() {
    var existing = readConsent();
    if (existing) {
      buildReopen().classList.add('maios-cc-visible'); // nur Wiederoeffnen-Knopf
    } else {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
