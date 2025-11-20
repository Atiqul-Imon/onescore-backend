import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';
import { CricketTeam } from '../models/CricketTeam';
import { redisClient } from '../utils/redis';

const allowedFields = [
  'slug',
  'name',
  'shortName',
  'matchKey',
  'flag',
  'crest',
  'heroImage',
  'summary',
  'board',
  'coach',
  'captains',
  'ranking',
  'firstTestYear',
  'colors',
  'fanPulse',
  'iccTitles',
  'keyPlayers',
  'statLeaders',
  'recordLinks',
  'timeline',
  'newsTags',
] as const;

type AllowedField = typeof allowedFields[number];

const sanitizePayload = (body: Record<string, any>) => {
  const payload: Record<string, any> = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  });

  if (Array.isArray(payload.newsTags)) {
    payload.newsTags = payload.newsTags.map((tag: string) => tag.toLowerCase().trim()).filter(Boolean);
  }

  return payload;
};

export const adminListCricketTeams = asyncHandler(async (_req: Request, res: Response) => {
  const teams = await CricketTeam.find({})
    .sort({ name: 1 })
    .lean();

  res.status(StatusCodes.OK).json({
    success: true,
    data: teams,
  });
});

export const adminGetCricketTeam = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const team = await CricketTeam.findOne({ slug }).lean();

  if (!team) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Team not found',
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: team,
  });
});

export const adminUpsertCricketTeam = asyncHandler(async (req: Request, res: Response) => {
  const slugParam = req.params.slug;
  const slugBody = req.body.slug;
  const slug = slugParam || slugBody;

  if (!slug) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Team slug is required',
    });
  }

  const update = sanitizePayload({
    ...req.body,
    slug: slugParam ? slugParam : slugBody,
  });

  const team = await CricketTeam.findOneAndUpdate(
    { slug },
    update,
    {
      new: true,
      upsert: !slugParam,
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  ).lean();

  await redisClient.del('cricket_teams', `cricket_team_detail:${slug}`);

  res.status(slugParam ? StatusCodes.OK : StatusCodes.CREATED).json({
    success: true,
    data: team,
  });
});

