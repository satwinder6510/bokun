import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { testBokunConnection, searchBokunProducts, searchBokunProductsByKeyword, getBokunProductDetails, getBokunAvailability, reserveBokunBooking, confirmBokunBooking } from "./bokun";
import { storage } from "./storage";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcrypt";
import { contactLeadSchema, insertFaqSchema, updateFaqSchema, insertBlogPostSchema, updateBlogPostSchema, insertCartItemSchema, insertFlightPackageSchema, updateFlightPackageSchema, insertPackageEnquirySchema, insertReviewSchema, updateReviewSchema, adminLoginSchema, insertAdminUserSchema, updateAdminUserSchema, insertFlightTourPricingConfigSchema, updateFlightTourPricingConfigSchema, adminSessions } from "@shared/schema";
import { calculateCombinedPrices, getFlightsForDateWithPrices, UK_AIRPORTS, getDefaultDepartAirports, searchFlights } from "./flightApi";
import { db } from "./db";
import { eq, lt } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { downloadAndProcessImage, processMultipleImages } from "./imageProcessor";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

// Password hashing constants
const SALT_ROUNDS = 12;

// Pending sessions for 2FA (in-memory, short-lived - 5 minutes max)
const pendingSessions = new Map<string, { userId: number; email: string; role: string; expiresAt: Date }>();

// Generate session token
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

// Verify admin session middleware (using database-backed sessions)
async function verifyAdminSession(req: Request, res: Response, next: NextFunction) {
  const sessionToken = req.headers['x-admin-session'] as string;
  
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

// Configure multer for image uploads - use memory storage for Object Storage
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Use memory storage for Object Storage uploads
const imageMemoryStorage = multer.memoryStorage();

const imageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
  }
};

