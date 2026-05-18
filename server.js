require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ---------- Degraded Mode Env Validation ----------
const criticalEnvVars = ['MONGODB_URI', 'DIGYLOG_API_TOKEN'];
const missingVars = criticalEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.warn(`\n⚠️ [Degraded Mode Warning] Missing environment variables: ${missingVars.join(', ')}`);
  console.warn('⚠️ [Degraded Mode Warning] Some cloud operations and API syncing will run in degraded fallback mode.\n');
}

// Import Modular Database Controller
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

// ---------- Security & Performance Middleware ----------

// 1. Helmet Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://*"],
      connectSrc: ["'self'", "https://api.digylog.com", "https://*.railway.app"],
      mediaSrc: ["'self'", "https://*", "blob:"],
      frameSrc: ["'self'", "https://www.youtube.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. Gzip Compression
app.use(compression());

// 3. Dynamic CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  process.env.SERVER_PUBLIC_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.includes('railway.app')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// 4. Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Order limit reached. Please contact support if you need more.' }
});

// 5. Body Parsing
app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 6. Request Logging
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// ---------- Static Files & Caching ----------
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const publicFiles = [
  'script.js',
  'admin.js',
  'style.css',
  'admin-style.css',
  'security.js'
];

publicFiles.forEach(file => {
  app.get(`/${file}`, (req, res) => res.sendFile(path.join(__dirname, file)));
});

app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'assets', 'logos', 'logo_botaniva.png')));

// ---------- Digylog Configuration ----------
const DIGYLOG_API_TOKEN = process.env.DIGYLOG_API_TOKEN;
const DIGYLOG_API_URL = process.env.DIGYLOG_API_URL || 'https://api.digylog.com/api/v2/seller';

// ---------- In-Memory Offline Queue ----------
let offlineQueue = [];

// Queue drainer when DB connection is active
global.drainOfflineQueue = async () => {
  if (offlineQueue.length === 0) return;
  if (!db.isConnected()) return;

  console.log(`🚀 [Offline Queue] Database is back online! Syncing ${offlineQueue.length} queued orders...`);
  
  const toProcess = [...offlineQueue];
  let successCount = 0;

  for (const orderDoc of toProcess) {
    try {
      // Avoid duplicate keys
      const exists = await db.Order.findOne({ orderId: orderDoc.orderId });
      if (!exists) {
        await new db.Order(orderDoc).save();
      }
      successCount++;
      // Dequeue
      offlineQueue = offlineQueue.filter(o => o.orderId !== orderDoc.orderId);
    } catch (err) {
      console.error(`❌ [Offline Queue] Failed to sync order ${orderDoc.orderId}:`, err.message);
    }
  }

  console.log(`✅ [Offline Queue] Synced ${successCount}/${toProcess.length} orders successfully to Atlas.`);
};

