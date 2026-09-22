import { randomUUID } from 'crypto';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase.js';
import { parseDocument } from './parser.js';
import { chunkText } from './chunker.js';
import { embeddingService } from './embeddingService.js';

// In-memory store for local sandbox/offline development
const localDocumentsStore = new Map();
const localChunksStore = new Map();

// The raw upload filename becomes part of a Storage object key
// (`${userId}/${docId}_${filename}`). Strip path separators and anything
// outside a safe charset so a crafted filename (e.g. containing "../") can
// never influence which object the key actually points to.
function sanitizeFilename(name) {
  const base = name.split(/[/\\]/).pop() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(-200) || 'file';
}

export const documentService = {
  /**
   * Processes an uploaded document file: storage upload -> text extraction -> chunking -> vector indexing.
   */
  async processUpload({ file, userId }) {
    const fileExt = file.originalname.split('.').pop().toLowerCase();
    // Must be a real UUID: the Supabase `documents.id` column is typed uuid.
    const docId = randomUUID();
    const safeFileName = sanitizeFilename(file.originalname);
    const storagePath = `${userId}/${docId}_${safeFileName}`;

    console.log(`[DocumentService] Ingesting "${file.originalname}" (${fileExt}) for user ${userId}...`);

    // 1. Extract text and page count
    const parsed = await parseDocument(file.buffer, fileExt);
    console.log(`[DocumentService] Extracted ${parsed.text.length} chars across ${parsed.totalPages} page(s).`);

    // 2. Divide into semantic chunks
    const chunks = chunkText(parsed.text, {
      chunkSize: 800,
      chunkOverlap: 150,
      totalPages: parsed.totalPages
    });
    console.log(`[DocumentService] Generated ${chunks.length} chunks.`);

    // 3. Persist to Supabase if configured
    if (isSupabaseConfigured && supabaseAdmin) {
      // 3a. Upload binary to Supabase Storage
      const { error: storageError } = await supabaseAdmin.storage
        .from('documents')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (storageError) {
        console.warn('[DocumentService] Supabase Storage upload warning:', storageError.message);
      }

      // 3b. Insert document row into PostgreSQL
      const { data: docRecord, error: dbError } = await supabaseAdmin
        .from('documents')
        .insert({
          id: docId,
          user_id: userId,
          file_name: file.originalname,
          file_type: fileExt,
          file_size: file.size,
          storage_path: storagePath,
          status: 'ready',
          total_pages: parsed.totalPages
        })
        .select()
        .single();

      if (dbError) {
        console.error('[DocumentService] DB insert error:', dbError);
        throw new Error(`Database error saving document: ${dbError.message}`);
      }

      // 3c. Generate embeddings and insert chunks into document_chunks
      let degradedEmbeddings = false;
      if (chunks.length > 0) {
        const { embeddings, degraded } = await embeddingService.generateBatchEmbeddings(
          chunks.map(c => c.content)
        );
        degradedEmbeddings = degraded;

        const chunkRecords = chunks.map((c, i) => ({
          document_id: docId,
          chunk_index: c.chunkIndex,
          content: c.content,
          page_number: c.pageNumber,
          embedding: embeddings[i]
        }));

        const { error: chunkError } = await supabaseAdmin
          .from('document_chunks')
          .insert(chunkRecords);

        if (chunkError) {
          console.error('[DocumentService] Chunk insert error:', chunkError);
          throw new Error(`Database error saving document chunks: ${chunkError.message}`);
        }
      }

      // Record any quality degradation so it's visible instead of a silent,
      // undetectable drop — this reuses the existing error_message column
      // rather than a schema change. The document still works (status
      // stays 'ready'); this is a quality warning, not a failure.
      const degradationNotes = [];
      if (degradedEmbeddings) {
        degradationNotes.push('Indexed with degraded (non-semantic) embeddings because the configured embedding API was unavailable — search relevance for this document is reduced.');
      }
      if (parsed.ocrFailedPageCount > 0) {
        degradationNotes.push(`OCR failed on ${parsed.ocrFailedPageCount} scanned/handwritten page(s) — that content was not indexed.`);
      }
      if (degradationNotes.length > 0) {
        const message = degradationNotes.join(' ');
        console.warn(`[DocumentService] Document ${docId} has quality issues: ${message}`);
        const updatePayload = { error_message: message };
        // Record which embedding space this document's chunks live in so a
        // later question can be embedded the same way (see ragService.js).
        // Only set on the degraded path — 'gemini' is the column default,
        // matching the normal case.
        if (degradedEmbeddings) {
          updatePayload.embedding_source = 'hash-fallback';
        }
        const { error: updateError } = await supabaseAdmin
          .from('documents')
          .update(updatePayload)
          .eq('id', docId);
        if (updateError) {
          // Most likely cause: the embedding_source column migration (see
          // the note at the top of schema.sql) hasn't been applied yet.
          // Don't fail the upload over a quality-tracking write — just warn.
          console.warn('[DocumentService] Could not record document quality notes:', updateError.message);
        } else {
          Object.assign(docRecord, updatePayload);
        }
      }

      return {
        ...docRecord,
        chunksCount: chunks.length
      };
    }

    // 4. Local Sandbox fallback
    const localDoc = {
      id: docId,
      user_id: userId,
      fileName: file.originalname,
      fileType: fileExt,
      fileSize: file.size,
      storagePath: storagePath,
      status: 'ready',
      totalPages: parsed.totalPages,
      createdAt: new Date().toISOString(),
      description: `Uploaded document: ${file.originalname}`,
      extractedTextSample: parsed.text.substring(0, 300) + '...',
      chunksCount: chunks.length,
      summary: `Automated summary for **${file.originalname}**:\n\n- Extracted ${parsed.text.length} characters across ${parsed.totalPages} page(s).\n- Divided into ${chunks.length} semantic chunks.\n- Available for vector retrieval and grounded AI conversation.`,
      keyPoints: [
        `Parsed ${parsed.totalPages} pages with ${chunks.length} contextual chunks.`,
        'Natural paragraph and sentence boundaries preserved.',
        'Ready for question answering and analysis.'
      ],
      mcqs: [
        {
          id: 'q-loc-1',
          question: `How many pages were parsed from ${file.originalname}?`,
          options: [`${parsed.totalPages} pages`, `${parsed.totalPages + 5} pages`, `${Math.max(1, parsed.totalPages - 2)} pages`, 'Unknown'],
          correctIndex: 0,
          explanation: `The parser accurately determined ${parsed.totalPages} pages from the document structure.`
        }
      ],
      initialMessages: [
        {
          id: 'msg-init-1',
          role: 'assistant',
          content: `Hello! I have processed **${file.originalname}** (${parsed.totalPages} pages, ${chunks.length} chunks). What would you like to know about it?`,
          createdAt: new Date().toISOString()
        }
      ]
    };

    localDocumentsStore.set(docId, localDoc);
    localChunksStore.set(docId, chunks);

    return localDoc;
  },

  /**
   * Lists documents for the current user.
   */
  async listDocuments(userId) {
    if (isSupabaseConfigured && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }

    const userDocs = Array.from(localDocumentsStore.values())
      .filter(d => d.user_id === userId);
    return userDocs;
  },

  /**
   * Retrieves a single document with its chunks.
   */
  async getDocumentById(docId, userId) {
    if (isSupabaseConfigured && supabaseAdmin) {
      const { data: doc, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', docId)
        .eq('user_id', userId)
        .single();

      if (error) return null;

      const { data: chunks } = await supabaseAdmin
        .from('document_chunks')
        .select('id, chunk_index, content, page_number')
        .eq('document_id', docId)
        .order('chunk_index', { ascending: true });

      return {
        ...doc,
        chunks: chunks || []
      };
    }

    const doc = localDocumentsStore.get(docId);
    if (!doc) return null;

    return {
      ...doc,
      chunks: localChunksStore.get(docId) || []
    };
  },

  /**
   * Generates a short-lived signed URL to view/download the original
   * uploaded file from the private Supabase Storage bucket.
   */
  async getFileUrl(docId, userId) {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      // Local sandbox mode never persists the raw file bytes anywhere
      // retrievable — only the extracted text/chunks are kept.
      return null;
    }

    const { data: doc, error } = await supabaseAdmin
      .from('documents')
      .select('storage_path, file_name')
      .eq('id', docId)
      .eq('user_id', userId)
      .single();

    if (error || !doc || !doc.storage_path) return null;

    const { data, error: signError } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 300, {
        download: doc.file_name
      });

    if (signError) {
      console.error('[DocumentService] createSignedUrl error:', signError.message);
      return null;
    }

    return data.signedUrl;
  },

  /**
   * Deletes a document and all related records/files.
   */
  async deleteDocument(docId, userId) {
    if (isSupabaseConfigured && supabaseAdmin) {
      // 1. Look up the document, scoped to the requesting user — prevents
      // one user from deleting another user's storage file via a guessed
      // or leaked document ID (IDOR).
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('storage_path')
        .eq('id', docId)
        .eq('user_id', userId)
        .single();

      if (!doc) {
        const err = new Error('Document not found');
        err.status = 404;
        throw err;
      }

      if (doc.storage_path) {
        await supabaseAdmin.storage.from('documents').remove([doc.storage_path]);
      }

      // 2. Cascade delete will handle document_chunks and sessions
      const { error } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', docId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    }

    localDocumentsStore.delete(docId);
    localChunksStore.delete(docId);
    return { success: true };
  }
};

