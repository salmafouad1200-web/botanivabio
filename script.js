// =========================================================
// BOTANIVA BIO — Main JavaScript (Version Sécurisée)
// =========================================================

// --- CONFIGURATION API GLOBALE ---
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' 
  ? 'http://localhost:3000' 
  : '';

document.addEventListener('DOMContentLoaded', () => {

  const Sec = window.BotanivaSecretecurity;
  if (!Sec) {
    console.error('[App] Module de sécurité manquant.');
    // Failsafe minimal si le module sécurité ne charge pas
  }

  // --- ÉLÉMENTS DU DOM ---
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartBadge = document.getElementById('cart-badge');
  const cartItemsWrap = document.getElementById('cart-items-wrap');
  const cartTotal = document.getElementById('cart-total');
  const overlay = document.getElementById('overlay');
  const cartBtn = document.getElementById('cart-btn');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const modalWrap = document.getElementById('modal-wrap');
  const orderBtn = document.getElementById('checkout-open-btn');
  const orderForm = document.getElementById('checkout-form');
  const productGrid = document.querySelector('.product-grid');

  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const searchDropdown = document.getElementById('search-results-dropdown');

  // --- ÉTAT ---
  let cart = [];
  let cachedCities = [];

  // --- RÉCUPÉRATION DES VILLES (AVEC RECHERCHE & FALLBACK) ---
  const MOROCCO_CITIES = [
    "Casablanca", "Rabat", "Fès", "Tanger", "Marrakech", "Salé", "Meknès", "Oujda", "Kenitra", "Agadir",
    "Tétouan", "Temara", "Safi", "Mohammédia", "Khouribga", "El Jadida", "Beni Mellal", "Aït Melloul",
    "Nador", "Dar Bouazza", "Taza", "Settat", "Berrechid", "Khemisset", "Inezgane", "Ksar El Kebir",
    "Larache", "Guelmim", "Khénifra", "Berkane", "Bouskoura", "Al Fqih Ben Salah", "Dakhla", "Sidi Slimane",
    "Errachidia", "Guercif", "Ouarzazate", "Tiznit", "Moulay Abdallah", "Youssoufia", "Martil", "Ain Harrouda",
    "Souk El Arbaa", "Skhirat", "Ifrane", "Taroudant", "Kelaat Sraghna", "Sidi Bennour", "Oued Zem", "Azrou",
    "Tiflet", "Tan-Tan", "Midelt", "Sefrou", "Ouazzane", "Chefchaouen", "Asilah", "Laayoune"
  ];

  async function loadCities() {
    const cityList = document.getElementById('city-list');
    if (!cityList) return;

    // Populate with local fallback first
    cityList.innerHTML = MOROCCO_CITIES.map(c => `<option value="${c}">`).join('');

    try {
      const res = await fetch(`${API_BASE}/cities`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new TypeError("Oops, we haven't got JSON!");
      }
      const data = await res.json();
      const apiCities = Array.isArray(data) ? data : (data.cities || []);

      if (apiCities.length > 0) {
        const names = apiCities.map(c => typeof c === 'string' ? c : (c.name || c.label));
        // Merge and unique
        const combined = [...new Set([...names, ...MOROCCO_CITIES])].sort();
        cityList.innerHTML = combined.map(c => `<option value="${c}">`).join('');
        console.log(`✅ [Cities] ${combined.length} villes chargées.`);
      }
    } catch (e) {
      console.warn('Utilisation des villes par défaut (API inaccessible).', e);
    }
  }
  loadCities();

// Forcer l'application du catalogue avec offres dynamiques
let defaultCatalog = [
  // CORPS
  { id: 1, name: 'Sel de Bain Naturel', category: 'Corps', price: 80, desc: "Sels enrichis en Sel d’Himalaya + Sel d’Epsom. Effet spa à domicile.", img: './assets/products/sel de bain.jpeg', supplier: 'Digylog', productCode: 'SEL-001', supplierName: 'mamahbiba', parfums: ['Relaxant (Verveine & Lavande)', 'Detox (Thé Vert & Menthe Poivrée)', 'Anti-douleurs (Eucalyptus)'], variants: [{ label: '1 pièce', price: 80 }, { label: '3 pièces', price: 200 }, { label: '5 pièces', price: 300 }] },

  { id: 3, name: 'Morrocan Secret', category: 'Corps', price: 130, desc: 'Tberma ancestrale aux plantes rares.', img: './assets/products/Moroccan Secret  Tberma Marocaine Naturelle.jpeg', supplier: 'Digylog', productCode: 'TBER-001', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }, { label: '2 pièces', price: 200 }] },
  { id: 4, name: 'Lux Beldi', category: 'Corps', price: 100, desc: "Savon Noir d'exception infusé au Flio.", img: './assets/products/Lux Beldi Soap Savon Noir Marocain au Flio.jpeg', supplier: 'Digylog', productCode: 'SOAP-002', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 100 }, { label: '2 pièces', price: 160 }] },
  { id: 5, name: 'Pack Promo', category: 'Corps, Packs', price: 180, desc: "Pack Morrocan Secret + Lux Beldi.", img: './assets/products/Gemini_Generated_Image_yzvn1vyzvn1vyzvn.png', supplier: 'Digylog', productCode: 'PACK-003', supplierName: 'mamahbiba', variants: [{ label: 'Pack 1+1', price: 200 }, { label: 'Pack 2+2', price: 350 }] },
  { id: 6, name: 'Sérum Beauté', category: 'Corps', price: 150, desc: "L'élixir anti-taches ultime (White Perle).", img: './assets/products/serum.jpeg', supplier: 'Digylog', productCode: 'SERUM-004', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 150 }, { label: '2 pièces', price: 250 }] },
  { id: 7, name: 'Cristal Musk', category: 'Corps', price: 80, desc: "Musc blanc pur d'une finesse rare.", img: './assets/products/Crystal Musk.jpeg', supplier: 'Digylog', productCode: 'MUSK-005', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 80 }, { label: '3 pièces', price: 200 }] },
  { id: 8, name: 'herbiva', category: 'Cheveux', price: 450, desc: " Huile capillaire naturelle aux herbes indiennes qui nourrit, renforce et stimule la pousse des cheveux.", img: './assets/products/herbiva.jpeg', supplier: 'Digylog', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 450 }, { label: '3 pièces', price: 1200 }] },
  { id: 9, name: 'Royal Scrub', category: 'Pieds', price: 130, desc: "Ce gommage pieds naturel est un soin exfoliant et nourrissant conçu pour redonner douceur et éclat à vos pieds", img: './assets/products/Royal scrub.jpeg', supplier: 'Digylog', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }, { label: '3 pièces', price: 380 }] },
  { id: 10, name: 'Gamme pour les Pieds', category: 'Pieds, Packs', price: 350, oldPrice: 410, desc: "Pack complet : Crème réparatrice, crème éclat rose et gommage exfoliant.", img: './assets/products/produit pied.jpeg', supplier: 'Digylog', supplierName: 'mamahbiba', variants: [{ label: '1 pack', price: 320 }, { label: '2 packs', price: 600 }] },
  { id: 11, name: 'Nature Silk Body Cream', category: 'Corps', price: 130, desc: "Hydratation intense, peau douce et soyeuse, non grasse.", img: './assets/products/Nature Silk Body Cream.jpeg', supplier: 'Digylog', productCode: 'CREAM-001', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }] },
  { id: 12, name: 'Nature Silk Scrub', category: 'Pieds', price: 130, oldPrice: 150, desc: "Gommage exfoliant spécialement conçu pour éliminer les peaux mortes et lisser les rugosités.", img: './assets/products/Nature silk scrub .jpeg', supplier: 'Digylog', productCode: 'SCRUB-001', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }] },
  { id: 13, name: 'Huile Fleur d’Oranger', category: 'Corps, Huiles Parfumées', price: 150, oldPrice: 200, desc: "Huile parfumée corps & cheveux, fraîcheur orangée.", img: './assets/products/perle doranger huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-002', supplierName: 'mamahbiba', parfums: [], variants: [{ label: '1 pièce', price: 150 }] },
  { id: 14, name: 'Baccarat Rouge', category: 'Corps, Huiles Parfumées', price: 180, oldPrice: 200, desc: "Huile parfumée luxueuse, notes riches et chaleureuses.", img: './assets/products/baccarat rouge huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-003', supplierName: 'mamahbiba', parfums: [], variants: [{ label: '1 pièce', price: 180 }] },
  { id: 15, name: 'Libre', category: 'Corps, Huiles Parfumées', price: 180, oldPrice: 200, desc: "Huile parfumée audacieuse, liberté et féminité.", img: './assets/products/libre huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-004', supplierName: 'mamahbiba', parfums: [], variants: [{ label: '1 pièce', price: 180 }] },
  { id: 16, name: 'La Vie Est Belle', category: 'Corps, Huiles Parfumées', price: 180, oldPrice: 200, desc: "Huile parfumée douce, éclatante et féminine.", img: './assets/products/belle essence huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-005', supplierName: 'mamahbiba', parfums: [], variants: [{ label: '1 pièce', price: 180 }] },
  { id: 17, name: 'Black Opium', category: 'Corps, Huiles Parfumées', price: 180, oldPrice: 200, desc: "Huile parfumée intense, noir et mystérieux.", img: './assets/products/opium bloom huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-006', supplierName: 'mamahbiba', parfums: [], variants: [{ label: '1 pièce', price: 180 }] },
  { id: 18, name: 'Amirat Arabe', category: 'Corps, Huiles Parfumées', price: 180, oldPrice: 200, desc: "Huile parfumée exquise, notes orientales sophistiquées.", img: './assets/products/amirat arab huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-007', supplierName: 'mamahbiba', parfums: [], variants: [{ label: '1 pièce', price: 180 }] },
  // Gamme Soin des Pieds
  { id: 19, name: 'Foot Repair Elixir', category: 'Pieds', price: 150, oldPrice: 180, desc: "Crème réparatrice intense spécialement formulée pour les pieds très secs et abîmés.", img: './assets/products/fool repaire felexir.jpeg', supplier: 'Digylog', productCode: 'FOOT-001', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 150 }] },
  { id: 20, name: 'Pink Tush', category: 'Pieds', price: 130, oldPrice: 170, desc: "Crème rose réparatrice et embellissante pour hydrater et revitaliser les pieds secs.", img: './assets/products/pink touch.jpeg', supplier: 'Digylog', productCode: 'FOOT-002', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }] }
];
let products = defaultCatalog;
if (Sec) Sec.safeSetStorage('botaniva_catalog', products);

