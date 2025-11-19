import { Router } from 'express';
import {
  getFootballMatches, 
  getFootballMatchById, 
  getLiveFootballMatches,
  getFootballFixtures,
  getFootballResults,
  getFootballLeagues,
  getFootballTeams,
  getFootballPlayers,
  getFootballStats
} from '../controllers/footballController';
import { authenticate } from '../middleware/auth';
import { 
  validateMatchId, 
  validatePagination, 
  validateDateRange,
  validateSearch 
} from '../middleware/validation';

const router = Router();

// Public routes
router.get('/matches', validatePagination, validateDateRange, getFootballMatches);
router.get('/matches/live', getLiveFootballMatches);
router.get('/matches/fixtures', validatePagination, validateDateRange, getFootballFixtures);
router.get('/matches/results', validatePagination, validateDateRange, getFootballResults);
router.get('/matches/:id', validateMatchId, getFootballMatchById);
router.get('/leagues', validatePagination, getFootballLeagues);
router.get('/teams', getFootballTeams);
router.get('/players', validatePagination, validateSearch, getFootballPlayers);
router.get('/stats', validateSearch, getFootballStats);

// Protected routes (require authentication)
router.get('/matches/user/favorites', authenticate, getFootballMatches);

export default router;
