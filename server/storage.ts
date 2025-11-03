import { type User, type InsertUser, type BokunProduct } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product cache methods
  getCachedProduct(productId: string): Promise<BokunProduct | null>;
  getCachedProducts(): Promise<BokunProduct[]>;
  setCachedProduct(productId: string, product: BokunProduct): Promise<void>;
  setCachedProducts(products: BokunProduct[]): Promise<void>;
  clearProductCache(): Promise<void>;
  getCacheMetadata(): Promise<{ lastRefreshAt: Date; totalProducts: number } | null>;
  isCacheExpired(): Promise<boolean>;
}

// In-memory storage with product caching
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private productsCache: Map<string, BokunProduct>;
  private cacheExpiry: Date | null;
  private lastRefreshAt: Date | null;

  constructor() {
    this.users = new Map();
    this.productsCache = new Map();
    this.cacheExpiry = null;
    this.lastRefreshAt = null;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getCachedProduct(productId: string): Promise<BokunProduct | null> {
    // Check if cache is expired
    if (this.cacheExpiry && new Date() > this.cacheExpiry) {
      return null;
    }
    
    return this.productsCache.get(productId) || null;
  }

  async getCachedProducts(): Promise<BokunProduct[]> {
    // Check if cache is expired
    if (this.cacheExpiry && new Date() > this.cacheExpiry) {
      return [];
    }
    
    return Array.from(this.productsCache.values());
  }

  async setCachedProduct(productId: string, product: BokunProduct): Promise<void> {
    this.productsCache.set(productId, product);
    
    // Update expiry if not set
    if (!this.cacheExpiry) {
      const now = new Date();
      this.cacheExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      this.lastRefreshAt = now;
    }
  }

  async setCachedProducts(products: BokunProduct[]): Promise<void> {
    const now = new Date();
    
    // Clear existing cache
    this.productsCache.clear();
    
    // Store all products
    for (const product of products) {
      this.productsCache.set(product.id, product);
    }
    
    // Update cache metadata
    this.cacheExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    this.lastRefreshAt = now;
  }

  async clearProductCache(): Promise<void> {
    this.productsCache.clear();
    this.cacheExpiry = null;
    this.lastRefreshAt = null;
  }

  async getCacheMetadata(): Promise<{ lastRefreshAt: Date; totalProducts: number } | null> {
    if (!this.lastRefreshAt) return null;
    
    return {
      lastRefreshAt: this.lastRefreshAt,
      totalProducts: this.productsCache.size,
    };
  }

  async isCacheExpired(): Promise<boolean> {
    if (!this.cacheExpiry || !this.lastRefreshAt) return true;
    
    const now = new Date();
    return now > this.cacheExpiry;
  }
}

export const storage = new MemStorage();