const siteContent = Sec ? Sec.safeGetStorage('botaniva_content') : null;
if (siteContent) {
  const heroTitle = document.querySelector('.hero-title');
  const aboutText = document.querySelector('.about-text p');
  // Content is sanitized during save, but double escaping is okay or we just use textContent which is safe from XSS.
  if (heroTitle) heroTitle.textContent = siteContent.heroTitle || "Rituel de Beauté Naturel & Élégant";
  if (aboutText) aboutText.textContent = siteContent.aboutText || "Découvrez le secret d'une peau pure...";
}

// --- FONCTIONS DE BASE ---
window.updatePriceDisplay = (id, selectEl) => {
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const price = selectedOption.dataset.price;
  const label = selectedOption.dataset.label;

  const priceDisplay = document.getElementById(`price-display-${id}`);
  if (priceDisplay) priceDisplay.innerText = `${price} MAD`;

  // Update data properties of add to cart button
  const btn = document.getElementById(`btn-add-${id}`);
  if (btn) {
    btn.dataset.price = price;
    btn.dataset.variantLabel = label;
  }
};

const openCart = () => { cartSidebar.classList.add('active'); overlay.classList.add('active'); document.body.style.overflow = 'hidden'; };
const closeCart = () => { cartSidebar.classList.remove('active'); overlay.classList.remove('active'); document.body.style.overflow = ''; };

