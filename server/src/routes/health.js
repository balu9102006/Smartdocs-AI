import express from 'express';
import { config } from '../config/index.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SMARTDOCS AI Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    configuredServices: {
      supabase: Boolean(config.supabase.url && config.supabase.anonKey),
      groq: Boolean(config.groq.apiKey),
      embeddings: Boolean(config.embeddings.apiKey),
    }
  });
});

export default router;

