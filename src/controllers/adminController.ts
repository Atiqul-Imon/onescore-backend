import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';
import { NewsArticle } from '../models/NewsArticle';
import { Content } from '../models/Content';
import { Thread } from '../models/Thread';
import { User } from '../models/User';

export const getKPIs = asyncHandler(async (_req: Request, res: Response) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalArticles,
    pendingReview,
    scheduled,
    publishedToday,
    totalUsers,
    totalThreads,
    totalContent,
  ] = await Promise.all([
    NewsArticle.countDocuments({ isDeleted: false }),
    NewsArticle.countDocuments({ state: 'in_review', isDeleted: false }),
    NewsArticle.countDocuments({ state: 'scheduled', isDeleted: false }),
    NewsArticle.countDocuments({ state: 'published', publishedAt: { $gte: todayStart }, isDeleted: false }),
    User.countDocuments({}),
    Thread.countDocuments({ isDeleted: false }),
    Content.countDocuments({}),
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      totalArticles,
      pendingReview,
      scheduled,
      publishedToday,
      totalUsers,
      totalThreads,
      totalContent,
    }
  });
});

export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  const { lines = 200 } = req.query as any;
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  if (!fs.existsSync(logPath)) {
    return res.status(StatusCodes.OK).json({ success: true, data: '' });
  }
  const content = fs.readFileSync(logPath, 'utf-8');
  const parts = content.trim().split('\n');
  const tail = parts.slice(Math.max(0, parts.length - Number(lines))).join('\n');
  res.status(StatusCodes.OK).json({ success: true, data: tail });
});


