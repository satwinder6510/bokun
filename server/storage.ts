import { type User, type InsertUser, type BokunProduct, type Faq, type InsertFaq, type UpdateFaq, type BlogPost, type InsertBlogPost, type UpdateBlogPost } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product cache methods (per-currency)
  getCachedProduct(productId: string, currency: string): Promise<BokunProduct | null>;
  getCachedProducts(currency: string): Promise<BokunProduct[]>;
  setCachedProduct(productId: string, product: BokunProduct, currency: string): Promise<void>;
  setCachedProducts(products: BokunProduct[], currency: string): Promise<void>;
  clearProductCache(currency?: string): Promise<void>;
  getCacheMetadata(currency: string): Promise<{ lastRefreshAt: Date; totalProducts: number } | null>;
  isCacheExpired(currency: string): Promise<boolean>;
  
  // FAQ methods
  getAllFaqs(): Promise<Faq[]>;
  getPublishedFaqs(): Promise<Faq[]>;
  getFaqById(id: number): Promise<Faq | undefined>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: number, faq: UpdateFaq): Promise<Faq | undefined>;
  deleteFaq(id: number): Promise<boolean>;
  
  // Blog post methods
  getAllBlogPosts(): Promise<BlogPost[]>;
  getPublishedBlogPosts(): Promise<BlogPost[]>;
  getBlogPostById(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: UpdateBlogPost): Promise<BlogPost | undefined>;
  deleteBlogPost(id: number): Promise<boolean>;
}

