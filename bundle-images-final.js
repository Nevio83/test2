// Häufig zusammen gekauft — Amazon-Style FBT Section
console.log('🎁 Bundle Images Final (FBT) geladen');

let bundleSystemInitialized = false;

// Wird von der Produktseite aufgerufen (setTimeout 400ms nach DOMContentLoaded)
window.renderBundlesWithImages = async function () {
  if (bundleSystemInitialized) return;
  bundleSystemInitialized = true;

  const section = document.getElementById('bundle-section');
  if (!section) return;

  const current = window.product;
  if (!current) return;

  // Produkte laden (aus Cache oder products.json)
  let all = [];
  try {
    const cached = JSON.parse(localStorage.getItem('allProducts') || '[]');
    if (cached.length) {
      all = cached;
    } else {
      const r = await fetch('../products.json');
      all = await r.json();
      localStorage.setItem('allProducts', JSON.stringify(all));
    }
  } catch (e) {
    console.warn('⚠️ FBT: products.json konnte nicht geladen werden', e);
    return;
  }

  // 2 verwandte Produkte wählen: zuerst gleiche Kategorie, dann anderen
  // ALI-Produkte ausschließen (werden im Shop gefiltert)
  const others  = all.filter(p => Number(p.id) !== Number(current.id) && !(p.sku && p.sku.startsWith('ALI')));
  const sameCat = others.filter(p => p.category === current.category);
  const pool    = sameCat.length >= 2 ? sameCat : others;
  if (pool.length < 1) return;

  // Deterministisch aber variabel (basierend auf Produkt-ID)
  const seed = Number(current.id);
  const rel1 = pool[seed % pool.length];
  const rel2 = pool[(seed + Math.max(1, Math.floor(pool.length / 3))) % pool.length];

  const picks = rel2 && rel2.id !== rel1.id ? [current, rel1, rel2] : [current, rel1];

  renderFBT(section, picks);
};

function imgPath(p) {
  if (!p.image) return '';
  // Produktseite liegt in /produkte/ → Bilder sind relativ zum Root
  return p.image.startsWith('../') ? p.image : '../' + p.image;
}

function renderFBT(section, products) {
  const total = products.reduce((s, p) => s + (p.price || 0), 0);

  const itemsHtml = products.map((p, i) => `
    <div class="fbt-item" data-id="${p.id}" data-price="${p.price || 0}">
      ${i > 0 ? '<div class="fbt-plus">+</div>' : ''}
      <div class="fbt-card">
        <label class="fbt-check-wrap">
          <input class="fbt-check" type="checkbox" checked data-id="${p.id}" data-price="${p.price || 0}">
          <span class="fbt-checkmark"><i class="bi bi-check"></i></span>
        </label>
        <a href="/produkte/${p.slug || ('#')}.html" class="fbt-img-link">
          <img class="fbt-img" src="${imgPath(p)}" alt="${p.name}" loading="lazy">
        </a>
        <div class="fbt-name">${p.name}</div>
        <div class="fbt-price">€${(p.price || 0).toFixed(2)}</div>
      </div>
    </div>
  `).join('');

  section.innerHTML = `
    <div class="fbt-wrap">
      <div class="fbt-header">
        <h2 class="fbt-title">Häufig zusammen gekauft</h2>
        <p class="fbt-subtitle">Komplettiere dein Setup</p>
      </div>
      <div class="fbt-body">
        <div class="fbt-items">${itemsHtml}</div>
        <div class="fbt-summary">
          <div class="fbt-count">${products.length} Artikel ausgewählt</div>
          <div class="fbt-total-label">Gesamtpreis</div>
          <div class="fbt-total" id="fbt-total">€${total.toFixed(2)}</div>
          <button class="fbt-btn" id="fbt-add-all">
            <i class="bi bi-bag-plus-fill"></i> Alle in den Warenkorb
          </button>
          <div class="fbt-hint">Artikel können einzeln abgewählt werden</div>
        </div>
      </div>
    </div>
  `;

  // display:none entfernen
  section.style.display = '';
  injectFBTStyles();
  bindFBTEvents(section, products);
}

function bindFBTEvents(section, products) {
  // Checkboxen → Gesamtpreis aktualisieren
  section.querySelectorAll('.fbt-check').forEach(cb => {
    cb.addEventListener('change', () => updateFBTTotal(section));
  });

  // "Alle in den Warenkorb"
  const btn = section.querySelector('#fbt-add-all');
  if (btn) btn.addEventListener('click', () => addFBTToCart(section, products));
}

function updateFBTTotal(section) {
  let total = 0;
  let count = 0;
  section.querySelectorAll('.fbt-check:checked').forEach(cb => {
    total += parseFloat(cb.dataset.price || 0);
    count++;
  });
  const el = section.querySelector('#fbt-total');
  if (el) el.textContent = '€' + total.toFixed(2);
  const countEl = section.querySelector('.fbt-count');
  if (countEl) countEl.textContent = count + ' Artikel ausgewählt';
}

