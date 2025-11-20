import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getKPIs, getLogs } from '../controllers/adminController';
import { adminGetCricketTeam, adminListCricketTeams, adminUpsertCricketTeam } from '../controllers/cricketTeamAdminController';
import { validateCricketTeamPayload, validateTeamSlug } from '../middleware/validation';

const router = Router();

router.get('/kpis', authenticate, authorize('moderator','admin','editor'), getKPIs);
router.get('/logs', authenticate, authorize('admin'), getLogs);
router.get('/cricket/teams', authenticate, authorize('editor','admin'), adminListCricketTeams);
router.get('/cricket/teams/:slug', authenticate, authorize('editor','admin'), validateTeamSlug, adminGetCricketTeam);
router.post('/cricket/teams', authenticate, authorize('editor','admin'), validateCricketTeamPayload, adminUpsertCricketTeam);
router.put('/cricket/teams/:slug', authenticate, authorize('editor','admin'), validateTeamSlug, validateCricketTeamPayload, adminUpsertCricketTeam);

export default router;