// --- GESTION DE LA RECHERCHE ---
const performSearch = () => {
  const rawQuery = searchInput.value;
  const query = (Sec ? Sec.escapeHTML(rawQuery) : rawQuery).toLowerCase().trim();
  searchDropdown.classList.remove('active');

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.desc.toLowerCase().includes(query)
  );

  renderCatalog(filtered);

  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  if (query === "") renderCatalog(products);
};

searchBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  performSearch();
});

searchInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});

searchInput?.addEventListener('input', (e) => {
  const rawQuery = e.target.value;
  const query = (Sec ? Sec.escapeHTML(rawQuery) : rawQuery).toLowerCase().trim();
  if (query.length < 2) { searchDropdown.classList.remove('active'); return; }
  const filtered = products.filter(p => p.name.toLowerCase().includes(query)).slice(0, 5);
  renderSearchSuggestions(filtered);
});

function renderSearchSuggestions(results) {
  if (!searchDropdown) return;
  searchDropdown.innerHTML = '';
  if (results.length === 0) return;
  searchDropdown.classList.add('active');
  results.forEach(p => {
    const div = document.createElement('div');
    div.className = 'search-item';
    // Utilisation d'échappement XSS pour l'affichage dynamique
    const safeImg = Sec ? Sec.sanitizeUrl(p.img) : p.img;
    const safeName = Sec ? Sec.escapeHTML(p.name) : p.name;
    const safePrice = Number(p.price);

    div.innerHTML = `<img src="${safeImg}" alt="img"> <div class="search-item-info"><h4>${safeName}</h4><p>${safePrice} MAD</p></div>`;
    div.onclick = () => { searchInput.value = safeName; performSearch(); };
    searchDropdown.appendChild(div);
  });
}

