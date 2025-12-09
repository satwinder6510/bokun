import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { db } from './db';
import { 
  mediaAssets, 
  mediaVariants, 
  mediaTags, 
  mediaUsage, 
  mediaBackups,
  mediaCleanupJobs,
  variantPresets,
  type MediaAsset,
  type MediaVariant,
  type InsertMediaAsset,
  type InsertMediaVariant,
  type InsertMediaTag,
  type VariantType
} from '@shared/schema';
import { eq, and, desc, sql, isNull, or, like, inArray, notInArray } from 'drizzle-orm';
import { ObjectStorageService } from './objectStorage';

const MEDIA_BASE_PATH = process.env.NODE_ENV === 'production' 
  ? 'public/media/prod' 
  : 'public/media/dev';

const BACKUP_PATH = 'backups/media';

// Object storage instance for cloud storage
const objectStorage = new ObjectStorageService();

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(MEDIA_BASE_PATH);
ensureDir(BACKUP_PATH);

function generateSlug(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${base.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}-${random}`;
}

async function computePerceptualHash(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .resize(8, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  
  const pixels = Array.from(resized);
  const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  
  let hash = '';
  for (const pixel of pixels) {
    hash += pixel >= avg ? '1' : '0';
  }
  
  return parseInt(hash, 2).toString(16).padStart(16, '0');
}

function computeChecksum(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

export interface ProcessedVariant {
  variantType: VariantType;
  filepath: string;
  width: number;
  height: number;
  sizeBytes: number;
  checksum: string;
}

export async function processImage(
  buffer: Buffer, 
  originalFilename: string,
  options?: {
    variants?: VariantType[];
    tags?: InsertMediaTag[];
    source?: 'upload' | 'unsplash' | 'pexels';
    externalId?: string;
    photographer?: string;
    license?: string;
    licenseUrl?: string;
  }
): Promise<{ asset: MediaAsset; variants: MediaVariant[] }> {
  const slug = generateSlug(originalFilename);
  
  const metadata = await sharp(buffer).metadata();
  const perceptualHash = await computePerceptualHash(buffer);
  
  const existingWithHash = await db.select().from(mediaAssets)
    .where(eq(mediaAssets.perceptualHash, perceptualHash))
    .limit(1);
  
  if (existingWithHash.length > 0) {
    console.log(`Duplicate image detected: ${perceptualHash}`);
  }
  
  const originalBuffer = await sharp(buffer)
    .webp({ quality: 95 })
    .toBuffer();
  
  // Check if object storage is available
  const useObjectStorage = await objectStorage.isAvailable();
  let storagePath: string;
  
  if (useObjectStorage) {
    // Upload original to Object Storage in 'media' folder
    storagePath = await objectStorage.uploadFromBuffer(originalBuffer, `${slug}-original.webp`, 'media');
    console.log(`[Media] Uploaded original to Object Storage: ${storagePath}`);
  } else {
    // Fallback to local filesystem
    const assetDir = path.join(MEDIA_BASE_PATH, slug);
    ensureDir(assetDir);
    storagePath = path.join(assetDir, `original.webp`);
    fs.writeFileSync(storagePath, originalBuffer);
    console.log(`[Media] Saved original to local: ${storagePath}`);
  }
  
  const [asset] = await db.insert(mediaAssets).values({
    slug,
    storagePath,
    perceptualHash,
    mimeType: 'image/webp',
    width: metadata.width || 0,
    height: metadata.height || 0,
    sizeBytes: originalBuffer.length,
    source: options?.source || 'upload',
    externalId: options?.externalId,
    photographer: options?.photographer,
    license: options?.license,
    licenseUrl: options?.licenseUrl,
  }).returning();
  
  const variantsToGenerate = options?.variants || ['hero', 'gallery', 'card', 'thumb'] as VariantType[];
  const generatedVariants: MediaVariant[] = [];
  
  for (const variantType of variantsToGenerate) {
    const preset = variantPresets[variantType];
    if (!preset) continue;
    
    try {
      let sharpInstance = sharp(buffer);
      
      if (preset.width > 0 || preset.height > 0) {
        const resizeOptions: sharp.ResizeOptions = {
          fit: preset.fit,
          position: 'attention',
          withoutEnlargement: true,
        };
        
        if (preset.width > 0) resizeOptions.width = preset.width;
        if (preset.height > 0) resizeOptions.height = preset.height;
        
        sharpInstance = sharpInstance.resize(resizeOptions);
      }
      
      const variantBuffer = await sharpInstance
        .webp({ quality: preset.quality })
        .toBuffer();
      
      const variantMeta = await sharp(variantBuffer).metadata();
      let variantPath: string;
      let storageType: string;
      
      if (useObjectStorage) {
        // Upload variant to Object Storage in 'media' folder
        variantPath = await objectStorage.uploadFromBuffer(variantBuffer, `${slug}-${variantType}.webp`, 'media');
        storageType = 'object_storage';
        console.log(`[Media] Uploaded ${variantType} to Object Storage: ${variantPath}`);
      } else {
        // Fallback to local filesystem
        const assetDir = path.join(MEDIA_BASE_PATH, slug);
        ensureDir(assetDir);
        variantPath = path.join(assetDir, `${variantType}.webp`);
        fs.writeFileSync(variantPath, variantBuffer);
        storageType = 'local';
      }
      
      const [variant] = await db.insert(mediaVariants).values({
        assetId: asset.id,
        variantType,
        width: variantMeta.width || 0,
        height: variantMeta.height || 0,
        quality: preset.quality,
        format: 'webp',
        filepath: variantPath,
        storageType,
        sizeBytes: variantBuffer.length,
        checksum: computeChecksum(variantBuffer),
        status: 'active',
      }).returning();
      
      generatedVariants.push(variant);
    } catch (error) {
      console.error(`Failed to generate ${variantType} variant:`, error);
    }
  }
  
  if (options?.tags) {
    for (const tag of options.tags) {
      await db.insert(mediaTags).values({
        ...tag,
        assetId: asset.id,
      });
    }
  }
  
  return { asset, variants: generatedVariants };
}

export async function getAssetById(id: number): Promise<MediaAsset | null> {
  const [asset] = await db.select().from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.isDeleted, false)));
  return asset || null;
}

export async function getAssetBySlug(slug: string): Promise<MediaAsset | null> {
  const [asset] = await db.select().from(mediaAssets)
    .where(and(eq(mediaAssets.slug, slug), eq(mediaAssets.isDeleted, false)));
  return asset || null;
}

export async function getAssetVariants(assetId: number): Promise<MediaVariant[]> {
  return await db.select().from(mediaVariants)
    .where(and(eq(mediaVariants.assetId, assetId), eq(mediaVariants.status, 'active')));
}

export async function getVariantFilePath(slug: string, variantType: string): Promise<string | null> {
  const asset = await getAssetBySlug(slug);
  if (!asset) return null;
  
  const [variant] = await db.select().from(mediaVariants)
    .where(and(
      eq(mediaVariants.assetId, asset.id),
      eq(mediaVariants.variantType, variantType as VariantType),
      eq(mediaVariants.status, 'active')
    ));
  
  if (!variant) return null;
  return variant.filepath;
}

export async function getVariantInfo(slug: string, variantType: string): Promise<{ filepath: string; storageType: string } | null> {
  const asset = await getAssetBySlug(slug);
  if (!asset) return null;
  
  const [variant] = await db.select().from(mediaVariants)
    .where(and(
      eq(mediaVariants.assetId, asset.id),
      eq(mediaVariants.variantType, variantType as VariantType),
      eq(mediaVariants.status, 'active')
    ));
  
  if (!variant) return null;
  return { 
    filepath: variant.filepath, 
    storageType: variant.storageType || 'local' 
  };
}

// Get buffer from storage (handles both local and object storage)
export async function getVariantBuffer(slug: string, variantType: string): Promise<Buffer | null> {
  const info = await getVariantInfo(slug, variantType);
  if (!info) return null;
  
  if (info.storageType === 'object_storage') {
    // Object Storage path format: /objects/media/filename.webp
    // Extract just the key part for download
    const key = info.filepath.replace('/objects/', '');
    try {
      return await objectStorage.downloadToBuffer(key);
    } catch (error) {
      console.error(`Failed to download from Object Storage: ${info.filepath}`, error);
      return null;
    }
  } else {
    // Local filesystem
    if (fs.existsSync(info.filepath)) {
      return fs.readFileSync(info.filepath);
    }
    return null;
  }
}

export async function searchAssets(options: {
  tagType?: string;
  tagValue?: string;
  source?: string;
  excludeUsedIn?: { entityType: string; entityId: string };
  limit?: number;
  offset?: number;
}): Promise<MediaAsset[]> {
  const conditions: any[] = [eq(mediaAssets.isDeleted, false)];
  
  if (options.tagType && options.tagValue) {
    const taggedAssetIds = await db.select({ assetId: mediaTags.assetId })
      .from(mediaTags)
      .where(and(
        eq(mediaTags.tagType, options.tagType),
        like(mediaTags.tagValue, `%${options.tagValue}%`)
      ));
    
    const ids = taggedAssetIds.map(t => t.assetId);
    if (ids.length > 0) {
      conditions.push(inArray(mediaAssets.id, ids));
    } else {
      return [];
    }
  }
  
  if (options.excludeUsedIn) {
    const usedAssetIds = await db.select({ assetId: mediaUsage.assetId })
      .from(mediaUsage)
      .where(and(
        eq(mediaUsage.entityType, options.excludeUsedIn.entityType),
        eq(mediaUsage.usageStatus, 'active')
      ));
    
    const usedIds = usedAssetIds.map(u => u.assetId);
    if (usedIds.length > 0) {
      conditions.push(sql`${mediaAssets.id} NOT IN (${sql.join(usedIds.map(id => sql`${id}`), sql`, `)})`);
    }
  }
  
  return await db.select().from(mediaAssets)
    .where(and(...conditions))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);
}

export async function assignAssetToEntity(
  assetId: number,
  entityType: string,
  entityId: string,
  variantType: VariantType,
  isPrimary: boolean = false,
  assignedBy?: string
): Promise<void> {
  const existingUsage = await db.select().from(mediaUsage)
    .where(and(
      eq(mediaUsage.assetId, assetId),
      eq(mediaUsage.entityType, entityType),
      eq(mediaUsage.entityId, entityId),
      eq(mediaUsage.usageStatus, 'active')
    ));
  
  if (existingUsage.length > 0) {
    console.log(`Asset ${assetId} already assigned to ${entityType}:${entityId}`);
    return;
  }
  
  if (isPrimary) {
    await db.update(mediaUsage)
      .set({ isPrimary: false })
      .where(and(
        eq(mediaUsage.entityType, entityType),
        eq(mediaUsage.entityId, entityId),
        eq(mediaUsage.isPrimary, true),
        eq(mediaUsage.usageStatus, 'active')
      ));
  }
  
  await db.insert(mediaUsage).values({
    assetId,
    entityType,
    entityId,
    variantType,
    isPrimary,
    assignedBy,
    usageStatus: 'active',
  });
}

export async function getUnusedAssets(
  tagType?: string,
  tagValue?: string,
  limit: number = 20
): Promise<MediaAsset[]> {
  let baseQuery = db.select({ asset: mediaAssets })
    .from(mediaAssets)
    .leftJoin(mediaUsage, and(
      eq(mediaAssets.id, mediaUsage.assetId),
      eq(mediaUsage.usageStatus, 'active')
    ))
    .where(and(
      eq(mediaAssets.isDeleted, false),
      isNull(mediaUsage.id)
    ));
  
  const results = await baseQuery.limit(limit);
  return results.map(r => r.asset);
}

export async function createBackup(
  scope: string,
  assetIds: number[],
  createdBy?: string
): Promise<{ backupId: number; snapshotPath: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUP_PATH, `${scope}-${timestamp}`);
  ensureDir(backupDir);
  
  const assets = await db.select().from(mediaAssets)
    .where(inArray(mediaAssets.id, assetIds));
  
  let fileCount = 0;
  let totalSize = 0;
  
  for (const asset of assets) {
    if (asset.storagePath && fs.existsSync(asset.storagePath)) {
      const assetBackupDir = path.join(backupDir, 'files', asset.slug);
      ensureDir(assetBackupDir);
      
      const sourceDir = path.dirname(asset.storagePath);
      if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir);
        for (const file of files) {
          const srcPath = path.join(sourceDir, file);
          const destPath = path.join(assetBackupDir, file);
          fs.copyFileSync(srcPath, destPath);
          totalSize += fs.statSync(srcPath).size;
          fileCount++;
        }
      }
    }
  }
  
  const metadataPath = path.join(backupDir, 'metadata.json');
  const metadata = {
    assets,
    variants: await db.select().from(mediaVariants).where(inArray(mediaVariants.assetId, assetIds)),
    tags: await db.select().from(mediaTags).where(inArray(mediaTags.assetId, assetIds)),
    usage: await db.select().from(mediaUsage).where(inArray(mediaUsage.assetId, assetIds)),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  const [backup] = await db.insert(mediaBackups).values({
    scope,
    snapshotPath: backupDir,
    fileCount,
    totalSizeBytes: totalSize,
    metadata: { assetIds, assetCount: assets.length },
    status: 'completed',
    createdBy,
  }).returning();
  
  return { backupId: backup.id, snapshotPath: backupDir };
}

export interface CleanupPreviewItem {
  assetId: number;
  slug: string;
  matchedRule: string;
  currentUsage: string[];
  thumbnailPath?: string;
}

export async function previewCleanup(
  jobType: string,
  scope: Record<string, unknown>
): Promise<{ items: CleanupPreviewItem[]; totalCount: number }> {
  const items: CleanupPreviewItem[] = [];
  
  if (jobType === 'hotel_from_gallery') {
    const hotelTagged = await db.select({
      asset: mediaAssets,
      tag: mediaTags,
    })
      .from(mediaAssets)
      .innerJoin(mediaTags, eq(mediaAssets.id, mediaTags.assetId))
      .where(and(
        eq(mediaTags.tagType, 'hotel'),
        eq(mediaAssets.isDeleted, false)
      ));
    
    for (const { asset } of hotelTagged) {
      const galleryUsage = await db.select().from(mediaUsage)
        .where(and(
          eq(mediaUsage.assetId, asset.id),
          eq(mediaUsage.entityType, 'destination_gallery'),
          eq(mediaUsage.usageStatus, 'active')
        ));
      
      if (galleryUsage.length > 0) {
        const allUsage = await db.select().from(mediaUsage)
          .where(and(eq(mediaUsage.assetId, asset.id), eq(mediaUsage.usageStatus, 'active')));
        
        items.push({
          assetId: asset.id,
          slug: asset.slug,
          matchedRule: 'hotel tag + destination_gallery usage',
          currentUsage: allUsage.map(u => `${u.entityType}:${u.entityId}`),
          thumbnailPath: asset.storagePath?.replace('original', 'thumb'),
        });
      }
    }
    
    const hotelPatternAssets = await db.select().from(mediaAssets)
      .where(and(
        eq(mediaAssets.isDeleted, false),
        or(
          like(mediaAssets.slug, '%hotel%'),
          like(mediaAssets.slug, '%resort%'),
          like(mediaAssets.slug, '%room%'),
          like(mediaAssets.slug, '%suite%'),
          like(mediaAssets.slug, '%lobby%')
        )
      ));
    
    for (const asset of hotelPatternAssets) {
      if (items.find(i => i.assetId === asset.id)) continue;
      
      const galleryUsage = await db.select().from(mediaUsage)
        .where(and(
          eq(mediaUsage.assetId, asset.id),
          eq(mediaUsage.entityType, 'destination_gallery'),
          eq(mediaUsage.usageStatus, 'active')
        ));
      
      if (galleryUsage.length > 0) {
        const allUsage = await db.select().from(mediaUsage)
          .where(and(eq(mediaUsage.assetId, asset.id), eq(mediaUsage.usageStatus, 'active')));
        
        items.push({
          assetId: asset.id,
          slug: asset.slug,
          matchedRule: 'filename pattern (hotel/resort/room/suite/lobby)',
          currentUsage: allUsage.map(u => `${u.entityType}:${u.entityId}`),
          thumbnailPath: asset.storagePath?.replace('original', 'thumb'),
        });
      }
    }
  }
  
  return { items, totalCount: items.length };
}

export async function executeCleanup(
  jobId: number,
  confirmedBy: string
): Promise<{ success: boolean; removedCount: number }> {
  const [job] = await db.select().from(mediaCleanupJobs)
    .where(eq(mediaCleanupJobs.id, jobId));
  
  if (!job || job.status !== 'previewed') {
    throw new Error('Job must be previewed before execution');
  }
  
  const previewResults = job.previewResults as { items: CleanupPreviewItem[] } | null;
  if (!previewResults?.items) {
    throw new Error('No preview results found');
  }
  
  const assetIds = previewResults.items.map(i => i.assetId);
  const { backupId } = await createBackup(job.jobType, assetIds, confirmedBy);
  
  const rollbackToken = crypto.randomBytes(16).toString('hex');
  
  await db.update(mediaCleanupJobs)
    .set({
      backupId,
      rollbackToken,
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: confirmedBy,
    })
    .where(eq(mediaCleanupJobs.id, jobId));
  
  let removedCount = 0;
  
  for (const item of previewResults.items) {
    await db.update(mediaUsage)
      .set({ usageStatus: 'historical' })
      .where(and(
        eq(mediaUsage.assetId, item.assetId),
        eq(mediaUsage.entityType, 'destination_gallery'),
        eq(mediaUsage.usageStatus, 'active')
      ));
    removedCount++;
  }
  
  await db.update(mediaCleanupJobs)
    .set({
      status: 'executed',
      executedAt: new Date(),
      affectedCount: removedCount,
    })
    .where(eq(mediaCleanupJobs.id, jobId));
  
  return { success: true, removedCount };
}

export async function rollbackCleanup(jobId: number): Promise<{ success: boolean }> {
  const [job] = await db.select().from(mediaCleanupJobs)
    .where(eq(mediaCleanupJobs.id, jobId));
  
  if (!job || job.status !== 'executed') {
    throw new Error('Only executed jobs can be rolled back');
  }
  
  if (!job.backupId) {
    throw new Error('No backup found for this job');
  }
  
  const [backup] = await db.select().from(mediaBackups)
    .where(eq(mediaBackups.id, job.backupId));
  
  if (!backup) {
    throw new Error('Backup record not found');
  }
  
  const metadataPath = path.join(backup.snapshotPath, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error('Backup metadata not found');
  }
  
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  
  for (const usage of metadata.usage) {
    if (usage.entityType === 'destination_gallery') {
      await db.update(mediaUsage)
        .set({ usageStatus: 'active' })
        .where(eq(mediaUsage.id, usage.id));
    }
  }
  
  await db.update(mediaCleanupJobs)
    .set({
      status: 'rolled_back',
      rolledBackAt: new Date(),
    })
    .where(eq(mediaCleanupJobs.id, jobId));
  
  await db.update(mediaBackups)
    .set({
      status: 'restored',
      restoredAt: new Date(),
    })
    .where(eq(mediaBackups.id, job.backupId));
  
  return { success: true };
}

export async function getAllAssets(options?: {
  limit?: number;
  offset?: number;
  source?: string;
}): Promise<MediaAsset[]> {
  const conditions: any[] = [eq(mediaAssets.isDeleted, false)];
  
  if (options?.source) {
    conditions.push(eq(mediaAssets.source, options.source));
  }
  
  return await db.select().from(mediaAssets)
    .where(and(...conditions))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

// Extended function to get assets with destination filtering and usage data
export interface AssetWithMeta extends MediaAsset {
  destinations: string[];
  usedInPackages: { packageId: number; packageTitle: string; usageType: string }[];
}

export async function getAssetsWithMeta(options?: {
  limit?: number;
  offset?: number;
  source?: string;
  destination?: string; // Filter by destination country/city
}): Promise<AssetWithMeta[]> {
  const conditions: any[] = [eq(mediaAssets.isDeleted, false)];
  
  if (options?.source) {
    conditions.push(eq(mediaAssets.source, options.source));
  }
  
  // Get all assets (we'll filter by destination after joining tags)
  let assets: MediaAsset[];
  
  if (options?.destination) {
    // Get asset IDs that have this destination tag
    const taggedAssetIds = await db.select({ assetId: mediaTags.assetId })
      .from(mediaTags)
      .where(and(
        eq(mediaTags.tagType, 'destination'),
        sql`LOWER(${mediaTags.tagValue}) = LOWER(${options.destination})`
      ));
    
    const assetIds = taggedAssetIds.map(t => t.assetId);
    
    if (assetIds.length === 0) {
      // No assets with this destination, return empty but still get untagged assets
      assets = await db.select().from(mediaAssets)
        .where(and(...conditions))
        .orderBy(desc(mediaAssets.createdAt))
        .limit(options?.limit || 50)
        .offset(options?.offset || 0);
    } else {
      // Get assets with this destination first, then others
      const destinationAssets = await db.select().from(mediaAssets)
        .where(and(...conditions, inArray(mediaAssets.id, assetIds)))
        .orderBy(desc(mediaAssets.createdAt))
        .limit(options?.limit || 50);
      
      // Get remaining assets without this destination
      const remaining = (options?.limit || 50) - destinationAssets.length;
      const otherAssets = remaining > 0 ? await db.select().from(mediaAssets)
        .where(and(...conditions, notInArray(mediaAssets.id, assetIds)))
        .orderBy(desc(mediaAssets.createdAt))
        .limit(remaining) : [];
      
      assets = [...destinationAssets, ...otherAssets];
    }
  } else {
    assets = await db.select().from(mediaAssets)
      .where(and(...conditions))
      .orderBy(desc(mediaAssets.createdAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);
  }
  
  if (assets.length === 0) return [];
  
  const assetIds = assets.map(a => a.id);
  
  // Get all destination tags for these assets
  const tags = await db.select().from(mediaTags)
    .where(and(
      inArray(mediaTags.assetId, assetIds),
      eq(mediaTags.tagType, 'destination')
    ));
  
  // Get all usage for these assets
  const usage = await db.select().from(mediaUsage)
    .where(and(
      inArray(mediaUsage.assetId, assetIds),
      eq(mediaUsage.usageStatus, 'active'),
      eq(mediaUsage.entityType, 'package')
    ));
  
  // Get package titles for the usage
  const packageIds = Array.from(new Set(usage.map(u => parseInt(u.entityId)))).filter(id => !isNaN(id));
  let packageMap: Record<number, string> = {};
  
  if (packageIds.length > 0) {
    const { flightPackages } = await import("@shared/schema");
    const packages = await db.select({ id: flightPackages.id, title: flightPackages.title })
      .from(flightPackages)
      .where(inArray(flightPackages.id, packageIds));
    packageMap = Object.fromEntries(packages.map(p => [p.id, p.title]));
  }
  
  // Build the result with meta
  return assets.map(asset => ({
    ...asset,
    destinations: tags
      .filter(t => t.assetId === asset.id)
      .map(t => t.tagValue),
    usedInPackages: usage
      .filter(u => u.assetId === asset.id)
      .map(u => ({
        packageId: parseInt(u.entityId),
        packageTitle: packageMap[parseInt(u.entityId)] || `Package #${u.entityId}`,
        usageType: u.isPrimary ? 'featured' : 'gallery'
      }))
  }));
}

