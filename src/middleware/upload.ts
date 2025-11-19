import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { logger } from '../utils/logger';

// Use memory storage for ImageKit uploads (files are uploaded directly to ImageKit)
// This avoids saving files locally first
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', // Video
    'mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', // Audio
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', // Images
    'pdf', 'doc', 'docx', 'txt', 'rtf' // Documents
  ];
  
  const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type .${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Configure multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB default
    files: 5 // Maximum 5 files per request
  }
});

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name'
      });
    }
  }
  
  if (error.message.includes('File type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  logger.error('Upload error:', error);
  next(error);
};

// Helper function to delete file
export const deleteFile = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (error) => {
      if (error) {
        logger.error('Error deleting file:', error);
        reject(error);
      } else {
        logger.info(`File deleted: ${filePath}`);
        resolve();
      }
    });
  });
};

// Helper function to get file URL
export const getFileUrl = (filePath: string): string => {
  const relativePath = path.relative(process.cwd(), filePath);
  return `${process.env.BACKEND_URL || 'http://localhost:5000'}/${relativePath.replace(/\\/g, '/')}`;
};

// Helper function to validate file type
export const validateFileType = (file: Express.Multer.File, allowedTypes: string[]): boolean => {
  const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
  return allowedTypes.includes(fileExtension);
};

// Helper function to get file size in MB
export const getFileSizeInMB = (file: Express.Multer.File): number => {
  return file.size / (1024 * 1024);
};

// Helper function to generate thumbnail for video
export const generateVideoThumbnail = async (videoPath: string, _thumbnailPath: string): Promise<void> => {
  // This would typically use ffmpeg to generate thumbnails
  // For now, we'll just copy the first frame or use a placeholder
  logger.info(`Generating thumbnail for video: ${videoPath}`);
  // Implementation would go here
};

// Helper function to compress image
export const compressImage = async (imagePath: string, outputPath: string, _quality: number = 80): Promise<void> => {
  // This would typically use sharp or similar library to compress images
  logger.info(`Compressing image: ${imagePath}`);
  // Implementation would go here
};
