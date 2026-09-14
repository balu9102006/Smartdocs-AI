import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase.js';
import { embeddingService } from './embeddingService.js';
import { documentService } from './documentService.js';

export const ragService = {
  /**
   * Retrieves the most semantically relevant chunks for a question.
   */
  async retrieveContextChunks({ documentId, question, userId, topK = 4, threshold = 0.35 }) {
    console.log(`[RAGService] Retrieving chunks for question: "${question}" (doc: ${documentId})`);

    // 1. Convert question into dense embedding vector
    const questionEmbedding = await embeddingService.generateEmbedding(question);

    // 2. Supabase pgvector RPC search
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

    // 3. In-memory fallback similarity search
    const doc = await documentService.getDocumentById(documentId, userId);
    if (!doc || !doc.chunks || doc.chunks.length === 0) {
      return [];
    }

    // Compute cosine similarity for each chunk
    const scoredChunks = await Promise.all(
      doc.chunks.map(async (chunk) => {
        const chunkEmbedding = await embeddingService.generateEmbedding(chunk.content);
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

