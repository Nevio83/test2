/* @ds-bundle: {"format":3,"namespace":"MaiosDesignSystem_05e945","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"PriceTag","sourcePath":"components/feedback/PriceTag.jsx"},{"name":"ColorSwatch","sourcePath":"components/forms/ColorSwatch.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"CategoryTab","sourcePath":"components/navigation/CategoryTab.jsx"},{"name":"GlassCard","sourcePath":"components/surfaces/GlassCard.jsx"},{"name":"ProductCard","sourcePath":"components/surfaces/ProductCard.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"6524846de8bc","components/actions/IconButton.jsx":"bc1bcd596951","components/feedback/Badge.jsx":"1855d308d723","components/feedback/PriceTag.jsx":"c08302c650dc","components/forms/ColorSwatch.jsx":"db9dcc0db7b5","components/forms/Input.jsx":"b60d5e2733f5","components/navigation/CategoryTab.jsx":"212c1678e2f1","components/surfaces/GlassCard.jsx":"054d711b0d2c","components/surfaces/ProductCard.jsx":"53a6dc05d311","ui_kits/storefront/data.js":"b29e0e681f5e","ui_kits/storefront/parts.jsx":"ad92a7079741"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MaiosDesignSystem_05e945 = window.MaiosDesignSystem_05e945 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Maios Button — the storefront's primary call-to-action.
 * White pill with a violet neon glow by default; ghost, neon-gradient,
 * and danger variants round out the set. Renders as <button> or, when
 * `href` is set, as <a>.
 */
function Button({
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  fullWidth = false,
  href,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const cls = ['maios-btn', `maios-btn--${variant}`, `maios-btn--${size}`, fullWidth ? 'maios-btn--full' : '', className].filter(Boolean).join(' ');
  const inner = /*#__PURE__*/React.createElement(React.Fragment, null, icon ? /*#__PURE__*/React.createElement("i", {
    className: `maios-btn__icon bi ${icon}`,
    "aria-hidden": "true"
  }) : null, children ? /*#__PURE__*/React.createElement("span", null, children) : null, iconRight ? /*#__PURE__*/React.createElement("i", {
    className: `maios-btn__icon bi ${iconRight}`,
    "aria-hidden": "true"
  }) : null);
  if (href && !disabled) {
    return /*#__PURE__*/React.createElement("a", _extends({
      href: href,
      className: cls
    }, rest), inner);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    disabled: disabled,
    "aria-disabled": disabled || undefined
  }, rest), inner);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Maios IconButton — round, ghost icon control used across the nav
 * (search, wishlist, cart, menu). Optional notification count bubble.
 */
function IconButton({
  icon,
  label,
  count,
  variant = 'ghost',
  className = '',
  ...rest
}) {
  const cls = ['maios-icon-btn', variant === 'solid' ? 'maios-icon-btn--solid' : '', variant === 'accent' ? 'maios-icon-btn--accent' : '', className].filter(Boolean).join(' ');
  const showCount = count !== undefined && count !== null && count !== 0;
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    "aria-label": label
  }, rest), /*#__PURE__*/React.createElement("i", {
    className: `bi ${icon}`,
    "aria-hidden": "true"
  }), showCount ? /*#__PURE__*/React.createElement("span", {
    className: "maios-icon-btn__count"
  }, count) : null);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Maios Badge — small pill for status/eyebrow labels. Defaults to the
 * "live" style with a pulsing neon-green dot (as in the hero's
 * "New Collection Dropped"). Sale, neon, success and solid variants too.
 */
