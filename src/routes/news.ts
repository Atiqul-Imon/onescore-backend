import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { 
  createArticle,
  updateArticle,
  submitForReview,
  scheduleArticle,
  publishArticle,
  unpublishArticle,
  listArticles,
  getBySlug,
  getByWildcardSlug,
  trending,
  searchNews,
  likeArticle,
  dislikeArticle,
  getRelatedArticles
} from '../controllers/newsController';

const router = Router();

// Public read endpoints
router.get('/', listArticles);
router.get('/trending', trending);
router.get('/search', searchNews);
router.get('/slug/*', getByWildcardSlug);
router.get('/:slug', getBySlug);
router.get('/articles/:id/related', getRelatedArticles);
router.post('/articles/:id/like', likeArticle);
router.post('/articles/:id/dislike', dislikeArticle);

// Editorial endpoints (protected)
router.post('/articles', authenticate, authorize('writer','editor','admin'), createArticle);
router.put('/articles/:id', authenticate, authorize('writer','editor','admin'), updateArticle);
router.post('/articles/:id/submit', authenticate, authorize('writer','editor','admin'), submitForReview);
router.post('/articles/:id/schedule', authenticate, authorize('editor','admin'), scheduleArticle);
router.post('/articles/:id/publish', authenticate, authorize('editor','admin'), publishArticle);
router.post('/articles/:id/unpublish', authenticate, authorize('editor','admin'), unpublishArticle);

export default router;


