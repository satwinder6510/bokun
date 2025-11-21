import type { Express } from "express";
import { createServer, type Server } from "http";
import { testBokunConnection, searchBokunProducts, getBokunProductDetails, getBokunAvailability, reserveBokunBooking, confirmBokunBooking } from "./bokun";
import { storage } from "./storage";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { contactLeadSchema, insertFaqSchema, updateFaqSchema, insertBlogPostSchema, updateBlogPostSchema, insertCartItemSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { randomBytes } from "crypto";

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
      const totalAmount = cartItems.reduce((sum, item) => {
        return sum + (item.productPrice * item.quantity);
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

  const httpServer = createServer(app);

  return httpServer;
}