// In-memory storage with per-currency product caching
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private productsCacheByCurrency: Map<string, Map<string, BokunProduct>>;
  private cacheExpiryByCurrency: Map<string, Date>;
  private lastRefreshAtByCurrency: Map<string, Date>;
  private faqs: Map<number, Faq>;
  private faqIdCounter: number;
  private blogPosts: Map<number, BlogPost>;
  private blogPostIdCounter: number;

  constructor() {
    this.users = new Map();
    this.productsCacheByCurrency = new Map();
    this.cacheExpiryByCurrency = new Map();
    this.lastRefreshAtByCurrency = new Map();
    this.faqs = new Map();
    this.faqIdCounter = 1;
    this.blogPosts = new Map();
    this.blogPostIdCounter = 1;
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

  async getCachedProduct(productId: string, currency: string): Promise<BokunProduct | null> {
    // Check if cache exists for this currency
    const currencyCache = this.productsCacheByCurrency.get(currency);
    if (!currencyCache) return null;
    
    // Check if cache is expired
    const expiry = this.cacheExpiryByCurrency.get(currency);
    if (expiry && new Date() > expiry) {
      return null;
    }
    
    return currencyCache.get(productId) || null;
  }

  async getCachedProducts(currency: string): Promise<BokunProduct[]> {
    // Check if cache exists for this currency
    const currencyCache = this.productsCacheByCurrency.get(currency);
    if (!currencyCache) return [];
    
    // Check if cache is expired
    const expiry = this.cacheExpiryByCurrency.get(currency);
    if (expiry && new Date() > expiry) {
      return [];
    }
    
    return Array.from(currencyCache.values());
  }

  async setCachedProduct(productId: string, product: BokunProduct, currency: string): Promise<void> {
    // Get or create currency cache
    let currencyCache = this.productsCacheByCurrency.get(currency);
    if (!currencyCache) {
      currencyCache = new Map();
      this.productsCacheByCurrency.set(currency, currencyCache);
    }
    
    currencyCache.set(productId, product);
    
    // Update expiry if not set - 30 day TTL for product cards
    if (!this.cacheExpiryByCurrency.has(currency)) {
      const now = new Date();
      this.cacheExpiryByCurrency.set(currency, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)); // 30 days
      this.lastRefreshAtByCurrency.set(currency, now);
    }
  }

  async setCachedProducts(products: BokunProduct[], currency: string): Promise<void> {
    const now = new Date();
    
    // Create new cache for this currency
    const currencyCache = new Map<string, BokunProduct>();
    
    // Store all products
    for (const product of products) {
      currencyCache.set(product.id, product);
    }
    
    // Update cache for this currency
    this.productsCacheByCurrency.set(currency, currencyCache);
    
    // Update cache metadata - 30 day TTL for product cards
    this.cacheExpiryByCurrency.set(currency, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)); // 30 days
    this.lastRefreshAtByCurrency.set(currency, now);
  }

  async clearProductCache(currency?: string): Promise<void> {
    if (currency) {
      // Clear specific currency cache
      this.productsCacheByCurrency.delete(currency);
      this.cacheExpiryByCurrency.delete(currency);
      this.lastRefreshAtByCurrency.delete(currency);
    } else {
      // Clear all caches
      this.productsCacheByCurrency.clear();
      this.cacheExpiryByCurrency.clear();
      this.lastRefreshAtByCurrency.clear();
    }
  }

  async getCacheMetadata(currency: string): Promise<{ lastRefreshAt: Date; totalProducts: number } | null> {
    const lastRefresh = this.lastRefreshAtByCurrency.get(currency);
    if (!lastRefresh) return null;
    
    const currencyCache = this.productsCacheByCurrency.get(currency);
    return {
      lastRefreshAt: lastRefresh,
      totalProducts: currencyCache?.size || 0,
    };
  }

  async isCacheExpired(currency: string): Promise<boolean> {
    const expiry = this.cacheExpiryByCurrency.get(currency);
    const lastRefresh = this.lastRefreshAtByCurrency.get(currency);
    
    if (!expiry || !lastRefresh) return true;
    
    const now = new Date();
    return now > expiry;
  }

  // FAQ methods
  async getAllFaqs(): Promise<Faq[]> {
    return Array.from(this.faqs.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getPublishedFaqs(): Promise<Faq[]> {
    return Array.from(this.faqs.values())
      .filter(faq => faq.isPublished)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getFaqById(id: number): Promise<Faq | undefined> {
    return this.faqs.get(id);
  }

  async createFaq(insertFaq: InsertFaq): Promise<Faq> {
    const id = this.faqIdCounter++;
    const now = new Date();
    const faq: Faq = {
      id,
      question: insertFaq.question,
      answer: insertFaq.answer,
      displayOrder: insertFaq.displayOrder ?? 0,
      isPublished: insertFaq.isPublished ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.faqs.set(id, faq);
    return faq;
  }

  async updateFaq(id: number, updateFaq: UpdateFaq): Promise<Faq | undefined> {
    const existing = this.faqs.get(id);
    if (!existing) return undefined;

    const updated: Faq = {
      ...existing,
      ...updateFaq,
      updatedAt: new Date(),
    };
    this.faqs.set(id, updated);
    return updated;
  }

  async deleteFaq(id: number): Promise<boolean> {
    return this.faqs.delete(id);
  }

  // Blog post methods
  async getAllBlogPosts(): Promise<BlogPost[]> {
    return Array.from(this.blogPosts.values()).sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });
  }

  async getPublishedBlogPosts(): Promise<BlogPost[]> {
    return Array.from(this.blogPosts.values())
      .filter(post => post.isPublished && post.publishedAt && post.publishedAt <= new Date())
      .sort((a, b) => {
        const aDate = a.publishedAt || a.createdAt;
        const bDate = b.publishedAt || b.createdAt;
        return bDate.getTime() - aDate.getTime();
      });
  }

  async getBlogPostById(id: number): Promise<BlogPost | undefined> {
    return this.blogPosts.get(id);
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    return Array.from(this.blogPosts.values()).find(post => post.slug === slug);
  }

  async createBlogPost(insertPost: InsertBlogPost): Promise<BlogPost> {
    const id = this.blogPostIdCounter++;
    const now = new Date();
    const post: BlogPost = {
      id,
      title: insertPost.title,
      slug: insertPost.slug,
      content: insertPost.content,
      excerpt: insertPost.excerpt,
      metaTitle: insertPost.metaTitle ?? null,
      metaDescription: insertPost.metaDescription ?? null,
      featuredImage: insertPost.featuredImage ?? null,
      author: insertPost.author ?? "Flights and Packages",
      isPublished: insertPost.isPublished ?? false,
      publishedAt: insertPost.publishedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.blogPosts.set(id, post);
    return post;
  }

  async updateBlogPost(id: number, updatePost: UpdateBlogPost): Promise<BlogPost | undefined> {
    const existing = this.blogPosts.get(id);
    if (!existing) return undefined;

    const updated: BlogPost = {
      ...existing,
      ...updatePost,
      updatedAt: new Date(),
    };
    this.blogPosts.set(id, updated);
    return updated;
  }

  async deleteBlogPost(id: number): Promise<boolean> {
    return this.blogPosts.delete(id);
  }
}

export const storage = new MemStorage();
