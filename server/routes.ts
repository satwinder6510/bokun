import type { Express } from "express";
import { createServer, type Server } from "http";
import { testBokunConnection, searchBokunProducts, getBokunProductDetails, getBokunAvailability } from "./bokun";
import { storage } from "./storage";

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

      // Store in cache
      await storage.setCachedProducts(allProducts);
      
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
      const cachedProducts = await storage.getCachedProducts();
      
      if (cachedProducts.length > 0) {
        console.log(`Serving ${cachedProducts.length} products from cache`);
        
        // Paginate cached results
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedProducts = cachedProducts.slice(startIndex, endIndex);
        
        res.json({
          totalHits: cachedProducts.length,
          items: paginatedProducts,
          fromCache: true,
        });
      } else {
        console.log("Cache miss - fetching from Bokun API and caching...");
        
        // Fetch all products and cache them
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

        // Store all products in cache
        await storage.setCachedProducts(allProducts);
        
        // Return requested page
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedProducts = allProducts.slice(startIndex, endIndex);
        
        res.json({
          totalHits: allProducts.length,
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
      const data = await getBokunProductDetails(id);
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

  const httpServer = createServer(app);

  return httpServer;
}
