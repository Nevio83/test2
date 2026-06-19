/**
 * view-tracker.js — Leichtes, datenschutzfreundliches Aufrufe-Tracking.
 *
 * Sendet beim Laden EINMAL einen Seitenaufruf an POST /api/track/view.
 * Es wird KEINE rohe IP gesendet — das Land kommt clientseitig aus dem
 * vorhandenen geolocation-tracker.js (bzw. localStorage 'userCountry').
 * Die Session-ID liegt nur in sessionStorage (kein dauerhaftes Tracking-Cookie).
 *
 * Stoert das Frontend nie: alle Fehler werden verschluckt.
 */
(function () {
  'use strict';

  // Admin-Bereich nicht tracken
  if (location.pathname.includes('a29715347575')) return;

  function getSessionId() {
    try {
      let sid = sessionStorage.getItem('maios_sid');
      if (!sid) {
        sid = (crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        sessionStorage.setItem('maios_sid', sid);
      }
      return sid;
    } catch (e) {
      return null;
    }
  }

  function getCountry() {
    try {
      if (typeof window.getUserCountryCode === 'function') {
        const c = window.getUserCountryCode();
        if (c && c !== 'XX') return c;
      }
      return localStorage.getItem('userCountry') || '';
    } catch (e) {
      return '';
    }
  }

  function send() {
    try {
      const payload = {
        path: location.pathname,
        referrer: document.referrer ? new URL(document.referrer).hostname : '',
        country: getCountry(),
        session_id: getSessionId()
      };
      const body = JSON.stringify(payload);

      // sendBeacon ist robuster (laeuft auch beim Verlassen der Seite weiter)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track/view', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/track/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {
      /* Tracking-Fehler bewusst ignorieren */
    }
  }

  // Kurz warten, damit das Land (Geolocation) Zeit hat, sich zu setzen
  if (document.readyState === 'complete') {
    setTimeout(send, 800);
  } else {
    window.addEventListener('load', function () { setTimeout(send, 800); });
  }
})();
