import type { Express } from "express";
import { createServer, type Server } from "http";
import { testBokunConnection, searchBokunProducts, getBokunProductDetails, getBokunAvailability } from "./bokun";
import { storage } from "./storage";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const metadata = await storage.getCacheMetadata();
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
      console.log("Force refreshing products from Bokun API...");
      
      // Fetch all products from Bokun API
      let allProducts: any[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const data = await searchBokunProducts(page, pageSize);
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

      // Store in cache
      await storage.setCachedProducts(uniqueProducts);
      allProducts = uniqueProducts;
      
      console.log(`Refreshed ${allProducts.length} products in cache`);
      
      const metadata = await storage.getCacheMetadata();
      res.json({
        success: true,
        productsRefreshed: allProducts.length,
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
      const { page = 1, pageSize = 20 } = req.body;
      
      // Check if cache exists and is valid
      // Note: Cached product prices are in the default currency (USD/GBP from Bokun)
      // and do not change with user's selected currency. Detail pages and availability
      // checker fetch fresh data with the correct currency.
      const cachedProducts = await storage.getCachedProducts();
      
      if (cachedProducts.length > 0) {
        console.log(`Serving ${cachedProducts.length} products from cache`);
        
        // Deduplicate products by ID (some products appear multiple times in Bokun API)
        const uniqueProducts = Array.from(
          new Map(cachedProducts.map(p => [p.id, p])).values()
        );
        
        // Paginate cached results
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedProducts = uniqueProducts.slice(startIndex, endIndex);
        
        res.json({
          totalHits: uniqueProducts.length,
          items: paginatedProducts,
          fromCache: true,
        });
      } else {
        console.log("Cache miss - fetching from Bokun API and caching...");
        
        // Fetch all products and cache them
        // Note: Bokun product search does not support currency parameter
        // Prices will be in Bokun's default currency (USD/GBP)
        let allProducts: any[] = [];
        let currentPage = 1;
        const fetchPageSize = 100;
        let hasMore = true;

        while (hasMore) {
          const data = await searchBokunProducts(currentPage, fetchPageSize);
          allProducts = allProducts.concat(data.items || []);
          hasMore = (data.items?.length || 0) === fetchPageSize;
          currentPage++;
          
          // Safety limit
          if (currentPage > 50) break;
        }

        // Deduplicate before caching
        const uniqueProducts = Array.from(
          new Map(allProducts.map(p => [p.id, p])).values()
        );
        
        // Store all products in cache
        await storage.setCachedProducts(uniqueProducts);
        
        // Return requested page
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedProducts = uniqueProducts.slice(startIndex, endIndex);
        
        res.json({
          totalHits: uniqueProducts.length,
          items: paginatedProducts,
          fromCache: false,
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

  const httpServer = createServer(app);

  return httpServer;
}