// Add destination tag to an asset
export async function addDestinationTag(assetId: number, destination: string): Promise<void> {
  // Check if tag already exists
  const existing = await db.select().from(mediaTags)
    .where(and(
      eq(mediaTags.assetId, assetId),
      eq(mediaTags.tagType, 'destination'),
      sql`LOWER(${mediaTags.tagValue}) = LOWER(${destination})`
    ))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(mediaTags).values({
      assetId,
      tagType: 'destination',
      tagValue: destination,
      isPrimary: false,
      confidence: 1.0
    });
  }
}

// Remove destination tag from an asset
export async function removeDestinationTag(assetId: number, destination: string): Promise<void> {
  await db.delete(mediaTags)
    .where(and(
      eq(mediaTags.assetId, assetId),
      eq(mediaTags.tagType, 'destination'),
      sql`LOWER(${mediaTags.tagValue}) = LOWER(${destination})`
    ));
}

// Record that an asset is used in a package
export async function recordPackageUsage(assetId: number, packageId: number, isPrimary: boolean): Promise<void> {
  // Check if already recorded
  const existing = await db.select().from(mediaUsage)
    .where(and(
      eq(mediaUsage.assetId, assetId),
      eq(mediaUsage.entityType, 'package'),
      eq(mediaUsage.entityId, packageId.toString())
    ))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(mediaUsage).values({
      assetId,
      entityType: 'package',
      entityId: packageId.toString(),
      variantType: 'card',
      isPrimary,
      usageStatus: 'active'
    });
  } else {
    // Update isPrimary if changed
    await db.update(mediaUsage)
      .set({ isPrimary, usageStatus: 'active' })
      .where(and(
        eq(mediaUsage.assetId, assetId),
        eq(mediaUsage.entityType, 'package'),
        eq(mediaUsage.entityId, packageId.toString())
      ));
  }
}