// --- RENDU DU CATALOGUE (DYNAMIQUE) ---
const renderCatalog = (data = products) => {
  if (!productGrid) return;
  if (data.length === 0) {
    productGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color:#888;"><h3>Aucun produit trouvé</h3><p>Essayez un autre mot-clé.</p></div>';
    return;
  }
  productGrid.innerHTML = data.map(p => {
    const safeImg = Sec ? Sec.sanitizeUrl(p.img) : p.img;
    const safeVideo = Sec && p.video ? Sec.sanitizeUrl(p.video) : p.video;
    const safeName = Sec ? Sec.escapeHTML(p.name) : p.name;
    const safeDesc = Sec ? Sec.escapeHTML(p.desc) : p.desc;
    const id = Number(p.id);

    let variantSelectHTML = '';
    let initialPrice = Number(p.price);
    let initialVariantLabel = '';
    if (p.variants && p.variants.length > 0) {
      initialPrice = Number(p.variants[0].price);
      initialVariantLabel = Sec ? Sec.escapeHTML(p.variants[0].label) : p.variants[0].label;
      let options = p.variants.map((v, i) => {
        let safeLabel = Sec ? Sec.escapeHTML(v.label) : v.label;
        return `<option value="${i}" data-price="${v.price}" data-label="${safeLabel}">${safeLabel} - ${v.price} MAD</option>`;
      }).join('');
      variantSelectHTML = `<select class="product-variant-select" onclick="event.stopPropagation()" onchange="updatePriceDisplay(${id}, this)" style="margin-bottom: 1rem; width: 100%; padding: 0.8rem; border: 1px solid var(--c-sand); border-radius: 8px; background: rgba(255,255,255,0.8); backdrop-filter: blur(5px); font-family: inherit; font-size: 0.95rem; color: #333; outline: none; transition: all 0.3s ease; cursor: pointer; display: block;">${options}</select>`;
    }

    let parfumSelectHTML = '';
    if (p.parfums && p.parfums.length > 0) {
      let options = p.parfums.map(pf => {
        let safePf = Sec ? Sec.escapeHTML(pf) : pf;
        return `<option value="${safePf}">${safePf}</option>`;
      }).join('');
      parfumSelectHTML = `<select class="product-parfum-select" id="parfum-select-${id}" onclick="event.stopPropagation()" style="margin-bottom: 1rem; width: 100%; padding: 0.8rem; border: 1px solid var(--c-sand); border-radius: 8px; background: rgba(255,255,255,0.8); backdrop-filter: blur(5px); font-family: inherit; font-size: 0.95rem; color: #333; outline: none; transition: all 0.3s ease; cursor: pointer; display: block;">${options}</select>`;
    }

    return `
      <article class="product-card reveal visible" onclick="openProductDetail(${id})">
        <div class="product-img-wrap">
          ${safeVideo ? `<video src="${safeVideo}" controls class="product-video" preload="metadata"></video>` : `<img src="${safeImg}" alt="${safeName}" loading="lazy">`}
        </div>
        <div class="product-body">
          <h3 class="product-name">${safeName}</h3>
          <p class="product-desc">${safeDesc.substring(0, 60)}...</p>
          <p class="product-price" id="price-display-${id}">${initialPrice} MAD</p>
          ${variantSelectHTML}
          ${parfumSelectHTML}
          <button class="btn-add-cart" id="btn-add-${id}" onclick="event.stopPropagation(); handleAddToCartBtn(${id})">
            AJOUTER AU PANIER
          </button>
        </div>
      </article>
    `;
  }).join('');
};

// Handler direct pour le bouton ajouter
window.handleAddToCartBtn = (id) => {
  const p = products.find(prod => prod.id == id);
  if (!p) return;

  const variantSelect = document.querySelector(`.product-card[onclick="openProductDetail(${id})"] .product-variant-select`);
  const variantLabel = variantSelect ? variantSelect.options[variantSelect.selectedIndex].dataset.label : (p.variants?.[0]?.label || '');
  const price = variantSelect ? Number(variantSelect.options[variantSelect.selectedIndex].dataset.price) : p.price;

  const parfumSelect = document.getElementById(`parfum-select-${id}`);
  const parfumValue = parfumSelect ? parfumSelect.value : '';

  addToCartManual(p, variantLabel, price, parfumValue);
  const btn = document.getElementById(`btn-add-${id}`);
  if (btn) animateBtn(btn);
};

function addToCartManual(p, variantLabel, price, parfumValue) {
  const rawId = p.id;
  const baseName = Sec ? Sec.escapeHTML(p.name) : p.name;
  const img = Sec ? Sec.sanitizeUrl(p.img) : p.img;

  let finalVariantString = variantLabel;
  if (parfumValue) finalVariantString = finalVariantString ? `${finalVariantString} - Parfum ${parfumValue}` : `Parfum ${parfumValue}`;

  const cartItemId = finalVariantString ? `${rawId}-${finalVariantString}` : rawId;
  const formattedVariantForName = finalVariantString ? finalVariantString.replace(' pièce', ' p').replace(' pièces', ' p') : '';
  const name = formattedVariantForName ? `${baseName} (${formattedVariantForName})` : baseName;

  const existing = cart.find(i => i.cartItemId === cartItemId);
  if (existing) { existing.qty++; } else { cart.push({ id: rawId, cartItemId, name, price, img, qty: 1 }); }
  renderCart(); openCart();
}

