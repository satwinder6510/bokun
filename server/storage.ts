import { type User, type InsertUser, type BokunProduct, type Faq, type InsertFaq, type UpdateFaq, type BlogPost, type InsertBlogPost, type UpdateBlogPost, type CartItem, type InsertCartItem, type Booking, type InsertBooking, type FlightPackage, type InsertFlightPackage, type UpdateFlightPackage, type PackageEnquiry, type InsertPackageEnquiry, type TourEnquiry, type InsertTourEnquiry, type PackagePricing, type InsertPackagePricing, type Review, type InsertReview, type UpdateReview, type TrackingNumber, type InsertTrackingNumber, type UpdateTrackingNumber, type AdminUser, type InsertAdminUser, type UpdateAdminUser, type FlightTourPricingConfig, type InsertFlightTourPricingConfig, type UpdateFlightTourPricingConfig, type SiteSetting, type InsertSiteSetting, type UpdateSiteSetting, type Hotel, type InsertHotel, type ContentImage, type InsertContentImage, type PackageSeason, type InsertPackageSeason, type PricingExport, type InsertPricingExport, type BokunDeparture, type BokunDepartureRate, type BokunDepartureRateFlight, flightPackages, packageEnquiries, tourEnquiries, packagePricing, packageSeasons, pricingExports, reviews, trackingNumbers, adminUsers, flightTourPricingConfigs, siteSettings, blogPosts, hotels, contentImages, bokunDepartures, bokunDepartureRates, bokunDepartureRateFlights } from "@shared/schema";
import { type ParsedDeparture } from "./bokun";

// Extended rate type with flight pricing per airport
export interface RateWithFlights extends BokunDepartureRate {
  flights: BokunDepartureRateFlight[];
}