// Remove usage record
export async function removePackageUsage(assetId: number, packageId: number): Promise<void> {
  await db.delete(mediaUsage)
    .where(and(
      eq(mediaUsage.assetId, assetId),
      eq(mediaUsage.entityType, 'package'),
      eq(mediaUsage.entityId, packageId.toString())
    ));
}

// Sync all package usage - call this when a package is saved
export async function syncPackageMediaUsage(packageId: number, featuredImageUrl: string | null, galleryUrls: string[]): Promise<void> {
  // Get all current usage for this package
  const currentUsage = await db.select().from(mediaUsage)
    .where(and(
      eq(mediaUsage.entityType, 'package'),
      eq(mediaUsage.entityId, packageId.toString()),
      eq(mediaUsage.usageStatus, 'active')
    ));
  
  // Extract slugs from URLs
  const extractSlug = (url: string): string | null => {
    const match = url.match(/\/api\/media\/([^\/]+)/);
    return match ? match[1] : null;
  };
  
  const featuredSlug = featuredImageUrl ? extractSlug(featuredImageUrl) : null;
  const gallerySlugs = galleryUrls.map(extractSlug).filter(Boolean) as string[];
  const allSlugs = Array.from(new Set([featuredSlug, ...gallerySlugs].filter(Boolean) as string[]));
  
  // Get asset IDs for these slugs
  const assets = allSlugs.length > 0 ? await db.select({ id: mediaAssets.id, slug: mediaAssets.slug })
    .from(mediaAssets)
    .where(inArray(mediaAssets.slug, allSlugs)) : [];
  
  const slugToId = Object.fromEntries(assets.map(a => [a.slug, a.id]));
  
  // Determine which assets should be recorded
  const newUsage: { assetId: number; isPrimary: boolean }[] = [];
  
  if (featuredSlug && slugToId[featuredSlug]) {
    newUsage.push({ assetId: slugToId[featuredSlug], isPrimary: true });
  }
  
  for (const slug of gallerySlugs) {
    if (slugToId[slug] && !newUsage.some(u => u.assetId === slugToId[slug])) {
      newUsage.push({ assetId: slugToId[slug], isPrimary: false });
    }
  }
  
  // Remove old usage that's no longer valid
  for (const usage of currentUsage) {
    if (!newUsage.some(u => u.assetId === usage.assetId)) {
      await removePackageUsage(usage.assetId, packageId);
    }
  }
  
  // Add new usage
  for (const usage of newUsage) {
    await recordPackageUsage(usage.assetId, packageId, usage.isPrimary);
  }
}

