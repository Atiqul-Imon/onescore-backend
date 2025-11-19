import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  
  next();
};

// User validation rules
export const validateUserRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  handleValidationErrors
];

export const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

export const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  handleValidationErrors
];

export const validatePasswordUpdate = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  handleValidationErrors
];

// Content validation rules
export const validateContentCreation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters long'),
  body('type')
    .isIn(['video', 'audio', 'article'])
    .withMessage('Type must be video, audio, or article'),
  body('category')
    .isIn(['cricket', 'football', 'general'])
    .withMessage('Category must be cricket, football, or general'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Each tag must be between 1 and 20 characters'),
  handleValidationErrors
];

export const validateContentUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters long'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Each tag must be between 1 and 20 characters'),
  handleValidationErrors
];

// Match validation rules
export const validateMatchId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid match ID format'),
  handleValidationErrors
];

export const validateCricketMatch = [
  body('matchId')
    .notEmpty()
    .withMessage('Match ID is required'),
  body('series')
    .notEmpty()
    .withMessage('Series is required'),
  body('teams.home.id')
    .notEmpty()
    .withMessage('Home team ID is required'),
  body('teams.home.name')
    .notEmpty()
    .withMessage('Home team name is required'),
  body('teams.away.id')
    .notEmpty()
    .withMessage('Away team ID is required'),
  body('teams.away.name')
    .notEmpty()
    .withMessage('Away team name is required'),
  body('venue.name')
    .notEmpty()
    .withMessage('Venue name is required'),
  body('status')
    .isIn(['live', 'completed', 'upcoming', 'cancelled'])
    .withMessage('Status must be live, completed, upcoming, or cancelled'),
  body('format')
    .isIn(['test', 'odi', 't20i', 't20', 'first-class', 'list-a'])
    .withMessage('Format must be test, odi, t20i, t20, first-class, or list-a'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  handleValidationErrors
];

export const validateFootballMatch = [
  body('matchId')
    .notEmpty()
    .withMessage('Match ID is required'),
  body('league')
    .notEmpty()
    .withMessage('League is required'),
  body('season')
    .notEmpty()
    .withMessage('Season is required'),
  body('teams.home.id')
    .notEmpty()
    .withMessage('Home team ID is required'),
  body('teams.home.name')
    .notEmpty()
    .withMessage('Home team name is required'),
  body('teams.away.id')
    .notEmpty()
    .withMessage('Away team ID is required'),
  body('teams.away.name')
    .notEmpty()
    .withMessage('Away team name is required'),
  body('venue.name')
    .notEmpty()
    .withMessage('Venue name is required'),
  body('status')
    .isIn(['live', 'finished', 'scheduled', 'postponed', 'cancelled'])
    .withMessage('Status must be live, finished, scheduled, postponed, or cancelled'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  handleValidationErrors
];

// Query validation rules
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

export const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  query('category')
    .optional()
    .isIn(['cricket', 'football', 'general'])
    .withMessage('Category must be cricket, football, or general'),
  query('type')
    .optional()
    .isIn(['video', 'audio', 'article'])
    .withMessage('Type must be video, audio, or article'),
  handleValidationErrors
];

export const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  handleValidationErrors
];
