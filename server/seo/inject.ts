import fs from 'fs';
import path from 'path';
import { getCached, setCache } from './cache';
import { generateTourMeta, generateDestinationMeta, generatePackageMeta } from './meta';
import { generateTourJsonLd, generateDestinationJsonLd, generateBreadcrumbJsonLd, generateOrganizationJsonLd, generateFaqPageJsonLd } from './jsonld';
import { getCanonicalUrl } from './canonical';
import { storage } from '../storage';
import type { FlightPackage } from '@shared/schema';
import { buildAllFragments, generateAutomatedFaqs, type FaqItem } from './fragments';
import { getBokunProductDetails } from '../bokun';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';

// Bot User-Agent patterns for SEO content injection
const BOT_USER_AGENTS = [
  'googlebot', 'bingbot', 'yandex', 'baiduspider', 'duckduckbot',
  'slurp', 'facebookexternalhit', 'linkedinbot', 'twitterbot',
  'applebot', 'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot',
  'gptbot', 'claudebot', 'perplexitybot', 'chatgpt', 'anthropic',
  'cohere-ai', 'you.com', 'bytespider', 'petalbot', 'ia_archiver'
];

interface InjectionResult {
  html: string;
  fromCache: boolean;
  error?: string;
}

export function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

async function getBaseTemplate(): Promise<string> {
  const templatePath = process.env.NODE_ENV === 'production'
    ? path.resolve(process.cwd(), 'dist', 'public', 'index.html')
    : path.resolve(process.cwd(), 'client', 'index.html');
  
  return fs.promises.readFile(templatePath, 'utf-8');
}

