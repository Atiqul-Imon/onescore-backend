import { Router } from 'express';
import { 
  getContent,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
  approveContent,
  rejectContent,
  getContentByCategory,
  getContentByType,
  getFeaturedContent,
  searchContent,
  likeContent,
  dislikeContent,
  addComment,
  getComments,
  getContentStats
} from '../controllers/contentController';
import { authenticate, authorize } from '../middleware/auth';
import { 
  validateContentCreation,
  validateContentUpdate,
  validatePagination,
  validateSearch
} from '../middleware/validation';
import { upload } from '../middleware/upload';

const router = Router();

// Public routes
router.get('/', validatePagination, validateSearch, getContent);
router.get('/featured', getFeaturedContent);
router.get('/category/:category', validatePagination, getContentByCategory);
router.get('/type/:type', validatePagination, getContentByType);
router.get('/search', validateSearch, searchContent);
router.get('/:id', getContentById);
router.get('/:id/comments', getComments);
router.get('/:id/stats', getContentStats);

// Protected routes (require authentication)
router.post('/', authenticate, upload.single('media'), validateContentCreation, createContent);
router.put('/:id', authenticate, validateContentUpdate, updateContent);
router.delete('/:id', authenticate, deleteContent);
router.post('/:id/like', authenticate, likeContent);
router.post('/:id/dislike', authenticate, dislikeContent);
router.post('/:id/comments', authenticate, addComment);

// Admin/Moderator routes
router.patch('/:id/approve', authenticate, authorize('admin', 'moderator'), approveContent);
router.patch('/:id/reject', authenticate, authorize('admin', 'moderator'), rejectContent);

export default router;
