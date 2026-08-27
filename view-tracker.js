/**
 * view-tracker.js — Datenschutzfreundliches Aufrufe-Tracking mit Consent-Gate.
 *
 * Trackt NUR, wenn der Besucher im Cookie-Banner (cookie-consent.js) eine
 * Entscheidung getroffen hat:
 *   - 'essential' -> anonymer Seitenaufruf wie bisher (Pfad, Land, Referrer,
 *     Session-ID aus sessionStorage). Keine personenbezogenen Zusatzdaten.
 *   - 'all'       -> erweitertes Tracking: konsistente Besucher-ID (localStorage),
 *     Geraet/Browser/Betriebssystem, Einstiegsseite, Wiederkehrer-Status und
 *     Verweildauer (beim Verlassen der Seite nachgemeldet).
 *
 * Ohne Entscheidung wird nichts gesendet (DSGVO: aktiv akzeptieren).
 * Alle Fehler werden bewusst verschluckt — Tracking darf das Frontend nie stoeren.
 */
(function () {
  'use strict';

  // Admin-Bereich nicht tracken
  if (location.pathname.indexOf('a29715347575') !== -1) return;

  var sent = false; // pro Seitenladevorgang nur EIN View senden
  var clientViewId = null;
  var startTime = Date.now();

  // ── Consent lesen (von cookie-consent.js bereitgestellt) ─────────
  function consentLevel() {
    try {
      if (window.MaiosConsent && typeof window.MaiosConsent.level === 'function') {
        return window.MaiosConsent.level();
      }
    } catch (e) { /* Fallback unten */ }
    // Fallback: direkt aus localStorage, falls cookie-consent.js (noch) nicht geladen ist
    try {
      var lvl = localStorage.getItem('maios_cookie_consent');
      return (lvl === 'all' || lvl === 'essential') ? lvl : null;
    } catch (e) { return null; }
  }

  function isReturning() {
    try {
      return !!(window.MaiosConsent && window.MaiosConsent.isReturning());
    } catch (e) { return false; }
  }

  // ── IDs ──────────────────────────────────────────────────────────
  function uuid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) { /* Fallback unten */ }
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  // Session-ID: bei 'all' persistent (localStorage, ueber Besuche konsistent),
  // bei 'essential' nur sessionStorage (kein dauerhaftes Tracking).
  function getSessionId(level) {
    try {
      if (level === 'all') {
        var vid = localStorage.getItem('maios_vid');
        if (!vid) { vid = uuid(); localStorage.setItem('maios_vid', vid); }
        return vid;
      }
      var sid = sessionStorage.getItem('maios_sid');
      if (!sid) { sid = uuid(); sessionStorage.setItem('maios_sid', sid); }
      return sid;
    } catch (e) { return null; }
  }

  // Erste Seite dieses Browser-Tabs? -> Einstiegsseite
  function isEntryPage() {
    try {
      if (sessionStorage.getItem('maios_entry_done')) return false;
      sessionStorage.setItem('maios_entry_done', '1');
      return true;
    } catch (e) { return false; }
  }

  function getCountry() {
    try {
      if (typeof window.getUserCountryCode === 'function') {
        var c = window.getUserCountryCode();
        if (c && c !== 'XX') return c;
      }
      return localStorage.getItem('userCountry') || '';
    } catch (e) { return ''; }
  }

  // ── Geraet/Browser/OS aus dem User-Agent (grobe Klassifikation) ──
  function detectDevice() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet';
    if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'Mobil';
    return 'Desktop';
  }
  function detectBrowser() {
    var ua = navigator.userAgent || '';
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/OPR\/|Opera/i.test(ua)) return 'Opera';
    if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Chrome\//i.test(ua)) return 'Chrome';
    if (/Safari\//i.test(ua)) return 'Safari';
    return 'Andere';
  }
  function detectOS() {
    var ua = navigator.userAgent || '';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Andere';
  }

  // ── Senden ───────────────────────────────────────────────────────
  function post(url, payload) {
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (e) { /* faellt auf fetch zurueck */ }
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* Senden fehlgeschlagen - bewusst ignorieren */ }
  }

  function sendView() {
    if (sent) return;
    var level = consentLevel();
    if (!level) return; // keine Einwilligung -> nichts senden
    sent = true;

    // Kampagnen-Kennung des Marketing-Automaten (z.B. ?utm_campaign=mkt_42).
    //
    // WARUM SIE AN DEN PFAD GEHAENGT WIRD: location.pathname schneidet alle
    // Parameter ab. Ohne diese Zeile kommt die Kennung nie in der Datenbank
    // an — und dann laesst sich nicht sagen, welches Video Besucher gebracht
    // hat. Bewusst NUR utm_campaign und nichts anderes aus der Adresse: eine
    // Kampagnen-Kennung ist keine Person, ein beliebiger Parameter koennte
    // eine sein.
    var kampagne = '';
    try {
      var wert = new URLSearchParams(location.search).get('utm_campaign');
      if (wert) {
        wert = wert.slice(0, 40);
        kampagne = '?utm_campaign=' + encodeURIComponent(wert);
        // Merken, damit die Kennung bis zur Kasse ueberlebt: Zwischen dem
        // Klick auf den Link und dem Kauf liegen mehrere Seitenwechsel, und
        // die Adresse traegt die Kennung nur beim ersten Aufruf. Ohne das
        // waere die Bestellung wieder herkunftslos.
        localStorage.setItem('mkt_campaign', wert);
      }
    } catch (e) { /* alter Browser ohne URLSearchParams - dann eben ohne */ }

    var payload = {
      path: location.pathname + kampagne,
      referrer: document.referrer ? safeHost(document.referrer) : '',
      country: getCountry(),
      session_id: getSessionId(level),
      consent_level: level
    };

    if (level === 'all') {
      clientViewId = uuid();
      payload.client_view_id = clientViewId;
      payload.device = detectDevice();
      payload.browser = detectBrowser();
      payload.os = detectOS();
      payload.is_entry = isEntryPage();
      payload.is_returning = isReturning();
    }

    post('/api/track/view', payload);
  }

  function safeHost(url) {
    try { return new URL(url).hostname; } catch (e) { return ''; }
  }

  // ── Verweildauer beim Verlassen nachmelden (nur bei 'all') ───────
  var durationSent = false;
  function sendDuration() {
    if (durationSent || !clientViewId) return;
    durationSent = true;
    var seconds = Math.round((Date.now() - startTime) / 1000);
    if (seconds < 1 || seconds > 7200) return; // unplausibel -> verwerfen
    post('/api/track/duration', { client_view_id: clientViewId, seconds: seconds });
  }

  // ── Ablauf ───────────────────────────────────────────────────────
  function start() {
    // Land braucht einen Moment (Geolocation) -> kurz warten
    setTimeout(sendView, 800);

    // Wenn beim Laden noch keine Entscheidung vorliegt: auf Consent-Event warten
    if (!consentLevel()) {
      window.addEventListener('maios:consent', function () {
        startTime = Date.now(); // Verweildauer ab Zustimmung messen
        sendView();
      }, { once: true });
    }

    // Verweildauer melden, sobald die Seite verlassen/verborgen wird
    window.addEventListener('pagehide', sendDuration);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') sendDuration();
    });
  }

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start);
  }
})();
