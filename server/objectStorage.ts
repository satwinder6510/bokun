import { Response } from "express";
import { randomUUID } from "crypto";

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

let storageClient: any = null;
let storageInitError: string | null = null;

async function initStorageClient() {
  if (storageClient) return storageClient;
  if (storageInitError) return null;
  
  try {
    const { Client } = await import("@replit/object-storage");
    storageClient = new Client();
    return storageClient;
  } catch (error: any) {
    storageInitError = error.message;
    console.warn("Object storage not available:", error.message);
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
  private client: any = null;
  private initPromise: Promise<any> | null = null;

  async getClient() {
    if (this.client) return this.client;
    if (!this.initPromise) {
      this.initPromise = initStorageClient();
    }
    this.client = await this.initPromise;
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    const client = await this.getClient();
    return client !== null;
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

  async getObject(objectPath: string): Promise<{ data: Buffer; contentType: string } | null> {
    const client = await this.getClient();
    if (!client) return null;

    try {
      const textResult = await client.downloadAsText(objectPath);
      if (textResult.ok && textResult.value) {
        const contentType = this.getContentTypeFromPath(objectPath);
        
        // Try to decode as base64 - all our uploads are now base64 encoded
        try {
          const decoded = Buffer.from(textResult.value, 'base64');
          // Check if decoded data looks like binary (not readable text)
          // Binary files typically have many non-printable characters in the first bytes
          const firstBytes = decoded.slice(0, 8);
          const hasBinaryData = firstBytes.some(b => b < 32 && b !== 9 && b !== 10 && b !== 13);
          
          // Also check for common binary file signatures
          const isPng = decoded[0] === 0x89 && decoded[1] === 0x50 && decoded[2] === 0x4E && decoded[3] === 0x47;
          const isJpeg = decoded[0] === 0xFF && decoded[1] === 0xD8;
          const isGif = decoded[0] === 0x47 && decoded[1] === 0x49 && decoded[2] === 0x46;
          const isWebp = decoded[0] === 0x52 && decoded[1] === 0x49 && decoded[2] === 0x46 && decoded[3] === 0x46;
          
          if (isPng || isJpeg || isGif || isWebp || hasBinaryData) {
            return { data: decoded, contentType };
          }
        } catch {
          // If base64 decoding fails, use the raw value
        }
        
        // If not detected as binary, return as-is
        return { data: Buffer.from(textResult.value), contentType };
      }
      return null;
    } catch (error) {
      console.error("Error getting object:", error);
      return null;
    }
  }

  async downloadObject(objectPath: string, res: Response, cacheTtlSec: number = 86400) {
    try {
      const result = await this.getObject(objectPath);
      if (!result) {
        res.status(404).json({ error: "Object not found" });
        return;
      }

      res.set({
        "Content-Type": result.contentType,
        "Content-Length": result.data.length.toString(),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });
      res.send(result.data);
    } catch (error) {
      console.error("Error downloading object:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async uploadFromUrl(sourceUrl: string, filename: string): Promise<string> {
    const client = await this.getClient();
    if (!client) {
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

      // Use base64 encoding to work around uploadFromBytes bug
      const base64Data = buffer.toString('base64');
      const result = await client.uploadFromText(objectPath, base64Data);
      
      if (!result.ok) {
        throw new Error(`Failed to upload to object storage: ${result.error || 'Unknown error'}`);
      }

      console.log(`[ObjectStorage] Uploaded from URL: ${objectPath} (${buffer.length} bytes)`);
      return `/objects/${objectPath}`;
    } catch (error: any) {
      console.error(`uploadFromUrl error for ${sourceUrl}:`, error);
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  async uploadFromBuffer(buffer: Buffer, filename: string, folder: string = 'images'): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error("Object storage is not available. Please configure a bucket in the Object Storage tab.");
    }

    const safeFilename = sanitizeFilename(filename);
    const objectId = `${randomUUID()}-${safeFilename}`;
    const objectPath = `${folder}/${objectId}`;

    console.log(`[ObjectStorage] Uploading: path=${objectPath}, bufferSize=${buffer.length}`);

    try {
      // Use base64 encoding to work around uploadFromBytes bug
      const base64Data = buffer.toString('base64');
      const result = await client.uploadFromText(objectPath, base64Data);
      
      console.log(`[ObjectStorage] Upload result: ok=${result.ok}, error=${result.error || 'none'}`);
      
      if (!result.ok) {
        throw new Error(`Failed to upload to object storage: ${result.error || 'Unknown error'}`);
      }

      console.log(`[ObjectStorage] Upload complete: ${objectPath} (${buffer.length} bytes as base64)`);
      return `/objects/${objectPath}`;
    } catch (error: any) {
      console.error(`uploadFromBuffer error:`, error);
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  async downloadToBuffer(objectPath: string): Promise<Buffer> {
    const normalizedPath = objectPath.startsWith('/objects/') 
      ? objectPath.replace('/objects/', '') 
      : objectPath;
    
    const result = await this.getObject(normalizedPath);
    if (!result) {
      throw new ObjectNotFoundError();
    }
    return result.data;
  }

  async exists(objectPath: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const normalizedPath = objectPath.startsWith('/objects/') 
        ? objectPath.replace('/objects/', '') 
        : objectPath;
      const result = await client.downloadAsText(normalizedPath);
      return result.ok;
    } catch {
      return false;
    }
  }

  async deleteObject(objectPath: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const normalizedPath = objectPath.startsWith('/objects/') 
        ? objectPath.replace('/objects/', '') 
        : objectPath;
      const result = await client.delete(normalizedPath);
      return result.ok;
    } catch (error) {
      console.error("Error deleting object:", error);
      return false;
    }
  }

  async listObjects(prefix: string = ""): Promise<string[]> {
    const client = await this.getClient();
    if (!client) return [];

    try {
      const result = await client.list({ prefix });
      if (result.ok && result.value?.objects) {
        return result.value.objects.map((obj: any) => obj.name);
      }
      return [];
    } catch (error) {
      console.error("Error listing objects:", error);
      return [];
    }
  }
}