function injectIntoHead(html: string, content: string): string {
  let result = html;
  
  // Remove existing title tag
  result = result.replace(/<title>[^<]*<\/title>/i, '');
  
  // Remove existing meta description
  result = result.replace(/<meta\s+name=["']description["'][^>]*>/i, '');
  
  // Remove existing canonical link
  result = result.replace(/<link\s+rel=["']canonical["'][^>]*>/i, '');
  
  // Remove existing Open Graph tags
  result = result.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '');
  
  // Remove existing Twitter Card tags
  result = result.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '');
  
  // Add new SEO content before </head>
  return result.replace('</head>', `${content}\n</head>`);
}

/**
 * CRITICAL FIX: Inject SEO content BEFORE #root, not inside it.
 * React owns #root and will overwrite any content inside it during hydration.
 * This places crawlable content in a separate container that React won't touch.
 */
function injectSeoContentBeforeRoot(html: string, content: string): string {
  // Create a dedicated SEO container BEFORE the React root
  // This content is visible to crawlers but hidden from humans via CSS
  const seoContainer = `
<!-- SEO Content - Visible to crawlers, hidden from users -->
<div id="seo-content" style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
${content}
</div>
<noscript>
<div id="noscript-content">
${content}
</div>
</noscript>
`;
  
  // Insert BEFORE <div id="root">, NOT inside it
  return html.replace('<div id="root"></div>', `${seoContainer}\n    <div id="root"></div>`);
}

// Legacy function - kept for reference, DO NOT USE
function injectIntoBody(html: string, content: string): string {
  console.warn('[SEO] WARNING: injectIntoBody is deprecated. Use injectSeoContentBeforeRoot instead.');
  return injectSeoContentBeforeRoot(html, content);
}

function parseDuration(durationStr: string | null | undefined): number | undefined {
  if (!durationStr) return undefined;
  const match = durationStr.match(/(\d+)\s*(?:nights?|days?)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

export async function injectTourSeo(tourId: string, requestPath: string): Promise<InjectionResult> {
  const cacheKey = `tour:${tourId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return { html: cached, fromCache: true };
  }
  
  try {
    const template = await getBaseTemplate();
    
    let tour: any = null;
    
    // Try GBP cache first, then USD (products are often cached in USD first)
    tour = await storage.getCachedProduct(tourId, 'GBP');
    if (!tour) {
      tour = await storage.getCachedProduct(tourId, 'USD');
    }
    
    // Fall back to fetching directly from Bokun API
    if (!tour) {
      try {
        tour = await getBokunProductDetails(tourId, 'GBP');
      } catch (e) {
        console.log(`[SEO Inject] Could not fetch tour ${tourId} from Bokun:`, e);
      }
    }
    
    // Fall back to flight packages if not a Bokun tour
    if (!tour) {
      const packages = await storage.getAllFlightPackages();
      tour = packages.find((p: FlightPackage) => p.slug === tourId || p.id.toString() === tourId);
    }
    
    if (!tour) {
      return { html: template, fromCache: false, error: 'Tour not found' };
    }
    
    // Handle keyPhoto which can be a string URL or an object with originalUrl
    const keyPhotoUrl = typeof tour.keyPhoto === 'object' && tour.keyPhoto?.originalUrl 
      ? tour.keyPhoto.originalUrl 
      : (typeof tour.keyPhoto === 'string' ? tour.keyPhoto : tour.featuredImage);
    
    const metaTags = generateTourMeta({
      title: tour.title || tour.name,
      excerpt: tour.excerpt,
      description: tour.description,
      keyPhoto: keyPhotoUrl,
      destination: tour.destination || tour.category || tour.googlePlace?.country,
      duration: tour.durationDays || parseDuration(tour.durationText || tour.duration)
    }, requestPath);
    
    const jsonLd = generateTourJsonLd({
      id: tour.id,
      title: tour.title || tour.name,
      description: tour.description,
      excerpt: tour.excerpt,
      destination: tour.destination || tour.category || tour.googlePlace?.country,
      duration: tour.durationDays || parseDuration(tour.durationText || tour.duration),
      priceFrom: tour.priceFrom || tour.price,
      currency: 'GBP',
      keyPhoto: keyPhotoUrl,
      highlights: tour.highlights,
      itinerary: tour.itinerary
    }, requestPath);
    
    const breadcrumbs = generateBreadcrumbJsonLd([
      { name: 'Home', url: CANONICAL_HOST },
      { name: 'Tours', url: `${CANONICAL_HOST}/tours` },
      { name: tour.title || tour.name, url: getCanonicalUrl(requestPath) }
    ]);
    
    const orgJsonLd = generateOrganizationJsonLd();
    
    let html = injectIntoHead(template, metaTags + jsonLd + breadcrumbs + orgJsonLd);
    
    const tourTitle = tour.title || tour.name;
    const tourDescription = tour.excerpt || tour.description?.substring(0, 300) || '';
    const tourDestination = tour.destination || tour.category;
    const tourDuration = tour.durationDays || parseDuration(tour.duration);
    const tourPrice = tour.priceFrom || tour.price;
    
    // Build SEO content with proper structure for crawlers
    const seoContent = `
<article itemscope itemtype="https://schema.org/TouristTrip">
  <h1 itemprop="name">${tourTitle}</h1>
  <p itemprop="description">${tourDescription}</p>
  ${tourDestination ? `<p>Destination: <span itemprop="touristType">${tourDestination}</span></p>` : ''}
  ${tourDuration ? `<p>Duration: ${tourDuration} days</p>` : ''}
  ${tourPrice ? `<p>Price: From <span itemprop="offers" itemscope itemtype="https://schema.org/Offer"><span itemprop="priceCurrency">GBP</span> <span itemprop="price">${tourPrice}</span></span></p>` : ''}
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/tours">Tours</a></li>
      <li>${tourTitle}</li>
    </ol>
  </nav>
</article>
`;
    html = injectSeoContentBeforeRoot(html, seoContent);
    
    setCache(cacheKey, html);
    return { html, fromCache: false };
  } catch (error: any) {
    console.error('[SEO Inject] Error injecting tour SEO:', error);
    const template = await getBaseTemplate();
    return { html: template, fromCache: false, error: error.message };
  }
}

export async function injectDestinationSeo(destinationSlug: string, requestPath: string): Promise<InjectionResult> {
  const cacheKey = `destination:${destinationSlug}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return { html: cached, fromCache: true };
  }
  
  try {
    const template = await getBaseTemplate();
    
    const packages = await storage.getAllFlightPackages();
    const destinationPackages = packages.filter((p: FlightPackage) => 
      p.category?.toLowerCase() === destinationSlug.toLowerCase() ||
      p.category?.toLowerCase().replace(/\s+/g, '-') === destinationSlug.toLowerCase()
    );
    
    const destinationName = destinationPackages[0]?.category || 
      destinationSlug.charAt(0).toUpperCase() + destinationSlug.slice(1).replace(/-/g, ' ');
    
    const destinationImage = destinationPackages[0]?.featuredImage;
    
    const metaTags = generateDestinationMeta({
      name: destinationName,
      description: `Explore our ${destinationPackages.length} holiday packages to ${destinationName}. Book your perfect getaway with Flights and Packages.`,
      image: destinationImage || undefined,
      packageCount: destinationPackages.length
    }, requestPath);
    
    const jsonLd = generateDestinationJsonLd({
      name: destinationName,
      description: `Holiday packages to ${destinationName}`,
      image: destinationImage || undefined,
      packageCount: destinationPackages.length
    }, requestPath);
    
    const breadcrumbs = generateBreadcrumbJsonLd([
      { name: 'Home', url: CANONICAL_HOST },
      { name: 'Destinations', url: `${CANONICAL_HOST}/destinations` },
      { name: destinationName, url: getCanonicalUrl(requestPath) }
    ]);
    
    let html = injectIntoHead(template, metaTags + jsonLd + breadcrumbs);
    
    // Build SEO content with internal links for crawl depth
    const packageLinks = destinationPackages.slice(0, 10).map((p: FlightPackage) => 
      `<li><a href="${CANONICAL_HOST}/Holidays/${destinationSlug.toLowerCase()}/${p.slug}">${p.title}</a> - From £${p.price || 'TBC'}</li>`
    ).join('\n      ');
    
    const seoContent = `
<article itemscope itemtype="https://schema.org/TouristDestination">
  <h1 itemprop="name">${destinationName} Holidays</h1>
  <p itemprop="description">Explore our ${destinationPackages.length} holiday packages to ${destinationName}. Discover amazing tours, experiences, and adventures with Flights and Packages.</p>
  <section aria-label="Available Packages">
    <h2>Holiday Packages to ${destinationName}</h2>
    <ul>
      ${packageLinks}
    </ul>
  </section>
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/destinations">Destinations</a></li>
      <li>${destinationName}</li>
    </ol>
  </nav>
</article>
`;
    html = injectSeoContentBeforeRoot(html, seoContent);
    
    setCache(cacheKey, html);
    return { html, fromCache: false };
  } catch (error: any) {
    console.error('[SEO Inject] Error injecting destination SEO:', error);
    const template = await getBaseTemplate();
    return { html: template, fromCache: false, error: error.message };
  }
}

export async function injectPackageSeo(packageSlug: string, requestPath: string): Promise<InjectionResult> {
  const cacheKey = `package:${packageSlug}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return { html: cached, fromCache: true };
  }
  
  try {
    const template = await getBaseTemplate();
    
    const pkg = await storage.getFlightPackageBySlug(packageSlug);
    
    if (!pkg) {
      return { html: template, fromCache: false, error: 'Package not found' };
    }
    
    const metaTags = generatePackageMeta({
      title: pkg.title,
      category: pkg.category,
      metaTitle: pkg.metaTitle,
      metaDescription: pkg.metaDescription,
      excerpt: pkg.excerpt,
      description: pkg.description,
      featuredImage: pkg.featuredImage
    }, requestPath);
    
    const jsonLd = generateTourJsonLd({
      id: pkg.id,
      title: pkg.title,
      description: pkg.description || undefined,
      excerpt: pkg.excerpt || undefined,
      destination: pkg.category || undefined,
      duration: parseDuration(pkg.duration),
      priceFrom: pkg.price || undefined,
      currency: 'GBP',
      keyPhoto: pkg.featuredImage || undefined,
      highlights: pkg.highlights || undefined,
      itinerary: pkg.itinerary || undefined
    }, requestPath);
    
    const breadcrumbs = generateBreadcrumbJsonLd([
      { name: 'Home', url: CANONICAL_HOST },
      { name: 'Packages', url: `${CANONICAL_HOST}/packages` },
      { name: pkg.title, url: getCanonicalUrl(requestPath) }
    ]);
    
    // Get related packages (same destination)
    let relatedPackages: FlightPackage[] = [];
    try {
      const allPackages = await storage.getAllFlightPackages();
      relatedPackages = allPackages.filter((p: FlightPackage) => 
        p.category?.toLowerCase() === pkg.category?.toLowerCase() &&
        p.isPublished &&
        p.slug !== pkg.slug
      ).slice(0, 3);
    } catch (e) {
      // Related packages optional
    }

    // Generate automated FAQs from package data
    const automatedFaqs = generateAutomatedFaqs(pkg);
    
    // Generate FAQ JSON-LD
    const faqJsonLd = generateFaqPageJsonLd(automatedFaqs);
    
    let html = injectIntoHead(template, metaTags + jsonLd + breadcrumbs + faqJsonLd);
    
    // Build enhanced content fragments including automated FAQs
    const fragments = buildAllFragments(pkg, automatedFaqs, relatedPackages);
    
    // Build SEO content with proper structure - BEFORE #root, not inside it
    const seoContent = `
<article itemscope itemtype="https://schema.org/TouristTrip">
  <h1 itemprop="name">${pkg.title}</h1>
  <p itemprop="description">${pkg.excerpt || pkg.description?.substring(0, 300) || ''}</p>
  ${pkg.category ? `<p>Destination: <span itemprop="touristType">${pkg.category}</span></p>` : ''}
  ${pkg.duration ? `<p>Duration: ${pkg.duration}</p>` : ''}
  ${pkg.price ? `<p>Price: From <span itemprop="offers" itemscope itemtype="https://schema.org/Offer"><span itemprop="priceCurrency">GBP</span> <span itemprop="price">${pkg.price}</span></span></p>` : ''}
  ${fragments}
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/packages">Packages</a></li>
      ${pkg.category ? `<li><a href="${CANONICAL_HOST}/Holidays/${pkg.category.toLowerCase()}">${pkg.category} Holidays</a></li>` : ''}
      <li>${pkg.title}</li>
    </ol>
  </nav>
</article>
`;
    html = injectSeoContentBeforeRoot(html, seoContent);
    
    setCache(cacheKey, html);
    return { html, fromCache: false };
  } catch (error: any) {
    console.error('[SEO Inject] Error injecting package SEO:', error);
    const template = await getBaseTemplate();
    return { html: template, fromCache: false, error: error.message };
  }
}

// Static page SEO configurations
const STATIC_PAGE_SEO: Record<string, { title: string; description: string; h1: string }> = {
  '/': {
    title: 'Flights and Packages - Book 700+ Tours Worldwide',
    description: 'Discover and book 700+ unique tours worldwide with Flights and Packages. Explore destinations, compare prices, and find your perfect adventure.',
    h1: 'Flights and Packages - Your Gateway to World Tours'
  },
  '/packages': {
    title: 'Holiday Packages | Flights and Packages',
    description: 'Browse our collection of flight-inclusive holiday packages to destinations worldwide. Find your perfect getaway with Flights and Packages.',
    h1: 'Holiday Packages Worldwide'
  },
  '/tours': {
    title: 'Tours | Flights and Packages',
    description: 'Explore 700+ unique tours worldwide. From cultural experiences to adventure tours, find your perfect trip with Flights and Packages.',
    h1: 'Tours Worldwide'
  },
  '/destinations': {
    title: 'Destinations | Flights and Packages',
    description: 'Discover holiday destinations worldwide. Browse packages by destination and find your perfect getaway.',
    h1: 'Explore Our Destinations'
  },
  '/holidays': {
    title: 'Holidays | Flights and Packages',
    description: 'Browse our holiday packages by destination. Find flight-inclusive holidays to destinations worldwide.',
    h1: 'Holiday Destinations'
  },
  '/blog': {
    title: 'Travel Blog | Flights and Packages',
    description: 'Read our travel blog for destination guides, travel tips, and holiday inspiration from Flights and Packages.',
    h1: 'Travel Blog'
  },
  '/contact': {
    title: 'Contact Us | Flights and Packages',
    description: 'Get in touch with Flights and Packages. We\'re here to help you plan your perfect holiday.',
    h1: 'Contact Us'
  },
  '/faq': {
    title: 'FAQ | Flights and Packages',
    description: 'Frequently asked questions about booking tours and holidays with Flights and Packages.',
    h1: 'Frequently Asked Questions'
  },
  '/special-offers': {
    title: 'Special Offers | Flights and Packages',
    description: 'Browse our special offers and deals on holiday packages and tours worldwide.',
    h1: 'Special Offers'
  },
  '/terms': {
    title: 'Terms and Conditions | Flights and Packages',
    description: 'Terms and conditions for booking with Flights and Packages.',
    h1: 'Terms and Conditions'
  }
};

export async function injectStaticPageSeo(path: string): Promise<InjectionResult> {
  const cacheKey = `static:${path}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return { html: cached, fromCache: true };
  }
  
  try {
    const template = await getBaseTemplate();
    const pageConfig = STATIC_PAGE_SEO[path];
    
    if (!pageConfig) {
      return { html: template, fromCache: false, error: 'Unknown static page' };
    }
    
    const metaTags = `
    <title>${pageConfig.title}</title>
    <meta name="description" content="${pageConfig.description}" />
    <link rel="canonical" href="${CANONICAL_HOST}${path === '/' ? '' : path}" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="${pageConfig.title}" />
    <meta property="og:description" content="${pageConfig.description}" />
    <meta property="og:url" content="${CANONICAL_HOST}${path === '/' ? '' : path}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Flights and Packages" />
    <meta property="og:image" content="${CANONICAL_HOST}/og-image.jpg" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${pageConfig.title}" />
    <meta name="twitter:description" content="${pageConfig.description}" />
    <meta name="twitter:image" content="${CANONICAL_HOST}/og-image.jpg" />`;
    
    const orgJsonLd = generateOrganizationJsonLd();
    
    let html = injectIntoHead(template, metaTags + orgJsonLd);
    
    // Build SEO content for crawlers
    const seoContent = `
<article>
  <h1>${pageConfig.h1}</h1>
  <p>${pageConfig.description}</p>
  <nav aria-label="Main Navigation">
    <ul>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/packages">Packages</a></li>
      <li><a href="${CANONICAL_HOST}/tours">Tours</a></li>
      <li><a href="${CANONICAL_HOST}/destinations">Destinations</a></li>
      <li><a href="${CANONICAL_HOST}/blog">Blog</a></li>
      <li><a href="${CANONICAL_HOST}/contact">Contact</a></li>
    </ul>
  </nav>
</article>
`;
    html = injectSeoContentBeforeRoot(html, seoContent);
    
    setCache(cacheKey, html);
    return { html, fromCache: false };
  } catch (error: any) {
    console.error('[SEO Inject] Error injecting static page SEO:', error);
    const template = await getBaseTemplate();
    return { html: template, fromCache: false, error: error.message };
  }
}

export async function injectBlogPostSeo(slug: string, requestPath: string): Promise<InjectionResult> {
  const cacheKey = `blog:${slug}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return { html: cached, fromCache: true };
  }
  
  try {
    const template = await getBaseTemplate();
    const blogPost = await storage.getBlogPostBySlug(slug);
    
    if (!blogPost || !blogPost.isPublished) {
      return { html: template, fromCache: false, error: 'Blog post not found' };
    }
    
    const description = blogPost.excerpt || blogPost.content?.substring(0, 160) || '';
    const imageUrl = blogPost.featuredImage || `${CANONICAL_HOST}/og-image.jpg`;
    const publishedDate = blogPost.publishedAt ? new Date(blogPost.publishedAt).toISOString() : undefined;
    const modifiedDate = blogPost.updatedAt ? new Date(blogPost.updatedAt).toISOString() : undefined;
    
    const metaTags = `
    <title>${blogPost.title} | Flights and Packages Blog</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${CANONICAL_HOST}/blog/${slug}" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="${blogPost.title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${CANONICAL_HOST}/blog/${slug}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Flights and Packages" />
    <meta property="og:image" content="${imageUrl}" />
    ${publishedDate ? `<meta property="article:published_time" content="${publishedDate}" />` : ''}
    ${modifiedDate ? `<meta property="article:modified_time" content="${modifiedDate}" />` : ''}
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${blogPost.title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />`;
    
    // Article JSON-LD
    const articleJsonLd = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: blogPost.title,
      description: description,
      image: imageUrl,
      url: `${CANONICAL_HOST}/blog/${slug}`,
      datePublished: publishedDate,
      dateModified: modifiedDate || publishedDate,
      author: {
        "@type": "Organization",
        name: "Flights and Packages"
      },
      publisher: {
        "@type": "Organization",
        name: "Flights and Packages",
        url: CANONICAL_HOST
      }
    })}</script>`;
    
    // Breadcrumb JSON-LD
    const breadcrumbs = generateBreadcrumbJsonLd([
      { name: 'Home', url: CANONICAL_HOST },
      { name: 'Blog', url: `${CANONICAL_HOST}/blog` },
      { name: blogPost.title, url: `${CANONICAL_HOST}/blog/${slug}` }
    ]);
    
    const orgJsonLd = generateOrganizationJsonLd();
    
    let html = injectIntoHead(template, metaTags + articleJsonLd + breadcrumbs + orgJsonLd);
    
    // Build SEO content for crawlers
    const seoContent = `
<article itemscope itemtype="https://schema.org/Article">
  <h1 itemprop="headline">${blogPost.title}</h1>
  <p itemprop="description">${description}</p>
  ${blogPost.destination ? `<p>Destination: ${blogPost.destination}</p>` : ''}
  ${publishedDate ? `<time itemprop="datePublished" datetime="${publishedDate}">Published: ${new Date(publishedDate).toLocaleDateString()}</time>` : ''}
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/blog">Blog</a></li>
      <li>${blogPost.title}</li>
    </ol>
  </nav>
</article>
`;
    html = injectSeoContentBeforeRoot(html, seoContent);
    
    setCache(cacheKey, html);
    return { html, fromCache: false };
  } catch (error: any) {
    console.error('[SEO Inject] Error injecting blog post SEO:', error);
    const template = await getBaseTemplate();
    return { html: template, fromCache: false, error: error.message };
  }
}
