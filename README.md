# SMARTDOCS AI
> **An AI-Powered Intelligent Document Question Answering and Analysis System**

SMARTDOCS AI is a full-stack, cloud-native web application built with **React + Vite**, **Node.js + Express**, **Supabase** (PostgreSQL, pgvector, Storage, Auth), and **Groq (Qwen LLM)**. It allows users to upload PDF and DOCX documents and interact with them through context-grounded AI conversations, executive summaries, key concept breakdowns, and practice quizzes.

---

## 🏛️ System Architecture

```
                                  ┌─────────────────────┐
                                  │   React + Vite UI   │
                                  │      (Port 5173)    │
                                  └──────────┬──────────┘
                                             │ HTTP REST / Auth JWT
                                             ▼
                                  ┌─────────────────────┐
                                  │  Express API Server │
                                  │      (Port 5000)    │
                                  └─────┬──────────┬────┘
                                        │          │
                     ┌──────────────────┘          └──────────────────┐
                     ▼                                                ▼
     ┌───────────────────────────────┐                ┌───────────────────────────────┐
     │       Supabase Services       │                │      AI Ingestion & RAG       │
     │ ├── Supabase Authentication   │                │ ├── pdf-parse & mammoth       │
     │ ├── Supabase Storage (Files)  │                │ ├── Sliding Window Chunker    │
     │ ├── PostgreSQL Database       │                │ ├── 1536-D Vector Embeddings  │
     │ └── pgvector Extension (HNSW) │                │ └── Qwen 2.5 LLM (via Groq)   │
     └───────────────────────────────┘                └───────────────────────────────┘
```

---

## ✨ Features Implemented

1. **Multi-Format Ingestion**: Upload `.pdf` and `.docx` files with client & server-side validation (max 20MB).
2. **Text Chunking Engine**: Sliding-window chunker with overlapping boundaries (`chunkSize: 800`, `chunkOverlap: 150`) preserving natural paragraph and sentence structure.
3. **Dedicated Embedding Pipeline**: Decoupled vectorization generating 1536-dimensional normalized embeddings for Supabase pgvector.
4. **Vector Similarity Search (RAG)**: Cosine distance similarity search via `match_document_chunks` RPC, strictly scoped by `user_id` and `document_id`.
5. **Context-Grounded Chatbot**: Powered by Qwen via Groq with strict anti-hallucination guardrails and clickable **Page Citation Badges** (e.g. `Page 28 • Chunk #104`).
6. **Executive Document Summaries**: Automated synthesis of document objectives, key themes, and conclusions with one-click clipboard copying.
7. **Key Points & Concepts Extractor**: Numbered core takeaways and definitions.
8. **Interactive Revision Quizzes & MCQs**: Practice questions with multiple-choice options, instant visual feedback, and explanations.
9. **Multi-Tenant Security**: Supabase Row-Level Security (RLS) on all database tables and storage policies.
10. **Zero-Setup Offline Sandbox**: Built-in mock data and local vector fallbacks so the application runs immediately without requiring API keys on day one.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18 or higher (tested on Node v26)
- **npm**: v9 or higher

### 2. Install Dependencies
```bash
# In client/
cd client
npm install

# In server/
cd ../server
npm install
```

### 3. Run Development Servers
You can run both servers independently:

**Backend Server (Port 5000):**
```bash
cd server
npm run dev
```

**Frontend Client (Port 5173):**
```bash
cd client
npm run dev
```

Open your browser to:
👉 **http://localhost:5173**

---

## 🔑 Environment Variables Configuration

When connecting your live cloud services, create `.env` files in both directories:

### Client (`client/.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000/api
```

### Server (`server/.env`)
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=qwen-2.5-32b
EMBEDDING_API_KEY=your_openai_or_embedding_key
```

---

## 🗄️ Database Setup (Supabase PostgreSQL)

To set up the cloud database:
1. Open your Supabase project dashboard at [supabase.com](https://supabase.com).
2. Navigate to **SQL Editor**.
3. Copy and run the entire SQL script from [`server/src/db/schema.sql`](./server/src/db/schema.sql).
   - Enables `vector` extension.
   - Creates `documents`, `document_chunks`, `chat_sessions`, and `chat_messages` tables.
   - Builds HNSW vector index for high-speed similarity search.
   - Defines the `match_document_chunks` RPC search function.
   - Configures Row Level Security (RLS) policies.
4. Navigate to **Storage** -> Create a private bucket named `documents`.

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status and configured integrations |
| `GET` | `/api/auth/me` | Validates JWT token and returns user profile |
| `POST` | `/api/documents/upload` | Uploads, parses (PDF/DOCX), and chunks a document |
| `GET` | `/api/documents` | Lists all documents for the authenticated user |
| `GET` | `/api/documents/:id` | Retrieves document metadata and indexed chunks |
| `DELETE` | `/api/documents/:id` | Deletes document, chunks, and storage binary |
| `POST` | `/api/chat/ask` | RAG query: question vectorization, similarity search, Qwen generation |
| `GET` | `/api/chat/messages/:sessionId` | Retrieves persistent chat history |
| `POST` | `/api/analysis/summary` | Generates structured executive summary |
| `POST` | `/api/analysis/keypoints` | Extracts bulleted core concepts and key points |
| `POST` | `/api/analysis/quiz` | Generates interactive revision MCQs with answer keys |

---

## 📂 Project Structure

```text
SMARTDOCS AI/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── components/         # Navbar, Footer, DocumentCard, UploadModal, ProtectedRoute
│   │   ├── context/            # AuthContext (Supabase Auth + local fallback)
│   │   ├── pages/              # LandingPage, LoginPage, RegisterPage, DashboardPage, DocumentWorkspacePage
│   │   ├── services/           # api.js, supabase.js, mockData.js
│   │   ├── App.jsx             # React Router routing & layout
│   │   ├── index.css           # Tailwind CSS directives
│   │   └── main.jsx
│   └── package.json
├── server/                     # Node.js + Express Backend
│   ├── src/
│   │   ├── config/             # Config loader & Supabase client instances
│   │   ├── db/                 # schema.sql (pgvector, tables, RLS, RPC functions)
│   │   ├── middleware/         # auth.js (JWT validation)
│   │   ├── routes/             # health.js, documents.js, chat.js, analysis.js
│   │   ├── services/           # parser.js, chunker.js, embeddingService.js, ragService.js, aiService.js, analysisService.js
│   │   └── server.js           # Express app entrypoint
│   └── package.json
├── scratch/                    # Test scripts (RAG verification, chunking test)
├── README.md                   # Project overview & documentation
└── DEPLOYMENT.md               # Production deployment manual
```

