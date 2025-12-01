import { Router } from 'express';
import { sportsmonksService } from '../services/sportsmonksService';
import { logger } from '../utils/logger';
import { StatusCodes } from 'http-status-codes';

const router = Router();

// Test SportsMonks connection
router.get('/sportsmonks/test', async (req, res) => {
  try {
    const token = process.env.SPORTMONKS_API_TOKEN;
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        tokenConfigured: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 10)}...` : 'Not set',
        healthCheck: {
          cricket: await sportsmonksService.healthCheck('cricket'),
          football: await sportsmonksService.healthCheck('football'),
        },
      },
    });
  } catch (error: any) {
    logger.error('SportsMonks test error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Test live matches
router.get('/sportsmonks/live', async (req, res) => {
  try {
    const { sport = 'cricket' } = req.query;
    
    const matches = await sportsmonksService.getLiveMatches(sport as 'cricket' | 'football');
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        sport,
        count: matches.length,
        matches: matches.slice(0, 5), // Return first 5 for testing
      },
    });
  } catch (error: any) {
    logger.error('SportsMonks live matches test error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    res.status(StatusCodes.OK).json({
      success: false,
      message: error.message,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });
  }
});

export default router;

