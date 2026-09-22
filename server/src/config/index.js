import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    defaultModel: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
  },
  embeddings: {
    apiKey: process.env.EMBEDDING_API_KEY || '',
  },
  rag: {
    // Single source of truth for the retrieval similarity cutoff. Previously
    // this value was duplicated (and drifted) across schema.sql's RPC
    // default (0.65), chat.js's call site (0.30), and ragService's own
    // default parameter (0.35) — three different numbers all claiming to be
    // "the" threshold, only one of which was actually reachable in practice.
    similarityThreshold: Number(process.env.RAG_SIMILARITY_THRESHOLD) || 0.30,
    topK: Number(process.env.RAG_TOP_K) || 4,
  }
};

