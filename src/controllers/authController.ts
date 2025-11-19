import { Request, Response } from 'express';
import { User } from '../models/User';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middleware/errorHandler';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Register new user
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Create verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');

  // Create user
  const user = new User({
    name,
    email,
    password,
    verificationToken,
    isVerified: false
  });

  await user.save();

  // Generate tokens
  const token = generateToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  // Send verification email
  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (error) {
    logger.error('Error sending verification email:', error);
    // Don't fail registration if email fails
  }

  // Remove password from response
  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    isVerified: user.isVerified,
    preferences: user.preferences,
    stats: user.stats,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'User registered successfully. Please check your email for verification.',
    data: {
      user: userResponse,
      token,
      refreshToken
    }
  });
});

// Login user
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Update last login
  await user.updateLastLogin();

  // Generate tokens
  const token = generateToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  // Remove password from response
  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    isVerified: user.isVerified,
    preferences: user.preferences,
    stats: user.stats,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Login successful',
    data: {
      user: userResponse,
      token,
      refreshToken
    }
  });
});

// Logout user
export const logout = asyncHandler(async (req: Request, res: Response) => {
  // In a more sophisticated setup, you might want to blacklist the token
  // For now, we'll just return a success message
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Logout successful'
  });
});

// Refresh token
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id.toString());
    const newRefreshToken = generateRefreshToken(user._id.toString());

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// Forgot password
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = resetTokenExpires;
  await user.save();

  // Send reset email
  try {
    await sendPasswordResetEmail(user.email, resetToken);
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error sending password reset email'
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Password reset email sent'
  });
});

// Reset password
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Password reset successful'
  });
});

// Verify email
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  const user = await User.findOne({ verificationToken: token });
  if (!user) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid verification token'
    });
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Email verified successfully'
  });
});

// Resend verification
export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  if (user.isVerified) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  user.verificationToken = verificationToken;
  await user.save();

  // Send verification email
  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (error) {
    logger.error('Error sending verification email:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error sending verification email'
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Verification email sent'
  });
});

// Change password
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = (req as any).user.id;

  const user = await User.findById(userId).select('+password');
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  user.password = newPassword;
  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Get user profile
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: user
  });
});

// Update user profile
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, avatar, preferences } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  if (name) user.name = name;
  if (avatar) user.avatar = avatar;
  if (preferences) user.preferences = { ...user.preferences, ...preferences };

  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    data: user
  });
});

// Delete user account
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  await User.findByIdAndDelete(userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Account deleted successfully'
  });
});

// Helper function to send verification email
const sendVerificationEmail = async (email: string, token: string) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Verify Your Email - Sports Platform',
    html: `
      <h2>Welcome to Sports Platform!</h2>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>If you didn't create an account, please ignore this email.</p>
    `,
  });
};

// Helper function to send password reset email
const sendPasswordResetEmail = async (email: string, token: string) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Reset Your Password - Sports Platform',
    html: `
      <h2>Password Reset Request</h2>
      <p>Please click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 10 minutes.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    `,
  });
};
