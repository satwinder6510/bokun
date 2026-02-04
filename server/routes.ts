import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { testBokunConnection, searchBokunProducts, searchBokunProductsByKeyword, getBokunProductDetails, getBokunAvailability, reserveBokunBooking, confirmBokunBooking, syncBokunDepartures } from "./bokun";
import { storage } from "./storage";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcrypt";
import sharp from "sharp";
import { contactLeadSchema, insertFaqSchema, updateFaqSchema, insertBlogPostSchema, updateBlogPostSchema, insertCartItemSchema, insertFlightPackageSchema, updateFlightPackageSchema, insertPackageEnquirySchema, insertTourEnquirySchema, insertReviewSchema, updateReviewSchema, adminLoginSchema, insertAdminUserSchema, updateAdminUserSchema, insertFlightTourPricingConfigSchema, updateFlightTourPricingConfigSchema, adminSessions, pending2FASessions, newsletterSubscribers } from "@shared/schema";
import { calculateCombinedPrices, getFlightsForDateWithPrices, UK_AIRPORTS, getDefaultDepartAirports, searchFlights } from "./flightApi";
import { searchSerpFlights, getCheapestSerpFlightsByDateAndAirport, isSerpApiConfigured, searchOpenJawFlights, getCheapestOpenJawByDateAndAirport, searchInternalFlights, getCheapestInternalByDate, BAGGAGE_SURCHARGE_GBP } from "./serpFlightApi";
import { db } from "./db";
import { eq, lt, desc } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { randomBytes } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import multer from "multer";

const execPromise = promisify(exec);
import path from "path";
import fs from "fs";
import { downloadAndProcessImage, processMultipleImages } from "./imageProcessor";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import * as mediaService from "./mediaService";
import * as stockImageService from "./stockImageService";
import { runWeeklyBokunCacheRefresh, runWeeklyFlightRefresh } from "./scheduler";
import { buildPackageIndex, getPackageIndex, scorePackageWithIndex, isIndexBuilt } from "./keywordIndex";

// Password hashing constants
const SALT_ROUNDS = 12;

// Password validation - minimum 12 characters with uppercase, lowercase, number, and special character
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)" };
  }
  return { valid: true };
}

// Rate limiters for security-sensitive endpoints
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP per window
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const twoFactorRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per IP per window
  message: { error: "Too many 2FA attempts. Please try again in 5 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per IP per hour
  message: { error: "Too many password reset attempts. Please try again in 1 hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Smart rounding helper - rounds prices to x49, x69, or x99 for psychological pricing
function smartRound(price: number): number {
  const base = Math.floor(price / 100) * 100;
  const remainder = price - base;
  
  if (remainder <= 49) {
    return base + 49;
  } else if (remainder <= 69) {
    return base + 69;
  } else {
    return base + 99;
  }
}

// Helper functions for database-backed pending 2FA sessions
async function setPending2FASession(token: string, sessionType: string, data: { userId: number; email: string; role: string; expiresAt: Date }) {
  // Delete any existing session with same token
  await db.delete(pending2FASessions).where(eq(pending2FASessions.pendingToken, token));
  await db.insert(pending2FASessions).values({
    pendingToken: token,
    sessionType,
    userId: data.userId,
    email: data.email,
    role: data.role,
    expiresAt: data.expiresAt,
  });
}

async function getPending2FASession(token: string, sessionType: string) {
  const [session] = await db.select().from(pending2FASessions)
    .where(eq(pending2FASessions.pendingToken, token));
  if (session && session.sessionType === sessionType) {
    return session;
  }
  return null;
}

async function deletePending2FASession(token: string) {
  await db.delete(pending2FASessions).where(eq(pending2FASessions.pendingToken, token));
}

// Generate session token
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

// Verify admin session middleware (using database-backed sessions)
async function verifyAdminSession(req: Request, res: Response, next: NextFunction) {
  // Get session token from HTTP-only cookie only (no header fallback for security)
  const sessionToken = req.cookies?.admin_session;
  
  if (!sessionToken) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  try {
    // Get session from database
    const [session] = await db.select().from(adminSessions).where(eq(adminSessions.sessionToken, sessionToken));
    
    if (!session || session.expiresAt < new Date()) {
      // Delete expired session
      if (session) {
        await db.delete(adminSessions).where(eq(adminSessions.sessionToken, sessionToken));
      }
      return res.status(401).json({ error: "Session expired or invalid" });
    }
    
    // Extend session on activity (update expiry in database)
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.update(adminSessions)
      .set({ expiresAt: newExpiry })
      .where(eq(adminSessions.sessionToken, sessionToken));
    
    // Attach user info to request
    (req as any).adminUser = {
      userId: session.userId,
      email: session.email,
      role: session.role
    };
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    return res.status(500).json({ error: "Session verification failed" });
  }
}

// Super admin only middleware
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const adminUser = (req as any).adminUser;
  
  if (!adminUser || adminUser.role !== 'super_admin') {
    return res.status(403).json({ error: "Super admin access required" });
  }
  
  next();
}

// Configure multer for image uploads
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `package-${uniqueSuffix}${ext}`);
  }
});

const imageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
  }
};

const upload = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Configure multer for CSV uploads
const csvStorage = multer.memoryStorage();
const csvFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const allowedExtensions = ['.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'));
  }
};

const csvUpload = multer({
  storage: csvStorage,
  fileFilter: csvFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for CSV
});

// UK Airports mapping for CSV parsing
const UK_AIRPORTS_MAP: Record<string, string> = {
  "LHR": "London Heathrow",
  "LGW": "London Gatwick",
  "STN": "London Stansted",
  "LTN": "London Luton",
  "MAN": "Manchester",
  "BHX": "Birmingham",
  "EDI": "Edinburgh",
  "GLA": "Glasgow",
  "BRS": "Bristol",
  "NCL": "Newcastle",
  "LPL": "Liverpool",
  "EMA": "East Midlands",
  "LBA": "Leeds Bradford",
  "BFS": "Belfast International",
  "CWL": "Cardiff",
};

