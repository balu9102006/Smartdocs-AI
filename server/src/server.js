import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import healthRouter from './routes/health.js';
import documentsRouter from './routes/documents.js';
import chatRouter from './routes/chat.js';
import analysisRouter from './routes/analysis.js';
import { requireAuth } from './middleware/auth.js';

const app = express();

// Middleware
// Security headers: blocks clickjacking (frame-ancestors), disables
// X-Powered-By tech-stack disclosure, sets standard hardening headers.
// This API serves only JSON, so CSP's default-src restrictions are safe here.
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim()) : [])
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/analysis', analysisRouter);

// Auth verification endpoint
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    status: 'authenticated',
    user: req.user
  });
});

// Root greeting
app.get('/', (req, res) => {
  res.json({
    name: 'SMARTDOCS AI API Server',
    status: 'online',
    docs: '/api/health'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  // Multer errors (file too large, unexpected field, etc.) are always
  // client-side validation issues, not server failures.
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  // Malformed request bodies leak raw parser internals in err.message
  // (e.g. exact byte position) — return a generic message instead.
  const message = err.type === 'entity.parse.failed'
    ? 'Malformed request body'
    : (err.message || 'Internal Server Error');
  res.status(status).json({ error: message });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(` SMARTDOCS AI Server running on port ${PORT}`);
  console.log(` Mode: ${config.nodeEnv}`);
  console.log(` Health: http://localhost:${PORT}/api/health`);
  console.log(`=============================================`);
});
