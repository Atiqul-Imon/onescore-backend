import { Request, Response } from 'express';
import { Comment } from '../models/Comment';
import { Thread } from '../models/Thread';
import { Vote } from '../models/Vote';
import { redisClient } from '../utils/redis';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';

// Get comments for a thread or article
export const getComments = asyncHandler(async (req: Request, res: Response) => {
  const { threadId, articleId } = req.params;
  const { 
    page = 1, 
    limit = 50, 
    sort = 'top', // top, new, old, controversial
    parentId 
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build filter object
  const filter: any = { 
    isDeleted: false 
  };
  
  if (threadId) {
    filter.thread = threadId;
  } else if (articleId) {
    filter.article = articleId;
  } else {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Either threadId or articleId must be provided'
    });
  }
  
  if (parentId) {
    filter.parentComment = parentId;
  } else {
    filter.parentComment = { $exists: false };
  }

  // Build sort object
  let sortObj: any = {};
  switch (sort) {
    case 'top':
      sortObj = { score: -1, createdAt: -1 };
      break;
    case 'new':
      sortObj = { createdAt: -1 };
      break;
    case 'old':
      sortObj = { createdAt: 1 };
      break;
    case 'controversial':
      sortObj = { upvotes: -1, downvotes: -1 };
      break;
    default:
      sortObj = { score: -1, createdAt: -1 };
  }

  // Try to get from cache first
  const entityId = threadId || articleId;
  const cacheKey = `comments:${entityId}:${parentId || 'root'}:${sort}:${page}:${limit}`;
  const cachedData = await redisClient.get(cacheKey);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const comments = await Comment.find(filter)
    .populate('author', 'name avatar stats')
    .sort(sortObj)
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Comment.countDocuments(filter);

  const result = {
    comments,
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

// Get comment by ID
export const getCommentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const comment = await Comment.findById(id)
    .populate('author', 'name avatar stats')
    .populate('thread', 'title')
    .lean();

  if (!comment || comment.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Comment not found'
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: comment
  });
});

// Create new comment
export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const { content, threadId, articleId, parentCommentId } = req.body;
  const userId = (req as any).user._id;

  if (!threadId && !articleId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Either threadId or articleId must be provided'
    });
  }

  // Support article comments
  if (articleId) {
    const { NewsArticle } = await import('../models/NewsArticle');
    const article = await NewsArticle.findById(articleId);
    if (!article || article.isDeleted || article.state !== 'published') {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Article not found or not published'
      });
    }
  } else {
    // Check if thread exists and is not locked
    const thread = await Thread.findById(threadId);
    if (!thread || thread.isDeleted) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Thread not found'
      });
    }

    if (thread.isLocked) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Thread is locked'
      });
    }
  }

  // If replying to a comment, check if parent exists
  if (parentCommentId) {
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment || parentComment.isDeleted) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Parent comment not found'
      });
    }
  }

  const comment = new Comment({
    content,
    author: userId,
    thread: threadId,
    article: articleId,
    parentComment: parentCommentId
  });

  await comment.save();

  // Update thread or article comment count
  if (threadId) {
    await Thread.findByIdAndUpdate(threadId, {
      $inc: { commentCount: 1 },
      $push: { comments: comment._id },
      lastActivity: new Date()
    });
  }

  // If replying to a comment, update parent comment
  if (parentCommentId) {
    await Comment.findByIdAndUpdate(parentCommentId, {
      $push: { replies: comment._id }
    });
  }

  // Populate author info
  await comment.populate('author', 'name avatar stats');

  // Clear cache
  await redisClient.del(`comments:${threadId}:*`);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Comment created successfully',
    data: comment
  });
});

// Update comment
export const updateComment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, editReason } = req.body;
  const userId = (req as any).user._id;

  const comment = await Comment.findById(id);

  if (!comment || comment.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Comment not found'
    });
  }

  // Check if user is author or moderator
  if (comment.author.toString() !== userId.toString() && !(req as any).user.isAdmin()) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'Not authorized to edit this comment'
    });
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    id,
    {
      content,
      editedAt: new Date(),
      editedBy: userId,
      editReason
    },
    { new: true }
  ).populate('author', 'name avatar stats');

  // Clear cache
  await redisClient.del(`comments:${comment.thread}:*`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Comment updated successfully',
    data: updatedComment
  });
});

// Delete comment (soft delete)
export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user._id;

  const comment = await Comment.findById(id);

  if (!comment || comment.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Comment not found'
    });
  }

  // Check if user is author or moderator
  if (comment.author.toString() !== userId.toString() && !(req as any).user.isAdmin()) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'Not authorized to delete this comment'
    });
  }

  await Comment.findByIdAndUpdate(id, {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId
  });

  // Update thread comment count
  await Thread.findByIdAndUpdate(comment.thread, {
    $inc: { commentCount: -1 }
  });

  // Clear cache
  await redisClient.del(`comments:${comment.thread}:*`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Comment deleted successfully'
  });
});