export async function registerRoutes(app: Express): Promise<Server> {
  // ========================================
  // LEGACY URL REDIRECTS (Old sitemap compatibility)
  // ========================================
  
  // Handle .aspx legacy URLs - redirect to clean URLs
  app.get(/\.aspx$/i, (req, res) => {
    const cleanUrl = req.url.replace(/\.aspx$/i, '');
    res.redirect(301, cleanUrl);
  });
  
  // Middleware to handle legacy URLs from old website
  app.use((req, res, next) => {
    const originalUrl = req.path;
    
    // Skip API routes and static assets (but .aspx handled above)
    if (originalUrl.startsWith('/api/') || 
        originalUrl.startsWith('/objects/') || 
        originalUrl.startsWith('/assets/') ||
        originalUrl.startsWith('/uploads/') ||
        (originalUrl.includes('.') && !originalUrl.endsWith('.aspx'))) {
      return next();
    }
    
    let redirectUrl: string | null = null;
    
    // 1. Handle /flights/Region/Country -> redirect to homepage (flights pages don't exist in new site)
    if (originalUrl.match(/^\/flights\//i)) {
      redirectUrl = '/';
    }
    
    // 2. Handle static page redirects
    else if (originalUrl === '/AboutUs' || originalUrl === '/aboutus') {
      redirectUrl = '/';
    }
    else if (originalUrl === '/Home/Contact_Us' || originalUrl === '/home/contact_us') {
      redirectUrl = '/contact';
    }
    else if (originalUrl === '/TermNcondition' || originalUrl === '/termncondition') {
      redirectUrl = '/terms';
    }
    else if (originalUrl === '/PrivacyPolicy' || originalUrl === '/privacypolicy') {
      redirectUrl = '/terms';
    }
    
    // 3. Handle /Holidays/Region/Country/ID pattern (e.g., /Holidays/Europe/Italy/11)
    // Redirect to /Holidays/country (lowercase, without region and ID)
    else if (originalUrl.match(/^\/Holidays\/[^\/]+\/([^\/]+)\/\d+$/i)) {
      const match = originalUrl.match(/^\/Holidays\/[^\/]+\/([^\/]+)\/\d+$/i);
      if (match) {
        const country = match[1].toLowerCase().replace(/-$/, ''); // Remove trailing dash
        redirectUrl = `/Holidays/${country}`;
      }
    }
    
    // 4. Handle /Holidays/Region pattern (e.g., /Holidays/Europe, /Holidays/Asia)
    // These are region landing pages - redirect to destinations listing
    else if (originalUrl.match(/^\/Holidays\/(Europe|Americas|Africa|Asia|Middle-East|Indian-Ocean)$/i)) {
      redirectUrl = '/Holidays';
    }
    
    // 5. Handle /Holidays/Country/package-slug pattern with special characters
    // Clean up the slug and redirect to proper format
    else if (originalUrl.match(/^\/Holidays\/[^\/]+\/[^\/]+$/i)) {
      const match = originalUrl.match(/^\/Holidays\/([^\/]+)\/(.+)$/i);
      if (match) {
        const country = match[1].toLowerCase()
          .replace(/-$/, '') // Remove trailing dash
          .replace(/[^a-z0-9-]/g, '-') // Replace special chars
          .replace(/-+/g, '-'); // Collapse multiple dashes
        
        // Decode URI and clean up slug
        let slug = decodeURIComponent(match[2])
          .replace(/[\u2018\u2019\u201C\u201D]/g, '') // Smart quotes
          .replace(/&amp;/g, 'and')
          .replace(/&/g, 'and')
          .replace(/:/g, '')
          .replace(/'/g, '')
          .replace(/,/g, '')
          .toLowerCase() // Lowercase the slug
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        // Only redirect if the URL actually changed
        const newUrl = `/Holidays/${country}/${slug}`;
        if (newUrl !== originalUrl) {
          redirectUrl = newUrl;
        }
      }
    }
    
    // 6. Handle /Holidays/collection-name pattern (collections with special chars)
    // This handles both destination countries (like /Holidays/Italy) and collections (like /Holidays/Beach)
    else if (originalUrl.match(/^\/Holidays\/[^\/]+$/i)) {
      const match = originalUrl.match(/^\/Holidays\/(.+)$/i);
      if (match) {
        const segment = decodeURIComponent(match[1]);
        // Clean up the segment
        const cleanSegment = segment
          .replace(/[\u2018\u2019\u201C\u201D]/g, '') // Smart quotes
          .replace(/&amp;/g, 'and')
          .replace(/&/g, 'and')
          .replace(/:/g, '')
          .replace(/'/g, '')
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        const newUrl = `/Holidays/${cleanSegment}`;
        if (newUrl !== originalUrl) {
          redirectUrl = newUrl;
        }
      }
    }
    
    // 7. Handle root-level special pages (e.g., /Greek-Island-Hopping)
    else if (originalUrl.match(/^\/[A-Z][^\/]*$/)) {
      const cleanPath = originalUrl.toLowerCase();
      if (cleanPath !== originalUrl) {
        redirectUrl = cleanPath;
      }
    }
    
    // Perform 301 redirect if we found a new URL
    if (redirectUrl) {
      console.log(`[Legacy Redirect] ${originalUrl} -> ${redirectUrl}`);
      return res.redirect(301, redirectUrl);
    }
    
    next();
  });

  // ========================================
  // OBJECT STORAGE ROUTES
  // ========================================
  
  // Serve images from object storage
  app.get("/objects/*", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      // Decode URL-encoded path to match how files are stored in object storage
      const objectPath = decodeURIComponent(req.path.replace('/objects/', ''));
      await objectStorageService.downloadObject(objectPath, res, 86400); // 24-hour cache
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Image not found" });
      }
      console.error("Error serving object:", error);
      return res.status(500).json({ error: "Failed to serve image" });
    }
  });

  // Image proxy - bypasses CORS for external images with optional resizing/optimization
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const { url, w, q, format } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      // Only allow specific trusted domains (includes all Bokun S3 bucket variants)
      const allowedDomains = [
        'admin.citiesandbeaches.com',
        'citiesandbeaches.com',
        'bokun.s3.amazonaws.com',
        'bokun-images.s3.amazonaws.com',
        's3.amazonaws.com',
        'images.unsplash.com'
      ];
      
      const urlObj = new URL(url);
      // Allow any S3 bucket with 'bokun' in the name, or exact domain matches
      const isBokunS3 = urlObj.hostname.includes('bokun') && urlObj.hostname.includes('s3.amazonaws.com');
      const isAllowedDomain = allowedDomains.some(domain => urlObj.hostname.includes(domain));
      
      if (!isBokunS3 && !isAllowedDomain) {
        return res.status(403).json({ error: "Domain not allowed" });
      }

      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch image" });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Parse optimization parameters
      const width = w ? Math.min(parseInt(w as string, 10), 1920) : undefined;
      const quality = q ? Math.min(Math.max(parseInt(q as string, 10), 10), 100) : 75;
      const outputFormat = format === 'webp' ? 'webp' : (format === 'avif' ? 'avif' : 'jpeg');
      
      // If no resizing requested, return original
      if (!width && !format) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.set({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=604800', // 7-day cache
          'Access-Control-Allow-Origin': '*'
        });
        return res.send(buffer);
      }
      
      // Resize and optimize with sharp
      let sharpPipeline = sharp(buffer);
      
      if (width) {
        sharpPipeline = sharpPipeline.resize(width, undefined, {
          withoutEnlargement: true,
          fit: 'inside'
        });
      }
      
      let optimizedBuffer: Buffer;
      let contentType: string;
      
      if (outputFormat === 'webp') {
        optimizedBuffer = await sharpPipeline.webp({ quality }).toBuffer();
        contentType = 'image/webp';
      } else if (outputFormat === 'avif') {
        optimizedBuffer = await sharpPipeline.avif({ quality }).toBuffer();
        contentType = 'image/avif';
      } else {
        optimizedBuffer = await sharpPipeline.jpeg({ quality, progressive: true }).toBuffer();
        contentType = 'image/jpeg';
      }

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800', // 7-day cache for optimized images
        'Access-Control-Allow-Origin': '*',
        'Vary': 'Accept'
      });
      res.send(optimizedBuffer);
    } catch (error) {
      console.error("Image proxy error:", error);
      res.status(500).json({ error: "Failed to proxy image" });
    }
  });

  // Diagnostic: List objects in storage (admin only)
  app.get("/api/admin/storage-diagnostic", verifyAdminSession, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const isAvailable = await objectStorageService.isAvailable();
      
      if (!isAvailable) {
        return res.json({ 
          available: false, 
          message: "Object Storage is not available",
          objects: []
        });
      }
      
      const objects = await objectStorageService.listObjects("");
      res.json({ 
        available: true, 
        count: objects.length,
        objects: objects.slice(0, 100) // Limit to first 100
      });
    } catch (error: any) {
      console.error("Error listing objects:", error);
      res.status(500).json({ error: error.message || "Failed to list objects" });
    }
  });

  // Migrate image from external URL to object storage (admin only)
  app.post("/api/objects/migrate-url", verifyAdminSession, async (req, res) => {
    try {
      const { sourceUrl, filename } = req.body;
      if (!sourceUrl) {
        return res.status(400).json({ error: "sourceUrl is required" });
      }
      
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.uploadFromUrl(
        sourceUrl, 
        filename || 'image.jpg'
      );
      
      res.json({ 
        success: true, 
        objectPath,
        fullUrl: objectPath
      });
    } catch (error: any) {
      console.error("Error migrating image:", error);
      res.status(500).json({ error: error.message || "Failed to migrate image" });
    }
  });

  app.post("/api/bokun/test-connection", async (req, res) => {
    try {
      const result = await testBokunConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        connected: false,
        message: error.message || "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Get cache metadata
  app.get("/api/bokun/cache-metadata", async (req, res) => {
    try {
      const { currency = "USD" } = req.query;
      const metadata = await storage.getCacheMetadata(currency as string);
      res.json(metadata || { lastRefreshAt: null, totalProducts: 0 });
    } catch (error: any) {
      console.error("Error fetching cache metadata:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({
        error: error.message || "Failed to fetch cache metadata",
      });
    }
  });

  // Refresh products from Bokun API (force refresh)
  app.post("/api/bokun/products/refresh", async (req, res) => {
    try {
      const { currency = "USD" } = req.body;
      console.log(`Force refreshing ${currency} products from Bokun API...`);
      
      // Fetch all products from Bokun API
      let allProducts: any[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const data = await searchBokunProducts(page, pageSize, currency);
        allProducts = allProducts.concat(data.items || []);
        hasMore = (data.items?.length || 0) === pageSize;
        page++;
        
        // Safety limit to prevent infinite loops
        if (page > 50) break;
      }

      // Deduplicate before storing
      const uniqueProducts = Array.from(
        new Map(allProducts.map(p => [p.id, p])).values()
      );

      // Store in cache for this currency
      await storage.setCachedProducts(uniqueProducts, currency);
      allProducts = uniqueProducts;
      
      console.log(`Refreshed ${allProducts.length} ${currency} products in cache`);
      
      const metadata = await storage.getCacheMetadata(currency);
      res.json({
        success: true,
        productsRefreshed: allProducts.length,
        currency,
        metadata,
      });
    } catch (error: any) {
      console.error("Error refreshing products:", error.message);
      res.status(500).json({
        error: error.message || "Failed to refresh products",
      });
    }
  });

  app.post("/api/bokun/products", async (req, res) => {
    try {
      const { page = 1, pageSize = 20, currency = "USD" } = req.body;
      
      // Check if this currency is already cached
      const cachedProducts = await storage.getCachedProducts(currency);
      
      if (cachedProducts.length > 0) {
        console.log(`Serving ${cachedProducts.length} ${currency} products from cache`);
        
        // Deduplicate products by ID
        const uniqueProducts = Array.from(
          new Map(cachedProducts.map(p => [p.id, p])).values()
        );
        
        // Paginate cached results
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedProducts = uniqueProducts.slice(startIndex, endIndex);
        
        return res.json({
          totalHits: uniqueProducts.length,
          items: paginatedProducts,
          fromCache: true,
          currency,
        });
      } else {
        console.log(`${currency} cache miss - fetching first page immediately and caching in background...`);
        
        // Fetch ONLY the first page to return immediately (fast!)
        const firstPageData = await searchBokunProducts(1, 100, currency);
        const firstPageProducts = firstPageData.items || [];
        
        // Cache first page IMMEDIATELY to start 30-day TTL
        await storage.setCachedProducts(firstPageProducts, currency);
        console.log(`Cached first ${firstPageProducts.length} ${currency} products (30-day TTL started)`);
        
        // Start background caching of remaining pages (non-blocking)
        if (firstPageProducts.length === 100) {
          // Only continue if there might be more pages
          (async () => {
            try {
              let allProducts = [...firstPageProducts];
              let currentPage = 2;
              const fetchPageSize = 100;
              let hasMore = true;

              while (hasMore) {
                const data = await searchBokunProducts(currentPage, fetchPageSize, currency);
                allProducts = allProducts.concat(data.items || []);
                hasMore = (data.items?.length || 0) === fetchPageSize;
                currentPage++;
                
                // Safety limit
                if (currentPage > 50) break;
              }

              // Deduplicate and update cache with ALL products
              const uniqueProducts = Array.from(
                new Map(allProducts.map(p => [p.id, p])).values()
              );
              
              await storage.setCachedProducts(uniqueProducts, currency);
              console.log(`Background caching completed: ${uniqueProducts.length} ${currency} products now cached`);
            } catch (error) {
              console.error(`Background caching failed for ${currency}:`, error);
            }
          })(); // Fire and forget
        }
        
        // Return first page immediately
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedProducts = firstPageProducts.slice(startIndex, endIndex);
        
        return res.json({
          totalHits: firstPageData.totalHits || firstPageProducts.length,
          items: paginatedProducts,
          fromCache: false,
          currency,
        });
      }
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to fetch products",
      });
    }
  });

  app.get("/api/bokun/product/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { currency = "USD" } = req.query;
      const data = await getBokunProductDetails(id, currency as string);
      
      // Transform agendaItems to itinerary format for frontend
      // Bokun often stores day-by-day itinerary in agendaItems, not itinerary field
      let itinerary: any[] = [];
      
      if (data.itinerary?.length > 0) {
        // Use native itinerary if available
        itinerary = data.itinerary;
      } else if (data.agendaItems?.length > 0) {
        // Transform agendaItems to itinerary format
        itinerary = data.agendaItems.map((item: any) => ({
          id: item.id,
          day: item.day || item.index + 1,
          title: item.title || `Day ${item.day || item.index + 1}`,
          body: item.body || item.description || '',
          excerpt: item.excerpt || '',
        }));
      }
      
      res.json({
        ...data,
        itinerary,
      });
    } catch (error: any) {
      console.error("Error fetching product details:", error.message);
      const statusMatch = error.message.match(/API returned status (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 500;
      res.status(status).json({
        error: error.message || "Failed to fetch product details",
      });
    }
  });

  // DIAGNOSTIC: Show exact USD request and response from Bokun
  app.get("/api/bokun/currency-test/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { currency = "USD" } = req.query;
      
      // Build the exact request URL
      const BOKUN_API_BASE = "https://api.bokun.io";
      const path = `/activity.json/${id}`;
      const queryParams = `?currency=${currency}`;
      const fullUrl = `${BOKUN_API_BASE}${path}${queryParams}`;
      
      console.log("\n=== BOKUN API REQUEST ===");
      console.log(`Full URL: ${fullUrl}`);
      console.log(`Method: GET`);
      console.log(`Currency parameter: ${currency}`);
      
      // Fetch the product
      const product = await getBokunProductDetails(id, currency as string);
      
      console.log("\n=== BOKUN API RESPONSE ===");
      console.log(JSON.stringify(product, null, 2));
      console.log("=========================\n");
      
      // Return detailed request/response info
      const result = {
        request: {
          method: "GET",
          url: fullUrl,
          currencyParameter: currency
        },
        response: {
          id: product.id,
          title: product.title,
          nextDefaultPriceMoney: product.nextDefaultPriceMoney,
          pricingCategories: product.pricingCategories?.slice(0, 2),
          rawPriceFields: {
            price: product.price,
            priceFrom: product.priceFrom,
            nextDefaultPriceMoney: product.nextDefaultPriceMoney
          }
        }
      };
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bokun/availability/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { start, end, currency = "USD" } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({
          error: "Missing required query parameters: start and end dates",
        });
      }

      const data = await getBokunAvailability(
        id, 
        start as string, 
        end as string, 
        currency as string
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching availability:", error.message);
      const statusMatch = error.message.match(/API returned status (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 500;
      res.status(status).json({
        error: error.message || "Failed to fetch availability",
      });
    }
  });

  // ========================================
  // ADMIN AUTHENTICATION ROUTES
  // ========================================
  
  // Rate limiting for login attempts (simple in-memory, production should use Redis)
  const loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 15;

  // Admin Login - Step 1: Validate email and password
  app.post("/api/auth/admin/login", loginRateLimiter, async (req, res) => {
    try {
      const validation = adminLoginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid email or password format" });
      }

      const { email, password } = validation.data;
      const normalizedEmail = email.toLowerCase();

      // Check rate limiting
      const attempts = loginAttempts.get(normalizedEmail);
      if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
        const lockoutEnd = new Date(attempts.lastAttempt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
        if (new Date() < lockoutEnd) {
          const minutesLeft = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
          return res.status(429).json({ 
            error: `Too many login attempts. Try again in ${minutesLeft} minutes.` 
          });
        }
        // Reset after lockout period
        loginAttempts.delete(normalizedEmail);
      }

      // Find user
      const user = await storage.getAdminUserByEmail(normalizedEmail);
      if (!user) {
        // Increment failed attempts
        const current = loginAttempts.get(normalizedEmail) || { count: 0, lastAttempt: new Date() };
        loginAttempts.set(normalizedEmail, { count: current.count + 1, lastAttempt: new Date() });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated. Contact an administrator." });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        const current = loginAttempts.get(normalizedEmail) || { count: 0, lastAttempt: new Date() };
        loginAttempts.set(normalizedEmail, { count: current.count + 1, lastAttempt: new Date() });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Clear failed attempts on successful password
      loginAttempts.delete(normalizedEmail);

      // Check if 2FA is enabled
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        // Return pending 2FA status - client must complete 2FA
        const pendingToken = generateSessionToken();
        // Store pending session in database (expires in 5 minutes)
        await setPending2FASession(pendingToken, 'pending', {
          userId: user.id,
          email: user.email,
          role: user.role,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes for 2FA
        });
        
        return res.json({
          requiresTwoFactor: true,
          pendingToken,
          message: "Please enter your 2FA code"
        });
      }

      // If 2FA not enabled, check if this is first login (requires 2FA setup)
      if (!user.twoFactorEnabled) {
        const pendingToken = generateSessionToken();
        await setPending2FASession(pendingToken, 'setup', {
          userId: user.id,
          email: user.email,
          role: user.role,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes for setup
        });
        
        return res.json({
          requiresTwoFactorSetup: true,
          pendingToken,
          message: "Please set up two-factor authentication"
        });
      }

      // This shouldn't be reached, but handle it
      return res.status(500).json({ error: "Unexpected authentication state" });
    } catch (error: any) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Admin 2FA Setup - Generate QR code for user
  app.post("/api/auth/admin/2fa/setup", async (req, res) => {
    try {
      const { pendingToken } = req.body;
      
      if (!pendingToken) {
        return res.status(400).json({ error: "Pending token required" });
      }

      const session = await getPending2FASession(pendingToken, 'setup');
      if (!session || session.expiresAt < new Date()) {
        await deletePending2FASession(pendingToken);
        return res.status(401).json({ error: "Session expired. Please login again." });
      }

      // Generate new 2FA secret for this user
      const secret = new OTPAuth.Secret({ size: 20 });

      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer: "Flights and Packages Admin",
        label: session.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret,
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(totp.toString());

      res.json({
        secret: secret.base32,
        qrCode,
        email: session.email
      });
    } catch (error: any) {
      console.error("2FA setup error:", error);
      res.status(500).json({ error: "Failed to generate 2FA setup" });
    }
  });

  // Admin 2FA Verify and Complete Setup
  app.post("/api/auth/admin/2fa/verify-setup", twoFactorRateLimiter, async (req, res) => {
    try {
      const { pendingToken, token, secret } = req.body;
      
      if (!pendingToken || !token || !secret) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const session = await getPending2FASession(pendingToken, 'setup');
      if (!session || session.expiresAt < new Date()) {
        await deletePending2FASession(pendingToken);
        return res.status(401).json({ error: "Session expired. Please login again." });
      }

      // Verify the token with the provided secret
      const totp = new OTPAuth.TOTP({
        issuer: "Flights and Packages Admin",
        label: session.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret,
      });

      const delta = totp.validate({ token, window: 1 });
      if (delta === null) {
        return res.status(400).json({ error: "Invalid verification code" });
      }

      // Save the 2FA secret to the user
      await storage.updateAdminUser(session.userId, {
        twoFactorSecret: secret,
        twoFactorEnabled: true
      });

      // Update last login
      await storage.updateAdminUserLastLogin(session.userId);

      // Clear any existing sessions for this user (single device login)
      await db.delete(adminSessions).where(eq(adminSessions.userId, session.userId));

      // Create real session in database
      const sessionToken = generateSessionToken();
      await db.insert(adminSessions).values({
        sessionToken,
        userId: session.userId,
        email: session.email,
        role: session.role,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      // Clean up pending session
      await deletePending2FASession(pendingToken);

      // Set HTTP-only cookie for session
      res.cookie('admin_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      res.json({
        success: true,
        sessionToken,
        user: {
          id: session.userId,
          email: session.email,
          role: session.role
        }
      });
    } catch (error: any) {
      console.error("2FA verify setup error:", error);
      res.status(500).json({ error: "Failed to complete 2FA setup" });
    }
  });

  // Admin 2FA Verify (for login with existing 2FA)
  app.post("/api/auth/admin/2fa/verify", twoFactorRateLimiter, async (req, res) => {
    try {
      const { pendingToken, token } = req.body;
      
      if (!pendingToken || !token) {
        return res.status(400).json({ error: "Pending token and verification code required" });
      }

      const session = await getPending2FASession(pendingToken, 'pending');
      if (!session || session.expiresAt < new Date()) {
        await deletePending2FASession(pendingToken);
        return res.status(401).json({ error: "Session expired. Please login again." });
      }

      // Get user's 2FA secret
      const user = await storage.getAdminUserById(session.userId);
      if (!user || !user.twoFactorSecret) {
        return res.status(500).json({ error: "2FA not configured for this user" });
      }

      // Verify the token
      const totp = new OTPAuth.TOTP({
        issuer: "Flights and Packages Admin",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: user.twoFactorSecret,
      });

      const delta = totp.validate({ token, window: 1 });
      if (delta === null) {
        return res.status(400).json({ error: "Invalid verification code" });
      }

      // Update last login
      await storage.updateAdminUserLastLogin(user.id);

      // Clear any existing sessions for this user (single device login)
      await db.delete(adminSessions).where(eq(adminSessions.userId, user.id));

      // Create real session in database
      const sessionToken = generateSessionToken();
      await db.insert(adminSessions).values({
        sessionToken,
        userId: user.id,
        email: user.email,
        role: user.role,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      // Clean up pending session
      await deletePending2FASession(pendingToken);

      // Set HTTP-only cookie for session
      res.cookie('admin_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      res.json({
        success: true,
        sessionToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      });
    } catch (error: any) {
      console.error("2FA verify error:", error);
      res.status(500).json({ error: "Failed to verify 2FA" });
    }
  });

  // Admin Logout
  app.post("/api/auth/admin/logout", async (req, res) => {
    const sessionToken = req.cookies?.admin_session || req.headers['x-admin-session'] as string;
    if (sessionToken) {
      try {
        await db.delete(adminSessions).where(eq(adminSessions.sessionToken, sessionToken));
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    // Clear the HTTP-only cookie
    res.clearCookie('admin_session', { path: '/' });
    res.json({ success: true });
  });

  // Get current admin user info
  app.get("/api/auth/admin/me", verifyAdminSession, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const user = await storage.getAdminUserById(adminUser.userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt
      });
    } catch (error: any) {
      console.error("Get admin user error:", error);
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  // ========================================
  // ADMIN USER MANAGEMENT ROUTES
  // ========================================

  // List all admin users (super_admin only)
  app.get("/api/auth/admin/users", verifyAdminSession, requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllAdminUsers();
      // Don't return password hashes or 2FA secrets
      const safeUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        isActive: u.isActive,
        twoFactorEnabled: u.twoFactorEnabled,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt
      }));
      res.json(safeUsers);
    } catch (error: any) {
      console.error("List admin users error:", error);
      res.status(500).json({ error: "Failed to list users" });
    }
  });

  // Create new admin user (super_admin only)
  app.post("/api/auth/admin/users", verifyAdminSession, requireSuperAdmin, async (req, res) => {
    try {
      const { email, fullName, password, role } = req.body;
      
      if (!email || !fullName || !password) {
        return res.status(400).json({ error: "Email, full name, and password are required" });
      }

      // Check if email already exists
      const existing = await storage.getAdminUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An admin with this email already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const user = await storage.createAdminUser({
        email,
        fullName,
        passwordHash,
        role: role || 'editor',
        isActive: true,
        twoFactorEnabled: false
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        message: "User created. They will set up 2FA on first login."
      });
    } catch (error: any) {
      console.error("Create admin user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Update admin user (super_admin only)
  app.patch("/api/auth/admin/users/:id", verifyAdminSession, requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { email, fullName, role, isActive } = req.body;
      const currentAdmin = (req as any).adminUser;

      // Prevent deactivating yourself
      if (userId === currentAdmin.userId && isActive === false) {
        return res.status(400).json({ error: "You cannot deactivate your own account" });
      }

      const updates: any = {};
      if (email) updates.email = email;
      if (fullName) updates.fullName = fullName;
      if (role) updates.role = role;
      if (typeof isActive === 'boolean') updates.isActive = isActive;

      const user = await storage.updateAdminUser(userId, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive
      });
    } catch (error: any) {
      console.error("Update admin user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Reset admin user password (super_admin only)
  app.post("/api/auth/admin/users/:id/reset-password", passwordResetRateLimiter, verifyAdminSession, requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { newPassword } = req.body;

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      
      // Reset password and clear 2FA (user must set up again)
      const user = await storage.updateAdminUser(userId, {
        passwordHash,
        twoFactorSecret: null,
        twoFactorEnabled: false
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Clear any active sessions for this user from database
      await db.delete(adminSessions).where(eq(adminSessions.userId, userId));

      res.json({ 
        success: true, 
        message: "Password reset. User must set up 2FA on next login." 
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Delete admin user (super_admin only)
  app.delete("/api/auth/admin/users/:id", verifyAdminSession, requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentAdmin = (req as any).adminUser;

      // Prevent deleting yourself
      if (userId === currentAdmin.userId) {
        return res.status(400).json({ error: "You cannot delete your own account" });
      }

      // Check if this is the last super_admin
      const allUsers = await storage.getAllAdminUsers();
      const superAdmins = allUsers.filter(u => u.role === 'super_admin' && u.id !== userId);
      const userToDelete = allUsers.find(u => u.id === userId);
      
      if (userToDelete?.role === 'super_admin' && superAdmins.length === 0) {
        return res.status(400).json({ error: "Cannot delete the last super admin" });
      }

      await storage.deleteAdminUser(userId);

      // Clear any active sessions for this user from database
      await db.delete(adminSessions).where(eq(adminSessions.userId, userId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete admin user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Legacy 2FA routes - redirect to per-user system
  // Kept temporarily for backward compatibility during transition
  app.get("/api/auth/2fa/setup", async (req, res) => {
    res.status(410).json({ 
      error: "This endpoint is deprecated. Please use the new admin login system at /api/auth/admin/login" 
    });
  });

  app.post("/api/auth/2fa/verify", async (req, res) => {
    res.status(410).json({ 
      error: "This endpoint is deprecated. Please use the new admin login system at /api/auth/admin/login" 
    });
  });

  // Bootstrap route - Create first super admin (only works if no admins exist)
  app.post("/api/auth/admin/bootstrap", async (req, res) => {
    try {
      // Check if any admin users exist
      const existingUsers = await storage.getAllAdminUsers();
      if (existingUsers.length > 0) {
        return res.status(403).json({ 
          error: "Admin users already exist. Use the admin panel to manage users." 
        });
      }

      const { email, password, fullName } = req.body;
      
      if (!email || !password || !fullName) {
        return res.status(400).json({ error: "Email, password, and full name are required" });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create first super admin
      const user = await storage.createAdminUser({
        email,
        fullName,
        passwordHash,
        role: 'super_admin',
        isActive: true,
        twoFactorEnabled: false
      });

      console.log(`First admin user created: ${email}`);

      res.status(201).json({
        success: true,
        message: "First admin user created. Please login at /admin/login",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      });
    } catch (error: any) {
      console.error("Bootstrap admin error:", error);
      res.status(500).json({ error: "Failed to create admin user" });
    }
  });

  // Contact form submission - forwards to Privyr webhook
  app.post("/api/contact", async (req, res) => {
    try {
      // Validate request body
      const validationResult = contactLeadSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.issues,
        });
      }

      const { firstName, lastName, email, phone, bookingReference, message } = validationResult.data;

      // Get Privyr webhook URL from environment
      const webhookUrl = process.env.PRIVYR_WEBHOOK_URL;
      
      if (!webhookUrl) {
        console.error("PRIVYR_WEBHOOK_URL is not configured");
        return res.status(500).json({
          error: "Contact form is not configured. Please try again later.",
        });
      }

      // Normalize booking reference (empty string to "N/A")
      const normalizedBookingRef = bookingReference && bookingReference.trim() !== "" ? bookingReference : "N/A";

      // Prepare payload for Privyr webhook - using other_fields dict format per docs
      const payload = {
        name: `${firstName} ${lastName}`,
        email: email,
        phone: phone,
        display_name: firstName,
        other_fields: {
          "Booking Reference": normalizedBookingRef,
          "Message": message,
          "Source": req.body.referrer || "Direct",
          "Landing Page": req.body.landingPage || "Not captured",
          "Page URL": req.body.pageUrl || `${req.protocol}://${req.get('host')}/contact`,
          "Form Type": "Contact Form"
        }
      };
      
      console.log("Contact form payload being sent to Privyr:", JSON.stringify(payload, null, 2));

      console.log("Sending contact form to Privyr webhook...");
      
      // Send to Privyr webhook with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorDetail = "Unknown error";
          try {
            const errorText = await response.text();
            errorDetail = errorText;
            console.error("Privyr webhook error:", response.status, errorText);
          } catch (e) {
            console.error("Privyr webhook error (no body):", response.status);
          }
          
          // Return different error based on status code
          if (response.status >= 500) {
            return res.status(502).json({
              error: "The contact service is temporarily unavailable. Please try again in a few moments.",
              retryable: true,
              details: process.env.NODE_ENV === 'development' ? errorDetail : undefined,
            });
          } else if (response.status === 400) {
            return res.status(400).json({
              error: "Invalid form data. Please check your information and try again.",
              retryable: false,
              details: process.env.NODE_ENV === 'development' ? errorDetail : undefined,
            });
          } else {
            return res.status(502).json({
              error: "Failed to submit your message. Please try again or contact us directly via email.",
              retryable: true,
              details: process.env.NODE_ENV === 'development' ? errorDetail : undefined,
            });
          }
        }

        const result = await response.json();
        console.log("Contact form submitted successfully to Privyr:", result);

        res.json({
          success: true,
          message: "Your message has been sent successfully. We'll get back to you soon!",
          leadId: result.lead_id,
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.error("Privyr webhook timeout");
          return res.status(504).json({
            error: "Request timed out. Please try again.",
            retryable: true,
          });
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error("Error submitting contact form:", error);
      res.status(500).json({
        error: "Failed to submit contact form. Please try again later.",
        details: error.message,
      });
    }
  });

  // Spotler Mail+ - Get available contact properties (debug endpoint)
  app.get("/api/spotler/properties", async (req, res) => {
    try {
      const consumerKey = process.env.SPOTLER_CONSUMER_KEY;
      const consumerSecret = process.env.SPOTLER_CONSUMER_SECRET;
      
      if (!consumerKey || !consumerSecret) {
        return res.status(500).json({ error: "Spotler credentials not configured" });
      }

      // Note: base URL is integrationservice (not integrationservice-1.1.0)
      const apiUrl = "https://restapi.mailplus.nl/integrationservice/contact/properties";
      
      const crypto = await import('crypto');
      const oauth: Record<string, string> = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_version: '1.0'
      };

      const sortedParams = Object.keys(oauth)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauth[key])}`)
        .join('&');
      
      const signatureBase = `GET&${encodeURIComponent(apiUrl)}&${encodeURIComponent(sortedParams)}`;
      const signingKey = `${encodeURIComponent(consumerSecret)}&`;
      
      oauth.oauth_signature = crypto
        .createHmac('sha1', signingKey)
        .update(signatureBase)
        .digest('base64');

      const authHeader = 'OAuth ' + Object.entries(oauth)
        .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
        .join(', ');

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(502).json({ error: "Spotler API error", details: errorText });
      }

      const properties = await response.json();
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Newsletter Subscription - stores locally in database
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const { email, source } = req.body;
      
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: "Valid email address is required" });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Check if already subscribed
      const existing = await db.select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, normalizedEmail))
        .limit(1);

      if (existing.length > 0) {
        const subscriber = existing[0];
        if (subscriber.isActive) {
          return res.json({
            success: true,
            message: "You're already subscribed to our newsletter!"
          });
        } else {
          // Reactivate subscription
          await db.update(newsletterSubscribers)
            .set({ isActive: true, unsubscribedAt: null })
            .where(eq(newsletterSubscribers.email, normalizedEmail));
          
          console.log("Newsletter subscription reactivated:", normalizedEmail);
          return res.json({
            success: true,
            message: "Welcome back! You've been resubscribed to our newsletter."
          });
        }
      }

      // Create new subscriber
      await db.insert(newsletterSubscribers).values({
        email: normalizedEmail,
        source: source || 'website',
        isActive: true
      });

      console.log("Newsletter subscription created:", normalizedEmail);

      res.json({
        success: true,
        message: "Successfully subscribed to our newsletter!"
      });
    } catch (error: any) {
      console.error("Newsletter subscription error:", error);
      res.status(500).json({
        error: "Failed to subscribe. Please try again later."
      });
    }
  });

  // Admin: Get all newsletter subscribers
  app.get("/api/admin/newsletter/subscribers", verifyAdminSession, async (req, res) => {
    try {
      const subscribers = await db.select()
        .from(newsletterSubscribers)
        .orderBy(desc(newsletterSubscribers.subscribedAt));

      res.json(subscribers);
    } catch (error: any) {
      console.error("Error fetching newsletter subscribers:", error);
      res.status(500).json({ error: "Failed to fetch subscribers" });
    }
  });

  // Admin: Export newsletter subscribers as CSV
  app.get("/api/admin/newsletter/export", verifyAdminSession, async (req, res) => {
    try {
      const subscribers = await db.select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.isActive, true))
        .orderBy(desc(newsletterSubscribers.subscribedAt));

      // Generate CSV
      const csvHeader = "Email,Source,Subscribed At\n";
      const csvRows = subscribers.map(s => 
        `"${s.email}","${s.source || 'website'}","${s.subscribedAt?.toISOString() || ''}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=newsletter-subscribers.csv');
      res.send(csvHeader + csvRows);
    } catch (error: any) {
      console.error("Error exporting newsletter subscribers:", error);
      res.status(500).json({ error: "Failed to export subscribers" });
    }
  });

  // FAQ Routes
  // NOTE: Admin FAQ endpoints (POST/PATCH/DELETE) are currently not protected by server-side auth.
  // Frontend uses ProtectedRoute for UI access control. In production, add proper API authentication.
  
  // Get all FAQs (admin only - UI protected)
  app.get("/api/faqs/admin", async (req, res) => {
    try {
      const faqs = await storage.getAllFaqs();
      res.json(faqs);
    } catch (error: any) {
      console.error("Error fetching all FAQs:", error);
      res.status(500).json({ error: "Failed to fetch FAQs" });
    }
  });

  // Get published FAQs (public)
  app.get("/api/faqs", async (req, res) => {
    try {
      const faqs = await storage.getPublishedFaqs();
      res.json(faqs);
    } catch (error: any) {
      console.error("Error fetching published FAQs:", error);
      res.status(500).json({ error: "Failed to fetch FAQs" });
    }
  });

  // Get FAQ by ID
  app.get("/api/faqs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid FAQ ID" });
      }

      const faq = await storage.getFaqById(id);
      if (!faq) {
        return res.status(404).json({ error: "FAQ not found" });
      }

      res.json(faq);
    } catch (error: any) {
      console.error("Error fetching FAQ:", error);
      res.status(500).json({ error: "Failed to fetch FAQ" });
    }
  });

  // Create FAQ (admin only)
  app.post("/api/faqs", verifyAdminSession, async (req, res) => {
    try {
      const validation = insertFaqSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid FAQ data", 
          details: validation.error.errors 
        });
      }

      const faq = await storage.createFaq(validation.data);
      res.status(201).json(faq);
    } catch (error: any) {
      console.error("Error creating FAQ:", error);
      res.status(500).json({ error: "Failed to create FAQ" });
    }
  });

  // Update FAQ (admin only)
  app.patch("/api/faqs/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid FAQ ID" });
      }

      const validation = updateFaqSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid FAQ data", 
          details: validation.error.errors 
        });
      }

      const faq = await storage.updateFaq(id, validation.data);
      if (!faq) {
        return res.status(404).json({ error: "FAQ not found" });
      }

      res.json(faq);
    } catch (error: any) {
      console.error("Error updating FAQ:", error);
      res.status(500).json({ error: "Failed to update FAQ" });
    }
  });

  // Delete FAQ (admin only)
  app.delete("/api/faqs/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid FAQ ID" });
      }

      const success = await storage.deleteFaq(id);
      if (!success) {
        return res.status(404).json({ error: "FAQ not found" });
      }

      res.json({ success: true, message: "FAQ deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting FAQ:", error);
      res.status(500).json({ error: "Failed to delete FAQ" });
    }
  });

  // Blog Post Routes
  
  // Get all blog posts (admin only - UI protected)
  app.get("/api/blog/admin", async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (error: any) {
      console.error("Error fetching all blog posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  // Get published blog posts (public)
  app.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getPublishedBlogPosts();
      res.json(posts);
    } catch (error: any) {
      console.error("Error fetching published blog posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  // Get blog post by ID
  app.get("/api/blog/id/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid blog post ID" });
      }

      const post = await storage.getBlogPostById(id);
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }

      res.json(post);
    } catch (error: any) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // Get blog post by slug (public - SEO-friendly URLs)
  app.get("/api/blog/slug/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const post = await storage.getBlogPostBySlug(slug);
      
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }

      // Only return published posts for public access
      if (!post.isPublished || (post.publishedAt && post.publishedAt > new Date())) {
        return res.status(404).json({ error: "Blog post not found" });
      }

      res.json(post);
    } catch (error: any) {
      console.error("Error fetching blog post by slug:", error);
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // Create blog post (admin only)
  app.post("/api/blog", verifyAdminSession, async (req, res) => {
    try {
      const validation = insertBlogPostSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid blog post data", 
          details: validation.error.errors 
        });
      }

      const post = await storage.createBlogPost(validation.data);
      res.status(201).json(post);
    } catch (error: any) {
      console.error("Error creating blog post:", error);
      res.status(500).json({ error: "Failed to create blog post" });
    }
  });

  // Update blog post (admin only)
  app.patch("/api/blog/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid blog post ID" });
      }

      const validation = updateBlogPostSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid blog post data", 
          details: validation.error.errors 
        });
      }

      const post = await storage.updateBlogPost(id, validation.data);
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }

      res.json(post);
    } catch (error: any) {
      console.error("Error updating blog post:", error);
      res.status(500).json({ error: "Failed to update blog post" });
    }
  });

  // Delete blog post (admin only)
  app.delete("/api/blog/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid blog post ID" });
      }

      const success = await storage.deleteBlogPost(id);
      if (!success) {
        return res.status(404).json({ error: "Blog post not found" });
      }

      res.json({ success: true, message: "Blog post deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting blog post:", error);
      res.status(500).json({ error: "Failed to delete blog post" });
    }
  });

  // Shopping Cart API endpoints
  
  // Get cart
  app.get("/api/cart", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }

      const cartItems = await storage.getCartBySessionId(sessionId);
      res.json({ items: cartItems });
    } catch (error: any) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ error: "Failed to fetch cart" });
    }
  });

  // Add to cart
  app.post("/api/cart", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }

      const validation = insertCartItemSchema.safeParse({
        ...req.body,
        sessionId,
      });

      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid cart item data", 
          details: validation.error.errors 
        });
      }

      const cartItem = await storage.addToCart(validation.data);
      res.json(cartItem);
    } catch (error: any) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ error: "Failed to add to cart" });
    }
  });

  // Remove from cart
  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid cart item ID" });
      }

      const success = await storage.removeFromCart(id);
      if (!success) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ error: "Failed to remove from cart" });
    }
  });

  // Clear cart
  app.delete("/api/cart", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }

      await storage.clearCart(sessionId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  // Get cart item count
  app.get("/api/cart/count", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.json({ count: 0 });
      }

      const count = await storage.getCartItemCount(sessionId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching cart count:", error);
      res.status(500).json({ error: "Failed to fetch cart count" });
    }
  });

  // Stripe and Booking API endpoints

  // Get Stripe publishable key
  app.get("/api/stripe/config", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      console.error("Error fetching Stripe config:", error);
      res.status(500).json({ error: "Failed to fetch Stripe config" });
    }
  });

  // Create payment intent - SECURE: Server-side total calculation
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }

      // Fetch cart items from server-side storage (secure)
      const cartItems = await storage.getCartBySessionId(sessionId);
      
      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }

      // Validate all cart items have the same currency
      const firstCurrency = cartItems[0].currency;
      const allSameCurrency = cartItems.every(item => item.currency === firstCurrency);
      
      if (!allSameCurrency) {
        return res.status(400).json({ 
          error: "All cart items must be in the same currency. Please clear your cart and start over." 
        });
      }

      // Calculate total amount server-side (secure - cannot be tampered with)
      // productPrice already includes quantity (per-person price × number of people)
      const totalAmount = cartItems.reduce((sum, item) => {
        return sum + item.productPrice;
      }, 0);

      if (totalAmount <= 0) {
        return res.status(400).json({ error: "Invalid total amount" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Create payment intent with server-calculated amount
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: firstCurrency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          sessionId,
          itemCount: cartItems.length.toString(),
          cartItemIds: cartItems.map(item => item.id).join(','),
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount,
        currency: firstCurrency,
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: error.message || "Failed to create payment intent" });
    }
  });

  // Create booking - SECURE: Verify payment before creating booking
  app.post("/api/bookings", async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }

      const {
        customerFirstName,
        customerLastName,
        customerEmail,
        customerPhone,
        stripePaymentIntentId,
      } = req.body;

      if (!stripePaymentIntentId) {
        return res.status(400).json({ error: "Payment intent ID required" });
      }

      // CRITICAL SECURITY: Verify payment with Stripe before creating booking
      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

      // Verify payment was successful
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ 
          error: "Payment not completed",
          paymentStatus: paymentIntent.status,
        });
      }

      // Derive all amounts from Payment Intent (source of truth)
      const paidAmount = paymentIntent.amount / 100; // Convert cents to dollars
      const paidCurrency = paymentIntent.currency.toUpperCase();

      // Fetch cart items to get product details for booking
      const cartItems = await storage.getCartBySessionId(sessionId);
      
      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }

      // For now, we'll only support single-item bookings with Bokun
      // Multi-item bookings can be added later
      const firstCartItem = cartItems[0];
      const productData = firstCartItem.productData as any;

      // Validate that we have all required booking data
      if (!productData?.date || !productData?.rateId) {
        console.error("Missing booking data in cart:", { productData });
        return res.status(400).json({ 
          error: "Invalid cart data - missing date or rate information" 
        });
      }

      let bokunReservationId = null;
      let bokunConfirmationCode = null;
      
      try {
        // Step 1: Reserve booking with Bokun
        console.log("Reserving booking with Bokun for product:", firstCartItem.productId);
        const reservationResponse = await reserveBokunBooking({
          productId: firstCartItem.productId,
          date: productData.date,
          rateId: productData.rateId.toString(),
          currency: paidCurrency,
          adults: firstCartItem.quantity || 1,
          customerFirstName,
          customerLastName,
          customerEmail,
          customerPhone,
        });

        bokunReservationId = reservationResponse.confirmationCode;
        console.log("Bokun reservation created:", bokunReservationId);

        // Step 2: Confirm booking with Bokun using Stripe payment
        console.log("Confirming booking with Bokun:", bokunReservationId);
        const confirmationResponse = await confirmBokunBooking(
          bokunReservationId,
          paidAmount,
          paidCurrency,
          stripePaymentIntentId
        );

        bokunConfirmationCode = confirmationResponse.confirmationCode;
        console.log("Bokun booking confirmed:", bokunConfirmationCode);
      } catch (bokunError: any) {
        console.error("Bokun booking failed:", bokunError);
        // Note: Payment already succeeded with Stripe, so we create the booking anyway
        // but mark it as pending manual processing
        console.warn("Creating booking record despite Bokun error - requires manual processing");
      }

      // Generate booking reference
      const bookingReference = `FP${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

      // Create booking with verified payment
      const booking = await storage.createBooking({
        bookingReference,
        sessionId,
        customerFirstName,
        customerLastName,
        customerEmail,
        customerPhone,
        productId: firstCartItem.productId, // Primary product from cart
        productTitle: firstCartItem.productTitle, // Primary product from cart
        productPrice: paidAmount, // Amount from verified Payment Intent
        currency: paidCurrency, // Currency from verified Payment Intent
        totalAmount: paidAmount, // Total from verified Payment Intent
        stripePaymentIntentId,
        bokunReservationId,
        bokunBookingId: bokunConfirmationCode,
        paymentStatus: 'completed', // Verified as succeeded
        bookingStatus: bokunConfirmationCode ? 'confirmed' : 'pending', // Confirmed if Bokun succeeded
        bookingData: {
          cartItems: cartItems.map(item => {
            const itemData = item.productData as any;
            return {
              productId: item.productId,
              productTitle: item.productTitle,
              price: item.productPrice,
              quantity: item.quantity,
              date: itemData?.date,
              rateTitle: itemData?.rateTitle,
              rateId: itemData?.rateId,
            };
          }),
          paymentIntentAmount: paidAmount,
          paymentIntentCurrency: paymentIntent.currency,
          bokunReservationId,
          bokunConfirmationCode,
        },
      });

      res.json({ booking });
    } catch (error: any) {
      console.error("Error creating booking:", error);
      res.status(500).json({ error: error.message || "Failed to create booking" });
    }
  });

  // Get booking by reference
  app.get("/api/bookings/:reference", async (req, res) => {
    try {
      const { reference } = req.params;
      const booking = await storage.getBookingByReference(reference);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      res.json(booking);
    } catch (error: any) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Update booking status (webhook handler will use this)
  app.patch("/api/bookings/:reference", async (req, res) => {
    try {
      const { reference } = req.params;
      const booking = await storage.getBookingByReference(reference);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const updated = await storage.updateBooking(booking.id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating booking:", error);
      res.status(500).json({ error: "Failed to update booking" });
    }
  });

  // ============= UNIFIED SEARCH ROUTE =============
  
  // Search across packages and tours
  app.get("/api/search", async (req, res) => {
    try {
      const { q, type, maxResults = "20" } = req.query;
      const query = (q as string || "").trim();
      
      if (!query || query.length < 2) {
        return res.json({ results: [], suggestions: [] });
      }
      
      const limit = Math.min(parseInt(maxResults as string) || 20, 50);
      const searchType = type as string | undefined;
      
      // Fetch packages and tours in parallel
      const [packages, toursResponse] = await Promise.all([
        searchType === 'tours' ? Promise.resolve([]) : storage.getPublishedFlightPackages(),
        searchType === 'packages' ? Promise.resolve([]) : searchBokunProducts(1, 100),
      ]);
      
      const tours = Array.isArray(toursResponse) ? toursResponse : (toursResponse?.items || []);
      
      // Convert to searchable format
      const searchableItems: Array<{
        id: number | string;
        type: 'package' | 'tour';
        title: string;
        description?: string;
        excerpt?: string;
        category?: string;
        countries?: string[];
        tags?: string[];
        price?: number;
        duration?: string;
        image?: string;
        slug?: string;
      }> = [];
      
      // Add packages
      for (const pkg of packages) {
        searchableItems.push({
          id: pkg.id,
          type: 'package',
          title: pkg.title,
          description: pkg.description,
          excerpt: pkg.excerpt || undefined,
          category: pkg.category,
          countries: pkg.countries || [],
          tags: pkg.tags || [],
          price: pkg.price,
          duration: pkg.duration || undefined,
          image: pkg.featuredImage || undefined,
          slug: pkg.slug,
        });
      }
      
      // Add tours
      for (const tour of tours) {
        searchableItems.push({
          id: tour.id,
          type: 'tour',
          title: tour.title,
          description: tour.excerpt || tour.summary || undefined,
          category: tour.location?.country || undefined,
          countries: tour.location?.country ? [tour.location.country] : [],
          tags: tour.tags || [],
          price: tour.nextDefaultPrice?.amount,
          duration: tour.durationText || undefined,
          image: tour.keyPhoto?.src || undefined,
        });
      }
      
      // Perform search with fuzzy matching and relevance scoring
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      
      const scoredResults = searchableItems.map(item => {
        let score = 0;
        const matchedFields: string[] = [];
        
        for (const term of queryTerms) {
          // Title match (highest weight)
          if (item.title?.toLowerCase().includes(term)) {
            score += item.title.toLowerCase().startsWith(term) ? 6 : 5;
            if (!matchedFields.includes('title')) matchedFields.push('title');
          }
          
          // Category/country match
          if (item.category?.toLowerCase().includes(term)) {
            score += 3;
            if (!matchedFields.includes('category')) matchedFields.push('category');
          }
          
          // Countries array match
          if (item.countries?.some(c => c.toLowerCase().includes(term))) {
            score += 3;
            if (!matchedFields.includes('countries')) matchedFields.push('countries');
          }
          
          // Tags match
          if (item.tags?.some(t => t.toLowerCase().includes(term))) {
            score += 2.5;
            if (!matchedFields.includes('tags')) matchedFields.push('tags');
          }
          
          // Excerpt match
          if (item.excerpt?.toLowerCase().includes(term)) {
            score += 1.5;
            if (!matchedFields.includes('excerpt')) matchedFields.push('excerpt');
          }
          
          // Description match
          if (item.description?.toLowerCase().includes(term)) {
            score += 1;
            if (!matchedFields.includes('description')) matchedFields.push('description');
          }
          
          // Fuzzy matching for typos (Levenshtein-like)
          if (score === 0 && term.length >= 4) {
            const titleWords = item.title?.toLowerCase().split(/\s+/) || [];
            for (const word of titleWords) {
              if (word.length >= 3) {
                const similarity = calculateSimilarity(word, term);
                if (similarity > 0.7) {
                  score += similarity * 3;
                  if (!matchedFields.includes('title')) matchedFields.push('title');
                  break;
                }
              }
            }
          }
        }
        
        // Normalize by number of terms
        if (queryTerms.length > 1) {
          score = score / queryTerms.length;
        }
        
        return { ...item, score, matchedFields };
      });
      
      // Filter and sort by score
      const results = scoredResults
        .filter(r => r.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      // Generate suggestions
      const suggestions = new Set<string>();
      for (const item of searchableItems) {
        if (suggestions.size >= 5) break;
        if (item.title?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(item.title);
        }
        if (item.category?.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(item.category);
        }
        item.countries?.forEach(c => {
          if (c.toLowerCase().includes(query.toLowerCase()) && suggestions.size < 5) {
            suggestions.add(c);
          }
        });
      }
      
      res.json({
        results,
        suggestions: Array.from(suggestions),
        total: results.length,
      });
    } catch (error: any) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });
  
  // Helper function for fuzzy matching
  function calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;
    
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - (distance / maxLength);
  }

  // ============= AI SEARCH ROUTES =============
  
  // Get filter options for AI search
  app.get("/api/ai-search/filters", async (req, res) => {
    try {
      // Get all packages and tours to determine filter ranges
      let [packages, cachedTours] = await Promise.all([
        storage.getPublishedFlightPackages(),
        storage.getCachedProducts("GBP"),
      ]);
      
      // Fall back to USD if GBP cache empty
      if (cachedTours.length === 0) {
        cachedTours = await storage.getCachedProducts("USD");
      }
      
      // Get all Bokun product IDs that are linked to flight packages
      // These tours should be excluded from the filters as they're shown as packages instead
      const linkedBokunIds = new Set<string>();
      for (const pkg of packages) {
        if (pkg.bokunProductId) {
          linkedBokunIds.add(pkg.bokunProductId);
        }
      }
      
      // Filter out tours that are already linked to flight packages
      cachedTours = cachedTours.filter(tour => !linkedBokunIds.has(String(tour.id)));
      
      // Holiday type keywords for detecting from content
      // Be strict - only use phrases that clearly indicate the holiday type
      const holidayTypeKeywords: Record<string, string[]> = {
        "Beach": ["beach", "beaches", "seaside", "coastal", "oceanfront", "beachfront"],
        "Adventure": ["adventure", "hiking", "trekking", "climbing", "rafting", "expedition"],
        "Cultural": ["cultural", "culture", "heritage", "museum", "temple", "ancient", "ruins"],
        "City Break": ["city break", "city tour"], // Very strict - only explicit city break phrases
        "Cruise": ["cruise", "cruising", "ship cruise"], // More strict - "ship" alone is too broad
        "River Cruise": ["river cruise", "riverboat", "barge cruise", "danube cruise", "rhine cruise", "nile cruise", "mekong cruise"],
        "Safari": ["safari", "game drive", "big five", "game reserve"],
        "Wildlife": ["wildlife", "game viewing", "whale watching", "bird watching", "gorilla trekking"],
        "Luxury": ["luxury", "luxurious", "5-star", "five star", "boutique hotel"],
        "Multi-Centre": ["multi-centre", "multi-center", "twin centre", "twin center"],
        "Island": ["island hopping", "island escape", "island paradise"],
        "Solo Travellers": ["solo traveller", "solo traveler", "single traveller"],
      };
      
      // Bokun category mappings - matches the actual Bokun categories
      // Bokun uses uppercase snake_case: SUN_AND_BEACH, SAFARI_AND_WILDLIFE, MINI_CRUISE, etc.
      const bokunCategoryMappings: Record<string, string[]> = {
        "Beach": ["sun_and_beach", "island_hopping", "water_sports", "beach"],
        "Adventure": ["adventure", "hiking", "outdoor", "extreme_sports", "rafting", "trekking"],
        "Cultural": ["arts_and_culture", "cultural", "heritage", "museum", "archaeological", "pilgrimage_or_religion"],
        "City Break": ["city_break", "city_tour", "urban", "short_break"],
        "Cruise": ["cruise", "mini_cruise", "sailing", "boat_tour"],
        "River Cruise": ["river_cruise", "barge"],
        "Safari": ["safari_and_wildlife", "safari", "game_drive"],
        "Wildlife": ["safari_and_wildlife", "nature", "bird_watching", "wildlife"],
        "Luxury": ["luxury", "premium", "exclusive", "private_roundtrip", "private_roundrip"],
        "Multi-Centre": ["multi_centre", "combination", "seat_in_coach_tour"],
        "Island": ["island", "island_hopping"],
        "Solo Travellers": ["solo", "individual"],
      };
      
      // Regional constraints - which holiday types are actually possible in which regions
      // This overrides keyword detection for impossible combinations
      const beachCountries = new Set([
        "Thailand", "TH", "Indonesia", "ID", "Maldives", "MV", "Sri Lanka", "Sri lanka", "LK",
        "Greece", "GR", "Spain", "ES", "Portugal", "PT", "Italy", "IT", "Croatia", "HR",
        "Turkey", "TR", "Türkiye", "Cyprus", "CY", "Malta", "MT", "Egypt", "EG",
        "Morocco", "MA", "Tunisia", "TN", "Mexico", "MX", "Costa Rica", "CR",
        "Brazil", "BR", "Australia", "AU", "New Zealand", "NZ", "Fiji", "FJ",
        "Philippines", "PH", "Vietnam", "VN", "Malaysia", "MY", "Singapore", "SG",
        "Mauritius", "MU", "Seychelles", "SC", "South Africa", "ZA",
        "USA", "US", "Caribbean", "Barbados", "Jamaica", "Cuba", "Dominican Republic",
        "Bali", "Sardinia", "Sicily", "Crete", "Santorini", "Mykonos",
        "India", "IN", "Goa", "Kerala"
      ]);
      
      const safariCountries = new Set([
        "Kenya", "KE", "Tanzania", "TZ", "South Africa", "ZA", "Botswana", "BW",
        "Namibia", "NA", "Zimbabwe", "ZW", "Zambia", "ZM", "Uganda", "UG",
        "Rwanda", "RW", "Malawi", "MW", "Mozambique", "MZ",
        "Sri Lanka", "Sri lanka", "LK", "India", "IN" // Have wildlife safaris
      ]);
      
      const riverCruiseCountries = new Set([
        "Germany", "DE", "Austria", "AT", "Hungary", "HU", "France", "FR",
        "Netherlands", "NL", "Belgium", "BE", "Switzerland", "CH",
        "Portugal", "PT", "Spain", "ES", "Czech Republic", "CZ", "Slovakia", "SK",
        "Vietnam", "VN", "Cambodia", "KH", "Myanmar", "MM", "Egypt", "EG",
        "Peru", "PE", "Brazil", "BR", "USA", "US", "China", "CN"
      ]);
      
      const islandCountries = new Set([
        "Maldives", "MV", "Mauritius", "MU", "Seychelles", "SC", "Fiji", "FJ",
        "Indonesia", "ID", "Philippines", "PH", "Sri Lanka", "Sri lanka", "LK",
        "Greece", "GR", "Italy", "IT", "Spain", "ES", "Portugal", "PT",
        "Thailand", "TH", "Malaysia", "MY", "Japan", "JP",
        "Caribbean", "Barbados", "Jamaica", "Cuba", "Dominican Republic",
        "Cyprus", "CY", "Malta", "MT", "Croatia", "HR"
      ]);
      
      // City Break is NOT appropriate for island-only or wilderness destinations
      const noCityBreakCountries = new Set([
        "Maldives", "MV", "Seychelles", "SC", "Fiji", "FJ", // Island-only nations
        "Mauritius", "MU", "Cape Verde", "CV", // Island nations
        "Bhutan", "BT", // Remote Himalayan kingdom
        "Namibia", "NA", // Wilderness/safari focused
        "Botswana", "BW", "Zambia", "ZM", "Zimbabwe", "ZW", // Safari nations
        "Rwanda", "RW", "Uganda", "UG", "Tanzania", "TZ", // Safari nations
        "Kenya", "KE", // Safari focused
        "Nepal", "NP", // Mountain/adventure focused
        "Costa Rica", "CR", // Nature/adventure focused
        "Ecuador", "EC", // Nature/Galapagos focused
      ]);
      
      // Function to check if holiday type is valid for a country
      const isValidHolidayTypeForCountry = (holidayType: string, country: string): boolean => {
        switch (holidayType) {
          case "Beach":
            return beachCountries.has(country);
          case "Safari":
            return safariCountries.has(country);
          case "River Cruise":
            return riverCruiseCountries.has(country);
          case "Island":
            return islandCountries.has(country);
          case "City Break":
            return !noCityBreakCountries.has(country);
          default:
            return true; // Other types are universally applicable
        }
      };
      
      // Build destination -> holiday types mapping
      const destinationHolidayTypes = new Map<string, Set<string>>();
      const destinationSet = new Set<string>();
      let maxPrice = 0;
      let maxDuration = 0;
      
      // Helper to detect holiday types from text content
      const detectHolidayTypes = (text: string): string[] => {
        const textLower = text.toLowerCase();
        const detected: string[] = [];
        for (const [holidayType, keywords] of Object.entries(holidayTypeKeywords)) {
          for (const keyword of keywords) {
            if (textLower.includes(keyword)) {
              detected.push(holidayType);
              break;
            }
          }
        }
        return detected;
      };
      
      // Process packages
      for (const pkg of packages) {
        const destinations: string[] = [];
        if (pkg.category) destinations.push(pkg.category);
        if (pkg.countries) destinations.push(...pkg.countries);
        
        destinations.forEach(dest => destinationSet.add(dest));
        
        // Detect holiday types from tags and content
        const detectedTypes = new Set<string>();
        
        // From tags (direct match)
        if (pkg.tags) {
          for (const tag of pkg.tags) {
            const tagLower = tag.toLowerCase();
            for (const holidayType of Object.keys(holidayTypeKeywords)) {
              if (tagLower === holidayType.toLowerCase()) {
                detectedTypes.add(holidayType);
              }
            }
          }
        }
        
        // From content
        const searchText = `${pkg.title || ""} ${pkg.description || ""} ${pkg.excerpt || ""}`;
        detectHolidayTypes(searchText).forEach(t => detectedTypes.add(t));
        
        // Map detected types to each destination
        for (const dest of destinations) {
          if (!destinationHolidayTypes.has(dest)) {
            destinationHolidayTypes.set(dest, new Set());
          }
          detectedTypes.forEach(t => destinationHolidayTypes.get(dest)!.add(t));
        }
        
        if (pkg.price && pkg.price > maxPrice) maxPrice = pkg.price;
        const durationMatch = pkg.duration?.match(/(\d+)/);
        if (durationMatch) {
          const days = parseInt(durationMatch[1]);
          if (days > maxDuration) maxDuration = days;
        }
      }
      
      // Process tours
      for (const tour of cachedTours) {
        // Prefer full country name from googlePlace, fall back to locationCode
        const country = tour.googlePlace?.country || tour.locationCode?.country;
        // Skip 2-letter country codes - only use full names
        if (country && country.length > 2) {
          destinationSet.add(country);
          
          if (!destinationHolidayTypes.has(country)) {
            destinationHolidayTypes.set(country, new Set());
          }
          
          // Detect from Bokun activity categories
          const activityCategories = tour.activityCategories || [];
          for (const [holidayType, mappedCats] of Object.entries(bokunCategoryMappings)) {
            for (const category of activityCategories) {
              const catLower = category.toLowerCase();
              if (mappedCats.some(m => catLower.includes(m.toLowerCase()))) {
                destinationHolidayTypes.get(country)!.add(holidayType);
                break;
              }
            }
          }
          
          // Detect from content
          const searchText = `${tour.title || ""} ${tour.excerpt || ""} ${tour.summary || ""}`;
          detectHolidayTypes(searchText).forEach(t => destinationHolidayTypes.get(country)!.add(t));
        }
        
        if (tour.price && tour.price > maxPrice) maxPrice = tour.price;
        const durationMatch = tour.durationText?.match(/(\d+)/);
        if (durationMatch) {
          const days = parseInt(durationMatch[1]);
          if (days > maxDuration) maxDuration = days;
        }
      }
      
      // Normalize country names to avoid duplicates
      const countryNormalization: Record<string, string> = {
        "Sri lanka": "Sri Lanka",
        "Türkiye": "Turkey",
      };
      
      // Convert to serializable format, applying regional constraints and normalization
      const holidayTypesByDestination: Record<string, string[]> = {};
      const destEntries = Array.from(destinationHolidayTypes.entries());
      for (const [dest, types] of destEntries) {
        if (dest.length <= 2) continue; // Skip country codes
        const normalizedDest = countryNormalization[dest] || dest;
        // Filter out impossible holiday types for this destination
        const typesArray = Array.from(types);
        const validTypes = typesArray.filter((t: string) => isValidHolidayTypeForCountry(t, normalizedDest));
        // Merge with existing if normalized name already exists
        if (holidayTypesByDestination[normalizedDest]) {
          const existing = new Set(holidayTypesByDestination[normalizedDest]);
          validTypes.forEach((t: string) => existing.add(t));
          holidayTypesByDestination[normalizedDest] = Array.from(existing).sort();
        } else {
          holidayTypesByDestination[normalizedDest] = validTypes.sort();
        }
      }
      
      // Sort destinations alphabetically, filtering out 2-letter country codes and normalizing names
      const normalizedDestinations = new Set<string>();
      const destArray = Array.from(destinationSet);
      for (const dest of destArray) {
        if (dest.length > 2) {
          const normalized = countryNormalization[dest] || dest;
          normalizedDestinations.add(normalized);
        }
      }
      const destinations = Array.from(normalizedDestinations).sort();
      
      // Round up maxPrice to nearest 1000
      maxPrice = Math.ceil(maxPrice / 1000) * 1000;
      if (maxPrice < 5000) maxPrice = 5000;
      
      // Cap duration at reasonable max
      if (maxDuration < 21) maxDuration = 21;
      if (maxDuration > 30) maxDuration = 30;
      
      res.json({
        destinations,
        maxPrice,
        maxDuration,
        holidayTypesByDestination,
      });
    } catch (error: any) {
      console.error("Error fetching AI search filters:", error);
      res.status(500).json({ error: "Failed to fetch filters" });
    }
  });
  
  // AI Search endpoint - filter by destination, duration, budget, holiday types, travelers
  app.get("/api/ai-search", async (req, res) => {
    try {
      const { destination, maxDuration, maxBudget, holidayTypes, travelers } = req.query;
      
      const budgetLimit = parseInt(maxBudget as string) || 10000;
      const durationLimit = parseInt(maxDuration as string) || 21;
      const travelerCount = parseInt(travelers as string) || 2;
      const destFilter = destination as string | undefined;
      const typeFilters = holidayTypes ? (holidayTypes as string).split(",").filter(Boolean) : [];
      
      // Enhanced keyword mappings for better matching
      // Note: These are used for SCORING, not filtering - can be a bit broader than filters keywords
      const holidayTypeKeywords: Record<string, string[]> = {
        "Beach": ["beach", "beaches", "seaside", "coastal", "oceanfront", "beachfront", "tropical beach", "white sand"],
        "Adventure": ["adventure", "hiking", "trekking", "climbing", "rafting", "kayak", "expedition", "extreme"],
        "Cultural": ["cultural", "culture", "heritage", "history", "historical", "museum", "temple", "ancient", "ruins"],
        "City Break": ["city break", "city tour", "citybreak"], // Strict - only explicit city break phrases
        "Cruise": ["cruise", "cruising", "mini cruise", "sea cruise"],
        "River Cruise": ["river cruise", "riverboat", "barge cruise", "danube cruise", "rhine cruise", "nile cruise", "mekong cruise"],
        "Safari": ["safari", "game drive", "big five", "game reserve", "wildlife reserve"],
        "Wildlife": ["wildlife", "game viewing", "whale watching", "bird watching", "gorilla trekking", "national park"],
        "Luxury": ["luxury", "luxurious", "5-star", "five star", "boutique hotel", "premium"],
        "Multi-Centre": ["multi-centre", "multi-center", "multi centre", "multi center", "twin centre", "twin center"],
        "Island": ["island hopping", "island escape", "island paradise", "island tour"],
        "Solo Travellers": ["solo traveller", "solo traveler", "single traveller"],
      };
      
      // Fetch packages only (land tours no longer shown on public site)
      const packages = await storage.getPublishedFlightPackages();
      
      console.log(`[AI Search] Found ${packages.length} packages`);
      
      // Convert to searchable format and score
      interface AISearchItem {
        id: number | string;
        type: "package" | "tour";
        title: string;
        description?: string;
        category?: string;
        countries?: string[];
        tags?: string[];
        price?: number;
        duration?: string;
        durationDays?: number;
        image?: string;
        slug?: string;
        score: number;
      }
      
      let results: AISearchItem[] = [];
      let exactMatches = true; // Track if we found exact matches
      
      // Process packages (priority)
      for (const pkg of packages) {
        // Parse duration
        let durationDays = 7;
        const durationMatch = pkg.duration?.match(/(\d+)/);
        if (durationMatch) durationDays = parseInt(durationMatch[1]);
        
        // Check filters
        if (pkg.price && pkg.price > budgetLimit) continue;
        if (durationDays > durationLimit) continue;
        
        // Destination filter
        if (destFilter && destFilter !== "all") {
          const matchesDest = 
            pkg.category?.toLowerCase() === destFilter.toLowerCase() ||
            pkg.countries?.some((c: string) => c.toLowerCase() === destFilter.toLowerCase());
          if (!matchesDest) continue;
        }
        
        // Holiday type filtering - STRICT: only match on explicit tags
        // Keywords are for SCORING only, not for filtering
        let typeScore = 0;
        const packageTags = pkg.tags || [];
        let matchedTypes = 0;
        
        if (typeFilters.length > 0) {
          // STRICT FILTERING: Only count matches from explicit package tags
          for (const typeFilter of typeFilters) {
            const tagMatched = packageTags.some((t: string) => 
              t.toLowerCase() === typeFilter.toLowerCase() ||
              t.toLowerCase().includes(typeFilter.toLowerCase())
            );
            if (tagMatched) {
              matchedTypes++;
              typeScore += 50;
            }
          }
          
          // IMPORTANT: Skip packages that don't have ALL selected holiday type tags
          // For "Luxury Solo" the package must be TAGGED as both Luxury AND Solo
          if (matchedTypes < typeFilters.length) continue;
          
          // Bonus scoring from keyword index (for ranking, not filtering)
          const packageIndex = getPackageIndex(pkg.id);
          if (packageIndex) {
            const keywordScore = scorePackageWithIndex(packageIndex, typeFilters);
            typeScore += Math.min(keywordScore, 20); // Cap keyword bonus
          }
        }
        
        if (typeFilters.length === 0) {
          // No filters - use index to show variety if available
          const pkgIndex = getPackageIndex(pkg.id);
          if (pkgIndex) {
            // Give bonus for packages with strong holiday type matches
            const topMatch = pkgIndex.holidayTypeMatches[0];
            typeScore = topMatch ? Math.min(topMatch.score, 30) : 10;
          } else {
            typeScore = 10;
          }
        }
        
        // Solo traveller boost
        if (travelerCount === 1) {
          if (packageTags.some((t: string) => t.toLowerCase().includes("solo"))) {
            typeScore += 15;
          }
          const searchText = `${pkg.title} ${pkg.description || ""} ${pkg.excerpt || ""}`.toLowerCase();
          if (searchText.includes("solo")) {
            typeScore += 5;
          }
        }
        
        // Calculate relevance score - packages get priority
        let score = 80; // Base score for packages
        score += typeScore;
        
        // Prefer items that fit budget well (not too cheap, not at max)
        if (pkg.price && budgetLimit > 0) {
          const budgetRatio = pkg.price / budgetLimit;
          if (budgetRatio >= 0.3 && budgetRatio <= 0.8) {
            score += 15; // Sweet spot - good value
          } else if (budgetRatio > 0.8 && budgetRatio <= 1) {
            score += 8; // Using most of budget
          }
        }
        
        // Duration relevance - prefer trips that use more of allowed duration
        if (durationDays && durationLimit > 0) {
          const durationRatio = durationDays / durationLimit;
          if (durationRatio >= 0.4 && durationRatio <= 0.9) {
            score += 10; // Good duration fit
          }
        }
        
        results.push({
          id: pkg.id,
          type: "package",
          title: pkg.title,
          description: pkg.excerpt || pkg.description || undefined,
          category: pkg.category,
          countries: pkg.countries || [],
          tags: pkg.tags || [],
          price: pkg.price,
          duration: pkg.duration || undefined,
          durationDays,
          image: pkg.featuredImage || undefined,
          slug: pkg.slug,
          score,
        });
      }
      
// Sort all results by score first
      results.sort((a, b) => b.score - a.score);
      
      // FALLBACK: If no exact matches found with holiday type filters, 
      // show closest matches using looser keyword matching
      if (results.length === 0 && typeFilters.length > 0) {
        exactMatches = false;
        console.log(`[AI Search] No exact matches for ${typeFilters.join(", ")}, showing closest matches`);
        
        // Re-run with loose matching - check keywords in description
        for (const pkg of packages) {
          let durationDays = 7;
          const durationMatch = pkg.duration?.match(/(\d+)/);
          if (durationMatch) durationDays = parseInt(durationMatch[1]);
          
          if (pkg.price && pkg.price > budgetLimit) continue;
          if (durationDays > durationLimit) continue;
          
          if (destFilter && destFilter !== "all") {
            const matchesDest = 
              pkg.category?.toLowerCase() === destFilter.toLowerCase() ||
              pkg.countries?.some((c: string) => c.toLowerCase() === destFilter.toLowerCase());
            if (!matchesDest) continue;
          }
          
          // Loose matching: check keywords in description for scoring
          let typeScore = 0;
          const searchText = `${pkg.title} ${pkg.description || ""} ${pkg.excerpt || ""}`.toLowerCase();
          
          for (const typeFilter of typeFilters) {
            const keywords = holidayTypeKeywords[typeFilter] || [typeFilter.toLowerCase()];
            for (const keyword of keywords) {
              if (searchText.includes(keyword)) {
                typeScore += 15;
                break;
              }
            }
          }
          
          // Only include if at least some relevance
          if (typeScore > 0) {
            results.push({
              id: pkg.id,
              type: "package",
              title: pkg.title,
              description: pkg.excerpt || undefined,
              category: pkg.category || undefined,
              countries: pkg.countries || [],
              tags: pkg.tags || [],
              price: pkg.price || undefined,
              duration: pkg.duration || undefined,
              durationDays,
              image: pkg.featuredImage || undefined,
              slug: pkg.slug,
              score: 50 + typeScore,
            });
          }
        }
        
        results.sort((a, b) => b.score - a.score);
      }
      
      // Take top 24 packages only (land tours no longer shown on public site)
      const combinedResults = results.slice(0, 24);
      
      console.log(`[AI Search] Returning ${combinedResults.length} packages (filters: ${typeFilters.join(", ") || "none"}, exact: ${exactMatches})`);
      
      res.json({
        results: combinedResults,
        total: results.length,
        exactMatches,
      });
    } catch (error: any) {
      console.error("AI Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // ============= FLIGHT INCLUSIVE PACKAGES ROUTES =============

  // Get all published packages (public)
  app.get("/api/packages", async (req, res) => {
    try {
      const { category } = req.query;
      const packages = await storage.getPublishedFlightPackages(category as string | undefined);
      res.json(packages);
    } catch (error: any) {
      console.error("Error fetching packages:", error);
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  // Get package categories (for navigation) - MUST be before :slug route
  app.get("/api/packages/categories", async (req, res) => {
    try {
      const categories = await storage.getFlightPackageCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Get all special offer packages (public)
  app.get("/api/packages/special-offers", async (req, res) => {
    try {
      const packages = await storage.getSpecialOfferPackages(); // No limit - get all
      res.json(packages);
    } catch (error: any) {
      console.error("Error fetching special offers:", error);
      res.status(500).json({ error: "Failed to fetch special offers" });
    }
  });

  // Homepage aggregated data endpoint - MUST be before :slug route
  app.get("/api/packages/homepage", async (req, res) => {
    try {
      // Fetch all sections in parallel for performance
      const [specialOffers, allPackages, blogPosts, contentImagesData] = await Promise.all([
        storage.getSpecialOfferPackages(8), // Limit special offers to 8
        storage.getPublishedFlightPackages(),
        storage.getPublishedBlogPosts(),
        storage.getAllContentImages(),
      ]);

      // Build lookup maps for custom images
      const destinationImages = new Map<string, string>();
      const collectionImages = new Map<string, string>();
      contentImagesData.forEach(img => {
        if (img.type === 'destination') {
          destinationImages.set(img.name, img.imageUrl);
        } else if (img.type === 'collection') {
          collectionImages.set(img.name, img.imageUrl);
        }
      });

      // Build destinations from published packages (includes countries array for multi-country packages)
      const destinationMap = new Map<string, { name: string; count: number; image: string | null }>();
      allPackages.forEach(pkg => {
        // Get all countries this package covers (primary category + countries array)
        const allCountries = new Set<string>([pkg.category]);
        if (pkg.countries && Array.isArray(pkg.countries)) {
          pkg.countries.forEach(c => allCountries.add(c));
        }
        
        // Add/update count for each country
        allCountries.forEach(country => {
          const existing = destinationMap.get(country);
          if (existing) {
            existing.count++;
          } else {
            destinationMap.set(country, {
              name: country,
              count: 1,
              image: destinationImages.get(country) || pkg.featuredImage
            });
          }
        });
      });
      const destinations = Array.from(destinationMap.values())
        .sort((a, b) => b.count - a.count);

      // Build collections from tags
      const tagMap = new Map<string, { tag: string; count: number; image: string | null }>();
      allPackages.forEach(pkg => {
        const tags = pkg.tags || [];
        tags.forEach(tag => {
          const existing = tagMap.get(tag);
          if (existing) {
            existing.count++;
          } else {
            tagMap.set(tag, {
              tag,
              count: 1,
              image: collectionImages.get(tag) || pkg.featuredImage
            });
          }
        });
      });
      const collections = Array.from(tagMap.values())
        .filter(c => c.count >= 2) // Only show collections with 2+ packages
        .sort((a, b) => b.count - a.count);

      // Return aggregated data
      res.json({
        specialOffers,
        destinations,
        collections,
        blogPosts: blogPosts.slice(0, 6), // Limit blog posts to 6
      });
    } catch (error: any) {
      console.error("Error fetching homepage data:", error);
      res.status(500).json({ error: "Failed to fetch homepage data" });
    }
  });

  // Get single package by slug (public - only published packages)
  app.get("/api/packages/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const pkg = await storage.getFlightPackageBySlug(slug);
      
      if (!pkg) {
        return res.status(404).json({ error: "Package not found", code: "NOT_FOUND" });
      }
      
      // Return coming soon status for unpublished packages
      if (!pkg.isPublished) {
        return res.status(200).json({ 
          comingSoon: true,
          title: pkg.title,
          category: pkg.category,
          featuredImage: pkg.featuredImage,
          excerpt: pkg.excerpt
        });
      }
      
      res.json(pkg);
    } catch (error: any) {
      console.error("Error fetching package:", error);
      res.status(500).json({ error: "Failed to fetch package" });
    }
  });

  // Get package pricing by package ID (public)
  app.get("/api/packages/:id/pricing", async (req, res) => {
    try {
      const { id } = req.params;
      const pricing = await storage.getPackagePricing(parseInt(id));
      // Only return available pricing entries
      const availablePricing = pricing.filter(p => p.isAvailable);
      res.json(availablePricing);
    } catch (error: any) {
      console.error("Error fetching package pricing:", error);
      res.status(500).json({ error: "Failed to fetch pricing" });
    }
  });

  // Get Bokun departure pricing by package ID (public) - for Bokun Departures + Flights module
  app.get("/api/packages/:id/bokun-pricing", async (req, res) => {
    try {
      const { id } = req.params;
      const packageId = parseInt(id);
      
      // Get the package to check enabled hotel categories
      const pkg = await storage.getFlightPackageById(packageId);
      const enabledHotelCategories: string[] = (pkg?.enabledHotelCategories as string[]) || [];
      
      // Get departures with rates
      const departures = await storage.getBokunDepartures(packageId);
      
      if (departures.length === 0) {
        return res.json({ enabled: false, prices: [] });
      }
      
      // Collect all rate IDs
      const allRateIds: number[] = [];
      departures.forEach(d => {
        if (d.rates && Array.isArray(d.rates)) {
          d.rates.forEach((r: any) => allRateIds.push(r.id));
        }
      });
      
      if (allRateIds.length === 0) {
        return res.json({ enabled: false, prices: [] });
      }
      
      // Get flight pricing for all rates
      const flightPricing = await storage.getDepartureRateFlights(allRateIds);
      
      if (flightPricing.length === 0) {
        return res.json({ enabled: false, prices: [], message: "No flight pricing available" });
      }
      
      // Build a map of rateId -> flight pricing by airport
      const flightsByRate = new Map<number, Map<string, { flightPrice: number, combinedPrice: number }>>();
      flightPricing.forEach(fp => {
        if (!flightsByRate.has(fp.rateId)) {
          flightsByRate.set(fp.rateId, new Map());
        }
        flightsByRate.get(fp.rateId)!.set(fp.airportCode, {
          flightPrice: fp.flightPriceGbp,
          combinedPrice: fp.combinedPriceGbp
        });
      });
      
      // Build the pricing output
      const prices: Array<{
        departureDate: string;
        rateTitle: string;
        rateId: number;
        landPrice: number;
        airportCode: string;
        airportName: string;
        flightPrice: number;
        combinedPrice: number;
        durationNights: number | null;
      }> = [];
      
      // Airport code to name mapping
      const airportNames: Record<string, string> = {
        "LGW": "London Gatwick",
        "LHR": "London Heathrow",
        "STN": "London Stansted",
        "LTN": "London Luton",
        "MAN": "Manchester",
        "BHX": "Birmingham",
        "EDI": "Edinburgh",
        "GLA": "Glasgow",
        "BRS": "Bristol",
        "NCL": "Newcastle",
        "LPL": "Liverpool",
        "EMA": "East Midlands",
        "LBA": "Leeds Bradford",
      };
      
      for (const departure of departures) {
        if (!departure.rates || !Array.isArray(departure.rates)) continue;
        
        for (const rate of departure.rates) {
          // Filter by enabled hotel categories if configured
          // Empty array means show all categories
          if (enabledHotelCategories.length > 0 && rate.hotelCategory) {
            if (!enabledHotelCategories.includes(rate.hotelCategory)) {
              continue; // Skip this rate - hotel category not enabled
            }
          }
          
          const rateFlights = flightsByRate.get(rate.id);
          if (!rateFlights) continue;
          
          // Add an entry for each airport with pricing
          const rateFlightEntries = Array.from(rateFlights.entries());
          for (const [airportCode, pricing] of rateFlightEntries) {
            prices.push({
              departureDate: departure.departureDate,
              rateTitle: rate.rateTitle || "Standard Rate",
              rateId: rate.id,
              landPrice: rate.priceGbp || 0,
              airportCode,
              airportName: airportNames[airportCode] || airportCode,
              flightPrice: pricing.flightPrice,
              combinedPrice: pricing.combinedPrice,
              durationNights: departure.durationNights || null,
            });
          }
        }
      }
      
      // Sort by date, then by combined price
      prices.sort((a, b) => {
        const dateCompare = a.departureDate.localeCompare(b.departureDate);
        if (dateCompare !== 0) return dateCompare;
        return a.combinedPrice - b.combinedPrice;
      });
      
      // Get min price for "from" display
      const minPrice = prices.length > 0 ? Math.min(...prices.map(p => p.combinedPrice)) : 0;
      
      // Get duration from first departure
      const durationNights = departures[0]?.durationNights || null;
      
      res.json({ 
        enabled: true, 
        prices,
        minPrice,
        durationNights,
        totalDepartures: departures.length,
      });
    } catch (error: any) {
      console.error("Error fetching Bokun departure pricing:", error);
      res.status(500).json({ error: "Failed to fetch pricing" });
    }
  });

  // Destinations API - get all destinations with counts
  app.get("/api/destinations", async (req, res) => {
    try {
      // Get published flight packages and extract categories (destinations)
      const allPackages = await storage.getPublishedFlightPackages();
      const packagesByCategory = new Map<string, number>();
      const packageImages = new Map<string, string>();
      
      allPackages.forEach(pkg => {
        // Get all countries this package covers (primary category + countries array)
        const allCountries = new Set<string>([pkg.category]);
        if (pkg.countries && Array.isArray(pkg.countries)) {
          pkg.countries.forEach(c => allCountries.add(c));
        }
        
        // Count package for each country it covers
        allCountries.forEach(country => {
          const count = packagesByCategory.get(country) || 0;
          packagesByCategory.set(country, count + 1);
          // Store first image found for each category
          if (!packageImages.has(country) && pkg.featuredImage) {
            packageImages.set(country, pkg.featuredImage);
          }
        });
      });
      
      // Get cached Bokun products and extract countries
      const cachedProducts = await storage.getCachedProducts("USD");
      const toursByCountry = new Map<string, number>();
      const tourImages = new Map<string, string>();
      
      cachedProducts.forEach(product => {
        const country = product.googlePlace?.country;
        if (country) {
          const count = toursByCountry.get(country) || 0;
          toursByCountry.set(country, count + 1);
          // Store first image found for each country
          if (!tourImages.has(country) && product.keyPhoto?.originalUrl) {
            tourImages.set(country, product.keyPhoto.originalUrl);
          }
        }
      });
      
      // Combine all destinations
      const allDestinations = new Set([...Array.from(packagesByCategory.keys()), ...Array.from(toursByCountry.keys())]);
      
      const destinations = Array.from(allDestinations).map(name => ({
        name,
        flightPackageCount: packagesByCategory.get(name) || 0,
        landTourCount: toursByCountry.get(name) || 0,
        image: packageImages.get(name) || tourImages.get(name) || null
      })).sort((a, b) => {
        // Sort by total count descending
        const totalA = a.flightPackageCount + a.landTourCount;
        const totalB = b.flightPackageCount + b.landTourCount;
        return totalB - totalA;
      });
      
      res.json(destinations);
    } catch (error: any) {
      console.error("Error fetching destinations:", error);
      res.status(500).json({ error: "Failed to fetch destinations" });
    }
  });

  // Destinations API - get packages and tours by destination
  app.get("/api/destinations/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      
      // Convert slug to destination name (e.g., "united-arab-emirates" -> "United Arab Emirates")
      const destinationName = slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      // Get published flight packages matching category or countries array
      const allPackages = await storage.getPublishedFlightPackages();
      const matchingPackages = allPackages.filter(pkg => {
        // Check primary category
        if (pkg.category.toLowerCase() === destinationName.toLowerCase()) {
          return true;
        }
        // Check countries array for multi-country packages
        if (pkg.countries && Array.isArray(pkg.countries)) {
          return pkg.countries.some(c => c.toLowerCase() === destinationName.toLowerCase());
        }
        return false;
      });
      
      // Get cached Bokun products matching country
      const cachedProducts = await storage.getCachedProducts("USD");
      const matchingTours = cachedProducts.filter(product => 
        product.googlePlace?.country?.toLowerCase() === destinationName.toLowerCase()
      );
      
      // If no matches found, try partial matching
      let finalPackages = matchingPackages;
      let finalTours = matchingTours;
      
      if (matchingPackages.length === 0 && matchingTours.length === 0) {
        finalPackages = allPackages.filter(pkg => 
          pkg.category.toLowerCase().includes(destinationName.toLowerCase()) ||
          destinationName.toLowerCase().includes(pkg.category.toLowerCase())
        );
        finalTours = cachedProducts.filter(product => 
          product.googlePlace?.country?.toLowerCase().includes(destinationName.toLowerCase()) ||
          destinationName.toLowerCase().includes(product.googlePlace?.country?.toLowerCase() || '')
        );
      }
      
      // Get related blog posts for this destination
      const relatedBlogs = await storage.getBlogPostsByDestination(destinationName);
      
      res.json({
        destination: destinationName,
        flightPackages: finalPackages,
        landTours: finalTours.slice(0, 100), // Limit to 100 tours per destination
        blogPosts: relatedBlogs
      });
    } catch (error: any) {
      console.error("Error fetching destination:", error);
      res.status(500).json({ error: "Failed to fetch destination" });
    }
  });

  // Collections API - get all available tags with product counts
  app.get("/api/collections", async (req, res) => {
    try {
      const tagDefinitions = [
        { tag: "City Breaks", slug: "city-breaks", title: "City Breaks", description: "Explore vibrant cities and urban adventures" },
        { tag: "Twin-Centre", slug: "twin-centre", title: "Twin-Centre Holidays", description: "Experience two amazing destinations in one trip" },
        { tag: "All-inclusive", slug: "all-inclusive", title: "All-Inclusive Holidays", description: "Everything included for a stress-free getaway" },
        { tag: "Gems", slug: "gems", title: "Hidden Gems", description: "Discover our handpicked exceptional experiences" },
        { tag: "Beach", slug: "beach", title: "Beach Holidays", description: "Sun, sand and sea - perfect beach getaways" },
        { tag: "Family", slug: "family", title: "Family Holidays", description: "Create lasting memories with the whole family" },
        { tag: "Adventure", slug: "adventure", title: "Adventure Tours", description: "Thrilling experiences for the adventurous spirit" },
        { tag: "Luxury", slug: "luxury", title: "Luxury Escapes", description: "Premium experiences and five-star service" },
        { tag: "Budget", slug: "budget", title: "Value Holidays", description: "Amazing holidays that won't break the bank" },
        { tag: "Cultural", slug: "cultural", title: "Cultural Journeys", description: "Immerse yourself in rich history and traditions" },
        { tag: "Safari", slug: "safari", title: "Safari Adventures", description: "Witness incredible wildlife in their natural habitat" },
        { tag: "Cruise", slug: "cruise", title: "Ocean Cruises", description: "Set sail on unforgettable ocean voyages" },
        { tag: "River Cruise", slug: "river-cruise", title: "River Cruises", description: "Scenic journeys along the world's great rivers" },
        { tag: "Golden Triangle", slug: "golden-triangle", title: "Golden Triangle Tours", description: "India's iconic Delhi, Agra and Jaipur circuit" },
        { tag: "Multi-Centre", slug: "multi-centre", title: "Multi-Centre Holidays", description: "Visit multiple destinations in one amazing trip" },
        { tag: "Wellness", slug: "wellness", title: "Wellness Retreats", description: "Rejuvenate mind, body and soul" },
        { tag: "Religious", slug: "religious", title: "Pilgrimage Tours", description: "Spiritual journeys to sacred destinations" },
        { tag: "Wildlife", slug: "wildlife", title: "Wildlife Experiences", description: "Get close to nature's most amazing creatures" },
        { tag: "Island", slug: "island", title: "Island Escapes", description: "Discover paradise on stunning island getaways" },
        { tag: "Solo Travellers", slug: "solo-travellers", title: "Solo Travel", description: "Perfect adventures designed for independent explorers" }
      ];
      
      // Get all published flight packages, cached products, and collection images
      const [allPackages, cachedProducts, collectionImages] = await Promise.all([
        storage.getPublishedFlightPackages(),
        storage.getCachedProducts("USD"),
        storage.getContentImagesByType("collection")
      ]);
      
      // Create a map of tag name to image URL
      const imageMap = new Map<string, string>();
      collectionImages.forEach(img => {
        imageMap.set(img.name.toLowerCase(), img.imageUrl);
      });
      
      // Count products for each tag
      const collectionsWithCounts = tagDefinitions.map(def => {
        // Get flight packages with this tag
        const matchingPackages = allPackages.filter(pkg => 
          pkg.tags && Array.isArray(pkg.tags) && 
          pkg.tags.some(t => t.toLowerCase() === def.tag.toLowerCase())
        );
        const packageCount = matchingPackages.length;
        
        // Count Bokun products with matching activityCategories
        const tourCount = cachedProducts.filter(product => 
          product.activityCategories && 
          Array.isArray(product.activityCategories) &&
          product.activityCategories.some(cat => 
            cat.toLowerCase().includes(def.tag.toLowerCase()) ||
            def.tag.toLowerCase().includes(cat.toLowerCase())
          )
        ).length;
        
        // Use custom image, or fallback to first package's featured image
        const customImage = imageMap.get(def.tag.toLowerCase());
        const fallbackImage = matchingPackages.length > 0 ? matchingPackages[0].featuredImage : null;
        
        return {
          ...def,
          packageCount,
          tourCount,
          totalCount: packageCount + tourCount,
          imageUrl: customImage || fallbackImage || null
        };
      });
      
      // Only return tags that have at least one product
      const availableCollections = collectionsWithCounts.filter(c => c.totalCount > 0);
      
      res.json({
        collections: availableCollections,
        total: availableCollections.length
      });
    } catch (error: any) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  // Collections API - get packages and tours by tag
  app.get("/api/collections/:tagSlug", async (req, res) => {
    try {
      const { tagSlug } = req.params;
      
      // Map tag slug to display name (e.g., "river-cruise" -> "River Cruise")
      const tagDisplayNames: Record<string, string> = {
        "city-breaks": "City Breaks",
        "twin-centre": "Twin-Centre",
        "all-inclusive": "All-inclusive",
        "gems": "Gems",
        "beach": "Beach",
        "family": "Family",
        "adventure": "Adventure",
        "luxury": "Luxury",
        "budget": "Budget",
        "cultural": "Cultural",
        "safari": "Safari",
        "cruise": "Cruise",
        "river-cruise": "River Cruise",
        "golden-triangle": "Golden Triangle",
        "multi-centre": "Multi-Centre",
        "wellness": "Wellness",
        "religious": "Religious",
        "wildlife": "Wildlife",
        "island": "Island",
        "solo-travellers": "Solo Travellers"
      };
      
      const tagName = tagDisplayNames[tagSlug.toLowerCase()];
      if (!tagName) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      // Get published flight packages with matching tag
      const allPackages = await storage.getPublishedFlightPackages();
      const matchingPackages = allPackages.filter(pkg => 
        pkg.tags && Array.isArray(pkg.tags) && 
        pkg.tags.some(t => t.toLowerCase() === tagName.toLowerCase())
      );
      
      // Get cached Bokun products and filter by activityCategories
      const cachedProducts = await storage.getCachedProducts("USD");
      const matchingTours = cachedProducts.filter(product => 
        product.activityCategories && 
        Array.isArray(product.activityCategories) &&
        product.activityCategories.some(cat => 
          cat.toLowerCase().includes(tagName.toLowerCase()) ||
          tagName.toLowerCase().includes(cat.toLowerCase())
        )
      );
      
      res.json({
        tag: tagName,
        flightPackages: matchingPackages,
        landTours: matchingTours.slice(0, 50) // Limit to 50 tours per collection
      });
    } catch (error: any) {
      console.error("Error fetching collection:", error);
      res.status(500).json({ error: "Failed to fetch collection" });
    }
  });

  // Get all packages including unpublished (admin)
  app.get("/api/admin/packages", verifyAdminSession, async (req, res) => {
    try {
      const packages = await storage.getAllFlightPackages();
      res.json(packages);
    } catch (error: any) {
      console.error("Error fetching packages:", error);
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  // Create new package (admin)
  app.post("/api/admin/packages", verifyAdminSession, async (req, res) => {
    try {
      const parseResult = insertFlightPackageSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        console.error("Package validation failed:", JSON.stringify(parseResult.error.errors, null, 2));
        console.error("Request body keys:", Object.keys(req.body));
        console.error("Slug value:", req.body.slug);
        console.error("Title value:", req.body.title);
        console.error("Category value:", req.body.category);
        console.error("Price value:", req.body.price);
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors 
        });
      }
      
      // Try to create the package, handling duplicate slug errors
      let packageData = parseResult.data;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          const pkg = await storage.createFlightPackage(packageData);
          return res.status(201).json(pkg);
        } catch (createError: any) {
          // Check if it's a duplicate slug error
          if (createError.code === '23505' && createError.constraint === 'flight_packages_slug_unique') {
            attempts++;
            // Append a unique suffix to the slug
            const suffix = `-${Date.now().toString(36).slice(-4)}`;
            packageData = {
              ...packageData,
              slug: parseResult.data.slug + suffix
            };
            console.log(`Slug collision, trying with new slug: ${packageData.slug}`);
          } else {
            throw createError;
          }
        }
      }
      
      throw new Error("Failed to create package after multiple attempts due to slug conflicts");
    } catch (error: any) {
      console.error("Error creating package:", error);
      res.status(500).json({ error: error.message || "Failed to create package" });
    }
  });

  // Update package (admin)
  app.patch("/api/admin/packages/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const parseResult = updateFlightPackageSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        console.error("Package PATCH validation failed:", JSON.stringify(parseResult.error.errors, null, 2));
        console.error("Request body:", JSON.stringify(req.body, null, 2).slice(0, 1000));
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors 
        });
      }
      
      const pkg = await storage.updateFlightPackage(parseInt(id), parseResult.data);
      
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      // Sync media usage tracking (non-blocking)
      try {
        await mediaService.syncPackageMediaUsage(
          pkg.id,
          pkg.featuredImage || null,
          pkg.gallery || []
        );
      } catch (syncError) {
        console.error("Error syncing media usage:", syncError);
        // Don't fail the request if media sync fails
      }
      
      res.json(pkg);
    } catch (error: any) {
      console.error("Error updating package:", error);
      res.status(500).json({ error: error.message || "Failed to update package" });
    }
  });

  // Delete package (admin)
  app.delete("/api/admin/packages/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFlightPackage(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting package:", error);
      res.status(500).json({ error: "Failed to delete package" });
    }
  });

  // Get package pricing (admin)
  app.get("/api/admin/packages/:id/pricing", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const pricing = await storage.getPackagePricing(parseInt(id));
      res.json(pricing);
    } catch (error: any) {
      console.error("Error fetching package pricing:", error);
      res.status(500).json({ error: "Failed to fetch pricing" });
    }
  });

  // Add package pricing entries (admin)
  app.post("/api/admin/packages/:id/pricing", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { entries } = req.body;
      
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "No pricing entries provided" });
      }
      
      // Validate and prepare entries
      const pricingEntries = entries.map((entry: any) => ({
        packageId: parseInt(id),
        departureAirport: entry.departureAirport,
        departureAirportName: entry.departureAirportName,
        departureDate: entry.departureDate,
        price: entry.price,
        currency: entry.currency || 'GBP',
        isAvailable: entry.isAvailable !== false,
      }));
      
      const created = await storage.createPackagePricingBatch(pricingEntries);
      res.status(201).json({ success: true, created: created.length, entries: created });
    } catch (error: any) {
      console.error("Error creating package pricing:", error);
      res.status(500).json({ error: "Failed to create pricing" });
    }
  });

  // Delete a single pricing entry (admin)
  app.delete("/api/admin/packages/:packageId/pricing/:pricingId", verifyAdminSession, async (req, res) => {
    try {
      const { pricingId } = req.params;
      await storage.deletePackagePricing(parseInt(pricingId));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting pricing entry:", error);
      res.status(500).json({ error: "Failed to delete pricing" });
    }
  });

  // Delete all pricing for a package (admin)
  app.delete("/api/admin/packages/:id/pricing", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePackagePricingByPackage(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting package pricing:", error);
      res.status(500).json({ error: "Failed to delete pricing" });
    }
  });

  // ==================== Package Seasons Admin Routes ====================
  
  // Get seasons for a package
  app.get("/api/admin/packages/:id/seasons", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const seasons = await storage.getPackageSeasons(parseInt(id));
      res.json(seasons);
    } catch (error: any) {
      console.error("Error fetching package seasons:", error);
      res.status(500).json({ error: "Failed to fetch seasons" });
    }
  });

  // Create a season for a package
  app.post("/api/admin/packages/:id/seasons", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const seasonData = { ...req.body, packageId: parseInt(id) };
      const created = await storage.createPackageSeason(seasonData);
      res.status(201).json(created);
    } catch (error: any) {
      console.error("Error creating package season:", error);
      res.status(500).json({ error: "Failed to create season" });
    }
  });

  // Update a season
  app.patch("/api/admin/seasons/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updatePackageSeason(parseInt(id), req.body);
      if (!updated) {
        return res.status(404).json({ error: "Season not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating package season:", error);
      res.status(500).json({ error: "Failed to update season" });
    }
  });

  // Delete a season
  app.delete("/api/admin/seasons/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePackageSeason(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting package season:", error);
      res.status(500).json({ error: "Failed to delete season" });
    }
  });

  // Delete all seasons for a package
  app.delete("/api/admin/packages/:id/seasons", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePackageSeasonsByPackage(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting package seasons:", error);
      res.status(500).json({ error: "Failed to delete seasons" });
    }
  });

  // ==================== Bokun Departures Routes ====================

  // Sync departures from Bokun for a package
  app.post("/api/admin/packages/:id/sync-departures", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const pkg = await storage.getFlightPackageById(parseInt(id));
      
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      if (!pkg.bokunProductId) {
        return res.status(400).json({ error: "Package has no linked Bokun product" });
      }
      
      // Get exchange rate from settings
      const exchangeRate = await storage.getExchangeRate();
      
      console.log(`[SyncDepartures] Syncing departures for package ${id} (Bokun product ${pkg.bokunProductId})`);
      
      // Fetch departures from Bokun (also extracts duration from product details)
      const { departures, totalRates, durationNights } = await syncBokunDepartures(pkg.bokunProductId, exchangeRate);
      
      if (departures.length === 0) {
        return res.json({ 
          success: true, 
          message: "No departures found in Bokun for the next 12 months",
          departuresCount: 0,
          ratesCount: 0,
          durationNights
        });
      }
      
      // Store departures in database (includes durationNights extracted from Bokun)
      const result = await storage.syncBokunDepartures(parseInt(id), pkg.bokunProductId, departures, durationNights);
      
      res.json({
        success: true,
        message: `Synced ${result.departuresCount} departures with ${result.ratesCount} rates`,
        departuresCount: result.departuresCount,
        ratesCount: result.ratesCount,
        durationNights,
        lastSyncedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error syncing Bokun departures:", error);
      res.status(500).json({ error: error.message || "Failed to sync departures" });
    }
  });

  // Get departures for a package
  app.get("/api/admin/packages/:id/departures", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const departures = await storage.getBokunDepartures(parseInt(id));
      res.json(departures);
    } catch (error: any) {
      console.error("Error fetching Bokun departures:", error);
      res.status(500).json({ error: "Failed to fetch departures" });
    }
  });

  // Update flight pricing for a departure rate
  app.patch("/api/admin/departure-rates/:id/flight-pricing", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { flightPriceGbp, departureAirport } = req.body;
      
      const updated = await storage.updateDepartureRateFlightPricing(
        parseInt(id), 
        flightPriceGbp, 
        departureAirport
      );
      
      if (!updated) {
        return res.status(404).json({ error: "Departure rate not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating departure rate flight pricing:", error);
      res.status(500).json({ error: "Failed to update flight pricing" });
    }
  });

  // Fetch flight prices for all Bokun departure rates
  app.post("/api/admin/packages/fetch-bokun-departure-flights", verifyAdminSession, async (req, res) => {
    try {
      const { 
        packageId, 
        destinationAirport, 
        returnAirport, // For open-jaw: where return flight departs from
        departureAirports, 
        duration: requestDuration, 
        markup,
        flightType = "roundtrip", // "roundtrip" or "openjaw"
        flightApiSource = "european" // "european" or "serp"
      } = req.body;
      
      if (!packageId || !destinationAirport || !departureAirports || departureAirports.length === 0) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      // For open-jaw, require return airport
      if (flightType === "openjaw" && !returnAirport) {
        return res.status(400).json({ error: "Return airport is required for open-jaw flights" });
      }
      
      // Get all departures for this package
      const departures = await storage.getBokunDepartures(packageId);
      
      if (departures.length === 0) {
        return res.json({ success: true, updated: 0, message: "No departures found" });
      }
      
      // Use stored duration from Bokun product, or fall back to request param, or default to 7
      const storedDuration = departures[0]?.durationNights;
      const duration = requestDuration || storedDuration || 7;
      
      console.log(`[BokunFlights] Fetching ${flightType} flights for package ${packageId}`);
      if (flightType === "openjaw") {
        console.log(`[BokunFlights] Outbound to: ${destinationAirport}, Return from: ${returnAirport}, Duration: ${duration} nights, Markup: ${markup}%`);
      } else {
        console.log(`[BokunFlights] Destination: ${destinationAirport}, Duration: ${duration} nights, Markup: ${markup}%`);
      }
      console.log(`[BokunFlights] UK Airports: ${departureAirports.join(", ")}`);
      
      // Collect unique departure dates
      const uniqueDates = Array.from(new Set(departures.map(d => d.departureDate)));
      console.log(`[BokunFlights] Found ${uniqueDates.length} unique departure dates, API source: ${flightApiSource}`);
      
      // Fetch flight prices - either SERP API or European API
      const flightPrices: Record<string, Record<string, number>> = {}; // date -> { airport: price }
      
      // Get date range
      const sortedDates = [...uniqueDates].sort();
      
      try {
        // ===== SERP API PATH =====
        if (flightApiSource === "serp") {
          if (!isSerpApiConfigured()) {
            return res.status(400).json({ error: "SERPAPI_KEY is not configured" });
          }
          
          console.log(`[BokunFlights] Using SERP API for ${flightType} flights`);
          
          if (flightType === "openjaw") {
            // SERP API Open-jaw search
            const openJawOffers = await searchOpenJawFlights({
              ukAirports: departureAirports,
              arriveAirport: destinationAirport,
              departAirport: returnAirport,
              startDate: sortedDates[0],
              endDate: sortedDates[sortedDates.length - 1],
              nights: duration,
              specificDates: uniqueDates, // Use exact Bokun availability dates
            });
            
            console.log(`[BokunFlights] SERP API returned ${openJawOffers.length} open-jaw offers`);
            
            // Get cheapest per date/airport
            const cheapestByDateAirport = getCheapestOpenJawByDateAndAirport(openJawOffers);
            const cheapestEntries = Array.from(cheapestByDateAirport.entries());
            
            for (const [dateAirport, bestOffer] of cheapestEntries) {
              const [date, airport] = dateAirport.split("|"); // SERP uses | as delimiter
              if (!uniqueDates.includes(date)) continue;
              
              // OpenJawFlightOffer has pricePerPerson which is the combined total
              const combinedPrice = bestOffer.pricePerPerson + BAGGAGE_SURCHARGE_GBP;
              const markedUpPrice = Math.round(combinedPrice * (1 + (markup || 0) / 100));
              
              if (!flightPrices[date]) flightPrices[date] = {};
              flightPrices[date][airport] = markedUpPrice;
            }
          } else {
            // SERP API Round-trip search
            const flightOffers = await searchSerpFlights({
              departAirports: departureAirports,
              arriveAirport: destinationAirport,
              startDate: sortedDates[0],
              endDate: sortedDates[sortedDates.length - 1],
              nights: duration,
              specificDates: uniqueDates, // Use exact Bokun availability dates
            });
            
            console.log(`[BokunFlights] SERP API returned ${flightOffers.length} flight offers`);
            
            // Get cheapest per date/airport
            const cheapestByDateAirport = getCheapestSerpFlightsByDateAndAirport(flightOffers);
            const cheapestEntries = Array.from(cheapestByDateAirport.entries());
            
            for (const [dateAirport, offer] of cheapestEntries) {
              const [date, airport] = dateAirport.split("|"); // SERP uses | as delimiter
              if (!uniqueDates.includes(date)) continue;
              
              const priceWithBaggage = offer.pricePerPerson + BAGGAGE_SURCHARGE_GBP;
              const markedUpPrice = Math.round(priceWithBaggage * (1 + (markup || 0) / 100));
              
              if (!flightPrices[date]) flightPrices[date] = {};
              flightPrices[date][airport] = markedUpPrice;
            }
            console.log(`[BokunFlights] SERP: Populated ${Object.keys(flightPrices).length} dates from ${cheapestEntries.length} cheapest entries`);
          }
        } else {
          // ===== EUROPEAN API PATH =====
          // Format dates for Sunshine API (DD/MM/YYYY)
          const formatDateForApi = (isoDate: string): string => {
            const [year, month, day] = isoDate.split("-");
            return `${day}/${month}/${year}`;
          };
          
          const startDate = formatDateForApi(sortedDates[0]);
          const endDate = formatDateForApi(sortedDates[sortedDates.length - 1]);
          
          // Build pipe-separated airport list
          const airportList = departureAirports.join("|");
          
        if (flightType === "openjaw") {
          // ===== OPEN-JAW: Search outbound + return one-way flights separately =====
          console.log(`[BokunFlights] Open-jaw mode: searching one-way flights`);
          
          // Calculate return date for each departure date using a map for correct pairing
          const returnDateMap: Record<string, string> = {};
          const allReturnDates: string[] = [];
          for (const depDate of uniqueDates) {
            const returnDate = new Date(depDate);
            returnDate.setDate(returnDate.getDate() + duration);
            const returnDateIso = returnDate.toISOString().split("T")[0];
            returnDateMap[depDate] = returnDateIso;
            allReturnDates.push(returnDateIso);
          }
          const sortedReturnDates = Array.from(new Set(allReturnDates)).sort();
          
          // Batch dates into 90-day chunks for open-jaw
          const BATCH_SIZE_DAYS = 90;
          
          // Helper to create date batches
          const createDateBatches = (dates: string[]) => {
            const batches: { startDate: string; endDate: string; dates: string[] }[] = [];
            let currentBatchDates: string[] = [];
            let batchStartDate = dates[0];
            
            for (const date of dates) {
              const startDateObj = new Date(batchStartDate);
              const currentDateObj = new Date(date);
              const daysDiff = Math.floor((currentDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysDiff >= BATCH_SIZE_DAYS) {
                if (currentBatchDates.length > 0) {
                  batches.push({
                    startDate: formatDateForApi(batchStartDate),
                    endDate: formatDateForApi(currentBatchDates[currentBatchDates.length - 1]),
                    dates: [...currentBatchDates]
                  });
                }
                batchStartDate = date;
                currentBatchDates = [date];
              } else {
                currentBatchDates.push(date);
              }
            }
            
            if (currentBatchDates.length > 0) {
              batches.push({
                startDate: formatDateForApi(batchStartDate),
                endDate: formatDateForApi(currentBatchDates[currentBatchDates.length - 1]),
                dates: currentBatchDates
              });
            }
            
            return batches;
          };
          
          const outboundBatches = createDateBatches(sortedDates);
          const returnBatches = createDateBatches(sortedReturnDates);
          
          console.log(`[BokunFlights] Split outbound into ${outboundBatches.length} batches, return into ${returnBatches.length} batches`);
          
          // Collect all flights from batches
          const outboundPrices: Record<string, Record<string, number>> = {};
          const returnPrices: Record<string, Record<string, number>> = {};
          
          // 1. Fetch OUTBOUND one-way flights (UK → destination) in batches
          for (let batchIndex = 0; batchIndex < outboundBatches.length; batchIndex++) {
            const batch = outboundBatches[batchIndex];
            console.log(`[BokunFlights] Outbound batch ${batchIndex + 1}/${outboundBatches.length}: ${batch.dates.length} dates`);
            
            const outboundUrl = new URL("http://87.102.127.86:8119/owflights/owflights.dll");
            outboundUrl.searchParams.set("agtid", "122");
            outboundUrl.searchParams.set("depart", airportList);
            outboundUrl.searchParams.set("Arrive", destinationAirport);
            outboundUrl.searchParams.set("startdate", batch.startDate);
            outboundUrl.searchParams.set("enddate", batch.endDate);
            
            const outboundController = new AbortController();
            const outboundTimeout = setTimeout(() => outboundController.abort(), 60000);
            
            const outboundResponse = await fetch(outboundUrl.toString(), {
              method: "GET",
              headers: { "Accept": "application/json" },
              signal: outboundController.signal,
            });
            
            clearTimeout(outboundTimeout);
            
            if (!outboundResponse.ok) {
              throw new Error(`Outbound API returned ${outboundResponse.status}`);
            }
            
            const outboundRaw = await outboundResponse.text();
            if (outboundRaw.startsWith("<?xml") || outboundRaw.includes("<Error>")) {
              const errorMatch = outboundRaw.match(/<Error>(.*?)<\/Error>/i);
              throw new Error(errorMatch ? errorMatch[1] : "Unknown error from Sunshine outbound API");
            }
            
            if (!outboundRaw.startsWith("{") && (outboundRaw.includes("upstream") || outboundRaw.includes("Bad Gateway") || outboundRaw.includes("Service Unavailable"))) {
              console.error(`[BokunFlights] Proxy error from outbound API:`, outboundRaw.substring(0, 200));
              throw new Error("Flight API temporarily unavailable. Please try again in a few seconds.");
            }
            
            let outboundData;
            try {
              outboundData = JSON.parse(outboundRaw);
            } catch (parseErr) {
              console.error(`[BokunFlights] Invalid JSON from outbound API:`, outboundRaw.substring(0, 200));
              throw new Error("Flight API returned invalid data. Please try again.");
            }
            
            const outboundFlights = outboundData.Flights || [];
            console.log(`[BokunFlights] Outbound batch ${batchIndex + 1}: Found ${outboundFlights.length} flights`);
            
            // Build cheapest outbound prices per date/airport
            for (const flight of outboundFlights) {
              const datePart = flight.Depart?.split(" ")[0];
              if (!datePart) continue;
              
              const [day, month, year] = datePart.split("/");
              const isoDate = `${year}-${month}-${day}`;
              
              if (!uniqueDates.includes(isoDate)) continue;
              
              const airport = flight.Depapt;
              const price = parseFloat(flight.Fltprice);
              
              if (!airport || isNaN(price)) continue;
              
              if (!outboundPrices[isoDate]) outboundPrices[isoDate] = {};
              if (!outboundPrices[isoDate][airport] || price < outboundPrices[isoDate][airport]) {
                outboundPrices[isoDate][airport] = price;
              }
            }
            
            if (batchIndex < outboundBatches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          // 2. Fetch RETURN one-way flights (returnAirport → UK) in batches
          const returnDepartureAirport = returnAirport || destinationAirport;
          
          for (let batchIndex = 0; batchIndex < returnBatches.length; batchIndex++) {
            const batch = returnBatches[batchIndex];
            console.log(`[BokunFlights] Return batch ${batchIndex + 1}/${returnBatches.length}: ${batch.dates.length} dates`);
            
            const returnUrl = new URL("http://87.102.127.86:8119/owflights/owflights.dll");
            returnUrl.searchParams.set("agtid", "122");
            returnUrl.searchParams.set("depart", returnDepartureAirport);
            returnUrl.searchParams.set("Arrive", airportList);
            returnUrl.searchParams.set("startdate", batch.startDate);
            returnUrl.searchParams.set("enddate", batch.endDate);
            
            const returnController = new AbortController();
            const returnTimeout = setTimeout(() => returnController.abort(), 60000);
            
            const returnResponse = await fetch(returnUrl.toString(), {
              method: "GET",
              headers: { "Accept": "application/json" },
              signal: returnController.signal,
            });
            
            clearTimeout(returnTimeout);
            
            if (!returnResponse.ok) {
              throw new Error(`Return API returned ${returnResponse.status}`);
            }
            
            const returnRaw = await returnResponse.text();
            if (returnRaw.startsWith("<?xml") || returnRaw.includes("<Error>")) {
              const errorMatch = returnRaw.match(/<Error>(.*?)<\/Error>/i);
              throw new Error(errorMatch ? errorMatch[1] : "Unknown error from Sunshine return API");
            }
            
            if (!returnRaw.startsWith("{") && (returnRaw.includes("upstream") || returnRaw.includes("Bad Gateway") || returnRaw.includes("Service Unavailable"))) {
              console.error(`[BokunFlights] Proxy error from return API:`, returnRaw.substring(0, 200));
              throw new Error("Flight API temporarily unavailable. Please try again in a few seconds.");
            }
            
            let returnData;
            try {
              returnData = JSON.parse(returnRaw);
            } catch (parseErr) {
              console.error(`[BokunFlights] Invalid JSON from return API:`, returnRaw.substring(0, 200));
              throw new Error("Flight API returned invalid data. Please try again.");
            }
            
            const returnFlights = returnData.Flights || [];
            console.log(`[BokunFlights] Return batch ${batchIndex + 1}: Found ${returnFlights.length} flights`);
            
            // Build cheapest return prices per date/airport
            for (const flight of returnFlights) {
              const datePart = flight.Depart?.split(" ")[0];
              if (!datePart) continue;
              
              const [day, month, year] = datePart.split("/");
              const isoDate = `${year}-${month}-${day}`;
              
              const airport = flight.Arrapt;
              const price = parseFloat(flight.Fltprice);
              
              if (!airport || isNaN(price)) continue;
              
              if (!returnPrices[isoDate]) returnPrices[isoDate] = {};
              if (!returnPrices[isoDate][airport] || price < returnPrices[isoDate][airport]) {
                returnPrices[isoDate][airport] = price;
              }
            }
            
            if (batchIndex < returnBatches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          console.log(`[BokunFlights] Finished all batches. Outbound: ${Object.keys(outboundPrices).length} dates, Return: ${Object.keys(returnPrices).length} dates`);
          
          // Combine outbound + return for each departure date using the map
          for (const depDate of uniqueDates) {
            const returnDate = returnDateMap[depDate];
            if (!returnDate) continue;
            
            const outbound = outboundPrices[depDate] || {};
            const returns = returnPrices[returnDate] || {};
            
            // For each UK airport, combine outbound + return prices
            for (const airport of departureAirports) {
              const outPrice = outbound[airport];
              const retPrice = returns[airport];
              
              if (outPrice !== undefined && retPrice !== undefined) {
                const totalFlightPrice = outPrice + retPrice;
                
                if (!flightPrices[depDate]) flightPrices[depDate] = {};
                flightPrices[depDate][airport] = totalFlightPrice;
                
                console.log(`[BokunFlights] Open-jaw ${airport}: out £${outPrice} + ret £${retPrice} = £${totalFlightPrice} on ${depDate}`);
              }
            }
          }
          
        } else {
          // ===== ROUND-TRIP: Use existing searchoffers.dll endpoint =====
          // Batch dates into 90-day chunks to avoid API timeouts with large date ranges
          const BATCH_SIZE_DAYS = 90;
          const dateBatches: { startDate: string; endDate: string; dates: string[] }[] = [];
          
          // Split sorted dates into chunks
          let currentBatchDates: string[] = [];
          let batchStartDate = sortedDates[0];
          
          for (const date of sortedDates) {
            const startDateObj = new Date(batchStartDate);
            const currentDateObj = new Date(date);
            const daysDiff = Math.floor((currentDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDiff >= BATCH_SIZE_DAYS) {
              // Save current batch and start new one
              if (currentBatchDates.length > 0) {
                dateBatches.push({
                  startDate: formatDateForApi(batchStartDate),
                  endDate: formatDateForApi(currentBatchDates[currentBatchDates.length - 1]),
                  dates: [...currentBatchDates]
                });
              }
              batchStartDate = date;
              currentBatchDates = [date];
            } else {
              currentBatchDates.push(date);
            }
          }
          
          // Don't forget the last batch
          if (currentBatchDates.length > 0) {
            dateBatches.push({
              startDate: formatDateForApi(batchStartDate),
              endDate: formatDateForApi(currentBatchDates[currentBatchDates.length - 1]),
              dates: currentBatchDates
            });
          }
          
          console.log(`[BokunFlights] Split ${sortedDates.length} dates into ${dateBatches.length} batches of ~${BATCH_SIZE_DAYS} days`);
          
          // Process each batch
          for (let batchIndex = 0; batchIndex < dateBatches.length; batchIndex++) {
            const batch = dateBatches[batchIndex];
            console.log(`[BokunFlights] Processing batch ${batchIndex + 1}/${dateBatches.length}: ${batch.dates.length} dates (${batch.startDate} to ${batch.endDate})`);
            
            const flightApiUrl = new URL("http://87.102.127.86:8119/search/searchoffers.dll");
            flightApiUrl.searchParams.set("agtid", "122");
            flightApiUrl.searchParams.set("page", "FLTDATE");
            flightApiUrl.searchParams.set("platform", "WEB");
            flightApiUrl.searchParams.set("depart", airportList);
            flightApiUrl.searchParams.set("arrive", destinationAirport);
            flightApiUrl.searchParams.set("Startdate", batch.startDate);
            flightApiUrl.searchParams.set("EndDate", batch.endDate);
            flightApiUrl.searchParams.set("duration", duration.toString());
            flightApiUrl.searchParams.set("output", "JSON");
            
            console.log(`[BokunFlights] Calling Sunshine API: ${flightApiUrl.toString()}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            
            const response = await fetch(flightApiUrl.toString(), {
              method: "GET",
              headers: { "Accept": "application/json" },
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              throw new Error(`Sunshine API returned ${response.status}`);
            }
            
            const rawText = await response.text();
            
            // Check for XML error response
            if (rawText.startsWith("<?xml") || rawText.includes("<Error>")) {
              const errorMatch = rawText.match(/<Error>(.*?)<\/Error>/i);
              throw new Error(errorMatch ? errorMatch[1] : "Unknown error from Sunshine API");
            }
            
            // Check for upstream/proxy error responses (IIS errors) - but not valid JSON with Offers
            if (!rawText.startsWith("{") && (rawText.includes("upstream") || rawText.includes("Bad Gateway") || rawText.includes("Service Unavailable"))) {
              console.error(`[BokunFlights] Proxy error from Sunshine API:`, rawText.substring(0, 200));
              throw new Error("Flight API temporarily unavailable. Please try again in a few seconds.");
            }
            
            // Try to parse JSON, with better error message
            let data;
            try {
              data = JSON.parse(rawText);
            } catch (parseErr) {
              console.error(`[BokunFlights] Invalid JSON from Sunshine API:`, rawText.substring(0, 200));
              throw new Error("Flight API returned invalid data. Please try again.");
            }
            const offers = data.Offers || [];
            
            console.log(`[BokunFlights] Batch ${batchIndex + 1}: Sunshine API returned ${offers.length} flight offers`);
            
            // Parse offers and find cheapest per date/airport
            for (const offer of offers) {
              // Extract departure date (DD/MM/YYYY from outdep like "06/02/2026 10:30")
              const outdepParts = offer.outdep?.split(" ") || [];
              const datePart = outdepParts[0]; // DD/MM/YYYY
              
              if (!datePart) continue;
              
              // Convert DD/MM/YYYY to YYYY-MM-DD
              const [day, month, year] = datePart.split("/");
              const isoDate = `${year}-${month}-${day}`;
              
              // Check if this date is in our list
              if (!uniqueDates.includes(isoDate)) continue;
              
              const airport = offer.depapt; // Departure airport code
              const price = parseFloat(offer.fltnetpricepp); // Flight price per person
              
              if (!airport || isNaN(price)) continue;
              
              // Initialize date object if needed
              if (!flightPrices[isoDate]) {
                flightPrices[isoDate] = {};
              }
              
              // Keep cheapest price per date/airport
              if (!flightPrices[isoDate][airport] || price < flightPrices[isoDate][airport]) {
                flightPrices[isoDate][airport] = price;
              }
            }
            
            // Small delay between batches to avoid overwhelming the API
            if (batchIndex < dateBatches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          console.log(`[BokunFlights] Finished all batches. Found prices for ${Object.keys(flightPrices).length} dates`);
        }
        } // Close European API else block
      } catch (err: any) {
        console.error(`[BokunFlights] Error fetching from Sunshine API:`, err.message);
        return res.status(500).json({ error: `Flight API error: ${err.message}` });
      }
      
      // Now upsert flight prices into the child table (per rate, per airport)
      let updatedCount = 0;
      
      for (const departure of departures) {
        const dateFlights = flightPrices[departure.departureDate] || {};
        
        for (const rate of departure.rates || []) {
          // For each UK airport that has a price for this date
          for (const [airport, flightPrice] of Object.entries(dateFlights)) {
            // Calculate total before markup (land tour + flight)
            const subtotal = (rate.priceGbp || 0) + (flightPrice as number);
            
            // Apply markup to TOTAL combined price
            const withMarkup = subtotal * (1 + (markup || 0) / 100);
            
            // Apply smart rounding to combined price (x49, x69, x99)
            const smartRoundedPrice = smartRound(withMarkup);
            
            // Upsert into the child table (one row per rate/airport combination)
            await storage.upsertDepartureRateFlight(
              rate.id,
              airport,
              flightPrice as number,
              smartRoundedPrice,
              markup,
              flightApiSource === "serp" ? "serp" : "sunshine"
            );
            updatedCount++;
          }
        }
      }
      
      console.log(`[BokunFlights] Upserted ${updatedCount} departure rate flight entries`);
      
      // Save auto-refresh config for scheduled weekly updates
      const autoRefreshEnabled = req.body.autoRefreshEnabled !== false;
      try {
        await storage.updateFlightPackageAutoRefreshConfig(
          packageId,
          {
            destinationAirport,
            returnAirport: flightType === "openjaw" ? returnAirport : undefined,
            departureAirports,
            markup: typeof markup === 'number' ? markup : 0,
            flightType: flightType as "roundtrip" | "openjaw"
          },
          autoRefreshEnabled
        );
        console.log(`[BokunFlights] Auto-refresh config saved for package ${packageId}, enabled: ${autoRefreshEnabled}, flightType: ${flightType}`);
      } catch (configError: any) {
        console.error(`[BokunFlights] Failed to save auto-refresh config:`, configError.message);
        // Continue without failing the entire request - flight prices were already saved
      }
      
      // Auto-update the lead price shown in banners/cards
      let leadPriceResult: { updated: boolean; newPrice?: number; newSinglePrice?: number } = { updated: false };
      try {
        leadPriceResult = await storage.updatePackageLeadPriceFromFlights(packageId);
        if (leadPriceResult.updated) {
          console.log(`[BokunFlights] Lead price updated: twin=${leadPriceResult.newPrice}, single=${leadPriceResult.newSinglePrice}`);
        }
      } catch (leadPriceError: any) {
        console.error(`[BokunFlights] Failed to update lead price:`, leadPriceError.message);
      }
      
      res.json({ 
        success: true, 
        updated: updatedCount,
        flightDates: Object.keys(flightPrices).length,
        autoRefreshEnabled,
        leadPriceUpdated: leadPriceResult.updated,
        newLeadPrice: leadPriceResult.newPrice,
        newSinglePrice: leadPriceResult.newSinglePrice
      });
    } catch (error: any) {
      console.error("Error fetching Bokun departure flights:", error);
      res.status(500).json({ error: error.message || "Failed to fetch flight prices" });
    }
  });

  // ==================== Pricing Export History Routes ====================
  
  // Get pricing exports for a package
  app.get("/api/admin/packages/:id/exports", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const exports = await storage.getPricingExports(parseInt(id));
      res.json(exports);
    } catch (error: any) {
      console.error("Error fetching pricing exports:", error);
      res.status(500).json({ error: "Failed to fetch exports" });
    }
  });

  // Generate pricing by combining flight prices with seasonal land costs
  app.post("/api/admin/packages/:id/generate-pricing", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        flightApi, 
        departAirports, 
        arriveAirportCode, 
        durationNights, 
        searchStartDate, 
        searchEndDate, 
        seasons 
      } = req.body;

      if (!flightApi || !departAirports || !arriveAirportCode || !searchStartDate || !searchEndDate) {
        return res.status(400).json({ error: "Missing required configuration" });
      }

      if (!seasons || !Array.isArray(seasons) || seasons.length === 0) {
        return res.status(400).json({ error: "At least one season is required" });
      }

      console.log(`[PricingGenerator] Generating for package ${id} using ${flightApi} API`);
      console.log(`[PricingGenerator] Destination: ${arriveAirportCode}, Duration: ${durationNights} nights`);
      console.log(`[PricingGenerator] Date range: ${searchStartDate} to ${searchEndDate}`);

      type PricingRow = {
        date: string;
        departureAirport: string;
        departureAirportName: string;
        flightPrice: number;
        landCost: number;
        hotelCost: number;
        totalCost: number;
        seasonName: string;
      };

      const results: PricingRow[] = [];

      // Helper to find which season a date falls into
      const findSeasonForDate = (dateStr: string): { name: string; landCost: number; hotelCost: number } | null => {
        const date = new Date(dateStr);
        for (const season of seasons) {
          const start = new Date(season.startDate);
          const end = new Date(season.endDate);
          if (date >= start && date <= end) {
            return {
              name: season.seasonName,
              landCost: season.landCostPerPerson || 0,
              hotelCost: season.hotelCostPerPerson || 0,
            };
          }
        }
        return null;
      };

      if (flightApi === "serp") {
        // Use SERP API (Google Flights)
        if (!isSerpApiConfigured()) {
          return res.status(400).json({ error: "SERPAPI_KEY is not configured" });
        }

        const airportArray = departAirports.split("|").filter((a: string) => a.trim());
        
        const flightOffers = await searchSerpFlights({
          departAirports: airportArray,
          arriveAirport: arriveAirportCode,
          nights: durationNights,
          startDate: searchStartDate,
          endDate: searchEndDate,
        });

        // Get cheapest flight per date/airport
        const cheapestFlights = getCheapestSerpFlightsByDateAndAirport(flightOffers);

        for (const [key, flight] of Array.from(cheapestFlights.entries())) {
          const season = findSeasonForDate(flight.departureDate);
          if (!season) continue; // Skip dates not covered by any season

          results.push({
            date: flight.departureDate,
            departureAirport: flight.departureAirport,
            departureAirportName: flight.departureAirportName,
            flightPrice: Math.round(flight.pricePerPerson * 100) / 100,
            landCost: season.landCost,
            hotelCost: season.hotelCost,
            totalCost: Math.round((flight.pricePerPerson + season.landCost + season.hotelCost) * 100) / 100,
            seasonName: season.name,
          });
        }
      } else {
        // Use European API (Sunshine)
        // Convert dates to DD/MM/YYYY format for European API
        const formatForEuropeanApi = (isoDate: string) => {
          const [year, month, day] = isoDate.split("-");
          return `${day}/${month}/${year}`;
        };

        try {
          const flightOffers = await searchFlights({
            departAirports,
            arriveAirport: arriveAirportCode,
            nights: durationNights,
            startDate: formatForEuropeanApi(searchStartDate),
            endDate: formatForEuropeanApi(searchEndDate),
          });

          // Group by date and airport, get cheapest
          const cheapestByDateAirport = new Map<string, { price: number; airport: string; airportName: string }>();
          
          for (const offer of flightOffers) {
            // outdep format is "DD/MM/YYYY HH:mm", extract just the date part
            const datePart = offer.outdep.split(" ")[0];
            const [day, month, year] = datePart.split("/");
            const isoDate = `${year}-${month}-${day}`;
            const key = `${isoDate}|${offer.depapt}`;
            
            // Parse price from string
            const flightPrice = parseFloat(offer.fltSellpricepp) || 0;
            
            const existing = cheapestByDateAirport.get(key);
            if (!existing || flightPrice < existing.price) {
              cheapestByDateAirport.set(key, {
                price: flightPrice,
                airport: offer.depapt,
                airportName: offer.depname || UK_AIRPORTS_MAP[offer.depapt] || offer.depapt,
              });
            }
          }

          for (const [key, flight] of Array.from(cheapestByDateAirport.entries())) {
            const [dateStr] = key.split("|");
            const season = findSeasonForDate(dateStr);
            if (!season) continue;

            results.push({
              date: dateStr,
              departureAirport: flight.airport,
              departureAirportName: flight.airportName,
              flightPrice: Math.round(flight.price * 100) / 100,
              landCost: season.landCost,
              hotelCost: season.hotelCost,
              totalCost: Math.round((flight.price + season.landCost + season.hotelCost) * 100) / 100,
              seasonName: season.name,
            });
          }
        } catch (apiError: any) {
          console.error("[PricingGenerator] European API error:", apiError.message);
          return res.status(500).json({ error: `Flight API error: ${apiError.message}` });
        }
      }

      // Sort by date
      results.sort((a, b) => a.date.localeCompare(b.date));

      console.log(`[PricingGenerator] Generated ${results.length} pricing entries`);

      res.json({ 
        success: true, 
        results,
        summary: {
          totalEntries: results.length,
          dateRange: { start: searchStartDate, end: searchEndDate },
          flightApi,
        }
      });
    } catch (error: any) {
      console.error("[PricingGenerator] Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate pricing" });
    }
  });

  // Generate open-jaw pricing (fly into one city, out of another)
  app.post("/api/admin/packages/:id/generate-openjaw-pricing", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        ukAirports, 
        arriveAirport, 
        departAirport,
        nights, 
        searchStartDate, 
        searchEndDate, 
        hasInternalFlight,
        internalFromAirport,
        internalToAirport,
        internalDaysAfterArrival,
        seasons 
      } = req.body;

      if (!ukAirports || !arriveAirport || !departAirport || !searchStartDate || !searchEndDate) {
        return res.status(400).json({ error: "Missing required configuration" });
      }

      if (!seasons || !Array.isArray(seasons) || seasons.length === 0) {
        return res.status(400).json({ error: "At least one season is required" });
      }

      if (!isSerpApiConfigured()) {
        return res.status(400).json({ error: "SERPAPI_KEY is not configured" });
      }

      console.log(`[OpenJawPricing] Generating for package ${id}`);
      console.log(`[OpenJawPricing] Route: UK -> ${arriveAirport}, ${departAirport} -> UK`);
      console.log(`[OpenJawPricing] Duration: ${nights} nights, Date range: ${searchStartDate} to ${searchEndDate}`);

      type OpenJawPricingRow = {
        outboundDate: string;
        ukDepartureAirport: string;
        ukDepartureAirportName: string;
        outboundArrivalDate: string;
        effectiveArrivalDate: string;
        returnDate: string;
        outboundAirline: string;
        returnAirline: string;
        sameAirline: boolean;
        flightPrice: number;
        internalFlightDate?: string;
        internalFlightPrice?: number;
        landCost: number;
        hotelCost: number;
        totalCost: number;
        seasonName: string;
      };

      const results: OpenJawPricingRow[] = [];

      // Helper to find which season a date falls into
      const findSeasonForDate = (dateStr: string): { name: string; landCost: number; hotelCost: number } | null => {
        const date = new Date(dateStr);
        for (const season of seasons) {
          const start = new Date(season.startDate);
          const end = new Date(season.endDate);
          if (date >= start && date <= end) {
            return {
              name: season.seasonName,
              landCost: season.landCostPerPerson || 0,
              hotelCost: season.hotelCostPerPerson || 0,
            };
          }
        }
        return null;
      };

      // Search for open-jaw flights
      const openJawOffers = await searchOpenJawFlights({
        ukAirports: Array.isArray(ukAirports) ? ukAirports : ukAirports.split("|").filter((a: string) => a.trim()),
        arriveAirport,
        departAirport,
        nights,
        startDate: searchStartDate,
        endDate: searchEndDate,
      });

      // Get cheapest per date/airport, preferring same-airline
      const cheapestOpenJaw = getCheapestOpenJawByDateAndAirport(openJawOffers, true);
      
      console.log(`[OpenJawPricing] Found ${openJawOffers.length} total offers, ${cheapestOpenJaw.size} unique date/airport combinations`);

      // If internal flight is requested, collect all internal flight dates needed
      let internalFlightPrices = new Map<string, number>();
      
      if (hasInternalFlight && internalFromAirport && internalToAirport) {
        // Calculate all internal flight dates based on effective arrival dates
        const internalDates = new Set<string>();
        
        for (const [_, flight] of Array.from(cheapestOpenJaw.entries())) {
          // Calculate internal flight date
          const effectiveArrival = new Date(flight.effectiveArrivalDate);
          effectiveArrival.setDate(effectiveArrival.getDate() + (internalDaysAfterArrival || 0));
          const internalDate = effectiveArrival.toISOString().split('T')[0];
          internalDates.add(internalDate);
        }

        console.log(`[OpenJawPricing] Searching internal flights for ${internalDates.size} dates`);

        // Search for internal flights
        const internalOffers = await searchInternalFlights({
          fromAirport: internalFromAirport,
          toAirport: internalToAirport,
          dates: Array.from(internalDates),
        });

        // Get cheapest per date
        const cheapestInternal = getCheapestInternalByDate(internalOffers);
        
        for (const [date, offer] of Array.from(cheapestInternal.entries())) {
          internalFlightPrices.set(date, offer.pricePerPerson);
        }

        console.log(`[OpenJawPricing] Found internal flight prices for ${internalFlightPrices.size} dates`);
      }

      // Build results
      for (const [key, flight] of Array.from(cheapestOpenJaw.entries())) {
        const season = findSeasonForDate(flight.effectiveArrivalDate);
        if (!season) continue; // Skip dates not covered by any season

        // Calculate internal flight date and price
        let internalFlightDate: string | undefined;
        let internalFlightPrice: number | undefined;

        if (hasInternalFlight && internalFromAirport && internalToAirport) {
          const effectiveArrival = new Date(flight.effectiveArrivalDate);
          effectiveArrival.setDate(effectiveArrival.getDate() + (internalDaysAfterArrival || 0));
          internalFlightDate = effectiveArrival.toISOString().split('T')[0];
          internalFlightPrice = internalFlightPrices.get(internalFlightDate);
        }

        const totalCost = flight.pricePerPerson + 
          (internalFlightPrice || 0) + 
          season.landCost + 
          season.hotelCost;

        results.push({
          outboundDate: flight.outboundDate,
          ukDepartureAirport: flight.ukDepartureAirport,
          ukDepartureAirportName: flight.ukDepartureAirportName,
          outboundArrivalDate: flight.outboundArrivalDate,
          effectiveArrivalDate: flight.effectiveArrivalDate,
          returnDate: flight.returnDate,
          outboundAirline: flight.outboundAirline,
          returnAirline: flight.returnAirline,
          sameAirline: flight.sameAirline,
          flightPrice: Math.round(flight.pricePerPerson * 100) / 100,
          internalFlightDate,
          internalFlightPrice: internalFlightPrice ? Math.round(internalFlightPrice * 100) / 100 : undefined,
          landCost: season.landCost,
          hotelCost: season.hotelCost,
          totalCost: Math.round(totalCost * 100) / 100,
          seasonName: season.name,
        });
      }

      // Sort by date
      results.sort((a, b) => a.outboundDate.localeCompare(b.outboundDate));

      const sameAirlineCount = results.filter(r => r.sameAirline).length;
      console.log(`[OpenJawPricing] Generated ${results.length} pricing entries (${sameAirlineCount} same-airline)`);

      res.json({ 
        success: true, 
        results,
        sameAirlineCount,
        summary: {
          totalEntries: results.length,
          sameAirlineEntries: sameAirlineCount,
          dateRange: { start: searchStartDate, end: searchEndDate },
          route: `UK -> ${arriveAirport}, ${departAirport} -> UK`,
          hasInternalFlight,
        }
      });
    } catch (error: any) {
      console.error("[OpenJawPricing] Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate open-jaw pricing" });
    }
  });

  // Fetch SERP/European flight prices, combine with seasonal land costs, and SAVE to database
  app.post("/api/admin/packages/fetch-serp-flight-prices", verifyAdminSession, async (req, res) => {
    try {
      const { 
        packageId, 
        destinationAirport, 
        departureAirports, 
        duration, 
        startDate, 
        endDate, 
        markup,
        seasons,
        flightApiSource = "serp",
        // Open-jaw parameters
        flightType = "round_trip",
        openJawArriveAirport,
        openJawDepartAirport,
        // Internal flight parameters
        hasInternalFlight = false,
        internalFromAirport,
        internalToAirport,
        internalFlightOffsetDays = 1,
      } = req.body;

      const isOpenJaw = flightType === "open_jaw";
      
      if (isOpenJaw) {
        if (!packageId || !openJawArriveAirport || !openJawDepartAirport || !departureAirports?.length || !startDate || !endDate) {
          return res.status(400).json({ error: "Missing required open-jaw parameters" });
        }
      } else {
        if (!packageId || !destinationAirport || !departureAirports?.length || !startDate || !endDate) {
          return res.status(400).json({ error: "Missing required parameters" });
        }
      }

      if (!seasons || !Array.isArray(seasons) || seasons.length === 0) {
        return res.status(400).json({ error: "At least one season is required" });
      }

      console.log(`[FetchFlightPrices] Package ${packageId}, API: ${flightApiSource}`);
      console.log(`[FetchFlightPrices] Destination: ${destinationAirport}, Duration: ${duration} nights`);
      console.log(`[FetchFlightPrices] Date range: ${startDate} to ${endDate}, Markup: ${markup}%`);
      console.log(`[FetchFlightPrices] Seasons received:`, JSON.stringify(seasons.map((s: any) => ({
        name: s.seasonName,
        start: s.startDate,
        end: s.endDate,
        landCost: s.landCostPerPerson
      }))));

      // Helper to normalize date string to YYYY-MM-DD format
      const normalizeDate = (dateStr: string): string => {
        if (!dateStr) return '';
        // Handle DD/MM/YYYY format
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Handle ISO format with time (2026-04-01T00:00:00.000Z)
        if (dateStr.includes('T')) {
          return dateStr.split('T')[0];
        }
        // Already YYYY-MM-DD
        return dateStr;
      };

      // Helper to find which season a date falls into
      const findSeasonForDate = (dateStr: string): { name: string; landCost: number; hotelCost: number } | null => {
        const normalizedDate = normalizeDate(dateStr);
        
        for (const season of seasons) {
          const startDate = normalizeDate(season.startDate);
          const endDate = normalizeDate(season.endDate);
          
          // Simple string comparison works for YYYY-MM-DD format
          if (normalizedDate >= startDate && normalizedDate <= endDate) {
            console.log(`[FetchFlightPrices] Date ${normalizedDate} matched season "${season.seasonName}" (${startDate} to ${endDate}), Land: £${season.landCostPerPerson}`);
            return {
              name: season.seasonName,
              landCost: season.landCostPerPerson || 0,
              hotelCost: season.hotelCostPerPerson || 0,
            };
          }
        }
        console.log(`[FetchFlightPrices] No season match for date ${normalizedDate}`);
        return null;
      };

      // Smart rounding helper (to x49, x69, or x99)
      const smartRound = (price: number): number => {
        const base = Math.floor(price / 100) * 100;
        const remainder = price - base;
        if (remainder <= 49) return base + 49;
        if (remainder <= 69) return base + 69;
        return base + 99;
      };

      type PricingEntry = {
        packageId: number;
        departureAirport: string;
        departureAirportName: string;
        departureDate: string;
        price: number;
        flightPricePerPerson?: number;
        internalFlightPricePerPerson?: number | null;
        landPricePerPerson?: number;
        airlineName?: string;
        currency: string;
        isAvailable: boolean;
      };

      const pricingEntries: PricingEntry[] = [];

      // Convert DD/MM/YYYY to YYYY-MM-DD for API calls
      const parseDate = (dateStr: string): string => {
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return dateStr;
      };

      const isoStartDate = parseDate(startDate);
      const isoEndDate = parseDate(endDate);

      if (flightApiSource === "serp") {
        // Use SERP API (Google Flights)
        if (!isSerpApiConfigured()) {
          return res.status(400).json({ error: "SERPAPI_KEY is not configured" });
        }

        if (isOpenJaw) {
          // OPEN-JAW SEARCH: Fly into one city, return from another
          console.log(`[FetchFlightPrices] Using SERP API OPEN-JAW for ${departureAirports.join(', ')} -> ${openJawArriveAirport}, ${openJawDepartAirport} -> UK`);
          
          const openJawOffers = await searchOpenJawFlights({
            ukAirports: departureAirports,
            arriveAirport: openJawArriveAirport,
            departAirport: openJawDepartAirport,
            nights: duration,
            startDate: isoStartDate,
            endDate: isoEndDate,
          });

          console.log(`[FetchFlightPrices] SERP API returned ${openJawOffers.length} open-jaw flight offers`);

          // Get cheapest open-jaw flight per date/airport, preferring same-airline
          const cheapestOpenJaw = getCheapestOpenJawByDateAndAirport(openJawOffers, true);

          // If internal flight is requested, search for those too
          // Internal flight happens X days after effective arrival date
          let internalFlightsByArrivalDate = new Map<string, number>(); // Maps effectiveArrivalDate -> internal flight price
          if (hasInternalFlight && internalFromAirport && internalToAirport) {
            // Validate offset: must be non-negative integer, max 14
            const rawOffset = typeof internalFlightOffsetDays === 'number' ? internalFlightOffsetDays : parseInt(internalFlightOffsetDays);
            const offsetDays = isNaN(rawOffset) ? 1 : Math.max(0, Math.min(14, Math.floor(rawOffset)));
            console.log(`[FetchFlightPrices] Searching internal flights: ${internalFromAirport} -> ${internalToAirport}, ${offsetDays} days after arrival`);
            
            // Collect unique effective arrival dates and calculate internal flight dates
            const arrivalDates = Array.from(new Set(openJawOffers.map(o => o.effectiveArrivalDate)));
            const internalFlightDates = arrivalDates.map(arrivalDate => {
              // Add offset days to arrival date
              const parts = arrivalDate.split('-');
              const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              date.setDate(date.getDate() + offsetDays);
              return {
                arrivalDate,
                internalDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
              };
            });
            
            // Get unique internal flight dates to search (avoids duplicate API calls)
            const uniqueInternalDates = Array.from(new Set(internalFlightDates.map(d => d.internalDate)));
            
            if (uniqueInternalDates.length > 0) {
              const internalOffers = await searchInternalFlights({
                fromAirport: internalFromAirport,
                toAirport: internalToAirport,
                dates: uniqueInternalDates,
              });
              
              console.log(`[FetchFlightPrices] Found ${internalOffers.length} internal flight offers`);
              
              // Get cheapest internal flight per date
              const cheapestInternal = getCheapestInternalByDate(internalOffers);
              
              // Map internal flight prices back to arrival dates
              // Note: Multiple arrival dates may map to the same internal date - that's fine,
              // they'll both get the same internal flight price for that date
              for (const mapping of internalFlightDates) {
                const internalOffer = cheapestInternal.get(mapping.internalDate);
                if (internalOffer) {
                  internalFlightsByArrivalDate.set(mapping.arrivalDate, internalOffer.pricePerPerson);
                  console.log(`[FetchFlightPrices] Arrival ${mapping.arrivalDate} -> Internal ${mapping.internalDate}: £${internalOffer.pricePerPerson}`);
                }
              }
            }
          }

          for (const [key, flight] of Array.from(cheapestOpenJaw.entries())) {
            const season = findSeasonForDate(flight.outboundDate);
            if (!season) {
              console.log(`[FetchFlightPrices] No season for date ${flight.outboundDate}, skipping`);
              continue;
            }

            // Get internal flight price if applicable (mapped from effective arrival date)
            const internalFlightPrice = hasInternalFlight 
              ? (internalFlightsByArrivalDate.get(flight.effectiveArrivalDate) || 0) 
              : 0;

            // Combined price = (open-jaw flight + internal flight + baggage + land cost + hotel cost) * (1 + markup%)
            const rawTotal = flight.pricePerPerson + internalFlightPrice + BAGGAGE_SURCHARGE_GBP + season.landCost + season.hotelCost;
            const withMarkup = rawTotal * (1 + (markup || 0) / 100);
            const finalPrice = smartRound(withMarkup);

            const airlineName = flight.sameAirline 
              ? flight.outboundAirline 
              : `${flight.outboundAirline} / ${flight.returnAirline}`;

            console.log(`[FetchFlightPrices] ${flight.ukDepartureAirport} ${flight.outboundDate}: Flight £${flight.pricePerPerson}${internalFlightPrice ? ` + Internal £${internalFlightPrice}` : ''} + Baggage £${BAGGAGE_SURCHARGE_GBP} + Land £${season.landCost} + Hotel £${season.hotelCost} = £${rawTotal} -> £${finalPrice} (${markup}% markup)`);

            pricingEntries.push({
              packageId,
              departureAirport: flight.ukDepartureAirport,
              departureAirportName: flight.ukDepartureAirportName || UK_AIRPORTS_MAP[flight.ukDepartureAirport] || flight.ukDepartureAirport,
              departureDate: flight.outboundDate,
              price: finalPrice,
              flightPricePerPerson: flight.pricePerPerson,
              internalFlightPricePerPerson: internalFlightPrice > 0 ? internalFlightPrice : null,
              landPricePerPerson: season.landCost + season.hotelCost,
              airlineName: airlineName,
              currency: 'GBP',
              isAvailable: true,
            });
          }
        } else {
          // ROUND-TRIP SEARCH: Same departure and arrival airport
          console.log(`[FetchFlightPrices] Using SERP API for ${departureAirports.join(', ')} -> ${destinationAirport}`);

          const flightOffers = await searchSerpFlights({
            departAirports: departureAirports,
            arriveAirport: destinationAirport,
            nights: duration,
            startDate: isoStartDate,
            endDate: isoEndDate,
          });

          console.log(`[FetchFlightPrices] SERP API returned ${flightOffers.length} flight offers`);

          // Get cheapest flight per date/airport
          const cheapestFlights = getCheapestSerpFlightsByDateAndAirport(flightOffers);

          for (const [key, flight] of Array.from(cheapestFlights.entries())) {
            const season = findSeasonForDate(flight.departureDate);
            if (!season) {
              console.log(`[FetchFlightPrices] No season for date ${flight.departureDate}, skipping`);
              continue;
            }

            // Combined price = (flight + baggage + land cost + hotel cost) * (1 + markup%)
            const rawTotal = flight.pricePerPerson + BAGGAGE_SURCHARGE_GBP + season.landCost + season.hotelCost;
            const withMarkup = rawTotal * (1 + (markup || 0) / 100);
            const finalPrice = smartRound(withMarkup);

            console.log(`[FetchFlightPrices] ${flight.departureAirport} ${flight.departureDate}: Flight £${flight.pricePerPerson} + Baggage £${BAGGAGE_SURCHARGE_GBP} + Land £${season.landCost} + Hotel £${season.hotelCost} = £${rawTotal} -> £${finalPrice} (with ${markup}% markup)`);

            pricingEntries.push({
              packageId,
              departureAirport: flight.departureAirport,
              departureAirportName: flight.departureAirportName || UK_AIRPORTS_MAP[flight.departureAirport] || flight.departureAirport,
              departureDate: flight.departureDate,
              price: finalPrice,
              flightPricePerPerson: flight.pricePerPerson,
              internalFlightPricePerPerson: null, // No internal flight for round-trip
              landPricePerPerson: season.landCost + season.hotelCost,
              airlineName: flight.airline || undefined,
              currency: 'GBP',
              isAvailable: true,
            });
          }
        }
      } else {
        // Use European Flight API (Sunshine)
        if (isOpenJaw) {
          // OPEN-JAW: Search outbound + return one-way flights separately using Sunshine API
          console.log(`[FetchFlightPrices] Using European API OPEN-JAW for ${departureAirports.join('|')} -> ${openJawArriveAirport}, ${openJawDepartAirport} -> UK`);
          
          const SUNSHINE_ONEWAY_URL = "http://87.102.127.86:8119/owflights/owflights.dll";
          const airportList = departureAirports.join("|");
          
          // Calculate return date range based on duration
          const calculateReturnDates = (startDateStr: string, endDateStr: string, nights: number) => {
            const parseInputDate = (d: string) => {
              if (d.includes('/')) {
                const [day, month, year] = d.split('/');
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              }
              return new Date(d);
            };
            const start = parseInputDate(startDateStr);
            const end = parseInputDate(endDateStr);
            const returnStart = new Date(start);
            const returnEnd = new Date(end);
            returnStart.setDate(returnStart.getDate() + nights);
            returnEnd.setDate(returnEnd.getDate() + nights);
            
            const formatApiDate = (d: Date) => {
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = d.getFullYear();
              return `${day}/${month}/${year}`;
            };
            
            return {
              returnStartDate: formatApiDate(returnStart),
              returnEndDate: formatApiDate(returnEnd)
            };
          };
          
          const { returnStartDate, returnEndDate } = calculateReturnDates(startDate, endDate, duration);
          
          try {
            // 1. Fetch OUTBOUND one-way flights (UK → arrival airport)
            const outboundUrl = new URL(SUNSHINE_ONEWAY_URL);
            outboundUrl.searchParams.set("agtid", "122");
            outboundUrl.searchParams.set("depart", airportList);
            outboundUrl.searchParams.set("Arrive", openJawArriveAirport);
            outboundUrl.searchParams.set("startdate", startDate);
            outboundUrl.searchParams.set("enddate", endDate);
            
            console.log(`[FetchFlightPrices] Outbound API: ${outboundUrl.toString()}`);
            
            const outboundResponse = await fetch(outboundUrl.toString(), {
              method: "GET",
              headers: { "Accept": "application/json" },
            });
            
            if (!outboundResponse.ok) {
              throw new Error(`Outbound API returned ${outboundResponse.status}`);
            }
            
            const outboundRaw = await outboundResponse.text();
            if (outboundRaw.startsWith("<?xml") || outboundRaw.includes("<Error>")) {
              const errorMatch = outboundRaw.match(/<Error>(.*?)<\/Error>/i);
              throw new Error(errorMatch ? errorMatch[1] : "Unknown error from outbound API");
            }
            
            const outboundData = JSON.parse(outboundRaw);
            const outboundFlights = outboundData.Flights || [];
            console.log(`[FetchFlightPrices] Found ${outboundFlights.length} outbound one-way flights`);
            
            // 2. Fetch RETURN one-way flights (departure airport → UK)
            const returnUrl = new URL(SUNSHINE_ONEWAY_URL);
            returnUrl.searchParams.set("agtid", "122");
            returnUrl.searchParams.set("depart", openJawDepartAirport);
            returnUrl.searchParams.set("Arrive", airportList);
            returnUrl.searchParams.set("startdate", returnStartDate);
            returnUrl.searchParams.set("enddate", returnEndDate);
            
            console.log(`[FetchFlightPrices] Return API: ${returnUrl.toString()}`);
            
            const returnResponse = await fetch(returnUrl.toString(), {
              method: "GET",
              headers: { "Accept": "application/json" },
            });
            
            if (!returnResponse.ok) {
              throw new Error(`Return API returned ${returnResponse.status}`);
            }
            
            const returnRaw = await returnResponse.text();
            if (returnRaw.startsWith("<?xml") || returnRaw.includes("<Error>")) {
              const errorMatch = returnRaw.match(/<Error>(.*?)<\/Error>/i);
              throw new Error(errorMatch ? errorMatch[1] : "Unknown error from return API");
            }
            
            const returnData = JSON.parse(returnRaw);
            const returnFlights = returnData.Flights || [];
            console.log(`[FetchFlightPrices] Found ${returnFlights.length} return one-way flights`);
            
            // 3. Build cheapest outbound prices per date/airport
            const outboundPrices: Record<string, Record<string, number>> = {};
            for (const flight of outboundFlights) {
              const datePart = flight.Depart?.split(" ")[0];
              if (!datePart) continue;
              
              const [day, month, year] = datePart.split("/");
              const isoDate = `${year}-${month}-${day}`;
              
              const airport = flight.Depapt;
              const price = parseFloat(flight.Fltprice);
              
              if (!airport || isNaN(price)) continue;
              
              if (!outboundPrices[isoDate]) outboundPrices[isoDate] = {};
              if (!outboundPrices[isoDate][airport] || price < outboundPrices[isoDate][airport]) {
                outboundPrices[isoDate][airport] = price;
              }
            }
            
            // 4. Build cheapest return prices per date/airport using Map for correct pairing
            const returnPricesMap: Record<string, Record<string, number>> = {};
            for (const flight of returnFlights) {
              const datePart = flight.Depart?.split(" ")[0];
              if (!datePart) continue;
              
              const [day, month, year] = datePart.split("/");
              const returnIsoDate = `${year}-${month}-${day}`;
              
              const returnToAirport = flight.Arrapt;
              const price = parseFloat(flight.Fltprice);
              
              if (!returnToAirport || isNaN(price)) continue;
              
              if (!returnPricesMap[returnIsoDate]) returnPricesMap[returnIsoDate] = {};
              if (!returnPricesMap[returnIsoDate][returnToAirport] || price < returnPricesMap[returnIsoDate][returnToAirport]) {
                returnPricesMap[returnIsoDate][returnToAirport] = price;
              }
            }
            
            // 5. Combine outbound + return for each outbound date/airport
            for (const outboundDate of Object.keys(outboundPrices)) {
              // Calculate the return date for this outbound date
              const outDate = new Date(outboundDate);
              outDate.setDate(outDate.getDate() + duration);
              const returnDate = outDate.toISOString().split("T")[0];
              
              for (const airport of Object.keys(outboundPrices[outboundDate])) {
                const outPrice = outboundPrices[outboundDate][airport];
                const returnPrice = returnPricesMap[returnDate]?.[airport];
                
                if (!returnPrice) {
                  console.log(`[FetchFlightPrices] No return flight for ${airport} on ${returnDate}`);
                  continue;
                }
                
                const totalFlightPrice = outPrice + returnPrice;
                
                const season = findSeasonForDate(outboundDate);
                if (!season) {
                  console.log(`[FetchFlightPrices] No season for ${outboundDate}, skipping`);
                  continue;
                }
                
                // Combined price = (flight + baggage + land cost + hotel cost) * (1 + markup%)
                const rawTotal = totalFlightPrice + BAGGAGE_SURCHARGE_GBP + season.landCost + season.hotelCost;
                const withMarkup = rawTotal * (1 + (markup || 0) / 100);
                const finalPrice = smartRound(withMarkup);
                
                console.log(`[FetchFlightPrices] ${airport} ${outboundDate}: Out £${outPrice} + Return £${returnPrice} + Baggage £${BAGGAGE_SURCHARGE_GBP} + Land £${season.landCost} + Hotel £${season.hotelCost} = £${rawTotal} -> £${finalPrice}`);
                
                pricingEntries.push({
                  packageId,
                  departureAirport: airport,
                  departureAirportName: UK_AIRPORTS_MAP[airport] || airport,
                  departureDate: outboundDate,
                  price: finalPrice,
                  flightPricePerPerson: totalFlightPrice,
                  internalFlightPricePerPerson: null,
                  landPricePerPerson: season.landCost + season.hotelCost,
                  currency: 'GBP',
                  isAvailable: true,
                });
              }
            }
          } catch (apiError: any) {
            console.error("[FetchFlightPrices] European Open-Jaw API error:", apiError.message);
            return res.status(500).json({ error: `Flight API error: ${apiError.message}` });
          }
        } else {
          // ROUND-TRIP: Use standard European API
          console.log(`[FetchFlightPrices] Using European API for ${departureAirports.join('|')} -> ${destinationAirport}`);

          try {
            const flightOffers = await searchFlights({
              departAirports: departureAirports.join('|'),
              arriveAirport: destinationAirport,
              nights: duration,
              startDate: startDate, // European API uses DD/MM/YYYY
              endDate: endDate,
            });

            console.log(`[FetchFlightPrices] European API returned ${flightOffers.length} flight offers`);

            // Group by date and airport, get cheapest
            const cheapestByDateAirport = new Map<string, { price: number; airport: string; airportName: string; date: string }>();

            for (const offer of flightOffers) {
              // outdep format is "DD/MM/YYYY HH:mm", extract just the date part
              const datePart = offer.outdep.split(" ")[0];
              const [day, month, year] = datePart.split("/");
              const isoDate = `${year}-${month}-${day}`;
              const key = `${isoDate}|${offer.depapt}`;

              // Parse price from string
              const flightPrice = parseFloat(offer.fltSellpricepp) || 0;

              const existing = cheapestByDateAirport.get(key);
              if (!existing || flightPrice < existing.price) {
                cheapestByDateAirport.set(key, {
                  price: flightPrice,
                  airport: offer.depapt,
                  airportName: offer.depname || UK_AIRPORTS_MAP[offer.depapt] || offer.depapt,
                  date: isoDate,
                });
              }
            }

            for (const [key, flight] of Array.from(cheapestByDateAirport.entries())) {
              const season = findSeasonForDate(flight.date);
              if (!season) {
                console.log(`[FetchFlightPrices] No season found for date ${flight.date}, skipping`);
                continue;
              }

              // Combined price = (flight + baggage + land cost + hotel cost) * (1 + markup%)
              const rawTotal = flight.price + BAGGAGE_SURCHARGE_GBP + season.landCost + season.hotelCost;
              const withMarkup = rawTotal * (1 + (markup || 0) / 100);
              const finalPrice = smartRound(withMarkup);

              console.log(`[FetchFlightPrices] ${flight.airport} ${flight.date}: Flight £${flight.price} + Baggage £${BAGGAGE_SURCHARGE_GBP} + Land £${season.landCost} + Hotel £${season.hotelCost} = £${rawTotal} -> £${finalPrice}`);

              pricingEntries.push({
                packageId,
                departureAirport: flight.airport,
                departureAirportName: flight.airportName,
                departureDate: flight.date,
                price: finalPrice,
                flightPricePerPerson: flight.price,
                internalFlightPricePerPerson: null,
                landPricePerPerson: season.landCost + season.hotelCost,
                currency: 'GBP',
                isAvailable: true,
              });
            }
          } catch (apiError: any) {
            console.error("[FetchFlightPrices] European API error:", apiError.message);
            return res.status(500).json({ error: `Flight API error: ${apiError.message}` });
          }
        }
      }

      if (pricingEntries.length === 0) {
        return res.status(400).json({ error: "No pricing could be generated. Check that your date range overlaps with defined seasons." });
      }

      // Delete existing pricing entries before saving new ones
      console.log(`[FetchFlightPrices] Deleting old pricing entries for package ${packageId}`);
      await storage.deletePackagePricingByPackage(packageId);

      // Save pricing entries to the database
      console.log(`[FetchFlightPrices] Saving ${pricingEntries.length} pricing entries to database`);
      const saved = await storage.createPackagePricingBatch(pricingEntries);

      res.json({ 
        success: true, 
        pricesFound: pricingEntries.length,
        saved: saved.length,
        message: `Generated and saved ${saved.length} pricing entries`
      });
    } catch (error: any) {
      console.error("[FetchFlightPrices] Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch flight prices" });
    }
  });

  // ==================== Content Images Admin Routes ====================
  
  // Get all content images
  app.get("/api/admin/content-images", verifyAdminSession, async (req, res) => {
    try {
      const images = await storage.getAllContentImages();
      res.json(images);
    } catch (error: any) {
      console.error("Error fetching content images:", error);
      res.status(500).json({ error: "Failed to fetch content images" });
    }
  });

  // Get content images by type
  app.get("/api/admin/content-images/:type", verifyAdminSession, async (req, res) => {
    try {
      const { type } = req.params;
      const images = await storage.getContentImagesByType(type);
      res.json(images);
    } catch (error: any) {
      console.error("Error fetching content images:", error);
      res.status(500).json({ error: "Failed to fetch content images" });
    }
  });

  // Upsert content image (create or update)
  app.post("/api/admin/content-images", verifyAdminSession, async (req, res) => {
    try {
      const { type, name, imageUrl } = req.body;
      
      if (!type || !name || !imageUrl) {
        return res.status(400).json({ error: "type, name, and imageUrl are required" });
      }
      
      if (type !== 'destination' && type !== 'collection') {
        return res.status(400).json({ error: "type must be 'destination' or 'collection'" });
      }
      
      const image = await storage.upsertContentImage(type, name, imageUrl);
      res.status(201).json(image);
    } catch (error: any) {
      console.error("Error upserting content image:", error);
      res.status(500).json({ error: "Failed to save content image" });
    }
  });

  // Delete content image
  app.delete("/api/admin/content-images/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteContentImage(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting content image:", error);
      res.status(500).json({ error: "Failed to delete content image" });
    }
  });

  // City Tax routes (admin)
  app.get("/api/admin/city-taxes", verifyAdminSession, async (req, res) => {
    try {
      const taxes = await storage.getAllCityTaxes();
      res.json(taxes);
    } catch (error: any) {
      console.error("Error fetching city taxes:", error);
      res.status(500).json({ error: "Failed to fetch city taxes" });
    }
  });

  app.post("/api/admin/city-taxes", verifyAdminSession, async (req, res) => {
    try {
      const { cityName, countryCode, pricingType, taxPerNightPerPerson, rate1Star, rate2Star, rate3Star, rate4Star, rate5Star, currency, notes, effectiveDate } = req.body;
      if (!cityName) {
        return res.status(400).json({ error: "City name is required" });
      }
      const tax = await storage.createCityTax({
        cityName,
        countryCode: countryCode || "",
        pricingType: pricingType || "flat",
        taxPerNightPerPerson: parseFloat(taxPerNightPerPerson) || 0,
        rate1Star: rate1Star != null ? parseFloat(rate1Star) : null,
        rate2Star: rate2Star != null ? parseFloat(rate2Star) : null,
        rate3Star: rate3Star != null ? parseFloat(rate3Star) : null,
        rate4Star: rate4Star != null ? parseFloat(rate4Star) : null,
        rate5Star: rate5Star != null ? parseFloat(rate5Star) : null,
        currency: currency || "EUR",
        notes: notes || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      });
      res.json(tax);
    } catch (error: any) {
      console.error("Error creating city tax:", error);
      res.status(500).json({ error: "Failed to create city tax" });
    }
  });

  app.put("/api/admin/city-taxes/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { cityName, countryCode, pricingType, taxPerNightPerPerson, rate1Star, rate2Star, rate3Star, rate4Star, rate5Star, currency, notes, effectiveDate } = req.body;
      const tax = await storage.updateCityTax(parseInt(id), {
        cityName,
        countryCode,
        pricingType,
        taxPerNightPerPerson: taxPerNightPerPerson !== undefined ? parseFloat(taxPerNightPerPerson) : undefined,
        rate1Star: rate1Star !== undefined ? (rate1Star != null ? parseFloat(rate1Star) : null) : undefined,
        rate2Star: rate2Star !== undefined ? (rate2Star != null ? parseFloat(rate2Star) : null) : undefined,
        rate3Star: rate3Star !== undefined ? (rate3Star != null ? parseFloat(rate3Star) : null) : undefined,
        rate4Star: rate4Star !== undefined ? (rate4Star != null ? parseFloat(rate4Star) : null) : undefined,
        rate5Star: rate5Star !== undefined ? (rate5Star != null ? parseFloat(rate5Star) : null) : undefined,
        currency,
        notes,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      });
      if (!tax) {
        return res.status(404).json({ error: "City tax not found" });
      }
      res.json(tax);
    } catch (error: any) {
      console.error("Error updating city tax:", error);
      res.status(500).json({ error: "Failed to update city tax" });
    }
  });

  app.delete("/api/admin/city-taxes/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCityTax(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting city tax:", error);
      res.status(500).json({ error: "Failed to delete city tax" });
    }
  });

  // Public endpoint to get city taxes for a package (calculates based on itinerary)
  app.get("/api/packages/:slug/city-taxes", async (req, res) => {
    try {
      const { slug } = req.params;
      const pkg = await storage.getFlightPackageBySlug(slug);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      // Get all city taxes
      const allTaxes = await storage.getAllCityTaxes();
      const latestUpdate = await storage.getLatestCityTaxUpdate();

      // Use explicit cityTaxConfig from the package
      // This is simpler and more reliable than parsing itinerary
      const cityTaxConfig = pkg.cityTaxConfig || [];
      const cityNights: { city: string; nights: number; tax: number; currency: string; starRating?: number }[] = [];
      
      for (const config of cityTaxConfig) {
        const matchingTax = allTaxes.find(t => t.cityName.toLowerCase() === config.city.toLowerCase());
        if (matchingTax && config.nights > 0) {
          // Calculate tax rate based on pricing type and star rating
          let taxRate = matchingTax.taxPerNightPerPerson || 0;
          
          if (matchingTax.pricingType === 'star_rating' && config.starRating) {
            // Use star-rating based pricing
            switch (config.starRating) {
              case 1: taxRate = matchingTax.rate1Star || 0; break;
              case 2: taxRate = matchingTax.rate2Star || 0; break;
              case 3: taxRate = matchingTax.rate3Star || 0; break;
              case 4: taxRate = matchingTax.rate4Star || 0; break;
              case 5: taxRate = matchingTax.rate5Star || 0; break;
              default: taxRate = matchingTax.rate3Star || matchingTax.taxPerNightPerPerson || 0;
            }
          }
          
          cityNights.push({
            city: matchingTax.cityName,
            nights: config.nights,
            tax: taxRate,
            currency: matchingTax.currency,
            starRating: config.starRating,
          });
        }
      }

      // Calculate total tax per person
      const totalTaxPerPerson = cityNights.reduce((sum, cn) => sum + (cn.nights * cn.tax), 0);
      
      res.json({
        cityNights,
        totalTaxPerPerson,
        currency: cityNights[0]?.currency || "EUR",
        lastUpdated: latestUpdate?.toISOString() || null,
      });
    } catch (error: any) {
      console.error("Error calculating city taxes:", error);
      res.status(500).json({ error: "Failed to calculate city taxes" });
    }
  });

  // Download pricing CSV (admin)
  app.get("/api/admin/packages/:id/pricing/download-csv", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const packageId = parseInt(id);
      
      // Get package info
      const allPackages = await storage.getAllFlightPackages();
      const pkg = allPackages.find(p => p.id === packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      // Get pricing entries
      const pricing = await storage.getPackagePricing(packageId);
      
      if (pricing.length === 0) {
        return res.status(400).json({ error: "No pricing entries to download" });
      }
      
      // Build CSV content with breakdown columns
      const headers = ['departure_airport', 'airport_name', 'date', 'airline', 'flight_cost', 'internal_flight_cost', 'land_cost', 'selling_price', 'currency', 'is_available'];
      const rows = pricing.map(entry => [
        entry.departureAirport,
        entry.departureAirportName || '',
        entry.departureDate,
        entry.airlineName || '',
        entry.flightPricePerPerson?.toFixed(2) || '',
        entry.internalFlightPricePerPerson?.toFixed(2) || '', // Internal/domestic flight cost
        entry.landPricePerPerson?.toFixed(2) || '',
        entry.price.toString(),
        entry.currency || 'GBP',
        entry.isAvailable ? 'true' : 'false',
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // Send as file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pricing-${pkg.slug || packageId}.csv"`);
      res.send(csvContent);
    } catch (error: any) {
      console.error("Error generating CSV download:", error);
      res.status(500).json({ error: "Failed to generate CSV" });
    }
  });

  // Upload pricing CSV (admin)
  // Supports two formats:
  // 1. Simple row format: departure_airport,date,price (or with extra columns ignored)
  // 2. Grid format: Departure Airport/Date/Price rows with multiple columns
  app.post("/api/admin/packages/:id/pricing/upload-csv", verifyAdminSession, csvUpload.single('csv'), async (req, res) => {
    try {
      const { id } = req.params;
      const packageId = parseInt(id);
      
      // Verify package exists
      const allPackages = await storage.getAllFlightPackages();
      const pkg = allPackages.find(p => p.id === packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "No CSV file provided" });
      }
      
      // Parse CSV content
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#')); // Skip empty lines and comments
      
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV file is too short - expected header + data rows" });
      }
      
      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
      };
      
      const pricingEntries: Array<{
        packageId: number;
        departureAirport: string;
        departureAirportName: string;
        departureDate: string;
        price: number;
        currency: string;
        isAvailable: boolean;
        flightPricePerPerson?: number | null;
        internalFlightPricePerPerson?: number | null;
        landPricePerPerson?: number | null;
        airlineName?: string | null;
      }> = [];
      
      // Check header to determine format
      const header = parseRow(lines[0]).map(h => h.toLowerCase());
      
      // Simple row format: departure_airport,date,price[,optional columns]
      // Also supports generated format with selling_price column
      const isSimpleFormat = header.includes('departure_airport') || 
                             header.includes('airport') ||
                             (header[0] === 'departure_airport' || header[0] === 'airport');
      
      if (isSimpleFormat) {
        // Find column indices - support both manual format (price) and generated format (selling_price)
        const airportIdx = header.findIndex(h => h === 'departure_airport' || h === 'airport');
        const dateIdx = header.findIndex(h => h === 'date');
        const priceIdx = header.findIndex(h => h === 'price' || h === 'your price (gbp)' || h === 'selling_price');
        
        // Also look for optional breakdown columns from generated format
        const flightCostIdx = header.findIndex(h => h === 'flight_cost');
        const internalFlightCostIdx = header.findIndex(h => h === 'internal_flight_cost');
        const landCostIdx = header.findIndex(h => h === 'land_cost');
        const airlineIdx = header.findIndex(h => h === 'airline');
        const airportNameIdx = header.findIndex(h => h === 'airport_name');
        const currencyIdx = header.findIndex(h => h === 'currency');
        const isAvailableIdx = header.findIndex(h => h === 'is_available');
        
        if (dateIdx === -1 || priceIdx === -1) {
          return res.status(400).json({ 
            error: "CSV missing required columns",
            details: "Expected columns: departure_airport (or airport), date, price (or selling_price)"
          });
        }
        
        // Process data rows
        for (let i = 1; i < lines.length; i++) {
          const row = parseRow(lines[i]);
          
          const airportCode = (airportIdx >= 0 ? row[airportIdx] : '').toUpperCase();
          const dateStr = row[dateIdx];
          const priceStr = row[priceIdx];
          
          // Skip rows without required data
          if (!airportCode || !dateStr || !priceStr) continue;
          
          // Parse date - supports DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MM-YY, or YYYY-MM-DD
          let isoDate: string;
          const ukDateMatch4Digit = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          const ukDateMatch2Digit = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
          const isoDateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          
          if (ukDateMatch4Digit) {
            const day = ukDateMatch4Digit[1].padStart(2, '0');
            const month = ukDateMatch4Digit[2].padStart(2, '0');
            const year = ukDateMatch4Digit[3];
            isoDate = `${year}-${month}-${day}`;
          } else if (ukDateMatch2Digit) {
            const day = ukDateMatch2Digit[1].padStart(2, '0');
            const month = ukDateMatch2Digit[2].padStart(2, '0');
            const shortYear = parseInt(ukDateMatch2Digit[3]);
            // Assume 2000s for years 00-99
            const year = shortYear >= 0 && shortYear <= 99 ? `20${ukDateMatch2Digit[3]}` : ukDateMatch2Digit[3];
            isoDate = `${year}-${month}-${day}`;
          } else if (isoDateMatch) {
            isoDate = dateStr;
          } else {
            console.log(`Skipping row ${i + 1}: invalid date format "${dateStr}"`);
            continue;
          }
          
          // Parse price
          const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
          if (isNaN(price) || price <= 0) {
            console.log(`Skipping row ${i + 1}: invalid price "${priceStr}"`);
            continue;
          }
          
          // Use airport_name from CSV if available, otherwise lookup
          const airportName = (airportNameIdx >= 0 && row[airportNameIdx]) 
            ? row[airportNameIdx].replace(/^"|"$/g, '') 
            : (UK_AIRPORTS_MAP[airportCode] || airportCode);
          
          // Parse optional breakdown columns
          const flightCost = flightCostIdx >= 0 ? parseFloat(row[flightCostIdx]?.replace(/[^0-9.]/g, '') || '') : null;
          const internalFlightCost = internalFlightCostIdx >= 0 ? parseFloat(row[internalFlightCostIdx]?.replace(/[^0-9.]/g, '') || '') : null;
          const landCost = landCostIdx >= 0 ? parseFloat(row[landCostIdx]?.replace(/[^0-9.]/g, '') || '') : null;
          const airline = airlineIdx >= 0 ? (row[airlineIdx]?.replace(/^"|"$/g, '') || null) : null;
          const currency = currencyIdx >= 0 ? (row[currencyIdx]?.replace(/^"|"$/g, '') || 'GBP') : 'GBP';
          const isAvailable = isAvailableIdx >= 0 ? (row[isAvailableIdx]?.toLowerCase() !== 'false') : true;
          
          pricingEntries.push({
            packageId,
            departureAirport: airportCode,
            departureAirportName: airportName,
            departureDate: isoDate,
            price,
            currency,
            isAvailable,
            flightPricePerPerson: !isNaN(flightCost!) ? flightCost : null,
            internalFlightPricePerPerson: !isNaN(internalFlightCost!) ? internalFlightCost : null,
            landPricePerPerson: !isNaN(landCost!) ? landCost : null,
            airlineName: airline,
          });
        }
      } else {
        // Legacy grid format: Departure Airport/Date/Price rows
        let currentRow = 2; // Start after metadata rows
        let airportGroupsProcessed = 0;
        
        while (currentRow + 2 <= lines.length) {
          const airportRow = parseRow(lines[currentRow]);
          const dateRow = parseRow(lines[currentRow + 1]);
          const priceRow = parseRow(lines[currentRow + 2]);
          
          if (airportRow[0]?.toLowerCase() !== 'departure airport') {
            currentRow++;
            continue;
          }
          if (dateRow[0]?.toLowerCase() !== 'date') {
            currentRow += 2;
            continue;
          }
          if (priceRow[0]?.toLowerCase() !== 'price') {
            currentRow += 3;
            continue;
          }
          
          const airportCode = airportRow[1]?.toUpperCase();
          if (!airportCode) {
            currentRow += 3;
            continue;
          }
          
          const airportName = UK_AIRPORTS_MAP[airportCode] || airportCode;
          
          for (let i = 1; i < Math.min(dateRow.length, priceRow.length); i++) {
            const dateStr = dateRow[i];
            const priceStr = priceRow[i];
            
            if (!dateStr || !priceStr) continue;
            
            const dateParts = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (!dateParts) continue;
            
            const day = dateParts[1].padStart(2, '0');
            const month = dateParts[2].padStart(2, '0');
            const year = dateParts[3];
            const isoDate = `${year}-${month}-${day}`;
            
            const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
            if (isNaN(price) || price <= 0) continue;
            
            pricingEntries.push({
              packageId,
              departureAirport: airportCode,
              departureAirportName: airportName,
              departureDate: isoDate,
              price,
              currency: 'GBP',
              isAvailable: true,
            });
          }
          
          airportGroupsProcessed++;
          currentRow += 3;
        }
      }
      
      if (pricingEntries.length === 0) {
        return res.status(400).json({ 
          error: "No valid pricing entries found in CSV",
          details: "Check that each row has: airport code, date (DD/MM/YYYY), and price"
        });
      }
      
      // Group entries by airport for summary
      const airportSummary: Record<string, number> = {};
      pricingEntries.forEach(entry => {
        airportSummary[entry.departureAirport] = (airportSummary[entry.departureAirport] || 0) + 1;
      });
      
      // Delete existing pricing for this package before inserting new data
      await storage.deletePackagePricingByPackage(packageId);
      console.log(`Deleted existing pricing for package ${packageId} before CSV import`);
      
      // Insert all pricing entries
      const created = await storage.createPackagePricingBatch(pricingEntries);
      
      console.log(`CSV pricing upload for package ${packageId}: ${created.length} entries created`);
      
      res.status(201).json({ 
        success: true, 
        created: created.length,
        airports: Object.keys(airportSummary).length,
        summary: airportSummary,
        message: `Successfully imported ${created.length} pricing entries`
      });
    } catch (error: any) {
      console.error("Error uploading pricing CSV:", error);
      res.status(500).json({ error: error.message || "Failed to process pricing CSV" });
    }
  });

  // Fetch flight prices and save to package (admin)
  app.post("/api/admin/packages/fetch-flight-prices", verifyAdminSession, async (req, res) => {
    try {
      const { 
        packageId, 
        bokunProductId, 
        landCostOverride,  // For manual packages without Bokun - use package base price
        destAirport, 
        departAirports, 
        durationNights, 
        startDate, 
        endDate, 
        markupPercent 
      } = req.body;
      
      // bokunProductId is optional for manual packages
      if (!packageId || !destAirport || !departAirports || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const isManualPackage = !bokunProductId;
      
      // Load the package to get pricingDisplay setting
      const pkg = await storage.getFlightPackageById(parseInt(packageId));
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      const pricingDisplay = pkg.pricingDisplay || "both";
      
      console.log(`\n=== FETCHING FLIGHT PRICES FOR PACKAGE ${packageId} ===`);
      console.log(`Bokun Product: ${bokunProductId || 'MANUAL'}, Dest: ${destAirport}, Duration: ${durationNights} nights`);
      console.log(`Date Range: ${startDate} - ${endDate}, Markup: ${markupPercent}%`);
      console.log(`Pricing Display Mode: ${pricingDisplay}, Manual Package: ${isManualPackage}`);
      if (isManualPackage) {
        console.log(`Land Cost Override (from package base price): £${landCostOverride}`);
      }
      
      // Convert dates from DD/MM/YYYY to YYYY-MM-DD for Bokun API
      const convertToIsoDate = (dateStr: string): string => {
        // Handle both DD/MM/YYYY and YYYY-MM-DD formats
        if (dateStr.includes('-')) {
          return dateStr; // Already ISO format
        }
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };
      
      const isoStartDate = convertToIsoDate(startDate);
      const isoEndDate = convertToIsoDate(endDate);
      
      console.log(`Converted dates: ${isoStartDate} - ${isoEndDate}`);
      
      // For manual packages, skip Bokun availability check - assume all dates are available
      let bokunAvailability: any[] = [];
      const availableDates = new Set<string>();
      
      if (!isManualPackage) {
        // Fetch Bokun availability to know which dates the tour actually operates
        bokunAvailability = await getBokunAvailability(bokunProductId, isoStartDate, isoEndDate, 'USD');
        
        // Build a set of available dates from Bokun (format: YYYY-MM-DD)
        if (Array.isArray(bokunAvailability)) {
          for (const slot of bokunAvailability) {
            if (slot.date && !slot.soldOut && !slot.unavailable) {
              // Convert timestamp to YYYY-MM-DD
              const dateObj = new Date(slot.date);
              const isoDate = dateObj.toISOString().split('T')[0];
              availableDates.add(isoDate);
            }
          }
        }
        
        console.log(`Bokun availability: ${availableDates.size} dates with tour availability`);
        
        if (availableDates.size === 0) {
          return res.status(200).json({ 
            pricesFound: 0, 
            saved: 0, 
            message: "No tour availability found in Bokun for the specified date range. The tour may not operate during these dates." 
          });
        }
      } else {
        // For manual packages, generate all dates in range as available
        const start = new Date(isoStartDate);
        const end = new Date(isoEndDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          availableDates.add(d.toISOString().split('T')[0]);
        }
        console.log(`Manual package: ${availableDates.size} dates generated in range`);
      }
      
      // Import the flight API functions
      const { searchFlights, smartRoundPrice } = await import("./flightApi");
      
      // Fetch flight offers
      const flightOffers = await searchFlights({
        departAirports,
        arriveAirport: destAirport,
        nights: durationNights,
        startDate,
        endDate,
      });
      
      if (flightOffers.length === 0) {
        return res.status(200).json({ 
          pricesFound: 0, 
          saved: 0, 
          message: "No flight offers found for the specified criteria" 
        });
      }
      
      console.log(`Found ${flightOffers.length} flight offers`);
      
      // Get exchange rate for USD to GBP conversion
      const exchangeRate = await storage.getExchangeRate(); // e.g., 0.75
      
      let landTourPriceWithMarkup = 0;
      
      if (isManualPackage) {
        // For manual packages, use the landCostOverride (package base price) directly
        // No USD conversion needed as it's already in GBP
        landTourPriceWithMarkup = landCostOverride || 0;
        console.log(`Manual package land cost: £${landTourPriceWithMarkup} (no Bokun markup applied)`);
      } else {
        // Extract the correct Bokun rate price based on pricingDisplay
        // The availability data has rates with minPerBooking:
        // - minPerBooking: 2 = Double/Twin room (twin share price)
        // - minPerBooking: 1 = Single room (solo traveller price)
        let landTourPriceUSD = 0;
        let selectedRateType = "default";
        
        if (Array.isArray(bokunAvailability) && bokunAvailability.length > 0) {
          const firstSlot = bokunAvailability[0];
          const rates = firstSlot.rates || [];
          const pricesByRate = firstSlot.pricesByRate || [];
          
          // Find the appropriate rate based on pricingDisplay
          let targetRate: any = null;
          
          if (pricingDisplay === "single") {
            // Look for single room rate (minPerBooking === 1)
            targetRate = rates.find((r: any) => r.minPerBooking === 1);
            selectedRateType = "single (minPerBooking=1)";
          } else {
            // Default to twin/double rate (minPerBooking === 2)
            targetRate = rates.find((r: any) => r.minPerBooking === 2);
            selectedRateType = "twin (minPerBooking=2)";
          }
          
          // Fallback to first rate if specific rate not found
          if (!targetRate && rates.length > 0) {
            targetRate = rates[0];
            selectedRateType = `fallback to first rate (${targetRate.title})`;
            console.warn(`Could not find rate for pricingDisplay=${pricingDisplay}, using first rate`);
          }
          
          // Get the price for the selected rate
          if (targetRate && pricesByRate.length > 0) {
            const ratePrice = pricesByRate.find((p: any) => p.activityRateId === targetRate.id);
            if (ratePrice && ratePrice.pricePerCategoryUnit && ratePrice.pricePerCategoryUnit.length > 0) {
              // Get the adult price (first category, usually id 16308)
              landTourPriceUSD = ratePrice.pricePerCategoryUnit[0]?.amount?.amount || 0;
            }
          }
          
          console.log(`Selected Bokun rate: ${selectedRateType}`);
          console.log(`Rate details: ${targetRate?.title || 'N/A'}`);
        }
        
        // Fallback to product details if availability didn't have pricing
        if (landTourPriceUSD === 0) {
          const bokunDetails: any = await getBokunProductDetails(bokunProductId, 'USD');
          landTourPriceUSD = bokunDetails?.nextDefaultPriceMoney?.amount || 
                            bokunDetails?.nextDefaultPrice || 
                            bokunDetails?.price || 
                            0;
          console.log(`Using fallback price from product details`);
        }
        
        // Convert USD to GBP (divide by rate since we're buying in USD, e.g., $100 / 1.25 = £80)
        const landTourPriceGBP = landTourPriceUSD / exchangeRate;
        
        // Apply 10% Bokun markup
        landTourPriceWithMarkup = landTourPriceGBP * 1.1;
        
        console.log(`Bokun land tour price: $${landTourPriceUSD} USD / ${exchangeRate} = £${landTourPriceGBP.toFixed(2)} GBP`);
        console.log(`With 10% markup: £${landTourPriceWithMarkup.toFixed(2)}`);
      }
      
      // Group flight offers by departure date and airport for best price per combination
      const priceMap = new Map<string, { 
        departureAirport: string; 
        departureAirportName: string;
        departureDate: string; 
        flightPrice: number;
        combinedPrice: number;
      }>();
      
      let skippedDates = 0;
      for (const offer of flightOffers) {
        // Parse date from outdep (format: DD/MM/YYYY HH:mm)
        const datePart = offer.outdep.split(" ")[0]; // DD/MM/YYYY
        const [day, month, year] = datePart.split("/");
        const isoDate = `${year}-${month}-${day}`; // YYYY-MM-DD for database
        
        // Only include dates where Bokun tour has availability
        if (!availableDates.has(isoDate)) {
          skippedDates++;
          continue; // Skip dates where tour isn't available
        }
        
        const flightPrice = parseFloat(offer.fltnetpricepp);
        const subtotal = flightPrice + landTourPriceWithMarkup;
        const afterMarkup = subtotal * (1 + (markupPercent || 0) / 100);
        const finalPrice = smartRoundPrice(afterMarkup);
        
        const key = `${offer.depapt}-${isoDate}`;
        
        const existing = priceMap.get(key);
        if (!existing || finalPrice < existing.combinedPrice) {
          priceMap.set(key, {
            departureAirport: offer.depapt,
            departureAirportName: offer.depname || offer.depapt,
            departureDate: isoDate,
            flightPrice,
            combinedPrice: finalPrice,
          });
        }
      }
      
      console.log(`Grouped into ${priceMap.size} unique departure/date combinations (skipped ${skippedDates} flights on dates without tour availability)`);
      
      // Convert to pricing entries and save
      const pricingEntries = Array.from(priceMap.values()).map(p => ({
        packageId: parseInt(packageId),
        departureAirport: p.departureAirport,
        departureAirportName: p.departureAirportName,
        departureDate: p.departureDate,
        price: p.combinedPrice,
        currency: "GBP",
      }));
      
      // Delete existing pricing for this package first before inserting new prices
      await storage.deletePackagePricingByPackage(parseInt(packageId));
      console.log(`Deleted existing pricing for package ${packageId}`);
      
      // Insert new pricing entries
      const created = await storage.createPackagePricingBatch(pricingEntries);
      
      console.log(`Saved ${created.length} pricing entries to package ${packageId}`);
      console.log(`=== FLIGHT PRICING COMPLETE ===\n`);
      
      // Provide helpful feedback about what was saved vs skipped
      let message = `Successfully imported ${created.length} flight-inclusive prices`;
      if (skippedDates > 0) {
        message += ` (${skippedDates} flight offers were skipped because the tour isn't available on those dates)`;
      }
      if (created.length === 0 && flightOffers.length > 0) {
        message = "No prices saved - none of the flight dates match tour availability dates. Check that your date range overlaps with when the tour operates.";
      }
      
      res.json({ 
        pricesFound: flightOffers.length,
        uniqueCombinations: priceMap.size,
        saved: created.length,
        skippedFlights: skippedDates,
        tourAvailableDates: availableDates.size,
        landTourPrice: landTourPriceWithMarkup,
        message
      });
    } catch (error: any) {
      console.error("Error fetching flight prices:", error);
      res.status(500).json({ error: error.message || "Failed to fetch flight prices" });
    }
  });

  // Search Bokun tours for import into flight packages (admin)
  app.get("/api/admin/packages/bokun-search", verifyAdminSession, async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      // Use USD cache (which has all products) since it's fully populated
      // We convert prices to GBP on display anyway
      let cachedProducts = await storage.getCachedProducts('USD');
      
      // If USD cache is empty, try GBP cache
      if (cachedProducts.length === 0) {
        cachedProducts = await storage.getCachedProducts('GBP');
      }
      
      // If cache is still empty, fetch ALL products from Bokun API directly
      if (cachedProducts.length === 0) {
        console.log("Bokun cache empty - fetching all products for search...");
        
        // Fetch first page to get total count
        const firstPageData = await searchBokunProducts(1, 100, 'USD');
        cachedProducts = firstPageData.items || [];
        const totalHits = firstPageData.totalHits || 0;
        
        // Fetch remaining pages
        if (totalHits > 100) {
          const totalPages = Math.ceil(totalHits / 100);
          const remainingPages = [];
          for (let page = 2; page <= totalPages; page++) {
            remainingPages.push(page);
          }
          
          // Fetch remaining pages in parallel (batches of 3)
          for (let i = 0; i < remainingPages.length; i += 3) {
            const batch = remainingPages.slice(i, i + 3);
            const results = await Promise.all(
              batch.map(page => searchBokunProducts(page, 100, 'USD'))
            );
            for (const result of results) {
              if (result.items) {
                cachedProducts = cachedProducts.concat(result.items);
              }
            }
          }
        }
        
        // Cache for future use
        if (cachedProducts.length > 0) {
          await storage.setCachedProducts(cachedProducts, 'USD');
        }
        console.log(`Fetched and cached ${cachedProducts.length} products for search`);
      }
      
      // Filter products by keyword in title, excerpt, or location
      const searchTerm = query.toLowerCase();
      const filteredItems = cachedProducts.filter((item: any) => {
        const title = (item.title || '').toLowerCase();
        const excerpt = (item.excerpt || '').toLowerCase();
        const summary = (item.summary || '').toLowerCase();
        const city = (item.googlePlace?.city || '').toLowerCase();
        const country = (item.googlePlace?.country || '').toLowerCase();
        const countryCode = (item.googlePlace?.countryCode || '').toLowerCase();
        const locationCountry = (item.locationCode?.country || '').toLowerCase();
        const location = (item.locationCode?.location || '').toLowerCase();
        
        return title.includes(searchTerm) || 
               excerpt.includes(searchTerm) ||
               summary.includes(searchTerm) ||
               city.includes(searchTerm) ||
               country.includes(searchTerm) ||
               countryCode.includes(searchTerm) ||
               locationCountry.includes(searchTerm) ||
               location.includes(searchTerm);
      });
      
      // Return simplified results for the search dropdown (limit to 30)
      const tours = filteredItems.slice(0, 30).map((item: any) => ({
        id: item.id,
        title: item.title,
        excerpt: item.excerpt || item.summary || '',
        price: item.price,
        durationText: item.durationText,
        keyPhotoUrl: item.keyPhoto?.derived?.find((d: any) => d.name === 'medium')?.url || item.keyPhoto?.originalUrl,
        location: item.googlePlace?.city || item.locationCode?.location || item.googlePlace?.country || '',
      }));
      
      console.log(`Bokun admin search for "${query}": searching ${cachedProducts.length} products, found ${filteredItems.length} tours, returning ${tours.length}`);
      res.json({ tours, total: filteredItems.length });
    } catch (error: any) {
      console.error("Error searching Bokun tours:", error);
      res.status(500).json({ error: "Failed to search Bokun tours" });
    }
  });

  // Get Bokun tour details for import (admin)
  app.get("/api/admin/packages/bokun-tour/:productId", verifyAdminSession, async (req, res) => {
    try {
      const { productId } = req.params;
      
      // Fetch full product details from Bokun
      const details: any = await getBokunProductDetails(productId, 'GBP');
      
      if (!details) {
        return res.status(404).json({ error: "Bokun tour not found" });
      }
      
      // Log all available fields for debugging
      console.log("\n=== BOKUN TOUR IMPORT DATA ===");
      console.log("Product ID:", productId);
      console.log("Available top-level fields:", Object.keys(details));
      
      // DETAILED PRICE LOGGING
      console.log("\n=== PRICE FIELDS ===");
      console.log("price:", details.price);
      console.log("nextDefaultPriceMoney:", JSON.stringify(details.nextDefaultPriceMoney, null, 2));
      console.log("pricingCategories:", details.pricingCategories ? JSON.stringify(details.pricingCategories.slice(0, 2), null, 2) : 'none');
      console.log("rates:", details.rates ? `${details.rates.length} rates` : 'none');
      if (details.rates && details.rates.length > 0) {
        console.log("First rate:", JSON.stringify(details.rates[0], null, 2));
      }
      console.log("retailPrice:", details.retailPrice);
      console.log("netPrice:", details.netPrice);
      console.log("basePrice:", details.basePrice);
      console.log("===================\n");
      
      console.log("Has itinerary:", !!details.itinerary, "length:", details.itinerary?.length || 0);
      console.log("Has agendaItems:", !!details.agendaItems, "length:", details.agendaItems?.length || 0);
      console.log("Has schedule:", !!details.schedule);
      console.log("Has customFields:", !!details.customFields, "length:", details.customFields?.length || 0);
      console.log("Has included/excluded:", !!details.included, !!details.excluded);
      console.log("Included value:", details.included);
      console.log("Excluded value:", details.excluded);
      console.log("Requirements value:", details.requirements);
      console.log("Attention value:", details.attention);
      console.log("Has photos:", !!details.photos, "length:", details.photos?.length || 0);
      console.log("Has keyPhoto:", !!details.keyPhoto);
      
      if (details.customFields?.length > 0) {
        console.log("Custom field codes:", details.customFields.map((f: any) => f.code));
      }
      
      if (details.itinerary?.length > 0) {
        console.log("First itinerary item:", JSON.stringify(details.itinerary[0], null, 2));
      }
      
      if (details.agendaItems?.length > 0) {
        console.log("First agenda item:", JSON.stringify(details.agendaItems[0], null, 2));
      }
      
      // Extract highlights from multiple possible sources
      const highlights: string[] = [];
      // From customFields
      (details.customFields || []).forEach((f: any) => {
        if (f.code?.toUpperCase().includes('HIGHLIGHT') && f.value) {
          highlights.push(f.value);
        }
      });
      // From flags
      if (details.flags?.length > 0) {
        highlights.push(...details.flags.filter((f: string) => f && !highlights.includes(f)));
      }
      
      // Extract what's included from multiple sources
      const whatsIncluded: string[] = [];
      // From customFields
      (details.customFields || []).forEach((f: any) => {
        if ((f.code?.toUpperCase().includes('INCLUDED') || f.code?.toUpperCase().includes('INCLUDE')) && f.value) {
          whatsIncluded.push(f.value);
        }
      });
      // From included field (Bokun standard)
      if (details.included) {
        if (Array.isArray(details.included)) {
          whatsIncluded.push(...details.included.map((i: any) => typeof i === 'string' ? i : i.title || i.description || '').filter(Boolean));
        } else if (typeof details.included === 'string') {
          // Split by newlines or bullets (not hyphens - they may be part of content like "Day 2-4")
          whatsIncluded.push(...details.included.split(/[\n•]/).map((s: string) => s.trim()).filter(Boolean));
        }
      }
      
      // Add "Flights Included" as first item for flight packages
      whatsIncluded.unshift("Flights Included");
      console.log("Final whatsIncluded array:", whatsIncluded);
      
      // Extract itinerary from multiple possible sources
      let itinerary: { day: number; title: string; description: string }[] = [];
      
      // Primary: Bokun's standard itinerary field
      if (details.itinerary?.length > 0) {
        itinerary = details.itinerary.map((day: any) => ({
          day: day.day || day.dayNumber || 1,
          title: day.title || day.name || `Day ${day.day || day.dayNumber || 1}`,
          description: day.body || day.description || day.excerpt || day.content || '',
        }));
      }
      // Fallback: agendaItems (some Bokun products use this)
      else if (details.agendaItems?.length > 0) {
        itinerary = details.agendaItems.map((item: any, idx: number) => ({
          day: item.day || item.dayNumber || idx + 1,
          title: item.title || item.name || `Day ${idx + 1}`,
          description: item.body || item.description || item.excerpt || '',
        }));
      }
      // Fallback: schedule field
      else if (details.schedule?.length > 0) {
        itinerary = details.schedule.map((item: any, idx: number) => ({
          day: item.day || idx + 1,
          title: item.title || item.time || `Day ${idx + 1}`,
          description: item.description || item.activity || '',
        }));
      }
      // Fallback: look in customFields for ITINERARY or DAY fields
      else {
        const itineraryFields = (details.customFields || [])
          .filter((f: any) => f.code?.toUpperCase().includes('ITINERARY') || f.code?.toUpperCase().includes('DAY'))
          .sort((a: any, b: any) => (a.code || '').localeCompare(b.code || ''));
        
        if (itineraryFields.length > 0) {
          itinerary = itineraryFields.map((f: any, idx: number) => ({
            day: idx + 1,
            title: f.title || `Day ${idx + 1}`,
            description: f.value || '',
          }));
        }
      }
      
      // Extract gallery images
      const gallery: string[] = [];
      if (details.photos?.length > 0) {
        details.photos.forEach((p: any) => {
          const url = p.derived?.find((d: any) => d.name === 'large' || d.name === 'medium')?.url || p.originalUrl;
          if (url) gallery.push(url);
        });
      }
      if (details.images?.length > 0) {
        details.images.forEach((img: any) => {
          const url = typeof img === 'string' ? img : img.url || img.originalUrl;
          if (url && !gallery.includes(url)) gallery.push(url);
        });
      }
      
      // Get the GBP price from the cached products or convert USD to GBP
      // The search endpoint properly returns GBP prices (unlike availability which may return USD
      // depending on booking channel currency settings)
      let importPrice = 0;
      let priceIsGBP = false;
      const exchangeRate = await storage.getExchangeRate(); // e.g., 0.79
      
      try {
        // Use the cached GBP products from storage
        const cachedProducts = await storage.getCachedProducts('GBP');
        console.log(`Checking ${cachedProducts.length} cached GBP products for ID ${productId}`);
        
        const matchingProduct = cachedProducts.find((p: any) => String(p.id) === String(productId));
        
        if (matchingProduct) {
          console.log(`Found product in cache: ${matchingProduct.title}, price: ${matchingProduct.price}`);
          if (matchingProduct.price) {
            importPrice = matchingProduct.price;
            priceIsGBP = true;
            console.log(`Got GBP price from cache: £${importPrice}`);
          }
        }
        
        // If not in cache or no price, use USD price and convert
        if (!priceIsGBP) {
          const usdPrice = details.nextDefaultPriceMoney?.amount || details.price || 0;
          if (usdPrice > 0) {
            importPrice = Math.round((usdPrice / exchangeRate) * 100) / 100;
            console.log(`Product not in GBP cache - converting USD to GBP: $${usdPrice} / ${exchangeRate} = £${importPrice}`);
          } else {
            console.log(`No price found in Bokun product details`);
          }
        }
      } catch (priceError) {
        console.error("Could not fetch GBP pricing:", priceError);
        const usdPrice = details.nextDefaultPriceMoney?.amount || details.price || 0;
        if (usdPrice > 0) {
          importPrice = Math.round((usdPrice / exchangeRate) * 100) / 100;
          console.log(`Error fallback - converting USD to GBP: $${usdPrice} / ${exchangeRate} = £${importPrice}`);
        }
      }
      
      // Extract room type prices from rates array
      // minPerBooking: 1 = single room, minPerBooking: 2 = double/twin room
      let singleRoomPrice: number | null = null;
      let doubleRoomPrice: number | null = null;
      let availableRates: { id: string; title: string; minPerBooking: number; price: number }[] = [];
      
      if (details.rates && Array.isArray(details.rates)) {
        console.log("\n=== EXTRACTING ROOM TYPE PRICES ===");
        details.rates.forEach((rate: any) => {
          // Get the per-person price from the rate
          const ratePrice = rate.defaultPricePerPerson?.amount || rate.price || 0;
          const rateInfo = {
            id: rate.id,
            title: rate.title || rate.name || 'Unknown Rate',
            minPerBooking: rate.minPerBooking || 1,
            price: ratePrice,
          };
          availableRates.push(rateInfo);
          
          console.log(`Rate: "${rateInfo.title}" - minPerBooking: ${rateInfo.minPerBooking}, price: ${ratePrice}`);
          
          // Categorize by minPerBooking
          if (rate.minPerBooking === 1 && ratePrice > 0) {
            // Single room (solo traveler)
            if (!singleRoomPrice || ratePrice < singleRoomPrice) {
              singleRoomPrice = ratePrice;
            }
          } else if (rate.minPerBooking === 2 && ratePrice > 0) {
            // Double/twin room (2 sharing)
            if (!doubleRoomPrice || ratePrice < doubleRoomPrice) {
              doubleRoomPrice = ratePrice;
            }
          }
        });
        console.log(`Single room price: ${singleRoomPrice ? `£${singleRoomPrice}` : 'not found'}`);
        console.log(`Double room price: ${doubleRoomPrice ? `£${doubleRoomPrice}` : 'not found'}`);
        console.log("===================================\n");
      }
      
      // Use double room price as main price if available, otherwise use import price
      const finalPrice = doubleRoomPrice || importPrice;
      
      // Transform Bokun data into flight package format
      const importData = {
        bokunProductId: productId,
        title: details.title,
        excerpt: details.excerpt || details.summary || '',
        description: details.description || details.summary || details.longDescription || '',
        price: finalPrice,
        singlePrice: singleRoomPrice,
        // Include rate info for admin panel display
        _rateInfo: {
          rates: availableRates,
          singleRoomPrice,
          doubleRoomPrice,
        },
        duration: details.durationText || details.duration || '',
        category: details.googlePlace?.country || details.locationCode?.country || 'Worldwide',
        slug: (details.title || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        highlights,
        whatsIncluded,
        itinerary,
        featuredImage: details.keyPhoto?.derived?.find((d: any) => d.name === 'large')?.url || 
                       details.keyPhoto?.originalUrl || '',
        gallery,
        // Additional info from Bokun - filter out flight-related text since we're adding flights
        excluded: (() => {
          if (!details.excluded) return null;
          // Remove lines mentioning flights (domestic/international) from "what's not included"
          const flightPatterns = [
            /domestic\s*(and|&|or)?\s*international\s*flights?/gi,
            /international\s*(and|&|or)?\s*domestic\s*flights?/gi,
            /flights?\s*\(domestic\s*(and|&|or)?\s*international\)/gi,
            /flights?\s*\(international\s*(and|&|or)?\s*domestic\)/gi,
            /domestic\s*flights?/gi,
            /international\s*flights?/gi,
            /\bflights?\b/gi,
          ];
          let cleaned = details.excluded;
          // If it's HTML, filter by line/paragraph
          if (cleaned.includes('<')) {
            // Split by common HTML separators and filter
            const lines = cleaned.split(/<(?:li|p|br|div)[^>]*>/gi);
            const filteredLines = lines.filter((line: string) => {
              const plainText = line.replace(/<[^>]*>/g, '').trim();
              return !flightPatterns.some(pattern => pattern.test(plainText));
            });
            cleaned = filteredLines.join('');
          } else {
            // Plain text - split by newlines or bullet points
            const lines = cleaned.split(/[\n\r]+|(?:^|\n)\s*[-•*]\s*/);
            const filteredLines = lines.filter((line: string) => {
              return !flightPatterns.some(pattern => pattern.test(line.trim()));
            });
            cleaned = filteredLines.join('\n').trim();
          }
          return cleaned || null;
        })(),
        requirements: details.requirements || null,
        attention: details.attention || null,
        // Include raw Bokun response for debugging (only in dev)
        _rawBokunFields: process.env.NODE_ENV === 'development' ? Object.keys(details) : undefined,
        _hasItinerary: itinerary.length > 0,
        _hasHighlights: highlights.length > 0,
        _hasWhatsIncluded: whatsIncluded.length > 0,
        _photosCount: gallery.length,
      };
      
      console.log("Import data summary:", {
        title: importData.title,
        itineraryDays: importData.itinerary.length,
        highlights: importData.highlights.length,
        whatsIncluded: importData.whatsIncluded.length,
        photos: importData.gallery.length,
      });
      console.log("=== END BOKUN IMPORT ===\n");
      
      res.json(importData);
    } catch (error: any) {
      console.error("Error fetching Bokun tour details:", error);
      res.status(500).json({ error: "Failed to fetch Bokun tour details" });
    }
  });

  // Export pricing CSV with Bokun net prices (admin)
  app.get("/api/admin/packages/:id/pricing/export-csv", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const packageId = parseInt(id);
      
      // Get the package
      const allPackages = await storage.getAllFlightPackages();
      const pkg = allPackages.find(p => p.id === packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      // Get existing pricing
      const pricing = await storage.getPackagePricing(packageId);
      
      // If linked to Bokun, fetch Bokun pricing for reference
      let bokunPrices: Map<string, number> = new Map();
      if (pkg.bokunProductId) {
        try {
          // Fetch availability for the next 12 months
          const today = new Date();
          const startDate = today.toISOString().split('T')[0];
          const endDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
            .toISOString().split('T')[0];
          
          const availability: any = await getBokunAvailability(pkg.bokunProductId, startDate, endDate, 'GBP');
          
          // Build a map of date -> lowest Bokun price
          // Bokun returns availability as an array directly
          const availabilities = Array.isArray(availability) ? availability : availability.availabilities || [];
          console.log(`Processing ${availabilities.length} availability entries for CSV export`);
          
          availabilities.forEach((avail: any) => {
            // Date can be a timestamp (milliseconds) or a string
            let dateStr: string;
            if (typeof avail.date === 'number') {
              const d = new Date(avail.date);
              dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
            } else if (typeof avail.date === 'string') {
              dateStr = avail.date;
            } else {
              return; // Skip if no valid date
            }
            
            if (avail.pricesByRate && avail.pricesByRate.length > 0) {
              // Extract price from nested structure: pricesByRate[].pricePerCategoryUnit[].amount.amount
              const prices: number[] = [];
              avail.pricesByRate.forEach((rate: any) => {
                if (rate.pricePerCategoryUnit && rate.pricePerCategoryUnit.length > 0) {
                  rate.pricePerCategoryUnit.forEach((cat: any) => {
                    if (cat.amount && typeof cat.amount.amount === 'number') {
                      prices.push(cat.amount.amount);
                    }
                  });
                }
                // Also check for direct price field as fallback
                if (typeof rate.price === 'number') {
                  prices.push(rate.price);
                }
              });
              
              if (prices.length > 0) {
                const lowestPrice = Math.min(...prices);
                bokunPrices.set(dateStr, lowestPrice);
              }
            }
          });
          
          console.log(`Extracted ${bokunPrices.size} Bokun prices for export`);
        } catch (error) {
          console.error("Error fetching Bokun availability for export:", error);
        }
      }
      
      // Build CSV content
      let csvContent = "Departure Airport,Date,Your Price (GBP),Bokun Net Price (GBP),Flight Price Estimate (GBP)\n";
      
      // Group pricing by airport
      const byAirport = new Map<string, typeof pricing>();
      pricing.forEach(p => {
        if (!byAirport.has(p.departureAirport)) {
          byAirport.set(p.departureAirport, []);
        }
        byAirport.get(p.departureAirport)!.push(p);
      });
      
      // Add each pricing entry
      byAirport.forEach((entries, airport) => {
        entries.sort((a, b) => a.departureDate.localeCompare(b.departureDate));
        entries.forEach(entry => {
          const bokunPrice = bokunPrices.get(entry.departureDate) || '';
          const flightEstimate = bokunPrice ? (entry.price - bokunPrice).toFixed(2) : '';
          csvContent += `${airport},${entry.departureDate},${entry.price},${bokunPrice},${flightEstimate}\n`;
        });
      });
      
      // If no existing pricing but linked to Bokun, show available Bokun dates
      // Use a simple row format that can be imported directly
      if (pricing.length === 0 && bokunPrices.size > 0) {
        // Simple format: departure_airport,date,price,bokun_net_price (reference only)
        csvContent = "departure_airport,date,price,bokun_net_price\n";
        csvContent += "# Fill in departure_airport (e.g. LHR) and price (your total including flights)\n";
        csvContent += "# bokun_net_price is the land tour cost - add your flight cost to get total price\n";
        const sortedDates = Array.from(bokunPrices.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        sortedDates.forEach(([date, price]) => {
          // Convert YYYY-MM-DD to DD/MM/YYYY for user friendliness
          const [year, month, day] = date.split('-');
          const ukDate = `${day}/${month}/${year}`;
          csvContent += `,${ukDate},,${price.toFixed(2)}\n`;
        });
      }
      
      // Send as CSV file
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${pkg.slug}-pricing.csv"`);
      res.send(csvContent);
    } catch (error: any) {
      console.error("Error exporting pricing CSV:", error);
      res.status(500).json({ error: "Failed to export pricing" });
    }
  });

  // Submit package enquiry (public)
  app.post("/api/packages/:slug/enquiry", async (req, res) => {
    try {
      const { slug } = req.params;
      const pkg = await storage.getFlightPackageBySlug(slug);
      
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      const parseResult = insertPackageEnquirySchema.safeParse({
        ...req.body,
        packageId: pkg.id,
        packageTitle: pkg.title,
      });
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors 
        });
      }
      
      // Create enquiry record
      const enquiry = await storage.createPackageEnquiry(parseResult.data);
      
      // Also send to Privyr webhook if configured
      if (process.env.PRIVYR_WEBHOOK_URL) {
        try {
          // Build the package URL
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const packageUrl = `${baseUrl}/packages/${slug}`;
          
          // Format price for display
          const formatPrice = (price: number | null | undefined): string => {
            if (!price) return "Not specified";
            return new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(price);
          };

          // Format departure date if provided
          const formatDate = (dateStr: string | null | undefined): string => {
            if (!dateStr) return "Not specified";
            try {
              const date = new Date(dateStr);
              return date.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });
            } catch {
              return dateStr;
            }
          };

          // Prepare payload for Privyr webhook with proper structure
          const privyrPayload = {
            name: `${req.body.firstName} ${req.body.lastName}`,
            email: req.body.email,
            phone: req.body.phone,
            display_name: req.body.firstName,
            other_fields: {
              "First Name": req.body.firstName,
              "Last Name": req.body.lastName,
              "Package Name": pkg.title,
              "Package URL": packageUrl,
              "Departure Date": formatDate(req.body.selectedDate),
              "Departure Airport": req.body.selectedAirportName || req.body.selectedAirport || "Not specified",
              "Price Per Person": formatPrice(req.body.pricePerPerson),
              "Number of Travellers": req.body.numberOfTravelers ? String(req.body.numberOfTravelers) : "Not specified",
              "Additional Requirements": req.body.message || "None",
              "Source": req.body.referrer || "Direct",
              "Form Type": "Package Enquiry",
              "Submitted At": new Date().toISOString(),
            },
          };
          
          console.log("Package enquiry payload being sent to Privyr:", JSON.stringify(privyrPayload, null, 2));
          
          await fetch(process.env.PRIVYR_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(privyrPayload),
          });
          console.log("Package enquiry sent to Privyr successfully");
        } catch (webhookError) {
          console.error("Failed to send to Privyr:", webhookError);
        }
      }
      
      res.status(201).json({ success: true, enquiry });
    } catch (error: any) {
      console.error("Error submitting enquiry:", error);
      res.status(500).json({ error: "Failed to submit enquiry" });
    }
  });

  // Get all enquiries (admin)
  app.get("/api/admin/enquiries", verifyAdminSession, async (req, res) => {
    try {
      const enquiries = await storage.getAllPackageEnquiries();
      res.json(enquiries);
    } catch (error: any) {
      console.error("Error fetching enquiries:", error);
      res.status(500).json({ error: "Failed to fetch enquiries" });
    }
  });

  // Update enquiry status (admin)
  app.patch("/api/admin/enquiries/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const enquiry = await storage.updatePackageEnquiryStatus(parseInt(id), status);
      res.json(enquiry);
    } catch (error: any) {
      console.error("Error updating enquiry:", error);
      res.status(500).json({ error: "Failed to update enquiry" });
    }
  });

  // ===== TOUR ENQUIRY ROUTES =====
  
  // Submit tour enquiry (for Bokun land tours)
  app.post("/api/tours/:productId/enquiry", async (req, res) => {
    try {
      const { productId } = req.params;
      
      const parseResult = insertTourEnquirySchema.safeParse({
        ...req.body,
        productId,
      });
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors 
        });
      }
      
      // Create enquiry record
      const enquiry = await storage.createTourEnquiry(parseResult.data);
      
      // Also send to Privyr webhook if configured
      if (process.env.PRIVYR_WEBHOOK_URL) {
        try {
          // Build the tour URL
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const tourUrl = `${baseUrl}/tour/${productId}`;
          
          // Format price for display
          const formatPrice = (price: number | null | undefined): string => {
            if (!price) return "Not specified";
            return new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(price);
          };

          // Format departure date if provided
          const formatDate = (dateStr: string | null | undefined): string => {
            if (!dateStr) return "Not specified";
            try {
              const date = new Date(dateStr);
              return date.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });
            } catch {
              return dateStr;
            }
          };

          // Prepare payload for Privyr webhook - using other_fields dict format per docs
          const privyrPayload = {
            name: `${req.body.firstName} ${req.body.lastName}`,
            email: req.body.email,
            phone: req.body.phone,
            display_name: req.body.firstName,
            other_fields: {
              "Tour Name": req.body.productTitle,
              "Departure Date": formatDate(req.body.departureDate),
              "Room/Category": req.body.rateTitle || "Not specified",
              "Estimated Price": formatPrice(req.body.estimatedPrice),
              "Number of Travellers": req.body.numberOfTravelers ? String(req.body.numberOfTravelers) : "Not specified",
              "Additional Requirements": req.body.message || "None",
              "Source": req.body.referrer || "Direct",
              "Form Type": "Tour Enquiry",
              "Tour URL": tourUrl
            }
          };
          
          console.log("Tour enquiry payload being sent to Privyr:", JSON.stringify(privyrPayload, null, 2));
          
          await fetch(process.env.PRIVYR_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(privyrPayload),
          });
          console.log("Tour enquiry sent to Privyr successfully");
        } catch (webhookError) {
          console.error("Failed to send tour enquiry to Privyr:", webhookError);
        }
      }
      
      res.status(201).json({ success: true, enquiry });
    } catch (error: any) {
      console.error("Error submitting tour enquiry:", error);
      res.status(500).json({ error: "Failed to submit tour enquiry" });
    }
  });

  // Get all tour enquiries (admin)
  app.get("/api/admin/tour-enquiries", verifyAdminSession, async (req, res) => {
    try {
      const enquiries = await storage.getAllTourEnquiries();
      res.json(enquiries);
    } catch (error: any) {
      console.error("Error fetching tour enquiries:", error);
      res.status(500).json({ error: "Failed to fetch tour enquiries" });
    }
  });

  // Update tour enquiry status (admin)
  app.patch("/api/admin/tour-enquiries/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const enquiry = await storage.updateTourEnquiryStatus(parseInt(id), status);
      res.json(enquiry);
    } catch (error: any) {
      console.error("Error updating tour enquiry:", error);
      res.status(500).json({ error: "Failed to update tour enquiry" });
    }
  });

  // ===== REVIEWS ROUTES =====
  
  // Get published reviews (public)
  app.get("/api/reviews", async (req, res) => {
    try {
      const reviews = await storage.getPublishedReviews();
      res.json(reviews);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Get all reviews (admin)
  app.get("/api/admin/reviews", verifyAdminSession, async (req, res) => {
    try {
      const reviews = await storage.getAllReviews();
      res.json(reviews);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Get single review (admin)
  app.get("/api/admin/reviews/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const review = await storage.getReviewById(parseInt(id));
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      res.json(review);
    } catch (error: any) {
      console.error("Error fetching review:", error);
      res.status(500).json({ error: "Failed to fetch review" });
    }
  });

  // Create review (admin)
  app.post("/api/admin/reviews", verifyAdminSession, async (req, res) => {
    try {
      const parsed = insertReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid review data", details: parsed.error.errors });
      }
      const review = await storage.createReview(parsed.data);
      res.status(201).json(review);
    } catch (error: any) {
      console.error("Error creating review:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Update review (admin)
  app.patch("/api/admin/reviews/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const parsed = updateReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid review data", details: parsed.error.errors });
      }
      const review = await storage.updateReview(parseInt(id), parsed.data);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      res.json(review);
    } catch (error: any) {
      console.error("Error updating review:", error);
      res.status(500).json({ error: "Failed to update review" });
    }
  });

  // Delete review (admin)
  app.delete("/api/admin/reviews/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReview(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting review:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // ===== TRACKING NUMBERS (DNI) =====
  
  // Get tracking number for visitor (public) - based on tag in URL or referrer domain
  // Priority: 1. URL tag (?tzl) → 2. Referrer domain (google.com) → 3. Default number
  app.get("/api/tracking-number", async (req, res) => {
    try {
      const { tag, domain } = req.query;
      
      let number;
      
      // Priority 1: Check for URL tag first
      if (tag) {
        number = await storage.getTrackingNumberByTag(tag as string);
      }
      
      // Priority 2: If no tag match, try referrer domain
      if (!number && domain) {
        number = await storage.getTrackingNumberByDomain(domain as string);
      }
      
      // Priority 3: Fall back to default number
      if (!number) {
        number = await storage.getDefaultTrackingNumber();
      }
      
      if (number) {
        res.json({ 
          phoneNumber: number.phoneNumber,
          id: number.id 
        });
      } else {
        // Return hardcoded default if no numbers in database
        res.json({ phoneNumber: "0208 183 0518", id: null });
      }
    } catch (error: any) {
      console.error("Error getting tracking number:", error);
      res.json({ phoneNumber: "0208 183 0518", id: null });
    }
  });

  // Get all tracking numbers (admin)
  app.get("/api/admin/tracking-numbers", verifyAdminSession, async (req, res) => {
    try {
      const numbers = await storage.getAllTrackingNumbers();
      res.json(numbers);
    } catch (error: any) {
      console.error("Error fetching tracking numbers:", error);
      res.status(500).json({ error: "Failed to fetch tracking numbers" });
    }
  });

  // Get single tracking number (admin)
  app.get("/api/admin/tracking-numbers/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const number = await storage.getTrackingNumberById(parseInt(id));
      if (!number) {
        return res.status(404).json({ error: "Tracking number not found" });
      }
      res.json(number);
    } catch (error: any) {
      console.error("Error fetching tracking number:", error);
      res.status(500).json({ error: "Failed to fetch tracking number" });
    }
  });

  // Create tracking number (admin)
  app.post("/api/admin/tracking-numbers", verifyAdminSession, async (req, res) => {
    try {
      const { insertTrackingNumberSchema } = await import("@shared/schema");
      const parsed = insertTrackingNumberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid tracking number data", details: parsed.error.errors });
      }
      const number = await storage.createTrackingNumber(parsed.data);
      res.status(201).json(number);
    } catch (error: any) {
      console.error("Error creating tracking number:", error);
      res.status(500).json({ error: "Failed to create tracking number" });
    }
  });

  // Update tracking number (admin)
  app.patch("/api/admin/tracking-numbers/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      const { updateTrackingNumberSchema } = await import("@shared/schema");
      const parsed = updateTrackingNumberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid tracking number data", details: parsed.error.errors });
      }
      const number = await storage.updateTrackingNumber(parseInt(id), parsed.data);
      if (!number) {
        return res.status(404).json({ error: "Tracking number not found" });
      }
      res.json(number);
    } catch (error: any) {
      console.error("Error updating tracking number:", error);
      res.status(500).json({ error: "Failed to update tracking number" });
    }
  });

  // Delete tracking number (admin)
  app.delete("/api/admin/tracking-numbers/:id", verifyAdminSession, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTrackingNumber(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting tracking number:", error);
      res.status(500).json({ error: "Failed to delete tracking number" });
    }
  });

  // Site Settings API endpoints (admin)
  app.get("/api/admin/settings", verifyAdminSession, async (req, res) => {
    try {
      const settings = await storage.getAllSiteSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching site settings:", error);
      res.status(500).json({ error: "Failed to fetch site settings" });
    }
  });

  app.get("/api/admin/settings/:key", verifyAdminSession, async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSiteSettingByKey(key);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error: any) {
      console.error("Error fetching site setting:", error);
      res.status(500).json({ error: "Failed to fetch site setting" });
    }
  });

  app.put("/api/admin/settings/:key", verifyAdminSession, async (req, res) => {
    try {
      const { key } = req.params;
      const { value, label, description } = req.body;
      
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ error: "Value is required" });
      }
      
      // If label provided, upsert; otherwise just update value
      if (label) {
        const setting = await storage.upsertSiteSetting(key, value, label, description);
        res.json(setting);
      } else {
        const setting = await storage.updateSiteSetting(key, value);
        if (!setting) {
          return res.status(404).json({ error: "Setting not found" });
        }
        res.json(setting);
      }
    } catch (error: any) {
      console.error("Error updating site setting:", error);
      res.status(500).json({ error: "Failed to update site setting" });
    }
  });

  // Initialize default settings (admin)
  app.post("/api/admin/settings/initialize", verifyAdminSession, async (req, res) => {
    try {
      // Create default exchange rate if it doesn't exist
      const exchangeRate = await storage.upsertSiteSetting(
        "usd_to_gbp_rate",
        "0.79",
        "USD to GBP Exchange Rate",
        "Exchange rate used to convert Bokun API prices from USD to GBP"
      );
      res.json({ success: true, settings: [exchangeRate] });
    } catch (error: any) {
      console.error("Error initializing settings:", error);
      res.status(500).json({ error: "Failed to initialize settings" });
    }
  });

  // Trigger Bokun product cache refresh (admin)
  app.post("/api/admin/refresh-bokun-cache", verifyAdminSession, async (req, res) => {
    try {
      console.log("[Admin] Starting manual Bokun cache refresh...");
      // Run the cache refresh in the background
      runWeeklyBokunCacheRefresh().catch(err => {
        console.error("[Admin] Bokun cache refresh failed:", err);
      });
      
      res.json({ 
        success: true, 
        message: "Bokun product cache refresh started. This may take several minutes." 
      });
    } catch (error: any) {
      console.error("Error starting Bokun cache refresh:", error);
      res.status(500).json({ error: "Failed to start cache refresh" });
    }
  });

  // Trigger flight price refresh (admin)
  app.post("/api/admin/refresh-flight-prices", verifyAdminSession, async (req, res) => {
    try {
      console.log("[Admin] Starting manual flight price refresh...");
      // Run the flight refresh in the background
      runWeeklyFlightRefresh().catch(err => {
        console.error("[Admin] Flight price refresh failed:", err);
      });
      
      res.json({ 
        success: true, 
        message: "Flight price refresh started. This may take several minutes. Check server logs for progress." 
      });
    } catch (error: any) {
      console.error("Error starting flight price refresh:", error);
      res.status(500).json({ error: "Failed to start flight price refresh" });
    }
  });

  // Get exchange rate (public - needed for frontend)
  app.get("/api/exchange-rate", async (req, res) => {
    try {
      const rate = await storage.getExchangeRate();
      res.json({ rate });
    } catch (error: any) {
      console.error("Error fetching exchange rate:", error);
      res.status(500).json({ error: "Failed to fetch exchange rate" });
    }
  });

  // Get homepage settings (public - needed for frontend)
  app.get("/api/homepage-settings", async (req, res) => {
    try {
      const settings = await storage.getAllSiteSettings();
      const packagesCount = settings.find(s => s.key === "homepage_packages_count");
      const heroImage = settings.find(s => s.key === "homepage_hero_image");
      
      res.json({
        packagesCount: parseInt(packagesCount?.value || "4"),
        heroImage: heroImage?.value || null
      });
    } catch (error: any) {
      console.error("Error fetching homepage settings:", error);
      res.json({
        packagesCount: 4,
        heroImage: null
      });
    }
  });

  // Configure multer for memory storage (for Object Storage uploads)
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: imageFilter
  });

  // Upload image (admin) - stores in Object Storage for persistence
  app.post("/api/admin/upload", verifyAdminSession, memoryUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      
      console.log(`[Upload] Received file: ${req.file.originalname}, size: ${req.file.size} bytes`);
      
      const objectStorageService = new ObjectStorageService();
      const isAvailable = await objectStorageService.isAvailable();
      
      console.log(`[Upload] Object Storage available: ${isAvailable}`);
      
      if (isAvailable) {
        // Upload to Object Storage for persistence
        console.log(`[Upload] Uploading to Object Storage...`);
        const imageUrl = await objectStorageService.uploadFromBuffer(
          req.file.buffer,
          req.file.originalname
        );
        console.log(`[Upload] Success - stored at: ${imageUrl}`);
        res.json({ 
          success: true, 
          url: imageUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          storage: 'object-storage'
        });
      } else {
        // Fallback to local disk (won't persist after deploy)
        console.warn(`[Upload] WARNING: Object Storage not available! Using local storage (will NOT persist in production)`);
        const filename = `${Date.now()}-${req.file.originalname}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, req.file.buffer);
        res.json({ 
          success: true, 
          url: `/uploads/${filename}`,
          filename: filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          storage: 'local',
          warning: 'Using local storage - images will NOT persist after redeployment'
        });
      }
    } catch (error: any) {
      console.error("[Upload] Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image", details: error.message });
    }
  });

  // Upload multiple images (admin) - stores in Object Storage for persistence
  app.post("/api/admin/upload-multiple", verifyAdminSession, memoryUpload.array('images', 20), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No image files provided" });
      }
      
      console.log(`[Upload-Multiple] Received ${files.length} files`);
      
      const objectStorageService = new ObjectStorageService();
      const isAvailable = await objectStorageService.isAvailable();
      
      console.log(`[Upload-Multiple] Object Storage available: ${isAvailable}`);
      
      if (!isAvailable) {
        console.warn(`[Upload-Multiple] WARNING: Object Storage not available! Using local storage (will NOT persist in production)`);
      }
      
      const uploadedImages = [];
      
      for (const file of files) {
        console.log(`[Upload-Multiple] Processing: ${file.originalname}`);
        if (isAvailable) {
          const imageUrl = await objectStorageService.uploadFromBuffer(
            file.buffer,
            file.originalname
          );
          console.log(`[Upload-Multiple] Uploaded to Object Storage: ${imageUrl}`);
          uploadedImages.push({
            url: imageUrl,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype
          });
        } else {
          const filename = `${Date.now()}-${file.originalname}`;
          const filePath = path.join(uploadDir, filename);
          fs.writeFileSync(filePath, file.buffer);
          uploadedImages.push({
            url: `/uploads/${filename}`,
            filename: filename,
            size: file.size,
            mimetype: file.mimetype
          });
        }
      }
      
      res.json({ 
        success: true, 
        images: uploadedImages,
        count: uploadedImages.length,
        storage: isAvailable ? 'object-storage' : 'local',
        warning: isAvailable ? undefined : 'Using local storage - images will NOT persist after redeployment'
      });
    } catch (error: any) {
      console.error("[Upload-Multiple] Error uploading images:", error);
      res.status(500).json({ error: "Failed to upload images", details: error.message });
    }
  });

  // Upload video (admin) - stores in Object Storage for persistence
  const videoFilter = (req: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('video/')) {
      callback(null, true);
    } else {
      callback(new Error('Only video files are allowed'));
    }
  };

  const videoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
    fileFilter: videoFilter
  });

  app.post("/api/admin/upload-video", verifyAdminSession, videoUpload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
      }
      
      const originalSize = req.file.size;
      console.log(`[Video Upload] Received file: ${req.file.originalname}, size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
      
      // Compress video using ffmpeg
      const tempDir = '/tmp/video-processing';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const inputPath = path.join(tempDir, `input-${Date.now()}.mp4`);
      const outputPath = path.join(tempDir, `output-${Date.now()}.mp4`);
      
      // Write original file to temp
      fs.writeFileSync(inputPath, req.file.buffer);
      
      // Compress with ffmpeg - optimize for mobile web playback
      // -crf 28 = good quality/size balance (lower = better quality, higher = smaller file)
      // -preset fast = balance between encoding speed and compression
      // -vf scale=-2:720 = scale to 720p height, maintaining aspect ratio
      // -c:a aac -b:a 128k = compress audio
      console.log(`[Video Upload] Compressing video with ffmpeg...`);
      
      try {
        await execPromise(
          `ffmpeg -i "${inputPath}" -c:v libx264 -crf 28 -preset fast -vf "scale=-2:720" -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`,
          { timeout: 120000 } // 2 minute timeout
        );
      } catch (ffmpegError: any) {
        console.error(`[Video Upload] ffmpeg compression failed:`, ffmpegError.message);
        // Clean up and continue with original file
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        throw new Error(`Video compression failed: ${ffmpegError.message}`);
      }
      
      // Read compressed video
      const compressedBuffer = fs.readFileSync(outputPath);
      const compressedSize = compressedBuffer.length;
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      
      console.log(`[Video Upload] Compressed: ${(originalSize / 1024 / 1024).toFixed(2)} MB -> ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${compressionRatio}% reduction)`);
      
      // Clean up temp files
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      
      const objectStorageService = new ObjectStorageService();
      const isAvailable = await objectStorageService.isAvailable();
      
      console.log(`[Video Upload] Object Storage available: ${isAvailable}`);
      
      if (isAvailable) {
        // Upload compressed video to Object Storage
        console.log(`[Video Upload] Uploading compressed video to Object Storage...`);
        
        const filename = `videos/${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`;
        
        const videoUrl = await objectStorageService.uploadFromBuffer(
          compressedBuffer,
          filename
        );
        console.log(`[Video Upload] Success - stored at: ${videoUrl}`);
        res.json({ 
          success: true, 
          url: videoUrl,
          filename: req.file.originalname,
          originalSize: originalSize,
          compressedSize: compressedSize,
          compressionRatio: `${compressionRatio}%`,
          mimetype: 'video/mp4',
          storage: 'object-storage'
        });
      } else {
        // Fallback to local disk
        console.warn(`[Video Upload] WARNING: Object Storage not available!`);
        const filename = `${Date.now()}-compressed.mp4`;
        const videoDir = path.join(uploadDir, 'videos');
        if (!fs.existsSync(videoDir)) {
          fs.mkdirSync(videoDir, { recursive: true });
        }
        const filePath = path.join(videoDir, filename);
        fs.writeFileSync(filePath, compressedBuffer);
        res.json({ 
          success: true, 
          url: `/uploads/videos/${filename}`,
          filename: filename,
          originalSize: originalSize,
          compressedSize: compressedSize,
          compressionRatio: `${compressionRatio}%`,
          mimetype: 'video/mp4',
          storage: 'local',
          warning: 'Using local storage - videos will NOT persist'
        });
      }
    } catch (error: any) {
      console.error("[Video Upload] Error uploading video:", error);
      res.status(500).json({ error: "Failed to upload video", details: error.message });
    }
  });

  // Delete uploaded image (admin) - handles both Object Storage and local files
  app.delete("/api/admin/upload/:filename", verifyAdminSession, async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Try to delete from Object Storage first
      const objectStorageService = new ObjectStorageService();
      const objectPath = `images/${filename}`;
      const deleted = await objectStorageService.deleteObject(objectPath);
      
      if (deleted) {
        return res.json({ success: true, storage: 'object-storage' });
      }
      
      // Fallback: try local file
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true, storage: 'local' });
      }
      
      res.status(404).json({ error: "Image not found" });
    } catch (error: any) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  // Import sample packages (admin)
  app.post("/api/admin/packages/import-samples", verifyAdminSession, async (req, res) => {
    try {
      const { samplePackages } = await import("./scraper");
      const imported: any[] = [];
      const errors: string[] = [];
      
      for (const pkg of samplePackages) {
        try {
          // Check if package with this slug already exists
          const existing = await storage.getFlightPackageBySlug(pkg.slug);
          if (existing) {
            errors.push(`Package "${pkg.title}" already exists`);
            continue;
          }
          
          const created = await storage.createFlightPackage(pkg);
          imported.push(created);
        } catch (err: any) {
          errors.push(`Failed to import "${pkg.title}": ${err.message}`);
        }
      }
      
      res.json({ 
        success: true, 
        imported: imported.length,
        errors 
      });
    } catch (error: any) {
      console.error("Error importing samples:", error);
      res.status(500).json({ error: "Failed to import sample packages" });
    }
  });

  // Bulk import packages from JSON (admin)
  app.post("/api/admin/packages/import", verifyAdminSession, async (req, res) => {
    try {
      const { packages } = req.body;
      
      if (!Array.isArray(packages)) {
        return res.status(400).json({ error: "Expected 'packages' array in request body" });
      }
      
      const imported: any[] = [];
      const errors: string[] = [];
      
      for (const pkg of packages) {
        try {
          const parseResult = insertFlightPackageSchema.safeParse(pkg);
          if (!parseResult.success) {
            errors.push(`Invalid package data for "${pkg.title || 'Unknown'}": ${parseResult.error.message}`);
            continue;
          }
          
          // Check if package with this slug already exists
          const existing = await storage.getFlightPackageBySlug(parseResult.data.slug);
          if (existing) {
            errors.push(`Package "${parseResult.data.title}" already exists`);
            continue;
          }
          
          const created = await storage.createFlightPackage(parseResult.data);
          imported.push(created);
        } catch (err: any) {
          errors.push(`Failed to import "${pkg.title || 'Unknown'}": ${err.message}`);
        }
      }
      
      res.json({ 
        success: true, 
        imported: imported.length,
        errors 
      });
    } catch (error: any) {
      console.error("Error importing packages:", error);
      res.status(500).json({ error: "Failed to import packages" });
    }
  });

  // Test scraper endpoint - validates extraction from holidays.flightsandpackages.com
  app.post("/api/admin/scrape-test", verifyAdminSession, async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Import cheerio and node-fetch dynamically
      const cheerio = await import("cheerio");
      const fetch = (await import("node-fetch")).default;
      
      console.log(`Scraping test URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch URL: ${response.status}` });
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract data based on the structure of holidays.flightsandpackages.com
      const extracted = {
        // Title - extract from URL slug as fallback, or from page title tag
        title: '',
        
        // Price - look for currency symbols
        priceText: $('[class*="price"]').first().text().trim() || 
                   $('*:contains("£")').filter((_, el) => !!$(el).text().match(/£\d+/)).first().text().trim(),
        price: 0,
        
        // Category from URL or breadcrumb
        category: url.match(/\/Holidays\/([^\/]+)/)?.[1]?.replace(/-/g, ' ') || '',
        
        // Slug from URL
        slug: url.split('/').pop()?.toLowerCase() || '',
        
        // Overview section
        overview: '',
        
        // What's Included
        whatsIncluded: [] as string[],
        
        // Highlights  
        highlights: [] as string[],
        
        // Itinerary
        itinerary: [] as { day: number; title: string; description: string }[],
        
        // Hotel images
        hotelImages: [] as string[],
        
        // Accommodations (hotels with name, description, images)
        accommodations: [] as { name: string; description: string; images: string[] }[],
        
        // Featured image
        featuredImage: '',
        
        // Raw sections for debugging
        _debug: {
          h1Count: $('h1').length,
          h2Count: $('h2').length,
          h3Texts: [] as string[],
          sectionTexts: [] as string[],
        }
      };
      
      // Helper function to convert HTML to text while preserving paragraphs
      const htmlToText = (element: any): string => {
        // Replace <p>, <br>, <div> with newlines, then get text
        let html = $(element).html() || '';
        // Add double newlines for paragraphs
        html = html.replace(/<\/p>/gi, '\n\n');
        html = html.replace(/<p[^>]*>/gi, '');
        // Add single newlines for line breaks and divs
        html = html.replace(/<br\s*\/?>/gi, '\n');
        html = html.replace(/<\/div>/gi, '\n');
        html = html.replace(/<div[^>]*>/gi, '');
        // Remove other HTML tags
        html = html.replace(/<[^>]+>/g, '');
        // Decode HTML entities
        html = html.replace(/&nbsp;/gi, ' ');
        html = html.replace(/&amp;/gi, '&');
        html = html.replace(/&lt;/gi, '<');
        html = html.replace(/&gt;/gi, '>');
        html = html.replace(/&quot;/gi, '"');
        html = html.replace(/&#39;/gi, "'");
        html = html.replace(/&rsquo;/gi, "'");
        html = html.replace(/&lsquo;/gi, "'");
        html = html.replace(/&rdquo;/gi, '"');
        html = html.replace(/&ldquo;/gi, '"');
        html = html.replace(/&ndash;/gi, '–');
        html = html.replace(/&mdash;/gi, '—');
        html = html.replace(/&hellip;/gi, '...');
        // Clean up excessive whitespace while preserving paragraph breaks
        html = html.replace(/\n\s*\n\s*\n/g, '\n\n');
        html = html.replace(/[ \t]+/g, ' ');
        return html.trim();
      };
      
      // Extract h3 headings for debugging
      $('h3').each((_, el) => {
        extracted._debug.h3Texts.push($(el).text().trim());
      });
      
      // Find Overview section - preserve paragraph formatting
      const overviewSection = $('h3:contains("Overview")').parent();
      if (overviewSection.length) {
        extracted.overview = htmlToText(overviewSection.find('p').parent());
      }
      
      // Alternative: Look for #overview section
      if (!extracted.overview) {
        const overviewDiv = $('#overview, [id*="overview"]');
        if (overviewDiv.length) {
          extracted.overview = htmlToText(overviewDiv).substring(0, 2000);
        }
      }
      
      // Find What's Included section
      const includedSection = $('h3:contains("Included"), h3:contains("included")').parent();
      if (includedSection.length) {
        includedSection.find('li').each((_, el) => {
          const text = $(el).text().trim();
          if (text) extracted.whatsIncluded.push(text);
        });
      }
      
      // Find Highlights section
      const highlightsSection = $('h3:contains("Highlight"), h3:contains("highlight")').parent();
      if (highlightsSection.length) {
        highlightsSection.find('li').each((_, el) => {
          const text = $(el).text().trim();
          if (text) extracted.highlights.push(text);
        });
      }
      
      // Find Itinerary section - use proper selectors for holidays.flightsandpackages.com structure
      const itinerarySection = $('#itinerary, .itinerary-section');
      if (itinerarySection.length) {
        itinerarySection.find('.accordion-panel').each((_, panel) => {
          const dayText = $(panel).find('.day').first().text().trim();
          const dayMatch = dayText.match(/Day\s*(\d+)/i);
          
          if (dayMatch) {
            const dayNum = parseInt(dayMatch[1]);
            // Get title from .description div
            const title = $(panel).find('.description').first().text().trim() || `Day ${dayNum}`;
            // Get full description from .panel-content .desc - preserve paragraph formatting
            const descElement = $(panel).find('.panel-content .desc');
            const desc = htmlToText(descElement).substring(0, 2000);
            
            if (!extracted.itinerary.find(i => i.day === dayNum)) {
              extracted.itinerary.push({
                day: dayNum,
                title: title.substring(0, 150),
                description: desc
              });
            }
          }
        });
      }
      
      // Fallback: search for Day patterns if no itinerary section found
      if (extracted.itinerary.length === 0) {
        $('*').each((_, el) => {
          const text = $(el).text();
          const dayMatch = text.match(/Day\s*(\d+)/i);
          if (dayMatch) {
            const dayNum = parseInt(dayMatch[1]);
            if (dayNum <= 20 && !extracted.itinerary.find(i => i.day === dayNum)) {
              const parent = $(el).parent();
              const title = parent.find('h4, strong').first().text().trim() || 
                           text.split('\n')[0]?.replace(/Day\s*\d+\s*/i, '').trim() || `Day ${dayNum}`;
              const desc = parent.find('p').text().trim().substring(0, 500);
              
              if (title || desc) {
                extracted.itinerary.push({
                  day: dayNum,
                  title: title.substring(0, 100),
                  description: desc
                });
              }
            }
          }
        });
      }
      
      // Sort itinerary by day
      extracted.itinerary.sort((a, b) => a.day - b.day);
      
      // Extract accommodations section - hotels with names, descriptions, and images
      // Try multiple selectors for accommodation section
      const accommodationSelectors = [
        '#accommodation',
        '.accommodation-section',
        '#Accommodation',
        '[data-section="accommodation"]',
        'section:contains("Accommodation")',
        'div[class*="accommodation"]',
        'div[class*="hotel"]'
      ];
      
      let accommodationSection = $();
      for (const selector of accommodationSelectors) {
        const found = $(selector);
        if (found.length) {
          accommodationSection = found.first();
          break;
        }
      }
      
      if (accommodationSection.length) {
        // Try multiple patterns for hotel panels
        const panelSelectors = [
          '.accordion-panel',
          '.hotel-panel',
          '.accommodation-item',
          '.hotel-item',
          '[class*="accordion"]'
        ];
        
        let panels = $();
        for (const selector of panelSelectors) {
          panels = accommodationSection.find(selector);
          if (panels.length) break;
        }
        
        if (panels.length) {
          // Panel-based structure
          console.log(`Found ${panels.length} accommodation panels`);
          panels.each((_, panel) => {
            // Try multiple selectors for hotel name
            const hotelName = $(panel).find('.label').first().text().trim() ||
                             $(panel).find('.title').first().text().trim() ||
                             $(panel).find('.hotel-name').first().text().trim() ||
                             $(panel).find('h3, h4, h5').first().text().trim() ||
                             $(panel).find('.description').first().text().trim();
            
            console.log(`Panel hotel name: "${hotelName}"`);
            
            if (hotelName && hotelName.length > 2 && !hotelName.match(/^Day\s*\d+$/i)) {
              // Get hotel description - try multiple selectors including p.MsoNormal
              let hotelDesc = '';
              const descSelectors = ['.panel-content p.MsoNormal', '.panel-content .desc', '.desc', '.hotel-desc', '.description', 'p'];
              for (const sel of descSelectors) {
                const descEl = $(panel).find(sel);
                if (descEl.length) {
                  hotelDesc = htmlToText(descEl);
                  if (hotelDesc.length > 20) break;
                }
              }
              
              console.log(`Panel description length: ${hotelDesc.length}`);
              
              // Get hotel images from carousel - less restrictive matching
              const hotelImages: string[] = [];
              
              // First try anchor hrefs (higher quality images)
              $(panel).find('.accommodation-carousel a.img-url, a[href*="HotelImages"], a[href*="PackageImages"]').each((_, a) => {
                const href = $(a).attr('href');
                if (href && !hotelImages.includes(href)) {
                  hotelImages.push(href);
                }
              });
              
              // Fallback to img src if no anchors found
              if (hotelImages.length === 0) {
                $(panel).find('.accommodation-carousel img, .panel-content img').each((_, img) => {
                  const src = $(img).attr('src');
                  if (src && !hotelImages.includes(src)) {
                    hotelImages.push(src);
                  }
                });
              }
              
              console.log(`Panel images found: ${hotelImages.length}`);
              
              extracted.accommodations.push({
                name: hotelName.substring(0, 150),
                description: hotelDesc.trim().substring(0, 800),
                images: hotelImages.slice(0, 10)
              });
            }
          });
        } else {
          // Flat structure - hotel data directly in accommodation section
          // Look for hotel name in .label or .title elements (but not section headers)
          let hotelName = '';
          
          // First try .title which often has the hotel name
          const titleEl = accommodationSection.find('.title').first();
          if (titleEl.length) {
            hotelName = titleEl.text().trim();
          }
          
          // Fallback to .label if no title found
          if (!hotelName) {
            const labelEl = accommodationSection.find('.label').first();
            if (labelEl.length) {
              hotelName = labelEl.text().trim();
            }
          }
          
          // Last fallback to h3/h4
          if (!hotelName) {
            const headerEl = accommodationSection.find('h3, h4').first();
            if (headerEl.length) {
              const text = headerEl.text().trim();
              if (!text.match(/Accommodation/i) && !text.match(/Facilities/i)) {
                hotelName = text;
              }
            }
          }
          
          if (hotelName && hotelName.length > 2 && !hotelName.match(/^Day\s*\d+$/i) && !hotelName.match(/^Accommodation/i)) {
            // Get hotel description from paragraphs (MsoNormal class or regular p tags)
            let hotelDesc = '';
            accommodationSection.find('p.MsoNormal, p').each((_, p) => {
              const text = $(p).text().trim();
              // Include description text even if it mentions Hotel/Resort - the first line might be about the hotel
              if (text.length > 30) {
                hotelDesc += text + ' ';
              }
            });
            
            // Get hotel images from carousel links (higher quality than img src)
            const hotelImages: string[] = [];
            accommodationSection.find('.accommodation-carousel a.img-url, a[href*="HotelImages"], a[href*="PackageImages"]').each((_, a) => {
              const href = $(a).attr('href');
              if (href && !hotelImages.includes(href)) {
                hotelImages.push(href);
              }
            });
            
            // Fallback to img src if no anchor hrefs found
            if (hotelImages.length === 0) {
              accommodationSection.find('.accommodation-carousel img, img[src*="Hotel"], img[src*="PackageImages"]').each((_, img) => {
                const src = $(img).attr('src');
                if (src && !hotelImages.includes(src)) {
                  hotelImages.push(src);
                }
              });
            }
            
            if (hotelName || hotelImages.length > 0) {
              extracted.accommodations.push({
                name: hotelName.substring(0, 150),
                description: hotelDesc.trim().substring(0, 800),
                images: hotelImages.slice(0, 10)
              });
            }
          }
        }
      }
      
      // Fallback: Look for any hotel-related content if no accommodations found
      if (extracted.accommodations.length === 0) {
        // Try to find hotel names in the page
        $('*:contains("Hotel"), *:contains("Resort"), *:contains("Lodge")').each((_, el) => {
          const text = $(el).text().trim();
          // Look for patterns like "Hotel Name" or "The Resort"
          const hotelMatch = text.match(/^([\w\s]+(?:Hotel|Resort|Lodge|Villa|Inn|Suites?)[\w\s]*)/i);
          if (hotelMatch && hotelMatch[1].length > 5 && hotelMatch[1].length < 100) {
            const name = hotelMatch[1].trim();
            // Check if we already have this hotel
            if (!extracted.accommodations.find(a => a.name.toLowerCase() === name.toLowerCase())) {
              const parent = $(el).closest('.panel, .card, .item, section, article');
              const desc = parent.find('p').text().trim().substring(0, 400);
              const images: string[] = [];
              parent.find('img').each((_, img) => {
                const src = $(img).attr('src');
                if (src && src.includes('Hotel')) images.push(src);
              });
              
              if (name && extracted.accommodations.length < 5) {
                extracted.accommodations.push({
                  name,
                  description: desc,
                  images: images.slice(0, 3)
                });
              }
            }
          }
        });
      }
      
      // Extract hotel/accommodation images (all images combined)
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && (src.includes('Hotel') || src.includes('hotel') || src.includes('accommodation') || 
            src.includes('PackageImages') || src.includes('.webp') || src.includes('.jpg'))) {
          if (!extracted.hotelImages.includes(src)) {
            extracted.hotelImages.push(src);
          }
        }
      });
      
      // Get featured image (first large image or og:image)
      extracted.featuredImage = $('meta[property="og:image"]').attr('content') || 
                                $('img[class*="hero"], img[class*="featured"]').first().attr('src') ||
                                extracted.hotelImages[0] || '';
      
      // Parse price
      const priceMatch = extracted.priceText.match(/[£$€]?\s*([\d,]+)/);
      if (priceMatch) {
        extracted.price = parseInt(priceMatch[1].replace(/,/g, '')) || 0;
      }
      
      // Get section content for debugging
      $('section, div[class*="section"]').each((i, el) => {
        if (i < 5) {
          extracted._debug.sectionTexts.push($(el).text().trim().substring(0, 200));
        }
      });
      
      // Extract title - try multiple methods
      // Method 1: Page title tag (before |)
      const pageTitle = $('title').text().split('|')[0]?.trim();
      if (pageTitle && pageTitle.length > 5 && !pageTitle.includes('Europe') && !pageTitle.includes('Asia')) {
        extracted.title = pageTitle;
      }
      
      // Method 2: First h1 that's not in navigation
      if (!extracted.title) {
        $('h1').each((_, el) => {
          const text = $(el).text().trim();
          // Skip navigation items
          if (text.length > 10 && !['Europe', 'Asia', 'Africa', 'Americas', 'Middle East'].includes(text)) {
            extracted.title = text;
            return false; // break
          }
        });
      }
      
      // Method 3: From URL slug (convert to title case)
      if (!extracted.title || extracted.title.length < 5) {
        const slugFromUrl = url.split('/').pop() || '';
        extracted.title = slugFromUrl
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      
      res.json({
        success: true,
        url,
        extracted
      });
      
    } catch (error: any) {
      console.error("Scrape test error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Process and optimize images from URLs
  app.post("/api/admin/process-images", verifyAdminSession, async (req, res) => {
    try {
      const { imageUrls, packageSlug, maxImages = 10 } = req.body;
      
      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({ error: "imageUrls array is required" });
      }
      
      if (!packageSlug || typeof packageSlug !== 'string') {
        return res.status(400).json({ error: "packageSlug is required" });
      }
      
      console.log(`Processing ${imageUrls.length} images for package: ${packageSlug}`);
      
      const processedImages = await processMultipleImages(imageUrls, packageSlug, maxImages);
      
      res.json({
        success: true,
        processed: processedImages.length,
        total: imageUrls.length,
        images: processedImages
      });
      
    } catch (error: any) {
      console.error("Image processing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Process a single image from URL
  app.post("/api/admin/process-image", verifyAdminSession, async (req, res) => {
    try {
      const { imageUrl, packageSlug } = req.body;
      
      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({ error: "imageUrl is required" });
      }
      
      if (!packageSlug || typeof packageSlug !== 'string') {
        return res.status(400).json({ error: "packageSlug is required" });
      }
      
      console.log(`Processing image for package ${packageSlug}: ${imageUrl}`);
      
      const processedImage = await downloadAndProcessImage(imageUrl, packageSlug);
      
      if (!processedImage) {
        return res.status(400).json({ error: "Failed to process image" });
      }
      
      res.json({
        success: true,
        image: processedImage
      });
      
    } catch (error: any) {
      console.error("Image processing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Batch import packages from URLs (scrape + import)
  app.post("/api/admin/batch-import", verifyAdminSession, async (req, res) => {
    try {
      const { urls } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "urls array is required" });
      }
      
      const cheerio = await import("cheerio");
      const fetch = (await import("node-fetch")).default;
      
      const results: { imported: string[]; skipped: string[]; failed: string[] } = {
        imported: [],
        skipped: [],
        failed: []
      };
      
      console.log(`Starting batch import of ${urls.length} packages...`);
      
      // Helper function to convert HTML to text while preserving paragraphs
      const htmlToText = ($: any, element: any): string => {
        let html = $(element).html() || '';
        html = html.replace(/<\/p>/gi, '\n\n');
        html = html.replace(/<p[^>]*>/gi, '');
        html = html.replace(/<br\s*\/?>/gi, '\n');
        html = html.replace(/<\/div>/gi, '\n');
        html = html.replace(/<div[^>]*>/gi, '');
        html = html.replace(/<[^>]+>/g, '');
        // Decode HTML entities
        html = html.replace(/&nbsp;/gi, ' ');
        html = html.replace(/&amp;/gi, '&');
        html = html.replace(/&lt;/gi, '<');
        html = html.replace(/&gt;/gi, '>');
        html = html.replace(/&quot;/gi, '"');
        html = html.replace(/&#39;/gi, "'");
        html = html.replace(/&rsquo;/gi, "'");
        html = html.replace(/&lsquo;/gi, "'");
        html = html.replace(/&rdquo;/gi, '"');
        html = html.replace(/&ldquo;/gi, '"');
        html = html.replace(/&ndash;/gi, '–');
        html = html.replace(/&mdash;/gi, '—');
        html = html.replace(/&hellip;/gi, '...');
        html = html.replace(/\n\s*\n\s*\n/g, '\n\n');
        html = html.replace(/[ \t]+/g, ' ');
        return html.trim();
      };
      
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        
        try {
          // Extract slug from URL
          const slug = url.split('/').pop()?.toLowerCase().replace(/%[0-9a-f]{2}/gi, '-') || '';
          
          // Check if package already exists
          const existing = await storage.getFlightPackageBySlug(slug);
          if (existing) {
            results.skipped.push(`${slug} (already exists)`);
            console.log(`[${i+1}/${urls.length}] Skipped: ${slug} (exists)`);
            continue;
          }
          
          // Fetch the page
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            results.failed.push(`${slug} (HTTP ${response.status})`);
            console.log(`[${i+1}/${urls.length}] Failed: ${slug} (HTTP ${response.status})`);
            continue;
          }
          
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // Extract data
          let title = $('title').text().split('|')[0]?.trim() || '';
          if (!title || title.length < 5) {
            title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          }
          
          const category = url.match(/\/Holidays\/([^\/]+)/)?.[1]?.replace(/-/g, ' ') || 'Europe';
          
          // Get price
          const priceText = $('[class*="price"]').first().text().trim() || 
                           $('*:contains("£")').filter((_, el) => !!$(el).text().match(/£\d+/)).first().text().trim();
          const priceMatch = priceText.match(/[£$€]?\s*([\d,]+)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 999;
          
          // Get overview
          let overview = '';
          const overviewSection = $('h3:contains("Overview")').parent();
          if (overviewSection.length) {
            overview = htmlToText($, overviewSection.find('p').parent());
          }
          if (!overview) {
            const overviewDiv = $('#overview, [id*="overview"]');
            if (overviewDiv.length) {
              overview = htmlToText($, overviewDiv).substring(0, 2000);
            }
          }
          
          // Get what's included
          const whatsIncluded: string[] = [];
          const includedSection = $('h3:contains("Included"), h3:contains("included")').parent();
          if (includedSection.length) {
            includedSection.find('li').each((_, el) => {
              const text = $(el).text().trim();
              if (text) whatsIncluded.push(text);
            });
          }
          
          // Get highlights
          const highlights: string[] = [];
          const highlightsSection = $('h3:contains("Highlight"), h3:contains("highlight")').parent();
          if (highlightsSection.length) {
            highlightsSection.find('li').each((_, el) => {
              const text = $(el).text().trim();
              if (text) highlights.push(text);
            });
          }
          
          // Get itinerary
          const itinerary: { day: number; title: string; description: string }[] = [];
          const itinerarySection = $('#itinerary, .itinerary-section');
          if (itinerarySection.length) {
            itinerarySection.find('.accordion-panel').each((_, panel) => {
              const dayText = $(panel).find('.day').first().text().trim();
              const dayMatch = dayText.match(/Day\s*(\d+)/i);
              
              if (dayMatch) {
                const dayNum = parseInt(dayMatch[1]);
                const dayTitle = $(panel).find('.description').first().text().trim() || `Day ${dayNum}`;
                const descElement = $(panel).find('.panel-content .desc');
                const desc = htmlToText($, descElement).substring(0, 2000);
                
                if (!itinerary.find(i => i.day === dayNum)) {
                  itinerary.push({
                    day: dayNum,
                    title: dayTitle.substring(0, 150),
                    description: desc
                  });
                }
              }
            });
          }
          
          // Get images
          const hotelImages: string[] = [];
          $('img').each((_, el) => {
            const src = $(el).attr('src');
            if (src && (src.includes('Hotel') || src.includes('hotel') || src.includes('accommodation') || 
                src.includes('PackageImages') || src.includes('.webp') || src.includes('.jpg'))) {
              if (!hotelImages.includes(src)) {
                hotelImages.push(src);
              }
            }
          });
          
          // Get featured image
          const featuredImage = $('meta[property="og:image"]').attr('content') || 
                               $('img[class*="hero"], img[class*="featured"]').first().attr('src') ||
                               hotelImages[0] || '';
          
          // Get accommodations
          const accommodations: { name: string; description: string; images: string[] }[] = [];
          const accommodationSection = $('#accommodation, .accommodation-section');
          if (accommodationSection.length) {
            accommodationSection.find('.accordion-panel').each((_, panel) => {
              const hotelName = $(panel).find('.hotel-name, .description').first().text().trim();
              if (hotelName && !hotelName.match(/Day\s*\d+/i)) {
                const hotelDesc = htmlToText($, $(panel).find('.panel-content .desc')).substring(0, 800);
                const images: string[] = [];
                $(panel).find('img').each((_, img) => {
                  const src = $(img).attr('src');
                  if (src && !images.includes(src)) {
                    images.push(src);
                  }
                });
                accommodations.push({
                  name: hotelName,
                  description: hotelDesc,
                  images: images.slice(0, 5)
                });
              }
            });
          }
          
          // Create the package
          const description = overview || `Discover the beauty of ${category} with this amazing package.`;
          const packageData = {
            title,
            slug,
            category,
            countries: [] as string[],
            destination: category,
            duration: `${itinerary.length || 7} Days`,
            price,
            originalPrice: Math.round(price * 1.15),
            currency: 'GBP' as const,
            featuredImage,
            galleryImages: hotelImages.slice(0, 10),
            description,
            overview: description,
            highlights: highlights.length > 0 ? highlights : ['Expert local guides', 'Comfortable accommodations', 'Unforgettable experiences'],
            whatsIncluded: whatsIncluded.length > 0 ? whatsIncluded : ['Accommodation', 'Breakfast', 'Transfers'],
            itinerary,
            accommodations,
            departureInfo: 'Departures available year-round',
            isPublished: true,
            displayOrder: i,
            pricingDisplay: 'both' as const,
            pricingModule: 'manual' as const
          };
          
          await storage.createFlightPackage(packageData);
          results.imported.push(title);
          console.log(`[${i+1}/${urls.length}] Imported: ${title}`);
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (err: any) {
          results.failed.push(`${url.split('/').pop() || url}: ${err.message}`);
          console.log(`[${i+1}/${urls.length}] Error: ${err.message}`);
        }
      }
      
      console.log(`Batch import complete: ${results.imported.length} imported, ${results.skipped.length} skipped, ${results.failed.length} failed`);
      
      res.json({
        success: true,
        total: urls.length,
        imported: results.imported.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
        details: results
      });
      
    } catch (error: any) {
      console.error("Batch import error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Match sitemap URLs to existing packages and update sourceUrl field
  app.post("/api/admin/flight-packages/match-urls", verifyAdminSession, async (req, res) => {
    try {
      const { urls } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "urls array is required" });
      }
      
      // Get all packages
      const allPackages = await storage.getAllFlightPackages();
      
      const results: { matched: string[]; unmatched: string[] } = {
        matched: [],
        unmatched: []
      };
      
      // Helper to normalize URL slug for matching
      const normalizeSlug = (urlPart: string): string => {
        return decodeURIComponent(urlPart)
          .toLowerCase()
          .replace(/['']/g, '') // Remove smart quotes
          .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
          .replace(/^-+|-+$/g, '') // Trim hyphens
          .substring(0, 200);
      };
      
      for (const url of urls) {
        // Extract slug from URL
        const urlSlug = url.split('/').pop() || '';
        const normalizedUrlSlug = normalizeSlug(urlSlug);
        
        // Find matching package by comparing normalized slugs
        const matchingPackage = allPackages.find(pkg => {
          const pkgNormalizedSlug = normalizeSlug(pkg.slug);
          // Exact match or URL slug contains package slug or vice versa
          return pkgNormalizedSlug === normalizedUrlSlug ||
                 normalizedUrlSlug.includes(pkgNormalizedSlug) ||
                 pkgNormalizedSlug.includes(normalizedUrlSlug);
        });
        
        if (matchingPackage) {
          // Update package with source URL (remove www. prefix for fetching)
          const cleanUrl = url.replace('www.holidays', 'holidays');
          await storage.updateFlightPackage(matchingPackage.id, { sourceUrl: cleanUrl });
          results.matched.push(`${matchingPackage.slug} -> ${cleanUrl}`);
        } else {
          results.unmatched.push(urlSlug);
        }
      }
      
      console.log(`URL matching complete: ${results.matched.length} matched, ${results.unmatched.length} unmatched`);
      
      res.json({
        success: true,
        total: urls.length,
        matched: results.matched.length,
        unmatched: results.unmatched.length,
        details: results
      });
      
    } catch (error: any) {
      console.error("URL matching error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk rescrape accommodations for all packages with sourceUrl
  app.post("/api/admin/flight-packages/rescrape-accommodations", verifyAdminSession, async (req, res) => {
    try {
      const { limit = 500, delayMs = 500 } = req.body;
      
      // Import cheerio and node-fetch
      const cheerio = await import("cheerio");
      const fetch = (await import("node-fetch")).default;
      
      // Get all packages with sourceUrl but no/empty accommodations
      const allPackages = await storage.getAllFlightPackages();
      const packagesToUpdate = allPackages.filter(pkg => 
        pkg.sourceUrl && 
        (!pkg.accommodations || pkg.accommodations.length === 0)
      ).slice(0, limit);
      
      console.log(`Starting rescrape for ${packagesToUpdate.length} packages...`);
      
      const results: { 
        updated: string[]; 
        noAccommodations: string[]; 
        failed: string[] 
      } = {
        updated: [],
        noAccommodations: [],
        failed: []
      };
      
      // Helper function to convert HTML to text
      const htmlToText = ($: any, element: any): string => {
        let html = $(element).html() || '';
        html = html.replace(/<\/p>/gi, '\n\n');
        html = html.replace(/<p[^>]*>/gi, '');
        html = html.replace(/<br\s*\/?>/gi, '\n');
        html = html.replace(/<\/div>/gi, '\n');
        html = html.replace(/<div[^>]*>/gi, '');
        html = html.replace(/<[^>]+>/g, '');
        html = html.replace(/&nbsp;/gi, ' ');
        html = html.replace(/&amp;/gi, '&');
        html = html.replace(/&lt;/gi, '<');
        html = html.replace(/&gt;/gi, '>');
        html = html.replace(/&quot;/gi, '"');
        html = html.replace(/&#39;/gi, "'");
        html = html.replace(/&rsquo;/gi, "'");
        html = html.replace(/&lsquo;/gi, "'");
        html = html.replace(/&rdquo;/gi, '"');
        html = html.replace(/&ldquo;/gi, '"');
        html = html.replace(/&ndash;/gi, '–');
        html = html.replace(/&mdash;/gi, '—');
        html = html.replace(/&hellip;/gi, '...');
        html = html.replace(/\n\s*\n\s*\n/g, '\n\n');
        html = html.replace(/[ \t]+/g, ' ');
        return html.trim();
      };
      
      for (let i = 0; i < packagesToUpdate.length; i++) {
        const pkg = packagesToUpdate[i];
        
        try {
          console.log(`[${i+1}/${packagesToUpdate.length}] Scraping: ${pkg.title}`);
          
          const response = await fetch(pkg.sourceUrl!, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            results.failed.push(`${pkg.slug} (HTTP ${response.status})`);
            continue;
          }
          
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // Extract accommodations using improved scraper logic
          const accommodations: { name: string; description: string; images: string[] }[] = [];
          
          const accommodationSelectors = [
            '#accommodation',
            '.accommodation-section',
            '[id*="accommodation"]',
            'section:has(h3:contains("Accommodation"))'
          ];
          
          let accommodationSection = $();
          for (const selector of accommodationSelectors) {
            const found = $(selector);
            if (found.length) {
              accommodationSection = found.first();
              break;
            }
          }
          
          if (accommodationSection.length) {
            // Try panel-based structure first
            const panels = accommodationSection.find('.accordion-panel');
            
            if (panels.length) {
              panels.each((_, panel) => {
                const hotelName = $(panel).find('.label').first().text().trim() ||
                                 $(panel).find('.title').first().text().trim() ||
                                 $(panel).find('.hotel-name').first().text().trim();
                
                if (hotelName && hotelName.length > 2 && !hotelName.match(/^Day\s*\d+$/i)) {
                  // Get description
                  let hotelDesc = '';
                  const descSelectors = ['.panel-content p.MsoNormal', '.panel-content .desc', '.desc', 'p'];
                  for (const sel of descSelectors) {
                    const descEl = $(panel).find(sel);
                    if (descEl.length) {
                      hotelDesc = htmlToText($, descEl);
                      if (hotelDesc.length > 20) break;
                    }
                  }
                  
                  // Get images from carousel anchors
                  const hotelImages: string[] = [];
                  $(panel).find('.accommodation-carousel a.img-url, a[href*="HotelImages"], a[href*="PackageImages"]').each((_, a) => {
                    const href = $(a).attr('href');
                    if (href && !hotelImages.includes(href)) {
                      hotelImages.push(href);
                    }
                  });
                  
                  // Fallback to img src
                  if (hotelImages.length === 0) {
                    $(panel).find('.accommodation-carousel img, .panel-content img').each((_, img) => {
                      const src = $(img).attr('src');
                      if (src && !hotelImages.includes(src)) {
                        hotelImages.push(src);
                      }
                    });
                  }
                  
                  accommodations.push({
                    name: hotelName.substring(0, 150),
                    description: hotelDesc.trim().substring(0, 800),
                    images: hotelImages.slice(0, 10)
                  });
                }
              });
            } else {
              // Flat structure
              let hotelName = accommodationSection.find('.title').first().text().trim() ||
                             accommodationSection.find('.label').first().text().trim();
              
              if (hotelName && hotelName.length > 2 && !hotelName.match(/^Accommodation/i)) {
                let hotelDesc = '';
                accommodationSection.find('p.MsoNormal, p').each((_, p) => {
                  const text = $(p).text().trim();
                  if (text.length > 20 && !hotelDesc) {
                    hotelDesc = text;
                  }
                });
                
                const hotelImages: string[] = [];
                accommodationSection.find('a[href*="HotelImages"], a[href*="PackageImages"], img').each((_, el) => {
                  const src = $(el).attr('href') || $(el).attr('src');
                  if (src && !hotelImages.includes(src)) {
                    hotelImages.push(src);
                  }
                });
                
                accommodations.push({
                  name: hotelName.substring(0, 150),
                  description: hotelDesc.substring(0, 800),
                  images: hotelImages.slice(0, 10)
                });
              }
            }
          }
          
          if (accommodations.length > 0) {
            await storage.updateFlightPackage(pkg.id, { accommodations });
            results.updated.push(`${pkg.slug} (${accommodations.length} hotels)`);
            console.log(`  -> Found ${accommodations.length} accommodation(s)`);
          } else {
            results.noAccommodations.push(pkg.slug);
            console.log(`  -> No accommodations found`);
          }
          
          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
        } catch (err: any) {
          results.failed.push(`${pkg.slug}: ${err.message}`);
          console.log(`  -> Error: ${err.message}`);
        }
      }
      
      console.log(`Rescrape complete: ${results.updated.length} updated, ${results.noAccommodations.length} no data, ${results.failed.length} failed`);
      
      res.json({
        success: true,
        total: packagesToUpdate.length,
        updated: results.updated.length,
        noAccommodations: results.noAccommodations.length,
        failed: results.failed.length,
        details: results
      });
      
    } catch (error: any) {
      console.error("Rescrape error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk rescrape IMAGES ONLY for all packages with sourceUrl (preserves pricing)
  app.post("/api/admin/flight-packages/rescrape-images", verifyAdminSession, async (req, res) => {
    try {
      const { limit = 500, delayMs = 500, onlyMissing = false } = req.body;
      
      const cheerio = await import("cheerio");
      const fetch = (await import("node-fetch")).default;
      
      const allPackages = await storage.getAllFlightPackages();
      
      // Filter packages: must have sourceUrl, optionally only those with missing/few images
      let packagesToUpdate = allPackages.filter(pkg => pkg.sourceUrl);
      
      if (onlyMissing) {
        packagesToUpdate = packagesToUpdate.filter(pkg => 
          !pkg.featuredImage || 
          !pkg.gallery || 
          (Array.isArray(pkg.gallery) && pkg.gallery.length < 3)
        );
      }
      
      packagesToUpdate = packagesToUpdate.slice(0, limit);
      
      console.log(`Starting IMAGE rescrape for ${packagesToUpdate.length} packages...`);
      
      const results: { 
        updated: string[]; 
        noImages: string[]; 
        failed: string[] 
      } = {
        updated: [],
        noImages: [],
        failed: []
      };
      
      for (const pkg of packagesToUpdate) {
        try {
          console.log(`Scraping images for: ${pkg.slug}`);
          
          const response = await fetch(pkg.sourceUrl!, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            results.failed.push(`${pkg.slug}: HTTP ${response.status}`);
            continue;
          }
          
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // Extract hero image
          let heroImage = '';
          const heroSelectors = [
            '.hero-image img',
            '.package-hero img',
            '.main-image img',
            '.featured-image img',
            'header img',
            '.banner img',
            '.slider img:first',
            '.carousel img:first'
          ];
          
          for (const selector of heroSelectors) {
            const img = $(selector).first();
            if (img.length) {
              heroImage = img.attr('src') || img.attr('data-src') || '';
              if (heroImage) break;
            }
          }
          
          // Extract gallery images
          const galleryImages: string[] = [];
          
          // Look for high-quality image links first
          $('a[href*="PackageImages"], a[href*="HotelImages"], a.img-url').each((_, a) => {
            const href = $(a).attr('href');
            if (href && !galleryImages.includes(href)) {
              galleryImages.push(href);
            }
          });
          
          // Then fallback to img tags
          if (galleryImages.length < 5) {
            $('img').each((_, img) => {
              const src = $(img).attr('src') || $(img).attr('data-src') || '';
              if (src && 
                  !galleryImages.includes(src) &&
                  (src.includes('PackageImages') || 
                   src.includes('HotelImages') || 
                   src.includes('.jpg') || 
                   src.includes('.webp')) &&
                  !src.includes('logo') &&
                  !src.includes('icon')) {
                galleryImages.push(src);
              }
            });
          }
          
          // Update accommodation images too
          const accommodations = pkg.accommodations || [];
          let accommodationsUpdated = false;
          
          // Extract accommodation images from page
          $('.accommodation-panel, .hotel-section, .accommodation-item').each((i, panel) => {
            if (i < accommodations.length) {
              const accImages: string[] = [];
              
              $(panel).find('a[href*="HotelImages"], a[href*="PackageImages"], a.img-url').each((_, a) => {
                const href = $(a).attr('href');
                if (href && !accImages.includes(href)) {
                  accImages.push(href);
                }
              });
              
              if (accImages.length === 0) {
                $(panel).find('img').each((_, img) => {
                  const src = $(img).attr('src');
                  if (src && !accImages.includes(src)) {
                    accImages.push(src);
                  }
                });
              }
              
              if (accImages.length > 0) {
                accommodations[i] = {
                  ...accommodations[i],
                  images: accImages.slice(0, 10)
                };
                accommodationsUpdated = true;
              }
            }
          });
          
          // Use first gallery image as hero if no hero found
          if (!heroImage && galleryImages.length > 0) {
            heroImage = galleryImages[0];
          }
          
          if (heroImage || galleryImages.length > 0) {
            const updateData: any = {};
            
            if (heroImage) {
              updateData.featuredImage = heroImage;
            }
            if (galleryImages.length > 0) {
              updateData.gallery = galleryImages.slice(0, 15);
            }
            if (accommodationsUpdated) {
              updateData.accommodations = accommodations;
            }
            
            await storage.updateFlightPackage(pkg.id, updateData);
            results.updated.push(`${pkg.slug} (featured: ${heroImage ? 'yes' : 'no'}, gallery: ${galleryImages.length})`);
            console.log(`  -> Updated: hero=${!!heroImage}, gallery=${galleryImages.length}`);
          } else {
            results.noImages.push(pkg.slug);
            console.log(`  -> No images found`);
          }
          
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
        } catch (err: any) {
          results.failed.push(`${pkg.slug}: ${err.message}`);
          console.log(`  -> Error: ${err.message}`);
        }
      }
      
      console.log(`Image rescrape complete: ${results.updated.length} updated, ${results.noImages.length} no images, ${results.failed.length} failed`);
      
      res.json({
        success: true,
        total: packagesToUpdate.length,
        updated: results.updated.length,
        noImages: results.noImages.length,
        failed: results.failed.length,
        details: results
      });
      
    } catch (error: any) {
      console.error("Image rescrape error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // Flight Tour Pricing Configs (Dynamic Flight + Bokun Tour Pricing)
  // ========================================
  
  // Get all flight tour pricing configs (admin)
  app.get("/api/admin/flight-pricing-configs", verifyAdminSession, async (req, res) => {
    try {
      const configs = await storage.getAllFlightTourPricingConfigs();
      res.json(configs);
    } catch (error: any) {
      console.error("Error fetching flight pricing configs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch configs" });
    }
  });
  
  // Get flight pricing config for a specific Bokun product
  app.get("/api/admin/flight-pricing-configs/bokun/:bokunProductId", verifyAdminSession, async (req, res) => {
    try {
      const config = await storage.getFlightTourPricingConfigByBokunId(req.params.bokunProductId);
      if (!config) {
        return res.status(404).json({ error: "Config not found" });
      }
      res.json(config);
    } catch (error: any) {
      console.error("Error fetching flight pricing config:", error);
      res.status(500).json({ error: error.message || "Failed to fetch config" });
    }
  });
  
  // Create flight pricing config
  app.post("/api/admin/flight-pricing-configs", verifyAdminSession, async (req, res) => {
    try {
      const validated = insertFlightTourPricingConfigSchema.parse(req.body);
      const config = await storage.createFlightTourPricingConfig(validated);
      res.status(201).json(config);
    } catch (error: any) {
      console.error("Error creating flight pricing config:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: error.message || "Failed to create config" });
      }
    }
  });
  
  // Update flight pricing config
  app.patch("/api/admin/flight-pricing-configs/:id", verifyAdminSession, async (req, res) => {
    try {
      const validated = updateFlightTourPricingConfigSchema.parse(req.body);
      const config = await storage.updateFlightTourPricingConfig(parseInt(req.params.id), validated);
      if (!config) {
        return res.status(404).json({ error: "Config not found" });
      }
      res.json(config);
    } catch (error: any) {
      console.error("Error updating flight pricing config:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: error.message || "Failed to update config" });
      }
    }
  });
  
  // Delete flight pricing config
  app.delete("/api/admin/flight-pricing-configs/:id", verifyAdminSession, async (req, res) => {
    try {
      await storage.deleteFlightTourPricingConfig(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting flight pricing config:", error);
      res.status(500).json({ error: error.message || "Failed to delete config" });
    }
  });
  
  // Get UK airports list (for dropdown)
  app.get("/api/flight-pricing/airports", async (req, res) => {
    res.json(UK_AIRPORTS);
  });
  
  // Test flight API search (admin debugging)
  app.get("/api/admin/flight-pricing-configs/test-search", verifyAdminSession, async (req, res) => {
    try {
      const { depart, arrive, nights, startDate, endDate } = req.query;
      
      if (!depart || !arrive || !nights || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required parameters: depart, arrive, nights, startDate, endDate" });
      }
      
      const offers = await searchFlights({
        departAirports: depart as string,
        arriveAirport: arrive as string,
        nights: parseInt(nights as string),
        startDate: startDate as string, // DD/MM/YYYY
        endDate: endDate as string, // DD/MM/YYYY
      });
      
      res.json({
        count: offers.length,
        offers: offers.slice(0, 20), // Return first 20 for preview
      });
    } catch (error: any) {
      console.error("Error testing flight search:", error);
      res.status(500).json({ error: error.message || "Flight search failed" });
    }
  });
  
  // ========================================
  // Public: Combined Flight + Tour Pricing
  // ========================================
  
  // Get combined pricing for a Bokun tour (public API for tour detail page)
  app.get("/api/tours/:bokunProductId/flight-pricing", async (req, res) => {
    try {
      const { bokunProductId } = req.params;
      
      // Get the pricing config for this tour
      const config = await storage.getFlightTourPricingConfigByBokunId(bokunProductId);
      if (!config || !config.isEnabled) {
        return res.json({ enabled: false, message: "Flight pricing not configured for this tour" });
      }
      
      // Get the land tour price from Bokun (need to fetch product details)
      const productDetails = await getBokunProductDetails(bokunProductId);
      if (!productDetails || !productDetails.nextDefaultPrice) {
        return res.status(404).json({ error: "Tour not found or no pricing available" });
      }
      
      // Apply Bokun markup (10%) to get our land tour price
      const landTourPricePerPerson = productDetails.nextDefaultPrice * 1.10;
      
      // Calculate combined prices for all available dates
      const prices = await calculateCombinedPrices(config, landTourPricePerPerson);
      
      res.json({
        enabled: true,
        config: {
          arriveAirportCode: config.arriveAirportCode,
          departAirports: config.departAirports.split("|"),
          durationNights: config.durationNights,
          markupPercent: config.markupPercent,
          searchStartDate: config.searchStartDate,
          searchEndDate: config.searchEndDate,
        },
        landTourPricePerPerson,
        availableDates: prices.length,
        prices,
      });
    } catch (error: any) {
      console.error("Error fetching combined pricing:", error);
      res.status(500).json({ error: error.message || "Failed to fetch pricing" });
    }
  });
  
  // Get all flight options for a specific date (for modal showing multiple departure airports)
  app.get("/api/tours/:bokunProductId/flight-pricing/:date", async (req, res) => {
    try {
      const { bokunProductId, date } = req.params; // date in DD-MM-YYYY format (url-safe)
      
      // Convert URL-safe date back to API format
      const targetDate = date.replace(/-/g, "/"); // Convert DD-MM-YYYY to DD/MM/YYYY
      
      // Get the pricing config for this tour
      const config = await storage.getFlightTourPricingConfigByBokunId(bokunProductId);
      if (!config || !config.isEnabled) {
        return res.json({ enabled: false, message: "Flight pricing not configured" });
      }
      
      // Get the land tour price from Bokun
      const productDetails = await getBokunProductDetails(bokunProductId);
      if (!productDetails || !productDetails.nextDefaultPrice) {
        return res.status(404).json({ error: "Tour not found or no pricing available" });
      }
      
      const landTourPricePerPerson = productDetails.nextDefaultPrice * 1.10;
      
      // Get all flight options for this date
      const options = await getFlightsForDateWithPrices(config, landTourPricePerPerson, targetDate);
      
      res.json({
        date: targetDate,
        options,
      });
    } catch (error: any) {
      console.error("Error fetching flight options:", error);
      res.status(500).json({ error: error.message || "Failed to fetch flight options" });
    }
  });

  // ========================================
  // IMAGE MIGRATION ROUTES (Admin only)
  // ========================================
  
  // Migrate all flight package images to object storage
  app.post("/api/admin/migrate-images", verifyAdminSession, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const packages = await storage.getAllFlightPackages();
      
      const results = {
        total: packages.length,
        migrated: 0,
        skipped: 0,
        failed: 0,
        details: [] as { packageId: number; title: string; status: string; error?: string }[]
      };
      
      for (const pkg of packages) {
        try {
          let updated = false;
          const updates: any = {};
          
          // Helper to check if URL is external (http/https)
          const isExternalUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');
          
          // Migrate featured image (only external URLs)
          if (pkg.featuredImage && isExternalUrl(pkg.featuredImage)) {
            try {
              const newPath = await objectStorageService.uploadFromUrl(
                pkg.featuredImage,
                `featured-${pkg.slug}.jpg`
              );
              updates.featuredImage = newPath;
              updated = true;
              console.log(`Migrated featured image for ${pkg.title}`);
            } catch (e: any) {
              console.error(`Failed to migrate featured image for ${pkg.title}:`, e.message);
            }
          }
          
          // Migrate gallery images (only external URLs)
          if (pkg.gallery && Array.isArray(pkg.gallery) && pkg.gallery.length > 0) {
            const newGallery: string[] = [];
            let galleryUpdated = false;
            for (let i = 0; i < pkg.gallery.length; i++) {
              const img = pkg.gallery[i];
              if (img && isExternalUrl(img)) {
                try {
                  const newPath = await objectStorageService.uploadFromUrl(
                    img,
                    `gallery-${pkg.slug}-${i}.jpg`
                  );
                  newGallery.push(newPath);
                  galleryUpdated = true;
                } catch (e: any) {
                  console.error(`Failed to migrate gallery image ${i} for ${pkg.title}:`, e.message);
                  newGallery.push(img); // Keep original if failed
                }
              } else {
                newGallery.push(img);
              }
            }
            if (galleryUpdated) {
              updates.gallery = newGallery;
              updated = true;
            }
          }
          
          // Migrate accommodation images (only external URLs)
          if (pkg.accommodations && Array.isArray(pkg.accommodations) && pkg.accommodations.length > 0) {
            const newAccommodations = [];
            let accUpdated = false;
            for (const acc of pkg.accommodations) {
              if (acc.images && Array.isArray(acc.images)) {
                const newImages: string[] = [];
                for (let i = 0; i < acc.images.length; i++) {
                  const img = acc.images[i];
                  if (img && isExternalUrl(img)) {
                    try {
                      const newPath = await objectStorageService.uploadFromUrl(
                        img,
                        `acc-${pkg.slug}-${acc.name.replace(/\s+/g, '-').toLowerCase()}-${i}.jpg`
                      );
                      newImages.push(newPath);
                      accUpdated = true;
                    } catch (e: any) {
                      newImages.push(img); // Keep original if failed
                    }
                  } else {
                    newImages.push(img);
                  }
                }
                newAccommodations.push({ ...acc, images: newImages });
              } else {
                newAccommodations.push(acc);
              }
            }
            if (accUpdated) {
              updates.accommodations = newAccommodations;
              updated = true;
            }
          }
          
          // Apply updates if any
          if (updated && Object.keys(updates).length > 0) {
            await storage.updateFlightPackage(pkg.id, updates);
            results.migrated++;
            results.details.push({ packageId: pkg.id, title: pkg.title, status: 'migrated' });
          } else {
            results.skipped++;
            results.details.push({ packageId: pkg.id, title: pkg.title, status: 'skipped (no external images)' });
          }
        } catch (error: any) {
          results.failed++;
          results.details.push({ 
            packageId: pkg.id, 
            title: pkg.title, 
            status: 'failed', 
            error: error.message 
          });
        }
      }
      
      res.json(results);
    } catch (error: any) {
      console.error("Migration error:", error);
      res.status(500).json({ error: error.message || "Migration failed" });
    }
  });
  
  // Get migration status - check which images are still external
  app.get("/api/admin/migration-status", verifyAdminSession, async (req, res) => {
    try {
      const packages = await storage.getAllFlightPackages();
      
      // Helper to check if URL is external (http/https)
      const isExternalUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');
      const isMigrated = (url: string) => url.startsWith('/objects/');
      
      const status = {
        total: packages.length,
        fullyMigrated: 0,
        partiallyMigrated: 0,
        notMigrated: 0,
        packages: [] as { id: number; title: string; externalImages: number; migratedImages: number; localImages: number }[]
      };
      
      for (const pkg of packages) {
        let externalCount = 0;
        let migratedCount = 0;
        let localCount = 0;
        
        // Check featured image
        if (pkg.featuredImage) {
          if (isMigrated(pkg.featuredImage)) {
            migratedCount++;
          } else if (isExternalUrl(pkg.featuredImage)) {
            externalCount++;
          } else {
            localCount++; // Already local but not in object storage
          }
        }
        
        // Check gallery
        if (pkg.gallery && Array.isArray(pkg.gallery)) {
          for (const img of pkg.gallery) {
            if (isMigrated(img)) {
              migratedCount++;
            } else if (isExternalUrl(img)) {
              externalCount++;
            } else {
              localCount++;
            }
          }
        }
        
        // Check accommodations
        if (pkg.accommodations && Array.isArray(pkg.accommodations)) {
          for (const acc of pkg.accommodations) {
            if (acc.images && Array.isArray(acc.images)) {
              for (const img of acc.images) {
                if (isMigrated(img)) {
                  migratedCount++;
                } else if (isExternalUrl(img)) {
                  externalCount++;
                } else {
                  localCount++;
                }
              }
            }
          }
        }
        
        status.packages.push({
          id: pkg.id,
          title: pkg.title,
          externalImages: externalCount,
          migratedImages: migratedCount,
          localImages: localCount
        });
        
        // Only external images need migration
        if (externalCount === 0 && (migratedCount > 0 || localCount > 0)) {
          status.fullyMigrated++;
        } else if (externalCount > 0 && migratedCount > 0) {
          status.partiallyMigrated++;
        } else if (externalCount > 0) {
          status.notMigrated++;
        }
      }
      
      res.json(status);
    } catch (error: any) {
      console.error("Migration status error:", error);
      res.status(500).json({ error: error.message || "Failed to get migration status" });
    }
  });

  // ============================================
  // PUBLIC MEDIA SERVING ROUTES
  // ============================================

  // Serve media file by slug and variant
  app.get("/api/media/:slug/:variant", async (req, res) => {
    try {
      const { slug, variant } = req.params;
      
      // Validate variant type
      const validVariants = ['hero', 'gallery', 'card', 'thumb'];
      if (!validVariants.includes(variant)) {
        return res.status(400).json({ error: "Invalid variant type" });
      }
      
      // Get variant info to check storage type
      const variantInfo = await mediaService.getVariantInfo(slug, variant);
      
      if (!variantInfo) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      // Set headers
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      if (variantInfo.storageType === 'object_storage') {
        // Redirect to Object Storage URL for efficiency
        // Object paths are like: /objects/media/filename.webp
        const objectUrl = variantInfo.filepath;
        return res.redirect(objectUrl);
      } else {
        // Serve from local filesystem
        if (!fs.existsSync(variantInfo.filepath)) {
          return res.status(404).json({ error: "Image file not found" });
        }
        const stream = fs.createReadStream(variantInfo.filepath);
        stream.pipe(res);
      }
    } catch (error: any) {
      console.error("Error serving media:", error);
      res.status(500).json({ error: error.message || "Failed to serve media" });
    }
  });

  // ============================================
  // MEDIA LIBRARY API ROUTES
  // ============================================

  // Get all media assets with metadata (destinations, usage)
  app.get("/api/admin/media/assets", verifyAdminSession, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const source = req.query.source as string | undefined;
      const destination = req.query.destination as string | undefined;
      
      const assets = await mediaService.getAssetsWithMeta({ limit, offset, source, destination });
      res.json(assets);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ error: error.message || "Failed to fetch assets" });
    }
  });

  // Add destination tag to an asset
  app.post("/api/admin/media/assets/:id/destinations", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { destination } = req.body;
      
      if (!destination) {
        return res.status(400).json({ error: "Destination is required" });
      }
      
      await mediaService.addDestinationTag(id, destination);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error adding destination tag:", error);
      res.status(500).json({ error: error.message || "Failed to add destination tag" });
    }
  });

  // Remove destination tag from an asset
  app.delete("/api/admin/media/assets/:id/destinations/:destination", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const destination = req.params.destination;
      
      await mediaService.removeDestinationTag(id, destination);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing destination tag:", error);
      res.status(500).json({ error: error.message || "Failed to remove destination tag" });
    }
  });

  // Get single asset with variants
  app.get("/api/admin/media/assets/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await mediaService.getAssetById(id);
      
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      const variants = await mediaService.getAssetVariants(id);
      const usage = await mediaService.getAssetUsage(id);
      
      res.json({ asset, variants, usage });
    } catch (error: any) {
      console.error("Error fetching asset:", error);
      res.status(500).json({ error: error.message || "Failed to fetch asset" });
    }
  });

  // Upload image
  app.post("/api/admin/media/upload", verifyAdminSession, memoryUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      
      const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
      
      const result = await mediaService.processImage(
        req.file.buffer,
        req.file.originalname,
        { tags }
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

  // Search assets
  app.get("/api/admin/media/search", verifyAdminSession, async (req, res) => {
    try {
      const assets = await mediaService.searchAssets({
        tagType: req.query.tagType as string | undefined,
        tagValue: req.query.tagValue as string | undefined,
        source: req.query.source as string | undefined,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      
      res.json(assets);
    } catch (error: any) {
      console.error("Error searching assets:", error);
      res.status(500).json({ error: error.message || "Failed to search assets" });
    }
  });

  // Get unused assets
  app.get("/api/admin/media/unused", verifyAdminSession, async (req, res) => {
    try {
      const assets = await mediaService.getUnusedAssets(
        req.query.tagType as string | undefined,
        req.query.tagValue as string | undefined,
        parseInt(req.query.limit as string) || 20
      );
      
      res.json(assets);
    } catch (error: any) {
      console.error("Error fetching unused assets:", error);
      res.status(500).json({ error: error.message || "Failed to fetch unused assets" });
    }
  });

  // Assign asset to entity
  app.post("/api/admin/media/assign", verifyAdminSession, async (req, res) => {
    try {
      const { assetId, entityType, entityId, variantType, isPrimary } = req.body;
      const adminUser = (req as any).adminUser;
      
      await mediaService.assignAssetToEntity(
        assetId,
        entityType,
        entityId,
        variantType,
        isPrimary,
        adminUser.email
      );
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error assigning asset:", error);
      res.status(500).json({ error: error.message || "Failed to assign asset" });
    }
  });

  // Soft delete asset
  app.delete("/api/admin/media/assets/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await mediaService.softDeleteAsset(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ error: error.message || "Failed to delete asset" });
    }
  });

  // Get cleanup jobs
  app.get("/api/admin/media/cleanup-jobs", verifyAdminSession, async (req, res) => {
    try {
      const jobs = await mediaService.getCleanupJobs();
      res.json(jobs);
    } catch (error: any) {
      console.error("Error fetching cleanup jobs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch cleanup jobs" });
    }
  });

  // Create cleanup job and preview
  app.post("/api/admin/media/cleanup-jobs", verifyAdminSession, async (req, res) => {
    try {
      const { jobType, scope } = req.body;
      const adminUser = (req as any).adminUser;
      
      const preview = await mediaService.previewCleanup(jobType, scope || {});
      
      const { mediaCleanupJobs } = await import("@shared/schema");
      const [job] = await db.insert(mediaCleanupJobs).values({
        jobType,
        scope: scope || {},
        previewResults: preview,
        affectedCount: preview.totalCount,
        status: 'previewed',
        createdBy: adminUser.email,
        previewedAt: new Date(),
      }).returning();
      
      res.json({ job, preview });
    } catch (error: any) {
      console.error("Error creating cleanup job:", error);
      res.status(500).json({ error: error.message || "Failed to create cleanup job" });
    }
  });

  // Execute cleanup job
  app.post("/api/admin/media/cleanup-jobs/:id/execute", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const adminUser = (req as any).adminUser;
      
      const result = await mediaService.executeCleanup(id, adminUser.email);
      res.json(result);
    } catch (error: any) {
      console.error("Error executing cleanup:", error);
      res.status(500).json({ error: error.message || "Failed to execute cleanup" });
    }
  });

  // Rollback cleanup job
  app.post("/api/admin/media/cleanup-jobs/:id/rollback", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await mediaService.rollbackCleanup(id);
      res.json(result);
    } catch (error: any) {
      console.error("Error rolling back cleanup:", error);
      res.status(500).json({ error: error.message || "Failed to rollback cleanup" });
    }
  });

  // Get backups
  app.get("/api/admin/media/backups", verifyAdminSession, async (req, res) => {
    try {
      const backups = await mediaService.getBackups();
      res.json(backups);
    } catch (error: any) {
      console.error("Error fetching backups:", error);
      res.status(500).json({ error: error.message || "Failed to fetch backups" });
    }
  });

  // ============================================
  // OBJECT STORAGE MIGRATION ROUTES
  // ============================================

  // Get migration status
  app.get("/api/admin/media/migration/status", verifyAdminSession, async (req, res) => {
    try {
      const status = await mediaService.getMigrationStatus();
      res.json(status);
    } catch (error: any) {
      console.error("Error fetching migration status:", error);
      res.status(500).json({ error: error.message || "Failed to fetch migration status" });
    }
  });

  // Trigger migration batch
  app.post("/api/admin/media/migration/run", verifyAdminSession, async (req, res) => {
    try {
      const limit = parseInt(req.body.limit) || 50;
      const result = await mediaService.migrateLocalToObjectStorage(limit);
      res.json(result);
    } catch (error: any) {
      console.error("Error running migration:", error);
      res.status(500).json({ error: error.message || "Failed to run migration" });
    }
  });

  // ============================================
  // STOCK IMAGE API ROUTES (Unsplash + Pexels)
  // ============================================

  // Get stock image config status
  app.get("/api/admin/media/stock/status", verifyAdminSession, async (req, res) => {
    try {
      const status = stockImageService.getConfigStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get status" });
    }
  });

  // Search stock images
  app.get("/api/admin/media/stock/search", verifyAdminSession, async (req, res) => {
    try {
      const query = req.query.query as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter required" });
      }
      
      const results = await stockImageService.searchStockImages({
        query,
        perPage: parseInt(req.query.perPage as string) || 12,
        page: parseInt(req.query.page as string) || 1,
        orientation: req.query.orientation as 'landscape' | 'portrait' | 'squarish' | undefined,
      });
      
      res.json(results);
    } catch (error: any) {
      console.error("Error searching stock images:", error);
      res.status(500).json({ error: error.message || "Failed to search stock images" });
    }
  });

  // Import stock image
  app.post("/api/admin/media/stock/import", verifyAdminSession, async (req, res) => {
    try {
      const { image, tags } = req.body;
      
      console.log("Stock import request - tags received:", JSON.stringify(tags));
      
      if (!image || !image.id || !image.provider || !image.fullUrl) {
        return res.status(400).json({ error: "Invalid image data" });
      }
      
      // Handle both string tags (from AdminMedia) and object tags (from MediaPicker)
      const formattedTags = (tags || []).map((tag: any) => {
        if (typeof tag === 'string') {
          return { tagType: 'destination', tagValue: tag };
        }
        // Already an object with tagType/tagValue
        return tag;
      });
      
      const result = await stockImageService.importStockImage(image, formattedTags);
      
      if (!result) {
        return res.status(500).json({ error: "Failed to import image" });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error importing stock image:", error);
      res.status(500).json({ error: error.message || "Failed to import stock image" });
    }
  });

  // Search and auto-import stock images for a prompt
  app.post("/api/admin/media/stock/auto-import", verifyAdminSession, async (req, res) => {
    try {
      const { prompt, count, orientation, preferProvider, tags } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt required" });
      }
      
      const results = await stockImageService.searchAndImportForPrompt(prompt, {
        count: count || 3,
        orientation: orientation || 'landscape',
        preferProvider,
        tags,
      });
      
      res.json({ imported: results.length, assets: results });
    } catch (error: any) {
      console.error("Error auto-importing stock images:", error);
      res.status(500).json({ error: error.message || "Failed to auto-import stock images" });
    }
  });

  // ===== HOTELS LIBRARY API =====
  
  // Get all hotels
  app.get("/api/admin/hotels", verifyAdminSession, async (req, res) => {
    try {
      const hotels = await storage.getAllHotels();
      res.json(hotels);
    } catch (error: any) {
      console.error("Error fetching hotels:", error);
      res.status(500).json({ error: error.message || "Failed to fetch hotels" });
    }
  });
  
  // Search hotels
  app.get("/api/admin/hotels/search", verifyAdminSession, async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const hotels = await storage.searchHotels(query);
      res.json(hotels);
    } catch (error: any) {
      console.error("Error searching hotels:", error);
      res.status(500).json({ error: error.message || "Failed to search hotels" });
    }
  });
  
  // Get hotel by ID
  app.get("/api/admin/hotels/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid hotel ID" });
      }
      const hotel = await storage.getHotelById(id);
      if (!hotel) {
        return res.status(404).json({ error: "Hotel not found" });
      }
      res.json(hotel);
    } catch (error: any) {
      console.error("Error fetching hotel:", error);
      res.status(500).json({ error: error.message || "Failed to fetch hotel" });
    }
  });
  
  // Create hotel manually
  app.post("/api/admin/hotels", verifyAdminSession, async (req, res) => {
    try {
      const hotel = await storage.createHotel(req.body);
      res.json(hotel);
    } catch (error: any) {
      console.error("Error creating hotel:", error);
      res.status(500).json({ error: error.message || "Failed to create hotel" });
    }
  });
  
  // Update hotel
  app.patch("/api/admin/hotels/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid hotel ID" });
      }
      const hotel = await storage.updateHotel(id, req.body);
      if (!hotel) {
        return res.status(404).json({ error: "Hotel not found" });
      }
      
      // Sync hotel updates to all packages that use this hotel
      const syncResult = await storage.syncHotelToPackages(hotel);
      if (syncResult.updatedCount > 0) {
        console.log(`[Hotel Sync] Updated ${syncResult.updatedCount} packages with hotel "${hotel.name}" changes`);
      }
      
      res.json({ 
        ...hotel, 
        syncedPackages: syncResult.updatedCount 
      });
    } catch (error: any) {
      console.error("Error updating hotel:", error);
      res.status(500).json({ error: error.message || "Failed to update hotel" });
    }
  });
  
  // Delete hotel (soft delete)
  app.delete("/api/admin/hotels/:id", verifyAdminSession, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid hotel ID" });
      }
      const success = await storage.deleteHotel(id);
      if (!success) {
        return res.status(500).json({ error: "Failed to delete hotel" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting hotel:", error);
      res.status(500).json({ error: error.message || "Failed to delete hotel" });
    }
  });
  
  // Scrape hotel from URL
  app.post("/api/admin/hotels/scrape", verifyAdminSession, async (req, res) => {
    try {
      const { url, galleryUrl, country, city } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }
      
      // Validate gallery URL if provided
      if (galleryUrl) {
        try {
          new URL(galleryUrl);
        } catch {
          return res.status(400).json({ error: "Invalid gallery URL format" });
        }
      }
      
      // Import scraper dynamically to avoid circular dependencies
      const { scrapeHotelWebsite, importHotelImages } = await import('./hotelScraperService');
      
      // Check if hotel already exists
      const existing = await storage.getHotelBySourceUrl(url);
      if (existing) {
        return res.status(409).json({ 
          error: "Hotel from this URL already exists", 
          hotel: existing 
        });
      }
      
      // Scrape the hotel data (homepage for description, gallery URL for images)
      const scrapedData = await scrapeHotelWebsite(url, galleryUrl);
      
      // Import images to media library
      let importedImages: string[] = [];
      if (scrapedData.images.length > 0) {
        importedImages = await importHotelImages(
          scrapedData.name, 
          scrapedData.images, 
          country, 
          city
        );
      }
      
      // Create the hotel record
      const hotel = await storage.createHotel({
        name: scrapedData.name,
        description: scrapedData.description,
        starRating: scrapedData.starRating,
        amenities: scrapedData.amenities,
        images: importedImages,
        featuredImage: importedImages[0] || null,
        sourceUrl: url,
        city: city || null,
        country: country || null,
        phone: scrapedData.phone || null,
        email: scrapedData.email || null,
        checkInTime: scrapedData.checkInTime || null,
        checkOutTime: scrapedData.checkOutTime || null,
        isActive: true,
      });
      
      res.json({
        success: true,
        hotel,
        scrapedData,
        importedImageCount: importedImages.length,
      });
    } catch (error: any) {
      console.error("Error scraping hotel:", error);
      res.status(500).json({ error: error.message || "Failed to scrape hotel" });
    }
  });

  // Import hotels from existing flight packages
  app.post("/api/admin/hotels/import-from-packages", verifyAdminSession, async (req, res) => {
    try {
      const packages = await storage.getAllFlightPackages();
      const importedHotels: any[] = [];
      const skippedHotels: string[] = [];
      
      // Extract unique hotels from all packages
      const hotelMap = new Map<string, any>();
      
      for (const pkg of packages) {
        if (!pkg.accommodations || !Array.isArray(pkg.accommodations)) continue;
        
        for (const acc of pkg.accommodations) {
          if (!acc.name) continue;
          
          // Normalize hotel name for deduplication
          const normalizedName = acc.name.trim().toLowerCase();
          
          if (!hotelMap.has(normalizedName)) {
            hotelMap.set(normalizedName, {
              name: acc.name.trim(),
              description: acc.description || null,
              images: acc.images || [],
              country: pkg.category || null, // Use package category as country hint
            });
          }
        }
      }
      
      // Import each unique hotel
      const { importHotelImages } = await import('./hotelScraperService');
      
      const entries = Array.from(hotelMap.entries());
      for (const [normalizedName, hotelData] of entries) {
        // Check if already exists
        const existing = await storage.getHotelByName(hotelData.name);
        if (existing) {
          skippedHotels.push(hotelData.name);
          continue;
        }
        
        // Import images
        let importedImages: string[] = [];
        if (hotelData.images.length > 0) {
          try {
            importedImages = await importHotelImages(
              hotelData.name,
              hotelData.images,
              hotelData.country || undefined,
              undefined
            );
          } catch (err) {
            console.error(`Failed to import images for ${hotelData.name}:`, err);
          }
        }
        
        // Create hotel record
        const hotel = await storage.createHotel({
          name: hotelData.name,
          description: hotelData.description,
          images: importedImages,
          featuredImage: importedImages[0] || null,
          country: hotelData.country,
          isActive: true,
        });
        
        importedHotels.push({
          id: hotel.id,
          name: hotel.name,
          imageCount: importedImages.length,
        });
      }
      
      res.json({
        success: true,
        imported: importedHotels.length,
        skipped: skippedHotels.length,
        importedHotels,
        skippedHotels,
      });
    } catch (error: any) {
      console.error("Error importing hotels from packages:", error);
      res.status(500).json({ error: error.message || "Failed to import hotels" });
    }
  });

  // Remove duplicate hotels (keeps the first/oldest record for each normalized name)
  app.post("/api/admin/hotels/remove-duplicates", verifyAdminSession, async (req, res) => {
    try {
      const allHotels = await storage.getAllHotels();
      
      // Group hotels by normalized name
      const hotelGroups = new Map<string, typeof allHotels>();
      for (const hotel of allHotels) {
        const normalizedName = hotel.name.trim().toLowerCase().replace(/\s+/g, ' ');
        const existing = hotelGroups.get(normalizedName) || [];
        existing.push(hotel);
        hotelGroups.set(normalizedName, existing);
      }
      
      // Find duplicates and remove them (keep the first/oldest by ID)
      const removedHotels: string[] = [];
      const entries = Array.from(hotelGroups.entries());
      
      for (const [normalizedName, hotels] of entries) {
        if (hotels.length > 1) {
          // Sort by ID (ascending) to keep the oldest
          hotels.sort((a, b) => a.id - b.id);
          
          // Remove all but the first one
          for (let i = 1; i < hotels.length; i++) {
            await storage.deleteHotel(hotels[i].id);
            removedHotels.push(hotels[i].name);
          }
        }
      }
      
      res.json({
        success: true,
        removed: removedHotels.length,
        removedHotels,
      });
    } catch (error: any) {
      console.error("Error removing duplicate hotels:", error);
      res.status(500).json({ error: error.message || "Failed to remove duplicates" });
    }
  });

  // Verify and repair broken hotel images
  app.post("/api/admin/hotels/verify-images", verifyAdminSession, async (req, res) => {
    try {
      const allHotels = await storage.getAllHotels();
      const brokenHotels: { id: number; name: string; brokenImages: number; totalImages: number }[] = [];
      const repairedHotels: string[] = [];
      
      for (const hotel of allHotels) {
        const images = (hotel.images || []) as string[];
        if (images.length === 0) continue;
        
        let brokenCount = 0;
        const workingImages: string[] = [];
        
        for (const imageUrl of images) {
          // Extract slug from URL like /api/media/slug/variant
          const match = imageUrl.match(/\/api\/media\/([^/]+)\/[^/]+$/);
          if (match) {
            const slug = match[1];
            const variantInfo = await mediaService.getVariantInfo(slug, 'card');
            if (!variantInfo) {
              brokenCount++;
            } else {
              workingImages.push(imageUrl);
            }
          } else {
            // Not a media URL, keep it
            workingImages.push(imageUrl);
          }
        }
        
        if (brokenCount > 0) {
          brokenHotels.push({
            id: hotel.id,
            name: hotel.name,
            brokenImages: brokenCount,
            totalImages: images.length,
          });
          
          // Repair: Update hotel with only working images
          if (req.body.repair) {
            await storage.updateHotel(hotel.id, {
              images: workingImages,
              featuredImage: workingImages[0] || null,
            });
            repairedHotels.push(hotel.name);
          }
        }
      }
      
      res.json({
        success: true,
        totalHotels: allHotels.length,
        hotelsWithBrokenImages: brokenHotels.length,
        brokenHotels: req.body.repair ? undefined : brokenHotels,
        repaired: req.body.repair ? repairedHotels.length : 0,
        repairedHotels: req.body.repair ? repairedHotels : undefined,
      });
    } catch (error: any) {
      console.error("Error verifying hotel images:", error);
      res.status(500).json({ error: error.message || "Failed to verify hotel images" });
    }
  });

  // Build keyword index for AI search on startup
  (async () => {
    try {
      const packages = await storage.getPublishedFlightPackages();
      buildPackageIndex(packages);
    } catch (error) {
      console.error('[Keyword Index] Failed to build index on startup:', error);
    }
  })();
  
  // Periodic cleanup of expired sessions (runs every hour)
  setInterval(async () => {
    try {
      // Clean up expired database sessions
      await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
      console.log('Cleaned up expired admin sessions from database');
      
      // Clean up expired pending 2FA sessions from database
      await db.delete(pending2FASessions).where(lt(pending2FASessions.expiresAt, new Date()));
      console.log('Cleaned up expired pending 2FA sessions from database');
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  const httpServer = createServer(app);

  return httpServer;
}
