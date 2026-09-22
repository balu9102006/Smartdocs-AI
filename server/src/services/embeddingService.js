import { config } from '../config/index.js';

/**
 * Dedicated Embedding Service.
 * Generates 1536-dimensional normalized vector embeddings.
 */
// generateEmbedding's hash-based fallback (see generateDeterministicEmbedding
// below) is NOT a semantic embedding — it's a word-hash bag-of-features
// vector. Measured directly: an unrelated sentence pair scored higher
// cosine similarity than a genuine paraphrase pair. It exists only so the
// "Zero-Setup Offline Sandbox" has *something* to compute with when no
// embedding API key is configured at all. It must never be silently mixed
// with real Gemini embeddings for the same document — comparing a real
// embedding against a hash vector (or vice versa) produces a meaningless
// similarity score while still reporting a confident-looking percentage.
const EMBEDDING_SOURCE = { REAL: 'gemini', FALLBACK: 'hash-fallback' };

async function callGeminiEmbedding(cleanInput) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${config.embeddings.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: cleanInput }] },
        outputDimensionality: 1536
      })
    }
  );
  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return data.embedding.values;
}

export const embeddingService = {
  EMBEDDING_SOURCE,

  /**
   * Generates a 1536-dimensional vector for a text string. Returns just the
   * vector — callers that need to know whether it's a real embedding (to
   * keep a batch internally consistent) should use generateBatchEmbeddings.
   *
   * Pass { forceFallback: true } to embed a QUESTION the same way a
   * document's chunks were embedded, when that document is known to be on
   * the hash-fallback (degraded) embedding space — comparing a real Gemini
   * embedding against a hash vector produces a meaningless similarity score
   * even though both are technically 1536-d vectors. See ragService.js.
   */
  async generateEmbedding(text, { forceFallback = false } = {}) {
    if (!text || text.trim().length === 0) {
      return new Array(1536).fill(0);
    }
    const cleanInput = text.replace(/\n+/g, ' ').trim();

    if (!forceFallback && config.embeddings.apiKey) {
      try {
        return await callGeminiEmbedding(cleanInput);
      } catch (err) {
        console.warn('[EmbeddingService] Gemini API call failed, using degraded fallback:', err.message);
      }
    }

    return generateDeterministicEmbedding(cleanInput, 1536);
  },

  /**
   * Generates embeddings for a whole document's chunks together. Two things
   * this guards against that a naive Promise.all(map(generateEmbedding))
   * does not:
   *
   * 1. Unbounded concurrency: firing one request per chunk simultaneously
   *    (200+ for a long document) is the expected way to trip Gemini's rate
   *    limit, not an edge case — so this runs with bounded concurrency and
   *    a retry per chunk first.
   * 2. Mixed embedding spaces: if any chunk still can't get a real
   *    embedding after retrying, the ENTIRE batch falls back together
   *    rather than mixing real and hash vectors within one document's
   *    chunk set — internally inconsistent embeddings are worse than
   *    uniformly degraded ones, and silent mixing is undetectable later.
   *
   * Returns { embeddings, degraded } — `degraded: true` means the fallback
   * was used for this whole batch and the caller should record that rather
   * than treat the document as normally indexed.
   */
  async generateBatchEmbeddings(texts, { concurrency = 5 } = {}) {
    if (!config.embeddings.apiKey) {
      return {
        embeddings: texts.map((t) => generateDeterministicEmbedding((t || '').replace(/\n+/g, ' ').trim(), 1536)),
        degraded: true
      };
    }

    const results = new Array(texts.length);
    let anyFallback = false;
    let cursor = 0;

    async function worker() {
      while (cursor < texts.length) {
        const i = cursor++;
        const cleanInput = (texts[i] || '').replace(/\n+/g, ' ').trim();
        if (!cleanInput) {
          results[i] = new Array(1536).fill(0);
          continue;
        }
        try {
          results[i] = await callGeminiEmbedding(cleanInput);
        } catch (firstErr) {
          try {
            results[i] = await callGeminiEmbedding(cleanInput);
          } catch (secondErr) {
            console.warn(`[EmbeddingService] Chunk ${i} failed twice, will force whole-batch fallback:`, secondErr.message);
            anyFallback = true;
            results[i] = null; // replaced below if the batch falls back
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, worker));

    if (anyFallback) {
      console.warn(`[EmbeddingService] Re-embedding entire ${texts.length}-chunk batch with the degraded fallback for consistency.`);
      return {
        embeddings: texts.map((t) => generateDeterministicEmbedding((t || '').replace(/\n+/g, ' ').trim(), 1536)),
        degraded: true
      };
    }

    return { embeddings: results, degraded: false };
  },

  /**
   * Calculates cosine similarity between two float vectors.
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
};

/**
 * Deterministic dense semantic embedding algorithm.
 * Maps n-grams and vocabulary distributions into a unit-normalized 1536-D vector.
 */
function generateDeterministicEmbedding(text, dimension = 1536) {
  const vector = new Float32Array(dimension);
  const words = text.toLowerCase().match(/\b[a-z0-9_-]+\b/g) || [text];

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }

    // Seed projections across dimensions
    const baseIdx = Math.abs(hash) % dimension;
    for (let offset = 0; offset < 8; offset++) {
      const idx = (baseIdx + offset * 191) % dimension;
      vector[idx] += 1.0 / (offset + 1);
    }
  }

  // L2 Normalization (unit vector for exact cosine similarity)
  let sumSquares = 0;
  for (let i = 0; i < dimension; i++) {
    sumSquares += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSquares) || 1.0;
  const normalized = new Array(dimension);
  for (let i = 0; i < dimension; i++) {
    normalized[i] = parseFloat((vector[i] / norm).toFixed(6));
  }

  return normalized;
}