function Badge({
  variant = 'default',
  dot = false,
  pulse = false,
  className = '',
  children,
  ...rest
}) {
  const cls = ['maios-badge', variant !== 'default' ? `maios-badge--${variant}` : '', pulse ? 'maios-badge--pulse' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    className: "maios-badge__dot",
    "aria-hidden": "true"
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/PriceTag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Formats a number as EUR the way the storefront does: "€28.99". */
function euro(value) {
  if (typeof value === 'number') return '€' + value.toFixed(2);
  return value;
}

/**
 * Maios PriceTag — current price with optional struck-through original
 * and an auto-computed discount pill. Currency is EUR by convention.
 */
function PriceTag({
  price,
  original,
  size = 'md',
  showDiscount = true,
  className = '',
  ...rest
}) {
  const cls = ['maios-price', size !== 'md' ? `maios-price--${size}` : '', className].filter(Boolean).join(' ');
  let off = null;
  if (showDiscount && typeof price === 'number' && typeof original === 'number' && original > price) {
    off = Math.round((1 - price / original) * 100);
  }
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "maios-price__now"
  }, euro(price)), original ? /*#__PURE__*/React.createElement("span", {
    className: "maios-price__was"
  }, euro(original)) : null, off ? /*#__PURE__*/React.createElement("span", {
    className: "maios-price__off"
  }, "\u2212", off, "%") : null);
}
Object.assign(__ds_scope, { PriceTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/PriceTag.jsx", error: String((e && e.message) || e) }); }

// components/forms/ColorSwatch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Maios ColorSwatch — accessible color/variant picker (radiogroup) matching
 * the product model's `colors: [{ name, code }]`. Selected swatch gets the
 * white double-ring. Optionally prints the active color name.
 */
function ColorSwatch({
  colors = [],
  value,
  onChange,
  showName = false,
  className = '',
  ...rest
}) {
  const cls = ['maios-swatch-group', className].filter(Boolean).join(' ');
  const selected = value ?? (colors[0] && colors[0].name);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    role: "radiogroup"
  }, rest), colors.map(c => {
    const isSel = c.name === selected;
    return /*#__PURE__*/React.createElement("button", {
      key: c.name,
      type: "button",
      role: "radio",
      "aria-checked": isSel,
      "aria-label": c.name,
      title: c.name,
      className: "maios-swatch",
      style: {
        background: c.code
      },
      onClick: () => onChange && onChange(c.name)
    });
  }), showName && selected ? /*#__PURE__*/React.createElement("span", {
    className: "maios-swatch__name"
  }, selected) : null);
}
Object.assign(__ds_scope, { ColorSwatch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/ColorSwatch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Maios Input — dark pill text field with an optional leading icon, as used
 * in the fullscreen search ("Wonach suchst du?"). Focus lights the violet
 * border + neon glow.
 */
function Input({
  icon,
  square = false,
  className = '',
  ...rest
}) {
  const inputCls = ['maios-input', icon ? 'maios-input--icon' : '', square ? 'maios-input--square' : '', className].filter(Boolean).join(' ');
  const field = /*#__PURE__*/React.createElement("input", _extends({
    className: inputCls
  }, rest));
  if (!icon) return field;
  return /*#__PURE__*/React.createElement("span", {
    className: "maios-field"
  }, /*#__PURE__*/React.createElement("i", {
    className: `maios-field__icon bi ${icon}`,
    "aria-hidden": "true"
  }), field);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/navigation/CategoryTab.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Maios CategoryTab — pill tab with a leading icon, used for the storefront's
 * category filter ("Alle Kategorien", "Technik/Gadgets", …). Active tab fills
 * with the violet→cyan gradient. Renders as <a> when `href` is given.
 */
function CategoryTab({
  icon,
  active = false,
  href,
  className = '',
  children,
  ...rest
}) {
  const cls = ['maios-tab', className].filter(Boolean).join(' ');
  const inner = /*#__PURE__*/React.createElement(React.Fragment, null, icon ? /*#__PURE__*/React.createElement("i", {
    className: `bi ${icon}`,
    "aria-hidden": "true"
  }) : null, /*#__PURE__*/React.createElement("span", null, children));
  if (href) {
    return /*#__PURE__*/React.createElement("a", _extends({
      className: cls,
      href: href,
      role: "tab",
      "aria-selected": active
    }, rest), inner);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    type: "button",
    role: "tab",
    "aria-selected": active
  }, rest), inner);
}
Object.assign(__ds_scope, { CategoryTab });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/CategoryTab.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/GlassCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Maios GlassCard — frosted glass panel over near-black, the brand's
 * core container (bento info cards, dropdowns, feature tiles).
 */
function GlassCard({
  hover = false,
  dashed = false,
  glow = false,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) {
  const cls = ['maios-card', hover ? 'maios-card--hover' : '', dashed ? 'maios-card--dashed' : '', glow ? 'maios-card--glow' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { GlassCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/GlassCard.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/ProductCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function euro(value) {
  if (typeof value === 'number') return '€' + value.toFixed(2);
  return value;
}

/**
 * Maios ProductCard — the storefront's catalog tile. Dark glass card with
 * a square media well, wishlist heart, category eyebrow, price (with sale
 * math) and a full-width add-to-cart button. Composes the same class
 * vocabulary as PriceTag and Button so it stays self-contained.
 */
function ProductCard({
  image,
  title,
  description,
  category,
  price,
  original,
  badge,
  wishlisted = false,
  ctaLabel = 'In den Warenkorb',
  onAddToCart,
  onToggleWish,
  className = '',
  ...rest
}) {
  const cls = ['maios-product', className].filter(Boolean).join(' ');
  let off = null;
  if (typeof price === 'number' && typeof original === 'number' && original > price) {
    off = Math.round((1 - price / original) * 100);
  }
  return /*#__PURE__*/React.createElement("article", _extends({
    className: cls
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "maios-product__media"
  }, /*#__PURE__*/React.createElement("img", {
    className: "maios-product__img",
    src: image,
    alt: title,
    loading: "lazy"
  }), badge ? /*#__PURE__*/React.createElement("span", {
    className: "maios-product__tag maios-badge maios-badge--sale"
  }, badge) : null, /*#__PURE__*/React.createElement("button", {
    className: "maios-product__wish",
    "aria-label": wishlisted ? 'Von Wunschliste entfernen' : 'Zur Wunschliste hinzufügen',
    "aria-pressed": wishlisted,
    onClick: onToggleWish,
    type: "button"
  }, /*#__PURE__*/React.createElement("i", {
    className: `bi ${wishlisted ? 'bi-heart-fill' : 'bi-heart'}`,
    "aria-hidden": "true"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "maios-product__body"
  }, category ? /*#__PURE__*/React.createElement("span", {
    className: "maios-product__cat"
  }, category) : null, /*#__PURE__*/React.createElement("h3", {
    className: "maios-product__title"
  }, title), description ? /*#__PURE__*/React.createElement("p", {
    className: "maios-product__desc"
  }, description) : null, /*#__PURE__*/React.createElement("div", {
    className: "maios-product__foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "maios-price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "maios-price__now"
  }, euro(price)), original ? /*#__PURE__*/React.createElement("span", {
    className: "maios-price__was"
  }, euro(original)) : null, off ? /*#__PURE__*/React.createElement("span", {
    className: "maios-price__off"
  }, "\u2212", off, "%") : null)), /*#__PURE__*/React.createElement("button", {
    className: "maios-btn maios-btn--primary maios-btn--md maios-btn--full",
    onClick: onAddToCart,
    type: "button",
    style: {
      marginTop: '0.5rem'
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: "maios-btn__icon bi bi-bag-plus",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", null, ctaLabel))));
}
Object.assign(__ds_scope, { ProductCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/ProductCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/storefront/data.js
try { (() => {
/* Maios Storefront UI kit — curated catalog sample.
   Prices/categories mirror Marketing/products.json; images are the
   copied product shots in /assets/products. Exposes window.MAIOS_DATA. */
(function () {
  const P = '../../assets/products/';
  const categories = [{
    id: 'alle',
    label: 'Alle Kategorien',
    icon: 'bi-grid-3x3-gap'
  }, {
    id: 'Technik/Gadgets',
    label: 'Technik/Gadgets',
    icon: 'bi-cpu',
    accent: 'var(--cat-technik)'
  }, {
    id: 'Beleuchtung',
    label: 'Beleuchtung',
    icon: 'bi-lightbulb',
    accent: 'var(--cat-licht)'
  }, {
    id: 'Körperpflege/Wellness',
    label: 'Körperpflege/Wellness',
    icon: 'bi-heart-pulse',
    accent: 'var(--cat-wellness)'
  }, {
    id: 'Haushalt und Küche',
    label: 'Haushalt und Küche',
    icon: 'bi-house',
    accent: 'var(--cat-kueche)'
  }];
  const products = [
  // — Technik/Gadgets —
  {
    id: 44,
    name: 'Smart Beamer',
    cat: 'Technik/Gadgets',
    price: 96.99,
    original: 199.99,
    img: P + 'smart-beamer.jpg',
    desc: 'Kompakter tragbarer Projektor mit 180° Projektionswinkel und automatischem Fokus. Perfekt für Filme, Präsentationen und Gaming.',
    bestseller: true,
    shipping: '7–13 Werktage',
    features: ['180° Projektionswinkel', 'Automatischer Fokus', 'HD 1920×1080', 'HDMI · USB · WiFi', 'Kompakt & tragbar']
  }, {
    id: 10,
    name: 'Elektrischer Wasserspender',
    cat: 'Technik/Gadgets',
    price: 28.99,
    original: 69.99,
    img: P + 'wasserspender.jpg',
    desc: 'Automatischer Wasserspender für Gallon-Flaschen. Wiederaufladbar — perfekt für Büro und Zuhause.',
    shipping: '7–13 Werktage',
    colors: [{
      name: 'Schwarz',
      code: '#2C2C2C'
    }, {
      name: 'Weiß',
      code: '#FFFFFF'
    }],
    features: ['USB-wiederaufladbar', 'Für Gallon-Flaschen', 'One-Touch Pumpe', 'Auto-Stopp']
  }, {
    id: 30,
    name: 'Mini Thermal Drucker',
    cat: 'Technik/Gadgets',
    price: 24.99,
    original: 39.99,
    img: P + 'mini-thermal-drucker.jpg',
    desc: 'Kabelloser Thermodrucker für Notizen, Fotos und Listen — direkt vom Smartphone, ganz ohne Tinte.',
    shipping: '7–13 Werktage',
    features: ['Tintenlos', 'Bluetooth', 'App-Steuerung', 'Akkubetrieb']
  }, {
    id: 31,
    name: 'Tragbarer Bluetooth Lautsprecher',
    cat: 'Technik/Gadgets',
    price: 34.99,
    original: 54.99,
    img: P + 'bluetooth-lautsprecher.jpg',
    desc: 'Satter 360°-Sound im kompakten Gehäuse. Spritzwassergeschützt mit langer Akkulaufzeit.',
    shipping: '7–13 Werktage',
    features: ['360° Sound', 'IPX5 wasserfest', '12h Akku', 'Bluetooth 5.3']
  }, {
    id: 32,
    name: 'Klimaanlage mit Display',
    cat: 'Technik/Gadgets',
    price: 39.99,
    original: 79.99,
    img: P + 'klimaanlage-display.jpg',
    desc: 'Mobiler Verdunstungskühler mit Digital-Display. Kühlt, befeuchtet und reinigt die Luft am Schreibtisch.',
    shipping: '7–13 Werktage',
    features: ['3-in-1 Kühlung', 'Digital-Display', 'USB-Betrieb', 'Leiser Modus']
  },
  // — Beleuchtung —
  {
    id: 50,
    name: 'Nordic Crystal Lamp',
    cat: 'Beleuchtung',
    price: 34.99,
    original: 59.99,
    img: P + 'nordic-crystal-lamp.jpg',
    desc: 'Stimmungsvolles Rosenkristall-Licht mit Touch-Dimmer und 16 Farben. Wirft funkelnde Lichtmuster an Wand und Decke.',
    bestseller: true,
    shipping: '7–13 Werktage',
    colors: [{
      name: 'Klar',
      code: '#E8F0FF'
    }, {
      name: 'Grün',
      code: '#43e97b'
    }, {
      name: 'Lila',
      code: '#a855f7'
    }, {
      name: 'Blau',
      code: '#4A90E2'
    }],
    features: ['16 RGB-Farben', 'Touch-Dimmer', 'Rosenkristall-Optik', 'USB-C', 'Timer-Funktion']
  }, {
    id: 51,
    name: 'Krystall Ball Nachtlampe',
    cat: 'Beleuchtung',
    price: 13.99,
    original: 29.99,
    img: P + 'krystall-ball-nachtlampe.jpg',
    desc: '3D-Galaxie-Kristallkugel mit warmem Sockel. Das perfekte Geschenk und Nachtlicht.',
    shipping: '7–13 Werktage',
    features: ['3D-Galaxie-Effekt', 'Holzsockel', 'Warmweiß', 'Geschenkbox']
  }, {
    id: 22,
    name: 'Indoor Sensing Wall Lamp',
    cat: 'Beleuchtung',
    price: 17.99,
    original: 39.99,
    img: P + 'indoor-sensing-wall-lamp.jpg',
    desc: 'Kabellose Wandleuchte mit Bewegungssensor. Magnetische Halterung, aufladbar, ideal für Flur und Treppe.',
    shipping: '7–13 Werktage',
    features: ['Bewegungssensor', 'Magnethalterung', 'Akku', 'Kein Bohren']
  }, {
    id: 23,
    name: 'Sonnen Standlicht',
    cat: 'Beleuchtung',
    price: 29.99,
    original: 49.99,
    img: P + 'sonnen-standlicht.jpg',
    desc: 'Sonnenuntergangs-Projektionslampe für warme, goldene Stimmung. Dreh- und neigbar für den perfekten Winkel.',
    shipping: '7–13 Werktage',
    features: ['Sunset-Projektion', '180° drehbar', 'USB-Betrieb', 'Foto-Liebling']
  },
  // — Haushalt und Küche —
  {
    id: 11,
    name: '350ml Elektrischer Mixer Entsafter',
    cat: 'Haushalt und Küche',
    price: 32.99,
    original: 49.99,
    img: P + 'mixer-entsafter.jpg',
    desc: 'Kompakter Mixer und Entsafter für Smoothies unterwegs. Frische Drinks in 30 Sekunden — ohne Kabel.',
    bestseller: true,
    shipping: '7–13 Werktage',
    colors: [{
      name: 'Weiß',
      code: '#FFFFFF'
    }, {
      name: 'Rosa',
      code: '#FFC0CB'
    }, {
      name: 'Blau',
      code: '#4A90E2'
    }],
    features: ['350 ml Flasche', 'USB-aufladbar', '6 Edelstahlklingen', 'Auto-Clean']
  }, {
    id: 12,
    name: 'Multifunktions Gemüseschneider',
    cat: 'Haushalt und Küche',
    price: 16.99,
    original: 29.99,
    img: P + 'gemueseschneider.jpg',
    desc: 'Schneiden, würfeln, raspeln — ein Gerät, viele Einsätze. Spart Zeit und Tränen in jeder Küche.',
    shipping: '7–13 Werktage',
    features: ['7 Wechselklingen', 'Auffangbehälter', 'Anti-Rutsch', 'Spülmaschinenfest']
  }, {
    id: 13,
    name: 'Tumbler Becher',
    cat: 'Haushalt und Küche',
    price: 19.99,
    original: 29.99,
    img: P + 'tumbler-becher.jpg',
    desc: 'Doppelwandiger Edelstahl-Tumbler. Hält Getränke 24h kalt und 12h heiß — mit Strohhalm.',
    shipping: '7–13 Werktage',
    features: ['Doppelwandig', '24h kalt / 12h heiß', '900 ml', 'Auslaufsicher']
  },
  // — Körperpflege/Wellness —
  {
    id: 60,
    name: 'Gesichtssauna',
    cat: 'Körperpflege/Wellness',
    price: 27.99,
    original: 44.99,
    img: P + 'gesichtssauna.jpg',
    desc: 'Nano-Ionen-Dampfsauna fürs Gesicht. Öffnet die Poren, spendet Feuchtigkeit und macht die Pflegeroutine zum Spa-Moment.',
    shipping: '7–13 Werktage',
    features: ['Nano-Ionen-Dampf', 'Tiefenreinigung', '30s Aufheizen', 'Auto-Abschaltung']
  }, {
    id: 21,
    name: 'Professioneller 5 in 1 Haar Trockner',
    cat: 'Körperpflege/Wellness',
    price: 59.99,
    original: 69.99,
    img: P + 'haartrockner-5in1.jpg',
    desc: 'Multistyler mit fünf Aufsätzen: Föhnen, Locken, Glätten und Volumen — alles in einem Gerät.',
    shipping: '7–13 Werktage',
    colors: [{
      name: 'Roland Purple',
      code: '#8b5cf6'
    }, {
      name: 'Lunar Rock',
      code: '#9ca3af'
    }],
    features: ['5 Aufsätze', 'Ionen-Technologie', 'Coanda-Effekt', 'Hitzeschutz']
  }, {
    id: 17,
    name: 'Elektronischer Premium Jade Stein',
    cat: 'Körperpflege/Wellness',
    price: 22.99,
    original: 39.99,
    img: P + 'jade-stein.jpg',
    desc: 'Beheizter Gua-Sha-Jadestein mit Vibration. Lifting-Massage für Gesicht und Nacken.',
    shipping: '7–13 Werktage',
    features: ['Wärme + Vibration', 'Echter Jade', 'USB-aufladbar', 'Lifting-Massage']
  }, {
    id: 33,
    name: 'Volcanic Flame Aroma Diffuser',
    cat: 'Körperpflege/Wellness',
    price: 28.99,
    original: 49.99,
    img: P + 'volcanic-diffuser.jpg',
    desc: 'Aroma-Diffusor mit realistischer Flammen-Projektion. Befeuchtet die Luft und schafft Lagerfeuer-Stimmung.',
    bestseller: true,
    shipping: '7–13 Werktage',
    features: ['Flammen-Effekt', '200 ml Tank', 'Auto-Stopp', 'Leise']
  }, {
    id: 34,
    name: 'Aroma Öl Diffusor',
    cat: 'Körperpflege/Wellness',
    price: 24.99,
    original: 42.99,
    img: P + 'aroma-oel-diffusor.jpg',
    desc: 'Ultraschall-Diffusor in Holzoptik mit sanftem Ambientelicht. Für ätherische Öle und entspannte Abende.',
    shipping: '7–13 Werktage',
    features: ['Ultraschall', 'Holzoptik', '7 Lichtfarben', 'Timer']
  }, {
    id: 35,
    name: 'Magic ShadowAir Humidifier',
    cat: 'Körperpflege/Wellness',
    price: 34.99,
    original: 54.99,
    img: P + 'magic-shadowair-humidifier.jpg',
    desc: 'Luftbefeuchter mit Sternenhimmel-Projektion. Nebel, Licht und Schatten für ein magisches Schlafzimmer.',
    shipping: '7–13 Werktage',
    features: ['Sternen-Projektion', '300 ml Tank', 'Nachtlicht', 'Flüsterleise']
  }];
  window.MAIOS_DATA = {
    categories,
    products
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/data.js", error: String((e && e.message) || e) }); }

// ui_kits/storefront/parts.jsx
try { (() => {
/* Maios Storefront — shared chrome & hero. Exposes Navbar, Hero,
   FeaturedBento, VisionSection, Footer on window. */
const {
  Button,
  IconButton,
  Badge,
  GlassCard
} = window.MaiosDesignSystem_05e945;

/* ---------------- Navbar ---------------- */
function Navbar({
  cartCount,
  wishCount,
  onNavigate,
  onOpenCart,
  onOpenSearch
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "maios-glass-nav",
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      height: 'var(--nav-height)',
      padding: '0 var(--container-px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("a", {
    onClick: () => onNavigate('home'),
    style: {
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 6,
      fontFamily: 'var(--font-display)',
      fontWeight: 900,
      fontSize: 'var(--text-3xl)',
      letterSpacing: '-0.04em',
      color: '#fff'
    }
  }, "MAIOS", /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--brand-primary)',
      boxShadow: 'var(--shadow-neon)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "maios-navlinks",
    style: {
      display: 'flex',
      gap: 40,
      alignItems: 'center'
    }
  }, ['Featured', 'Products', 'Vision'].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    onClick: () => onNavigate(l === 'Products' ? 'home' : 'home'),
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      color: 'var(--text-secondary)',
      cursor: 'pointer'
    },
    onMouseEnter: e => e.currentTarget.style.color = '#fff',
    onMouseLeave: e => e.currentTarget.style.color = 'var(--text-secondary)'
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "bi-search",
    label: "Suche \xF6ffnen",
    onClick: onOpenSearch
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "bi-heart",
    label: "Wunschliste",
    count: wishCount,
    variant: "accent"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "bi-bag",
    label: "Warenkorb \xF6ffnen",
    count: cartCount,
    variant: "solid",
    onClick: onOpenCart
  }))));
}

/* ---------------- Hero ---------------- */
function Hero({
  onNavigate
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'relative',
      minHeight: 'calc(100vh - var(--nav-height))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: 'var(--bg-base)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--gradient-hero)',
      opacity: 0.6
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "maios-orb",
    style: {
      position: 'absolute',
      top: '22%',
      left: '20%',
      width: 460,
      height: 460,
      background: 'var(--brand-primary)',
      borderRadius: '50%',
      filter: 'blur(120px)',
      opacity: 0.35,
      animation: 'maios-float 6s ease-in-out infinite'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "maios-orb",
    style: {
      position: 'absolute',
      bottom: '18%',
      right: '18%',
      width: 460,
      height: 460,
      background: 'var(--brand-secondary)',
      borderRadius: '50%',
      filter: 'blur(120px)',
      opacity: 0.32,
      animation: 'maios-float 6s ease-in-out infinite',
      animationDelay: '-3s'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      textAlign: 'center',
      padding: '0 24px',
      maxWidth: 900
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 32,
      display: 'inline-block'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    dot: true,
    pulse: true
  }, "New Collection Dropped")), /*#__PURE__*/React.createElement("h1", {
    className: "maios-neon-text",
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      letterSpacing: '-0.05em',
      lineHeight: 0.9,
      fontSize: 'clamp(56px, 9vw, 128px)',
      margin: '0 0 28px',
      color: '#fff'
    }
  }, "Redefine ", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "maios-text-gradient"
  }, "Living.")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-xl)',
      fontWeight: 300,
      lineHeight: 1.6,
      maxWidth: 620,
      margin: '0 auto 48px'
    }
  }, "Discover a curated selection of smart technology and aesthetic home essentials. Designed to elevate your daily rituals to a new standard."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      justifyContent: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "bi-bag",
    onClick: () => onNavigate('home')
  }, "Explore Collection"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    iconRight: "bi-arrow-right",
    onClick: () => onNavigate('vision')
  }, "Our Philosophy"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 36,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      opacity: 0.4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 48,
      background: 'linear-gradient(to bottom, transparent, #fff, transparent)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      letterSpacing: '0.3em',
      textTransform: 'uppercase',
      color: '#fff'
    }
  }, "Scroll")));
}

