/**
 * newsletter-popup.js — Newsletter-Anmelde-Popup (Double-Opt-In).
 *
 * - Erscheint kurz nach dem Seitenaufruf (Startseite) genau einmal pro Besucher,
 *   solange er sich nicht angemeldet/abgelehnt hat (Cooldown via localStorage).
 * - Sendet die E-Mail an POST /api/newsletter/subscribe -> Backend speichert sie
 *   ('pending') und schickt eine Bestaetigungsmail. Erst nach Klick gilt das Abo.
 * - Stoert nie: laedt eigene CSS, alle Fehler werden verschluckt, kein Framework.
 * - Erscheint nicht im Admin-Bereich und nicht, solange der Cookie-Banner offen ist.
 */
(function () {
  'use strict';

  var STORE_KEY = 'maios_newsletter';       // 'subscribed' | 'dismissed'
  var STORE_TS = 'maios_newsletter_ts';     // Zeitstempel der letzten Entscheidung
  var SHOW_DELAY_MS = 12000;                // 12 s nach Laden
  var REASK_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;  // nach Ablehnung 30 Tage Ruhe

  // Admin-Bereich braucht kein Popup
  if (location.pathname.indexOf('a29715347575') !== -1) return;

  // ── Persistenz ──────────────────────────────────────────────────
  function shouldShow() {
    try {
      var state = localStorage.getItem(STORE_KEY);
      if (state === 'subscribed') return false; // schon angemeldet -> nie wieder
      if (state === 'dismissed') {
        var ts = parseInt(localStorage.getItem(STORE_TS) || '0', 10);
        if (ts && (Date.now() - ts) < REASK_DISMISS_MS) return false; // Cooldown laeuft
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  function remember(state) {
    try {
      localStorage.setItem(STORE_KEY, state);
      localStorage.setItem(STORE_TS, String(Date.now()));
    } catch (e) { /* localStorage evtl. blockiert */ }
  }

  // ── CSS selbst laden (Pfad aus eigenem <script>-src ableiten) ───
  function injectCss() {
    try {
      var me = document.currentScript ||
        document.querySelector('script[src*="newsletter-popup.js"]');
      var base = '';
      if (me && me.getAttribute('src')) {
        base = me.getAttribute('src').replace(/newsletter-popup\.js.*$/, '');
      }
      if (document.querySelector('link[href*="newsletter-popup.css"]')) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = base + 'newsletter-popup.css?v=1.0';
      document.head.appendChild(link);
    } catch (e) { /* egal */ }
  }

  function privacyHref() {
    return location.pathname.indexOf('/infos/') !== -1
      ? 'datenschutz.html'
      : 'infos/datenschutz.html';
  }

  // ── DOM ─────────────────────────────────────────────────────────
  var overlay = null;

  function build() {
    if (overlay) return overlay;
    var o = document.createElement('div');
    o.className = 'mn-overlay';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', 'Newsletter-Anmeldung');
    o.innerHTML =
      '<div class="mn-modal">' +
        '<button type="button" class="mn-close" aria-label="Schließen">&times;</button>' +
        '<div class="mn-content">' +
          '<div class="mn-head">' +
            '<span class="mn-badge">Maios Newsletter</span>' +
            '<h2 class="mn-title">Nichts mehr verpassen</h2>' +
            '<p class="mn-sub">Melde dich für unseren Newsletter an und erhalte Neuigkeiten, neue Produkte und Aktionen direkt in dein Postfach.</p>' +
          '</div>' +
          '<div class="mn-body">' +
            '<div class="mn-field">' +
              '<input type="email" class="mn-input" placeholder="deine@email.de" ' +
                'autocomplete="email" inputmode="email" aria-label="E-Mail-Adresse">' +
            '</div>' +
            '<label class="mn-consent">' +
              '<input type="checkbox" class="mn-check-consent">' +
              '<span>Ja, ich möchte den Newsletter erhalten und bin mit der Verarbeitung meiner ' +
              'E-Mail-Adresse gemäß <a href="' + privacyHref() + '" target="_blank" rel="noopener">Datenschutzerklärung</a> ' +
              'einverstanden. Abmeldung jederzeit möglich.</span>' +
            '</label>' +
            '<button type="button" class="mn-btn">Jetzt anmelden</button>' +
            '<p class="mn-msg" role="status" aria-live="polite"></p>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Schließen
    o.querySelector('.mn-close').addEventListener('click', dismiss);
    o.addEventListener('click', function (e) {
      if (e.target === o) dismiss(); // Klick auf Overlay-Hintergrund
    });
    document.addEventListener('keydown', onKey);

    // Absenden
    var input = o.querySelector('.mn-input');
    var consent = o.querySelector('.mn-check-consent');
    var btn = o.querySelector('.mn-btn');
    btn.addEventListener('click', function () { submit(input, consent, btn, o); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit(input, consent, btn, o);
    });

    document.body.appendChild(o);
    overlay = o;
    return o;
  }

  function onKey(e) {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('mn-show')) dismiss();
  }

  function setMsg(o, text, kind) {
    var el = o.querySelector('.mn-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'mn-msg' + (kind ? ' mn-' + kind : '');
  }

  function submit(input, consent, btn, o) {
    var email = (input.value || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setMsg(o, 'Bitte gib eine gültige E-Mail-Adresse ein.', 'err');
      input.focus();
      return;
    }
    if (!consent.checked) {
      setMsg(o, 'Bitte bestätige die Einwilligung.', 'err');
      return;
    }
    btn.disabled = true;
    setMsg(o, 'Wird gesendet …', '');
    fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, source: 'popup' })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d && res.d.success) {
          remember('subscribed');
          showSuccess(o, res.d.message || 'Fast geschafft! Bitte bestätige den Link in deiner E-Mail.');
        } else {
          btn.disabled = false;
          setMsg(o, (res.d && res.d.error) || 'Anmeldung fehlgeschlagen. Bitte später erneut.', 'err');
        }
      })
      .catch(function () {
        btn.disabled = false;
        setMsg(o, 'Verbindungsfehler. Bitte später erneut.', 'err');
      });
  }

  function showSuccess(o, message) {
    var content = o.querySelector('.mn-content');
    if (!content) return;
    content.innerHTML =
      '<div class="mn-body">' +
        '<div class="mn-success">' +
          '<div class="mn-check" aria-hidden="true">📩</div>' +
          '<h2 class="mn-title">Bitte E-Mail bestätigen</h2>' +
          '<p class="mn-sub">' + message + '</p>' +
        '</div>' +
      '</div>';
    setTimeout(function () { hide(); }, 4200);
  }

  function show() {
    var o = build();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { o.classList.add('mn-show'); });
    });
    try {
      var inp = o.querySelector('.mn-input');
      if (inp) setTimeout(function () { inp.focus(); }, 320);
    } catch (e) { /* egal */ }
  }

  function hide() {
    if (overlay) overlay.classList.remove('mn-show');
    document.removeEventListener('keydown', onKey);
  }

  function dismiss() {
    remember('dismissed');
    hide();
  }

  // ── Start ───────────────────────────────────────────────────────
  // Erst zeigen, wenn der Cookie-Banner entschieden ist (kein Stapeln).
  function consentPending() {
    try {
      return window.MaiosConsent && typeof window.MaiosConsent.hasDecision === 'function'
        && !window.MaiosConsent.hasDecision();
    } catch (e) { return false; }
  }

  function scheduleShow() {
    if (!shouldShow()) return;
    injectCss();
    var waited = 0;
    var timer = setInterval(function () {
      waited += 500;
      if (!shouldShow()) { clearInterval(timer); return; }
      if (consentPending() && waited < 60000) return; // auf Cookie-Entscheidung warten (max 60 s)
      if (waited >= SHOW_DELAY_MS) {
        clearInterval(timer);
        show();
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleShow);
  } else {
    scheduleShow();
  }
})();