// Vote on comment
export const voteComment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { voteType } = req.body; // 'upvote' or 'downvote'
  const userId = (req as any).user._id;

  const comment = await Comment.findById(id);

  if (!comment || comment.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Comment not found'
    });
  }

  // Check if user already voted
  const existingVote = await Vote.findOne({
    user: userId,
    targetType: 'comment',
    targetId: id
  });

  if (existingVote) {
    if (existingVote.voteType === voteType) {
      // Remove vote if same type
      await Vote.findByIdAndDelete(existingVote._id);
      
      if (voteType === 'upvote') {
        comment.upvotes = Math.max(0, comment.upvotes - 1);
      } else {
        comment.downvotes = Math.max(0, comment.downvotes - 1);
      }
    } else {
      // Change vote type
      existingVote.voteType = voteType;
      await existingVote.save();
      
      if (voteType === 'upvote') {
        comment.upvotes += 1;
        comment.downvotes = Math.max(0, comment.downvotes - 1);
      } else {
        comment.downvotes += 1;
        comment.upvotes = Math.max(0, comment.upvotes - 1);
      }
    }
  } else {
    // Create new vote
    await Vote.create({
      user: userId,
      targetType: 'comment',
      targetId: id,
      voteType
    });
    
    if (voteType === 'upvote') {
      comment.upvotes += 1;
    } else {
      comment.downvotes += 1;
    }
  }

  await comment.save();

  // Clear cache
  await redisClient.del(`comments:${comment.thread}:*`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Vote recorded successfully',
    data: {
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      score: comment.score
    }
  });
});

// Report comment
export const reportComment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = (req as any).user._id;

  const comment = await Comment.findById(id);

  if (!comment || comment.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Comment not found'
    });
  }

  // Check if user already reported this comment
  const existingReport = comment.reports.find(
    report => report.reportedBy.toString() === userId.toString()
  );

  if (existingReport) {
    return res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: 'You have already reported this comment'
    });
  }

  comment.reports.push({
    reportedBy: userId,
    reason,
    reportedAt: new Date(),
    status: 'pending'
  });

  await comment.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Comment reported successfully'
  });
});

// Get comment statistics
export const getCommentStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const comment = await Comment.findById(id).select('upvotes downvotes score replies createdAt');

  if (!comment || comment.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Comment not found'
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      score: comment.score,
      replies: comment.replies.length,
      createdAt: comment.createdAt
    }
  });
});

// Get nested comments (replies to a comment)
export const getCommentReplies = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 20, sort = 'top' } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build sort object
  let sortObj: any = {};
  switch (sort) {
    case 'top':
      sortObj = { score: -1, createdAt: -1 };
      break;
    case 'new':
      sortObj = { createdAt: -1 };
      break;
    case 'old':
      sortObj = { createdAt: 1 };
      break;
    default:
      sortObj = { score: -1, createdAt: -1 };
  }

  const replies = await Comment.find({ 
    parentComment: id, 
    isDeleted: false 
  })
    .populate('author', 'name avatar stats')
    .sort(sortObj)
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Comment.countDocuments({ 
    parentComment: id, 
    isDeleted: false 
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      replies,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    }
  });
});

// Admin: List reported comments (pending)
export const listReportedComments = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 50 } = req.query as any;
  const skip = (Number(page) - 1) * Number(limit);
  const comments = await Comment.find({ 'reports.status': 'pending', isDeleted: false })
    .populate('author', 'name avatar')
    .populate('thread', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();
  const total = await Comment.countDocuments({ 'reports.status': 'pending', isDeleted: false });
  res.status(StatusCodes.OK).json({ success: true, data: { items: comments, pagination: { current: Number(page), pages: Math.ceil(total / Number(limit)), total, limit: Number(limit) } } });
});

// Admin: Resolve a report (action can be 'dismiss' or 'actioned')
export const resolveReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params; // comment id
  const { action } = req.body as { action: 'dismiss' | 'actioned' };
  const comment = await Comment.findById(id);
  if (!comment) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Comment not found' });
  }
  comment.reports = comment.reports.map((r: any) => ({ ...r, status: action }));
  await comment.save();
  res.status(StatusCodes.OK).json({ success: true });
});

// Admin: Hide (soft delete) a comment
export const adminHideComment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const comment = await Comment.findById(id);
  if (!comment || comment.isDeleted) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Comment not found' });
  }
  comment.isDeleted = true;
  comment.deletedAt = new Date();
  await comment.save();
  await Thread.findByIdAndUpdate(comment.thread, { $inc: { commentCount: -1 } });
  res.status(StatusCodes.OK).json({ success: true });
});
