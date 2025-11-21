import { type User, type InsertUser, type BokunProduct, type Faq, type InsertFaq, type UpdateFaq, type BlogPost, type InsertBlogPost, type UpdateBlogPost } from "@shared/schema";
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

// In-memory storage with product caching
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private productsCache: Map<string, BokunProduct>;
  private cacheExpiry: Date | null;
  private lastRefreshAt: Date | null;
  private faqs: Map<number, Faq>;
  private faqIdCounter: number;
  private blogPosts: Map<number, BlogPost>;
  private blogPostIdCounter: number;

  constructor() {
    this.users = new Map();
    this.productsCache = new Map();
    this.cacheExpiry = null;
    this.lastRefreshAt = null;
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
