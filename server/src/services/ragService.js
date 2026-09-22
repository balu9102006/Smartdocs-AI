import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase.js';
import { embeddingService } from './embeddingService.js';
import { documentService } from './documentService.js';

export const ragService = {
  /**
   * Retrieves the most semantically relevant chunks for a question.
   */
  async retrieveContextChunks({ documentId, question, userId, topK = 4, threshold = 0.35 }) {
    console.log(`[RAGService] Retrieving chunks for question: "${question}" (doc: ${documentId})`);

    // 1. Find out which embedding space this document's chunks were
    // written into, so the question is embedded the SAME way — comparing a
    // real Gemini embedding against a hash-fallback one (or vice versa)
    // produces a meaningless similarity score even though both are
    // technically 1536-d vectors. Defaults to 'gemini' (the normal case,
    // and also the safe default if the embedding_source column/migration
    // isn't applied yet — see the note at the top of schema.sql).
    let embeddingSource = 'gemini';
    if (isSupabaseConfigured && supabaseAdmin) {
      const { data: docRow, error: docRowError } = await supabaseAdmin
        .from('documents')
        .select('embedding_source')
        .eq('id', documentId)
        .eq('user_id', userId)
        .maybeSingle();
      if (docRowError) {
        console.warn('[RAGService] Could not read embedding_source, defaulting to gemini:', docRowError.message);
      } else if (docRow?.embedding_source) {
        embeddingSource = docRow.embedding_source;
      }
    }

    // 2. Convert question into a dense embedding vector, in that same space
    const questionEmbedding = await embeddingService.generateEmbedding(question, {
      forceFallback: embeddingSource === 'hash-fallback'
    });

    // 3. Supabase pgvector RPC search
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: chunks, error } = await supabaseAdmin.rpc('match_document_chunks', {
          query_embedding: questionEmbedding,
          match_threshold: threshold,
          match_count: topK,
          p_user_id: userId,
          p_doc_id: documentId
        });

        if (error) {
          console.error('[RAGService] match_document_chunks RPC error:', error);
        } else if (chunks && chunks.length > 0) {
          return chunks.map(c => ({
            chunkId: c.id,
            chunkIndex: c.chunk_index,
            page: c.page_number || 1,
            text: c.content,
            similarity: c.similarity
          }));
        }
      } catch (err) {
        console.warn('[RAGService] Supabase RPC search error, falling back to local search:', err.message);
      }
    }

    // 4. In-memory fallback similarity search
    const doc = await documentService.getDocumentById(documentId, userId);
    if (!doc || !doc.chunks || doc.chunks.length === 0) {
      return [];
    }

    // Compute cosine similarity for each chunk. Same embedding space as the
    // question above — chunks are re-embedded fresh here (this path has no
    // stored vectors), so both sides must agree the same way the RPC path
    // does above, or this reintroduces the exact mixed-space bug.
    const scoredChunks = await Promise.all(
      doc.chunks.map(async (chunk) => {
        const chunkEmbedding = await embeddingService.generateEmbedding(chunk.content, {
          forceFallback: embeddingSource === 'hash-fallback'
        });
        const similarity = embeddingService.cosineSimilarity(questionEmbedding, chunkEmbedding);
        return {
          chunkId: chunk.id || `chunk-${chunk.chunkIndex}`,
          chunkIndex: chunk.chunkIndex,
          page: chunk.pageNumber || 1,
          text: chunk.content,
          similarity: parseFloat(similarity.toFixed(4))
        };
      })
    );

    // Sort by highest similarity
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    // Filter by threshold or pick topK
    const topResults = scoredChunks.slice(0, topK);
    console.log(`[RAGService] Retrieved ${topResults.length} relevant context chunks.`);
    return topResults;
  }
};

