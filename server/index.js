require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { initDatabase } = require('./db');
const { securityLoggerMiddleware } = require('./middleware/securityLogger');

const authRoutes = require('./routes/auth');
const deptRoutes = require('./routes/departments');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const tokenRoutes = require('./routes/tokens');
const queueRoutes = require('./routes/queue');
const doctorPortalRoutes = require('./routes/doctor');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Security Headers via Helmet (configured to allow local scripts & styles)
app.use(
  helmet({
    contentSecurityPolicy: false, // relaxed for local static html/js hackathon demo
    crossOriginEmbedderPolicy: false
  })
);

// 2. Request body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 3. Cookie-based Session Configuration
app.use(
  session({
    name: 'queueseva.sid',
    secret: process.env.SESSION_SECRET || 'queueseva-cyber-samvad-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000 // 30 minutes idle timeout
    }
  })
);

// 4. Attach Security Logger Middleware
app.use(securityLoggerMiddleware);

// 5. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', deptRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/doctor', doctorPortalRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'QueueSeva Smart Hospital Queue Management',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// 6. Serve Frontend Static Assets
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Friendly fallback for direct page access
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'API endpoint not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.code || 'SERVER_ERROR',
    message: err.message || 'An unexpected error occurred.'
  });
});

// Start Server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`  QueueSeva Server running at http://localhost:${PORT}`);
    console.log(`  Public Display:    http://localhost:${PORT}/display.html`);
    console.log(`  Staff Dashboard:   http://localhost:${PORT}/staff.html`);
    console.log(`  Doctor Dashboard:  http://localhost:${PORT}/doctor.html`);
    console.log(`  Security Demo:     http://localhost:${PORT}/unauthorized.html`);
    console.log(`===================================================`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
