import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { isSupabaseConfigured } from './config/supabase.js';
import healthRouter from './routes/health.js';
import documentsRouter from './routes/documents.js';
import chatRouter from './routes/chat.js';
import analysisRouter from './routes/analysis.js';
import { requireAuth } from './middleware/auth.js';
import { CREATOR_IMAGE_DIR } from './services/creatorService.js';

// A missing/misconfigured Supabase env var silently drops auth into a dev
// fallback mode that trusts a client-supplied x-user-id header — an
// unauthenticated, impersonatable multi-tenant data store. That must never
// happen in production, so refuse to boot rather than serve traffic that way.
if (config.nodeEnv === 'production' && !isSupabaseConfigured) {
  console.error('=============================================');
  console.error(' FATAL: Supabase is not configured.');
  console.error(' Refusing to start in production without real');
  console.error(' auth — this would otherwise trust a client-');
  console.error(' supplied x-user-id header with no verification.');
  console.error(' Set SUPABASE_URL, SUPABASE_ANON_KEY and');
  console.error(' SUPABASE_SERVICE_ROLE_KEY and restart.');
  console.error('=============================================');
  process.exit(1);
}

// GROQ_API_KEY and EMBEDDING_API_KEY aren't boot-fatal (there are working
// local fallbacks for both), but silently running on them with no signal is
// exactly how this app has previously shipped with a degraded config
// unnoticed — a quick, honest summary at startup costs nothing.
const looksUnset = (value, placeholderPattern) => !value || placeholderPattern.test(value);
const configWarnings = [];
if (looksUnset(config.groq.apiKey, /your_groq/i)) {
  configWarnings.push('GROQ_API_KEY is not set — chat answers and analysis (summary/key points/quiz) will use the local simulated generator, and OCR for scanned/handwritten pages is unavailable.');
}
if (looksUnset(config.embeddings.apiKey, /your_/i)) {
  configWarnings.push('EMBEDDING_API_KEY is not set — documents will be indexed with the degraded hash-based fallback instead of real semantic embeddings (see embeddingService.js).');
}
if (configWarnings.length > 0) {
  console.warn('=============================================');
  console.warn(' Starting with a degraded configuration:');
  configWarnings.forEach((w) => console.warn(' - ' + w));
  console.warn('=============================================');
}

const app = express();

// Middleware
// Security headers: blocks clickjacking (frame-ancestors), disables
// X-Powered-By tech-stack disclosure, sets standard hardening headers.
// This API serves only JSON, so CSP's default-src restrictions are safe here.
// Helmet's default Cross-Origin-Resource-Policy is "same-origin", which
// blocks the frontend (a different origin, e.g. Vercel) from reading this
// API's responses even with CORS configured correctly below.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
// localhost origins are for local development only — leaving them allowed
// in production would mean anyone running a local dev server could make
// credentialed requests against the real API.
const allowedOrigins = [
  ...(config.nodeEnv !== 'production'
    ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
    : []),
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim()) : [])
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
// File uploads go through multer (multipart/form-data), not this JSON
// parser — no legitimate request here is more than a few KB (a question,
// document metadata, etc.), so 50mb was pure unused attack surface for a
// large-body DoS.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// The backend owns and serves this asset itself — no dependency on the
// client package's directory being present in this container (it wasn't,
// in the production Docker image; see creatorService.js).
app.use('/creator', express.static(CREATOR_IMAGE_DIR));

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
  // Errors we threw deliberately (err.status set, e.g. "Document not
  // found") carry a message that's already safe to show. Anything that
  // fell through to an unhandled 500 — a raw Postgres/Supabase error,
  // a stack trace message, etc. — must not reach the client verbatim.
  let message;
  if (err.type === 'entity.parse.failed') {
    message = 'Malformed request body';
  } else if (err.status) {
    message = err.message || 'Request failed';
  } else {
    message = 'Internal server error';
  }
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
