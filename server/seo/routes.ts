import type { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { injectTourSeo, injectDestinationSeo, injectPackageSeo, injectStaticPageSeo, injectBlogPostSeo, isBot } from './inject';
import { shouldNoIndex, generateNoIndexMeta } from './meta';
import {
  generateSitemapIndex,
  generatePagesSitemap,
  generateToursSitemap,
  generatePackagesSitemap,
  generateDestinationsSitemap,
  generateBlogSitemap
} from './sitemaps';
import { generateToursFeed, generateDestinationsFeed, generatePackagesFeed } from './feeds';

const SEO_ENABLED = process.env.SEO_ENABLED === 'true';
const PRERENDER_ENABLED = process.env.PRERENDER_ENABLED === 'true';
const SITEMAP_ENABLED = process.env.SITEMAP_ENABLED !== 'false';
const FEEDS_ENABLED = process.env.FEEDS_ENABLED === 'true';
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';

const PRERENDERED_DIR = path.resolve(process.cwd(), 'prerendered');
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// In development mode, only inject SEO for bot requests to avoid breaking Vite's React Fast Refresh
function shouldInjectSeo(req: Request): boolean {
  if (!IS_DEVELOPMENT) {
    // In production, inject SEO for all requests
    return true;
  }
  // In development, only inject for bots
  return isBot(req.get('user-agent'));
}

async function servePrerendered(type: string, slug: string, res: Response): Promise<boolean> {
  if (!PRERENDER_ENABLED) return false;
  
  const filePath = path.join(PRERENDERED_DIR, type, `${slug}.html`);
  
  try {
    if (fs.existsSync(filePath)) {
      const html = await fs.promises.readFile(filePath, 'utf-8');
      res.set('Content-Type', 'text/html');
      res.set('X-Prerendered', 'true');
      res.send(html);
      return true;
    }
  } catch (error) {
    console.error(`[SEO Routes] Error serving prerendered ${type}/${slug}:`, error);
  }
  
  return false;
}

export function registerSeoRoutes(app: Express): void {
  console.log('[SEO] Registering SEO routes...');
  console.log(`[SEO] SEO_ENABLED: ${SEO_ENABLED}`);
  console.log(`[SEO] PRERENDER_ENABLED: ${PRERENDER_ENABLED}`);
  console.log(`[SEO] SITEMAP_ENABLED: ${SITEMAP_ENABLED}`);
  console.log(`[SEO] FEEDS_ENABLED: ${FEEDS_ENABLED}`);
  console.log(`[SEO] CANONICAL_HOST: ${CANONICAL_HOST}`);
  
  // LLM Manifest - always available
  app.get('/llm-manifest.json', async (_req: Request, res: Response) => {
    try {
      const manifestPath = path.resolve(process.cwd(), 'server', 'seo', 'llm-manifest.json');
      const manifest = await fs.promises.readFile(manifestPath, 'utf-8');
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(manifest);
    } catch (error) {
      console.error('[SEO] Error serving llm-manifest.json:', error);
      res.status(500).json({ error: 'Failed to load manifest' });
    }
  });
  
  if (SEO_ENABLED) {
    // Handle noindex routes - /ai-search
    app.get('/ai-search', async (req: Request, res: Response, next) => {
      try {
        // Check if this should be noindexed
        if (shouldNoIndex(req.path, req.url)) {
          const templatePath = process.env.NODE_ENV === 'production'
            ? path.resolve(process.cwd(), 'dist', 'public', 'index.html')
            : path.resolve(process.cwd(), 'client', 'index.html');
          
          let html = await fs.promises.readFile(templatePath, 'utf-8');
          
          // Inject noindex meta tags
          const noindexMeta = generateNoIndexMeta(
            'AI-Powered Holiday Search | Flights and Packages',
            'Find your perfect holiday with our AI-powered search.',
            req.path
          );
          
          // Remove existing meta and add noindex
          html = html.replace(/<title>[^<]*<\/title>/i, '');
          html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '');
          html = html.replace('</head>', `${noindexMeta}\n</head>`);
          
          res.set('Content-Type', 'text/html');
          res.set('X-Robots-Tag', 'noindex, follow');
          res.set('X-SEO-Injected', 'true');
          return res.send(html);
        }
      } catch (error) {
        console.error('[SEO] Error handling ai-search noindex:', error);
      }
      next();
    });
    
    // SEO Routes for dynamic content (Tours, Packages, Destinations, Blog)
    // These routes use NEXT() if SEO is not needed or fails, allowing the static server/Vite to pick it up.
    // However, if the result is successful, they return and end the request.

    app.get('/tour/:id', async (req: Request, res: Response, next) => {
      // Skip SEO injection for regular browser requests in development
      if (!shouldInjectSeo(req)) {
        return next();
      }
      
      try {
        const tourId = req.params.id;
        
        if (await servePrerendered('tours', tourId, res)) {
          return;
        }
        
        const result = await injectTourSeo(tourId, req.path);
        if (!result.error) {
          res.set('Content-Type', 'text/html');
          res.set('X-SEO-Injected', 'true');
          return res.send(result.html);
        }
      } catch (error) {
        console.error('[SEO] Error handling tour SEO:', error);
      }
      next();
    });
    
    app.get('/packages/:slug', async (req: Request, res: Response, next) => {
      if (!shouldInjectSeo(req)) {
        return next();
      }
      
      try {
        const slug = req.params.slug;
        
        if (await servePrerendered('packages', slug, res)) {
          return;
        }
        
        const result = await injectPackageSeo(slug, req.path);
        if (!result.error) {
          res.set('Content-Type', 'text/html');
          res.set('X-SEO-Injected', 'true');
          return res.send(result.html);
        }
      } catch (error) {
        console.error('[SEO] Error handling package SEO:', error);
      }
      next();
    });
    
    app.get('/destinations/:slug', async (req: Request, res: Response, next) => {
      if (!shouldInjectSeo(req)) {
        return next();
      }
      
      try {
        const slug = req.params.slug;
        
        if (await servePrerendered('destinations', slug, res)) {
          return;
        }
        
        const result = await injectDestinationSeo(slug, req.path);
        if (!result.error) {
          res.set('Content-Type', 'text/html');
          res.set('X-SEO-Injected', 'true');
          return res.send(result.html);
        }
      } catch (error) {
        console.error('[SEO] Error handling destination SEO:', error);
      }
      next();
    });
    
    app.get('/Holidays/:country', async (req: Request, res: Response, next) => {
      if (!shouldInjectSeo(req)) {
        return next();
      }
      
      try {
        const slug = req.params.country;
        
        if (await servePrerendered('destinations', slug, res)) {
          return;
        }
        
        const result = await injectDestinationSeo(slug, req.path);
        if (!result.error) {
          res.set('Content-Type', 'text/html');
          res.set('X-SEO-Injected', 'true');
          return res.send(result.html);
        }
      } catch (error) {
        console.error('[SEO] Error handling Holidays country SEO:', error);
      }
      next();
    });
    
    app.get('/Holidays/:country/:slug', async (req: Request, res: Response, next) => {
      if (!shouldInjectSeo(req)) {
        return next();
      }
      
      try {
        const packageSlug = req.params.slug;
        
        if (await servePrerendered('packages', packageSlug, res)) {
          return;
        }
        
        const result = await injectPackageSeo(packageSlug, req.path);
        if (!result.error) {
          res.set('Content-Type', 'text/html');
          res.set('X-SEO-Injected', 'true');
          return res.send(result.html);
        }
      } catch (error) {
        console.error('[SEO] Error handling Holidays package SEO:', error);
      }
      next();
    });
    
    // Static pages SEO
    const staticPages = ['/', '/packages', '/tours', '/destinations', '/collections', '/blog', '/contact', '/faq', '/special-offers', '/terms'];
    
    staticPages.forEach(pagePath => {
      app.get(pagePath, async (req: Request, res: Response, next) => {
        if (!shouldInjectSeo(req)) {
          return next();
        }
        
        try {
          const result = await injectStaticPageSeo(pagePath);
          if (!result.error) {
            res.set('Content-Type', 'text/html');
            res.set('X-SEO-Injected', 'true');
            return res.send(result.html);
          }
        } catch (error) {
          console.error(`[SEO] Error handling static page SEO for ${pagePath}:`, error);
        }
        next();
      });
    });
    
    // Blog post SEO
    app.get('/blog/:slug', async (req: Request, res: Response, next) => {
      if (!shouldInjectSeo(req)) {
        return next();
      }
      
      try {
        const slug = req.params.slug;
        const result = await injectBlogPostSeo(slug, req.path);
        if (!result.error) {
          res.set('Content-Type', 'text/html');
          res.set('X-SEO-Injected', 'true');
          return res.send(result.html);
        }
      } catch (error) {
        console.error('[SEO] Error handling blog post SEO:', error);
      }
      next();
    });
  }
  
  app.get('/robots.txt', (_req: Request, res: Response) => {
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /checkout
Disallow: /api/
Disallow: /2fa-setup
Disallow: /ai-search

Sitemap: ${CANONICAL_HOST}/sitemap.xml

# AI crawler discovery
# See /llm.txt and /ai.txt for AI-specific crawl guidance

# Crawl delay (helps with server load)
Crawl-delay: 1
`;
    res.set('Content-Type', 'text/plain');
    res.send(robotsTxt);
  });
  
  // AI Crawler Discovery - llm.txt
  app.get('/llm.txt', (_req: Request, res: Response) => {
    const llmTxt = `# Flights and Packages - AI Crawler Information
# Last updated: ${new Date().toISOString().split('T')[0]}

# Site Information
name: Flights and Packages
url: ${CANONICAL_HOST}
description: Luxury travel booking platform featuring curated tours, flight packages, and holiday experiences worldwide.

# Crawl Permissions
User-agent: *
Allow: /

# Allowed AI Operations
summarization: allowed
indexing: allowed
training: disallowed
caching: allowed

# Attribution Required
Please attribute content to "Flights and Packages" with a link to ${CANONICAL_HOST}

# Machine-Readable Content Sources
sitemap: ${CANONICAL_HOST}/sitemap.xml
feed-tours: ${CANONICAL_HOST}/feed/tours.json
feed-packages: ${CANONICAL_HOST}/feed/packages.json
feed-destinations: ${CANONICAL_HOST}/feed/destinations.json

# Content Structure
- /packages - All holiday packages listing
- /destinations/:slug - Destination-specific packages
- /Holidays/:country - Country-specific holidays
- /Holidays/:country/:slug - Individual package details
- /tour/:id - Individual tour details

# Preferred Citation Format
"[Package/Tour Name] - Flights and Packages (${CANONICAL_HOST})"

# Contact
For API access or partnerships: info@flightsandpackages.com
`;
    res.set('Content-Type', 'text/plain');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(llmTxt);
  });
  
  // AI Crawler Discovery - ai.txt (alternative format)
  app.get('/ai.txt', (_req: Request, res: Response) => {
    const aiTxt = `# AI Crawler Guidance for Flights and Packages
# ${CANONICAL_HOST}

## Purpose
This file provides guidance for AI systems crawling our travel booking platform.

## Permissions
- Summarization: ALLOWED
- Indexing: ALLOWED
- Content extraction: ALLOWED
- Training on content: NOT ALLOWED without permission
- Commercial use: Requires attribution

## Structured Data Sources
Our content is available in multiple formats:

### Sitemaps
${CANONICAL_HOST}/sitemap.xml (index)
${CANONICAL_HOST}/sitemaps/packages.xml
${CANONICAL_HOST}/sitemaps/tours.xml
${CANONICAL_HOST}/sitemaps/destinations.xml

### JSON Feeds (AI-Optimized)
${CANONICAL_HOST}/feed/tours.json
${CANONICAL_HOST}/feed/packages.json
${CANONICAL_HOST}/feed/destinations.json

## Content Types
- Holiday packages with flights included
- Multi-day guided tours
- Destination guides
- Travel itineraries

## Attribution
When citing our content, please include:
- Source: Flights and Packages
- URL: ${CANONICAL_HOST}
- Access date

## Rate Limiting
Please respect a crawl delay of 1 second between requests.

## Contact
For AI/LLM partnerships: info@flightsandpackages.com
`;
    res.set('Content-Type', 'text/plain');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(aiTxt);
  });
  
  if (SITEMAP_ENABLED) {
    app.get('/sitemap.xml', async (_req: Request, res: Response) => {
      try {
        const sitemap = await generateSitemapIndex();
        res.set('Content-Type', 'application/xml');
        res.send(sitemap);
      } catch (error) {
        console.error('[SEO] Error generating sitemap index:', error);
        res.status(500).send('Error generating sitemap');
      }
    });
    
    app.get('/sitemaps/pages.xml', async (_req: Request, res: Response) => {
      try {
        const sitemap = await generatePagesSitemap();
        res.set('Content-Type', 'application/xml');
        res.send(sitemap);
      } catch (error) {
        console.error('[SEO] Error generating pages sitemap:', error);
        res.status(500).send('Error generating sitemap');
      }
    });
    
    app.get('/sitemaps/tours.xml', async (_req: Request, res: Response) => {
      try {
        const sitemap = await generateToursSitemap();
        res.set('Content-Type', 'application/xml');
        res.send(sitemap);
      } catch (error) {
        console.error('[SEO] Error generating tours sitemap:', error);
        res.status(500).send('Error generating sitemap');
      }
    });
    
    app.get('/sitemaps/packages.xml', async (_req: Request, res: Response) => {
      try {
        const sitemap = await generatePackagesSitemap();
        res.set('Content-Type', 'application/xml');
        res.send(sitemap);
      } catch (error) {
        console.error('[SEO] Error generating packages sitemap:', error);
        res.status(500).send('Error generating sitemap');
      }
    });
    
    app.get('/sitemaps/destinations.xml', async (_req: Request, res: Response) => {
      try {
        const sitemap = await generateDestinationsSitemap();
        res.set('Content-Type', 'application/xml');
        res.send(sitemap);
      } catch (error) {
        console.error('[SEO] Error generating destinations sitemap:', error);
        res.status(500).send('Error generating sitemap');
      }
    });
    
    app.get('/sitemaps/blog.xml', async (_req: Request, res: Response) => {
      try {
        const sitemap = await generateBlogSitemap();
        res.set('Content-Type', 'application/xml');
        res.send(sitemap);
      } catch (error) {
        console.error('[SEO] Error generating blog sitemap:', error);
        res.status(500).send('Error generating sitemap');
      }
    });
  }
  
  if (FEEDS_ENABLED) {
    app.get('/feed/tours.json', async (_req: Request, res: Response) => {
      try {
        const feed = await generateToursFeed();
        res.json({
          version: '1.0',
          title: 'Flights and Packages - Tours',
          home_page_url: CANONICAL_HOST,
          feed_url: `${CANONICAL_HOST}/feed/tours.json`,
          items: feed
        });
      } catch (error) {
        console.error('[SEO] Error generating tours feed:', error);
        res.status(500).json({ error: 'Error generating feed' });
      }
    });
    
    app.get('/feed/packages.json', async (_req: Request, res: Response) => {
      try {
        const feed = await generatePackagesFeed();
        res.json({
          version: '1.0',
          title: 'Flights and Packages - Holiday Packages',
          home_page_url: CANONICAL_HOST,
          feed_url: `${CANONICAL_HOST}/feed/packages.json`,
          items: feed
        });
      } catch (error) {
        console.error('[SEO] Error generating packages feed:', error);
        res.status(500).json({ error: 'Error generating feed' });
      }
    });
    
    app.get('/feed/destinations.json', async (_req: Request, res: Response) => {
      try {
        const feed = await generateDestinationsFeed();
        res.json({
          version: '1.0',
          title: 'Flights and Packages - Destinations',
          home_page_url: CANONICAL_HOST,
          feed_url: `${CANONICAL_HOST}/feed/destinations.json`,
          items: feed
        });
      } catch (error) {
        console.error('[SEO] Error generating destinations feed:', error);
        res.status(500).json({ error: 'Error generating feed' });
      }
    });
  }
  
  console.log('[SEO] SEO routes registered successfully');
}

export async function handleSeoRequest(
  req: Request,
  res: Response,
  fallback: () => void
): Promise<void> {
  if (!SEO_ENABLED) {
    return fallback();
  }
  
  const path = req.path;
  
  try {
    if (path.startsWith('/tour/')) {
      const tourId = path.replace('/tour/', '');
      
      if (await servePrerendered('tours', tourId, res)) {
        return;
      }
      
      const result = await injectTourSeo(tourId, path);
      if (!result.error) {
        res.set('Content-Type', 'text/html');
        res.set('X-SEO-Injected', 'true');
        res.send(result.html);
        return;
      }
    }
    
    else if (path.startsWith('/packages/') && !path.includes('/api/')) {
      const slug = path.replace('/packages/', '');
      
      if (await servePrerendered('packages', slug, res)) {
        return;
      }
      
      const result = await injectPackageSeo(slug, path);
      if (!result.error) {
        res.set('Content-Type', 'text/html');
        res.set('X-SEO-Injected', 'true');
        res.send(result.html);
        return;
      }
    }
    
    else if (path.startsWith('/destinations/') || path.startsWith('/Holidays/')) {
      const parts = path.split('/').filter(Boolean);
      const slug = parts[1] || '';
      
      if (parts.length === 2) {
        if (await servePrerendered('destinations', slug, res)) {
          return;
        }
        
        const result = await injectDestinationSeo(slug, path);
        if (!result.error) {
          res.set('Content-Type', 'text/html');
          res.set('X-SEO-Injected', 'true');
          res.send(result.html);
          return;
        }
      }
      
      else if (parts.length === 3) {
        const packageSlug = parts[2];
        
        if (await servePrerendered('packages', packageSlug, res)) {
          return;
        }
        
        const result = await injectPackageSeo(packageSlug, path);
        if (!result.error) {
          res.set('Content-Type', 'text/html');
          res.set('X-SEO-Injected', 'true');
          res.send(result.html);
          return;
        }
      }
    }
    
    else if (path === '/' || ['/packages', '/tours', '/destinations', '/collections', '/blog', '/contact', '/faq', '/special-offers', '/terms'].includes(path)) {
      const result = await injectStaticPageSeo(path);
      if (!result.error) {
        res.set('Content-Type', 'text/html');
        res.set('X-SEO-Injected', 'true');
        res.send(result.html);
        return;
      }
    }
    
    else if (path.startsWith('/blog/') && !path.includes('/api/')) {
      const slug = path.replace('/blog/', '');
      const result = await injectBlogPostSeo(slug, path);
      if (!result.error) {
        res.set('Content-Type', 'text/html');
        res.set('X-SEO-Injected', 'true');
        res.send(result.html);
        return;
      }
    }
  } catch (error) {
    console.error('[SEO] Error handling SEO request:', error);
  }
  
  fallback();
}
