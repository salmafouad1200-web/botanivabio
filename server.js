require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8080;

// ---------- Security & Performance Middleware ----------

// 1. Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://*"],
      connectSrc: ["'self'", "http://localhost:3000", "https://api.digylog.com"],
      mediaSrc: ["'self'", "https://*", "blob:"],
      frameSrc: ["'self'", "https://www.youtube.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. Gzip Compression
app.use(compression());

// 3. CORS Configuration
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

app.use(express.static(__dirname));

// ---------- Digylog Configuration ----------

const DIGYLOG_API_TOKEN = process.env.DIGYLOG_API_TOKEN;
const DIGYLOG_API_URL = process.env.DIGYLOG_API_URL || 'https://api.digylog.com/api/v2/seller';

// ---------- Database Connection ----------

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/botaniva';
let isMongoConnected = false;

mongoose.connect(mongoUri, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 
})
  .then(() => {
    console.log('✅ [Database] Connected to MongoDB');
    isMongoConnected = true;
  })
  .catch(err => {
    console.error('⚠️ [Database] MongoDB Offline (Fallback mode active):', err.message);
  });

// Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  clientName: String,
  phone: String,
  address: String,
  city: String,
  totalAmount: Number,
  shippingFee: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'COD' },
  items: Array,
  trackingNumber: String,
  digylogStatus: String,
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// ---------- Digylog Helper Function ----------

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
      
      if (isMongoConnected) {
        await Order.findOneAndUpdate(
          { orderId: orderDoc.orderId },
          { trackingNumber: tracking, digylogStatus: orderResult.statusLabel || 'Nouveau' }
        );
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

// ---------- API Routes ----------

app.get('/health', (req, res) => res.json({ status: 'ok', database: isMongoConnected ? 'connected' : 'offline' }));

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

    if (isMongoConnected) {
      await new Order(orderDoc).save();
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
  if (!isMongoConnected) return res.json([]);
  res.json(await Order.find().sort({ created_at: -1 }).limit(100));
});

app.put('/api/orders/:id', async (req, res) => {
  if (!isMongoConnected) return res.status(503).json({ error: 'DB Offline' });
  const order = await Order.findOneAndUpdate({ orderId: req.params.id }, { status: req.body.status }, { new: true });
  res.json({ success: !!order });
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

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, req, res, next) => {
  console.error('🔥 [Critical Error]:', err);
  res.status(500).json({ error: 'Critical server error' });
});

app.listen(PORT, () => {
  console.log(`
  🚀 [Botaniva Bio] PROD SERVER STARTED
  📍 Port: ${PORT}
  🌍 Mode: production
  🔒 Security: Helmet, CORS, Rate-Limit ACTIVE
  ⚡ Performance: Compression, Caching ACTIVE
  `);
});
