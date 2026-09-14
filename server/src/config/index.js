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
  }
};

