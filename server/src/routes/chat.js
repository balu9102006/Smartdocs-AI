import express from 'express';
import { randomUUID } from 'crypto';
import { ragService } from '../services/ragService.js';
import { aiService } from '../services/aiService.js';
import { documentService } from '../services/documentService.js';
import { isCreatorQuestion, buildCreatorResponse } from '../services/creatorService.js';
import { requireAuth } from '../middleware/auth.js';
import { llmRateLimiter } from '../middleware/rateLimit.js';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase.js';
import { config } from '../config/index.js';

const MAX_QUESTION_LENGTH = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router = express.Router();

// In-memory chat storage for local sandbox mode
const localChatSessions = new Map();
const localChatMessages = new Map();

/**
 * POST /api/chat/ask
 * Executes the full RAG pipeline:
 * Question -> Query Embedding -> pgvector similarity search -> Relevant Chunks -> Qwen via Groq -> Grounded Answer
 */
router.post('/ask', requireAuth, llmRateLimiter, async (req, res, next) => {
  try {
    const { documentId, question, sessionId } = req.body;
    const userId = req.user?.id || 'user-default-1';

    if (!documentId || !question) {
      return res.status(400).json({ error: 'Both documentId and question are required.' });
    }
    if (typeof question !== 'string' || question.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({ error: `Question must be a string of at most ${MAX_QUESTION_LENGTH} characters.` });
    }

    // Questions about who built SMARTDOCS AI are answered directly —
    // they are about the app itself, not the uploaded document.
    if (isCreatorQuestion(question)) {
      const creator = buildCreatorResponse();
      return res.json({
        ...creator,
        sessionId: sessionId && UUID_RE.test(sessionId) ? sessionId : randomUUID(),
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
      topK: config.rag.topK,
      threshold: config.rag.similarityThreshold
    });

    // 3. Generate answer using Qwen via Groq
    const aiResult = await aiService.generateAnswer({
      question,
      relevantChunks,
      documentName
    });

    // 4. Persist conversation
    // chat_messages.session_id is a uuid FK into chat_sessions — a client
    // may pass back whatever this endpoint returned last time, but if it's
    // not a real uuid (or is missing, e.g. the first message), mint a fresh
    // one rather than writing a value the FK constraint will reject.
    const activeSessionId = sessionId && UUID_RE.test(sessionId) ? sessionId : randomUUID();
    const localStoreKey = `${userId}:${activeSessionId}`;

    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        // Ensure the parent chat_sessions row exists before inserting
        // messages into it. ignoreDuplicates means an existing session
        // (later messages in the same conversation) is left untouched
        // rather than having its title overwritten every turn.
        const { error: sessionError } = await supabaseAdmin
          .from('chat_sessions')
          .upsert(
            { id: activeSessionId, user_id: userId, document_id: documentId, title: question.slice(0, 60) },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        if (sessionError) throw sessionError;

        // Save user question and assistant answer. supabase-js resolves
        // even on failure (it returns { error }, it doesn't throw) — the
        // error must be checked explicitly or a failed write disappears
        // silently, which is exactly how this was broken before.
        const { error: messagesError } = await supabaseAdmin.from('chat_messages').insert([
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
        if (messagesError) throw messagesError;
      } catch (dbErr) {
        console.warn('[ChatRouter] Could not persist message to Supabase:', dbErr.message);
      }
    } else {
      // Local session storage, keyed per-user so one local session id can't
      // read another local user's messages (see the /messages/:sessionId
      // handler below).
      const existing = localChatMessages.get(localStoreKey) || [];
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
      localChatMessages.set(localStoreKey, existing);
    }

    // 5. Return grounded response
    res.json({
      answer: aiResult.answer,
      sources: aiResult.sources,
      grounded: aiResult.grounded !== false,
      // Only present on ungrounded answers — a separate, clearly-unverified
      // general-knowledge answer the UI renders in its own distinct block,
      // never merged into the grounded answer above.
      externalAnswer: aiResult.externalAnswer || null,
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
    const userId = req.user?.id || 'user-default-1';

    // chat_sessions.id is a uuid column; a malformed/non-uuid id can never
    // match a row, so treat it the same as "not found" instead of letting
    // the Postgres type error fall through to a 500.
    if (isSupabaseConfigured && supabaseAdmin) {
      if (!UUID_RE.test(sessionId)) {
        return res.status(404).json({ error: 'Chat session not found' });
      }

      // Session ids are not secret (they're timestamp-derived), so the
      // session must be proven to belong to this user before any of its
      // messages are returned — otherwise any authenticated user could
      // enumerate ids and read other users' conversations.
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) {
        return res.status(404).json({ error: 'Chat session not found' });
      }

      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.json(data || []);
    }

    const messages = localChatMessages.get(`${userId}:${sessionId}`) || [];
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

export default router;

