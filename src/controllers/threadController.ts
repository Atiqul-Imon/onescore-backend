import { Request, Response } from 'express';
import { Thread } from '../models/Thread';
import { Comment } from '../models/Comment';
import { Vote } from '../models/Vote';
import { redisClient } from '../utils/redis';
import { logger } from '../utils/logger';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';

// Get all threads with pagination, filtering, and sorting
export const getThreads = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    category, 
    sort = 'hot', // hot, new, top, controversial
    time = 'all', // all, day, week, month, year
    search,
    tags,
    author
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build filter object
  const filter: any = { isDeleted: false };
  
  if (category) filter.category = category;
  if (author) filter.author = author;
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    filter.tags = { $in: tagArray };
  }
  if (search) {
    filter.$or = [
      { title: new RegExp(search as string, 'i') },
      { content: new RegExp(search as string, 'i') },
      { tags: new RegExp(search as string, 'i') }
    ];
  }

  // Time filter
  if (time !== 'all') {
    const timeMap: { [key: string]: number } = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };
    
    if (timeMap[time as string]) {
      filter.createdAt = {
        $gte: new Date(Date.now() - timeMap[time as string])
      };
    }
  }

  // Build sort object
  let sortObj: any = {};
  switch (sort) {
    case 'hot':
      sortObj = { isPinned: -1, score: -1, lastActivity: -1 };
      break;
    case 'new':
      sortObj = { isPinned: -1, createdAt: -1 };
      break;
    case 'top':
      sortObj = { isPinned: -1, score: -1, createdAt: -1 };
      break;
    case 'controversial':
      sortObj = { isPinned: -1, upvotes: -1, downvotes: -1 };
      break;
    default:
      sortObj = { isPinned: -1, score: -1, lastActivity: -1 };
  }

  // Try to get from cache first
  const cacheKey = `threads:${JSON.stringify(filter)}:${sort}:${time}:${page}:${limit}`;
  const cachedData = await redisClient.get(cacheKey);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const threads = await Thread.find(filter)
    .populate('author', 'name avatar stats')
    .sort(sortObj)
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Thread.countDocuments(filter);

  const result = {
    threads,
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

// Get thread by ID with comments
export const getThreadById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sort = 'top', limit = 50 } = req.query;

  // Increment view count
  await Thread.findByIdAndUpdate(id, { $inc: { views: 1 } });

  const thread = await Thread.findById(id)
    .populate('author', 'name avatar stats')
    .lean();

  if (!thread || thread.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Thread not found'
    });
  }

  // Get comments with sorting
  let commentSort: any = {};
  switch (sort) {
    case 'top':
      commentSort = { score: -1, createdAt: -1 };
      break;
    case 'new':
      commentSort = { createdAt: -1 };
      break;
    case 'old':
      commentSort = { createdAt: 1 };
      break;
    default:
      commentSort = { score: -1, createdAt: -1 };
  }

  const comments = await Comment.find({ 
    thread: id, 
    isDeleted: false 
  })
    .populate('author', 'name avatar stats')
    .sort(commentSort)
    .limit(Number(limit))
    .lean();

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      thread,
      comments
    }
  });
});

// Create new thread
export const createThread = asyncHandler(async (req: Request, res: Response) => {
  const { title, content, category, tags, flair, media, poll } = req.body;
  const userId = (req as any).user?._id;

  if (!userId) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  logger.info('Creating thread:', { title, category, userId });

  const thread = new Thread({
    title,
    content,
    author: userId,
    category,
    tags: tags || [],
    flair,
    media,
    poll
  });

  await thread.save();
  logger.info('Thread saved:', { threadId: thread._id, title: thread.title });

  // Populate author info
  await thread.populate('author', 'name avatar stats');

  // Clear cache - delete all thread-related cache keys
  try {
    const keys = await redisClient.keys('threads:*');
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(key => redisClient.del(key)));
      logger.info(`Cleared ${keys.length} thread cache keys`);
    }
  } catch (e) {
    logger.warn('Could not clear thread cache:', e);
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Thread created successfully',
    data: thread
  });
});

// Update thread
export const updateThread = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content, tags, flair, editReason } = req.body;
  const userId = (req as any).user._id;

  const thread = await Thread.findById(id);

  if (!thread || thread.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Thread not found'
    });
  }

  // Check if user is author or moderator
  if (thread.author.toString() !== userId.toString() && !(req as any).user.isAdmin()) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'Not authorized to edit this thread'
    });
  }

  const updateData: any = {
    editedAt: new Date(),
    editedBy: userId,
    editReason
  };

  if (title) updateData.title = title;
  if (content) updateData.content = content;
  if (tags) updateData.tags = tags;
  if (flair) updateData.flair = flair;

  const updatedThread = await Thread.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  ).populate('author', 'name avatar stats');

  // Clear cache - delete all thread-related cache keys
  try {
    const keys = await redisClient.keys('threads:*');
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(key => redisClient.del(key)));
    }
  } catch (e) {
    logger.warn('Could not clear thread cache:', e);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Thread updated successfully',
    data: updatedThread
  });
});

