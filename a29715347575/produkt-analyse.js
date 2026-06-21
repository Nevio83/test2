/**
 * produkt-analyse.js — Bewertung der Produkte (Renner / Conversion-Problem / Ladenhüter)
 *
 * Führt products.json (alle Produkte) mit der serverseitigen Analyse zusammen:
 *   - Verkäufe (Einheiten, Umsatz, Bestellungen) aus order_items (nur bezahlt)
 *   - Aufrufe der Produktseite aus page_views
 * Daraus werden Conversion, eine Bewertung je Produkt und ein Fazit gebildet.
 * Relative URLs lösen unter /a29715347575/ auf (Basic-Auth-geschützter Pfad).
 */
(function () {
  'use strict';

  let currentRange = '30d';
  let sortKey = 'revenue';
  let sortDir = -1; // -1 = absteigend
  let merged = []; // zusammengeführte Produktliste

  const VIEW_PROBLEM = 10; // ab so vielen eindeutigen Aufrufen ohne Verkauf => Conversion-Problem

  async function getJSON(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' bei ' + url);
    return res.json();
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const euro = (n) => (Number(n) || 0).toFixed(2);

  // ── Daten laden & zusammenführen ──────────────────────────────────
  async function loadData() {
    const [products, analysis] = await Promise.all([
      getJSON('../products.json'),
      getJSON('api/products/analysis?range=' + currentRange)
    ]);

    const salesById = {};
    (analysis.sales || []).forEach(s => { salesById[String(s.product_id)] = s; });
    const viewsById = {};
    (analysis.views || []).forEach(v => { viewsById[String(v.product_id)] = v; });

    merged = products.map(p => {
      const s = salesById[String(p.id)] || {};
      const v = viewsById[String(p.id)] || {};
      const units = s.units || 0;
      const revenue = s.revenue || 0;
      const orders = s.orders || 0;
      const views = v.views || 0;
      const unique = v.unique_views || 0;
      const conversion = unique > 0 ? (orders / unique) * 100 : null;
      return {
        id: p.id,
        name: p.name,
        category: p.category || '',
        image: p.image || '',
        units, revenue, orders, views, unique, conversion
      };
    });

    classify(merged);
  }

  // ── Bewertung je Produkt ──────────────────────────────────────────
  function classify(items) {
    const sold = items.filter(i => i.units > 0).sort((a, b) => b.revenue - a.revenue);
    const topCut = Math.max(1, Math.ceil(sold.length * 0.3));
    const midCut = Math.ceil(sold.length * 0.7);
    const rankOf = new Map(sold.map((it, idx) => [it.id, idx]));

    items.forEach(it => {
      if (it.units > 0) {
        const rank = rankOf.get(it.id);
        if (rank < topCut) it.verdict = { key: 'renner', label: 'Renner', cls: 'success' };
        else if (rank < midCut) it.verdict = { key: 'solide', label: 'Solide', cls: 'info' };
        else it.verdict = { key: 'schwach', label: 'Schwach', cls: 'warning' };
      } else if (it.unique >= VIEW_PROBLEM) {
        it.verdict = { key: 'conversion', label: 'Conversion-Problem', cls: 'danger' };
      } else if (it.views > 0) {
        it.verdict = { key: 'beobachten', label: 'Beobachten', cls: 'secondary' };
      } else {
        it.verdict = { key: 'keine', label: 'Keine Daten', cls: 'light text-dark border' };
      }
    });
  }

  // ── KPIs ──────────────────────────────────────────────────────────
  function renderKpis() {
    const selling = merged.filter(i => i.units > 0).length;
    const revenue = merged.reduce((sum, i) => sum + i.revenue, 0);
    setText('kpi-total', merged.length);
    setText('kpi-selling', selling);
    setText('kpi-idle', merged.length - selling);
    setText('kpi-revenue', euro(revenue));
  }

  // ── Fazit-Text ────────────────────────────────────────────────────
  function renderFazit() {
    const el = document.getElementById('fazit-content');
    if (!el) return;

    const sold = merged.filter(i => i.units > 0).sort((a, b) => b.revenue - a.revenue);
    const problem = merged.filter(i => i.verdict.key === 'conversion').sort((a, b) => b.unique - a.unique);
    const idleNoInterest = merged.filter(i => i.units === 0 && i.views === 0);

    const blocks = [];

    if (sold.length === 0) {
      blocks.push('<div class="alert alert-secondary mb-3"><i class="bi bi-info-circle"></i> Im gewählten Zeitraum gab es noch <strong>keine Verkäufe</strong>. Bewertung basiert nur auf Aufrufen.</div>');
    } else {
      const top = sold.slice(0, 3).map(i =>
        '<li>🏆 <strong>' + escapeHtml(i.name) + '</strong> — € ' + euro(i.revenue) +
        ' Umsatz, ' + i.units + ' verkauft' +
        (i.conversion != null ? ' · ' + i.conversion.toFixed(1) + '% Conversion' : '') + '</li>'
      ).join('');
      blocks.push(
        '<h6 class="text-success mb-2"><i class="bi bi-trophy"></i> Renner – das läuft</h6>' +
        '<ul class="fazit-list mb-3">' + top + '</ul>'
      );
    }

    if (problem.length) {
      const list = problem.slice(0, 5).map(i =>
        '<li>⚠️ <strong>' + escapeHtml(i.name) + '</strong> — ' + i.unique +
        ' Besucher, aber kein Verkauf. <span class="text-muted">Preis, Bilder oder Beschreibung prüfen.</span></li>'
      ).join('');
      blocks.push(
        '<h6 class="text-danger mb-2"><i class="bi bi-exclamation-triangle"></i> Conversion-Problem – viel gesehen, nicht gekauft</h6>' +
        '<ul class="fazit-list mb-3">' + list + '</ul>'
      );
    }

    if (idleNoInterest.length) {
      const names = idleNoInterest.slice(0, 8).map(i => escapeHtml(i.name)).join(', ');
      const more = idleNoInterest.length > 8 ? ' u. a. (' + idleNoInterest.length + ' gesamt)' : '';
      blocks.push(
        '<h6 class="text-muted mb-2"><i class="bi bi-moon-stars"></i> Kaum Resonanz – weder Aufrufe noch Verkäufe</h6>' +
        '<p class="mb-0 text-muted">' + names + more +
        '. <span>Mehr Marketing/Reichweite – oder aus dem Sortiment nehmen.</span></p>'
      );
    }

    el.innerHTML = blocks.join('');
  }

  // ── Tabelle ───────────────────────────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('analysis-tbody');
    if (!tbody) return;

    const rows = merged.slice().sort((a, b) => {
      const d = (b[sortKey] - a[sortKey]) * (sortDir === -1 ? 1 : -1);
      if (d !== 0) return d;
      return b.revenue - a.revenue;
    });

    tbody.innerHTML = rows.map((i, idx) => {
      const conv = i.conversion != null
        ? '<div class="d-flex align-items-center justify-content-end gap-2">' +
            '<span>' + i.conversion.toFixed(1) + '%</span>' +
            '<div class="conv-bar" style="width:60px;"><span style="width:' + Math.min(100, i.conversion) + '%"></span></div>' +
          '</div>'
        : '<span class="text-muted">–</span>';
      return '<tr>' +
        '<td class="text-muted">' + (idx + 1) + '</td>' +
        '<td>' +
          '<div class="d-flex align-items-center gap-2">' +
            '<img class="product-thumb" src="../' + encodeURI(i.image) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
            '<div>' +
              '<div class="fw-semibold">' + escapeHtml(i.name) + '</div>' +
              '<small class="text-muted">#' + i.id + ' · ' + escapeHtml(i.category) + '</small>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td class="text-end">' + i.views + (i.unique ? ' <small class="text-muted">(' + i.unique + ')</small>' : '') + '</td>' +
        '<td class="text-end">' + i.units + '</td>' +
        '<td class="text-end fw-semibold">€ ' + euro(i.revenue) + '</td>' +
        '<td class="text-end">' + conv + '</td>' +
        '<td><span class="verdict-badge bg-' + i.verdict.cls + '">' + i.verdict.label + '</span></td>' +
      '</tr>';
    }).join('');
  }

  function renderAll() {
    renderKpis();
    renderFazit();
    renderTable();
  }

  // ── Interaktion ───────────────────────────────────────────────────
  function attachRangeButtons() {
    const group = document.getElementById('range-filter');
    if (!group) return;
    const buttons = group.querySelectorAll('button[data-range]');
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        currentRange = btn.dataset.range;
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        await refresh();
      });
    });
  }

  function attachSort() {
    document.querySelectorAll('th.sortable[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) sortDir = -sortDir;
        else { sortKey = key; sortDir = -1; }
        renderTable();
      });
    });
  }

  async function refresh() {
    const tbody = document.getElementById('analysis-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Lädt…</td></tr>';
    try {
      await loadData();
      renderAll();
    } catch (e) {
      console.error('Produkt-Analyse fehlgeschlagen:', e.message);
      document.getElementById('fazit-content').innerHTML =
        '<div class="alert alert-danger mb-0"><i class="bi bi-x-circle"></i> Analyse konnte nicht geladen werden.</div>';
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Fehler beim Laden</td></tr>';
    }
  }

  function init() {
    currentRange = '30d';
    attachRangeButtons();
    attachSort();
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
