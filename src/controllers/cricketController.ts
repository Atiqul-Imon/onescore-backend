import { Request, Response } from 'express';
import { CricketMatch } from '../models/CricketMatch';
import { redisClient } from '../utils/redis';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';
import { cricketApiService } from '../services/cricketApiService';
import { transformApiMatchToFrontend } from '../utils/matchTransformers';

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

    // Fetch from external API
    const apiMatches = await cricketApiService.getLiveMatches();
    
    // Transform API response to frontend format
    const transformedMatches = apiMatches.map(transformApiMatchToFrontend);
    
    // Filter only live matches (API might return some completed)
    const liveMatches = transformedMatches.filter(match => 
      match.status === 'live' || (match.matchStarted && !match.matchEnded)
    );
    
    // Cache duration: 30 seconds in development, 15 minutes in production
    // This keeps us within the 100 requests/day API limit
    const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 30; // 15 min vs 30 sec
    await redisClient.set('live_cricket_matches', JSON.stringify(liveMatches), cacheDuration);

    res.status(StatusCodes.OK).json({
      success: true,
      data: liveMatches
    });
  } catch (error: any) {
    // Fallback to database if API fails
    const dbMatches = await CricketMatch.find({ status: 'live' })
      .sort({ startTime: -1 })
      .lean();
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: dbMatches,
      warning: 'Using cached data - API unavailable'
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

    // Fetch from external API
    const apiMatches = await cricketApiService.getUpcomingMatches();
    
    // Transform API response to frontend format
    const transformedMatches = apiMatches.map(transformApiMatchToFrontend);
    
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
      },
      warning: 'Using cached data - API unavailable'
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