/* ---------------- Featured bento ---------------- */
function FeaturedBento() {
  const tiles = [{
    icon: 'bi-airplane',
    color: 'var(--brand-primary)',
    glow: 'rgba(139,92,246,.22)',
    h: 'Global Shipping',
    p: 'Fast, tracked delivery worldwide.'
  }, {
    icon: 'bi-shield-check',
    color: 'var(--brand-secondary)',
    glow: 'rgba(34,211,238,.22)',
    h: 'Premium Quality',
    p: 'Verified gadgets & essentials.'
  }, {
    icon: 'bi-arrow-return-left',
    color: 'var(--brand-accent)',
    glow: 'rgba(244,114,182,.22)',
    h: '30 Tage Rückgabe',
    p: 'Kein Risiko, einfache Retoure.'
  }, {
    icon: 'bi-stars',
    color: 'var(--status-warning)',
    glow: 'rgba(255,215,0,.2)',
    h: 'Kuratiert',
    p: 'Nur Produkte, die wir selbst lieben.'
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '96px var(--container-px)',
      background: 'var(--bg-base)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "maios-display",
    style: {
      fontSize: 'var(--text-4xl)',
      textAlign: 'center',
      margin: '0 0 56px',
      color: '#fff'
    }
  }, "Curated For You"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 22
    }
  }, tiles.map(t => /*#__PURE__*/React.createElement(GlassCard, {
    key: t.h,
    hover: true,
    style: {
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 24,
      color: t.color,
      marginBottom: 22,
      background: `radial-gradient(circle at 30% 30%, ${t.glow}, transparent)`
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: `bi ${t.icon}`
  })), /*#__PURE__*/React.createElement("h4", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-xl)',
      margin: '0 0 6px',
      color: '#fff'
    }
  }, t.h), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      margin: 0
    }
  }, t.p))))));
}

