import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { NewsArticle } from '../models/NewsArticle';
import { NewsRevision } from '../models/NewsRevision';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { indexDocument as esIndexDocument, deleteDocument as esDeleteDocument, searchContent as esSearch } from '../utils/elasticsearch';

function buildSlug(date: Date, rawSlug: string) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `news/${yyyy}/${mm}/${rawSlug}`;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// No cache invalidation for now (caching disabled in v1)

// Keep validation light for v1; rely mostly on model requirements

export const createArticle = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, summary, body, type, category, tags = [], heroImage, gallery = [], entityRefs, seo } = req.body;

  // Validate required fields
  if (!title || !body || !type || !category) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Missing required fields: title, body, type, and category are required'
    });
  }

  // Use authenticated user as author
  if (!req.user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const authorId = req.user._id || req.user.id;

  const baseSlug = slugify(title);
  const datedSlug = buildSlug(new Date(), baseSlug);

  const now = new Date();
  const article = await NewsArticle.create({
    title,
    slug: datedSlug,
    summary,
    body,
    type,
    category,
    tags,
    heroImage,
    gallery: gallery || [],
    author: authorId,
    entityRefs,
    seo,
    state: 'published',
    scheduledAt: null,
    publishedAt: now,
  });

  await NewsRevision.create({ 
    articleId: article._id, 
    snapshot: article.toObject(), 
    editorId: authorId, 
    note: 'create' 
  });

  // Index in Elasticsearch since article is published
  try {
    await esIndexDocument('news_articles', article._id.toString(), {
      id: article._id.toString(),
      title: article.title,
      summary: article.summary,
      body: article.body,
      slug: article.slug,
      type: article.type,
      category: article.category,
      tags: article.tags,
      publishedAt: article.publishedAt,
    });
  } catch (e) {
    logger.warn('Failed to index news article in ES', e);
  }

  res.status(StatusCodes.CREATED).json({ success: true, data: article });
});

export const updateArticle = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updatable = [ 'title','summary','body','type','category','tags','heroImage','gallery','entityRefs','seo','canonicalUrl','scheduledAt' ];
  const update: any = {};
  for (const key of updatable) if (key in req.body) update[key] = req.body[key];

  if (update.title) {
    const baseSlug = slugify(update.title);
    update.slug = buildSlug(new Date(), baseSlug);
  }

  const article = await NewsArticle.findByIdAndUpdate(id, update, { new: true });
  if (!article) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Article not found' });

  const editorId = req.user?._id || req.user?.id;
  await NewsRevision.create({ articleId: article._id, snapshot: article.toObject(), editorId, note: 'update' });

  res.status(StatusCodes.OK).json({ success: true, data: article });
});

export const submitForReview = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const article = await NewsArticle.findByIdAndUpdate(id, { state: 'in_review' }, { new: true });
  if (!article) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Article not found' });
  res.status(StatusCodes.OK).json({ success: true, data: article });
});

export const scheduleArticle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { scheduledAt } = req.body;
  const date = scheduledAt ? new Date(scheduledAt) : null;
  const article = await NewsArticle.findByIdAndUpdate(id, { state: date ? 'scheduled' : 'draft', scheduledAt: date }, { new: true });
  if (!article) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Article not found' });
  res.status(StatusCodes.OK).json({ success: true, data: article });
});

export const publishArticle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const article = await NewsArticle.findByIdAndUpdate(id, { state: 'published', publishedAt: new Date(), scheduledAt: null }, { new: true });
  if (!article) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Article not found' });

  try {
    await esIndexDocument('news_articles', article._id.toString(), {
      id: article._id.toString(),
      title: article.title,
      summary: article.summary,
      body: article.body,
      slug: article.slug,
      type: article.type,
      category: article.category,
      tags: article.tags,
      publishedAt: article.publishedAt,
    });
  } catch (e) {
    logger.warn('Failed to index news article in ES', e);
  }

  res.status(StatusCodes.OK).json({ success: true, data: article });
});

