import { Request, Response } from 'express';
import { Content } from '../models/Content';
import { User } from '../models/User';
import { redisClient } from '../utils/redis';
import { logger } from '../utils/logger';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';
import { searchContent as esSearchContent, indexDocument as esIndexDocument, deleteDocument as esDeleteDocument } from '../utils/elasticsearch';

// Get all content with pagination and filters
export const getContent = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    type, 
    category, 
    status = 'approved',
    featured 
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  // Build filter object
  const filter: any = {};
  
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (featured === 'true') filter.featured = true;

  // Try to get from cache first
  const cacheKey = `content:${JSON.stringify(filter)}:${page}:${limit}`;
  const cachedData = await redisClient.get(cacheKey);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const content = await Content.find(filter)
    .populate('contributor', 'name email avatar')
    .sort({ publishedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Content.countDocuments(filter);

  const result = {
    content,
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

// Get content by ID
export const getContentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Try to get from cache first
  const cachedData = await redisClient.get(`content:${id}`);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const content = await Content.findById(id)
    .populate('contributor', 'name email avatar stats')
    .lean();

  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  // Increment views
  await Content.findByIdAndUpdate(id, { $inc: { views: 1 } });

  // Cache for 1 minute
  await redisClient.set(`content:${id}`, JSON.stringify(content), 60);

  res.status(StatusCodes.OK).json({
    success: true,
    data: content
  });
});

// Create new content
export const createContent = asyncHandler(async (req: Request, res: Response) => {
  const { title, content, type, category, tags, mediaUrl, thumbnailUrl, duration } = req.body;
  const contributor = (req as any).user.id;

  const newContent = new Content({
    title,
    content,
    type,
    contributor,
    category,
    tags: tags || [],
    mediaUrl,
    thumbnailUrl,
    duration,
    status: 'pending'
  });

  await newContent.save();

  // Update user stats
  await User.findByIdAndUpdate(contributor, { 
    $inc: { 'stats.contentSubmitted': 1 } 
  });

  // Index in Elasticsearch
  try {
    await esIndexDocument('content', newContent._id.toString(), {
      title: newContent.title,
      content: newContent.content,
      type: newContent.type,
      category: newContent.category,
      tags: newContent.tags,
      status: newContent.status,
      publishedAt: newContent.publishedAt,
      createdAt: newContent.createdAt,
      contributor: {
        id: contributor,
        name: (req as any).user.name,
        email: (req as any).user.email
      }
    });
  } catch (error) {
    logger.error('Error indexing content in Elasticsearch:', error);
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    data: newContent
  });
});

// Update content
export const updateContent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content, tags, mediaUrl, thumbnailUrl, duration } = req.body;
  const userId = (req as any).user.id;

  const existingContent = await Content.findById(id);
  
  if (!existingContent) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  // Check if user owns the content or is admin/moderator
  if (existingContent.contributor.toString() !== userId && 
      !['admin', 'moderator'].includes((req as any).user.role)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'You can only update your own content'
    });
  }

  const updatedContent = await Content.findByIdAndUpdate(
    id,
    {
      title: title || existingContent.title,
      content: content || existingContent.content,
      tags: tags || existingContent.tags,
      mediaUrl: mediaUrl || existingContent.mediaUrl,
      thumbnailUrl: thumbnailUrl || existingContent.thumbnailUrl,
      duration: duration || existingContent.duration,
      status: 'pending' // Reset to pending when updated
    },
    { new: true }
  ).populate('contributor', 'name email avatar');

  // Clear cache
  await redisClient.del(`content:${id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    data: updatedContent
  });
});

// Delete content
export const deleteContent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;

  const content = await Content.findById(id);
  
  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  // Check if user owns the content or is admin
  if (content.contributor.toString() !== userId && 
      (req as any).user.role !== 'admin') {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'You can only delete your own content'
    });
  }

  await Content.findByIdAndDelete(id);

  // Update user stats
  await User.findByIdAndUpdate(content.contributor, { 
    $inc: { 'stats.contentSubmitted': -1 } 
  });

  // Remove from Elasticsearch
  try {
    await esDeleteDocument('content', id);
  } catch (error) {
    logger.error('Error removing content from Elasticsearch:', error);
  }

  // Clear cache
  await redisClient.del(`content:${id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Content deleted successfully'
  });
});