export async function softDeleteAsset(assetId: number): Promise<void> {
  await db.update(mediaAssets)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(mediaAssets.id, assetId));
}

export async function getAssetUsage(assetId: number): Promise<Array<{
  entityType: string;
  entityId: string;
  variantType: string;
  isPrimary: boolean;
}>> {
  const usage = await db.select().from(mediaUsage)
    .where(and(
      eq(mediaUsage.assetId, assetId),
      eq(mediaUsage.usageStatus, 'active')
    ));
  
  return usage.map(u => ({
    entityType: u.entityType,
    entityId: u.entityId,
    variantType: u.variantType,
    isPrimary: u.isPrimary,
  }));
}

export async function getCleanupJobs(): Promise<Array<{
  id: number;
  jobType: string;
  status: string;
  affectedCount: number | null;
  createdAt: Date;
}>> {
  const jobs = await db.select().from(mediaCleanupJobs)
    .orderBy(desc(mediaCleanupJobs.createdAt))
    .limit(20);
  
  return jobs.map(j => ({
    id: j.id,
    jobType: j.jobType,
    status: j.status,
    affectedCount: j.affectedCount,
    createdAt: j.createdAt,
  }));
}

export async function getBackups(): Promise<Array<{
  id: number;
  scope: string;
  fileCount: number;
  totalSizeBytes: number | null;
  status: string;
  createdAt: Date;
}>> {
  const backups = await db.select().from(mediaBackups)
    .orderBy(desc(mediaBackups.createdAt))
    .limit(20);
  
  return backups.map(b => ({
    id: b.id,
    scope: b.scope,
    fileCount: b.fileCount,
    totalSizeBytes: b.totalSizeBytes,
    status: b.status,
    createdAt: b.createdAt,
  }));
}

