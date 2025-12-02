import sharp from 'sharp';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'packages');

interface ImageVariant {
  width: number;
  height?: number;
  suffix: string;
  quality: number;
}

const IMAGE_VARIANTS: ImageVariant[] = [
  { width: 1600, suffix: 'hero', quality: 85 },
  { width: 800, suffix: 'gallery', quality: 80 },
  { width: 400, suffix: 'card', quality: 75 },
  { width: 200, suffix: 'thumb', quality: 70 },
];

export interface ProcessedImage {
  original: string;
  hero: string;
  gallery: string;
  card: string;
  thumb: string;
  width: number;
  height: number;
  size: number;
}

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function generateImageHash(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
}

export async function downloadAndProcessImage(
  imageUrl: string,
  packageSlug: string
): Promise<ProcessedImage | null> {
  try {
    await ensureUploadDir();
    
    const packageDir = path.join(UPLOAD_DIR, packageSlug);
    await fs.mkdir(packageDir, { recursive: true });
    
    console.log(`Downloading image: ${imageUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Failed to download image: ${response.status} - ${imageUrl}`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    if (buffer.length < 1000) {
      console.error(`Image too small, likely invalid: ${imageUrl}`);
      return null;
    }
    
    const imageHash = generateImageHash(imageUrl);
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      console.error(`Cannot read image metadata: ${imageUrl}`);
      return null;
    }
    
    const results: Record<string, string> = {};
    
    for (const variant of IMAGE_VARIANTS) {
      const filename = `${imageHash}-${variant.suffix}.webp`;
      const filepath = path.join(packageDir, filename);
      
      let resizeOptions: sharp.ResizeOptions = {
        width: variant.width,
        fit: 'cover',
        withoutEnlargement: true
      };
      
      if (variant.suffix === 'thumb') {
        resizeOptions.height = 200;
      }
      
      await sharp(buffer)
        .resize(resizeOptions)
        .webp({ quality: variant.quality })
        .toFile(filepath);
      
      results[variant.suffix] = `/uploads/packages/${packageSlug}/${filename}`;
    }
    
    const originalFilename = `${imageHash}-original.webp`;
    const originalPath = path.join(packageDir, originalFilename);
    
    const processedOriginal = await sharp(buffer)
      .webp({ quality: 90 })
      .toFile(originalPath);
    
    results.original = `/uploads/packages/${packageSlug}/${originalFilename}`;
    
    console.log(`Processed image: ${imageUrl} -> ${Object.keys(results).length} variants`);
    
    return {
      original: results.original,
      hero: results.hero,
      gallery: results.gallery,
      card: results.card,
      thumb: results.thumb,
      width: metadata.width,
      height: metadata.height,
      size: processedOriginal.size
    };
  } catch (error) {
    console.error(`Error processing image ${imageUrl}:`, error);
    return null;
  }
}

export async function processMultipleImages(
  imageUrls: string[],
  packageSlug: string,
  maxImages: number = 10
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];
  const urlsToProcess = imageUrls.slice(0, maxImages);
  
  for (const url of urlsToProcess) {
    const processed = await downloadAndProcessImage(url, packageSlug);
    if (processed) {
      results.push(processed);
    }
  }
  
  return results;
}

export async function cleanupPackageImages(packageSlug: string): Promise<void> {
  try {
    const packageDir = path.join(UPLOAD_DIR, packageSlug);
    await fs.rm(packageDir, { recursive: true, force: true });
    console.log(`Cleaned up images for package: ${packageSlug}`);
  } catch (error) {
    console.error(`Error cleaning up images for ${packageSlug}:`, error);
  }
}
