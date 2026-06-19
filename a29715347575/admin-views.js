/**
 * admin-views.js — Aufrufe/Besucher-Dashboard
 *
 * Holt die Kennzahlen von /api/admin/views/* (hinter Basic Auth, dieselbe
 * Realm wie das Dashboard → Browser sendet die Zugangsdaten automatisch mit)
 * und befüllt Kacheln, Chart und Top-Listen. Aktualisiert die Live-Zahl alle 30 s.
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
      const s = await getJSON('/api/admin/views/stats');
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

  async function loadChart() {
    try {
      const rows = await getJSON('/api/admin/views/timeseries?days=14');
      const labels = rows.map(r => {
        const d = new Date(r.day);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      });
      const views = rows.map(r => r.views);
      const unique = rows.map(r => r.unique_views);

      const ctx = document.getElementById('views-chart');
      if (!ctx || typeof Chart === 'undefined') return;

      if (viewsChart) viewsChart.destroy();
      viewsChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Aufrufe',
              data: views,
              borderColor: '#667eea',
              backgroundColor: 'rgba(102,126,234,0.12)',
              fill: true,
              tension: 0.3
            },
            {
              label: 'Eindeutige Besucher',
              data: unique,
              borderColor: '#28a745',
              backgroundColor: 'rgba(40,167,69,0.10)',
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    } catch (e) {
      console.warn('⚠️ Aufruf-Chart konnte nicht geladen werden:', e.message);
    }
  }

  async function loadTopPages() {
    const el = document.getElementById('top-pages');
    if (!el) return;
    try {
      const rows = await getJSON('/api/admin/views/top-pages?limit=8&days=30');
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
      const rows = await getJSON('/api/admin/views/top-countries?limit=8&days=30');
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
    loadChart();
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