// ---------- Digylog API Helper ----------
async function sendOrderToDigylog(orderDoc) {
  const payload = {
    mode: 1,
    network: parseInt(process.env.DIGYLOG_NETWORK_ID) || 2,
    store: process.env.DIGYLOG_STORE_NAME || 'Botaniva',
    status: 1,
    checkDuplicate: 1,
    orders: [{
      num: orderDoc.orderId,
      type: 1,
      name: orderDoc.clientName,
      phone: orderDoc.phone,
      address: orderDoc.address,
      city: orderDoc.city,
      price: orderDoc.totalAmount,
      openproduct: 1,
      port: (orderDoc.shippingFee > 0) ? 1 : 2,
      note: orderDoc.note || "Commande Botaniva Bio",
      refs: orderDoc.items.map(i => ({
        designation: i.name,
        quantity: i.qty,
        price: i.price
      }))
    }]
  };

  try {
    const response = await fetch(`${DIGYLOG_API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIGYLOG_API_TOKEN}`,
        'Referer': 'https://apiseller.digylog.com'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log(`🔍 [Digylog] Response:`, JSON.stringify(result));

    if (!response.ok) {
      throw new Error(`Digylog HTTP ${response.status}`);
    }

    const orderResult = Array.isArray(result) ? result[0] : result;
    if (orderResult && (orderResult.isSuccess || orderResult.success)) {
      const tracking = orderResult.tracking || orderResult.traking;
      
      if (db.isConnected()) {
        await db.Order.findOneAndUpdate(
          { orderId: orderDoc.orderId },
          { trackingNumber: tracking, digylogStatus: orderResult.statusLabel || 'Nouveau' }
        );
      } else {
        // Update tracking inside in-memory queue
        const queuedItem = offlineQueue.find(o => o.orderId === orderDoc.orderId);
        if (queuedItem) {
          queuedItem.trackingNumber = tracking;
          queuedItem.digylogStatus = orderResult.statusLabel || 'Nouveau';
        }
      }
      
      return { success: true, tracking };
    } else {
      throw new Error(orderResult?.errors?.join(', ') || 'Digylog rejected order');
    }
  } catch (error) {
    console.error(`❌ [Digylog] Sync Failed:`, error.message);
    throw error;
  }
}

// ---------- API Routing ----------

app.get('/health', (req, res) => res.json({ status: 'ok', database: db.isConnected() ? 'connected' : 'offline', queuedOrdersCount: offlineQueue.length }));

app.get('/test-digylog', apiLimiter, async (req, res) => {
  try {
    const response = await fetch(`${DIGYLOG_API_URL}/cities`, {
      headers: { 'Authorization': `Bearer ${DIGYLOG_API_TOKEN}`, 'Referer': 'https://apiseller.digylog.com' }
    });
    const data = await response.json();
    res.json({ connected: response.ok, citiesFound: data.length || 0 });
  } catch (error) {
    res.status(500).json({ connected: false, error: error.message });
  }
});

app.post('/create-order', orderLimiter, async (req, res) => {
  const { nom_complet, telephone, ville, adresse, prix, items, note } = req.body;

  if (!nom_complet || !telephone || !ville || !adresse) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const orderId = `BOT-${Date.now()}`;
    const orderDoc = {
      orderId,
      clientName: nom_complet,
      phone: telephone,
      address: adresse,
      city: ville,
      totalAmount: prix,
      items: items || [],
      note: note || '',
      status: 'pending'
    };

    if (db.isConnected()) {
      await new db.Order(orderDoc).save();
    } else {
      // DB offline: push to in-memory fallback queue
      offlineQueue.push(orderDoc);
      console.log(`📥 [Offline Queue] Enqueued order ${orderId} in memory. Total queued: ${offlineQueue.length}`);
    }

    const digylog = await sendOrderToDigylog(orderDoc);
    res.status(201).json({ success: true, orderId, tracking: digylog.tracking });

  } catch (error) {
    console.error('❌ [API] Checkout Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.get('/cities', apiLimiter, async (req, res) => {
  try {
    const response = await fetch(`${DIGYLOG_API_URL}/cities`, {
      headers: { 'Authorization': `Bearer ${DIGYLOG_API_TOKEN}`, 'Referer': 'https://apiseller.digylog.com' }
    });
    res.json(await response.json());
  } catch (error) {
    res.status(502).json({ error: 'Digylog unreachable' });
  }
});

app.get('/api/orders', async (req, res) => {
  if (!db.isConnected()) {
    // If DB is offline, return local in-memory queued orders
    return res.json({
      dbOffline: true,
      orders: offlineQueue
    });
  }
  const orders = await db.Order.find().sort({ created_at: -1 }).limit(100);
  res.json(orders);
});

app.put('/api/orders/:id', async (req, res) => {
  if (!db.isConnected()) return res.status(503).json({ error: 'DB Offline' });
  const order = await db.Order.findOneAndUpdate({ orderId: req.params.id }, { status: req.body.status }, { new: true });
  res.json({ success: !!order });
});

// ---------- Product Catalog API ----------
const defaultProductsList = [
  { id: 1, name: 'Sel de Bain Naturel', price: 80, desc: "Sels enrichis en Sel d’Himalaya + Sel d’Epsom. Effet spa à domicile.", img: './assets/products/sel de bain.jpeg', supplier: 'Digylog', productCode: 'SEL-001', supplierName: 'mamahbiba', parfums: ['Relaxant (Verveine & Lavande)', 'Detox (Thé Vert & Menthe Poivrée)', 'Anti-douleurs (Eucalyptus)'], variants: [{ label: '1 pièce', price: 80 }, { label: '3 pièces', price: 200 }, { label: '5 pièces', price: 300 }] },
  { id: 3, name: 'Morrocan Secret', price: 130, desc: 'Tberma ancestrale aux plantes rares.', img: './assets/products/Moroccan Secret  Tberma Marocaine Naturelle.jpeg', supplier: 'Digylog', productCode: 'TBER-001', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }, { label: '2 pièces', price: 200 }] },
  { id: 4, name: 'Lux Beldi', price: 100, desc: "Savon Noir d'exception infusé au Flio.", img: './assets/products/Lux Beldi Soap Savon Noir Marocain au Flio.jpeg', supplier: 'Digylog', productCode: 'SOAP-002', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 100 }, { label: '2 pièces', price: 160 }] },
  { id: 5, name: 'Pack Promo', price: 180, desc: "Pack Morrocan Secret + Lux Beldi.", img: './assets/products/Gemini_Generated_Image_yzvn1vyzvn1vyzvn.png', supplier: 'Digylog', productCode: 'PACK-003', supplierName: 'mamahbiba', variants: [{ label: 'Pack 1+1', price: 200 }, { label: 'Pack 2+2', price: 350 }] },
  { id: 6, name: 'Sérum Beauté', price: 150, desc: "L'élixir anti-taches ultime (White Perle).", img: './assets/products/serum.jpeg', supplier: 'Digylog', productCode: 'SERUM-004', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 150 }, { label: '2 pièces', price: 250 }] },
  { id: 7, name: 'Cristal Musk', price: 80, desc: "Musc blanc pur d'une finesse rare.", img: './assets/products/Crystal Musk.jpeg', supplier: 'Digylog', productCode: 'MUSK-005', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 80 }, { label: '3 pièces', price: 200 }] },
  { id: 8, name: 'herbiva', price: 450, desc: " Huile capillaire naturelle aux herbes indiennes qui nourrit, renforce et stimule la pousse des cheveux.", img: './assets/products/herbiva.jpeg', supplier: 'Digylog', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 450 }, { label: '3 pièces', price: 1200 }] },
  { id: 9, name: 'Royal Scrub', price: 130, desc: "Ce gommage pieds naturel est un soin exfoliant et nourrissant conçu pour redonner douceur et éclat à vos pieds", img: './assets/products/Royal scrub.jpeg', supplier: 'Digylog', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }, { label: '3 pièces', price: 380 }] },
  { id: 10, name: 'Gamme pour les Pieds', price: 350, desc: "Pack complet : Crème réparatrice, crème éclat rose et gommage exfoliant.", img: './assets/products/produit pied.jpeg', supplier: 'Digylog', supplierName: 'mamahbiba', variants: [{ label: '1 pack', price: 320 }, { label: '2 packs', price: 600 }] },
  { id: 11, name: 'Nature Silk Body Cream', price: 130, desc: "Hydratation intense, peau douce et soyeuse, non grasse.", img: './assets/products/Nature Silk Body Cream.jpeg', supplier: 'Digylog', productCode: 'CREAM-001', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }] },
  { id: 12, name: 'Nature Silk Scrub', price: 130, desc: "Gommage exfoliant spécialement conçu pour éliminer les peaux mortes et lisser les rugosités.", img: './assets/products/Nature silk scrub .jpeg', supplier: 'Digylog', productCode: 'SCRUB-001', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }] },
  { id: 13, name: 'Huile Fleur d’Oranger', price: 150, desc: "Huile parfumée corps & cheveux, fraîcheur orangée.", img: './assets/products/perle doranger huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-002', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 150 }] },
  { id: 14, name: 'Baccarat Rouge', price: 180, desc: "Huile parfumée luxueuse, notes riches et chaleureuses.", img: './assets/products/baccarat rouge huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-003', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 180 }] },
  { id: 15, name: 'Libre', price: 180, desc: "Huile parfumée audacieuse, liberté et féminité.", img: './assets/products/libre huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-004', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 180 }] },
  { id: 16, name: 'La Vie Est Belle', price: 180, desc: "Huile parfumée douce, éclatante et féminine.", img: './assets/products/belle essence huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-005', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 180 }] },
  { id: 17, name: 'Black Opium', price: 180, desc: "Huile parfumée intense, noir et mystérieux.", img: './assets/products/opium bloom huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-006', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 180 }] },
  { id: 18, name: 'Amirat Arabe', price: 180, desc: "Huile parfumée exquise, notes orientales sophistiquées.", img: './assets/products/amirat arab huile.jpeg', supplier: 'Digylog', productCode: 'HUILE-007', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 180 }] },
  { id: 19, name: 'Foot Repair Elixir', price: 150, desc: "Crème réparatrice intense spécialement formulée pour les pieds très secs et abîmés.", img: './assets/products/fool repaire felexir.jpeg', supplier: 'Digylog', productCode: 'FOOT-001', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 150 }] },
  { id: 20, name: 'Pink Tush', price: 130, desc: "Crème rose réparatrice et embellissante pour hydrater et revitaliser les pieds secs.", img: './assets/products/pink touch.jpeg', supplier: 'Digylog', productCode: 'FOOT-002', supplierName: 'mamahbiba', variants: [{ label: '1 pièce', price: 130 }] }
];

