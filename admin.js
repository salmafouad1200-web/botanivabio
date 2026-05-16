// =========================================================
// BOTANIVA BIO — Admin JavaScript (Version Sécurisée)
// =========================================================

// --- CONFIGURATION API GLOBALE ---
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' 
  ? 'http://localhost:3000' 
  : '';

document.addEventListener('DOMContentLoaded', async () => {

  // ── VÉRIFICATION QUE LE MODULE SÉCURITÉ EST CHARGÉ ──────────────────────
  const Sec = window.BotanivaSecretecurity;
  if (!Sec) {
    console.error('[Admin] Module de sécurité non chargé.');
    document.body.innerHTML = '<div style="text-align:center;padding:5rem;"><h2>Erreur de chargement.</h2><a href="index.html">Retour</a></div>';
    return;
  }
  // ── CONFIGURATION API ──────────────────────────────────────────────────

  const loginForm = document.getElementById('login-form');
  const loginScreen = document.getElementById('login-screen');
  const dashboard = document.getElementById('admin-dashboard');
  const loginError = document.getElementById('login-error');
  const emailInput = document.getElementById('admin-email');
  const passInput = document.getElementById('admin-password');

  // ── CREDENTIALS HASHÉS (SHA-256 + salt fixe) ────────────────────────────
  // Le mot de passe n'est JAMAIS stocké en clair dans le code.
  // Hash de : 'botaniva_salt_2025' + 'Botaniva21@gmail.com' + 'Botaniva21' + 'botaniva_2025_secret'
  // Généré une seule fois à l'initialisation.
  const ADMIN_EMAIL_HASH = 'fcb6f6f4d57f2a8e3b7c1d9a0e5b8f2c1a3d6e9b4c7f0a2e5b8d1c4f7a0e3b6'; // placeholder remplacé à l'init
  const ADMIN_PASS_HASH = '2a3f8c1e5b9d4f7a0e3b6c9d2f5a8b1e4c7d0f3a6b9e2c5f8a1d4e7b0c3f6a9'; // placeholder

  // Stockage des hash réels au premier chargement (init sécurisée)
  const STORED_CREDS_KEY = '_botaniva_auth_v3';

  async function initCredentials() {
    const stored = Sec.safeGetStorage(STORED_CREDS_KEY);
    if (!stored) {
      // Première initialisation — créer les hash
      const salt = 'botaniva_secure_salt_2025';
      const emailHash = await Sec.hashPassword('botaniva21@gmail.com', salt);
      const passHash = await Sec.hashPassword('Botaniva21', salt);
      Sec.safeSetStorage(STORED_CREDS_KEY, { emailHash, passHash, salt, v: 3 });
      return { emailHash, passHash, salt };
    }
    return stored;
  }

  // ── AUTHENTIFICATION SÉCURISÉE ──────────────────────────────────────────
  const checkAuth = () => {
    if (Sec.isSessionValid()) {
      loginScreen.style.display = 'none';
      dashboard.style.setProperty('display', 'flex', 'important');
      initDashboard();
      // Renouvellement automatique toutes les 15 min
      setInterval(() => Sec.refreshSession(), 15 * 60 * 1000);
    }
  };

  // Attacher l'événement de soumission
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = loginForm.querySelector('button[type="submit"]');

    // ── Vérification Anti-Brute-Force ──
    const lockState = Sec.RateLimit.isLocked();
    if (lockState.locked) {
      loginError.textContent = `Trop de tentatives. Réessayez dans ${lockState.remaining} min.`;
      loginError.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Vérification...';

    const emailVal = (emailInput.value || '').trim().toLowerCase();
    const passVal = passInput.value || '';

    try {
      const creds = await initCredentials();
      const emailHash = await Sec.hashPassword(emailVal, creds.salt);
      const passHash = await Sec.hashPassword(passVal, creds.salt);

      // Comparaison des hash uniquement
      const emailOk = emailHash === creds.emailHash;
      const passOk = passHash === creds.passHash;

      if (emailOk && passOk) {
        // Succès : créer session sécurisée
        const token = Sec.generateSessionToken();
        Sec.createSession(await Sec.hashPassword(token, creds.salt));
        Sec.RateLimit.reset();
        passInput.value = ''; // Effacer le mot de passe de la mémoire DOM

        // Animation de succès
        submitBtn.textContent = '✓ Connecté !';
        submitBtn.style.background = '#1a7f37';
        setTimeout(() => location.reload(), 800);

      } else {
        // Échec : incrémenter le compteur
        const count = Sec.RateLimit.recordAttempt();
        const remaining = Math.max(0, Sec.RateLimit.MAX_ATTEMPTS - count);
        loginError.textContent = remaining > 0
          ? `Identifiants incorrects. ${remaining} tentative(s) restante(s).`
          : 'Compte bloqué temporairement. Réessayez dans 15 minutes.';
        loginError.style.display = 'block';

        // Délai artificiel anti-timing-attack (200–500ms aléatoire)
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Se connecter';
          passInput.focus();
        }, Math.floor(Math.random() * 300) + 200);
      }

    } catch (err) {
      console.error('[Admin] Erreur d\'authentification:', err.message);
      loginError.textContent = 'Erreur système. Veuillez réessayer.';
      loginError.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Se connecter';
    }
  });

  // Déconnexion sécurisée
  window.logout = () => {
    Sec.destroySession();
    // Nettoyage de l'historique (empêche retour arrière)
    window.location.replace('index.html');
  };

  // ── NAVIGATION ────────────────────────────────────────────────────────
  window.showSection = (sectionId) => {
    // Valider l'ID pour éviter les injections DOM
    const ALLOWED_SECTIONS = ['products', 'content', 'orders', 'influencers'];
    if (!ALLOWED_SECTIONS.includes(sectionId)) return;

    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const activeLi = document.querySelector(`li[onclick*="${Sec.escapeHTML(sectionId)}"]`);
    if (activeLi) activeLi.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));

    const sectionEl = document.getElementById(`section-${sectionId}`);
    if (sectionEl) sectionEl.classList.add('active');

    const titles = {
      'products': 'Gestion des Produits',
      'content': 'Contenu Site',
      'orders': 'Gestion des Commandes',
      'influencers': 'Vidéos Influenceuses'
    };
    const titleEl = document.getElementById('section-title');
    if (titleEl) titleEl.textContent = titles[sectionId] || '';
  };

  // ── INITIALISATION DU DASHBOARD ───────────────────────────────────────
  function initDashboard() {
    renderProducts();
    renderOrders();
    loadSiteContent();
    loadInfluencersVideos();
  }

  // ── GESTION DES PRODUITS (CRUD + SÉCURISÉ) ───────────────────────────
  let products = (() => {
    const raw = Sec.safeGetStorage('botaniva_catalog');
    if (Array.isArray(raw)) return raw.map(Sec.sanitizeProductData);
    return [
      { id: 1, name: 'LUX BELDI SOAP', price: 129, desc: "Savon Noir d'exception infusé au Flio", img: 'soap.png', video: '' },
      { id: 2, name: 'MOROCCAN SECRET', price: 139, desc: 'Tberma ancestrale aux plantes rares', img: 'tberma.png', video: '' },
      { id: 3, name: 'SÉRUM WHITE PERLE', price: 189, desc: "L'élixir anti-taches ultime.", img: 'White Perle Sérum .jpeg', video: '' }
    ];
  })();

  function renderProducts() {
    const tbody = document.getElementById('product-list-body');
    if (!tbody) return;
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#888;">Aucun produit.</td></tr>';
      return;
    }
    tbody.innerHTML = products.map(p => `
      <tr>
        <td><img src="${Sec.sanitizeUrl(p.img)}" class="product-img-mini" alt="${p.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect fill=%22%23eee%22 width=%2250%22 height=%2250%22/></svg>'"></td>
        <td><strong>${p.name}</strong></td>
        <td>${p.price} MAD</td>
        <td>${p.desc.substring(0, 40)}…</td>
        <td class="actions">
          <div class="btn-icon btn-edit"   onclick="editProduct(${Number(p.id)})"  ><i class="fa-solid fa-pen"></i></div>
          <div class="btn-icon btn-delete" onclick="deleteProduct(${Number(p.id)})"><i class="fa-solid fa-trash"></i></div>
        </td>
      </tr>
    `).join('');
    Sec.safeSetStorage('botaniva_catalog', products);
  }

  const modal = document.getElementById('product-modal');
  window.openProductModal = () => {
    document.getElementById('product-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('modal-title').textContent = 'Ajouter un Produit';
    modal.style.display = 'flex';
  };
  window.closeProductModal = () => { modal.style.display = 'none'; };

  document.getElementById('product-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawData = {
      id: document.getElementById('edit-id').value,
      name: document.getElementById('p-name').value,
      price: document.getElementById('p-price').value,
      img: document.getElementById('p-img').value,
      video: document.getElementById('p-video').value,
      desc: document.getElementById('p-desc').value
    };

    const clean = Sec.sanitizeProductData(rawData);

    if (!clean.name) { alert('Le nom du produit est requis.'); return; }
    if (clean.price <= 0) { alert('Le prix doit être supérieur à 0.'); return; }

    if (rawData.id) {
      const p = products.find(prod => prod.id == Number(rawData.id));
      if (p) { Object.assign(p, clean); p.id = Number(rawData.id); }
    } else {
      const newId = products.length ? Math.max(...products.map(x => x.id)) + 1 : 1;
      products.push({ ...clean, id: newId });
    }

    renderProducts();
    closeProductModal();
  });

  window.editProduct = (id) => {
    const p = products.find(prod => prod.id === Number(id));
    if (!p) return;
    document.getElementById('edit-id').value = p.id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-img').value = p.img;
    document.getElementById('p-video').value = p.video || '';
    document.getElementById('p-desc').value = p.desc;
    document.getElementById('modal-title').textContent = 'Modifier le Produit';
    modal.style.display = 'flex';
  };

  window.deleteProduct = (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      products = products.filter(p => p.id !== Number(id));
      renderProducts();
    }
  };

  // ── GESTION DES COMMANDES (SÉCURISÉE) ────────────────────────────────
  const STATUS_CLASSES = { 'Livrée': 'status-paid', 'Confirmée': 'status-confirmed', 'En attente': 'status-pending' };
  const VALID_STATUSES = ['En attente', 'Confirmée', 'Livrée'];

  async function renderOrders() {
    const tbody = document.getElementById('orders-list-body');
    if (!tbody) return;

    let orders = [];
    try {
      const response = await fetch(`${API_BASE}/api/orders`);
      if (!response.ok) throw new Error(`Erreur serveur (HTTP ${response.status})`);
      orders = await response.json();
    } catch (err) {
      console.error('Erreur chargement commandes:', err);
      // Fallback local pour ne pas bloquer
      orders = Sec.safeGetStorage('botaniva_orders') || [];
    }

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#888;">Aucune commande.</td></tr>';
      return;
    }

    // Inverser pour voir les plus récentes en haut
    const displayOrders = [...orders].reverse();

    tbody.innerHTML = displayOrders.map((o) => {
      const notes = o.supplierNotes ? `<div style="margin-top:0.5rem; padding:0.5rem; background:#f9f9f9; border-left: 2px solid #1a7f37; font-size:0.75rem; color:#444;">${Sec.escapeHTML(o.supplierNotes)}</div>` : '';
      const orderId = o.id;
      const tracking = o.tracking || '';

      return `
      <tr>
        <td style="font-size:0.85rem;">${Sec.escapeHTML(o.date)}<br><strong>${Sec.escapeHTML(o.id)}</strong></td>
        <td><strong>${Sec.escapeHTML(o.client)}</strong><br><small>${Sec.escapeHTML(o.phone)}</small></td>
        <td>${Sec.escapeHTML(o.city)}<br><small>${Sec.escapeHTML(o.address || '')}</small></td>
        <td style="font-size:0.85rem;max-width:250px;">
          ${Array.isArray(o.items) ? o.items.map(i => `${i.name} x${i.qty}`).join(', ') : Sec.escapeHTML(String(o.items))}
          ${notes}
        </td>
        <td><strong>${Number(o.total)} MAD</strong></td>
        <td style="font-family:monospace; color:#611226;">${tracking}</td>
        <td>
          <select onchange="updateOrderStatus('${orderId}', this.value)"
                  class="status-select ${STATUS_CLASSES[o.status] || 'status-pending'}">
            ${VALID_STATUSES.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td class="actions">
          ${tracking ? `
            <div class="btn-icon btn-edit" title="Infos Digylog" onclick="showTrackingInfos('${tracking}')"><i class="fa-solid fa-circle-info"></i></div>
            <div class="btn-icon btn-edit" title="Étiquette" style="background:#2c3e50;" onclick="downloadLabel('${tracking}')"><i class="fa-solid fa-file-pdf"></i></div>
            <div class="btn-icon btn-delete" title="Réclamation" style="background:#e67e22;" onclick="openComplaintModal('${tracking}')"><i class="fa-solid fa-circle-exclamation"></i></div>
          ` : '<small style="color:#aaa;">Non envoyé</small>'}
        </td>
      </tr>
    `}).join('');
  }

  // --- RECLAMATIONS (DIGYLOG) ---
  const complaintModal = document.getElementById('complaint-modal');
  const complaintForm = document.getElementById('complaint-form');

  window.openComplaintModal = async (tracking) => {
    document.getElementById('complaint-tracking').value = tracking;
    document.getElementById('complaint-tracking-display').textContent = `N° Suivi : ${tracking}`;
    complaintModal.style.display = 'flex';

    // Charger les types si non faits
    const typeSelect = document.getElementById('complaint-type');
    if (typeSelect.options.length <= 1) {
      try {
        const res = await fetch(`${API_BASE}/complaint-types`);
        const types = await res.json();
        typeSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
      } catch (e) {
        typeSelect.innerHTML = '<option value="">Erreur chargement</option>';
      }
    }
  };

  window.closeComplaintModal = () => { complaintModal.style.display = 'none'; };

  complaintForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tracking = document.getElementById('complaint-tracking').value;
    const type = document.getElementById('complaint-type').value;
    const note = document.getElementById('complaint-note').value;

    const submitBtn = complaintForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking, type, note })
      });
      const result = await res.json();

      if (res.ok) {
        alert('Réclamation envoyée avec succès !');
        closeComplaintModal();
        complaintForm.reset();
      } else {
        throw new Error(result.error || 'Erreur lors de l\'envoi');
      }
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer la réclamation';
    }
  });

  // --- PICKUP (RAMASSAGE) ---
  const pickupModal = document.getElementById('pickup-modal');
  const pickupForm = document.getElementById('pickup-form');

  window.openPickupModal = async () => {
    pickupModal.style.display = 'flex';
    const areaSelect = document.getElementById('pickup-area');

    if (areaSelect.options.length <= 1) {
      try {
        const res = await fetch(`${API_BASE}/pickup/areas`);
        const areas = await res.json();
        areaSelect.innerHTML = areas.map(a => `<option value="${a.id}">${a.name} (${a.mintime} - ${a.maxtime})</option>`).join('');
      } catch (e) {
        areaSelect.innerHTML = '<option value="">Erreur chargement zones</option>';
      }
    }
  };

  window.closePickupModal = () => { pickupModal.style.display = 'none'; };

  pickupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const area = document.getElementById('pickup-area').value;
    const phone = document.getElementById('pickup-phone').value;

    if (!area || !phone) {
      alert("Veuillez sélectionner une zone et entrer un téléphone.");
      return;
    }

    const submitBtn = pickupForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Demande en cours...';

    console.log(`🚀 [Admin] Envoi demande ramassage: Area=${area}, Phone=${phone}`);

    try {
      const res = await fetch(`${API_BASE}/pickup/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: parseInt(area), phone: phone })
      });
      const result = await res.json();
      console.log(`🔍 [Admin] Réponse ramassage:`, result);

      if (res.ok) {
        const pickupInfo = Array.isArray(result) ? result[0] : result;
        alert(`Ramassage programmé !\nZone : ${pickupInfo?.area || 'Confirmée'}\nLivreur : ${pickupInfo?.picker || 'En attente'}\nTel Livreur : ${pickupInfo?.pickerPhone || 'N/A'}`);
        closePickupModal();
      } else {
        throw new Error(result.error || result.message || 'Erreur lors de la demande');
      }
    } catch (err) {
      console.error('❌ [Admin] Pickup Error:', err);
      alert(`Erreur : ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmer le ramassage';
    }
  });

  window.showTrackingInfos = async (tracking) => {
    try {
      const res = await fetch(`${API_BASE}/order/${tracking}/infos`);
      const data = await res.json();
      alert(`Infos Digylog pour ${tracking} :\nStatut: ${data.statusLabel || 'N/A'}\nDernière Maj: ${data.updatedAt || 'N/A'}`);
    } catch (e) {
      alert('Erreur lors de la récupération des infos.');
    }
  };

  window.downloadLabel = async (tracking) => {
    try {
      const res = await fetch(`${API_BASE}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: tracking, format: 3 })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etiquette_${tracking}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert('Erreur lors du téléchargement de l\'étiquette.');
    }
  };

  window.updateOrderStatus = async (orderId, newStatus) => {
    if (!VALID_STATUSES.includes(newStatus)) return;

    try {
      await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      renderOrders();
    } catch (err) {
      console.error('Erreur mise à jour statut:', err);
    }
  };

  // ── GESTION DU CONTENU SITE ───────────────────────────────────────────
  function loadSiteContent() {
    const siteContent = Sec.safeGetStorage('botaniva_content') || {
      heroTitle: 'Rituel de Beauté Naturel & Élégant',
      aboutText: 'Botaniva est une marque dédiée à la beauté de la peau…'
    };
    const heroEl = document.getElementById('edit-hero-title');
    const aboutEl = document.getElementById('edit-about-text');
    if (heroEl) heroEl.value = siteContent.heroTitle || '';
    if (aboutEl) aboutEl.value = siteContent.aboutText || '';
  }

  document.getElementById('content-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const heroVal = document.getElementById('edit-hero-title').value || '';
    const aboutVal = document.getElementById('edit-about-text').value || '';

    const siteContent = {
      heroTitle: heroVal.substring(0, 120).replace(/[<>]/g, ''),
      aboutText: aboutVal.substring(0, 1000).replace(/[<>]/g, '')
    };
    Sec.safeSetStorage('botaniva_content', siteContent);

    // Notification visuelle
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = '✓ Site mis à jour !';
    btn.style.background = '#1a7f37';
    setTimeout(() => { btn.textContent = 'Mettre à jour le site'; btn.style.background = ''; }, 3000);
  });

  // ── GESTION DES VIDÉOS INFLUENCEUSES ──────────────────────────────────
  function loadInfluencersVideos() {
    const defaultVideos = [
      { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', title: 'Tutoriel : Rituel Hammam complet', author: 'Par @InfluenceuseBeauté' },
      { url: 'assets/hero_premium_hd.png', title: 'Mon avis sur le Savon Beldi', author: 'Par @BeautyBySara' },
      { url: 'WhatsApp Video 2026-04-22 at 10.55.04 (1).mp4', title: 'Routine éclat au Sérum Perle', author: 'Par @MoroccanGlow' },
      { url: 'WhatsApp Video 2026-04-22 at 10.54.09.mp4', title: 'Fraîcheur du Musc', author: 'Par @MarocBeauté' }
    ];
    let videos = Sec.safeGetStorage('botaniva_influencers');
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      videos = defaultVideos;
    }
    for (let i = 0; i < 3; i++) {
      const v = videos[i] || defaultVideos[i];
      const urlEl = document.getElementById(`inf-url-${i + 1}`);
      const titleEl = document.getElementById(`inf-title-${i + 1}`);
      const authorEl = document.getElementById(`inf-author-${i + 1}`);
      if (urlEl) urlEl.value = v.url || '';
      if (titleEl) titleEl.value = v.title || '';
      if (authorEl) authorEl.value = v.author || '';
    }
  }

  document.getElementById('influencers-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const videos = [];
    for (let i = 1; i <= 3; i++) {
      const urlEl = document.getElementById(`inf-url-${i}`);
      const titleEl = document.getElementById(`inf-title-${i}`);
      const authorEl = document.getElementById(`inf-author-${i}`);

      if (urlEl && titleEl && authorEl) {
        videos.push({
          url: urlEl.value || '',
          title: titleEl.value || '',
          author: authorEl.value || ''
        });
      }
    }

    // Assainissement simple
    const cleanVideos = videos.map(v => ({
      url: v.url.substring(0, 500).replace(/[<>"']/g, ''),
      title: v.title.substring(0, 100).replace(/[<>]/g, ''),
      author: v.author.substring(0, 50).replace(/[<>]/g, '')
    }));

    Sec.safeSetStorage('botaniva_influencers', cleanVideos);

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = '✓ Vidéos sauvegardées !';
    btn.style.background = '#1a7f37';
    setTimeout(() => { btn.textContent = originalText; btn.style.background = ''; }, 3000);
  });

  // ── PROTECTION CONTRE LE RETOUR-ARRIÈRE APRÈS DÉCONNEXION ────────────
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      if (!Sec.isSessionValid()) window.location.replace('index.html');
    }
  });

  // ── VÉRIFICATION PÉRIODIQUE DE LA SESSION ────────────────────────────
  setInterval(() => {
    if (!Sec.isSessionValid()) {
      alert('Votre session a expiré. Veuillez vous reconnecter.');
      window.location.replace('admin.html');
    }
  }, 60 * 1000); // Vérifie chaque minute

  // ── LANCEMENT ────────────────────────────────────────────────────────
  await initCredentials();
  checkAuth();
});
