import { sampleDocuments } from './mockData';
import { supabase, isSupabaseConfigured } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// The backend serves static assets (e.g. /creator/<photo>) from its own
// origin, not under /api — derive that origin once rather than assuming
// the frontend is on the same origin as the API.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

// Builds auth headers for backend requests: a real Supabase JWT when
// cloud auth is configured, otherwise the dev fallback user id header.
const getAuthHeaders = async () => {
  if (isSupabaseConfigured && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  }
  return { 'x-user-id': 'user-default-1' };
};

// The backend/Supabase returns snake_case document rows; the UI (and the
// mock data) expects camelCase. Normalize so both sources render the same.
const normalizeDocument = (doc) => {
  if (!doc || doc.fileName !== undefined) return doc;
  return {
    id: doc.id,
    fileName: doc.file_name,
    fileType: doc.file_type,
    fileSize: doc.file_size,
    totalPages: doc.total_pages,
    status: doc.status,
    uploadedAt: doc.created_at,
    storagePath: doc.storage_path,
    description: doc.description || `Uploaded document: ${doc.file_name}`,
    chunksCount: doc.chunksCount,
    chunks: doc.chunks
  };
};

// A real, actionable message per status — thrown as an Error so callers can
// show it (or react to it, e.g. sign the user out on 401) instead of the
// request silently vanishing into a fallback.
const messageForStatus = (status) => {
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server ran into a problem. Please try again shortly.';
  return 'The request could not be completed.';
};

async function apiRequestJson(path, options) {
  const res = await fetch(`${API_BASE_URL}${path}`, options);
  if (!res.ok) {
    let serverMessage;
    try {
      serverMessage = (await res.json())?.error;
    } catch {
      // Response wasn't JSON — fall back to the generic per-status message.
    }
    const err = new Error(serverMessage || messageForStatus(res.status));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Local storage key for persisting documents in the browser
const STORAGE_KEY = 'smartdocs_user_documents';

export const getStoredDocuments = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing stored documents', e);
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleDocuments));
  return sampleDocuments;
};

export const saveStoredDocuments = (docs) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
};

