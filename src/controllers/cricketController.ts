import { Request, Response } from 'express';
import { CricketMatch } from '../models/CricketMatch';
import { redisClient } from '../utils/redis';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';

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
  // Try to get from cache first
  const cachedData = await redisClient.get('live_cricket_matches');
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const liveMatches = await CricketMatch.find({ status: 'live' })
    .sort({ startTime: -1 })
    .lean();

  // Cache for 30 seconds
  await redisClient.set('live_cricket_matches', JSON.stringify(liveMatches), 30);

  res.status(StatusCodes.OK).json({
    success: true,
    data: liveMatches
  });
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

// Get cricket match by ID
export const getCricketMatchById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Try to get from cache first
  const cachedData = await redisClient.get(`cricket_match:${id}`);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const match = await CricketMatch.findById(id).lean();

  if (!match) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Cricket match not found'
    });
  }

  // Cache for 1 minute
  await redisClient.set(`cricket_match:${id}`, JSON.stringify(match), 60);

  res.status(StatusCodes.OK).json({
    success: true,
    data: match
  });
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

// Get cricket teams
export const getCricketTeams = asyncHandler(async (req: Request, res: Response) => {
  // Try to get from cache first
  const cachedData = await redisClient.get('cricket_teams');
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const teams = await CricketMatch.aggregate([
    {
      $facet: {
        homeTeams: [
          { $group: {
            _id: '$teams.home.id',
            name: { $first: '$teams.home.name' },
            shortName: { $first: '$teams.home.shortName' },
            flag: { $first: '$teams.home.flag' },
            matchCount: { $sum: 1 }
          }}
        ],
        awayTeams: [
          { $group: {
            _id: '$teams.away.id',
            name: { $first: '$teams.away.name' },
            shortName: { $first: '$teams.away.shortName' },
            flag: { $first: '$teams.away.flag' },
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
  await redisClient.set('cricket_teams', JSON.stringify(teams), 3600);

  res.status(StatusCodes.OK).json({
    success: true,
    data: teams
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