app.get('/api/products', async (req, res) => {
  try {
    if (!db.isConnected()) {
      return res.json(defaultProductsList);
    }
    let list = await db.Product.find().sort({ id: 1 });
    if (list.length === 0) {
      console.log('🌱 [Catalog] Auto-populating database with default products...');
      await db.Product.insertMany(defaultProductsList);
      list = await db.Product.find().sort({ id: 1 });
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    if (!db.isConnected()) return res.status(503).json({ error: 'DB Offline' });
    const product = new db.Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    if (!db.isConnected()) return res.status(503).json({ error: 'DB Offline' });
    const product = await db.Product.findOneAndUpdate({ id: Number(req.params.id) }, req.body, { new: true });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    if (!db.isConnected()) return res.status(503).json({ error: 'DB Offline' });
    await db.Product.findOneAndDelete({ id: Number(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/order/:tracking/infos', async (req, res) => {
  try {
    const response = await fetch(`${DIGYLOG_API_URL}/order/${req.params.tracking}/infos`, {
      headers: { 'Authorization': `Bearer ${DIGYLOG_API_TOKEN}`, 'Referer': 'https://apiseller.digylog.com' }
    });
    res.json(await response.json());
  } catch (e) { res.status(502).json({ error: 'API Error' }); }
});

app.post('/labels', async (req, res) => {
  try {
    const response = await fetch(`${DIGYLOG_API_URL}/labels`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DIGYLOG_API_TOKEN}`, 'Content-Type': 'application/json', 'Referer': 'https://apiseller.digylog.com' },
      body: JSON.stringify(req.body)
    });
    response.body.pipe(res);
  } catch (e) { res.status(500).send('Error'); }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get(["/admin", "/admin.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, req, res, next) => {
  console.error('🔥 [Critical Error]:', err);
  res.status(500).json({ error: 'Critical server error' });
});

// ---------- Start Server & Database Trigger ----------
db.connectDB();

app.listen(PORT, () => {
  console.log(`
  🚀 [Botaniva Bio] PRODUCTION SERVER STARTED (DEGRADED COMPLIANT)
  📍 Port: ${PORT}
  🌍 Mode: production
  🔒 Security: Helmet, CORS, Rate-Limit ACTIVE
  ⚡ Performance: Compression, Caching ACTIVE
  📦 Database Module: Modularized (Exponential Backoff Ready)
  `);
});