// Migrate existing local images to Object Storage
export async function migrateLocalToObjectStorage(limit: number = 50): Promise<{
  migrated: number;
  failed: number;
  remaining: number;
  errors: string[];
}> {
  const result = { migrated: 0, failed: 0, remaining: 0, errors: [] as string[] };
  
  // Check if object storage is available
  const isAvailable = await objectStorage.isAvailable();
  if (!isAvailable) {
    result.errors.push('Object Storage is not available');
    return result;
  }
  
  // Get local variants that need migration
  const localVariants = await db.select().from(mediaVariants)
    .where(and(
      eq(mediaVariants.storageType, 'local'),
      eq(mediaVariants.status, 'active')
    ))
    .limit(limit);
  
  // Count remaining
  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(mediaVariants)
    .where(and(
      eq(mediaVariants.storageType, 'local'),
      eq(mediaVariants.status, 'active')
    ));
  result.remaining = (countResult?.count || 0) - localVariants.length;
  
  for (const variant of localVariants) {
    try {
      // Check if local file exists
      if (!fs.existsSync(variant.filepath)) {
        console.log(`[Migration] File not found, skipping: ${variant.filepath}`);
        result.failed++;
        result.errors.push(`File not found: ${variant.filepath}`);
        continue;
      }
      
      // Read the local file
      const buffer = fs.readFileSync(variant.filepath);
      
      // Get the asset slug for naming
      const [asset] = await db.select({ slug: mediaAssets.slug })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, variant.assetId));
      
      if (!asset) {
        result.failed++;
        result.errors.push(`Asset not found for variant ${variant.id}`);
        continue;
      }
      
      // Upload to Object Storage
      const objectPath = await objectStorage.uploadFromBuffer(
        buffer, 
        `${asset.slug}-${variant.variantType}.webp`,
        'media'
      );
      
      // Update the variant record
      await db.update(mediaVariants)
        .set({ 
          filepath: objectPath,
          storageType: 'object_storage'
        })
        .where(eq(mediaVariants.id, variant.id));
      
      console.log(`[Migration] Migrated variant ${variant.id}: ${variant.filepath} -> ${objectPath}`);
      result.migrated++;
      
    } catch (error: any) {
      console.error(`[Migration] Failed to migrate variant ${variant.id}:`, error);
      result.failed++;
      result.errors.push(`Variant ${variant.id}: ${error.message}`);
    }
  }
  
  return result;
}

// Get migration status
export async function getMigrationStatus(): Promise<{
  totalLocal: number;
  totalObjectStorage: number;
  percentComplete: number;
}> {
  const [localCount] = await db.select({ count: sql<number>`count(*)` })
    .from(mediaVariants)
    .where(and(
      eq(mediaVariants.storageType, 'local'),
      eq(mediaVariants.status, 'active')
    ));
  
  const [objectCount] = await db.select({ count: sql<number>`count(*)` })
    .from(mediaVariants)
    .where(and(
      eq(mediaVariants.storageType, 'object_storage'),
      eq(mediaVariants.status, 'active')
    ));
  
  const total = (localCount?.count || 0) + (objectCount?.count || 0);
  const percentComplete = total > 0 ? Math.round(((objectCount?.count || 0) / total) * 100) : 100;
  
  return {
    totalLocal: localCount?.count || 0,
    totalObjectStorage: objectCount?.count || 0,
    percentComplete
  };
}