/* ---------------- Vision ---------------- */
function VisionSection() {
  return /*#__PURE__*/React.createElement("section", {
    id: "vision",
    style: {
      position: 'relative',
      padding: '128px var(--container-px)',
      background: 'var(--bg-base)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--gradient-hero)',
      opacity: 0.2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      maxWidth: 'var(--container-narrow)',
      margin: '0 auto',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: "bi bi-quote",
    style: {
      fontSize: 56,
      color: 'rgba(139,92,246,.3)',
      display: 'block',
      marginBottom: 24
    }
  }), /*#__PURE__*/React.createElement("h2", {
    className: "maios-display",
    style: {
      fontSize: 'clamp(36px,5vw,60px)',
      margin: '0 0 36px',
      color: '#fff'
    }
  }, "Design meets ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'rgba(255,255,255,.5)'
    }
  }, "Function.")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 300,
      lineHeight: 1.6,
      color: 'var(--text-secondary)',
      margin: '0 0 48px'
    }
  }, "At Maios, we believe the objects you surround yourself with shape your reality. We curate products that blend minimal aesthetics with maximum utility. No clutter. Just essential, beautiful tools for modern living."), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 128,
      height: 4,
      margin: '0 auto',
      borderRadius: 9999,
      background: 'var(--gradient-divider)',
      opacity: 0.5
    }
  })));
}

