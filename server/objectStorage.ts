import { Response } from "express";
import { randomUUID } from "crypto";
import { Storage, File } from "@google-cloud/storage";

function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot > 0 ? filename.slice(lastDot).toLowerCase() : '';
  const baseName = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  
  return (sanitized || 'image') + ext;
}

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

let cachedBucketName: string | null = null;

async function getBucketName(): Promise<string | null> {
  if (cachedBucketName) return cachedBucketName;
  
  try {
    const [buckets] = await objectStorageClient.getBuckets();
    if (buckets.length > 0) {
      cachedBucketName = buckets[0].name;
      console.log(`[ObjectStorage] Using bucket: ${cachedBucketName}`);
      return cachedBucketName;
    }
    console.warn("[ObjectStorage] No buckets found");
    return null;
  } catch (error: any) {
    console.warn("[ObjectStorage] Error getting buckets:", error.message);
    return null;
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  
  async isAvailable(): Promise<boolean> {
    const bucket = await getBucketName();
    return bucket !== null;
  }

  getContentTypeFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'pdf': 'application/pdf',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async getFile(objectPath: string): Promise<File | null> {
    const bucketNameValue = await getBucketName();
    if (!bucketNameValue) return null;

    const bucket = objectStorageClient.bucket(bucketNameValue);
    const file = bucket.file(objectPath);
    
    const [exists] = await file.exists();
    if (!exists) return null;
    
    return file;
  }

  async downloadObject(objectPath: string, res: Response, cacheTtlSec: number = 86400) {
    try {
      const file = await this.getFile(objectPath);
      if (!file) {
        res.status(404).json({ error: "Object not found" });
        return;
      }

      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || this.getContentTypeFromPath(objectPath);

      res.set({
        "Content-Type": contentType,
        "Content-Length": metadata.size?.toString() || '0',
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading object:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async uploadFromUrl(sourceUrl: string, filename: string): Promise<string> {
    const bucketNameValue = await getBucketName();
    if (!bucketNameValue) {
      throw new Error("Object storage is not available. Please configure a bucket in the Object Storage tab.");
    }

    const safeFilename = sanitizeFilename(filename);
    const objectId = `${randomUUID()}-${safeFilename}`;
    const objectPath = `images/${objectId}`;

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const bucket = objectStorageClient.bucket(bucketNameValue);
      const file = bucket.file(objectPath);
      
      const contentType = this.getContentTypeFromPath(objectPath);
      
      await file.save(buffer, {
        metadata: { contentType },
      });

      console.log(`[ObjectStorage] Uploaded from URL: ${objectPath} (${buffer.length} bytes)`);
      return `/objects/${objectPath}`;
    } catch (error: any) {
      console.error(`uploadFromUrl error for ${sourceUrl}:`, error);
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  async uploadFromBuffer(buffer: Buffer, filename: string): Promise<string> {
    const bucketNameValue = await getBucketName();
    if (!bucketNameValue) {
      throw new Error("Object storage is not available. Please configure a bucket in the Object Storage tab.");
    }

    const safeFilename = sanitizeFilename(filename);
    const objectId = `${randomUUID()}-${safeFilename}`;
    const objectPath = `images/${objectId}`;

    console.log(`[ObjectStorage] Uploading: path=${objectPath}, bufferSize=${buffer.length}`);

    try {
      const bucket = objectStorageClient.bucket(bucketNameValue);
      const file = bucket.file(objectPath);
      
      const contentType = this.getContentTypeFromPath(objectPath);
      
      await file.save(buffer, {
        metadata: { contentType },
      });

      console.log(`[ObjectStorage] Upload complete: ${objectPath}`);
      return `/objects/${objectPath}`;
    } catch (error: any) {
      console.error(`uploadFromBuffer error:`, error);
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  async exists(objectPath: string): Promise<boolean> {
    try {
      const normalizedPath = objectPath.startsWith('/objects/') 
        ? objectPath.replace('/objects/', '') 
        : objectPath;
      const file = await this.getFile(normalizedPath);
      return file !== null;
    } catch {
      return false;
    }
  }

  async deleteObject(objectPath: string): Promise<boolean> {
    const bucketNameValue = await getBucketName();
    if (!bucketNameValue) return false;

    try {
      const normalizedPath = objectPath.startsWith('/objects/') 
        ? objectPath.replace('/objects/', '') 
        : objectPath;
      
      const bucket = objectStorageClient.bucket(bucketNameValue);
      const file = bucket.file(normalizedPath);
      await file.delete();
      return true;
    } catch (error) {
      console.error("Error deleting object:", error);
      return false;
    }
  }

  async listObjects(prefix: string = ""): Promise<string[]> {
    const bucketNameValue = await getBucketName();
    if (!bucketNameValue) return [];

    try {
      const bucket = objectStorageClient.bucket(bucketNameValue);
      const [files] = await bucket.getFiles({ prefix });
      return files.map((file) => file.name);
    } catch (error) {
      console.error("Error listing objects:", error);
      return [];
    }
  }
}