// Approve content (admin/moderator only)
export const approveContent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const content = await Content.findById(id);
  
  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  const updatedContent = await Content.findByIdAndUpdate(
    id,
    { 
      status: 'approved',
      publishedAt: new Date()
    },
    { new: true }
  ).populate('contributor', 'name email avatar');

  // Update user stats
  await User.findByIdAndUpdate(content.contributor, { 
    $inc: { 'stats.contentApproved': 1 } 
  });

  // Clear cache
  await redisClient.del(`content:${id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    data: updatedContent
  });
});

// Reject content (admin/moderator only)
export const rejectContent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const content = await Content.findById(id);
  
  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  const updatedContent = await Content.findByIdAndUpdate(
    id,
    { 
      status: 'rejected',
      rejectionReason: reason
    },
    { new: true }
  ).populate('contributor', 'name email avatar');

  // Clear cache
  await redisClient.del(`content:${id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    data: updatedContent
  });
});

// Get content by category
export const getContentByCategory = asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const content = await Content.find({ 
    category, 
    status: 'approved' 
  })
    .populate('contributor', 'name email avatar')
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Content.countDocuments({ 
    category, 
    status: 'approved' 
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      content,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    }
  });
});

// Get content by type
export const getContentByType = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const content = await Content.find({ 
    type, 
    status: 'approved' 
  })
    .populate('contributor', 'name email avatar')
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Content.countDocuments({ 
    type, 
    status: 'approved' 
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      content,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    }
  });
});

// Get featured content
export const getFeaturedContent = asyncHandler(async (req: Request, res: Response) => {
  const { limit = 10 } = req.query;

  // Try to get from cache first
  const cacheKey = `featured_content:${limit}`;
  const cachedData = await redisClient.get(cacheKey);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const content = await Content.find({ 
    featured: true, 
    status: 'approved' 
  })
    .populate('contributor', 'name email avatar')
    .sort({ publishedAt: -1 })
    .limit(Number(limit))
    .lean();

  // Cache for 1 hour
  await redisClient.set(cacheKey, JSON.stringify(content), 3600);

  res.status(StatusCodes.OK).json({
    success: true,
    data: content
  });
});

// Search content
export const searchContent = asyncHandler(async (req: Request, res: Response) => {
  const { q, category, type, page = 1, limit = 20 } = req.query;

  if (!q) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Search query is required'
    });
  }

  const filters: any = {};
  if (category) filters.category = category;
  if (type) filters.type = type;

  const skip = (Number(page) - 1) * Number(limit);

  try {
    const results = await esSearchContent(
      q as string,
      filters,
      Number(limit),
      skip
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        content: results.hits,
        pagination: {
          current: Number(page),
          pages: Math.ceil(results.total / Number(limit)),
          total: results.total,
          limit: Number(limit)
        },
        took: results.took
      }
    });
  } catch (error) {
    logger.error('Error searching content:', error);
    
    // Fallback to database search
    const content = await Content.find({
      $text: { $search: q as string },
      status: 'approved',
      ...filters
    })
      .populate('contributor', 'name email avatar')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Content.countDocuments({
      $text: { $search: q as string },
      status: 'approved',
      ...filters
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        content,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / Number(limit)),
          total,
          limit: Number(limit)
        }
      }
    });
  }
});

// Like content
export const likeContent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;

  const content = await Content.findById(id);
  
  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  // Check if user already liked
  const existingLike = await Content.findOne({
    _id: id,
    'likes.user': userId
  });

  if (existingLike) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'You have already liked this content'
    });
  }

  await Content.findByIdAndUpdate(id, { 
    $inc: { likes: 1 },
    $push: { 'likes.user': userId }
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Content liked successfully'
  });
});

// Dislike content
export const dislikeContent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const content = await Content.findById(id);
  
  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  await Content.findByIdAndUpdate(id, { 
    $inc: { dislikes: 1 }
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Content disliked successfully'
  });
});

// Add comment to content
export const addComment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content: commentContent } = req.body;
  const userId = (req as any).user.id;

  const content = await Content.findById(id);
  
  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  const comment = {
    user: userId,
    content: commentContent,
    createdAt: new Date(),
    likes: 0
  };

  await Content.findByIdAndUpdate(id, {
    $push: { comments: comment }
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: comment
  });
});

// Get comments for content
export const getComments = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const content = await Content.findById(id)
    .populate('comments.user', 'name avatar')
    .select('comments')
    .lean();

  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  const comments = content.comments
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(skip, skip + Number(limit));

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      comments,
      pagination: {
        current: Number(page),
        pages: Math.ceil(content.comments.length / Number(limit)),
        total: content.comments.length,
        limit: Number(limit)
      }
    }
  });
});

// Get content statistics
export const getContentStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const content = await Content.findById(id).select('views likes dislikes comments');
  
  if (!content) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Content not found'
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      views: content.views,
      likes: content.likes,
      dislikes: content.dislikes,
      comments: content.comments.length,
      engagementScore: content.likes + (content.views * 0.1) + (content.comments.length * 2)
    }
  });
});
