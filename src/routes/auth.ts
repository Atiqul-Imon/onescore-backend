import { Router } from 'express';
import { 
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
  getProfile,
  updateProfile,
  deleteAccount
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { 
  validateUserRegistration,
  validateUserLogin,
  validatePasswordReset,
  validatePasswordUpdate
} from '../middleware/validation';

const router = Router();

// Public routes
router.post('/register', validateUserRegistration, register);
router.post('/login', validateUserLogin, login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', validatePasswordReset, forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

// Protected routes (require authentication)
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, validatePasswordUpdate, changePassword);
router.delete('/account', authenticate, deleteAccount);

export default router;
