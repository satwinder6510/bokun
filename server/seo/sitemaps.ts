import { storage } from '../storage';
import type { FlightPackage } from '@shared/schema';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function generateSitemapIndex(): Promise<string> {
  const now = formatDate(new Date());
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  xml += `  <sitemap>
    <loc>${CANONICAL_HOST}/sitemaps/pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`;
  
  xml += `  <sitemap>
    <loc>${CANONICAL_HOST}/sitemaps/tours.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`;
  
  xml += `  <sitemap>
    <loc>${CANONICAL_HOST}/sitemaps/packages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`;
  
  xml += `  <sitemap>
    <loc>${CANONICAL_HOST}/sitemaps/destinations.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`;
  
  xml += `  <sitemap>
    <loc>${CANONICAL_HOST}/sitemaps/blog.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`;
  
  xml += '</sitemapindex>';
  
  return xml;
}

export async function generatePagesSitemap(): Promise<string> {
  const now = formatDate(new Date());
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/packages', changefreq: 'daily', priority: '0.9' },
    { loc: '/tours', changefreq: 'daily', priority: '0.9' },
    { loc: '/destinations', changefreq: 'weekly', priority: '0.8' },
    { loc: '/holidays', changefreq: 'weekly', priority: '0.8' },
    { loc: '/blog', changefreq: 'weekly', priority: '0.7' },
    { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
    { loc: '/faq', changefreq: 'monthly', priority: '0.5' },
    { loc: '/special-offers', changefreq: 'daily', priority: '0.8' },
    { loc: '/terms', changefreq: 'monthly', priority: '0.3' },
  ];
  
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${CANONICAL_HOST}${page.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
  }
  
  xml += '</urlset>';
  return xml;
}

export async function generateToursSitemap(): Promise<string> {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  try {
    // Try GBP cache first, fall back to USD if empty
    let cachedProducts = await storage.getCachedProducts('GBP');
    if (!cachedProducts || cachedProducts.length === 0) {
      cachedProducts = await storage.getCachedProducts('USD');
    }
    const uniqueProducts = Array.from(
      new Map(cachedProducts.map(p => [p.id, p])).values()
    );
    
    for (const product of uniqueProducts) {
      const lastmod = formatDate(new Date());
      xml += `  <url>
    <loc>${CANONICAL_HOST}/tour/${product.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    }
  } catch (error) {
    console.error('[Sitemap] Error generating tours sitemap:', error);
  }
  
  xml += '</urlset>';
  return xml;
}

export async function generatePackagesSitemap(): Promise<string> {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  try {
    const packages = await storage.getAllFlightPackages();
    const publishedPackages = packages.filter((p: FlightPackage) => p.isPublished);
    
    for (const pkg of publishedPackages) {
      const lastmod = formatDate(pkg.updatedAt || new Date());
      xml += `  <url>
    <loc>${CANONICAL_HOST}/packages/${escapeXml(pkg.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
      
      xml += `  <url>
    <loc>${CANONICAL_HOST}/Holidays/${escapeXml(pkg.category.toLowerCase())}/${escapeXml(pkg.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
    }
  } catch (error) {
    console.error('[Sitemap] Error generating packages sitemap:', error);
  }
  
  xml += '</urlset>';
  return xml;
}

export async function generateDestinationsSitemap(): Promise<string> {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  try {
    const packages = await storage.getAllFlightPackages();
    const publishedPackages = packages.filter((p: FlightPackage) => p.isPublished);
    
    const destinations = new Set<string>();
    for (const pkg of publishedPackages) {
      if (pkg.category) {
        destinations.add(pkg.category);
      }
    }
    
    const now = formatDate(new Date());
    const destinationArray = Array.from(destinations);
    for (const destination of destinationArray) {
      const slug = destination.toLowerCase().replace(/\s+/g, '-');
      xml += `  <url>
    <loc>${CANONICAL_HOST}/destinations/${escapeXml(slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
      
      xml += `  <url>
    <loc>${CANONICAL_HOST}/Holidays/${escapeXml(slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    }
  } catch (error) {
    console.error('[Sitemap] Error generating destinations sitemap:', error);
  }
  
  xml += '</urlset>';
  return xml;
}

export async function generateBlogSitemap(): Promise<string> {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  try {
    const posts = await storage.getPublishedBlogPosts();
    
    for (const post of posts) {
      const lastmod = formatDate(post.updatedAt || new Date());
      xml += `  <url>
    <loc>${CANONICAL_HOST}/blog/${escapeXml(post.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
    }
  } catch (error) {
    console.error('[Sitemap] Error generating blog sitemap:', error);
  }
  
  xml += '</urlset>';
  return xml;
}
