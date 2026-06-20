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
  let currentMode = 'views';
  const _seriesCache = {}; // url -> rows (vermeidet Re-Fetch beim Hin-/Herschalten)

  function fmtDay(r) {
    const d = new Date(r.day);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  const CHART_MODES = {
    views: {
      title: 'Aufrufe der letzten 14 Tage',
      url: 'api/views/timeseries?days=14',
      build: (rows) => ({
        labels: rows.map(fmtDay),
        datasets: [
          {
            label: 'Aufrufe',
            data: rows.map(r => r.views),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102,126,234,0.12)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Eindeutige Besucher',
            data: rows.map(r => r.unique_views),
            borderColor: '#28a745',
            backgroundColor: 'rgba(40,167,69,0.10)',
            fill: true,
            tension: 0.3
          }
        ]
      })
    },
    orders: {
      title: 'Bestellungen der letzten 14 Tage',
      url: 'api/orders/timeseries?days=14',
      build: (rows) => ({
        labels: rows.map(fmtDay),
        datasets: [
          {
            label: 'Bestellungen',
            data: rows.map(r => r.orders),
            borderColor: '#fd7e14',
            backgroundColor: 'rgba(253,126,20,0.12)',
            fill: true,
            tension: 0.3
          }
        ]
      })
    },
    revenue: {
      title: 'Umsatz der letzten 14 Tage (€)',
      url: 'api/orders/timeseries?days=14',
      isCurrency: true,
      build: (rows) => ({
        labels: rows.map(fmtDay),
        datasets: [
          {
            label: 'Umsatz',
            data: rows.map(r => Number(r.revenue) || 0),
            borderColor: '#198754',
            backgroundColor: 'rgba(25,135,84,0.12)',
            fill: true,
            tension: 0.3
          }
        ]
      })
    }
  };

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
    const cfg = CHART_MODES[mode] || CHART_MODES.views;
    currentMode = (CHART_MODES[mode] ? mode : 'views');
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
    renderChart('views'); // Standard-Ansicht
    attachCardClicks();   // Kachel-Klicks schalten das Diagramm um
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