export const unpublishArticle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const article = await NewsArticle.findByIdAndUpdate(id, { state: 'draft', publishedAt: null }, { new: true });
  if (!article) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Article not found' });

  try { await esDeleteDocument('news_articles', id); } catch (e) { logger.warn('Failed to delete ES doc', e); }

  res.status(StatusCodes.OK).json({ success: true, data: article });
});

export const listArticles = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, type, category, tag, team, player, series, dateFrom, dateTo, state = 'published' } = req.query as any;

  const skip = (Number(page) - 1) * Number(limit);
  const filter: any = { isDeleted: false };
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  // Only filter by state if it's not 'all' and is provided
  if (state && state !== 'all') filter.state = state;
  if (team) filter['entityRefs.teamIds'] = team;
  if (player) filter['entityRefs.playerIds'] = player;
  if (series) filter['entityRefs.seriesIds'] = series;
  if (dateFrom || dateTo) filter.publishedAt = { ...(dateFrom ? { $gte: new Date(String(dateFrom)) } : {}), ...(dateTo ? { $lte: new Date(String(dateTo)) } : {}) };

  const articles = await NewsArticle.find(filter)
    .populate('author', 'name avatar')
    .sort({ publishedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();
  const total = await NewsArticle.countDocuments(filter);
  const result = { items: articles, pagination: { current: Number(page), pages: Math.ceil(total / Number(limit)), total, limit: Number(limit) } };
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const article = await NewsArticle.findOne({ slug, isDeleted: false })
    .populate('author', 'name avatar')
    .lean();
  if (!article) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Not found' });
  res.status(StatusCodes.OK).json({ success: true, data: article });
});

export const getByWildcardSlug = asyncHandler(async (req: Request, res: Response) => {
  const fullSlug = req.params[0];
  const article = await NewsArticle.findOne({ slug: fullSlug, isDeleted: false })
    .populate('author', 'name avatar')
    .lean();
  if (!article) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Not found' });
  res.status(StatusCodes.OK).json({ success: true, data: article });
});

export const trending = asyncHandler(async (_req: Request, res: Response) => {
  const items = await NewsArticle.find({ state: 'published', isDeleted: false })
    .sort({ viewCount: -1, publishedAt: -1 })
    .limit(20)
    .lean();
  res.status(StatusCodes.OK).json({ success: true, data: items });
});

export const searchNews = asyncHandler(async (req: Request, res: Response) => {
  const { q = '' } = req.query as any;
  if (!q || String(q).trim().length < 2) return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'q required' });
  try {
    const results = await esSearch(String(q), 'news_articles');
    return res.status(StatusCodes.OK).json({ success: true, data: results });
  } catch (e) {
    logger.warn('ES search fallback to Mongo', e);
    const items = await NewsArticle.find({ $text: { $search: String(q) }, state: 'published', isDeleted: false }, { score: { $meta: 'textScore' }})
      .sort({ score: { $meta: 'textScore' }})
      .limit(20)
      .lean();
    return res.status(StatusCodes.OK).json({ success: true, data: items });
  }
});

// Like an article
export const likeArticle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const article = await NewsArticle.findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true });
  if (!article) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Article not found' });
  }
  res.status(StatusCodes.OK).json({ success: true, data: { likes: article.likes, dislikes: article.dislikes } });
});

// Dislike an article
export const dislikeArticle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const article = await NewsArticle.findByIdAndUpdate(id, { $inc: { dislikes: 1 } }, { new: true });
  if (!article) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Article not found' });
  }
  res.status(StatusCodes.OK).json({ success: true, data: { likes: article.likes, dislikes: article.dislikes } });
});

// Get related articles
export const getRelatedArticles = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const article = await NewsArticle.findById(id).select('category tags type');
  
  if (!article) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Article not found' });
  }

  // Find articles with same category and tags, excluding current article
  const related = await NewsArticle.find({
    _id: { $ne: id },
    state: 'published',
    isDeleted: false,
    $or: [
      { category: article.category },
      { tags: { $in: article.tags } },
      { type: article.type }
    ]
  })
    .select('title slug summary heroImage publishedAt readingTimeMinutes author')
    .populate('author', 'name')
    .sort({ publishedAt: -1 })
    .limit(6)
    .lean();

  res.status(StatusCodes.OK).json({ success: true, data: related });
});


