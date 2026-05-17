const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

dotenv.config();

const connectDB = require('./config/db');
const passport = require('./config/passport');

// Connect to MongoDB
connectDB();

const app = express();

// ============ SECURITY MIDDLEWARE ============

// Helmet: Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"] // ⚠️ Update this in production if needed
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS setup
const defaultAllowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '').toLowerCase();

const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultAllowedOrigins;
const allowAllOrigins = allowedOrigins.includes('*');
const normalizedAllowedOriginSet = new Set(allowedOrigins.map(normalizeOrigin));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowAllOrigins) return callback(null, true);
    if (normalizedAllowedOriginSet.has(normalizeOrigin(origin))) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); // ✅ THIS IS ENOUGH (handles OPTIONS automatically)

// Cookie Parser
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ============ ROUTES ============
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const googleWhitelistRoutes = require('./routes/googleWhitelistRoutes');
const residentRoutes = require('./routes/residentRoutes');
const vaccineRoutes = require('./routes/vaccineRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const bmiRoutes = require('./routes/bmiRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const homeRoutes = require('./routes/homeRoutes');
const myFamilyRoutes = require('./routes/myFamilyRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/google-whitelist', googleWhitelistRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/vaccines', vaccineRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/bmi', bmiRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/my-family', myFamilyRoutes);

// Dev-only unauthenticated import test route (bypass router auth)
if (process.env.NODE_ENV !== 'production') {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  const { importMonthlyReport } = require('./controllers/monthly_reportController');
  app.post('/import-test', upload.single('file'), importMonthlyReport);
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'BHW Backend API',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// ============ ERROR HANDLING ============

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(err.status || 500).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && { error: err.message })
  });
});

// ============ SERVER START ============

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('CORS allowed origins:', allowAllOrigins ? '*' : allowedOrigins.join(', '));

if (NODE_ENV === 'production' && !process.env.HTTPS_ENABLED) {
  console.warn('⚠️  WARNING: HTTPS is not enabled. Set HTTPS_ENABLED=true');
}

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  BHW Nutrition Tracker Backend         ║
║  Environment: ${NODE_ENV.padEnd(23)}   ║
║  Port: ${PORT.toString().padEnd(31)}   ║
║  Secure: ${(NODE_ENV === 'production' ? 'HTTPS' : 'HTTP').padEnd(28)} ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;