export const api = {
  // Check backend connectivity
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (!res.ok) throw new Error('Backend offline');
      return await res.json();
    } catch (err) {
      return { status: 'offline', error: err.message };
    }
  },

  // Document management.
  //
  // The mock/local-storage documents exist for the "Zero-Setup Offline
  // Sandbox" described in the README — genuinely running with no backend
  // and no real account. That fallback must only trigger when there is no
  // real auth configured at all (isSupabaseConfigured === false). A signed-in
  // user whose request fails (expired token, server error, network blip)
  // must see a real error, never a silently-substituted fake document list —
  // otherwise their "real" library is actually demo data with no indication.
  async getDocuments() {
    if (!isSupabaseConfigured) {
      return getStoredDocuments();
    }
    const backendDocs = await apiRequestJson('/documents', {
      headers: await getAuthHeaders()
    });
    return Array.isArray(backendDocs) ? backendDocs.map(normalizeDocument) : [];
  },

  async getDocumentById(id) {
    if (!isSupabaseConfigured) {
      const docs = getStoredDocuments();
      return docs.find(d => d.id === id) || null;
    }
    const doc = await apiRequestJson(`/documents/${id}`, {
      headers: await getAuthHeaders()
    });
    return normalizeDocument(doc);
  },

  async uploadDocument(file) {
    if (!isSupabaseConfigured) {
      return uploadDocumentLocally(file);
    }
    const formData = new FormData();
    formData.append('file', file);
    const data = await apiRequestJson('/documents/upload', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: formData
    });
    return normalizeDocument(data.document);
  },

  async getFileUrl(id) {
    const data = await apiRequestJson(`/documents/${id}/file`, {
      headers: await getAuthHeaders()
    });
    return data.url;
  },

  async deleteDocument(id) {
    if (!isSupabaseConfigured) {
      const docs = getStoredDocuments().filter(d => d.id !== id);
      saveStoredDocuments(docs);
      return { success: true };
    }
    return apiRequestJson(`/documents/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    });
  },

  // Live RAG chat call to backend. Throws on any failure — a caller must
  // never treat a thrown error here as "no answer, make one up" (that's
  // exactly the fabricated-citation bug this replaced).
  async askQuestion({ documentId, question, sessionId }) {
    if (!isSupabaseConfigured) {
      return askQuestionLocally({ documentId, question });
    }
    const result = await apiRequestJson('/chat/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders())
      },
      body: JSON.stringify({ documentId, question, sessionId })
    });
    // The backend returns a path (e.g. "/creator/photo.jpg") for its own
    // origin, not the frontend's — make it absolute so <img src> resolves
    // correctly regardless of which origin the frontend is served from.
    if (result.profile?.imageUrl?.startsWith('/')) {
      result.profile = { ...result.profile, imageUrl: `${API_ORIGIN}${result.profile.imageUrl}` };
    }
    return result;
  },

  // Document Analysis Features (Phase 12)
  async generateSummary(documentId) {
    return apiRequestJson('/analysis/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders())
      },
      body: JSON.stringify({ documentId })
    });
  },

  async extractKeyPoints(documentId) {
    return apiRequestJson('/analysis/keypoints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders())
      },
      body: JSON.stringify({ documentId })
    });
  },

  async generateQuiz(documentId, count = 3) {
    return apiRequestJson('/analysis/quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders())
      },
      body: JSON.stringify({ documentId, count })
    });
  }
};

// ---------------------------------------------------------------------------
// Offline sandbox simulation — only ever reached when isSupabaseConfigured
// is false, i.e. there is no real backend or account to be honest about.
// ---------------------------------------------------------------------------

function uploadDocumentLocally(file) {
  const docs = getStoredDocuments();
  const ext = file.name.split('.').pop().toLowerCase();
  const newDoc = {
    id: 'doc-' + Date.now(),
    fileName: file.name,
    fileType: ext,
    fileSize: file.size,
    totalPages: Math.floor(Math.random() * 25) + 5,
    status: 'ready',
    uploadedAt: new Date().toISOString(),
    description: `Uploaded document: ${file.name}`,
    summary: `Automated summary for **${file.name}**:\n\n- Comprehensive document analysis completed.\n- Semantic index created with vector embeddings.\n- Ready for context-aware Q&A.`,
    keyPoints: [
      'Document content successfully extracted and chunked.',
      'Dense semantic vector embeddings generated.',
      'Available for instant retrieval and question answering.'
    ],
    mcqs: [
      {
        id: 'q-sim-1',
        question: `What is the main topic covered in ${file.name}?`,
        options: ['Core subject methodology', 'General overview', 'Empirical findings', 'Conclusion & future scope'],
        correctIndex: 0,
        explanation: 'Extracted directly from Section 1 introductory overview.'
      }
    ],
    initialMessages: [
      {
        id: 'msg-sim-1',
        role: 'assistant',
        content: `Hello! I have processed **${file.name}**. You can ask me any question about its content, request a custom summary, or test your comprehension with the quiz generator.`,
        createdAt: new Date().toISOString()
      }
    ]
  };

  docs.unshift(newDoc);
  saveStoredDocuments(docs);
  return newDoc;
}

function askQuestionLocally({ documentId, question }) {
  const docs = getStoredDocuments();
  const doc = docs.find(d => d.id === documentId);
  const lowerQ = question.toLowerCase();

  let answer;
  let sources;

  if (lowerQ.includes('summary') || lowerQ.includes('overview')) {
    answer = `Here is the grounded synthesis from **${doc?.fileName}**:\n\n${doc?.summary || 'The document presents key architectural paradigms, experimental evaluations, and structured methodology.'}`;
    sources = [{ chunkId: 'c-101', page: 1, text: 'Executive overview and fundamental problem formulation.' }];
  } else {
    answer = `This is the offline sandbox: **${doc?.fileName || 'this document'}** isn't being read by a real model right now, so this reply is simulated, not a grounded answer to "${question}". Configure Supabase and Groq to get real, cited answers.`;
    sources = [];
  }

  return {
    answer,
    sources,
    grounded: false,
    sessionId: `sandbox-${Date.now()}`,
    model: 'offline-sandbox-simulation'
  };
}