// Extended type for departures with their rates and flight pricing
export interface DepartureWithRates extends BokunDeparture {
  rates: RateWithFlights[];
}
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, asc, sql, and, inArray } from "drizzle-orm";

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
  getBlogPostsByDestination(destination: string): Promise<BlogPost[]>;
  getBlogPostById(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: UpdateBlogPost): Promise<BlogPost | undefined>;
  deleteBlogPost(id: number): Promise<boolean>;
  
  // Shopping cart methods
  getCartBySessionId(sessionId: string): Promise<CartItem[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  removeFromCart(id: number): Promise<boolean>;
  clearCart(sessionId: string): Promise<boolean>;
  getCartItemCount(sessionId: string): Promise<number>;
  
  // Booking methods
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookingByReference(reference: string): Promise<Booking | undefined>;
  updateBooking(id: number, updates: Partial<Booking>): Promise<Booking | undefined>;
  
  // Flight packages methods
  getPublishedFlightPackages(category?: string): Promise<FlightPackage[]>;
  getSpecialOfferPackages(limit?: number): Promise<FlightPackage[]>;
  getAllFlightPackages(): Promise<FlightPackage[]>;
  getFlightPackageById(id: number): Promise<FlightPackage | undefined>;
  getFlightPackageBySlug(slug: string): Promise<FlightPackage | undefined>;
  createFlightPackage(pkg: InsertFlightPackage): Promise<FlightPackage>;
  updateFlightPackage(id: number, pkg: UpdateFlightPackage): Promise<FlightPackage | undefined>;
  deleteFlightPackage(id: number): Promise<boolean>;
  getFlightPackageCategories(): Promise<string[]>;
  
  // Package enquiry methods
  createPackageEnquiry(enquiry: InsertPackageEnquiry): Promise<PackageEnquiry>;
  getAllPackageEnquiries(): Promise<PackageEnquiry[]>;
  updatePackageEnquiryStatus(id: number, status: string): Promise<PackageEnquiry | undefined>;
  
  // Tour enquiry methods
  createTourEnquiry(enquiry: InsertTourEnquiry): Promise<TourEnquiry>;
  getAllTourEnquiries(): Promise<TourEnquiry[]>;
  updateTourEnquiryStatus(id: number, status: string): Promise<TourEnquiry | undefined>;
  
  // Package pricing methods
  getPackagePricing(packageId: number): Promise<PackagePricing[]>;
  createPackagePricing(pricing: InsertPackagePricing): Promise<PackagePricing>;
  createPackagePricingBatch(pricings: InsertPackagePricing[]): Promise<PackagePricing[]>;
  deletePackagePricing(id: number): Promise<boolean>;
  deletePackagePricingByPackage(packageId: number): Promise<boolean>;
  
  // Package seasons methods
  getPackageSeasons(packageId: number): Promise<PackageSeason[]>;
  createPackageSeason(season: InsertPackageSeason): Promise<PackageSeason>;
  updatePackageSeason(id: number, season: Partial<InsertPackageSeason>): Promise<PackageSeason | undefined>;
  deletePackageSeason(id: number): Promise<boolean>;
  deletePackageSeasonsByPackage(packageId: number): Promise<boolean>;
  
  // Pricing export history methods
  getPricingExports(packageId: number): Promise<PricingExport[]>;
  createPricingExport(exportRecord: InsertPricingExport): Promise<PricingExport>;
  
  // Review methods
  getAllReviews(): Promise<Review[]>;
  getPublishedReviews(): Promise<Review[]>;
  getReviewById(id: number): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: number, review: UpdateReview): Promise<Review | undefined>;
  deleteReview(id: number): Promise<boolean>;
  
  // Tracking number methods (DNI) - simplified tag-based matching
  getAllTrackingNumbers(): Promise<TrackingNumber[]>;
  getActiveTrackingNumbers(): Promise<TrackingNumber[]>;
  getTrackingNumberById(id: number): Promise<TrackingNumber | undefined>;
  getTrackingNumberByTag(tag: string): Promise<TrackingNumber | undefined>;
  getDefaultTrackingNumber(): Promise<TrackingNumber | undefined>;
  createTrackingNumber(number: InsertTrackingNumber): Promise<TrackingNumber>;
  updateTrackingNumber(id: number, updates: UpdateTrackingNumber): Promise<TrackingNumber | undefined>;
  deleteTrackingNumber(id: number): Promise<boolean>;
  
  // Admin user methods (stored in PostgreSQL)
  getAllAdminUsers(): Promise<AdminUser[]>;
  getAdminUserById(id: number): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: number, updates: UpdateAdminUser): Promise<AdminUser | undefined>;
  deleteAdminUser(id: number): Promise<boolean>;
  updateAdminUserLastLogin(id: number): Promise<void>;
  
  // Flight tour pricing config methods
  getAllFlightTourPricingConfigs(): Promise<FlightTourPricingConfig[]>;
  getFlightTourPricingConfigByBokunId(bokunProductId: string): Promise<FlightTourPricingConfig | undefined>;
  createFlightTourPricingConfig(config: InsertFlightTourPricingConfig): Promise<FlightTourPricingConfig>;
  updateFlightTourPricingConfig(id: number, updates: UpdateFlightTourPricingConfig): Promise<FlightTourPricingConfig | undefined>;
  deleteFlightTourPricingConfig(id: number): Promise<boolean>;
  
  // Site settings methods
  getAllSiteSettings(): Promise<SiteSetting[]>;
  getSiteSettingByKey(key: string): Promise<SiteSetting | undefined>;
  getExchangeRate(): Promise<number>;
  upsertSiteSetting(key: string, value: string, label: string, description?: string): Promise<SiteSetting>;
  updateSiteSetting(key: string, value: string): Promise<SiteSetting | undefined>;
  
  // Hotel methods
  getAllHotels(): Promise<Hotel[]>;
  getHotelById(id: number): Promise<Hotel | undefined>;
  getHotelBySourceUrl(url: string): Promise<Hotel | undefined>;
  getHotelByName(name: string): Promise<Hotel | undefined>;
  createHotel(hotel: InsertHotel): Promise<Hotel>;
  updateHotel(id: number, updates: Partial<InsertHotel>): Promise<Hotel | undefined>;
  deleteHotel(id: number): Promise<boolean>;
  searchHotels(query: string): Promise<Hotel[]>;
  
  // Content images methods (for collections and destinations)
  getAllContentImages(): Promise<ContentImage[]>;
  getContentImagesByType(type: string): Promise<ContentImage[]>;
  getContentImage(type: string, name: string): Promise<ContentImage | undefined>;
  upsertContentImage(type: string, name: string, imageUrl: string): Promise<ContentImage>;
  deleteContentImage(id: number): Promise<boolean>;
  
  // Bokun departures methods
  syncBokunDepartures(packageId: number, bokunProductId: string, departures: ParsedDeparture[], durationNights?: number | null): Promise<{ departuresCount: number; ratesCount: number }>;
  getBokunDepartures(packageId: number): Promise<DepartureWithRates[]>;
  updateDepartureRateFlightPricing(rateId: number, flightPriceGbp: number, departureAirport: string, combinedPriceGbp?: number): Promise<BokunDepartureRate | undefined>;
  
  // Flight pricing per airport methods
  upsertDepartureRateFlight(rateId: number, airportCode: string, flightPriceGbp: number, combinedPriceGbp: number, markupApplied?: number, flightSource?: string): Promise<BokunDepartureRateFlight | undefined>;
  getDepartureRateFlights(rateIds: number[]): Promise<BokunDepartureRateFlight[]>;
  clearDepartureRateFlights(rateId: number): Promise<void>;
  
  // Auto-refresh methods for scheduled flight price updates
  getPackagesWithAutoRefresh(): Promise<FlightPackage[]>;
  updateFlightPackageRefreshTimestamp(id: number): Promise<void>;
  updateFlightPackageAutoRefreshConfig(id: number, config: { destinationAirport: string; departureAirports: string[]; markup: number; flightType?: "roundtrip" | "openjaw" }, enabled: boolean): Promise<void>;
  
  // Site settings helper
  getSiteSettings(): Promise<SiteSetting | null>;
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
  private cartItems: Map<number, CartItem>;
  private cartIdCounter: number;
  private bookings: Map<number, Booking>;
  private bookingIdCounter: number;

  constructor() {
    this.users = new Map();
    this.productsCacheByCurrency = new Map();
    this.cacheExpiryByCurrency = new Map();
    this.lastRefreshAtByCurrency = new Map();
    this.faqs = new Map();
    this.faqIdCounter = 1;
    this.blogPosts = new Map();
    this.blogPostIdCounter = 1;
    this.cartItems = new Map();
    this.cartIdCounter = 1;
    this.bookings = new Map();
    this.bookingIdCounter = 1;
    
    this.initializeSampleBlogPosts();
  }

  private initializeSampleBlogPosts() {
    const samplePosts: InsertBlogPost[] = [
      {
        title: "Top 10 Hidden Gems in Southeast Asia",
        slug: "top-10-hidden-gems-southeast-asia",
        content: `<p>Southeast Asia is renowned for its stunning beaches, vibrant cities, and rich cultural heritage. While places like Bangkok, Bali, and Singapore attract millions of visitors each year, the region is also home to countless hidden gems waiting to be discovered.</p>

<h2>1. Luang Prabang, Laos</h2>
<p>Nestled between the Mekong and Nam Khan rivers, Luang Prabang is a UNESCO World Heritage Site that combines French colonial architecture with traditional Lao culture. Wake up early to witness the alms-giving ceremony, where hundreds of Buddhist monks walk through the streets collecting offerings.</p>

<h2>2. Raja Ampat, Indonesia</h2>
<p>For diving enthusiasts, Raja Ampat offers some of the most biodiverse marine ecosystems on the planet. This remote archipelago in West Papua features crystal-clear waters, vibrant coral reefs, and over 1,500 species of fish.</p>

<h2>3. Hoi An, Vietnam</h2>
<p>This charming ancient town lights up at night with thousands of colorful lanterns. Explore the well-preserved architecture, take a cooking class, or have custom clothes tailored by local artisans.</p>

<h2>4. Pai, Thailand</h2>
<p>Escape the crowds in this laid-back mountain town in northern Thailand. Known for its hot springs, waterfalls, and stunning viewpoints, Pai attracts digital nomads and backpackers seeking tranquility.</p>

<h2>5. Kampot, Cambodia</h2>
<p>Famous for its world-class pepper, Kampot is a riverside town offering a glimpse into colonial Cambodia. Visit pepper farms, explore nearby Bokor National Park, or simply relax by the river.</p>

<p>These destinations offer authentic experiences away from mass tourism. Each location provides unique opportunities to connect with local cultures, enjoy pristine natural beauty, and create unforgettable memories.</p>`,
        excerpt: "Discover lesser-known destinations in Southeast Asia that offer authentic experiences, stunning natural beauty, and rich cultural encounters away from the tourist crowds.",
        metaTitle: "Top 10 Hidden Gems in Southeast Asia - Flights and Packages",
        metaDescription: "Explore Southeast Asia's best-kept secrets. From Luang Prabang to Raja Ampat, discover hidden destinations that offer authentic travel experiences.",
        featuredImage: null,
        author: "Flights and Packages",
        isPublished: true,
        publishedAt: new Date("2025-01-15T10:00:00Z"),
      },
      {
        title: "Ultimate Guide to Planning Your First African Safari",
        slug: "ultimate-guide-planning-first-african-safari",
        content: `<p>An African safari is a once-in-a-lifetime adventure that offers unparalleled wildlife encounters and breathtaking landscapes. Planning your first safari can feel overwhelming, but with the right preparation, you'll create memories that last forever.</p>

<h2>Choosing Your Destination</h2>
<p>Africa offers diverse safari experiences across different countries:</p>

<h3>Tanzania</h3>
<p>Home to the Serengeti and the annual wildebeest migration, Tanzania offers classic safari experiences. Visit Ngorongoro Crater for concentrated wildlife viewing in a stunning volcanic caldera.</p>

<h3>Kenya</h3>
<p>The Masai Mara is famous for its big cat populations and the spectacular river crossings during migration season. Amboseli National Park provides iconic views of elephants against Mount Kilimanjaro's backdrop.</p>

<h3>South Africa</h3>
<p>Kruger National Park combines excellent wildlife viewing with luxury lodges and accessibility. The country's well-developed infrastructure makes it ideal for first-time safari-goers.</p>

<h2>Best Time to Visit</h2>
<p>The dry season (June to October) typically offers the best wildlife viewing as animals congregate around water sources. However, the wet season brings lush landscapes, baby animals, and fewer tourists.</p>

<h2>What to Pack</h2>
<ul>
<li>Neutral-colored clothing (khaki, beige, olive) to blend with the environment</li>
<li>Wide-brimmed hat and sunglasses for sun protection</li>
<li>Binoculars for distant wildlife viewing</li>
<li>Camera with telephoto lens</li>
<li>Insect repellent and sunscreen</li>
<li>Light jacket for early morning game drives</li>
</ul>

<h2>Safari Etiquette</h2>
<p>Respect wildlife by maintaining safe distances, staying quiet during sightings, and following your guide's instructions. Never feed animals or leave the vehicle unless permitted.</p>

<p>An African safari offers transformative experiences that connect you with nature in profound ways. Start planning your adventure today!</p>`,
        excerpt: "Everything you need to know to plan your first African safari, from choosing destinations and timing your visit to packing essentials and safari etiquette.",
        metaTitle: "Ultimate African Safari Planning Guide - First-Timer Tips",
        metaDescription: "Plan your dream African safari with our comprehensive guide. Learn about top destinations, best times to visit, what to pack, and essential safari tips.",
        featuredImage: null,
        author: "Flights and Packages",
        isPublished: true,
        publishedAt: new Date("2025-01-10T14:00:00Z"),
      },
      {
        title: "5 Essential Travel Photography Tips for Beginners",
        slug: "5-essential-travel-photography-tips-beginners",
        content: `<p>Capturing your travel experiences through photography allows you to preserve memories and share your adventures with others. Whether you're using a smartphone or a professional camera, these essential tips will help you take better travel photos.</p>

<h2>1. Wake Up Early, Stay Out Late</h2>
<p>The golden hours—shortly after sunrise and before sunset—provide the most flattering natural light. Soft, warm light during these times adds depth and drama to your photos while avoiding harsh midday shadows.</p>

<h2>2. Tell a Story</h2>
<p>Great travel photography goes beyond pretty landscapes. Include people, local culture, and details that convey the essence of a place. Capture street vendors, traditional ceremonies, architectural details, and everyday moments that reveal the destination's character.</p>

<h2>3. Use the Rule of Thirds</h2>
<p>Instead of centering your subject, imagine your frame divided into nine equal sections by two horizontal and two vertical lines. Place important elements along these lines or at their intersections for more dynamic, visually interesting compositions.</p>

<h2>4. Get Closer to Your Subject</h2>
<p>Don't be afraid to move closer or use your zoom lens. Fill the frame with your subject to eliminate distracting backgrounds and create more intimate, impactful images. This is especially effective for portraits and detail shots.</p>

<h2>5. Be Respectful and Ask Permission</h2>
<p>When photographing people, especially in unfamiliar cultures, always ask permission first. A smile and friendly gesture often transcend language barriers. Respect those who decline and be mindful of sacred or sensitive locations.</p>

<h3>Bonus Tips</h3>
<ul>
<li>Shoot in RAW format for maximum editing flexibility</li>
<li>Carry extra batteries and memory cards</li>
<li>Clean your lens regularly</li>
<li>Learn your camera's settings before your trip</li>
<li>Look for unique perspectives and angles</li>
</ul>

<p>Remember, the best camera is the one you have with you. Focus on capturing authentic moments and enjoying your travels—the technical skills will develop over time.</p>`,
        excerpt: "Improve your travel photography with these five essential tips for beginners. Learn about lighting, composition, storytelling, and respectful photography practices.",
        metaTitle: "5 Essential Travel Photography Tips for Beginners",
        metaDescription: "Master travel photography basics with these beginner-friendly tips. Learn composition techniques, lighting secrets, and how to capture authentic moments.",
        featuredImage: null,
        author: "Flights and Packages",
        isPublished: true,
        publishedAt: new Date("2025-01-05T09:00:00Z"),
      },
    ];

    samplePosts.forEach(post => {
      const id = this.blogPostIdCounter++;
      const now = new Date();
      const blogPost: BlogPost = {
        id,
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt,
        metaTitle: post.metaTitle ?? null,
        metaDescription: post.metaDescription ?? null,
        featuredImage: post.featuredImage ?? null,
        author: post.author ?? "Flights and Packages",
        isPublished: post.isPublished ?? false,
        publishedAt: post.publishedAt ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.blogPosts.set(id, blogPost);
    });
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

  // Blog post methods (database-backed)
  async getAllBlogPosts(): Promise<BlogPost[]> {
    try {
      return await db.select().from(blogPosts)
        .orderBy(
          sql`CASE WHEN ${blogPosts.featuredImage} IS NOT NULL AND ${blogPosts.featuredImage} != '' THEN 0 ELSE 1 END`,
          desc(blogPosts.publishedAt),
          desc(blogPosts.createdAt)
        );
    } catch (error) {
      console.error("Error fetching all blog posts:", error);
      return [];
    }
  }

  async getPublishedBlogPosts(): Promise<BlogPost[]> {
    try {
      return await db.select().from(blogPosts)
        .where(eq(blogPosts.isPublished, true))
        .orderBy(
          sql`CASE WHEN ${blogPosts.featuredImage} IS NOT NULL AND ${blogPosts.featuredImage} != '' THEN 0 ELSE 1 END`,
          desc(blogPosts.publishedAt),
          desc(blogPosts.createdAt)
        );
    } catch (error) {
      console.error("Error fetching published blog posts:", error);
      return [];
    }
  }

  async getBlogPostsByDestination(destination: string): Promise<BlogPost[]> {
    try {
      return await db.select().from(blogPosts)
        .where(and(
          eq(blogPosts.isPublished, true),
          sql`LOWER(${blogPosts.destination}) = LOWER(${destination})`
        ))
        .orderBy(
          sql`CASE WHEN ${blogPosts.featuredImage} IS NOT NULL AND ${blogPosts.featuredImage} != '' THEN 0 ELSE 1 END`,
          desc(blogPosts.publishedAt),
          desc(blogPosts.createdAt)
        );
    } catch (error) {
      console.error("Error fetching blog posts by destination:", error);
      return [];
    }
  }

  async getBlogPostById(id: number): Promise<BlogPost | undefined> {
    try {
      const results = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching blog post by ID:", error);
      return undefined;
    }
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    try {
      const results = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching blog post by slug:", error);
      return undefined;
    }
  }

  async createBlogPost(insertPost: InsertBlogPost): Promise<BlogPost> {
    try {
      const results = await db.insert(blogPosts).values({
        ...insertPost,
        publishedAt: insertPost.publishedAt ?? (insertPost.isPublished ? new Date() : null),
      }).returning();
      return results[0];
    } catch (error) {
      console.error("Error creating blog post:", error);
      throw error;
    }
  }

  async updateBlogPost(id: number, updatePost: UpdateBlogPost): Promise<BlogPost | undefined> {
    try {
      const results = await db.update(blogPosts)
        .set({ ...updatePost, updatedAt: new Date() })
        .where(eq(blogPosts.id, id))
        .returning();
      return results[0];
    } catch (error) {
      console.error("Error updating blog post:", error);
      return undefined;
    }
  }

  async deleteBlogPost(id: number): Promise<boolean> {
    try {
      const result = await db.delete(blogPosts).where(eq(blogPosts.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting blog post:", error);
      return false;
    }
  }

  // Shopping cart methods
  async getCartBySessionId(sessionId: string): Promise<CartItem[]> {
    return Array.from(this.cartItems.values())
      .filter(item => item.sessionId === sessionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async addToCart(insertItem: InsertCartItem): Promise<CartItem> {
    const id = this.cartIdCounter++;
    const now = new Date();
    const item: CartItem = {
      id,
      sessionId: insertItem.sessionId,
      productId: insertItem.productId,
      productTitle: insertItem.productTitle,
      productPrice: insertItem.productPrice,
      currency: insertItem.currency || 'GBP',
      quantity: insertItem.quantity || 1,
      productData: insertItem.productData,
      createdAt: now,
    };
    this.cartItems.set(id, item);
    return item;
  }

  async removeFromCart(id: number): Promise<boolean> {
    return this.cartItems.delete(id);
  }

  async clearCart(sessionId: string): Promise<boolean> {
    const itemsToDelete = Array.from(this.cartItems.entries())
      .filter(([_, item]) => item.sessionId === sessionId)
      .map(([id]) => id);
    
    itemsToDelete.forEach(id => this.cartItems.delete(id));
    return itemsToDelete.length > 0;
  }

  async getCartItemCount(sessionId: string): Promise<number> {
    return Array.from(this.cartItems.values())
      .filter(item => item.sessionId === sessionId)
      .length; // Count distinct cart items, not sum of quantities
  }

  // Booking methods
  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = this.bookingIdCounter++;
    const now = new Date();
    const booking: Booking = {
      id,
      bookingReference: insertBooking.bookingReference,
      sessionId: insertBooking.sessionId,
      customerFirstName: insertBooking.customerFirstName,
      customerLastName: insertBooking.customerLastName,
      customerEmail: insertBooking.customerEmail,
      customerPhone: insertBooking.customerPhone,
      productId: insertBooking.productId,
      productTitle: insertBooking.productTitle,
      productPrice: insertBooking.productPrice,
      currency: insertBooking.currency || 'GBP',
      bokunBookingId: insertBooking.bokunBookingId ?? null,
      bokunReservationId: insertBooking.bokunReservationId ?? null,
      stripePaymentIntentId: insertBooking.stripePaymentIntentId ?? null,
      stripeChargeId: insertBooking.stripeChargeId ?? null,
      paymentStatus: insertBooking.paymentStatus || 'pending',
      totalAmount: insertBooking.totalAmount,
      bookingStatus: insertBooking.bookingStatus || 'pending',
      bookingData: insertBooking.bookingData ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async getBookingByReference(reference: string): Promise<Booking | undefined> {
    return Array.from(this.bookings.values()).find(booking => booking.bookingReference === reference);
  }

  async updateBooking(id: number, updates: Partial<Booking>): Promise<Booking | undefined> {
    const existing = this.bookings.get(id);
    if (!existing) return undefined;

    const updated: Booking = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.bookings.set(id, updated);
    return updated;
  }

  // Flight packages methods (using database)
  async getPublishedFlightPackages(category?: string): Promise<FlightPackage[]> {
    try {
      let query = db.select().from(flightPackages)
        .where(eq(flightPackages.isPublished, true))
        .orderBy(asc(flightPackages.displayOrder), desc(flightPackages.createdAt));
      
      const results = await query;
      
      if (category) {
        return results.filter(pkg => pkg.category === category);
      }
      
      return results;
    } catch (error) {
      console.error("Error fetching published packages:", error);
      return [];
    }
  }

  async getSpecialOfferPackages(limit?: number): Promise<FlightPackage[]> {
    try {
      const query = db.select().from(flightPackages)
        .where(and(
          eq(flightPackages.isPublished, true),
          eq(flightPackages.isSpecialOffer, true)
        ))
        .orderBy(asc(flightPackages.displayOrder), desc(flightPackages.createdAt));
      
      const results = await query;
      return limit ? results.slice(0, limit) : results;
    } catch (error) {
      console.error("Error fetching special offer packages:", error);
      return [];
    }
  }

  async getAllFlightPackages(): Promise<FlightPackage[]> {
    try {
      return await db.select().from(flightPackages)
        .orderBy(asc(flightPackages.displayOrder), desc(flightPackages.createdAt));
    } catch (error) {
      console.error("Error fetching all packages:", error);
      return [];
    }
  }

  async getFlightPackageById(id: number): Promise<FlightPackage | undefined> {
    try {
      const results = await db.select().from(flightPackages)
        .where(eq(flightPackages.id, id))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching package by id:", error);
      return undefined;
    }
  }

  async getFlightPackageBySlug(slug: string): Promise<FlightPackage | undefined> {
    try {
      const results = await db.select().from(flightPackages)
        .where(eq(flightPackages.slug, slug))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching package by slug:", error);
      return undefined;
    }
  }

  async createFlightPackage(pkg: InsertFlightPackage): Promise<FlightPackage> {
    const [created] = await db.insert(flightPackages).values(pkg).returning();
    return created;
  }

  async updateFlightPackage(id: number, updates: UpdateFlightPackage): Promise<FlightPackage | undefined> {
    const updateData: Record<string, any> = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(flightPackages)
      .set(updateData)
      .where(eq(flightPackages.id, id))
      .returning();
    return updated;
  }

  async deleteFlightPackage(id: number): Promise<boolean> {
    const result = await db.delete(flightPackages)
      .where(eq(flightPackages.id, id));
    return true;
  }

  async getFlightPackageCategories(): Promise<string[]> {
    try {
      const results = await db.selectDistinct({ category: flightPackages.category })
        .from(flightPackages)
        .where(eq(flightPackages.isPublished, true));
      return results.map(r => r.category);
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  }

  // Package enquiry methods
  async createPackageEnquiry(enquiry: InsertPackageEnquiry): Promise<PackageEnquiry> {
    const [created] = await db.insert(packageEnquiries).values({
      ...enquiry,
      createdAt: new Date(),
    }).returning();
    return created;
  }

  async getAllPackageEnquiries(): Promise<PackageEnquiry[]> {
    try {
      return await db.select().from(packageEnquiries)
        .orderBy(desc(packageEnquiries.createdAt));
    } catch (error) {
      console.error("Error fetching enquiries:", error);
      return [];
    }
  }

  async updatePackageEnquiryStatus(id: number, status: string): Promise<PackageEnquiry | undefined> {
    const [updated] = await db.update(packageEnquiries)
      .set({ status })
      .where(eq(packageEnquiries.id, id))
      .returning();
    return updated;
  }

  // Tour enquiry methods
  async createTourEnquiry(enquiry: InsertTourEnquiry): Promise<TourEnquiry> {
    const [created] = await db.insert(tourEnquiries).values({
      ...enquiry,
      createdAt: new Date(),
    }).returning();
    return created;
  }

  async getAllTourEnquiries(): Promise<TourEnquiry[]> {
    try {
      return await db.select().from(tourEnquiries)
        .orderBy(desc(tourEnquiries.createdAt));
    } catch (error) {
      console.error("Error fetching tour enquiries:", error);
      return [];
    }
  }

  async updateTourEnquiryStatus(id: number, status: string): Promise<TourEnquiry | undefined> {
    const [updated] = await db.update(tourEnquiries)
      .set({ status })
      .where(eq(tourEnquiries.id, id))
      .returning();
    return updated;
  }

  // Package pricing methods
  async getPackagePricing(packageId: number): Promise<PackagePricing[]> {
    try {
      return await db.select().from(packagePricing)
        .where(eq(packagePricing.packageId, packageId))
        .orderBy(asc(packagePricing.departureDate));
    } catch (error) {
      console.error("Error fetching package pricing:", error);
      return [];
    }
  }

  async createPackagePricing(pricing: InsertPackagePricing): Promise<PackagePricing> {
    const [created] = await db.insert(packagePricing).values(pricing).returning();
    return created;
  }

  async createPackagePricingBatch(pricings: InsertPackagePricing[]): Promise<PackagePricing[]> {
    if (pricings.length === 0) return [];
    const created = await db.insert(packagePricing).values(pricings).returning();
    return created;
  }

  async deletePackagePricing(id: number): Promise<boolean> {
    await db.delete(packagePricing).where(eq(packagePricing.id, id));
    return true;
  }

  async deletePackagePricingByPackage(packageId: number): Promise<boolean> {
    await db.delete(packagePricing).where(eq(packagePricing.packageId, packageId));
    return true;
  }

  // Package seasons methods
  async getPackageSeasons(packageId: number): Promise<PackageSeason[]> {
    try {
      return await db.select().from(packageSeasons)
        .where(eq(packageSeasons.packageId, packageId))
        .orderBy(asc(packageSeasons.startDate));
    } catch (error) {
      console.error("Error fetching package seasons:", error);
      return [];
    }
  }

  async createPackageSeason(season: InsertPackageSeason): Promise<PackageSeason> {
    const [created] = await db.insert(packageSeasons).values(season).returning();
    return created;
  }

  async updatePackageSeason(id: number, season: Partial<InsertPackageSeason>): Promise<PackageSeason | undefined> {
    const [updated] = await db.update(packageSeasons)
      .set({ ...season, updatedAt: new Date() })
      .where(eq(packageSeasons.id, id))
      .returning();
    return updated;
  }

  async deletePackageSeason(id: number): Promise<boolean> {
    await db.delete(packageSeasons).where(eq(packageSeasons.id, id));
    return true;
  }

  async deletePackageSeasonsByPackage(packageId: number): Promise<boolean> {
    await db.delete(packageSeasons).where(eq(packageSeasons.packageId, packageId));
    return true;
  }

  // Pricing export history methods
  async getPricingExports(packageId: number): Promise<PricingExport[]> {
    try {
      return await db.select().from(pricingExports)
        .where(eq(pricingExports.packageId, packageId))
        .orderBy(desc(pricingExports.createdAt));
    } catch (error) {
      console.error("Error fetching pricing exports:", error);
      return [];
    }
  }

  async createPricingExport(exportRecord: InsertPricingExport): Promise<PricingExport> {
    const [created] = await db.insert(pricingExports).values(exportRecord).returning();
    return created;
  }

  // Review methods
  async getAllReviews(): Promise<Review[]> {
    try {
      return await db.select().from(reviews)
        .orderBy(asc(reviews.displayOrder), desc(reviews.createdAt));
    } catch (error) {
      console.error("Error fetching all reviews:", error);
      return [];
    }
  }

  async getPublishedReviews(): Promise<Review[]> {
    try {
      return await db.select().from(reviews)
        .where(eq(reviews.isPublished, true))
        .orderBy(asc(reviews.displayOrder), desc(reviews.createdAt));
    } catch (error) {
      console.error("Error fetching published reviews:", error);
      return [];
    }
  }

  async getReviewById(id: number): Promise<Review | undefined> {
    try {
      const results = await db.select().from(reviews)
        .where(eq(reviews.id, id))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching review by id:", error);
      return undefined;
    }
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values({
      ...review,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateReview(id: number, updates: UpdateReview): Promise<Review | undefined> {
    const [updated] = await db.update(reviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning();
    return updated;
  }

  async deleteReview(id: number): Promise<boolean> {
    await db.delete(reviews).where(eq(reviews.id, id));
    return true;
  }

  // Tracking number methods (DNI) - simplified tag-based matching
  async getAllTrackingNumbers(): Promise<TrackingNumber[]> {
    try {
      return await db.select().from(trackingNumbers)
        .orderBy(desc(trackingNumbers.createdAt));
    } catch (error) {
      console.error("Error fetching all tracking numbers:", error);
      return [];
    }
  }

  async getActiveTrackingNumbers(): Promise<TrackingNumber[]> {
    try {
      return await db.select().from(trackingNumbers)
        .where(eq(trackingNumbers.isActive, true))
        .orderBy(desc(trackingNumbers.createdAt));
    } catch (error) {
      console.error("Error fetching active tracking numbers:", error);
      return [];
    }
  }

  async getTrackingNumberById(id: number): Promise<TrackingNumber | undefined> {
    try {
      const results = await db.select().from(trackingNumbers)
        .where(eq(trackingNumbers.id, id))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching tracking number by id:", error);
      return undefined;
    }
  }

  async getTrackingNumberByTag(tag: string): Promise<TrackingNumber | undefined> {
    try {
      // Find active tracking number with matching tag
      const results = await db.select().from(trackingNumbers)
        .where(and(
          eq(trackingNumbers.tag, tag),
          eq(trackingNumbers.isActive, true)
        ))
        .limit(1);
      
      if (results[0]) {
        return results[0];
      }
      
      // Fall back to default
      return this.getDefaultTrackingNumber();
    } catch (error) {
      console.error("Error finding tracking number by tag:", error);
      return this.getDefaultTrackingNumber();
    }
  }

  async getDefaultTrackingNumber(): Promise<TrackingNumber | undefined> {
    try {
      const results = await db.select().from(trackingNumbers)
        .where(eq(trackingNumbers.isDefault, true))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching default tracking number:", error);
      return undefined;
    }
  }

  async createTrackingNumber(number: InsertTrackingNumber): Promise<TrackingNumber> {
    // If this is marked as default, unset any existing default
    if (number.isDefault) {
      await db.update(trackingNumbers)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(trackingNumbers.isDefault, true));
    }
    
    const [created] = await db.insert(trackingNumbers).values({
      ...number,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateTrackingNumber(id: number, updates: UpdateTrackingNumber): Promise<TrackingNumber | undefined> {
    // If setting as default, unset any existing default
    if (updates.isDefault) {
      await db.update(trackingNumbers)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(trackingNumbers.isDefault, true));
    }
    
    const [updated] = await db.update(trackingNumbers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(trackingNumbers.id, id))
      .returning();
    return updated;
  }

  async deleteTrackingNumber(id: number): Promise<boolean> {
    await db.delete(trackingNumbers).where(eq(trackingNumbers.id, id));
    return true;
  }

  // Admin User methods (stored in PostgreSQL)
  async getAllAdminUsers(): Promise<AdminUser[]> {
    try {
      const results = await db.select().from(adminUsers).orderBy(asc(adminUsers.fullName));
      return results;
    } catch (error) {
      console.error("Error fetching admin users:", error);
      return [];
    }
  }

  async getAdminUserById(id: number): Promise<AdminUser | undefined> {
    try {
      const results = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
      return results[0];
    } catch (error) {
      console.error("Error fetching admin user:", error);
      return undefined;
    }
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    try {
      const results = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase()));
      return results[0];
    } catch (error) {
      console.error("Error fetching admin user by email:", error);
      return undefined;
    }
  }

  async createAdminUser(user: InsertAdminUser): Promise<AdminUser> {
    const [created] = await db.insert(adminUsers).values({
      ...user,
      email: user.email.toLowerCase(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateAdminUser(id: number, updates: UpdateAdminUser): Promise<AdminUser | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.email) {
      updateData.email = updates.email.toLowerCase();
    }
    
    const [updated] = await db.update(adminUsers)
      .set(updateData)
      .where(eq(adminUsers.id, id))
      .returning();
    return updated;
  }

  async deleteAdminUser(id: number): Promise<boolean> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
    return true;
  }

  async updateAdminUserLastLogin(id: number): Promise<void> {
    try {
      await db.update(adminUsers)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(adminUsers.id, id));
    } catch (error) {
      console.error("Error updating last login:", error);
    }
  }
  
  // Flight Tour Pricing Config methods (stored in PostgreSQL)
  async getAllFlightTourPricingConfigs(): Promise<FlightTourPricingConfig[]> {
    try {
      const results = await db.select().from(flightTourPricingConfigs).orderBy(desc(flightTourPricingConfigs.createdAt));
      return results;
    } catch (error) {
      console.error("Error fetching flight tour pricing configs:", error);
      return [];
    }
  }

  async getFlightTourPricingConfigByBokunId(bokunProductId: string): Promise<FlightTourPricingConfig | undefined> {
    try {
      const results = await db.select().from(flightTourPricingConfigs)
        .where(eq(flightTourPricingConfigs.bokunProductId, bokunProductId));
      return results[0];
    } catch (error) {
      console.error("Error fetching flight tour pricing config:", error);
      return undefined;
    }
  }

  async createFlightTourPricingConfig(config: InsertFlightTourPricingConfig): Promise<FlightTourPricingConfig> {
    const [created] = await db.insert(flightTourPricingConfigs).values({
      ...config,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateFlightTourPricingConfig(id: number, updates: UpdateFlightTourPricingConfig): Promise<FlightTourPricingConfig | undefined> {
    const [updated] = await db.update(flightTourPricingConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(flightTourPricingConfigs.id, id))
      .returning();
    return updated;
  }

  async deleteFlightTourPricingConfig(id: number): Promise<boolean> {
    await db.delete(flightTourPricingConfigs).where(eq(flightTourPricingConfigs.id, id));
    return true;
  }
  
  // Site Settings methods (stored in PostgreSQL)
  async getAllSiteSettings(): Promise<SiteSetting[]> {
    try {
      const results = await db.select().from(siteSettings);
      return results;
    } catch (error) {
      console.error("Error fetching site settings:", error);
      return [];
    }
  }

  async getSiteSettingByKey(key: string): Promise<SiteSetting | undefined> {
    try {
      const results = await db.select().from(siteSettings)
        .where(eq(siteSettings.key, key));
      return results[0];
    } catch (error) {
      console.error("Error fetching site setting:", error);
      return undefined;
    }
  }

  async getExchangeRate(): Promise<number> {
    const setting = await this.getSiteSettingByKey("usd_to_gbp_rate");
    if (setting) {
      const rate = parseFloat(setting.value);
      if (!isNaN(rate) && rate > 0) {
        return rate;
      }
    }
    // Default rate if not set
    return 0.79;
  }

  async upsertSiteSetting(key: string, value: string, label: string, description?: string): Promise<SiteSetting> {
    const existing = await this.getSiteSettingByKey(key);
    if (existing) {
      const [updated] = await db.update(siteSettings)
        .set({ value, label, description, updatedAt: new Date() })
        .where(eq(siteSettings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(siteSettings).values({
        key,
        value,
        label,
        description,
      }).returning();
      return created;
    }
  }

  async updateSiteSetting(key: string, value: string): Promise<SiteSetting | undefined> {
    try {
      const [updated] = await db.update(siteSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(siteSettings.key, key))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating site setting:", error);
      return undefined;
    }
  }
  
  // Hotel methods (stored in PostgreSQL)
  async getAllHotels(): Promise<Hotel[]> {
    try {
      return await db.select().from(hotels)
        .where(eq(hotels.isActive, true))
        .orderBy(desc(hotels.createdAt));
    } catch (error) {
      console.error("Error fetching hotels:", error);
      return [];
    }
  }
  
  async getHotelById(id: number): Promise<Hotel | undefined> {
    try {
      const results = await db.select().from(hotels)
        .where(eq(hotels.id, id))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching hotel by id:", error);
      return undefined;
    }
  }
  
  async getHotelBySourceUrl(url: string): Promise<Hotel | undefined> {
    try {
      const results = await db.select().from(hotels)
        .where(eq(hotels.sourceUrl, url))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching hotel by source URL:", error);
      return undefined;
    }
  }
  
  async getHotelByName(name: string): Promise<Hotel | undefined> {
    try {
      const results = await db.select().from(hotels)
        .where(eq(hotels.name, name))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error("Error fetching hotel by name:", error);
      return undefined;
    }
  }
  
  async createHotel(hotel: InsertHotel): Promise<Hotel> {
    const [created] = await db.insert(hotels).values(hotel).returning();
    return created;
  }
  
  async updateHotel(id: number, updates: Partial<InsertHotel>): Promise<Hotel | undefined> {
    try {
      const [updated] = await db.update(hotels)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(hotels.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating hotel:", error);
      return undefined;
    }
  }
  
  async deleteHotel(id: number): Promise<boolean> {
    try {
      await db.delete(hotels).where(eq(hotels.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting hotel:", error);
      return false;
    }
  }
  
  async searchHotels(query: string): Promise<Hotel[]> {
    try {
      const searchPattern = `%${query.toLowerCase()}%`;
      return await db.select().from(hotels)
        .where(sql`${hotels.isActive} = true AND (LOWER(${hotels.name}) LIKE ${searchPattern} OR LOWER(${hotels.city}) LIKE ${searchPattern} OR LOWER(${hotels.country}) LIKE ${searchPattern})`)
        .orderBy(desc(hotels.createdAt))
        .limit(50);
    } catch (error) {
      console.error("Error searching hotels:", error);
      return [];
    }
  }
  
  // Content images methods
  async getAllContentImages(): Promise<ContentImage[]> {
    try {
      return await db.select().from(contentImages).orderBy(asc(contentImages.type), asc(contentImages.name));
    } catch (error) {
      console.error("Error getting content images:", error);
      return [];
    }
  }
  
  async getContentImagesByType(type: string): Promise<ContentImage[]> {
    try {
      return await db.select().from(contentImages)
        .where(eq(contentImages.type, type))
        .orderBy(asc(contentImages.name));
    } catch (error) {
      console.error("Error getting content images by type:", error);
      return [];
    }
  }
  
  async getContentImage(type: string, name: string): Promise<ContentImage | undefined> {
    try {
      const [image] = await db.select().from(contentImages)
        .where(and(eq(contentImages.type, type), eq(contentImages.name, name)));
      return image;
    } catch (error) {
      console.error("Error getting content image:", error);
      return undefined;
    }
  }
  
  async upsertContentImage(type: string, name: string, imageUrl: string): Promise<ContentImage> {
    try {
      const existing = await this.getContentImage(type, name);
      if (existing) {
        const [updated] = await db.update(contentImages)
          .set({ imageUrl, updatedAt: new Date() })
          .where(eq(contentImages.id, existing.id))
          .returning();
        return updated;
      } else {
        const [created] = await db.insert(contentImages)
          .values({ type, name, imageUrl })
          .returning();
        return created;
      }
    } catch (error) {
      console.error("Error upserting content image:", error);
      throw error;
    }
  }
  
  async deleteContentImage(id: number): Promise<boolean> {
    try {
      await db.delete(contentImages).where(eq(contentImages.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting content image:", error);
      return false;
    }
  }
  
  // Bokun departures methods
  async syncBokunDepartures(packageId: number, bokunProductId: string, departures: ParsedDeparture[], durationNights: number | null = null): Promise<{ departuresCount: number; ratesCount: number }> {
    try {
      // Delete existing departures for this package (cascade deletes rates)
      await db.delete(bokunDepartures).where(eq(bokunDepartures.packageId, packageId));
      
      let departuresCount = 0;
      let ratesCount = 0;
      
      for (const departure of departures) {
        // Insert departure with duration from Bokun product
        const [insertedDeparture] = await db.insert(bokunDepartures).values({
          packageId,
          bokunProductId,
          durationNights, // Extracted from Bokun product details
          departureDate: departure.departureDate,
          startTime: departure.startTime,
          totalCapacity: departure.totalCapacity,
          availableSpots: departure.availableSpots,
          isSoldOut: departure.isSoldOut,
        }).returning();
        
        departuresCount++;
        
        // Insert rates for this departure
        for (const rate of departure.rates) {
          await db.insert(bokunDepartureRates).values({
            departureId: insertedDeparture.id,
            rateId: rate.rateId,
            rateTitle: rate.rateTitle,
            pricingCategoryId: rate.pricingCategoryId,
            roomCategory: rate.roomCategory,
            hotelCategory: rate.hotelCategory,
            minPerBooking: rate.minPerBooking,
            maxPerBooking: rate.maxPerBooking,
            originalPrice: rate.originalPrice,
            originalCurrency: rate.originalCurrency,
            priceGbp: rate.priceGbp,
            availableForRate: rate.availableForRate,
          });
          ratesCount++;
        }
      }
      
      console.log(`[Storage] Synced ${departuresCount} departures with ${ratesCount} rates for package ${packageId}`);
      return { departuresCount, ratesCount };
    } catch (error) {
      console.error("Error syncing Bokun departures:", error);
      throw error;
    }
  }
  
  async getBokunDepartures(packageId: number): Promise<DepartureWithRates[]> {
    try {
      // Get all departures for this package
      const departureRows = await db.select().from(bokunDepartures)
        .where(eq(bokunDepartures.packageId, packageId))
        .orderBy(asc(bokunDepartures.departureDate));
      
      // Get all rates for these departures
      const departureIds = departureRows.map(d => d.id);
      if (departureIds.length === 0) {
        return [];
      }
      
      const rateRows = await db.select().from(bokunDepartureRates)
        .orderBy(asc(bokunDepartureRates.departureId));
      
      // Filter rates for these departures and get their IDs
      const filteredRates = rateRows.filter(rate => departureIds.includes(rate.departureId));
      const rateIds = filteredRates.map(r => r.id);
      
      // Get all flight pricing data for these rates
      let flightRows: BokunDepartureRateFlight[] = [];
      if (rateIds.length > 0) {
        flightRows = await db.select().from(bokunDepartureRateFlights)
          .where(inArray(bokunDepartureRateFlights.rateId, rateIds));
      }
      
      // Group flights by rate ID
      const flightsByRate = new Map<number, BokunDepartureRateFlight[]>();
      for (const flight of flightRows) {
        if (!flightsByRate.has(flight.rateId)) {
          flightsByRate.set(flight.rateId, []);
        }
        flightsByRate.get(flight.rateId)!.push(flight);
      }
      
      // Group rates by departure, including flight data
      const ratesByDeparture = new Map<number, RateWithFlights[]>();
      for (const rate of filteredRates) {
        if (!ratesByDeparture.has(rate.departureId)) {
          ratesByDeparture.set(rate.departureId, []);
        }
        ratesByDeparture.get(rate.departureId)!.push({
          ...rate,
          flights: flightsByRate.get(rate.id) || [],
        });
      }
      
      // Combine departures with their rates and flights
      const result: DepartureWithRates[] = departureRows.map(departure => ({
        ...departure,
        rates: ratesByDeparture.get(departure.id) || [],
      }));
      
      return result;
    } catch (error) {
      console.error("Error getting Bokun departures:", error);
      return [];
    }
  }
  
  async updateDepartureRateFlightPricing(rateId: number, flightPriceGbp: number, departureAirport: string, providedCombinedPrice?: number): Promise<BokunDepartureRate | undefined> {
    try {
      // Get the current rate to calculate combined price if not provided
      const [existingRate] = await db.select().from(bokunDepartureRates)
        .where(eq(bokunDepartureRates.id, rateId));
      
      if (!existingRate) {
        return undefined;
      }
      
      // Use provided combined price or calculate it
      const combinedPriceGbp = providedCombinedPrice ?? Math.round((existingRate.priceGbp + flightPriceGbp) * 100) / 100;
      
      const [updated] = await db.update(bokunDepartureRates)
        .set({ 
          flightPriceGbp, 
          departureAirport,
          combinedPriceGbp
        })
        .where(eq(bokunDepartureRates.id, rateId))
        .returning();
      
      return updated;
    } catch (error) {
      console.error("Error updating departure rate flight pricing:", error);
      return undefined;
    }
  }
  
  async upsertDepartureRateFlight(
    rateId: number, 
    airportCode: string, 
    flightPriceGbp: number, 
    combinedPriceGbp: number, 
    markupApplied?: number, 
    flightSource?: string
  ): Promise<BokunDepartureRateFlight | undefined> {
    try {
      // Check if this rate/airport combination already exists
      const [existing] = await db.select().from(bokunDepartureRateFlights)
        .where(and(
          eq(bokunDepartureRateFlights.rateId, rateId),
          eq(bokunDepartureRateFlights.airportCode, airportCode)
        ));
      
      if (existing) {
        // Update existing record
        const [updated] = await db.update(bokunDepartureRateFlights)
          .set({
            flightPriceGbp,
            combinedPriceGbp,
            markupApplied: markupApplied ?? 0,
            flightSource: flightSource ?? "serp",
            fetchedAt: new Date()
          })
          .where(eq(bokunDepartureRateFlights.id, existing.id))
          .returning();
        return updated;
      } else {
        // Insert new record
        const [inserted] = await db.insert(bokunDepartureRateFlights)
          .values({
            rateId,
            airportCode,
            flightPriceGbp,
            combinedPriceGbp,
            markupApplied: markupApplied ?? 0,
            flightSource: flightSource ?? "serp"
          })
          .returning();
        return inserted;
      }
    } catch (error) {
      console.error("Error upserting departure rate flight:", error);
      return undefined;
    }
  }
  
  async getDepartureRateFlights(rateIds: number[]): Promise<BokunDepartureRateFlight[]> {
    try {
      if (rateIds.length === 0) return [];
      
      const flights = await db.select().from(bokunDepartureRateFlights)
        .where(inArray(bokunDepartureRateFlights.rateId, rateIds));
      
      return flights;
    } catch (error) {
      console.error("Error getting departure rate flights:", error);
      return [];
    }
  }
  
  async clearDepartureRateFlights(rateId: number): Promise<void> {
    try {
      await db.delete(bokunDepartureRateFlights)
        .where(eq(bokunDepartureRateFlights.rateId, rateId));
    } catch (error) {
      console.error("Error clearing departure rate flights:", error);
    }
  }
  
  async getSiteSettings(): Promise<SiteSetting | null> {
    try {
      const [setting] = await db.select().from(siteSettings).limit(1);
      return setting || null;
    } catch (error) {
      console.error("Error getting site settings:", error);
      return null;
    }
  }

  async getPackagesWithAutoRefresh(): Promise<FlightPackage[]> {
    try {
      const results = await db.select().from(flightPackages)
        .where(and(
          eq(flightPackages.autoRefreshEnabled, true),
          eq(flightPackages.pricingModule, "bokun_departures")
        ));
      return results;
    } catch (error) {
      console.error("Error getting packages with auto-refresh:", error);
      return [];
    }
  }

  async updateFlightPackageRefreshTimestamp(id: number): Promise<void> {
    try {
      await db.update(flightPackages)
        .set({ lastFlightRefreshAt: new Date() })
        .where(eq(flightPackages.id, id));
    } catch (error) {
      console.error("Error updating flight package refresh timestamp:", error);
    }
  }

  async updateFlightPackageAutoRefreshConfig(
    id: number, 
    config: { destinationAirport: string; departureAirports: string[]; markup: number; flightType?: "roundtrip" | "openjaw" }, 
    enabled: boolean
  ): Promise<void> {
    try {
      await db.update(flightPackages)
        .set({ 
          flightRefreshConfig: config,
          autoRefreshEnabled: enabled,
          updatedAt: new Date()
        })
        .where(eq(flightPackages.id, id));
    } catch (error) {
      console.error("Error updating flight package auto-refresh config:", error);
    }
  }
}

export const storage = new MemStorage();
