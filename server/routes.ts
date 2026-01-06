import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { testBokunConnection, searchBokunProducts, searchBokunProductsByKeyword, getBokunProductDetails, getBokunAvailability, reserveBokunBooking, confirmBokunBooking } from "./bokun";
import { storage } from "./storage";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcrypt";
import sharp from "sharp";
import { contactLeadSchema, insertFaqSchema, updateFaqSchema, insertBlogPostSchema, updateBlogPostSchema, insertCartItemSchema, insertFlightPackageSchema, updateFlightPackageSchema, insertPackageEnquirySchema, insertTourEnquirySchema, insertReviewSchema, updateReviewSchema, adminLoginSchema, insertAdminUserSchema, updateAdminUserSchema, insertFlightTourPricingConfigSchema, updateFlightTourPricingConfigSchema, adminSessions, newsletterSubscribers } from "@shared/schema";
import { calculateCombinedPrices, getFlightsForDateWithPrices, UK_AIRPORTS, getDefaultDepartAirports, searchFlights } from "./flightApi";
import { searchSerpFlights, getCheapestSerpFlightsByDateAndAirport, isSerpApiConfigured, searchOpenJawFlights, getCheapestOpenJawByDateAndAirport, searchInternalFlights, getCheapestInternalByDate } from "./serpFlightApi";
import { db } from "./db";
import { eq, lt, desc } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { downloadAndProcessImage, processMultipleImages } from "./imageProcessor";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import * as mediaService from "./mediaService";
import * as stockImageService from "./stockImageService";

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
  
  // Middleware to handle legacy URLs from old website
  app.use((req, res, next) => {
    const originalUrl = req.path;
    
    // Skip API routes and static assets
    if (originalUrl.startsWith('/api/') || 
        originalUrl.startsWith('/objects/') || 
        originalUrl.startsWith('/assets/') ||
        originalUrl.startsWith('/uploads/') ||
        originalUrl.includes('.')) {
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
  app.get("/api/admin/storage-diagnostic", async (req, res) => {
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
  app.patch("/api/admin/packages/:id", async (req, res) => {
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

  // ==================== Package Seasons Admin Routes ====================
  
  // Get seasons for a package
  app.get("/api/admin/packages/:id/seasons", async (req, res) => {
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
  app.post("/api/admin/packages/:id/seasons", async (req, res) => {
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
  app.patch("/api/admin/seasons/:id", async (req, res) => {
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
  app.delete("/api/admin/seasons/:id", async (req, res) => {
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
  app.delete("/api/admin/packages/:id/seasons", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePackageSeasonsByPackage(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting package seasons:", error);
      res.status(500).json({ error: "Failed to delete seasons" });
    }
  });

  // ==================== Pricing Export History Routes ====================
  
  // Get pricing exports for a package
  app.get("/api/admin/packages/:id/exports", async (req, res) => {
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
  app.post("/api/admin/packages/:id/generate-pricing", async (req, res) => {
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
                airportName: offer.depname || UK_AIRPORTS[offer.depapt] || offer.depapt,
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
  app.post("/api/admin/packages/:id/generate-openjaw-pricing", async (req, res) => {
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

  // ==================== Content Images Admin Routes ====================
  
  // Get all content images
  app.get("/api/admin/content-images", async (req, res) => {
    try {
      const images = await storage.getAllContentImages();
      res.json(images);
    } catch (error: any) {
      console.error("Error fetching content images:", error);
      res.status(500).json({ error: "Failed to fetch content images" });
    }
  });

  // Get content images by type
  app.get("/api/admin/content-images/:type", async (req, res) => {
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
  app.post("/api/admin/content-images", async (req, res) => {
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
  app.delete("/api/admin/content-images/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteContentImage(parseInt(id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting content image:", error);
      res.status(500).json({ error: "Failed to delete content image" });
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
  app.post("/api/admin/packages/fetch-flight-prices", async (req, res) => {
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
        
        // Convert USD to GBP
        const landTourPriceGBP = landTourPriceUSD * exchangeRate;
        
        // Apply 10% Bokun markup
        landTourPriceWithMarkup = landTourPriceGBP * 1.1;
        
        console.log(`Bokun land tour price: $${landTourPriceUSD} USD -> £${landTourPriceGBP.toFixed(2)} GBP (rate: ${exchangeRate})`);
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
  app.get("/api/admin/packages/bokun-search", async (req, res) => {
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
        // Additional info from Bokun
        excluded: details.excluded || null,
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
  app.get("/api/admin/tour-enquiries", async (req, res) => {
    try {
      const enquiries = await storage.getAllTourEnquiries();
      res.json(enquiries);
    } catch (error: any) {
      console.error("Error fetching tour enquiries:", error);
      res.status(500).json({ error: "Failed to fetch tour enquiries" });
    }
  });

  // Update tour enquiry status (admin)
  app.patch("/api/admin/tour-enquiries/:id", async (req, res) => {
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
  
  // Get tracking number for visitor (public) - based on tag in URL
  // Example: ?tzl in URL → tag=tzl
  app.get("/api/tracking-number", async (req, res) => {
    try {
      const { tag } = req.query;
      
      let number;
      if (tag) {
        // Find matching number by tag
        number = await storage.getTrackingNumberByTag(tag as string);
      } else {
        // No tag, get default number
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

  // Site Settings API endpoints (admin)
  app.get("/api/admin/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSiteSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching site settings:", error);
      res.status(500).json({ error: "Failed to fetch site settings" });
    }
  });

  app.get("/api/admin/settings/:key", async (req, res) => {
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

  app.put("/api/admin/settings/:key", async (req, res) => {
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
  app.post("/api/admin/settings/initialize", async (req, res) => {
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
  app.post("/api/admin/upload", memoryUpload.single('image'), async (req, res) => {
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
  app.post("/api/admin/upload-multiple", memoryUpload.array('images', 20), async (req, res) => {
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

  // Delete uploaded image (admin) - handles both Object Storage and local files
  app.delete("/api/admin/upload/:filename", async (req, res) => {
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
            pricingDisplay: 'both' as const
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

  // Bulk rescrape IMAGES ONLY for all packages with sourceUrl (preserves pricing)
  app.post("/api/admin/flight-packages/rescrape-images", async (req, res) => {
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
      res.json(hotel);
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
