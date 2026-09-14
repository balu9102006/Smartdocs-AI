import express from 'express';
import { ragService } from '../services/ragService.js';
import { aiService } from '../services/aiService.js';
import { documentService } from '../services/documentService.js';
import { isCreatorQuestion, buildCreatorResponse } from '../services/creatorService.js';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase.js';

const router = express.Router();

// In-memory chat storage for local sandbox mode
const localChatSessions = new Map();
const localChatMessages = new Map();

/**
 * POST /api/chat/ask
 * Executes the full RAG pipeline:
 * Question -> Query Embedding -> pgvector similarity search -> Relevant Chunks -> Qwen via Groq -> Grounded Answer
 */
router.post('/ask', requireAuth, async (req, res, next) => {
  try {
    const { documentId, question, sessionId } = req.body;
    const userId = req.user?.id || 'user-default-1';

    if (!documentId || !question) {
      return res.status(400).json({ error: 'Both documentId and question are required.' });
    }

    // Questions about who built SMARTDOCS AI are answered directly —
    // they are about the app itself, not the uploaded document.
    if (isCreatorQuestion(question)) {
      const creator = buildCreatorResponse();
      return res.json({
        ...creator,
        sessionId: sessionId || `sess-${Date.now()}`,
        model: 'smartdocs-system'
      });
    }

    // 1. Fetch document metadata
    const doc = await documentService.getDocumentById(documentId, userId);
    const documentName = doc?.fileName || doc?.file_name || 'Document';

    // 2. Perform vector retrieval (pgvector / similarity search)
    const relevantChunks = await ragService.retrieveContextChunks({
      documentId,
      question,
      userId,
      topK: 4,
      threshold: 0.30
    });

    // 3. Generate answer using Qwen via Groq
    const aiResult = await aiService.generateAnswer({
      question,
      relevantChunks,
      documentName
    });

    // 4. Persist conversation
    const activeSessionId = sessionId || `sess-${Date.now()}`;

    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        // Save user question and assistant answer
        await supabaseAdmin.from('chat_messages').insert([
          {
            session_id: activeSessionId,
            role: 'user',
            content: question
          },
          {
            session_id: activeSessionId,
            role: 'assistant',
            content: aiResult.answer,
            sources: aiResult.sources
          }
        ]);
      } catch (dbErr) {
        console.warn('[ChatRouter] Could not persist message to Supabase:', dbErr.message);
      }
    } else {
      // Local session storage
      const existing = localChatMessages.get(activeSessionId) || [];
      existing.push(
        {
          id: 'msg-' + Date.now(),
          role: 'user',
          content: question,
          createdAt: new Date().toISOString()
        },
        {
          id: 'msg-' + (Date.now() + 1),
          role: 'assistant',
          content: aiResult.answer,
          sources: aiResult.sources,
          createdAt: new Date().toISOString()
        }
      );
      localChatMessages.set(activeSessionId, existing);
    }

    // 5. Return grounded response
    res.json({
      answer: aiResult.answer,
      sources: aiResult.sources,
      sessionId: activeSessionId,
      model: aiResult.model
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/chat/messages/:sessionId
 * Retrieves previous conversation messages for a session.
 */
router.get('/messages/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (isSupabaseConfigured && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.json(data || []);
    }

    const messages = localChatMessages.get(sessionId) || [];
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

export default router;

