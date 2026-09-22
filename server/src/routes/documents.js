import express from 'express';
import multer from 'multer';
import { documentService } from '../services/documentService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Configure Multer for in-memory buffer storage (max 20MB, per Qwen's limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (ext === 'pdf' || ext === 'docx') {
      cb(null, true);
    } else {
      const err = new Error('Invalid file format. Only PDF and DOCX files are allowed.');
      err.status = 400;
      cb(err);
    }
  }
});

/**
 * POST /api/documents/upload
 * Uploads, parses, and chunks a document.
 */
router.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please provide a PDF or DOCX file.' });
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

