import { Router } from 'express';
import { 
  getCricketMatches, 
  getCricketMatchById, 
  getLiveCricketMatches,
  getCricketFixtures,
  getCricketResults,
  getCricketSeries,
  getCricketPlayers,
  getCricketStats
} from '../controllers/cricketController';
import { 
  getCricketTeamDetail, 
  getCricketTeamPlayersBySlug, 
  getCricketTeamSummaries 
} from '../controllers/cricketTeamController';
import { authenticate } from '../middleware/auth';
import { 
  validateMatchId, 
  validatePagination, 
  validateDateRange,
  validateSearch,
  validateTeamSlug
} from '../middleware/validation';

const router = Router();

// Public routes
router.get('/matches', validatePagination, validateDateRange, getCricketMatches);
router.get('/matches/live', getLiveCricketMatches);
router.get('/matches/fixtures', validatePagination, validateDateRange, getCricketFixtures);
router.get('/matches/results', validatePagination, validateDateRange, getCricketResults);
router.get('/matches/:id', validateMatchId, getCricketMatchById);
router.get('/series', validatePagination, getCricketSeries);
router.get('/teams', getCricketTeamSummaries);
router.get('/teams/:slug', validateTeamSlug, getCricketTeamDetail);
router.get('/teams/:slug/players', validateTeamSlug, validatePagination, getCricketTeamPlayersBySlug);
router.get('/players', validatePagination, validateSearch, getCricketPlayers);
router.get('/stats', validateSearch, getCricketStats);

// Protected routes (require authentication)
router.get('/matches/user/favorites', authenticate, getCricketMatches);

export default router;
