import { body, param, query } from 'express-validator';

// Thread creation validation
export const validateThreadCreation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 300 })
    .withMessage('Title must be between 5 and 300 characters'),
  
  body('content')
    .trim()
    .isLength({ min: 10, max: 40000 })
    .withMessage('Content must be between 10 and 40000 characters'),
  
  body('category')
    .isIn(['cricket', 'football', 'general', 'news', 'discussion'])
    .withMessage('Category must be one of: cricket, football, general, news, discussion'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  
  body('flair')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Flair must be between 1 and 100 characters'),
  
  body('media.type')
    .optional()
    .isIn(['image', 'video', 'link'])
    .withMessage('Media type must be one of: image, video, link'),
  
  body('media.url')
    .optional()
    .isURL()
    .withMessage('Media URL must be a valid URL'),
  
  body('poll.question')
    .optional()
    .isLength({ min: 5, max: 300 })
    .withMessage('Poll question must be between 5 and 300 characters'),
  
  body('poll.options')
    .optional()
    .isArray({ min: 2, max: 10 })
    .withMessage('Poll must have between 2 and 10 options'),
  
  body('poll.options.*.text')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each poll option must be between 1 and 200 characters'),
  
  body('poll.expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Poll expiration must be a valid date'),
  
  body('poll.allowMultiple')
    .optional()
    .isBoolean()
    .withMessage('Poll allowMultiple must be a boolean')
];

// Thread update validation
export const validateThreadUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 300 })
    .withMessage('Title must be between 5 and 300 characters'),
  
  body('content')
    .optional()
    .trim()
    .isLength({ min: 10, max: 40000 })
    .withMessage('Content must be between 10 and 40000 characters'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  
  body('flair')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Flair must be between 1 and 100 characters'),
  
  body('editReason')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Edit reason must be between 1 and 200 characters')
];

// Comment creation validation
export const validateCommentCreation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  
  body('threadId')
    .isMongoId()
    .withMessage('Thread ID must be a valid MongoDB ObjectId'),
  
  body('parentCommentId')
    .optional()
    .isMongoId()
    .withMessage('Parent comment ID must be a valid MongoDB ObjectId')
];

// Comment update validation
export const validateCommentUpdate = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  
  body('editReason')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Edit reason must be between 1 and 200 characters')
];

// Vote validation
export const validateVote = [
  body('voteType')
    .isIn(['upvote', 'downvote'])
    .withMessage('Vote type must be either upvote or downvote')
];

// Report validation
export const validateReport = [
  body('reason')
    .isIn(['spam', 'harassment', 'hate_speech', 'misinformation', 'violence', 'other'])
    .withMessage('Report reason must be one of: spam, harassment, hate_speech, misinformation, violence, other')
];

// Thread ID validation
export const validateThreadId = [
  param('id')
    .isMongoId()
    .withMessage('Thread ID must be a valid MongoDB ObjectId')
];

// Comment ID validation
export const validateCommentId = [
  param('id')
    .isMongoId()
    .withMessage('Comment ID must be a valid MongoDB ObjectId')
];

// Thread search validation
export const validateThreadSearch = [
  query('category')
    .optional()
    .isIn(['cricket', 'football', 'general', 'news', 'discussion'])
    .withMessage('Category must be one of: cricket, football, general, news, discussion'),
  
  query('sort')
    .optional()
    .isIn(['hot', 'new', 'top', 'controversial'])
    .withMessage('Sort must be one of: hot, new, top, controversial'),
  
  query('time')
    .optional()
    .isIn(['all', 'day', 'week', 'month', 'year'])
    .withMessage('Time filter must be one of: all, day, week, month, year'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return value.split(',').every(tag => tag.trim().length > 0 && tag.trim().length <= 50);
      }
      return Array.isArray(value) && value.every(tag => tag.length > 0 && tag.length <= 50);
    })
    .withMessage('Tags must be valid strings between 1 and 50 characters')
];

// Comment search validation
export const validateCommentSearch = [
  query('sort')
    .optional()
    .isIn(['top', 'new', 'old', 'controversial'])
    .withMessage('Sort must be one of: top, new, old, controversial'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];