/* ---------------- Footer ---------------- */
function Footer() {
  const cols = [{
    h: 'Shop',
    items: ['Angebote', 'Neue Produkte', 'Kategorien']
  }, {
    h: 'Support',
    items: ['Kontakt', 'Versand', 'Retouren']
  }];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--bg-footer)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '88px var(--container-px) 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 48
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: 'span 2',
      minWidth: 240
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 'var(--text-3xl)',
      letterSpacing: '-0.03em',
      color: '#fff',
      marginBottom: 20
    }
  }, "MAIOS", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand-primary)'
    }
  }, ".")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      maxWidth: 360,
      fontWeight: 300,
      lineHeight: 1.6,
      margin: '0 0 28px'
    }
  }, "Premium drops, limited editions, and exclusive offers tailored for the modern aesthete. Upgrade your lifestyle."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, ['bi-instagram', 'bi-twitter-x', 'bi-tiktok'].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "maios-glass",
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-secondary)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: `bi ${i}`
  }))))), cols.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.h
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontWeight: 700,
      color: '#fff',
      marginBottom: 24,
      fontSize: 'var(--text-lg)'
    }
  }, c.h), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, c.items.map(it => /*#__PURE__*/React.createElement("li", {
    key: it
  }, /*#__PURE__*/React.createElement("a", {
    style: {
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: 'var(--text-sm)'
    }
  }, it))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      paddingTop: 28,
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, "\xA9 2026 Maios Corporation \xB7 maiosshop.com"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, "Made for modern living."))));
}
Object.assign(window, {
  Navbar,
  Hero,
  FeaturedBento,
  VisionSection,
  Footer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/storefront/parts.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.PriceTag = __ds_scope.PriceTag;

__ds_ns.ColorSwatch = __ds_scope.ColorSwatch;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.CategoryTab = __ds_scope.CategoryTab;

__ds_ns.GlassCard = __ds_scope.GlassCard;

__ds_ns.ProductCard = __ds_scope.ProductCard;

})();
