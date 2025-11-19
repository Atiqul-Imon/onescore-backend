import { Router } from 'express';
import { 
  getComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
  voteComment,
  reportComment,
  getCommentStats,
  getCommentReplies,
  listReportedComments,
  resolveReport,
  adminHideComment
} from '../controllers/commentController';
import { authenticate, authorize } from '../middleware/auth';
import { 
  validatePagination
} from '../middleware/validation';
import { 
  validateCommentCreation,
  validateCommentUpdate,
  validateVote,
  validateReport
} from '../middleware/threadValidation';

const router = Router();

// Public routes
router.get('/thread/:threadId', validatePagination, getComments);
router.get('/article/:articleId', validatePagination, getComments);
router.get('/:id', getCommentById);
router.get('/:id/stats', getCommentStats);
router.get('/:id/replies', validatePagination, getCommentReplies);

// Protected routes (require authentication)
router.post('/', authenticate, validateCommentCreation, createComment);
router.put('/:id', authenticate, validateCommentUpdate, updateComment);
router.delete('/:id', authenticate, deleteComment);
router.post('/:id/vote', authenticate, validateVote, voteComment);
router.post('/:id/report', authenticate, validateReport, reportComment);

// Admin/moderator moderation routes
router.get('/reports', authenticate, authorize('moderator','admin'), listReportedComments);
router.post('/:id/reports/resolve', authenticate, authorize('moderator','admin'), resolveReport);
router.post('/:id/hide', authenticate, authorize('moderator','admin'), adminHideComment);

export default router;
