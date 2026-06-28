/* ========================================================
   MAIOS PRODUKT PREMIUM — Shared Behaviour
   Countdown · Viewers · Sticky Bar · Toast · Cart ·
   Wishlist · Bundles · UI initialisierung

   WICHTIG: Cart/Wishlist nutzen dieselben localStorage-Keys
   wie der echte Shop ("cart" / "wishlist") und delegieren an
   window.addToCart (app.js) für korrektes Farb-/SKU-Handling.
   ======================================================== */

(function () {
  'use strict';

  /* --- Countdown --- */
  function initCountdown() {
    const boxes = document.querySelectorAll('.pp-cd-box[data-unit]');
    if (!boxes.length) return;

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    function tick() {
      const diff = Math.max(0, end - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      boxes.forEach(b => {
        if (b.dataset.unit === 'h') b.textContent = String(h).padStart(2, '0');
        if (b.dataset.unit === 'm') b.textContent = String(m).padStart(2, '0');
        if (b.dataset.unit === 's') b.textContent = String(s).padStart(2, '0');
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* --- Live Viewers --- */
  function initViewers() {
    const el = document.getElementById('pp-viewers-count');
    if (!el) return;
    const base = parseInt(el.textContent, 10) || 12;
    setInterval(() => {
      const delta = Math.floor(Math.random() * 5) - 2;
      el.textContent = Math.max(3, base + delta);
    }, 8000 + Math.random() * 4000);
  }

  /* --- Notification (kurzer Hinweis oben rechts) --- */
  function showNotif(msg) {
    const el = document.getElementById('pp-notif');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('pp-notif-show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('pp-notif-show'), 3200);
  }
  window.showNotif = showNotif;
  window.showNotification = showNotif;

  /* --- localStorage Helpers (SELBE Keys wie der echte Shop!) --- */
  function readCart() {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); }
    catch { return []; }
  }
  function cartCount() {
    return readCart().reduce((s, i) => s + (i.quantity || 1), 0);
  }
  function updateCartBadge() {
    const c = cartCount();
    document.querySelectorAll('.pp-cart-badge').forEach(b => {
      b.textContent = c;
      b.style.display = c > 0 ? 'flex' : 'none';
    });
  }
  window.updateCartBadge = updateCartBadge;

  function readWishlist() {
    try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); }
    catch { return []; }
  }

  /* --- Produkte cachen, damit window.addToCart synchron läuft --- */
  function ensureProductsCached() {
    try {
      const ap = JSON.parse(localStorage.getItem('allProducts') || '[]');
      if (ap && ap.length) return Promise.resolve();
    } catch (e) { /* ignore */ }
    return fetch('../products.json')
      .then(r => r.json())
      .then(p => { localStorage.setItem('allProducts', JSON.stringify(p)); })
      .catch(() => { /* offline → addToCart lädt selbst nach */ });
  }

  /* --- In den Warenkorb (delegiert an app.js, schreibt "cart") --- */
  function doAddToCart(qty) {
    const p = window.product;
    if (!p) return;
    const id = Number(p.id);

    if (typeof window.addProductToCart === 'function') {
      // addProductToCart(productsParam, productId) ist die kanonische app.js-Funktion:
      // sie liest die Farbe selbst via window.getSelectedColor() und schreibt in "cart".
      // (window.addToCart wird von color-cart-bridge.js überschrieben und erwartet ein
      //  Objekt — daher rufen wir die rohe Funktion direkt auf.)
      // Den blauen Standard-Alert unterdrücken — wir zeigen den eigenen Toast.
      const origAlert = window.showAlert;
      window.showAlert = function () {};
      try {
        for (let i = 0; i < qty; i++) { window.addProductToCart([], id); }
      } finally {
        window.showAlert = origAlert;
      }
    } else {
      // Fallback: direkt in "cart" schreiben (ohne Farbe)
      const cart = readCart();
      const existing = cart.find(i => Number(i.id) === id && !i.selectedColor);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + qty;
      } else {
        cart.push({
          id: p.id, name: p.name, price: p.price, image: p.image,
          slug: p.slug || '', quantity: qty, cartItemId: id + '-no-color'
        });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
    }

    updateCartBadge();
    setTimeout(updateCartBadge, 150);
    setTimeout(updateCartBadge, 500);
    showNotif('✓ Zum Warenkorb hinzugefügt');
    showPurchaseToast();
  }

  function addToCartAction(qty) {
    qty = Math.max(1, qty || 1);
    ensureProductsCached().then(() => doAddToCart(qty));
  }
  window.addToCartAction = addToCartAction;

  /* --- Wunschliste (schreibt "wishlist", Shape wie app.js) --- */
  function syncWishlistBtn() {
    const p = window.product;
    if (!p) return;
    const btn = document.getElementById('wishlistBtn') || document.querySelector('.pp-wish-btn');
    if (!btn) return;
    if (readWishlist().some(i => Number(i.id) === Number(p.id))) {
      btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
      btn.style.color = '#f472b6';
    } else {
      btn.innerHTML = '<i class="bi bi-heart"></i>';
      btn.style.color = '';
    }
  }

  function toggleWishlistAction() {
    const p = window.product;
    if (!p) return;
    const w = readWishlist();
    const idx = w.findIndex(i => Number(i.id) === Number(p.id));
    const btn = document.getElementById('wishlistBtn') || document.querySelector('.pp-wish-btn');
    if (idx >= 0) {
      w.splice(idx, 1);
      localStorage.setItem('wishlist', JSON.stringify(w));
      showNotif('Von Wunschliste entfernt');
      if (btn) { btn.innerHTML = '<i class="bi bi-heart"></i>'; btn.style.color = ''; }
    } else {
      w.push({
        id: p.id, name: p.name, price: p.price,
        image: p.image, description: p.description || ''
      });
      localStorage.setItem('wishlist', JSON.stringify(w));
      showNotif('❤ Zur Wunschliste hinzugefügt');
      if (btn) { btn.innerHTML = '<i class="bi bi-heart-fill"></i>'; btn.style.color = '#f472b6'; }
    }
  }
  window.toggleWishlistAction = toggleWishlistAction;

  /* --- Mengen-Steuerung --- */
  function getQtyValue() {
    const input = document.getElementById('pp-qty') || document.querySelector('.pp-qty-input');
    return input ? Math.max(1, parseInt(input.value, 10) || 1) : 1;
  }
  function initQty() {
    const input = document.getElementById('pp-qty') || document.querySelector('.pp-qty-input');
    const plus  = document.getElementById('pp-qty-plus');
    const minus = document.getElementById('pp-qty-minus');
    if (!input) return;
    if (plus)  plus.addEventListener('click', () => { input.value = getQtyValue() + 1; });
    if (minus) minus.addEventListener('click', () => { input.value = Math.max(1, getQtyValue() - 1); });
    input.addEventListener('change', () => { if (getQtyValue() < 1) input.value = 1; });
  }

  /* --- Button-Bindung --- */
  function bindButtons() {
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) cartBtn.addEventListener('click', () => addToCartAction(getQtyValue()));

    const wishBtn = document.getElementById('wishlistBtn') || document.querySelector('.pp-wish-btn');
    if (wishBtn) wishBtn.addEventListener('click', toggleWishlistAction);
  }

  /* --- Sticky Buy Bar --- */
  function initStickyBar() {
    const bar = document.getElementById('pp-sticky');
    if (!bar) return;
    const anchor = document.querySelector('.pp-buybox') || document.querySelector('.pp-hero');
    const stickyBtn = bar.querySelector('.pp-sticky-btn');
    if (stickyBtn) stickyBtn.addEventListener('click', () => addToCartAction(getQtyValue()));

    if (!anchor || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => bar.classList.toggle('pp-sticky-show', !e.isIntersecting));
    }, { rootMargin: '0px 0px -80px 0px' });
    obs.observe(anchor);
  }

  /* --- Kauf-Toast --- */
  function showPurchaseToast() {
    const toast = document.getElementById('pp-toast');
    if (!toast) return;
    toast.classList.add('pp-toast-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('pp-toast-show'), 4500);
  }
  window.showPurchaseToast = showPurchaseToast;

  /* --- Bundles (Fallback, falls bundle-images-final.js nicht greift) --- */
  function renderBundles(bundles) {
    const section = document.getElementById('bundle-section');
    if (!section) return;
    if (!bundles || !bundles.length) { section.style.display = 'none'; return; }

    const p = window.product;
    const einzelpreis = p ? p.price : 0;

    const html = bundles.map((b, i) => {
      const totalPrice = (einzelpreis * b.quantity + (b.extraCost || 0)).toFixed(2);
      const saving = b.saving ? `${b.saving}` : '';
      return `
      <div class="bundle-card${i === 0 ? ' selected' : ''}" onclick="selectBundle(${i})">
        <input class="bundle-radio" type="radio" name="bundle" ${i === 0 ? 'checked' : ''}>
        <div class="bundle-info">
          <div class="bundle-title">${b.title || b.quantity + 'x ' + (p ? p.name : '')}</div>
          <div class="bundle-prices">€${totalPrice}</div>
          ${saving ? `<div class="bundle-total bundle-savings">Du sparst ${saving}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    section.innerHTML = `
      <div class="bundle-box">
        <div class="bundle-header">🎁 SPARANGEBOTE</div>
        ${html}
        <button class="bundle-add-btn" onclick="addBundleToCart()">
          <i class="bi bi-bag-plus-fill"></i> Bundle in den Warenkorb
        </button>
      </div>`;
    section.style.display = '';
  }
  window.renderBundles = renderBundles;

  window.selectBundle = function (idx) {
    document.querySelectorAll('.bundle-card').forEach((c, i) => {
      c.classList.toggle('selected', i === idx);
      const r = c.querySelector('.bundle-radio');
      if (r) r.checked = (i === idx);
    });
  };

  window.addBundleToCart = function () {
    const card = document.querySelector('.bundle-card.selected');
    if (!card) return;
    const price = card.querySelector('.bundle-prices')?.textContent?.replace('€', '').trim();
    const title = card.querySelector('.bundle-title')?.textContent?.trim();
    const p = window.product;
    if (!p) return;
    const cart = readCart();
    cart.push({
      id: p.id,
      name: title || p.name,
      price: parseFloat(price) || p.price,
      image: p.image,
      slug: p.slug || '',
      quantity: 1,
      isBundle: true,
      cartItemId: p.id + '-bundle-' + Date.now()
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    showNotif('✓ Bundle zum Warenkorb hinzugefügt');
    showPurchaseToast();
  };

  /* --- Init --- */
  document.addEventListener('DOMContentLoaded', function () {
    initCountdown();
    initViewers();
    initQty();
    bindButtons();
    initStickyBar();
    updateCartBadge();
    syncWishlistBtn();
    ensureProductsCached();      // Cache vorwärmen → schneller, synchroner Add
  });

})();
