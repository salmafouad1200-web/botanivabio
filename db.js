const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI;

let isMongoConnected = false;
let isConnecting = false;
let retryDelay = 2000; // Start with 2 seconds
const MAX_RETRY_DELAY = 60000; // Max 60 seconds

const connectDB = () => {
  if (!mongoUri || mongoUri.includes('<username>') || mongoUri.includes('xxxxxx')) {
    console.warn('\n⚠️ [Database Warning] MONGODB_URI is not set, empty, or contains placeholders!');
    console.warn('⚠️ [Database Warning] Server will operate in Degraded In-Memory Queue Mode.\n');
    return;
  }

  if (isConnecting) return;
  isConnecting = true;
  
  console.log('📡 [Database] Connecting to MongoDB Atlas Cloud...');
  
  try {
    mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    })
    .then(() => {
      isMongoConnected = true;
      isConnecting = false;
      retryDelay = 2000; // Reset delay on success
      console.log('✅ [Database] MongoDB Atlas Connected Successfully');
    })
    .catch(err => {
      isMongoConnected = false;
      isConnecting = false;
      
      // Exponential backoff retry logic
      console.error(`⚠️ [Database] Connection failed: ${err.message}`);
      console.log(`🔄 [Database] Operating in Degraded Mode. Retrying in ${retryDelay / 1000}s...`);
      setTimeout(connectDB, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    });
  } catch (err) {
    isMongoConnected = false;
    isConnecting = false;
    console.error(`❌ [Database] Synchronous Connection Error: ${err.message}`);
    console.log(`🔄 [Database] Operating in Degraded Mode. Retrying in ${retryDelay / 1000}s...`);
    setTimeout(connectDB, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
  }
};

// Event Monitoring for Database Health
mongoose.connection.on('connected', () => {
  isMongoConnected = true;
  isConnecting = false;
  retryDelay = 2000; // Reset delay on success
  // Trigger offline queue drain upon database recovery
  if (typeof global.drainOfflineQueue === 'function') {
    global.drainOfflineQueue();
  }
});

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('⚠️ [Database] MongoDB Disconnected. Reconnect trigger initialized...');
  if (!isConnecting) {
    setTimeout(connectDB, 5000);
  }
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ [Database] Runtime Mongoose Error: ${err.message}`);
});

// Schema definition
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

// Product Schema Definition
const productSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  desc: String,
  img: String,
  video: String,
  parfums: [String],
  supplier: String,
  supplierName: String,
  productCode: String,
  variants: [{
    label: String,
    price: Number
  }],
  created_at: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

module.exports = {
  connectDB,
  Order,
  Product,
  isConnected: () => isMongoConnected
};
