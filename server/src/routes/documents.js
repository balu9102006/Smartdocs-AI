import express from 'express';
import multer from 'multer';
import { documentService } from '../services/documentService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

// Configure Multer for in-memory buffer storage (max 20MB, per Qwen's limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const extOk = ext === 'pdf' || ext === 'docx';
    // The extension alone is trivially spoofable (rename a .exe to .pdf).
    // The browser-reported MIME type is also client-controlled but cheap
    // to check here; the real check is the magic-byte sniff below, once
    // the buffer is actually available.
    const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      const err = new Error('Invalid file format. Only PDF and DOCX files are allowed.');
      err.status = 400;
      cb(err);
    }
  }
});

// Verifies the file's actual content matches its claimed type, independent
// of the (spoofable) extension and browser-supplied MIME type.
const MAGIC_BYTES = {
  pdf: Buffer.from('%PDF-'),
  // .docx is a zip archive (PK\x03\x04 local file header signature).
  docx: Buffer.from([0x50, 0x4b, 0x03, 0x04])
};

function matchesMagicBytes(buffer, ext) {
  const signature = MAGIC_BYTES[ext];
  if (!signature) return false;
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

/**
 * POST /api/documents/upload
 * Uploads, parses, and chunks a document.
 */
router.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please provide a PDF or DOCX file.' });
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    if (!matchesMagicBytes(req.file.buffer, ext)) {
      return res.status(400).json({ error: 'File content does not match its extension.' });
    }

    const userId = req.user?.id || 'user-default-1';
    const result = await documentService.processUpload({
      file: req.file,
      userId
    });

    res.status(201).json({
      message: 'Document successfully processed and indexed',
      document: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents
 * Lists all documents for the authenticated user.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || 'user-default-1';
    const docs = await documentService.listDocuments(userId);
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/:id
 * Retrieves metadata and chunks for a document.
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || 'user-default-1';
    const doc = await documentService.getDocumentById(req.params.id, userId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/:id/file
 * Returns a short-lived signed URL to view/download the original file.
 */
router.get('/:id/file', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || 'user-default-1';
    const url = await documentService.getFileUrl(req.params.id, userId);
    if (!url) {
      return res.status(404).json({ error: 'Original file is not available for this document.' });
    }
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/documents/:id
 * Deletes a document and its associated data.
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || 'user-default-1';
    const result = await documentService.deleteDocument(req.params.id, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

