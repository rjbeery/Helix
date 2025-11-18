import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const db = new PrismaClient();
const s3 = new S3Client({ region: 'us-east-1' });
const bucketName = 'helixai-site-helixai-live';

async function uploadAvatarsToS3() {
  try {
    console.log('Fetching personas with local avatar URLs...');
    
    const personas = await db.persona.findMany({
      where: {
        avatarUrl: {
          not: null,
        },
      },
    });

    console.log(`Found ${personas.length} personas with avatars`);

    for (const persona of personas) {
      if (!persona.avatarUrl) continue;

      // Check if avatar is a local path
      if (
        persona.avatarUrl.startsWith('/images/') ||
        persona.avatarUrl.startsWith('http://localhost')
      ) {
        console.log(`\nProcessing ${persona.label}...`);
        console.log(`  Current URL: ${persona.avatarUrl}`);

        // Extract filename from URL
        let filename: string;
        if (persona.avatarUrl.startsWith('/images/')) {
          filename = persona.avatarUrl.replace('/images/', '');
        } else {
          const match = persona.avatarUrl.match(/\/images\/(.+)$/);
          filename = match ? match[1] : path.basename(persona.avatarUrl);
        }

        // Path to local file
        const localPath = path.join(
          process.cwd(),
          '..',
          'web',
          'public',
          'images',
          filename
        );

        // Check if file exists
        if (!fs.existsSync(localPath)) {
          console.log(`  ⚠️  File not found locally: ${localPath}`);
          console.log(`  Setting avatarUrl to null`);
          await db.persona.update({
            where: { id: persona.id },
            data: { avatarUrl: null },
          });
          continue;
        }

        // Read file
        const fileBuffer = fs.readFileSync(localPath);
        const ext = path.extname(filename).toLowerCase();
        const contentType = 
          ext === '.png' ? 'image/png' :
          ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
          ext === '.gif' ? 'image/gif' :
          ext === '.webp' ? 'image/webp' :
          'application/octet-stream';

        // Upload to S3
        const s3Key = `avatars/${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
        
        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: contentType,
          })
        );

        const s3Url = `https://helixai.live/${s3Key}`;
        console.log(`  ✅ Uploaded to S3: ${s3Url}`);

        // Update persona with S3 URL
        await db.persona.update({
          where: { id: persona.id },
          data: { avatarUrl: s3Url },
        });

        console.log(`  ✅ Updated persona ${persona.label}`);
      } else if (persona.avatarUrl.startsWith('https://')) {
        console.log(`\n✓ ${persona.label} already has S3/remote URL: ${persona.avatarUrl}`);
      } else {
        console.log(`\n⚠️  ${persona.label} has unknown URL format: ${persona.avatarUrl}`);
      }
    }

    console.log('\n✅ Avatar upload complete!');
  } catch (error) {
    console.error('Failed to upload avatars:', error);
  } finally {
    await db.$disconnect();
  }
}

uploadAvatarsToS3();