// Delete thread (soft delete)
export const deleteThread = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user._id;

  const thread = await Thread.findById(id);

  if (!thread || thread.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Thread not found'
    });
  }

  // Check if user is author or admin
  if (thread.author.toString() !== userId.toString() && !(req as any).user.isAdmin()) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'Not authorized to delete this thread'
    });
  }

  await Thread.findByIdAndUpdate(id, {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId
  });

  // Clear cache - delete all thread-related cache keys
  try {
    const keys = await redisClient.keys('threads:*');
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(key => redisClient.del(key)));
    }
  } catch (e) {
    logger.warn('Could not clear thread cache:', e);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Thread deleted successfully'
  });
});

// Vote on thread
export const voteThread = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { voteType } = req.body; // 'upvote' or 'downvote'
  const userId = (req as any).user._id;

  const thread = await Thread.findById(id);

  if (!thread || thread.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Thread not found'
    });
  }

  // Check if user already voted
  const existingVote = await Vote.findOne({
    user: userId,
    targetType: 'thread',
    targetId: id
  });

  if (existingVote) {
    if (existingVote.voteType === voteType) {
      // Remove vote if same type
      await Vote.findByIdAndDelete(existingVote._id);
      
      if (voteType === 'upvote') {
        thread.upvotes = Math.max(0, thread.upvotes - 1);
      } else {
        thread.downvotes = Math.max(0, thread.downvotes - 1);
      }
    } else {
      // Change vote type
      existingVote.voteType = voteType;
      await existingVote.save();
      
      if (voteType === 'upvote') {
        thread.upvotes += 1;
        thread.downvotes = Math.max(0, thread.downvotes - 1);
      } else {
        thread.downvotes += 1;
        thread.upvotes = Math.max(0, thread.upvotes - 1);
      }
    }
  } else {
    // Create new vote
    await Vote.create({
      user: userId,
      targetType: 'thread',
      targetId: id,
      voteType
    });
    
    if (voteType === 'upvote') {
      thread.upvotes += 1;
    } else {
      thread.downvotes += 1;
    }
  }

  await thread.save();

  // Clear cache - delete all thread-related cache keys
  try {
    const keys = await redisClient.keys('threads:*');
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(key => redisClient.del(key)));
    }
  } catch (e) {
    logger.warn('Could not clear thread cache:', e);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Vote recorded successfully',
    data: {
      upvotes: thread.upvotes,
      downvotes: thread.downvotes,
      score: thread.score
    }
  });
});

// Pin/Unpin thread (admin only)
export const pinThread = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pinned } = req.body;

  const thread = await Thread.findById(id);

  if (!thread || thread.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Thread not found'
    });
  }

  thread.isPinned = pinned;
  await thread.save();

  // Clear cache - delete all thread-related cache keys
  try {
    const keys = await redisClient.keys('threads:*');
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(key => redisClient.del(key)));
    }
  } catch (e) {
    logger.warn('Could not clear thread cache:', e);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Thread ${pinned ? 'pinned' : 'unpinned'} successfully`,
    data: thread
  });
});

// Lock/Unlock thread (moderator only)
export const lockThread = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { locked } = req.body;

  const thread = await Thread.findById(id);

  if (!thread || thread.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Thread not found'
    });
  }

  thread.isLocked = locked;
  await thread.save();

  // Clear cache - delete all thread-related cache keys
  try {
    const keys = await redisClient.keys('threads:*');
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(key => redisClient.del(key)));
    }
  } catch (e) {
    logger.warn('Could not clear thread cache:', e);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Thread ${locked ? 'locked' : 'unlocked'} successfully`,
    data: thread
  });
});

// Report thread
export const reportThread = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = (req as any).user._id;

  const thread = await Thread.findById(id);

  if (!thread || thread.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Thread not found'
    });
  }

  // Check if user already reported this thread
  const existingReport = thread.reports.find(
    report => report.reportedBy.toString() === userId.toString()
  );

  if (existingReport) {
    return res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: 'You have already reported this thread'
    });
  }

  thread.reports.push({
    reportedBy: userId,
    reason,
    reportedAt: new Date(),
    status: 'pending'
  });

  await thread.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Thread reported successfully'
  });
});

// Get thread statistics
export const getThreadStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const thread = await Thread.findById(id).select('upvotes downvotes score views commentCount createdAt');

  if (!thread || thread.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Thread not found'
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      upvotes: thread.upvotes,
      downvotes: thread.downvotes,
      score: thread.score,
      views: thread.views,
      commentCount: thread.commentCount,
      createdAt: thread.createdAt
    }
  });
});
