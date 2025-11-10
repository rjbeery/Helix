import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Sanitize filename to prevent path traversal attacks
 */
function sanitizeFilename(filename: string): string {
  // Remove any path separators and special characters
  return filename
    .replace(/[\/\\]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100); // Limit length
}

/**
 * Generate unique filename, checking for collisions and renaming if needed
 */
function generateUniqueFilename(uploadDir: string, originalName: string, userId?: string): string {
  // Sanitize the original filename
  const sanitized = sanitizeFilename(originalName);
  const ext = path.extname(sanitized).toLowerCase();
  const baseName = path.basename(sanitized, ext);
  
  // Include user ID for uniqueness if available
  const userPrefix = userId ? `user${userId.substring(0, 8)}-` : '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  
  let filename = `${userPrefix}${timestamp}-${random}${ext}`;
  let fullPath = path.join(uploadDir, filename);
  let counter = 1;
  
  // Check for collision and rename if needed
  while (fs.existsSync(fullPath)) {
    filename = `${userPrefix}${timestamp}-${random}-${counter}${ext}`;
    fullPath = path.join(uploadDir, filename);
    counter++;
  }
  
  return filename;
}

// Local storage for development - save to web app's public/images directory
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), '..', 'web', 'public', 'images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Extract user ID from authenticated request if available
    const userId = (req as any).user?.sub;
    const uploadDir = path.join(process.cwd(), '..', 'web', 'public', 'images');
    const uniqueName = generateUniqueFilename(uploadDir, file.originalname, userId);
    cb(null, uniqueName);
  }
});

// Memory storage for AWS (S3 upload)
const memoryStorage = multer.memoryStorage();

// Determine storage based on environment
const isProduction = process.env.NODE_ENV === 'production';
const storage = isProduction ? memoryStorage : localStorage;

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// S3 client for production
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
  return s3Client;
}

export async function uploadToS3(file: Express.Multer.File): Promise<string> {
  const s3 = getS3Client();
  const bucketName = process.env.S3_AVATAR_BUCKET;
  
  if (!bucketName) {
    throw new Error('S3_AVATAR_BUCKET environment variable not set');
  }

  const key = `avatars/${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
  
  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  // Return the CloudFront URL
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN || 'helixai.live';
  return `https://${cloudfrontDomain}/${key}`;
}

export function getLocalAvatarUrl(filename: string): string {
  // In production, this won't be used
  // In development, return path relative to web app's public directory
  return `/images/${filename}`;
}

/**
 * Validate that uploaded file is actually a valid image
 * Checks magic bytes (file signature) to prevent malicious files disguised as images
 */
export function validateImageFile(filePath: string): boolean {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 12) return false;

    // Check magic bytes for common image formats
    const magicNumbers = {
      jpeg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47],
      gif: [0x47, 0x49, 0x46],
      webp: [0x52, 0x49, 0x46, 0x46] // RIFF
    };

    // JPEG
    if (buffer[0] === magicNumbers.jpeg[0] && 
        buffer[1] === magicNumbers.jpeg[1] && 
        buffer[2] === magicNumbers.jpeg[2]) {
      return true;
    }

    // PNG
    if (buffer[0] === magicNumbers.png[0] && 
        buffer[1] === magicNumbers.png[1] && 
        buffer[2] === magicNumbers.png[2] && 
        buffer[3] === magicNumbers.png[3]) {
      return true;
    }

    // GIF
    if (buffer[0] === magicNumbers.gif[0] && 
        buffer[1] === magicNumbers.gif[1] && 
        buffer[2] === magicNumbers.gif[2]) {
      return true;
    }

    // WebP (check RIFF header + WEBP signature)
    if (buffer[0] === magicNumbers.webp[0] && 
        buffer[1] === magicNumbers.webp[1] && 
        buffer[2] === magicNumbers.webp[2] && 
        buffer[3] === magicNumbers.webp[3] &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && 
        buffer[10] === 0x42 && buffer[11] === 0x50) {
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
}
