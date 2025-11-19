import { Router } from 'express';
import { 
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  getTopContributors,
  getUserContent,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  updatePreferences,
  getNotifications,
  markNotificationAsRead,
  deleteNotification
} from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { validatePagination } from '../middleware/validation';

const router = Router();

// Public routes
router.get('/top-contributors', getTopContributors);
router.get('/:id', getUserById);
router.get('/:id/content', validatePagination, getUserContent);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

// Protected routes (require authentication)
router.get('/', authenticate, getUsers);
router.put('/:id', authenticate, updateUser);
router.delete('/:id', authenticate, deleteUser);
router.get('/:id/stats', authenticate, getUserStats);
router.post('/:id/follow', authenticate, followUser);
router.delete('/:id/follow', authenticate, unfollowUser);
router.put('/preferences', authenticate, updatePreferences);
router.get('/notifications', authenticate, getNotifications);
router.patch('/notifications/:id/read', authenticate, markNotificationAsRead);
router.delete('/notifications/:id', authenticate, deleteNotification);

// Admin routes
router.get('/admin/all', authenticate, authorize('admin'), getUsers);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteUser);

export default router;
