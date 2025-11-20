import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';
import { CricketTeam } from '../models/CricketTeam';
import { CricketMatch } from '../models/CricketMatch';
import { NewsArticle } from '../models/NewsArticle';
import { redisClient } from '../utils/redis';

const buildTeamMatchFilter = (matchKey: string, name: string, shortName: string) => ([
  { 'teams.home.id': matchKey },
  { 'teams.away.id': matchKey },
  { 'teams.home.shortName': shortName },
  { 'teams.away.shortName': shortName },
  { 'teams.home.name': name },
  { 'teams.away.name': name },
]);

export const getCricketTeamSummaries = asyncHandler(async (_req: Request, res: Response) => {
  const teams = await CricketTeam.find({}, {
    slug: 1,
    name: 1,
    shortName: 1,
    matchKey: 1,
    flag: 1,
    heroImage: 1,
    summary: 1,
    ranking: 1,
    captains: 1,
    coach: 1,
    fanPulse: 1,
    colors: 1,
    iccTitles: 1,
    updatedAt: 1,
  }).sort({ name: 1 }).lean();

  res.status(StatusCodes.OK).json({
    success: true,
    data: teams,
  });
});

export const getCricketTeamDetail = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const cacheKey = `cricket_team_detail:${slug}`;

  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cached),
      meta: { cached: true },
    });
  }

  const team = await CricketTeam.findOne({ slug }).lean();

  if (!team) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Team not found',
    });
  }

  const matchOrFilter = buildTeamMatchFilter(team.matchKey, team.name, team.shortName);

  const [upcomingFixtures, recentResults, latestNews] = await Promise.all([
    CricketMatch.find({
      status: 'upcoming',
      $or: matchOrFilter,
    })
      .sort({ startTime: 1 })
      .limit(6)
      .lean(),
    CricketMatch.find({
      status: 'completed',
      $or: matchOrFilter,
    })
      .sort({ startTime: -1 })
      .limit(6)
      .lean(),
    NewsArticle.find({
      category: 'cricket',
      state: 'published',
      ...(team.newsTags?.length ? { tags: { $in: team.newsTags } } : {}),
    })
      .sort({ publishedAt: -1 })
      .limit(8)
      .select('title slug summary heroImage type publishedAt readingTimeMinutes tags')
      .lean(),
  ]);

  const payload = {
    team,
    news: {
      featured: latestNews[0] || null,
      items: latestNews,
    },
    fixtures: {
      upcoming: upcomingFixtures,
      results: recentResults,
    },
    stats: {
      ranking: team.ranking,
      fanPulse: team.fanPulse,
      keyPlayers: team.keyPlayers,
      statLeaders: team.statLeaders,
      recordLinks: team.recordLinks,
      iccTitles: team.iccTitles,
    },
    timeline: team.timeline,
    updatedAt: team.updatedAt,
  };

  await redisClient.set(cacheKey, JSON.stringify(payload), 120);

  res.status(StatusCodes.OK).json({
    success: true,
    data: payload,
  });
});

export const getCricketTeamPlayersBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { limit = 20 } = req.query;

  const team = await CricketTeam.findOne({ slug }).lean();
  if (!team) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Team not found',
    });
  }

  const identifiers = [team.name, team.shortName, team.matchKey];
  const matchOrFilter = buildTeamMatchFilter(team.matchKey, team.name, team.shortName);

  const players = await CricketMatch.aggregate([
    {
      $match: {
        $or: matchOrFilter,
      },
    },
    { $unwind: '$players' },
    {
      $match: {
        'players.team': { $in: identifiers },
      },
    },
    {
      $group: {
        _id: '$players.id',
        name: { $first: '$players.name' },
        role: { $first: '$players.role' },
        team: { $first: '$players.team' },
        totalRuns: { $sum: { $ifNull: ['$players.runs', 0] } },
        totalWickets: { $sum: { $ifNull: ['$players.wickets', 0] } },
        matches: { $sum: 1 },
      },
    },
    {
      $sort: {
        totalRuns: -1,
        totalWickets: -1,
      },
    },
    { $limit: Number(limit) },
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: players,
  });
});

