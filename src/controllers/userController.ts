import { Request, Response } from 'express';
import { User } from '../models/User';
import { Content } from '../models/Content';
import { redisClient } from '../utils/redis';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';

// Get all users (admin only)
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: new RegExp(search as string, 'i') },
      { email: new RegExp(search as string, 'i') }
    ];
  }

  const users = await User.find(filter)
    .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await User.countDocuments(filter);

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      users,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    }
  });
});

// Get user by ID
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Try to get from cache first
  const cachedData = await redisClient.get(`user:${id}`);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const user = await User.findById(id)
    .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires')
    .lean();

  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  // Cache for 5 minutes
  await redisClient.set(`user:${id}`, JSON.stringify(user), 300);

  res.status(StatusCodes.OK).json({
    success: true,
    data: user
  });
});

// Update user
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, avatar, role, isVerified } = req.body;
  const currentUserId = (req as any).user.id;
  const currentUserRole = (req as any).user.role;

  // Check if user can update this profile
  if (id !== currentUserId && !['admin', 'moderator'].includes(currentUserRole)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'You can only update your own profile'
    });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  // Only admin can change role and verification status
  if (currentUserRole === 'admin') {
    if (role) user.role = role;
    if (isVerified !== undefined) user.isVerified = isVerified;
  }

  if (name) user.name = name;
  if (avatar) user.avatar = avatar;

  await user.save();

  // Clear cache
  await redisClient.del(`user:${id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    data: user
  });
});

// Delete user
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).user.id;
  const currentUserRole = (req as any).user.role;

  // Check if user can delete this profile
  if (id !== currentUserId && currentUserRole !== 'admin') {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: 'You can only delete your own profile'
    });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  // Delete user's content
  await Content.deleteMany({ contributor: id });

  // Delete user
  await User.findByIdAndDelete(id);

  // Clear cache
  await redisClient.del(`user:${id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User deleted successfully'
  });
});

// Get user statistics
export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id).select('stats');
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  // Get additional stats
  const contentCount = await Content.countDocuments({ contributor: id });
  const approvedContentCount = await Content.countDocuments({ 
    contributor: id, 
    status: 'approved' 
  });
  const totalViews = await Content.aggregate([
    { $match: { contributor: user._id } },
    { $group: { _id: null, totalViews: { $sum: '$views' } } }
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      ...user.stats,
      contentCount,
      approvedContentCount,
      totalViews: totalViews[0]?.totalViews || 0,
      approvalRate: contentCount > 0 ? (approvedContentCount / contentCount) * 100 : 0
    }
  });
});

// Get top contributors
export const getTopContributors = asyncHandler(async (req: Request, res: Response) => {
  const { limit = 10 } = req.query;

  // Try to get from cache first
  const cacheKey = `top_contributors:${limit}`;
  const cachedData = await redisClient.get(cacheKey);
  
  if (cachedData) {
    return res.status(StatusCodes.OK).json({
      success: true,
      data: JSON.parse(cachedData)
    });
  }

  const contributors = await User.aggregate([
    { $match: { role: 'user' } },
    {
      $lookup: {
        from: 'content',
        localField: '_id',
        foreignField: 'contributor',
        as: 'content'
      }
    },
    {
      $addFields: {
        totalContent: { $size: '$content' },
        approvedContent: {
          $size: {
            $filter: {
              input: '$content',
              cond: { $eq: ['$$this.status', 'approved'] }
            }
          }
        },
        totalViews: { $sum: '$content.views' },
        totalLikes: { $sum: '$content.likes' }
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        avatar: 1,
        totalContent: 1,
        approvedContent: 1,
        totalViews: 1,
        totalLikes: 1,
        engagementScore: {
          $add: [
            { $multiply: ['$totalViews', 0.1] },
            { $multiply: ['$totalLikes', 2] },
            { $multiply: ['$approvedContent', 5] }
          ]
        }
      }
    },
    { $sort: { engagementScore: -1 } },
    { $limit: Number(limit) }
  ]);

  // Cache for 1 hour
  await redisClient.set(cacheKey, JSON.stringify(contributors), 3600);

  res.status(StatusCodes.OK).json({
    success: true,
    data: contributors
  });
});

// Get user content
export const getUserContent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 20, status, type } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = { contributor: id };
  if (status) filter.status = status;
  if (type) filter.type = type;

  const content = await Content.find(filter)
    .populate('contributor', 'name email avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await Content.countDocuments(filter);

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

// Follow user
export const followUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).user.id;

  if (id === currentUserId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'You cannot follow yourself'
    });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if already following
  const currentUser = await User.findById(currentUserId);
  if (currentUser?.preferences.favoriteTeams?.includes(id)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'You are already following this user'
    });
  }

  // Add to following list
  await User.findByIdAndUpdate(currentUserId, {
    $addToSet: { 'preferences.favoriteTeams': id }
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User followed successfully'
  });
});

// Unfollow user
export const unfollowUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = (req as any).user.id;

  await User.findByIdAndUpdate(currentUserId, {
    $pull: { 'preferences.favoriteTeams': id }
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User unfollowed successfully'
  });
});

// Get followers
export const getFollowers = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const followers = await User.find({
    'preferences.favoriteTeams': id
  })
    .select('name email avatar stats')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = await User.countDocuments({
    'preferences.favoriteTeams': id
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      followers,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    }
  });
});

// Get following
export const getFollowing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const user = await User.findById(id).select('preferences.favoriteTeams');
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  const following = await User.find({
    _id: { $in: user.preferences.favoriteTeams }
  })
    .select('name email avatar stats')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const total = user.preferences.favoriteTeams.length;

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      following,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    }
  });
});

// Update user preferences
export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { favoriteTeams, favoriteSports, notifications } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  if (favoriteTeams) user.preferences.favoriteTeams = favoriteTeams;
  if (favoriteSports) user.preferences.favoriteSports = favoriteSports;
  if (notifications) user.preferences.notifications = { ...user.preferences.notifications, ...notifications };

  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    data: user.preferences
  });
});

// Get user notifications
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const _userId = (req as any).user.id;
  const { page = 1, limit = 20 } = req.query;
  const _skip = (Number(page) - 1) * Number(limit);

  // This would typically come from a notifications collection
  // For now, we'll return a mock response
  const notifications = [];

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      notifications,
      pagination: {
        current: Number(page),
        pages: 0,
        total: 0,
        limit: Number(limit)
      }
    }
  });
});

// Mark notification as read
export const markNotificationAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id: _id } = req.params;
  const _userId = (req as any).user.id;

  // This would typically update a notifications collection
  // For now, we'll return a success response
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Notification marked as read'
  });
});

// Delete notification
export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const { id: _id } = req.params;
  const _userId = (req as any).user.id;

  // This would typically delete from a notifications collection
  // For now, we'll return a success response
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Notification deleted'
  });
});
