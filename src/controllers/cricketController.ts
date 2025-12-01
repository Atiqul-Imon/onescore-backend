import { Request, Response } from 'express';
import { CricketMatch } from '../models/CricketMatch';
import { redisClient } from '../utils/redis';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';
import { sportsmonksService } from '../services/sportsmonksService';
import { cricketApiService } from '../services/cricketApiService';
import { transformSportsMonksMatchToFrontend } from '../utils/sportsmonksTransformers';
import { transformApiMatchToFrontend } from '../utils/matchTransformers';
import { logger } from '../utils/logger';

// Get all cricket matches with pagination and filters
export const getCricketMatches = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    status, 
    format, 
    series, 
    startDate, 
    endDate 
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build filter object
  const filter: any = {};
  
  if (status) filter.status = status;
  if (format) filter.format = format;
  if (series) filter.series = new RegExp(series as string, 'i');
  
  if (startDate || endDate) {
    filter.startTime = {};
    if (startDate) filter.startTime.$gte = new Date(startDate as string);
    if (endDate) filter.startTime.$lte = new Date(endDate as string);
  }

  // Try to get from cache first
  const cacheKey = `cricket_matches:${JSON.stringify(filter)}:${page}:${limit}`;
  const cachedData = await redisClient.get(cacheKey);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const matches = await CricketMatch.find(filter)
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await CricketMatch.countDocuments(filter);

  const result = {
    matches,
    pagination: {
      current: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
      limit: Number(limit)
    }
  };

  // Cache for 5 minutes
  await redisClient.set(cacheKey, JSON.stringify(result), 300);

  res.status(StatusCodes.OK).json({
    success: true,
    data: result
  });
});