// --- DÉTAILS PRODUIT (MODAL) ---
const detailModal = document.getElementById('product-detail-modal');
const detailCloseBtn = document.getElementById('detail-close-btn');

window.openProductDetail = (productId) => {
  const p = products.find(prod => prod.id == productId);
  if (!p) return;

  document.getElementById('detail-name').textContent = p.name;
  document.getElementById('detail-desc').textContent = p.desc;
  const priceEl = document.getElementById('detail-price');
  if (p.oldPrice) {
    const discount = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
    priceEl.innerHTML = `<span class="old-price-detail">${p.oldPrice} MAD</span> <span class="new-price-detail">${p.price} MAD</span> <span class="detail-badge">-${discount}%</span>`;
  } else {
    priceEl.textContent = `${p.price} MAD`;
  }

  const imgWrap = document.getElementById('detail-img-wrap');
  const safeImg = Sec ? Sec.sanitizeUrl(p.img) : p.img;
  const safeVideo = Sec && p.video ? Sec.sanitizeUrl(p.video) : p.video;
  imgWrap.innerHTML = safeVideo
    ? `<video src="${safeVideo}" controls style="width:100%; height:100%;"></video>`
    : `<img src="${safeImg}" alt="${p.name}">`;

  // Variants et Parfums dans la modal
  const varWrap = document.getElementById('detail-variants-wrap');
  varWrap.innerHTML = '';
  if (p.variants && p.variants.length > 0) {
    let options = p.variants.map((v, i) => `<option value="${i}" data-price="${v.price}" data-label="${v.label}">${v.label} - ${v.price} MAD</option>`).join('');
    varWrap.innerHTML = `<label style="display:block; margin-bottom:5px; font-weight:600;">Format:</label><select id="detail-variant-select" onchange="updateDetailPrice(this)" style="width:100%; padding:0.8rem; border:1px solid var(--c-light-border); border-radius:8px; margin-bottom:1rem;">${options}</select>`;
  }

  const parfumWrap = document.getElementById('detail-parfums-wrap');
  parfumWrap.innerHTML = '';
  if (p.parfums && p.parfums.length > 0) {
    let options = p.parfums.map(pf => `<option value="${pf}">${pf}</option>`).join('');
    parfumWrap.innerHTML = `<label style="display:block; margin-bottom:5px; font-weight:600;">Parfum:</label><select id="detail-parfum-select" style="width:100%; padding:0.8rem; border:1px solid var(--c-light-border); border-radius:8px; margin-bottom:1rem;">${options}</select>`;
  }

  // Bouton ajouter dans la modal
  const addBtn = document.getElementById('detail-add-btn');
  addBtn.onclick = () => {
    const varSelect = document.getElementById('detail-variant-select');
    const parSelect = document.getElementById('detail-parfum-select');

    const variantLabel = varSelect ? varSelect.options[varSelect.selectedIndex].dataset.label : '';
    const price = varSelect ? Number(varSelect.options[varSelect.selectedIndex].dataset.price) : p.price;
    const parfum = parSelect ? parSelect.value : '';

    addToCartFromDetail(p, variantLabel, price, parfum);
    closeDetailModal();
  };

  detailModal.classList.add('active');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.updateDetailPrice = (selectEl) => {
  const price = selectEl.options[selectEl.selectedIndex].dataset.price;
  document.getElementById('detail-price').textContent = `${price} MAD`;
};

const closeDetailModal = () => {
  detailModal.classList.remove('active');
  if (!cartSidebar.classList.contains('active')) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
};

detailCloseBtn?.addEventListener('click', closeDetailModal);

function addToCartFromDetail(p, variantLabel, price, parfumValue) {
  const rawId = p.id;
  const baseName = Sec ? Sec.escapeHTML(p.name) : p.name;
  const img = Sec ? Sec.sanitizeUrl(p.img) : p.img;

  let finalVariantString = variantLabel;
  if (parfumValue) finalVariantString = finalVariantString ? `${finalVariantString} - Parfum ${parfumValue}` : `Parfum ${parfumValue}`;

  const cartItemId = finalVariantString ? `${rawId}-${finalVariantString}` : rawId;
  const formattedVariantForName = finalVariantString ? finalVariantString.replace(' pièce', ' p').replace(' pièces', ' p') : '';
  const name = formattedVariantForName ? `${baseName} (${formattedVariantForName})` : baseName;

  const existing = cart.find(i => i.cartItemId === cartItemId);
  if (existing) { existing.qty++; } else { cart.push({ id: rawId, cartItemId, name, price, img, qty: 1 }); }
  renderCart(); openCart();
}

// --- GESTION DES CATÉGORIES ---
const catBtns = document.querySelectorAll('.cat-btn');
catBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    catBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const category = e.target.dataset.category;
    let filtered = products;
    if (category !== 'all') {
      filtered = products.filter(p => p.category.includes(category));
    }
    renderCatalog(filtered);
  });
});

