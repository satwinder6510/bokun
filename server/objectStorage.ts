import { Response } from "express";
import { randomUUID } from "crypto";

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

  async getObject(objectPath: string): Promise<{ data: Buffer; contentType: string } | null> {
    const client = await this.getClient();
    if (!client) return null;

    try {
      const result = await client.downloadAsBytes(objectPath);
      if (result.ok) {
        const contentType = this.getContentTypeFromPath(objectPath);
        return { data: Buffer.from(result.value), contentType };
      }
      return null;
    } catch (error) {
      console.error("Error getting object:", error);
      return null;
    }
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

  async downloadObject(objectPath: string, res: Response, cacheTtlSec: number = 3600) {
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

    const objectId = `${randomUUID()}-${filename}`;
    const objectPath = `images/${objectId}`;

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const result = await client.uploadFromBytes(objectPath, buffer);
      if (!result.ok) {
        throw new Error(`Failed to upload to object storage: ${result.error || 'Unknown error'}`);
      }

      return `/objects/${objectPath}`;
    } catch (error: any) {
      console.error(`uploadFromUrl error for ${sourceUrl}:`, error);
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  async uploadFromBuffer(buffer: Buffer, filename: string): Promise<string> {
    const client = await this.getClient();
    if (!client) {
      throw new Error("Object storage is not available. Please configure a bucket in the Object Storage tab.");
    }

    const objectId = `${randomUUID()}-${filename}`;
    const objectPath = `images/${objectId}`;

    try {
      const result = await client.uploadFromBytes(objectPath, buffer);
      if (!result.ok) {
        throw new Error(`Failed to upload to object storage: ${result.error || 'Unknown error'}`);
      }

      return `/objects/${objectPath}`;
    } catch (error: any) {
      console.error(`uploadFromBuffer error:`, error);
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  async exists(objectPath: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const normalizedPath = objectPath.startsWith('/objects/') 
        ? objectPath.replace('/objects/', '') 
        : objectPath;
      const result = await client.downloadAsBytes(normalizedPath);
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
      if (result.ok) {
        return result.value.objects.map((obj: any) => obj.name);
      }
      return [];
    } catch (error) {
      console.error("Error listing objects:", error);
      return [];
    }
  }
}
