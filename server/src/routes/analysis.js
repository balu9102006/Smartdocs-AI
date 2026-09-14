import express from 'express';
import { analysisService } from '../services/analysisService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/analysis/summary
 * Generates an executive summary for a document.
 */
router.post('/summary', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.body;
    const userId = req.user?.id || 'user-default-1';

    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    const result = await analysisService.generateSummary({ documentId, userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/analysis/keypoints
 * Extracts bulleted key points and concepts.
 */
router.post('/keypoints', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.body;
    const userId = req.user?.id || 'user-default-1';

    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    const result = await analysisService.extractKeyPoints({ documentId, userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/analysis/quiz
 * Generates interactive revision MCQs.
 */
router.post('/quiz', requireAuth, async (req, res, next) => {
  try {
    const { documentId, count } = req.body;
    const userId = req.user?.id || 'user-default-1';

    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    const result = await analysisService.generateQuiz({ documentId, userId, count });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