// --- PANIER ET AUTRES ---
document.addEventListener('click', (e) => {
  const target = e.target.closest('.add-to-cart');
  if (target) {
    e.preventDefault();
    const rawId = target.dataset.id;
    const baseName = Sec ? Sec.escapeHTML(target.dataset.name) : target.dataset.name;
    const variantLabel = target.dataset.variantLabel || '';

    const parfumSelect = document.getElementById(`parfum-select-${rawId}`);
    const parfumValue = parfumSelect ? parfumSelect.value : '';

    const price = Number(target.dataset.price);
    const img = Sec ? Sec.sanitizeUrl(target.dataset.img) : target.dataset.img;

    let finalVariantString = variantLabel;
    if (parfumValue) finalVariantString = finalVariantString ? `${finalVariantString} - Parfum ${parfumValue}` : `Parfum ${parfumValue}`;

    const cartItemId = finalVariantString ? `${rawId}-${finalVariantString}` : rawId;
    const formattedVariantForName = finalVariantString ? finalVariantString.replace(' pièce', ' p').replace(' pièces', ' p') : '';
    const name = formattedVariantForName ? `${baseName} (${formattedVariantForName})` : baseName;

    const existing = cart.find(i => i.cartItemId === cartItemId);
    if (existing) { existing.qty++; } else { cart.push({ id: rawId, cartItemId, name, price, img, qty: 1 }); }
    renderCart(); openCart(); animateBtn(target);
  }
  if (!e.target.closest('.search-wrap')) searchDropdown?.classList.remove('active');
});

cartBtn?.addEventListener('click', openCart);
cartCloseBtn?.addEventListener('click', closeCart);

function renderCart() {
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  if (cartBadge) cartBadge.textContent = totalQty;
  if (cartTotal) cartTotal.textContent = `${subtotal + (subtotal > 0 ? 30 : 0)} MAD`;
  if (cart.length === 0) {
    cartItemsWrap.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem;">
          <p class="cart-empty-msg">Votre panier est vide</p>
          <button class="btn-back-modal" onclick="closeCart()" style="margin-top:1.5rem; border-color:var(--c-gold); color:var(--c-bordeaux);">
            CONTINUER LES ACHATS
          </button>
        </div>
      `;
    return;
  }

  cartItemsWrap.innerHTML = cart.map(item => `
        <div class="cart-item">
          <img src="${item.img}" class="cart-item-img" alt="img">
          <div class="cart-item-info">
            <p class="cart-item-name">${item.name}</p>
            <p class="cart-item-price">${item.price} MAD</p>
            <div class="qty-controls">
              <button onclick="changeQty('${item.cartItemId}', -1)">-</button>
              <span>${item.qty}</span>
              <button onclick="changeQty('${item.cartItemId}', 1)">+</button>
            </div>
          </div>
          <button class="cart-item-del" onclick="changeQty('${item.cartItemId}', -${item.qty})"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('');
}

window.changeQty = (cartItemId, delta) => {
  const item = cart.find(i => i.cartItemId === cartItemId);
  if (item) { item.qty += delta; if (item.qty <= 0) cart = cart.filter(i => i.cartItemId !== cartItemId); renderCart(); }
};

function animateBtn(btn) {
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-check"></i> PRODUIT AJOUTÉ';
  btn.style.background = '#1a7f37';
  setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ''; }, 2000);
}

orderBtn?.addEventListener('click', () => { if (cart.length === 0) return; closeCart(); goToStep(1); modalWrap.classList.add('active'); document.body.style.overflow = 'hidden'; });

window.goToStep = (n) => {
  document.querySelectorAll('.modal-step-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`checkout-step-${n}`)?.classList.add('active');
  document.querySelectorAll('.checkout-steps .step').forEach(el => el.classList.remove('active'));
  document.querySelector(`.checkout-steps .step[data-step="${n}"]`)?.classList.add('active');
  if (n === 1) populateModalSummary();
  if (n === 3) populateReviewSummary();
};

// Livraison par défaut
let deliveryFee = 30;
window.updateDelivery = (val, type) => {
  deliveryFee = Number(val) || 30;
  populateModalSummary();
  const opts = document.querySelectorAll('.del-opt');
  opts.forEach(opt => opt.classList.remove('selected'));
  const checkedRadio = document.querySelector(`input[name="delivery"][value="${type.toLowerCase()}"]`);
  if (checkedRadio) checkedRadio.closest('.del-opt').classList.add('selected');
};

// Type de paiement
let paymentMethod = 'cod';
document.querySelectorAll('.pay-opt').forEach(opt => {
  opt.addEventListener('click', function () {
    document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('selected'));
    this.classList.add('selected');
    paymentMethod = this.dataset.pay;
    
  });
});

