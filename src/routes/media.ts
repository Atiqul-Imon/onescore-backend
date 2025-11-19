import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { upload, handleUploadError } from '../middleware/upload';
import { listMedia, uploadMedia, deleteMedia } from '../controllers/mediaController';

const router = Router();

router.get('/', authenticate, authorize('moderator','admin','editor','writer'), listMedia);
router.post('/', authenticate, authorize('moderator','admin','editor','writer'), upload.single('file'), handleUploadError, uploadMedia);
router.delete('/', authenticate, authorize('moderator','admin','editor','writer'), deleteMedia);

export default router;


