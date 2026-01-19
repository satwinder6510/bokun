import type { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { injectTourSeo, injectDestinationSeo, injectPackageSeo } from './inject';
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
  
  if (SEO_ENABLED) {
    app.get('/tour/:id', async (req: Request, res: Response, next) => {
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
  }
  
  app.get('/robots.txt', (_req: Request, res: Response) => {
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /checkout
Disallow: /api/
Disallow: /2fa-setup

Sitemap: ${CANONICAL_HOST}/sitemap.xml

# Crawl delay (helps with server load)
Crawl-delay: 1
`;
    res.set('Content-Type', 'text/plain');
    res.send(robotsTxt);
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
  } catch (error) {
    console.error('[SEO] Error handling SEO request:', error);
  }
  
  fallback();
}
