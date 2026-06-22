/**
 * admin-views.js — Aufrufe/Besucher-Dashboard
 *
 * Holt die Kennzahlen von api/views/* — RELATIVE URLs, die unter
 * /a29715347575/ auflösen. Da das im selben (bereits per Basic Auth
 * authentifizierten) Pfad-Teilbaum liegt wie das Dashboard, sendet der
 * Browser die Zugangsdaten bei fetch() zuverlässig mit.
 * Befüllt Kacheln, Chart und Top-Listen; aktualisiert die Live-Zahl alle 30 s.
 */
(function () {
  'use strict';

  let viewsChart = null;

  const FLAGS = {
    DE: '🇩🇪', AT: '🇦🇹', CH: '🇨🇭', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
    GB: '🇬🇧', US: '🇺🇸', NL: '🇳🇱', BE: '🇧🇪', PL: '🇵🇱', CZ: '🇨🇿',
    DK: '🇩🇰', SE: '🇸🇪', NO: '🇳🇴', FI: '🇫🇮'
  };

  async function getJSON(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' bei ' + url);
    return res.json();
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function loadStats() {
    try {
      const s = await getJSON('api/views/stats');
      // 'Aufrufe' + 'Eindeutige Besucher' folgen dem Zeitraum-Filter (loadRangeTotals);
      // hier nur die zeitraum-unabhaengigen Kacheln aktualisieren (Live + Gesamt).
      setText('views-live', s.liveNow ?? 0);
      setText('views-total', s.totalViews ?? 0);

      const badge = document.getElementById('live-badge');
      if (badge) {
        setText('live-now', s.liveNow ?? 0);
        badge.style.display = (s.liveNow > 0) ? 'inline-block' : 'none';
      }
    } catch (e) {
      console.warn('⚠️ Aufruf-Stats konnten nicht geladen werden:', e.message);
    }
  }

  // ── Umschaltbares Diagramm mit Zeitraum-Filter ────────────────────
  // Jede Kachel (data-chart) hat ihr eigenes Diagramm; die Buttongruppe
  // #chart-range schaltet den Zeitraum fuer ALLE Diagramme um.
  let currentMode = 'views-day';
  let currentRange = '30d';
  const _seriesCache = {}; // url -> rows (vermeidet Re-Fetch beim Hin-/Herschalten)

  // Zeitraum-Optionen: Tagesraster fuer kurze, Monatsraster fuer lange Zeitraeume.
  const RANGES = {
    'today': { label: 'Heute', gran: 'day' },
    '7d': { label: '7 Tage', gran: 'day' },
    '30d': { label: 'Letzter Monat', gran: 'day' },
    '12m': { label: '1 Jahr', gran: 'month' },
    'all': { label: 'Gesamt', gran: 'month' }
  };
  const DEFAULT_RANGE = '30d';

  const VIEWS_BASE = 'api/views/timeseries';
  const ORDERS_BASE = 'api/orders/timeseries';

  // X-Achsen-Label je nach Raster (Tag: TT.MM, Monat: Mon. JJ)
  function fmtLabel(r, gran) {
    const d = new Date(r.day);
    return gran === 'month'
      ? d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  // Hex-Farbe -> rgba mit Alpha (fuer halbtransparente Flaechen)
  function hexA(hex, a) {
    const m = hex.replace('#', '');
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // Laufende Summe (fuer kumulierte Ansichten)
  function cumsum(arr) {
    let s = 0;
    return arr.map(v => (s += (Number(v) || 0)));
  }

  function ds(label, data, color) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: hexA(color, 0.12),
      fill: true,
      tension: 0.3
    };
  }

  // Eine Datenreihe als Array (Labels werden zentral in renderChart gesetzt)
  function single(label, data, color) {
    return [ds(label, data, color)];
  }

  // Jede Kachel hat ihren eigenen Modus (1 Box = 1 Diagramm).
  // metric = Kennzahl, agg = 'day' (pro Bucket) | 'cum' (kumuliert),
  // base = Endpoint, build = liefert die Chart.js-Datasets.
  const CHART_MODES = {
    // ── Aufrufe & Besucher ──
    'views-day': {
      metric: 'Aufrufe', agg: 'day', base: VIEWS_BASE,
      build: (r) => single('Aufrufe', r.map(x => x.views), '#667eea')
    },
    'unique-day': {
      metric: 'Eindeutige Besucher', agg: 'day', base: VIEWS_BASE,
      build: (r) => single('Eindeutige Besucher', r.map(x => x.unique_views), '#28a745')
    },
    'traffic-day': {
      metric: 'Aufrufe & Besucher', agg: 'day', base: VIEWS_BASE,
      build: (r) => [
        ds('Aufrufe', r.map(x => x.views), '#667eea'),
        ds('Eindeutige Besucher', r.map(x => x.unique_views), '#28a745')
      ]
    },
    'views-cum': {
      metric: 'Aufrufe', agg: 'cum', base: VIEWS_BASE,
      build: (r) => single('Aufrufe kumuliert', cumsum(r.map(x => x.views)), '#6f42c1')
    },
    // ── Bestellungen & Umsatz ──
    'orders-cum': {
      metric: 'Bestellungen', agg: 'cum', base: ORDERS_BASE,
      build: (r) => single('Bestellungen kumuliert', cumsum(r.map(x => x.orders)), '#0d6efd')
    },
    'revenue-cum': {
      metric: 'Umsatz', agg: 'cum', base: ORDERS_BASE, isCurrency: true,
      build: (r) => single('Umsatz kumuliert', cumsum(r.map(x => x.revenue)), '#198754')
    },
    'orders-day': {
      metric: 'Bestellungen', agg: 'day', base: ORDERS_BASE,
      build: (r) => single('Bestellungen', r.map(x => x.orders), '#fd7e14')
    },
    'pending-day': {
      metric: 'Offene Bestellungen', agg: 'day', base: ORDERS_BASE,
      build: (r) => single('Offene Bestellungen', r.map(x => x.pending), '#dc3545')
    }
  };

  const DEFAULT_MODE = 'views-day';

  // Titel = Kennzahl + Raster (pro Tag/Monat bzw. kumuliert) + Zeitraum-Label.
  // gran wird uebergeben, da 'Gesamt' das Raster dynamisch waehlt.
  function buildTitle(cfg, gran) {
    const per = gran === 'month' ? 'pro Monat' : 'pro Tag';
    let base = cfg.agg === 'cum' ? (cfg.metric + ' kumuliert') : (cfg.metric + ' ' + per);
    if (cfg.isCurrency) base += ' (€)';
    return base + ' · ' + RANGES[currentRange].label;
  }

  async function fetchSeries(url) {
    if (_seriesCache[url]) return _seriesCache[url];
    const rows = await getJSON(url);
    _seriesCache[url] = rows;
    return rows;
  }

  function highlightActiveCard(mode) {
    document.querySelectorAll('.stats-card[data-chart]').forEach(card => {
      card.classList.toggle('chart-active', card.dataset.chart === mode);
    });
  }

  async function renderChart(mode) {
    const cfg = CHART_MODES[mode] || CHART_MODES[DEFAULT_MODE];
    currentMode = (CHART_MODES[mode] ? mode : DEFAULT_MODE);
    setText('chart-title', buildTitle(cfg, RANGES[currentRange].gran)); // vorlaeufig
    highlightActiveCard(currentMode);

    try {
      const payload = await fetchSeries(cfg.base + '?range=' + currentRange);
      const rows = Array.isArray(payload) ? payload : (payload.rows || []);
      // 'Gesamt' kann taeglich ODER monatlich sein -> tatsaechliches Raster vom Server
      const gran = (payload && payload.granularity) || RANGES[currentRange].gran;
      setText('chart-title', buildTitle(cfg, gran)); // endgueltig

      const datasets = cfg.build(rows);
      const labels = rows.map(r => fmtLabel(r, gran));

      // Bei sehr wenig Daten Balken statt Linie (ein einzelner Linienpunkt wirkt leer)
      const type = rows.length <= 2 ? 'bar' : 'line';
      if (type === 'bar') {
        datasets.forEach(d => { d.backgroundColor = d.borderColor; d.borderWidth = 0; d.fill = false; });
      }

      const ctx = document.getElementById('views-chart');
      if (!ctx || typeof Chart === 'undefined') return;

      if (viewsChart) viewsChart.destroy();
      const isCurrency = !!cfg.isCurrency;
      viewsChart = new Chart(ctx, {
        type,
        data: { labels, datasets },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: isCurrency ? {
              callbacks: {
                label: (c) => c.dataset.label + ': € ' + Number(c.parsed.y).toFixed(2)
              }
            } : {}
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: isCurrency
                ? { callback: (v) => '€ ' + v }
                : { precision: 0 }
            }
          }
        }
      });
    } catch (e) {
      console.warn('⚠️ Diagramm konnte nicht geladen werden:', e.message);
    }
  }

  function attachCardClicks() {
    document.querySelectorAll('.stats-card[data-chart]').forEach(card => {
      card.addEventListener('click', () => renderChart(card.dataset.chart));
    });
  }

  // Kacheln 'Aufrufe' + 'Eindeutige Besucher' an den gewaehlten Zeitraum anpassen
  // (Wert + Label), statt fix 'heute' zu zeigen.
  async function loadRangeTotals() {
    try {
      const t = await getJSON('api/views/totals?range=' + currentRange);
      const lbl = (RANGES[currentRange] || RANGES[DEFAULT_RANGE]).label;
      setText('views-today', t.views ?? 0);
      setText('views-unique', t.unique_views ?? 0);
      setText('views-today-label', 'Aufrufe · ' + lbl);
      setText('views-unique-label', 'Eindeutige Besucher · ' + lbl);
    } catch (e) {
      console.warn('⚠️ Zeitraum-Summen konnten nicht geladen werden:', e.message);
    }
  }

  // Zeitraum-Buttons: setzen currentRange, rendern das Diagramm UND die Kacheln neu
  function attachRangeButtons() {
    const group = document.getElementById('chart-range');
    if (!group) return;
    const buttons = group.querySelectorAll('button[data-range]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (!RANGES[btn.dataset.range]) return;
        currentRange = btn.dataset.range;
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        renderChart(currentMode);
        loadRangeTotals();
      });
    });
  }

  async function loadTopPages() {
    const el = document.getElementById('top-pages');
    if (!el) return;
    try {
      const rows = await getJSON('api/views/top-pages?limit=8&days=30');
      if (!rows.length) {
        el.innerHTML = '<li class="list-group-item text-muted small">Noch keine Daten</li>';
        return;
      }
      el.innerHTML = rows.map(r =>
        '<li class="list-group-item d-flex justify-content-between align-items-center px-0">' +
          '<span class="text-truncate" style="max-width:75%;" title="' + escapeHtml(r.path) + '">' +
            escapeHtml(r.path) +
          '</span>' +
          '<span class="badge bg-primary rounded-pill">' + r.views + '</span>' +
        '</li>'
      ).join('');
    } catch (e) {
      el.innerHTML = '<li class="list-group-item text-danger small">Fehler beim Laden</li>';
    }
  }

  async function loadTopCountries() {
    const el = document.getElementById('top-countries');
    if (!el) return;
    try {
      const rows = await getJSON('api/views/top-countries?limit=8&days=30');
      if (!rows.length) {
        el.innerHTML = '<li class="list-group-item text-muted small">Noch keine Daten</li>';
        return;
      }
      el.innerHTML = rows.map(r => {
        const code = (r.country || '').toUpperCase();
        const flag = FLAGS[code] || '🌍';
        return '<li class="list-group-item d-flex justify-content-between align-items-center px-0">' +
          '<span>' + flag + ' ' + escapeHtml(r.country) + '</span>' +
          '<span class="badge bg-secondary rounded-pill">' + r.views + '</span>' +
        '</li>';
      }).join('');
    } catch (e) {
      el.innerHTML = '<li class="list-group-item text-danger small">Fehler beim Laden</li>';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Einwilligungen & Besucher-Insights (Cookie-Consent) ──────────
  function fmtDuration(sec) {
    sec = Number(sec) || 0;
    if (sec < 60) return sec + ' s';
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ' min' + (s ? ' ' + s + ' s' : '');
  }

  // Liste mit Wert-Badge + Anteilsbalken (Anteil an der Gesamtsumme).
  function renderList(el, rows, opts) {
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = '<li class="list-group-item text-muted small">Noch keine Daten</li>';
      return;
    }
    var total = rows.reduce(function (a, r) { return a + (Number(opts.value(r)) || 0); }, 0) || 1;
    el.innerHTML = rows.map(function (r) {
      var val = Number(opts.value(r)) || 0;
      var pct = Math.round((val / total) * 100);
      var label = opts.label(r);
      return '<li class="list-group-item px-0 py-2">' +
        '<div class="d-flex justify-content-between align-items-center mb-1">' +
          '<span class="text-truncate" style="max-width:70%;" title="' + escapeHtml(label) + '">' +
            (opts.icon ? opts.icon(r) + ' ' : '') + escapeHtml(label) +
          '</span>' +
          '<span class="badge bg-primary rounded-pill">' + escapeHtml(opts.display(r)) + '</span>' +
        '</div>' +
        '<div class="progress" style="height:5px;">' +
          '<div class="progress-bar" role="progressbar" style="width:' + pct + '%;" ' +
            'aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"></div>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  async function loadConsent() {
    try {
      const c = await getJSON('api/views/consent?days=30');
      setText('consent-all', c.all ?? 0);
      setText('consent-essential', c.essential ?? 0);
      setText('consent-rate', (c.acceptRate ?? 0) + '%');
    } catch (e) {
      console.warn('⚠️ Consent-Stats:', e.message);
    }
  }

  async function loadVisitorTypes() {
    try {
      const v = await getJSON('api/views/visitor-types?days=30');
      setText('visitors-returning', (v.returnRate ?? 0) + '%');
    } catch (e) {
      console.warn('⚠️ Besuchertypen:', e.message);
    }
  }

  var DEVICE_ICONS = { 'Desktop': '🖥️', 'Mobil': '📱', 'Tablet': '📲' };
  async function loadDevices() {
    const el = document.getElementById('device-breakdown');
    if (!el) return;
    try {
      const rows = await getJSON('api/views/devices?days=30');
      renderList(el, rows, {
        label: function (r) { return r.device; },
        value: function (r) { return r.views; },
        display: function (r) { return r.views + ' Aufrufe'; },
        icon: function (r) { return DEVICE_ICONS[r.device] || '•'; }
      });
    } catch (e) {
      el.innerHTML = '<li class="list-group-item text-danger small">Fehler beim Laden</li>';
    }
  }

  async function loadBrowsers() {
    const el = document.getElementById('browser-breakdown');
    if (!el) return;
    try {
      const rows = await getJSON('api/views/browsers?days=30&limit=8');
      renderList(el, rows, {
        label: function (r) { return r.browser; },
        value: function (r) { return r.views; },
        display: function (r) { return String(r.views); }
      });
    } catch (e) {
      el.innerHTML = '<li class="list-group-item text-danger small">Fehler beim Laden</li>';
    }
  }

  async function loadEntryPages() {
    const el = document.getElementById('entry-pages');
    if (!el) return;
    try {
      const rows = await getJSON('api/views/entry-pages?days=30&limit=8');
      renderList(el, rows, {
        label: function (r) { return r.path; },
        value: function (r) { return r.entries; },
        display: function (r) { return String(r.entries); }
      });
    } catch (e) {
      el.innerHTML = '<li class="list-group-item text-danger small">Fehler beim Laden</li>';
    }
  }

  async function loadTimeOnPage() {
    const el = document.getElementById('time-on-page');
    if (!el) return;
    try {
      const rows = await getJSON('api/views/time-on-page?days=30&limit=8');
      renderList(el, rows, {
        label: function (r) { return r.path; },
        value: function (r) { return r.avg_seconds; },
        display: function (r) { return fmtDuration(r.avg_seconds); }
      });
    } catch (e) {
      el.innerHTML = '<li class="list-group-item text-danger small">Fehler beim Laden</li>';
    }
  }

  function init() {
    currentRange = DEFAULT_RANGE;
    loadStats();
    loadRangeTotals();         // Kacheln 'Aufrufe'/'Eindeutige' fuer den Default-Zeitraum
    attachRangeButtons();      // Zeitraum-Filter (7T / Monat / Jahr / Gesamt)
    attachCardClicks();        // Kachel-Klicks schalten das Diagramm um
    renderChart(DEFAULT_MODE); // Standard-Ansicht: Aufrufe pro Tag, letzter Monat
    loadTopPages();
    loadTopCountries();
    // Einwilligungen & Besucher-Insights (Cookie-Consent)
    loadConsent();
    loadVisitorTypes();
    loadDevices();
    loadBrowsers();
    loadEntryPages();
    loadTimeOnPage();
    // Live-Zahl regelmäßig aktualisieren
    setInterval(loadStats, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
