import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Local storage for development
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
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
    ACL: 'public-read'
  }));

  // Return the public URL
  return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

export function getLocalAvatarUrl(filename: string): string {
  // In production, this won't be used
  // In development, return full URL to API server
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  return `${apiUrl}/uploads/avatars/${filename}`;
}
