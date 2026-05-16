// =========================================================
// BOTANIVA BIO — security.js (Module de Sécurité)
// =========================================================

const BotanivaSecretecurity = (() => {

  // ── 1. HACHAGE SHA-256 (Web Crypto API) ──────────────────────────────────
  async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password + 'botaniva_2025_secret');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── 2. GÉNÉRATION D'UN TOKEN DE SESSION SÉCURISÉ ─────────────────────────
  function generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── 3. SALT UNIQUE PAR APPAREIL ──────────────────────────────────────────
  function getOrCreateSalt() {
    let salt = sessionStorage.getItem('_bsalt');
    if (!salt) {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      salt = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('_bsalt', salt);
    }
    return salt;
  }

  // ── 4. ÉCHAPPEMENT XSS ───────────────────────────────────────────────────
  function escapeHTML(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // ── 5. RATE LIMITING ANTI-BRUTE-FORCE ────────────────────────────────────
  const RateLimit = {
    MAX_ATTEMPTS: 5,
    LOCKOUT_MS: 15 * 60 * 1000, // 15 minutes
    key: '_botaniva_login_attempts',

    getState() {
      try {
        return JSON.parse(localStorage.getItem(this.key)) || { count: 0, firstAttempt: null, lockedUntil: null };
      } catch { return { count: 0, firstAttempt: null, lockedUntil: null }; }
    },

    isLocked() {
      const state = this.getState();
      if (state.lockedUntil && Date.now() < state.lockedUntil) {
        return { locked: true, remaining: Math.ceil((state.lockedUntil - Date.now()) / 1000 / 60) };
      }
      if (state.lockedUntil && Date.now() >= state.lockedUntil) {
        this.reset(); // Expiration automatique
      }
      return { locked: false };
    },

    recordAttempt() {
      const state = this.getState();
      state.count = (state.count || 0) + 1;
      if (!state.firstAttempt) state.firstAttempt = Date.now();
      if (state.count >= this.MAX_ATTEMPTS) {
        state.lockedUntil = Date.now() + this.LOCKOUT_MS;
      }
      localStorage.setItem(this.key, JSON.stringify(state));
      return state.count;
    },

    reset() {
      localStorage.removeItem(this.key);
    }
  };

  // ── 6. GESTION DE SESSION SÉCURISÉE ──────────────────────────────────────
  const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 heures
  const SESSION_KEY = '_botaniva_session';

  function createSession(tokenHash) {
    const session = {
      token: tokenHash,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
      fingerprint: getFingerprint()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function isSessionValid() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (!session.token || !session.expiresAt) return false;
      if (Date.now() > session.expiresAt) {
        destroySession();
        return false;
      }
      // Vérification de la cohérence du fingerprint
      if (session.fingerprint !== getFingerprint()) {
        destroySession();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function destroySession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('_bsalt');
  }

  // Empreinte navigateur légère (anti-hijacking)
  function getFingerprint() {
    return btoa([
      navigator.language,
      screen.colorDepth,
      new Date().getTimezoneOffset()
    ].join('|')).slice(0, 16);
  }

  // ── 7. RENOUVELLEMENT AUTO DE SESSION ────────────────────────────────────
  function refreshSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      session.expiresAt = Date.now() + SESSION_DURATION;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch { /* silent */ }
  }

  // ── 8. VALIDATION DES DONNÉES ────────────────────────────────────────────
  function sanitizeProductData(data) {
    return {
      id: Number(data.id) || 0,
      name: escapeHTML(String(data.name || '').substring(0, 100)),
      price: Math.max(0, Math.min(99999, Number(data.price) || 0)),
      desc: escapeHTML(String(data.desc || '').substring(0, 500)),
      img: sanitizeUrl(data.img),
      video: data.video ? sanitizeUrl(data.video) : '',
      parfums: Array.isArray(data.parfums) ? data.parfums.map(p => escapeHTML(String(p).substring(0, 30))) : null,
      supplier: data.supplier ? escapeHTML(String(data.supplier).substring(0, 50)) : null,
      supplierName: data.supplierName ? escapeHTML(String(data.supplierName).substring(0, 50)) : null,
      productCode: data.productCode ? escapeHTML(String(data.productCode).substring(0, 50)) : null,
      variants: Array.isArray(data.variants) ? data.variants.map(v => ({
        label: escapeHTML(String(v.label || '').substring(0, 50)),
        price: Math.max(0, Number(v.price) || 0)
      })) : null
    };
  }

  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    // Autoriser chemins locaux (racine, assets, etc.) et https
    if (trimmed.startsWith('assets/') || trimmed.startsWith('./') || !trimmed.includes('://')) {
      return escapeHTML(trimmed);
    }
    if (trimmed.startsWith('https://')) return escapeHTML(trimmed);
    return '';
  }

  function sanitizeOrderData(data) {
    return {
      id: '#' + Math.floor(Math.random() * 90000 + 10000),
      date: new Date().toLocaleDateString('fr-FR'),
      client: escapeHTML(String(data.client || '').substring(0, 80)),
      phone: escapeHTML(String(data.phone || '').replace(/[^0-9+\s\-]/g, '').substring(0, 20)),
      city: escapeHTML(String(data.city || '').substring(0, 50)),
      address: escapeHTML(String(data.address || '').substring(0, 150)),
      items: escapeHTML(String(data.items || '').substring(0, 1000)),
      supplierNotes: data.supplierNotes ? escapeHTML(String(data.supplierNotes).substring(0, 2000)) : '',
      total: Math.max(0, Number(data.total) || 0),
      status: 'En attente',
      createdAt: Date.now()
    };
  }

  // Validation du numéro de téléphone marocain
  function validatePhone(phone) {
    const cleaned = phone.replace(/\s+/g, '');
    return /^(\+212|0)(6|7)\d{8}$/.test(cleaned);
  }

  // ── 9. INTÉGRITÉ DU STORAGE ──────────────────────────────────────────────
  function safeGetStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      console.warn(`[Security] Données corrompues pour: ${key}`);
      localStorage.removeItem(key);
      return null;
    }
  }

  function safeSetStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // Storage plein ou bloqué
      console.warn('[Security] Impossible d\'écrire dans le localStorage:', e.message);
      return false;
    }
  }

  // ── 10. EXPORT PUBLIC ────────────────────────────────────────────────────
  return {
    hashPassword,
    generateSessionToken,
    getOrCreateSalt,
    escapeHTML,
    RateLimit,
    createSession,
    isSessionValid,
    destroySession,
    refreshSession,
    sanitizeProductData,
    sanitizeOrderData,
    sanitizeUrl,
    validatePhone,
    safeGetStorage,
    safeSetStorage
  };

})();

// Rendre accessible globalement
window.BotanivaSecretecurity = BotanivaSecretecurity;
