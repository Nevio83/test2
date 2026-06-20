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
      setText('views-today', s.todayViews ?? 0);
      setText('views-unique', s.uniqueToday ?? 0);
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

  // ── Umschaltbares Diagramm ────────────────────────────────────────
  // Jede Kachel mit data-chart="<mode>" schaltet das Chart auf diese Ansicht.
  // Drei Modi: Aufrufe (Standard), Bestellungen, Umsatz — je 14 Tage.
  let currentMode = 'views-day';
  const _seriesCache = {}; // url -> rows (vermeidet Re-Fetch beim Hin-/Herschalten)

  function fmtDay(r) {
    const d = new Date(r.day);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  const VIEWS_URL = 'api/views/timeseries?days=14';
  const ORDERS_URL = 'api/orders/timeseries?days=14';

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

  // Einreihiges Liniendiagramm
  function line(rows, label, data, color) {
    return { labels: rows.map(fmtDay), datasets: [ds(label, data, color)] };
  }

  // Jede Kachel hat ihren eigenen Modus (1 Box = 1 Diagramm).
  const CHART_MODES = {
    // ── Aufrufe & Besucher ──
    'views-day': {
      title: 'Aufrufe pro Tag (14 Tage)',
      url: VIEWS_URL,
      build: (r) => line(r, 'Aufrufe', r.map(x => x.views), '#667eea')
    },
    'unique-day': {
      title: 'Eindeutige Besucher pro Tag (14 Tage)',
      url: VIEWS_URL,
      build: (r) => line(r, 'Eindeutige Besucher', r.map(x => x.unique_views), '#28a745')
    },
    'traffic-day': {
      title: 'Aufrufe & Besucher pro Tag (14 Tage)',
      url: VIEWS_URL,
      build: (r) => ({
        labels: r.map(fmtDay),
        datasets: [
          ds('Aufrufe', r.map(x => x.views), '#667eea'),
          ds('Eindeutige Besucher', r.map(x => x.unique_views), '#28a745')
        ]
      })
    },
    'views-cum': {
      title: 'Aufrufe kumuliert (14 Tage)',
      url: VIEWS_URL,
      build: (r) => line(r, 'Aufrufe kumuliert', cumsum(r.map(x => x.views)), '#6f42c1')
    },
    // ── Bestellungen & Umsatz ──
    'orders-cum': {
      title: 'Bestellungen kumuliert (14 Tage)',
      url: ORDERS_URL,
      build: (r) => line(r, 'Bestellungen kumuliert', cumsum(r.map(x => x.orders)), '#0d6efd')
    },
    'revenue-cum': {
      title: 'Umsatz kumuliert (14 Tage, €)',
      url: ORDERS_URL,
      isCurrency: true,
      build: (r) => line(r, 'Umsatz kumuliert', cumsum(r.map(x => x.revenue)), '#198754')
    },
    'orders-day': {
      title: 'Bestellungen pro Tag (14 Tage)',
      url: ORDERS_URL,
      build: (r) => line(r, 'Bestellungen', r.map(x => x.orders), '#fd7e14')
    },
    'pending-day': {
      title: 'Offene Bestellungen pro Tag (14 Tage)',
      url: ORDERS_URL,
      build: (r) => line(r, 'Offene Bestellungen', r.map(x => x.pending), '#dc3545')
    }
  };

  const DEFAULT_MODE = 'views-day';

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
    setText('chart-title', cfg.title);
    highlightActiveCard(currentMode);

    try {
      const rows = await fetchSeries(cfg.url);
      const built = cfg.build(rows);

      const ctx = document.getElementById('views-chart');
      if (!ctx || typeof Chart === 'undefined') return;

      if (viewsChart) viewsChart.destroy();
      const isCurrency = !!cfg.isCurrency;
      viewsChart = new Chart(ctx, {
        type: 'line',
        data: { labels: built.labels, datasets: built.datasets },
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

  function init() {
    loadStats();
    renderChart(DEFAULT_MODE); // Standard-Ansicht: Aufrufe pro Tag
    attachCardClicks();        // Kachel-Klicks schalten das Diagramm um
    loadTopPages();
    loadTopCountries();
    // Live-Zahl regelmäßig aktualisieren
    setInterval(loadStats, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
