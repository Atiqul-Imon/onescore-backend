import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { uploadToImageKit, deleteFromImageKit, listFiles } from '../utils/imagekit';
import { logger } from '../utils/logger';
import path from 'path';

function getFolderForType(type: string): string {
  if (type === 'image') return '/sports-platform/images';
  if (type === 'video') return '/sports-platform/videos';
  if (type === 'audio') return '/sports-platform/audio';
  return '/sports-platform/documents';
}

export async function listMedia(req: Request, res: Response) {
  try {
    const type = String(req.query.type || 'image');
    const folder = getFolderForType(type);
    
    const result = await listFiles({
      folder: folder,
      limit: 100,
    });

    const files = (Array.isArray(result) ? result : []).map((file: any) => ({
      name: file.name,
      path: file.url,
      fileId: file.fileId,
      type: type,
      size: file.size,
      createdAt: file.createdAt,
    }));

    return res.status(StatusCodes.OK).json({ success: true, data: files });
  } catch (error) {
    logger.error('Error listing media:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list media files',
    });
  }
}

export async function deleteMedia(req: Request, res: Response) {
  try {
    const fileId = String(req.query.fileId || req.query.path || '');
    
    if (!fileId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'File ID is required',
      });
    }

    // If it's a URL, try to extract fileId from it
    // Otherwise assume it's already a fileId
    const actualFileId = fileId;
    if (fileId.includes('ik.imagekit.io')) {
      // Extract fileId from URL if possible, or use the path
      // const urlParts = fileId.split('/');
      // const fileName = urlParts[urlParts.length - 1];
      // For now, we'll need the fileId - this is a limitation
      // In production, you might want to store fileId in database
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Please provide fileId instead of URL. Store fileId when uploading.',
      });
    }

    await deleteFromImageKit(actualFileId);
    return res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    logger.error('Error deleting media:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete media file',
    });
  }
}

export async function uploadMedia(req: Request, res: Response) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Determine file type and folder
    let fileType = 'document';
    if (file.mimetype.startsWith('image/')) fileType = 'image';
    else if (file.mimetype.startsWith('video/')) fileType = 'video';
    else if (file.mimetype.startsWith('audio/')) fileType = 'audio';

    const folder = getFolderForType(fileType);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;

    // Upload to ImageKit
    const result = await uploadToImageKit(file.buffer, fileName, {
      folder: folder,
      fileName: fileName,
      useUniqueFileName: true,
      tags: [fileType],
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        name: result.name,
        path: result.url,
        fileId: result.fileId,
        type: fileType,
      },
    });
  } catch (error) {
    logger.error('Error uploading media:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to upload file',
    });
  }
}


