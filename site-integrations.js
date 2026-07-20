/**
 * site-integrations.js — externe Integrationen, DSGVO-/consent-gated.
 *
 * Lädt Meta Pixel, Google Analytics 4 und den Tawk.to-Live-Chat — aber NUR:
 *   1) wenn die jeweilige ID in Render gesetzt ist (via /api/site-config aus ENV), UND
 *   2) wenn der Besucher „Alle Cookies akzeptieren" gewählt hat (window.MaiosConsent).
 * Ohne IDs oder ohne Einwilligung wird nichts geladen und nichts getrackt.
 *
 * ENV in Render: META_PIXEL_ID, GA4_MEASUREMENT_ID, TAWK_PROPERTY_ID, TAWK_WIDGET_ID
 */
(function () {
  'use strict';

  var cfg = null;
  var loaded = { pixel: false, ga: false, tawk: false, pageEvents: false };

  function consentOK() {
    return !!(window.MaiosConsent && window.MaiosConsent.allowsTracking && window.MaiosConsent.allowsTracking());
  }

  // ── Meta Pixel ────────────────────────────────────────────────────
  function loadMetaPixel(id) {
    if (loaded.pixel || !id) return;
    loaded.pixel = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  // ── Google Analytics 4 ────────────────────────────────────────────
  function loadGA4(id) {
    if (loaded.ga || !id) return;
    loaded.ga = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
  }

  // ── Tawk.to Live-Chat ─────────────────────────────────────────────
  function loadTawk(propertyId, widgetId) {
    if (loaded.tawk || !propertyId) return;
    loaded.tawk = true;
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();
    var s1 = document.createElement('script');
    var s0 = document.getElementsByTagName('script')[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/' + propertyId + '/' + (widgetId || 'default');
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode.insertBefore(s1, s0);
  }

  // Öffentliche Track-Hilfe für andere Skripte (z. B. AddToCart-Hooks).
  window.MaiosAnalytics = window.MaiosAnalytics || {
    track: function (event, params) {
      try { if (window.fbq) window.fbq('track', event, params || {}); } catch (e) { /* still */ }
      try { if (window.gtag) window.gtag('event', event, params || {}); } catch (e) { /* still */ }
    }
  };

  function firePageEvents() {
    if (loaded.pageEvents) return;
    loaded.pageEvents = true;
    // Produktseite -> ViewContent
    var pid = document.body && document.body.dataset && document.body.dataset.productId;
    if (pid) window.MaiosAnalytics.track('ViewContent', { content_ids: [String(pid)], content_type: 'product' });
    // Danke-/Success-Seite -> Purchase (Conversion; Betrag am Client nicht verfügbar).
    if (/success\.html$/i.test(location.pathname)) window.MaiosAnalytics.track('Purchase', { currency: 'EUR' });
  }

  function activate() {
    if (!cfg || !consentOK()) return;
    loadMetaPixel(cfg.metaPixelId);
    loadGA4(cfg.ga4Id);
    loadTawk(cfg.tawkPropertyId, cfg.tawkWidgetId);
    firePageEvents();
  }

  function start() {
    fetch('/api/site-config', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (c) {
        cfg = c || {};
        if (!cfg.metaPixelId && !cfg.ga4Id && !cfg.tawkPropertyId) return; // nichts konfiguriert
        if (consentOK()) activate();
        // Bei späterer Zustimmung nachladen.
        if (window.MaiosConsent && window.MaiosConsent.onChange) window.MaiosConsent.onChange(activate);
        window.addEventListener('maios:consent', activate);
      })
      .catch(function () { /* Config nicht erreichbar -> nichts laden */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