function populateModalSummary() {
  const modalOrderItems = document.getElementById('modal-order-items');
  if (!modalOrderItems) return;
  modalOrderItems.innerHTML = cart.map(i => `<div class="modal-item-row"><span>${i.name} × ${i.qty}</span><span>${i.price * i.qty} MAD</span></div>`).join('');
  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const subEl = document.getElementById('modal-subtotal');
  const delFeeEl = document.getElementById('modal-delivery-fee');
  const totEl = document.getElementById('modal-total-price');
  if (subEl) subEl.textContent = `${subtotal} MAD`;
  if (delFeeEl) delFeeEl.textContent = `${deliveryFee} MAD`;
  if (totEl) totEl.textContent = `${subtotal + deliveryFee} MAD`;
}

function populateReviewSummary() {
  const reviewEl = document.getElementById('review-summary');
  if (!reviewEl) return;

  const formData = new FormData(orderForm);
  const name = formData.get('name');
  const phone = formData.get('phone');
  const city = document.getElementById('city-search')?.value || '';
  const address = formData.get('address');
  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);

  reviewEl.innerHTML = `
      <div style="background:#fff; border:1px solid #611226; border-radius:8px; padding:1rem; margin-bottom:1rem;">
        <h4 style="color:#611226; margin-bottom:0.8rem; border-bottom:1px solid #eee; padding-bottom:0.5rem;"><i class="fa-solid fa-user-check"></i> VÉRIFICATION DES COORDONNÉES</h4>
        <p style="margin:0.3rem 0;"><strong>Destinataire:</strong> <span style="color:#611226;">${name}</span></p>
        <p style="margin:0.3rem 0;"><strong>Téléphone:</strong> <span style="color:#611226;">${phone}</span></p>
        <p style="margin:0.3rem 0;"><strong>Ville de livraison:</strong> <span style="color:#611226;">${city}</span></p>
        <p style="margin:0.3rem 0;"><strong>Adresse exacte:</strong> <span style="color:#611226;">${address}</span></p>
        <p style="font-size:0.8rem; color:#666; margin-top:0.8rem; font-style:italic;">* Veuillez vérifier que votre numéro est correct pour que le livreur puisse vous appeler.</p>
      </div>
      <div>
        <h4 style="color:#611226; margin-bottom:0.8rem;"><i class="fa-solid fa-bag-shopping"></i> VOTRE COMMANDE</h4>
        ${cart.map(i => `<div style="display:flex; justify-content:between; font-size:0.9rem; margin-bottom:0.4rem; padding-bottom:0.4rem; border-bottom:1px dashed #eee;"><span>${i.name} × ${i.qty}</span><span style="margin-left:auto; font-weight:600;">${i.price * i.qty} MAD</span></div>`).join('')}
        <div style="margin-top:0.8rem; padding-top:0.8rem; font-weight:700; display:flex; font-size:1.1rem; color:#611226;">
          <span>TOTAL FINAL:</span>
          <span style="margin-left:auto;">${subtotal + deliveryFee} MAD</span>
        </div>
      </div>
    `;
}

// Handle newsletter dynamically created in index.html to avoid inject eval
window.handleNewsletter = (e) => {
  e.preventDefault();
  const form = e.target;
  // Simulate API request or safe handling
  form.innerHTML = '<p style="color:var(--c-bordeaux);font-weight:500;">Merci pour votre inscription ! 💌</p>';
};

// --- INTÉGRATION DIGYLOG API (VIA BACKEND) ---
async function sendOrderToDigylog(orderData) {
  const backendUrl = `${API_BASE}/create-order`;

  try {
    console.log('🚀 [Digylog] Envoi de la commande...', JSON.stringify(orderData));

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Erreur serveur (HTTP ${response.status})`);
    }

    const result = await response.json();
    console.log('🔍 [Digylog] Réponse brute:', JSON.stringify(result));

    if (!response.ok) throw new Error(result.error || 'Erreur du serveur backend');
    console.log('✅ [Digylog] Succès:', result);
    return result;
  } catch (error) {
    console.error('❌ [Digylog] Erreur fatale:', error.message);
    throw error;
  }
}

let pendingOrderData = null;

orderForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const formData = new FormData(orderForm);

  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  pendingOrderData = {
    nom_complet: formData.get('name'),
    telephone: formData.get('phone'),
    ville: document.getElementById('city-search')?.value || '',
    adresse: formData.get('address'),
    produit: cart.map(i => i.name).join(', '),
    quantite: cart.reduce((s, i) => s + i.qty, 0),
    prix: subtotal + deliveryFee,
    frais_livraison: deliveryFee,
    mode_paiement: paymentMethod,
    items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    note: ""
  };

  if (!pendingOrderData.nom_complet || !pendingOrderData.telephone || !pendingOrderData.ville || !pendingOrderData.adresse) {
    alert("Veuillez remplir tous les champs obligatoires.");
    return;
  }

  if (Sec && !Sec.validatePhone(pendingOrderData.telephone)) {
    alert("Le numéro de téléphone semble invalide. Utilisez un format comme 06XXXXXXXX.");
    return;
  }

  try {
    const blackCheck = await fetch(`${API_BASE}/blacklist/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones: [pendingOrderData.telephone] })
    });
    if (blackCheck.ok) {
      const blackResult = await blackCheck.json();
      if (Array.isArray(blackResult) && blackResult[0]?.blacklisted) {
        pendingOrderData.note = "⚠️ Numéro sur liste noire Digylog";
      }
    }
  } catch (e) {
    console.error('Blacklist error:', e);
  }

  goToStep(3);
});