const upload = multer({
  storage: imageMemoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Check if Object Storage is configured
function isObjectStorageConfigured(): boolean {
  return !!(process.env.PRIVATE_OBJECT_DIR);
}

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
  // Dynamic sitemap.xml endpoint
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const cachedProducts = await storage.getCachedProducts("GBP");
      const publishedBlogPosts = await storage.getPublishedBlogPosts();
      const baseUrl = 'https://tours.flightsandpackages.com';
      
      // Deduplicate products
      const uniqueProducts = Array.from(
        new Map(cachedProducts.map(p => [p.id, p])).values()
      );

      // Generate sitemap XML
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      // Homepage
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/</loc>\n`;
      sitemap += '    <changefreq>daily</changefreq>\n';
      sitemap += '    <priority>1.0</priority>\n';
      sitemap += '  </url>\n';
      
      // Blog index page
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/blog</loc>\n`;
      sitemap += '    <changefreq>weekly</changefreq>\n';
      sitemap += '    <priority>0.9</priority>\n';
      sitemap += '  </url>\n';
      
      // Blog post pages
      publishedBlogPosts.forEach(post => {
        sitemap += '  <url>\n';
        sitemap += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
        const lastmod = post.updatedAt.toISOString().split('T')[0];
        sitemap += `    <lastmod>${lastmod}</lastmod>\n`;
        sitemap += '    <changefreq>monthly</changefreq>\n';
        sitemap += '    <priority>0.7</priority>\n';
        sitemap += '  </url>\n';
      });
      
      // Tour detail pages
      uniqueProducts.forEach(product => {
        sitemap += '  <url>\n';
        sitemap += `    <loc>${baseUrl}/tour/${product.id}</loc>\n`;
        sitemap += '    <changefreq>weekly</changefreq>\n';
        sitemap += '    <priority>0.8</priority>\n';
        sitemap += '  </url>\n';
      });
      
      sitemap += '</urlset>';
      
      res.header('Content-Type', 'application/xml');
      res.send(sitemap);
    } catch (error: any) {
      console.error("Error generating sitemap:", error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // Serve objects from Object Storage
  app.get("/objects/*", async (req, res) => {
    if (!isObjectStorageConfigured()) {
      return res.status(404).json({ error: "Object storage not configured" });
    }
    
    try {
      const objectStorage = new ObjectStorageService();
      const objectFile = await objectStorage.getObjectEntityFile(req.path);
      objectStorage.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Error serving object" });
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
      const { currency = "GBP" } = req.query;
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
      const { currency = "GBP" } = req.body;
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
      const { page = 1, pageSize = 20, currency = "GBP" } = req.body;
      
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
      const { currency = "GBP" } = req.query;
      const data = await getBokunProductDetails(id, currency as string);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching product details:", error.message);
      const statusMatch = error.message.match(/API returned status (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 500;
      res.status(status).json({
        error: error.message || "Failed to fetch product details",
      });
    }
  });

  // DIAGNOSTIC: Show exact GBP request and response from Bokun
  app.get("/api/bokun/currency-test/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { currency = "GBP" } = req.query;
      
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
      const { start, end, currency = "GBP" } = req.query;
      
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
  app.post("/api/auth/admin/login", async (req, res) => {
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
        // Store pending session temporarily in memory (expires in 5 minutes)
        pendingSessions.set(`pending_${pendingToken}`, {
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
        pendingSessions.set(`setup_${pendingToken}`, {
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

      const session = pendingSessions.get(`setup_${pendingToken}`);
      if (!session || session.expiresAt < new Date()) {
        pendingSessions.delete(`setup_${pendingToken}`);
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
  app.post("/api/auth/admin/2fa/verify-setup", async (req, res) => {
    try {
      const { pendingToken, token, secret } = req.body;
      
      if (!pendingToken || !token || !secret) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const session = pendingSessions.get(`setup_${pendingToken}`);
      if (!session || session.expiresAt < new Date()) {
        pendingSessions.delete(`setup_${pendingToken}`);
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
      pendingSessions.delete(`setup_${pendingToken}`);

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
  app.post("/api/auth/admin/2fa/verify", async (req, res) => {
    try {
      const { pendingToken, token } = req.body;
      
      if (!pendingToken || !token) {
        return res.status(400).json({ error: "Pending token and verification code required" });
      }

      const session = pendingSessions.get(`pending_${pendingToken}`);
      if (!session || session.expiresAt < new Date()) {
        pendingSessions.delete(`pending_${pendingToken}`);
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
      pendingSessions.delete(`pending_${pendingToken}`);

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
    const sessionToken = req.headers['x-admin-session'] as string;
    if (sessionToken) {
      try {
        await db.delete(adminSessions).where(eq(adminSessions.sessionToken, sessionToken));
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
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
  app.post("/api/auth/admin/users/:id/reset-password", verifyAdminSession, requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
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

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
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

      // Prepare payload for Privyr webhook with proper structure
      const payload = {
        name: `${firstName} ${lastName}`,
        email: email,
        phone: phone,
        display_name: firstName,
        other_fields: {
          "First Name": firstName,
          "Last Name": lastName,
          "Booking Reference": normalizedBookingRef,
          "Message": message,
          "Source": "Website Contact Form",
          "Landing URL": `${req.protocol}://${req.get('host')}/contact`,
          "Submitted At": new Date().toISOString(),
        },
      };

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
  app.post("/api/faqs", async (req, res) => {
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
  app.patch("/api/faqs/:id", async (req, res) => {
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
  app.delete("/api/faqs/:id", async (req, res) => {
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
  app.post("/api/blog", async (req, res) => {
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
  app.patch("/api/blog/:id", async (req, res) => {
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
  app.delete("/api/blog/:id", async (req, res) => {
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

  // Get single package by slug (public)
  app.get("/api/packages/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const pkg = await storage.getFlightPackageBySlug(slug);
      
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
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

  // Get all packages including unpublished (admin)
  app.get("/api/admin/packages", async (req, res) => {
    try {
      const packages = await storage.getAllFlightPackages();
      res.json(packages);
    } catch (error: any) {
      console.error("Error fetching packages:", error);
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  // Create new package (admin)
  app.post("/api/admin/packages", async (req, res) => {
    try {
      const parseResult = insertFlightPackageSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors 
        });
      }
      
      const pkg = await storage.createFlightPackage(parseResult.data);
      res.status(201).json(pkg);
    } catch (error: any) {
      console.error("Error creating package:", error);
      res.status(500).json({ error: error.message || "Failed to create package" });
    }
  });

  // Update package (admin)
  app.patch("/api/admin/packages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const parseResult = updateFlightPackageSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.errors 
        });
      }
      
      const pkg = await storage.updateFlightPackage(parseInt(id), parseResult.data);
      
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      res.json(pkg);
    } catch (error: any) {
      console.error("Error updating package:", error);
      res.status(500).json({ error: error.message || "Failed to update package" });
    }
  });

  // Delete package (admin)
  app.delete("/api/admin/packages/:id", async (req, res) => {
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
  app.get("/api/admin/packages/:id/pricing", async (req, res) => {
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
  app.post("/api/admin/packages/:id/pricing", async (req, res) => {
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
  app.delete("/api/admin/packages/:packageId/pricing/:pricingId", async (req, res) => {
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
  app.delete("/api/admin/packages/:id/pricing", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePackagePricingByPackage(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting package pricing:", error);
      res.status(500).json({ error: "Failed to delete pricing" });
    }
  });

  // Upload pricing CSV (admin)
  // Supports two formats:
  // 1. Simple row format: departure_airport,date,price (or with extra columns ignored)
  // 2. Grid format: Departure Airport/Date/Price rows with multiple columns
  app.post("/api/admin/packages/:id/pricing/upload-csv", csvUpload.single('csv'), async (req, res) => {
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
        return line.split(',').map(cell => cell.trim());
      };
      
      const pricingEntries: Array<{
        packageId: number;
        departureAirport: string;
        departureAirportName: string;
        departureDate: string;
        price: number;
        currency: string;
        isAvailable: boolean;
      }> = [];
      
      // Check header to determine format
      const header = parseRow(lines[0]).map(h => h.toLowerCase());
      
      // Simple row format: departure_airport,date,price[,optional columns]
      const isSimpleFormat = header.includes('departure_airport') || 
                             header.includes('airport') ||
                             (header[0] === 'departure_airport' || header[0] === 'airport');
      
      if (isSimpleFormat) {
        // Find column indices
        const airportIdx = header.findIndex(h => h === 'departure_airport' || h === 'airport');
        const dateIdx = header.findIndex(h => h === 'date');
        const priceIdx = header.findIndex(h => h === 'price' || h === 'your price (gbp)');
        
        if (dateIdx === -1 || priceIdx === -1) {
          return res.status(400).json({ 
            error: "CSV missing required columns",
            details: "Expected columns: departure_airport (or airport), date, price"
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
          
          // Parse date - supports DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD
          let isoDate: string;
          const ukDateMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          const isoDateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          
          if (ukDateMatch) {
            const day = ukDateMatch[1].padStart(2, '0');
            const month = ukDateMatch[2].padStart(2, '0');
            const year = ukDateMatch[3];
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
          
          const airportName = UK_AIRPORTS_MAP[airportCode] || airportCode;
          
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
  app.post("/api/admin/packages/fetch-flight-prices", async (req, res) => {
    try {
      const { 
        packageId, 
        bokunProductId, 
        destAirport, 
        departAirports, 
        durationNights, 
        startDate, 
        endDate, 
        markupPercent 
      } = req.body;
      
      if (!packageId || !bokunProductId || !destAirport || !departAirports || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      console.log(`\n=== FETCHING FLIGHT PRICES FOR PACKAGE ${packageId} ===`);
      console.log(`Bokun Product: ${bokunProductId}, Dest: ${destAirport}, Duration: ${durationNights} nights`);
      console.log(`Date Range: ${startDate} - ${endDate}, Markup: ${markupPercent}%`);
      
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
      
      // Get Bokun land tour price
      const bokunDetails: any = await getBokunProductDetails(bokunProductId, 'GBP');
      const landTourPrice = bokunDetails?.price || 0;
      const landTourPriceWithMarkup = landTourPrice * 1.1; // 10% Bokun markup
      
      console.log(`Bokun land tour price: £${landTourPrice}, with 10% markup: £${landTourPriceWithMarkup}`);
      
      // Group flight offers by departure date and airport for best price per combination
      const priceMap = new Map<string, { 
        departureAirport: string; 
        departureAirportName: string;
        departureDate: string; 
        flightPrice: number;
        combinedPrice: number;
      }>();
      
      for (const offer of flightOffers) {
        // Parse date from outdep (format: DD/MM/YYYY HH:mm)
        const datePart = offer.outdep.split(" ")[0]; // DD/MM/YYYY
        const [day, month, year] = datePart.split("/");
        const isoDate = `${year}-${month}-${day}`; // YYYY-MM-DD for database
        
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
      
      console.log(`Grouped into ${priceMap.size} unique departure/date combinations`);
      
      // Convert to pricing entries and save
      const pricingEntries = Array.from(priceMap.values()).map(p => ({
        packageId: parseInt(packageId),
        departureAirport: p.departureAirport,
        departureAirportName: p.departureAirportName,
        departureDate: p.departureDate,
        price: p.combinedPrice,
        currency: "GBP",
      }));
      
      // Delete existing pricing for this package first (optional - could be configurable)
      // await storage.deletePackagePricingByPackageId(packageId);
      
      // Insert new pricing entries
      const created = await storage.createPackagePricingBatch(pricingEntries);
      
      console.log(`Saved ${created.length} pricing entries to package ${packageId}`);
      console.log(`=== FLIGHT PRICING COMPLETE ===\n`);
      
      res.json({ 
        pricesFound: flightOffers.length,
        uniqueCombinations: priceMap.size,
        saved: created.length,
        landTourPrice: landTourPriceWithMarkup,
        message: `Successfully imported ${created.length} flight-inclusive prices`
      });
    } catch (error: any) {
      console.error("Error fetching flight prices:", error);
      res.status(500).json({ error: error.message || "Failed to fetch flight prices" });
    }
  });

  // Search Bokun tours for import into flight packages (admin)
  app.get("/api/admin/packages/bokun-search", async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      // Get products from cache
      let cachedProducts = await storage.getCachedProducts('GBP');
      
      // If cache is empty, trigger a cache fill by fetching first page
      if (cachedProducts.length === 0) {
        console.log("Bokun cache empty - fetching products for search...");
        const firstPageData = await searchBokunProducts(1, 100, 'GBP');
        cachedProducts = firstPageData.items || [];
        
        // Cache for future use
        if (cachedProducts.length > 0) {
          await storage.setCachedProducts(cachedProducts, 'GBP');
        }
      }
      
      // Filter products by keyword in title, excerpt, or location
      const searchTerm = query.toLowerCase();
      const filteredItems = cachedProducts.filter((item: any) => {
        const title = (item.title || '').toLowerCase();
        const excerpt = (item.excerpt || '').toLowerCase();
        const summary = (item.summary || '').toLowerCase();
        const city = (item.googlePlace?.city || '').toLowerCase();
        const country = (item.googlePlace?.country || '').toLowerCase();
        const location = (item.locationCode?.location || '').toLowerCase();
        
        return title.includes(searchTerm) || 
               excerpt.includes(searchTerm) ||
               summary.includes(searchTerm) ||
               city.includes(searchTerm) ||
               country.includes(searchTerm) ||
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
      
      console.log(`Bokun admin search for "${query}": found ${filteredItems.length} tours, returning ${tours.length}`);
      res.json({ tours, total: filteredItems.length });
    } catch (error: any) {
      console.error("Error searching Bokun tours:", error);
      res.status(500).json({ error: "Failed to search Bokun tours" });
    }
  });

  // Get Bokun tour details for import (admin)
  app.get("/api/admin/packages/bokun-tour/:productId", async (req, res) => {
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
          // Split by newlines or bullets
          whatsIncluded.push(...details.included.split(/[\n•\-]/).map((s: string) => s.trim()).filter(Boolean));
        }
      }
      
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
      
      // Get the GBP price from the cached products
      // The search endpoint properly returns GBP prices (unlike availability which may return USD
      // depending on booking channel currency settings)
      let importPrice = 0;
      try {
        // Use the cached GBP products from storage
        const cachedProducts = await storage.getCachedProducts('GBP');
        console.log(`Checking ${cachedProducts.length} cached GBP products for ID ${productId}`);
        
        const matchingProduct = cachedProducts.find((p: any) => String(p.id) === String(productId));
        
        if (matchingProduct) {
          console.log(`Found product in cache: ${matchingProduct.title}, price: ${matchingProduct.price}`);
          if (matchingProduct.price) {
            importPrice = matchingProduct.price;
            console.log(`Got GBP price from cache: £${importPrice}`);
          } else {
            console.log(`Product found but has no price in cache`);
            // Fall back to product details price
            importPrice = details.nextDefaultPriceMoney?.amount || details.price || 0;
          }
        } else {
          console.log(`Product ID ${productId} not found in cache`);
          // Fall back to product details price (may be in USD)
          importPrice = details.nextDefaultPriceMoney?.amount || details.price || 0;
          console.log(`Using product details price: ${importPrice} (may not be GBP)`);
        }
      } catch (priceError) {
        console.error("Could not fetch GBP pricing:", priceError);
        importPrice = details.nextDefaultPriceMoney?.amount || details.price || 0;
      }
      
      // Transform Bokun data into flight package format
      const importData = {
        bokunProductId: productId,
        title: details.title,
        excerpt: details.excerpt || details.summary || '',
        description: details.description || details.summary || details.longDescription || '',
        price: importPrice,
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
  app.get("/api/admin/packages/:id/pricing/export-csv", async (req, res) => {
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
              "Source": "Package Enquiry Form",
              "Submitted At": new Date().toISOString(),
            },
          };
          
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
  app.get("/api/admin/enquiries", async (req, res) => {
    try {
      const enquiries = await storage.getAllPackageEnquiries();
      res.json(enquiries);
    } catch (error: any) {
      console.error("Error fetching enquiries:", error);
      res.status(500).json({ error: "Failed to fetch enquiries" });
    }
  });

  // Update enquiry status (admin)
  app.patch("/api/admin/enquiries/:id", async (req, res) => {
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
  app.get("/api/admin/reviews", async (req, res) => {
    try {
      const reviews = await storage.getAllReviews();
      res.json(reviews);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Get single review (admin)
  app.get("/api/admin/reviews/:id", async (req, res) => {
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
  app.post("/api/admin/reviews", async (req, res) => {
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
  app.patch("/api/admin/reviews/:id", async (req, res) => {
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
  app.delete("/api/admin/reviews/:id", async (req, res) => {
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
  
  // Get tracking number for visitor (public) - based on UTM params
  app.get("/api/tracking-number", async (req, res) => {
    try {
      const { source, campaign, medium } = req.query;
      
      // Find matching number or default
      const number = await storage.getTrackingNumberBySource(
        source as string || null,
        campaign as string || null,
        medium as string || null
      );
      
      if (number) {
        // Increment impressions asynchronously
        storage.incrementTrackingNumberImpressions(number.id);
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
  app.get("/api/admin/tracking-numbers", async (req, res) => {
    try {
      const numbers = await storage.getAllTrackingNumbers();
      res.json(numbers);
    } catch (error: any) {
      console.error("Error fetching tracking numbers:", error);
      res.status(500).json({ error: "Failed to fetch tracking numbers" });
    }
  });

  // Get single tracking number (admin)
  app.get("/api/admin/tracking-numbers/:id", async (req, res) => {
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
  app.post("/api/admin/tracking-numbers", async (req, res) => {
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
  app.patch("/api/admin/tracking-numbers/:id", async (req, res) => {
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
  app.delete("/api/admin/tracking-numbers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTrackingNumber(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting tracking number:", error);
      res.status(500).json({ error: "Failed to delete tracking number" });
    }
  });

  // Get package categories (for navigation)
  app.get("/api/packages/categories", async (req, res) => {
    try {
      const categories = await storage.getFlightPackageCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Upload image (admin) - uses local storage (Object Storage requires bucket provisioning)
  app.post("/api/admin/upload", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      
      const filename = `package-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      const imageUrl = `/uploads/${filename}`;
      
      res.json({ 
        success: true, 
        url: imageUrl,
        filename: filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Upload multiple images (admin) - uses local storage
  app.post("/api/admin/upload-multiple", upload.array('images', 20), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No image files provided" });
      }
      
      const uploadedImages = [];
      
      for (const file of files) {
        const filename = `package-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, file.buffer);
        uploadedImages.push({
          url: `/uploads/${filename}`,
          filename,
          size: file.size,
          mimetype: file.mimetype
        });
      }
      
      res.json({ 
        success: true, 
        images: uploadedImages,
        count: uploadedImages.length
      });
    } catch (error: any) {
      console.error("Error uploading images:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  });

  // Delete uploaded image (admin) - only works for local files
  app.delete("/api/admin/upload/:filename", (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(uploadDir, filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Image not found" });
      }
    } catch (error: any) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  // Import sample packages (admin)
  app.post("/api/admin/packages/import-samples", async (req, res) => {
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
  app.post("/api/admin/packages/import", async (req, res) => {
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
  app.post("/api/admin/scrape-test", async (req, res) => {
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
  app.post("/api/admin/process-images", async (req, res) => {
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
  app.post("/api/admin/process-image", async (req, res) => {
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
  app.post("/api/admin/batch-import", async (req, res) => {
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
            displayOrder: i
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
  app.post("/api/admin/flight-packages/match-urls", async (req, res) => {
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
  app.post("/api/admin/flight-packages/rescrape-accommodations", async (req, res) => {
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

  // Periodic cleanup of expired sessions (runs every hour)
  setInterval(async () => {
    try {
      // Clean up expired database sessions
      const result = await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
      console.log('Cleaned up expired admin sessions from database');
      
      // Clean up expired pending sessions from memory
      const now = new Date();
      Array.from(pendingSessions.entries()).forEach(([token, session]) => {
        if (session.expiresAt < now) {
          pendingSessions.delete(token);
        }
      });
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  const httpServer = createServer(app);

  return httpServer;
}