// Get live cricket matches
export const getLiveCricketMatches = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Try to get from cache first
    const cachedData = await redisClient.get('live_cricket_matches');
    
    if (cachedData) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    logger.info('Fetching live cricket matches from SportsMonks...');
    
    try {
      // Try SportsMonks first
      const apiMatches = await sportsmonksService.getLiveMatches('cricket');
      
      // Transform API response to frontend format
      const transformedMatches = apiMatches.map((match: any) => 
        transformSportsMonksMatchToFrontend(match, 'cricket')
      );
      
      // Filter only live matches
      const liveMatches = transformedMatches.filter(match => 
        match.status === 'live'
      );
      
      logger.info(`Received ${liveMatches.length} live cricket matches from SportsMonks`);
      
      // Cache duration: 30 seconds in development, 15 minutes in production
      const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 30;
      await redisClient.set('live_cricket_matches', JSON.stringify(liveMatches), cacheDuration);

      res.status(StatusCodes.OK).json({
        success: true,
        data: liveMatches
      });
    } catch (sportsmonksError: any) {
      // If SportsMonks fails (403 = plan doesn't include cricket), fallback to Cricket Data API
      if (sportsmonksError.response?.status === 403) {
        logger.warn('SportsMonks cricket not available (403), falling back to Cricket Data API');
        
        try {
          const cricketDataMatches = await cricketApiService.getLiveMatches();
          const transformedMatches = cricketDataMatches.map(transformApiMatchToFrontend);
          const liveMatches = transformedMatches.filter(match => 
            match.status === 'live' || (match.matchStarted && !match.matchEnded)
          );
          
          const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 30;
          await redisClient.set('live_cricket_matches', JSON.stringify(liveMatches), cacheDuration);
          
          res.status(StatusCodes.OK).json({
            success: true,
            data: liveMatches,
            source: 'cricket_data_api'
          });
        } catch (cricketDataError: any) {
          logger.error('Both SportsMonks and Cricket Data API failed, using database fallback');
          throw cricketDataError; // Will be caught by outer catch
        }
      } else {
        throw sportsmonksError; // Re-throw if not a 403
      }
    }
  } catch (error: any) {
    logger.error('Error fetching live cricket matches:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    // Final fallback to database
    const dbMatches = await CricketMatch.find({ status: 'live' })
      .sort({ startTime: -1 })
      .lean();
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: dbMatches,
      warning: 'Using database fallback - APIs unavailable',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get cricket fixtures (upcoming matches)
export const getCricketFixtures = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    format, 
    series, 
    startDate, 
    endDate 
  } = req.query;

  try {
    // Try to get from cache first
    const cacheKey = `cricket_fixtures:${JSON.stringify(req.query)}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    logger.info('Fetching upcoming cricket matches from SportsMonks...');
    
    // Fetch from SportsMonks API
    const apiMatches = await sportsmonksService.getUpcomingMatches('cricket');
    
    // Transform API response to frontend format
    const transformedMatches = apiMatches.map((match: any) => 
      transformSportsMonksMatchToFrontend(match, 'cricket')
    );
    
    // Filter only upcoming matches
    // The transformer sets status based on matchStarted/matchEnded, but we also check dates
    const now = new Date();
    const upcomingMatches = transformedMatches.filter(match => {
      const matchDate = new Date(match.startTime);
      return match.status === 'upcoming' || 
             (!match.matchStarted && !match.matchEnded && matchDate > now);
    });

    // Apply filters if provided
    let filteredMatches = upcomingMatches;
    
    if (format) {
      filteredMatches = filteredMatches.filter(m => m.format === format);
    }
    
    if (series) {
      const seriesRegex = new RegExp(series as string, 'i');
      filteredMatches = filteredMatches.filter(m => 
        m.series && seriesRegex.test(m.series)
      );
    }
    
    if (startDate || endDate) {
      filteredMatches = filteredMatches.filter(m => {
        const matchDate = new Date(m.startTime);
        if (startDate && matchDate < new Date(startDate as string)) return false;
        if (endDate && matchDate > new Date(endDate as string)) return false;
        return true;
      });
    }

    // Sort by start time (ascending - earliest first)
    filteredMatches.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Apply pagination
    const skip = (Number(page) - 1) * Number(limit);
    const paginatedMatches = filteredMatches.slice(skip, skip + Number(limit));
    const total = filteredMatches.length;

    const result = {
      fixtures: paginatedMatches,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    };

    // Cache duration: 15 minutes in production, 5 minutes in development
    const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 300;
    await redisClient.set(cacheKey, JSON.stringify(result), cacheDuration);

    res.status(StatusCodes.OK).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error fetching fixtures from API:', error);
    
    // Log the error details for debugging
    if (error.response) {
      logger.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url
      });
    }
    
    // Fallback to database if API fails
    const skip = (Number(page) - 1) * Number(limit);
    
    const filter: any = { status: 'upcoming' };
    
    if (format) filter.format = format;
    if (series) filter.series = new RegExp(series as string, 'i');
    
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate as string);
      if (endDate) filter.startTime.$lte = new Date(endDate as string);
    }

    const fixtures = await CricketMatch.find(filter)
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await CricketMatch.countDocuments(filter);

    // Return empty result with error message if no data
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        fixtures: fixtures || [],
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total: total || 0,
          limit: Number(limit)
        }
      },
      warning: 'API unavailable - using database fallback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get cricket results (completed matches)
export const getCricketResults = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    format, 
    series, 
    startDate, 
    endDate 
  } = req.query;

  try {
    // Try to get from cache first
    const cacheKey = `cricket_results:${JSON.stringify(req.query)}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    // Fetch from external API
    logger.info('Fetching completed cricket matches from SportsMonks...');
    
    const apiMatches = await sportsmonksService.getCompletedMatches('cricket');
    
    // Transform API response to frontend format
    const transformedMatches = apiMatches.map((match: any) => 
      transformSportsMonksMatchToFrontend(match, 'cricket')
    );
    
    // Filter only completed matches
    const completedMatches = transformedMatches.filter(match => 
      match.status === 'completed' || match.matchEnded
    );

    // Apply filters if provided
    let filteredMatches = completedMatches;
    
    if (format) {
      filteredMatches = filteredMatches.filter(m => m.format === format);
    }
    
    if (series) {
      const seriesRegex = new RegExp(series as string, 'i');
      filteredMatches = filteredMatches.filter(m => 
        m.series && seriesRegex.test(m.series)
      );
    }
    
    if (startDate || endDate) {
      filteredMatches = filteredMatches.filter(m => {
        const matchDate = new Date(m.startTime);
        if (startDate && matchDate < new Date(startDate as string)) return false;
        if (endDate && matchDate > new Date(endDate as string)) return false;
        return true;
      });
    }

    // Sort by start time (descending - most recent first)
    filteredMatches.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    // Apply pagination
    const skip = (Number(page) - 1) * Number(limit);
    const paginatedMatches = filteredMatches.slice(skip, skip + Number(limit));
    const total = filteredMatches.length;

    const result = {
      results: paginatedMatches,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    };

    // Cache duration: 1 hour in production, 15 minutes in development
    const cacheDuration = process.env.NODE_ENV === 'production' ? 3600 : 900;
    await redisClient.set(cacheKey, JSON.stringify(result), cacheDuration);

    res.status(StatusCodes.OK).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error fetching results from API:', error);
    
    // Fallback to database if API fails
    const skip = (Number(page) - 1) * Number(limit);
    
    const filter: any = { status: 'completed' };
    
    if (format) filter.format = format;
    if (series) filter.series = new RegExp(series as string, 'i');
    
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate as string);
      if (endDate) filter.startTime.$lte = new Date(endDate as string);
    }

    const results = await CricketMatch.find(filter)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await CricketMatch.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        results: results || [],
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total: total || 0,
          limit: Number(limit)
        }
      },
      warning: 'API unavailable - using database fallback'
    });
  }
});

