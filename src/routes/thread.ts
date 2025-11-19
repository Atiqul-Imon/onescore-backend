import { Router } from 'express';
import { 
  getThreads,
  getThreadById,
  createThread,
  updateThread,
  deleteThread,
  voteThread,
  pinThread,
  lockThread,
  reportThread,
  getThreadStats
} from '../controllers/threadController';
import { authenticate, authorize } from '../middleware/auth';
import { 
  validatePagination,
  validateSearch
} from '../middleware/validation';
import { 
  validateThreadCreation,
  validateThreadUpdate,
  validateVote,
  validateReport
} from '../middleware/threadValidation';

const router = Router();

// Public routes
router.get('/', validatePagination, validateSearch, getThreads);
router.get('/:id', getThreadById);
router.get('/:id/stats', getThreadStats);

// Protected routes (require authentication)
router.post('/', authenticate, validateThreadCreation, createThread);
router.put('/:id', authenticate, validateThreadUpdate, updateThread);
router.delete('/:id', authenticate, deleteThread);
router.post('/:id/vote', authenticate, validateVote, voteThread);
router.post('/:id/report', authenticate, validateReport, reportThread);

// Moderator/Admin routes
router.post('/:id/pin', authenticate, authorize('admin', 'moderator'), pinThread);
router.post('/:id/lock', authenticate, authorize('admin', 'moderator'), lockThread);

export default router;
