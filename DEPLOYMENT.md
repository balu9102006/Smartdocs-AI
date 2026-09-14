# Production Deployment Guide: SMARTDOCS AI

This guide walks you through deploying **SMARTDOCS AI** to production across cloud hosting platforms.

---

## Architecture in Production

- **Frontend**: Hosted on [Vercel](https://vercel.com) or [Netlify](https://netlify.com)
- **Backend**: Hosted on [Fly.io](https://fly.io) (recommended, no cold starts on free tier), [Render](https://render.com), or [Railway](https://railway.app)
- **Database & Storage**: [Supabase](https://supabase.com) (PostgreSQL, pgvector, Storage)
- **AI Inference**: [Groq](https://console.groq.com) (Qwen 2.5)

---

## 1. Supabase Database & Storage Setup

1. Log in to [Supabase Console](https://supabase.com) and create a new project.
2. Go to **SQL Editor** -> Click **New Query**.
3. Paste the complete SQL script from `server/src/db/schema.sql` and click **Run**:
   - Activates `vector` extension.
   - Creates all tables (`documents`, `document_chunks`, `chat_sessions`, `chat_messages`).
   - Creates HNSW index on embeddings.
   - Creates the `match_document_chunks` RPC function.
   - Applies Row Level Security (RLS) policies.
4. Go to **Storage** -> Click **New Bucket**:
   - Name: `documents`
   - Public bucket: **Disabled (Private)**
5. Go to **Project Settings** -> **API**:
   - Note your **Project URL**
   - Note your **anon (public) key**
   - Note your **service_role (secret) key**

---

## 2. Groq Cloud API Key

1. Sign up or log in at [console.groq.com](https://console.groq.com).
2. Go to **API Keys** -> Create a new key.
3. Save the key for your backend environment.

---

## 3. Backend Deployment

### Deploying to Fly.io (recommended — free tier stays always-on, no cold starts):
1. Install the CLI and sign in:
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```
2. From the `server` directory, register the app (config already exists in `server/fly.toml`):
   ```bash
   cd server
   fly launch --no-deploy
   ```
   When prompted, choose "Yes" to use the existing `fly.toml`, and pick a unique app name if `smartdocs-ai-server` is taken (edit the `app` field in `fly.toml` to match).
3. Set secrets (these are never stored in `fly.toml`):
   ```bash
   fly secrets set SUPABASE_URL=https://your-project.supabase.co
   fly secrets set SUPABASE_ANON_KEY=your_anon_key
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   fly secrets set GROQ_API_KEY=your_groq_api_key
   fly secrets set GROQ_MODEL=qwen-2.5-32b
   fly secrets set EMBEDDING_API_KEY=your_embedding_or_gemini_key
   fly secrets set CLIENT_ORIGIN=https://your-frontend.vercel.app
   ```
4. Deploy:
   ```bash
   fly deploy
   ```
5. Copy your public backend URL (e.g. `https://smartdocs-ai-server.fly.dev`) for use in the frontend's `VITE_API_URL`.

Fly's free allowance (`shared-cpu-1x`, 256MB) covers a single always-on machine — `fly.toml` sets `min_machines_running = 1` and `auto_stop_machines = false` so the backend never sleeps between requests, unlike Render/Railway free tiers.

### Deploying to Render:
1. Create a new **Web Service** on [Render](https://render.com) connected to your GitHub repo.
2. Configure settings:
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Add Environment Variables:
   | Variable | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (Render default) |
   | `SUPABASE_URL` | `https://your-project.supabase.co` |
   | `SUPABASE_ANON_KEY` | `your_anon_key` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `your_service_role_key` |
   | `GROQ_API_KEY` | `your_groq_api_key` |
   | `GROQ_MODEL` | `qwen-2.5-32b` |
   | `EMBEDDING_API_KEY` | `your_embedding_or_openai_key` |
   | `CLIENT_ORIGIN` | `https://your-frontend.vercel.app` |
4. Deploy the service and copy your public backend URL (e.g. `https://smartdocs-server.onrender.com`).

---

## 4. Frontend Deployment (Vercel)

### Deploying to Vercel:
1. Import your GitHub repository to [Vercel](https://vercel.com).
2. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. Add Environment Variables:
   | Variable | Value |
   | :--- | :--- |
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `your_anon_key` |
   | `VITE_API_URL` | `https://smartdocs-ai-server.fly.dev/api` (or your Render/Railway URL) |
4. Click **Deploy**.
5. Once deployed, copy the Vercel URL and set it as `CLIENT_ORIGIN` on the backend (see step 3), so the API's CORS check allows requests from it.

`client/vercel.json` already rewrites every path to `index.html`, which React Router needs — without it, a direct visit or refresh on `/dashboard` or `/document/:id` 404s on Vercel's static host.

---

## 5. Post-Deployment Verification

1. Open your production frontend URL.
2. Register a new user account (verifies Supabase Auth).
3. Upload a sample PDF or DOCX file (verifies Multer, Supabase Storage, and parser).
4. Send a question in the chat (verifies pgvector similarity retrieval and Qwen generation via Groq).
5. Open the **Summary**, **Key Points**, and **Quiz** tabs to verify document intelligence features.

