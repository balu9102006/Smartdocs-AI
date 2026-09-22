import { sampleDocuments } from './mockData';
import { supabase, isSupabaseConfigured } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  // Document management
  async getDocuments() {
    try {
      const res = await fetch(`${API_BASE_URL}/documents`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const backendDocs = await res.json();
        if (Array.isArray(backendDocs)) return backendDocs.map(normalizeDocument);
      }
    } catch {
      // Fallback to local storage
    }
    return getStoredDocuments();
  },

  async getDocumentById(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        return normalizeDocument(await res.json());
      }
    } catch {
      // Fallback to local storage
    }
    const docs = getStoredDocuments();
    return docs.find(d => d.id === id) || null;
  },

  async uploadDocument(file) {
    // Attempt backend upload
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        const createdDoc = normalizeDocument(data.document);
        // Also sync into local storage so it displays immediately
        const docs = getStoredDocuments();
        docs.unshift(createdDoc);
        saveStoredDocuments(docs);
        return createdDoc;
      }
    } catch (err) {
      console.warn('Backend upload fell back to local storage:', err);
    }

    // Local simulation for instant testing
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
  },

  async getFileUrl(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}/file`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch (err) {
      console.warn('[API] Could not get file URL:', err);
    }
    return null;
  },

  async deleteDocument(id) {
    // The local mirror can hold a stale copy of any document (synced on
    // upload for instant display), so it must be pruned on every delete
    // path - otherwise a deleted document keeps surfacing via the
    // by-id fallback below once the real backend correctly 404s it.
    const docs = getStoredDocuments().filter(d => d.id !== id);
    saveStoredDocuments(docs);

    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[API] Delete request fell back to local storage:', err);
    }

    return { success: true };
  },

  // Live RAG chat call to backend
  async askQuestion({ documentId, question, sessionId }) {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({
          documentId,
          question,
          sessionId
        })
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[API] Chat request fell back to client generator:', err);
    }
    return null;
  },

  // Document Analysis Features (Phase 12)
  async generateSummary(documentId) {
    try {
      const res = await fetch(`${API_BASE_URL}/analysis/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({ documentId })
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[API] Summary request fell back to local:', err);
    }
    return null;
  },

  async extractKeyPoints(documentId) {
    try {
      const res = await fetch(`${API_BASE_URL}/analysis/keypoints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({ documentId })
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[API] Key points request fell back to local:', err);
    }
    return null;
  },

  async generateQuiz(documentId, count = 3) {
    try {
      const res = await fetch(`${API_BASE_URL}/analysis/quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({ documentId, count })
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[API] Quiz request fell back to local:', err);
    }
    return null;
  }
};

