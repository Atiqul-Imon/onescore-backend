import ImageKit from 'imagekit';
import { logger } from './logger';

const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY || 'public_yKwzEfp3xxqADMT0hV06nNp/tpg=';
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY || 'private_uNtzSqPaqX9cCJ1r6wnLGMmDdeA=';
const IMAGEKIT_URL_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/yhlwdvbf5';

// Initialize ImageKit
export const imagekit = new ImageKit({
  publicKey: IMAGEKIT_PUBLIC_KEY,
  privateKey: IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: IMAGEKIT_URL_ENDPOINT,
});

export interface UploadOptions {
  folder?: string;
  fileName?: string;
  useUniqueFileName?: boolean;
  tags?: string[];
  isPrivateFile?: boolean;
}

/**
 * Upload file to ImageKit
 */
export const uploadToImageKit = async (
  file: Buffer | string,
  fileName: string,
  options: UploadOptions = {}
): Promise<{ url: string; fileId: string; name: string }> => {
  try {
    const uploadOptions: any = {
      file: file,
      fileName: options.fileName || fileName,
      useUniqueFileName: options.useUniqueFileName !== false, // Default to true
      folder: options.folder || '/sports-platform',
      tags: options.tags || [],
      isPrivateFile: options.isPrivateFile || false,
    };

    const result = await imagekit.upload(uploadOptions);
    
    logger.info(`File uploaded to ImageKit: ${result.name} (${result.fileId})`);
    
    return {
      url: result.url,
      fileId: result.fileId,
      name: result.name,
    };
  } catch (error) {
    logger.error('ImageKit upload error:', error);
    throw error;
  }
};

/**
 * Delete file from ImageKit
 */
export const deleteFromImageKit = async (fileId: string): Promise<boolean> => {
  try {
    await imagekit.deleteFile(fileId);
    logger.info(`File deleted from ImageKit: ${fileId}`);
    return true;
  } catch (error) {
    logger.error('ImageKit delete error:', error);
    throw error;
  }
};

/**
 * Get file details from ImageKit
 */
export const getFileDetails = async (fileId: string): Promise<any> => {
  try {
    const details = await imagekit.getFileDetails(fileId);
    return details;
  } catch (error) {
    logger.error('ImageKit get file details error:', error);
    throw error;
  }
};

/**
 * List files from ImageKit
 */
export const listFiles = async (options: {
  folder?: string;
  tags?: string[];
  limit?: number;
  skip?: number;
} = {}): Promise<any[]> => {
  try {
    const result = await imagekit.listFiles({
      path: options.folder || '/sports-platform',
      tags: options.tags,
      limit: options.limit || 100,
      skip: options.skip || 0,
    });
    // ImageKit returns an array directly
    return Array.isArray(result) ? result : [];
  } catch (error) {
    logger.error('ImageKit list files error:', error);
    throw error;
  }
};

/**
 * Generate ImageKit URL with transformations
 */
export const getImageKitUrl = (
  path: string,
  transformations?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
    [key: string]: any;
  }
): string => {
  const url = imagekit.url({
    path: path,
    transformation: transformations ? [transformations] : [],
  });
  return url;
};

