import { Request, Response } from 'express';
import { FootballMatch } from '../models/FootballMatch';
import { redisClient } from '../utils/redis';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';
import { sportsmonksService } from '../services/sportsmonksService';
import { transformSportsMonksMatchToFrontend } from '../utils/sportsmonksTransformers';
import { logger } from '../utils/logger';

// Get all football matches with pagination and filters
export const getFootballMatches = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    status, 
    league, 
    season, 
    startDate, 
    endDate 
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build filter object
  const filter: any = {};
  
  if (status) filter.status = status;
  if (league) filter.league = new RegExp(league as string, 'i');
  if (season) filter.season = season;
  
  if (startDate || endDate) {
    filter.startTime = {};
    if (startDate) filter.startTime.$gte = new Date(startDate as string);
    if (endDate) filter.startTime.$lte = new Date(endDate as string);
  }

  // Try to get from cache first
  const cacheKey = `football_matches:${JSON.stringify(filter)}:${page}:${limit}`;
  const cachedData = await redisClient.get(cacheKey);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const matches = await FootballMatch.find(filter)
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await FootballMatch.countDocuments(filter);

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

// Get live football matches
export const getLiveFootballMatches = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Try to get from cache first
    const cachedData = await redisClient.get('live_football_matches');
    
    if (cachedData) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    logger.info('Fetching live football matches from SportsMonks...');
    
    // Fetch from SportsMonks API
    const apiMatches = await sportsmonksService.getLiveMatches('football');
    
    // Transform API response to frontend format
    const transformedMatches = apiMatches.map((match: any) => 
      transformSportsMonksMatchToFrontend(match, 'football')
    );
    
    // Filter only live matches
    const liveMatches = transformedMatches.filter(match => 
      match.status === 'live'
    );
    
    logger.info(`Received ${liveMatches.length} live football matches from SportsMonks`);
    
    // Cache for 30 seconds
    const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 30;
    await redisClient.set('live_football_matches', JSON.stringify(liveMatches), cacheDuration);

    res.status(StatusCodes.OK).json({
      success: true,
      data: liveMatches
    });
  } catch (error: any) {
    logger.error('Error fetching live football matches from SportsMonks:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    // Fallback to database if API fails
    const dbMatches = await FootballMatch.find({ status: 'live' })
      .sort({ startTime: -1 })
      .lean();
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: dbMatches,
      warning: 'Using database fallback - SportsMonks API unavailable',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get football fixtures (upcoming matches)
export const getFootballFixtures = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    league, 
    season, 
    startDate, 
    endDate 
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  const filter: any = { status: 'scheduled' };
  
  if (league) filter.league = new RegExp(league as string, 'i');
  if (season) filter.season = season;
  
  if (startDate || endDate) {
    filter.startTime = {};
    if (startDate) filter.startTime.$gte = new Date(startDate as string);
    if (endDate) filter.startTime.$lte = new Date(endDate as string);
  }

  const fixtures = await FootballMatch.find(filter)
    .sort({ startTime: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await FootballMatch.countDocuments(filter);

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      fixtures,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    }
  });
});

// Get football results (completed matches)
export const getFootballResults = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    league, 
    season, 
    startDate, 
    endDate 
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  const filter: any = { status: 'finished' };
  
  if (league) filter.league = new RegExp(league as string, 'i');
  if (season) filter.season = season;
  
  if (startDate || endDate) {
    filter.startTime = {};
    if (startDate) filter.startTime.$gte = new Date(startDate as string);
    if (endDate) filter.startTime.$lte = new Date(endDate as string);
  }

  const results = await FootballMatch.find(filter)
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await FootballMatch.countDocuments(filter);

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      results,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    }
  });
});

// Get football match by ID
export const getFootballMatchById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Try to get from cache first
  const cachedData = await redisClient.get(`football_match:${id}`);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const match = await FootballMatch.findById(id).lean();

  if (!match) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Football match not found'
    });
  }

  // Cache for 1 minute
  await redisClient.set(`football_match:${id}`, JSON.stringify(match), 60);

  res.status(StatusCodes.OK).json({
    success: true,
    data: match
  });
});

// Get football leagues
export const getFootballLeagues = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const leagues = await FootballMatch.aggregate([
    {
      $group: {
        _id: '$league',
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
    data: leagues
  });
});

// Get football teams
export const getFootballTeams = asyncHandler(async (req: Request, res: Response) => {
  // Try to get from cache first
  const cachedData = await redisClient.get('football_teams');
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const teams = await FootballMatch.aggregate([
    {
      $facet: {
        homeTeams: [
          { $group: {
            _id: '$teams.home.id',
            name: { $first: '$teams.home.name' },
            shortName: { $first: '$teams.home.shortName' },
            logo: { $first: '$teams.home.logo' },
            matchCount: { $sum: 1 }
          }}
        ],
        awayTeams: [
          { $group: {
            _id: '$teams.away.id',
            name: { $first: '$teams.away.name' },
            shortName: { $first: '$teams.away.shortName' },
            logo: { $first: '$teams.away.logo' },
            matchCount: { $sum: 1 }
          }}
        ]
      }
    },
    {
      $project: {
        teams: { $concatArrays: ['$homeTeams', '$awayTeams'] }
      }
    },
    { $unwind: '$teams' },
    { $replaceRoot: { newRoot: '$teams' } },
    { $sort: { matchCount: -1 } }
  ]);

  // Cache for 1 hour
  await redisClient.set('football_teams', JSON.stringify(teams), 3600);

  res.status(StatusCodes.OK).json({
    success: true,
    data: teams
  });
});

// Get football players
export const getFootballPlayers = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, q } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (q) {
    filter.$or = [
      { 'players.name': new RegExp(q as string, 'i') },
      { 'players.position': new RegExp(q as string, 'i') }
    ];
  }

  const players = await FootballMatch.aggregate([
    { $unwind: '$players' },
    { $match: filter },
    {
      $group: {
        _id: '$players.id',
        name: { $first: '$players.name' },
        position: { $first: '$players.position' },
        team: { $first: '$players.team' },
        matchCount: { $sum: 1 }
      }
    },
    { $sort: { matchCount: -1 } },
    { $skip: skip },
    { $limit: Number(limit) }
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: players
  });
});

// Get football statistics
export const getFootballStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await FootballMatch.aggregate([
    {
      $group: {
        _id: null,
        totalMatches: { $sum: 1 },
        liveMatches: {
          $sum: { $cond: [{ $eq: ['$status', 'live'] }, 1, 0] }
        },
        completedMatches: {
          $sum: { $cond: [{ $eq: ['$status', 'finished'] }, 1, 0] }
        },
        upcomingMatches: {
          $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
        },
        totalGoals: { $sum: { $add: ['$score.home', '$score.away'] } }
      }
    }
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: stats[0] || {}
  });
});