// Get cricket match by ID
export const getCricketMatchById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Try to get from cache first
    const cacheKey = `cricket_match:${id}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    // Fetch from external API
    logger.info(`Fetching cricket match details from SportsMonks for ${id}...`);
    
    const apiMatch = await sportsmonksService.getMatchDetails(id, 'cricket');
    
    // Transform API response to frontend format
    const transformedMatch = transformSportsMonksMatchToFrontend(apiMatch, 'cricket');

    // Cache for 1 minute (live matches change frequently)
    await redisClient.set(cacheKey, JSON.stringify(transformedMatch), 60);

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedMatch
    });
  } catch (error: any) {
    logger.error(`Error fetching match details for ${id}:`, error);
    
    // Fallback to database
    const match = await CricketMatch.findById(id).lean();

    if (!match) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Cricket match not found'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: match,
      warning: 'Using database fallback - API unavailable'
    });
  }
});

// Get cricket match commentary
export const getCricketMatchCommentary = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Try to get from cache first
    const cacheKey = `cricket_commentary:${id}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    // Fetch from external API
    logger.info(`Fetching cricket commentary from SportsMonks for ${id}...`);
    
    const commentary = await sportsmonksService.getCommentary(id, 'cricket');

    // Cache for 30 seconds (commentary updates frequently)
    await redisClient.set(cacheKey, JSON.stringify(commentary), 30);

    res.status(StatusCodes.OK).json({
      success: true,
      data: commentary
    });
  } catch (error: any) {
    logger.error(`Error fetching commentary for ${id}:`, error);
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: [],
      warning: 'Commentary unavailable - API error'
    });
  }
});

// Get cricket series
export const getCricketSeries = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const series = await CricketMatch.aggregate([
    {
      $group: {
        _id: '$series',
        count: { $sum: 1 },
        latestMatch: { $max: '$startTime' }
      }
    },
    { $sort: { latestMatch: -1 } },
    { $skip: skip },
    { $limit: Number(limit) }
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: series
  });
});

// Get cricket players
export const getCricketPlayers = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, q } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (q) {
    filter.$or = [
      { 'players.name': new RegExp(q as string, 'i') },
      { 'players.role': new RegExp(q as string, 'i') }
    ];
  }

  const players = await CricketMatch.aggregate([
    { $unwind: '$players' },
    { $match: filter },
    {
      $group: {
        _id: '$players.id',
        name: { $first: '$players.name' },
        role: { $first: '$players.role' },
        team: { $first: '$players.team' },
        totalRuns: { $sum: '$players.runs' },
        totalWickets: { $sum: '$players.wickets' },
        matchCount: { $sum: 1 }
      }
    },
    { $sort: { totalRuns: -1, totalWickets: -1 } },
    { $skip: skip },
    { $limit: Number(limit) }
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: players
  });
});

// Get cricket statistics
export const getCricketStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await CricketMatch.aggregate([
    {
      $group: {
        _id: null,
        totalMatches: { $sum: 1 },
        liveMatches: {
          $sum: { $cond: [{ $eq: ['$status', 'live'] }, 1, 0] }
        },
        completedMatches: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        upcomingMatches: {
          $sum: { $cond: [{ $eq: ['$status', 'upcoming'] }, 1, 0] }
        },
        totalRuns: { $sum: { $add: ['$currentScore.home.runs', '$currentScore.away.runs'] } },
        totalWickets: { $sum: { $add: ['$currentScore.home.wickets', '$currentScore.away.wickets'] } }
      }
    }
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: stats[0] || {}
  });
});
