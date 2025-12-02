import type { Express } from "express";
import { createServer, type Server } from "http";
import { testBokunConnection, searchBokunProducts, getBokunProductDetails, getBokunAvailability, reserveBokunBooking, confirmBokunBooking } from "./bokun";
import { storage } from "./storage";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { contactLeadSchema, insertFaqSchema, updateFaqSchema, insertBlogPostSchema, updateBlogPostSchema, insertCartItemSchema, insertFlightPackageSchema, updateFlightPackageSchema, insertPackageEnquirySchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { downloadAndProcessImage, processMultipleImages } from "./imageProcessor";

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

  // 2FA Setup - Generate QR code for initial setup
  app.get("/api/auth/2fa/setup", async (req, res) => {
    try {
      // Get or generate 2FA secret from environment
      let secret = process.env.TOTP_SECRET;
      
      if (!secret) {
        // Generate new secret if not configured
        const totp = new OTPAuth.Secret({ size: 20 });
        secret = totp.base32;
        console.log("Generated new TOTP secret. Add to environment: TOTP_SECRET=" + secret);
      }

      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer: "Tour Discoveries",
        label: "Admin Dashboard",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret,
      });

      // Generate otpauth URI
      const uri = totp.toString();

      // Generate QR code
      const qrCode = await QRCode.toDataURL(uri);

      res.json({
        secret,
        qrCode,
        uri,
      });
    } catch (error: any) {
      console.error("Error generating 2FA setup:", error);
      res.status(500).json({
        error: error.message || "Failed to generate 2FA setup",
      });
    }
  });

  // Verify TOTP code
  app.post("/api/auth/2fa/verify", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          error: "Token is required",
        });
      }

      const secret = process.env.TOTP_SECRET;

      if (!secret) {
        return res.status(500).json({
          error: "2FA is not configured. Please complete setup first.",
        });
      }

      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer: "Tour Discoveries",
        label: "Admin Dashboard",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret,
      });

      // Validate token (allow 1 window before/after for clock skew)
      const delta = totp.validate({ token, window: 1 });

      if (delta !== null) {
        res.json({
          valid: true,
        });
      } else {
        res.json({
          valid: false,
        });
      }
    } catch (error: any) {
      console.error("Error verifying TOTP:", error);
      res.status(500).json({
        error: error.message || "Failed to verify TOTP",
      });
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
          await fetch(process.env.PRIVYR_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: req.body.firstName,
              lastName: req.body.lastName,
              email: req.body.email,
              phone: req.body.phone,
              message: `Package Enquiry: ${pkg.title}\n\nPreferred Dates: ${req.body.preferredDates || 'Not specified'}\nNumber of Travelers: ${req.body.numberOfTravelers || 'Not specified'}\n\n${req.body.message || ''}`,
            }),
          });
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

  // Upload image (admin)
  app.post("/api/admin/upload", upload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      
      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ 
        success: true, 
        url: imageUrl,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Upload multiple images (admin)
  app.post("/api/admin/upload-multiple", upload.array('images', 20), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No image files provided" });
      }
      
      const uploadedImages = files.map(file => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      }));
      
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

  // Delete uploaded image (admin)
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
      const accommodationSection = $('#accommodation, .accommodation-section');
      if (accommodationSection.length) {
        accommodationSection.find('.accordion-panel').each((_, panel) => {
          const hotelName = $(panel).find('.label').first().text().trim() ||
                           $(panel).find('.title').first().text().trim();
          
          if (hotelName) {
            // Get hotel description from .desc - preserve paragraph formatting
            const descElement = $(panel).find('.panel-content .desc');
            const hotelDesc = htmlToText(descElement);
            
            // Get hotel images from carousel
            const hotelImages: string[] = [];
            $(panel).find('.accommodation-carousel img, .panel-content img').each((_, img) => {
              const src = $(img).attr('src');
              if (src && !hotelImages.includes(src) && src.includes('HotelImages')) {
                hotelImages.push(src);
              }
            });
            
            // Also check for images in anchor hrefs (higher quality)
            $(panel).find('.accommodation-carousel a.img-url').each((_, a) => {
              const href = $(a).attr('href');
              if (href && !hotelImages.includes(href)) {
                hotelImages.push(href);
              }
            });
            
            extracted.accommodations.push({
              name: hotelName,
              description: hotelDesc.trim().substring(0, 800),
              images: hotelImages.slice(0, 5)  // Limit to 5 images per hotel
            });
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

  const httpServer = createServer(app);

  return httpServer;
}