window.submitFinalOrder = async () => {
  const btn = document.getElementById('final-confirm-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traitement en cours...';

  try {
    // Sauvegarde locale
    const localOrder = {
      id: 'BOT-' + Date.now(),
      date: new Date().toLocaleDateString('fr-FR'),
      ...pendingOrderData,
      status: 'En attente'
    };

    if (Sec) {
      const existingOrders = Sec.safeGetStorage('botaniva_orders') || [];
      existingOrders.push(localOrder);
      Sec.safeSetStorage('botaniva_orders', existingOrders);
    }

    // Envoi Digylog
    await sendOrderToDigylog(pendingOrderData);

    goToStep(4);
    const successStep = document.getElementById('checkout-step-4');
    if (successStep) {
      successStep.innerHTML = `
          <div style="text-align:center; padding:2rem 0;">
            <div style="font-size:4rem; color:#611226; margin-bottom:1.5rem;">&#10003;</div>
            <h2 style="font-size:2rem; color:#611226;">Commande confirmée !</h2>
            <p>Merci ${pendingOrderData.nom_complet}. Votre commande est en cours de traitement.</p>
            <button class="btn-checkout" onclick="location.reload()" style="margin-top:2rem; max-width:200px; margin-inline:auto;">Retour à l'accueil</button>
          </div>`;
    }
    cart = []; renderCart();
  } catch (err) {
    alert(`Désolé, une erreur est survenue : ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Réessayer';
  }
};

// --- INFLUENCERS ---
const renderInfluencers = () => {
  const grid = document.getElementById('influencers-grid');
  if (!grid) return;

  // Default videos fallback
  const defaultVideos = [
    { url: './assets/videos/WhatsApp Video 2026-04-22 at 10.55.04.mp4', title: 'Rituel Hammam complet', author: 'Par @Sarah_Beauty' },
    { url: './assets/videos/promo2.mp4', title: 'Mon avis sur le Savon Beldi', author: 'Par @Lina_Style' },
    { url: './assets/videos/promo3.mp4', title: 'Routine éclat au Sérum', author: 'Par @Meryem_Glow' },
    { url: './assets/videos/promo4.mp4', title: 'Fraîcheur du Musc', author: 'Par @Ines_Beauté' }
  ];

  let videos = Sec ? Sec.safeGetStorage('botaniva_influencers') : null;
  if (!videos || !Array.isArray(videos) || videos.length === 0) {
    videos = defaultVideos;
  }

  grid.innerHTML = videos.map(v => {
    // Nettoyer d'éventuels chemins absolus si copiés/collés par erreur depuis Windows
    let rawUrl = v.url || '';
    rawUrl = rawUrl.replace(/^.*botaniva_bio[\\/]/i, '');

    const safeUrl = Sec ? Sec.sanitizeUrl(rawUrl) : rawUrl;
    const safeTitle = Sec ? Sec.escapeHTML(v.title) : v.title;
    const safeAuthor = Sec ? Sec.escapeHTML(v.author) : v.author;

    let mediaHtml = '';
    if (safeUrl.includes('youtube.com') || safeUrl.includes('youtu.be')) {
      let embedUrl = safeUrl;
      if (embedUrl.includes('youtube.com/watch?v=')) {
        embedUrl = embedUrl.replace('youtube.com/watch?v=', 'youtube.com/embed/');
        embedUrl = embedUrl.split('&')[0];
      } else if (embedUrl.includes('youtu.be/')) {
        embedUrl = embedUrl.replace('youtu.be/', 'youtube.com/embed/');
        embedUrl = embedUrl.split('?')[0];
      }
      mediaHtml = `<iframe src="${embedUrl}?controls=1&mute=0" title="${safeTitle}" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      mediaHtml = `<video src="${safeUrl}" playsinline controls></video>`;
    }

    return `
      <div class="video-card reveal visible">
        <div class="video-wrapper">
          ${mediaHtml}
        </div>
      </div>
      `;
  }).join('');
};

renderCatalog();
renderCart();
renderInfluencers();
});