function addFBTToCart(section, products) {
  const checked = [...section.querySelectorAll('.fbt-check:checked')].map(cb => Number(cb.dataset.id));
  if (!checked.length) {
    if (window.showNotif) window.showNotif('Bitte mindestens ein Produkt auswählen');
    return;
  }
  const toAdd = products.filter(p => checked.includes(Number(p.id)));

  // Schreibe direkt in "cart" (gleiche Keys wie der echte Shop)
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { cart = []; }

  toAdd.forEach(p => {
    const existing = cart.find(i => Number(i.id) === Number(p.id) && !i.isBundle);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      cart.push({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image || '',
        slug: p.slug || '',
        quantity: 1,
        cartItemId: p.id + '-fbt'
      });
    }
  });

  localStorage.setItem('cart', JSON.stringify(cart));
  if (window.updateCartBadge) window.updateCartBadge();
  if (window.showNotif) window.showNotif('✓ ' + toAdd.length + ' Artikel zum Warenkorb hinzugefügt');
  if (window.showPurchaseToast) window.showPurchaseToast();
}

function injectFBTStyles() {
  if (document.getElementById('fbt-styles')) return;
  const s = document.createElement('style');
  s.id = 'fbt-styles';
  s.textContent = `
    /* ── FBT Wrapper ── */
    .fbt-wrap {
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 20px;
      padding: 32px 28px;
      margin: 0 auto;
      max-width: 900px;
    }
    .fbt-header { margin-bottom: 24px; }
    .fbt-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 4px;
    }
    .fbt-subtitle { color: rgba(255,255,255,.5); font-size: .9rem; margin: 0; }

    /* ── Body ── */
    .fbt-body {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    /* ── Items row ── */
    .fbt-items {
      display: flex;
      align-items: center;
      gap: 0;
      flex: 1 1 auto;
      flex-wrap: wrap;
      gap: 8px;
    }
    .fbt-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .fbt-plus {
      font-size: 1.4rem;
      color: rgba(255,255,255,.4);
      font-weight: 700;
      padding: 0 4px;
    }

    /* ── Card ── */
    .fbt-card {
      position: relative;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 14px;
      padding: 12px 10px 10px;
      width: 150px;
      text-align: center;
      transition: border-color .2s;
    }
    .fbt-card:hover { border-color: rgba(139,92,246,.5); }

    /* ── Checkbox ── */
    .fbt-check-wrap {
      position: absolute;
      top: 8px;
      left: 8px;
      cursor: pointer;
    }
    .fbt-check { display: none; }
    .fbt-checkmark {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: #8b5cf6;
      color: #fff;
      font-size: .85rem;
      transition: background .2s, opacity .2s;
    }
    .fbt-check:not(:checked) + .fbt-checkmark {
      background: rgba(255,255,255,.12);
      color: transparent;
    }

    /* ── Image ── */
    .fbt-img-link { display: block; }
    .fbt-img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .fbt-name {
      font-size: .75rem;
      color: rgba(255,255,255,.8);
      line-height: 1.3;
      margin-bottom: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .fbt-price {
      font-size: .9rem;
      font-weight: 700;
      color: #43e97b;
    }

    /* ── Summary card ── */
    .fbt-summary {
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(139,92,246,.3);
      border-radius: 16px;
      padding: 20px 22px;
      min-width: 180px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .fbt-count { font-size: .78rem; color: rgba(255,255,255,.5); }
    .fbt-total-label { font-size: .8rem; color: rgba(255,255,255,.6); }
    .fbt-total {
      font-size: 1.7rem;
      font-weight: 800;
      color: #fff;
      font-family: 'Outfit', sans-serif;
      line-height: 1;
    }
    .fbt-btn {
      width: 100%;
      padding: 12px 16px;
      background: linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: .9rem;
      font-weight: 700;
      cursor: pointer;
      margin-top: 4px;
      transition: opacity .2s, transform .15s;
    }
    .fbt-btn:hover { opacity: .88; transform: translateY(-1px); }
    .fbt-hint { font-size: .7rem; color: rgba(255,255,255,.35); text-align: center; }

    @media (max-width: 640px) {
      .fbt-wrap { padding: 20px 14px; }
      .fbt-card { width: 110px; }
      .fbt-body { gap: 16px; }
      .fbt-summary { min-width: 100%; }
      .fbt-total { font-size: 1.4rem; }
    }
  `;
  document.head.appendChild(s);
}

// Fallback: falls renderBundlesWithImages nicht direkt aufgerufen wird
window.updateBundlePricesWithNewPrice = function () {};
