import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getKPIs, getLogs } from '../controllers/adminController';

const router = Router();

router.get('/kpis', authenticate, authorize('moderator','admin','editor'), getKPIs);
router.get('/logs', authenticate, authorize('admin'), getLogs);

export default router;


