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
    
    // Import destination aggregate helpers
    const { 
      buildDestinationAggregate, 
      generateDestinationFaqs, 
      buildDestinationGuideHtml,
      buildDestinationPackageListHtml,
      buildDestinationBreadcrumbHtml,
      buildDestinationNoscriptHtml,
      generateDestinationMetaFallback,
      generateEnhancedDestinationJsonLd,
      generateDestinationItemListJsonLd
    } = await import('./destinationAggregate');
    
    // Import UK-intent layer for specific destinations
    const {
      isUkIntentDestination,
      buildUkIntentAggregate,
      generateUkIntentFaqs,
      buildUkIntentGuideHtml,
      buildUkIntentH1,
      buildUkIntentBreadcrumbHtml,
      buildUkIntentNoscriptHtml,
      generateUkIntentMetaFallback,
      generateUkIntentDestinationJsonLd,
      generateUkIntentItemListJsonLd,
      generateUkIntentFaqPageJsonLd
    } = await import('./ukIntentDestination');
    
    const packages = await storage.getAllFlightPackages();
    const isUkIntent = isUkIntentDestination(destinationSlug);
    
    // Use UK-intent aggregate for specific destinations (e.g., India)
    const agg = isUkIntent 
      ? buildUkIntentAggregate(packages, destinationSlug)
      : buildDestinationAggregate(packages, destinationSlug);
    
    if (agg.packageCount === 0) {
      return { html: template, fromCache: false, error: 'No packages found for destination' };
    }
    
    const destinationImage = agg.featuredPackages[0]?.featuredImage;
    
    // Generate meta tags - use UK-intent version for specific destinations
    const metaFallback = isUkIntent 
      ? generateUkIntentMetaFallback(agg)
      : generateDestinationMetaFallback(agg);
    
    const metaTags = generateDestinationMeta({
      name: isUkIntent ? `${agg.destinationName} Holidays from the UK` : agg.destinationName,
      description: metaFallback.description,
      image: destinationImage || undefined,
      packageCount: agg.packageCount,
      customTitle: metaFallback.title
    }, requestPath);
    
    // Generate enhanced TouristDestination JSON-LD
    const enhancedDestinationJsonLd = isUkIntent
      ? generateUkIntentDestinationJsonLd(agg, requestPath)
      : generateEnhancedDestinationJsonLd(agg, requestPath);
    const destinationJsonLdScript = `<script type="application/ld+json">${JSON.stringify(enhancedDestinationJsonLd)}</script>`;
    
    const breadcrumbs = generateBreadcrumbJsonLd([
      { name: 'Home', url: CANONICAL_HOST },
      { name: 'Destinations', url: `${CANONICAL_HOST}/destinations` },
      { name: isUkIntent ? `${agg.destinationName} Holidays` : agg.destinationName, url: getCanonicalUrl(requestPath) }
    ]);
    
    // Generate FAQs from inventory data - use UK-intent version for specific destinations
    const faqs = isUkIntent ? generateUkIntentFaqs(agg) : generateDestinationFaqs(agg);
    const faqJsonLd = isUkIntent
      ? `<script type="application/ld+json">${JSON.stringify(generateUkIntentFaqPageJsonLd(faqs))}</script>`
      : generateFaqPageJsonLd(faqs);
    
    // Generate ItemList JSON-LD for featured packages
    const itemListJsonLd = isUkIntent
      ? generateUkIntentItemListJsonLd(agg)
      : generateDestinationItemListJsonLd(agg);
    const itemListJsonLdScript = `<script type="application/ld+json">${JSON.stringify(itemListJsonLd)}</script>`;
    
    let html = injectIntoHead(template, metaTags + destinationJsonLdScript + breadcrumbs + faqJsonLd + itemListJsonLdScript);
    
    // Build comprehensive guide content for #seo-content
    const h1Title = isUkIntent ? buildUkIntentH1(agg.destinationName) : `${agg.destinationName} Holidays`;
    const guideHtml = isUkIntent ? buildUkIntentGuideHtml(agg, faqs) : buildDestinationGuideHtml(agg, faqs);
    const packageListHtml = isUkIntent ? '' : buildDestinationPackageListHtml(agg); // UK-intent includes packages in guide
    const breadcrumbHtml = isUkIntent ? buildUkIntentBreadcrumbHtml(agg) : buildDestinationBreadcrumbHtml(agg);
    
    const seoContent = `
<article itemscope itemtype="https://schema.org/TouristDestination">
  <h1 itemprop="name">${h1Title}</h1>
${guideHtml}
${packageListHtml}
${breadcrumbHtml}
</article>
`;
    
    // Build shorter noscript content
    const noscriptContent = isUkIntent ? buildUkIntentNoscriptHtml(agg) : buildDestinationNoscriptHtml(agg);
    
    // Insert SEO content BEFORE #root with separate noscript
    const seoContainer = `
<!-- SEO Content - Visible to crawlers, hidden from users -->
<div id="seo-content" style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
${seoContent}
</div>
<noscript>
<div id="noscript-content">
${noscriptContent}
</div>
</noscript>
`;
    
    html = html.replace('<div id="root"></div>', `${seoContainer}\n    <div id="root"></div>`);
    
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
    
    // Check if this is a UK-intent destination package and add hub link
    const { isUkIntentDestination, buildHubLinkSection } = await import('./ukIntentDestination');
    const categorySlug = pkg.category?.toLowerCase().replace(/\s+/g, '-') || '';
    const hubLink = isUkIntentDestination(categorySlug) 
      ? buildHubLinkSection(categorySlug, pkg.category || '')
      : '';
    
    // Build SEO content with proper structure - BEFORE #root, not inside it
    const seoContent = `
<article itemscope itemtype="https://schema.org/TouristTrip">
  <h1 itemprop="name">${pkg.title}</h1>
  <p itemprop="description">${pkg.excerpt || pkg.description?.substring(0, 300) || ''}</p>
  ${pkg.category ? `<p>Destination: <span itemprop="touristType">${pkg.category}</span></p>` : ''}
  ${pkg.duration ? `<p>Duration: ${pkg.duration}</p>` : ''}
  ${pkg.price ? `<p>Price: From <span itemprop="offers" itemscope itemtype="https://schema.org/Offer"><span itemprop="priceCurrency">GBP</span> <span itemprop="price">${pkg.price}</span></span></p>` : ''}
  ${fragments}
  ${hubLink}
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/packages">Packages</a></li>
      ${pkg.category ? `<li><a href="${CANONICAL_HOST}/destinations/${pkg.category.toLowerCase()}">${pkg.category} Holidays</a></li>` : ''}
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

export async function injectHolidayDealsSeo(destinationSlug: string, requestPath: string): Promise<InjectionResult> {
  const cacheKey = `holiday-deals:${destinationSlug}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return { html: cached, fromCache: true };
  }
  
  try {
    const template = await getBaseTemplate();
    
    const {
      isUkIntentDestination,
      buildUkIntentAggregate,
      generateUkIntentFaqs,
      generateUkIntentFaqPageJsonLd,
      generateUkIntentItemListJsonLd
    } = await import('./ukIntentDestination');
    
    if (!isUkIntentDestination(destinationSlug)) {
      return { html: template, fromCache: false, error: 'Not a UK-intent destination' };
    }
    
    const packages = await storage.getAllFlightPackages();
    const agg = buildUkIntentAggregate(packages, destinationSlug);
    
    if (agg.packageCount === 0) {
      return { html: template, fromCache: false, error: 'No packages found for destination' };
    }
    
    const { destinationName, packageCount, priceMin, priceMedian, topTags, topDurationBuckets, featuredPackages } = agg;
    const destinationImage = featuredPackages[0]?.featuredImage;
    const CONTACT_EMAIL = 'holidayenq@flightsandpackages.com';
    
    const title = `${destinationName} Holiday Deals & Offers from the UK | Flights and Packages`;
    const tagText = topTags.slice(0, 3).join(', ');
    const description = `Find the best ${destinationName} holiday deals from the UK. ${packageCount} packages available. Popular styles: ${tagText}. Prices from £${priceMin?.toLocaleString() || 'TBC'}. Enquire at ${CONTACT_EMAIL}.`;
    
    const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${CANONICAL_HOST}${requestPath}" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${CANONICAL_HOST}${requestPath}" />
    <meta property="og:type" content="website" />
    ${destinationImage ? `<meta property="og:image" content="${destinationImage}" />` : ''}
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />`;
    
    const destinationJsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": `${destinationName} Holiday Deals`,
      "description": description,
      "url": `${CANONICAL_HOST}${requestPath}`,
      "mainEntity": {
        "@type": "TouristDestination",
        "name": destinationName
      }
    };
    const destinationJsonLdScript = `<script type="application/ld+json">${JSON.stringify(destinationJsonLd)}</script>`;
    
    const breadcrumbs = generateBreadcrumbJsonLd([
      { name: 'Home', url: CANONICAL_HOST },
      { name: 'Destinations', url: `${CANONICAL_HOST}/destinations` },
      { name: `${destinationName} Holidays`, url: `${CANONICAL_HOST}/destinations/${destinationSlug}` },
      { name: 'Holiday Deals', url: `${CANONICAL_HOST}${requestPath}` }
    ]);
    
    const faqs = generateUkIntentFaqs(agg).slice(0, 8);
    const faqJsonLd = `<script type="application/ld+json">${JSON.stringify(generateUkIntentFaqPageJsonLd(faqs))}</script>`;
    
    const itemListJsonLd = generateUkIntentItemListJsonLd(agg);
    const itemListJsonLdScript = `<script type="application/ld+json">${JSON.stringify(itemListJsonLd)}</script>`;
    
    let html = injectIntoHead(template, metaTags + destinationJsonLdScript + breadcrumbs + faqJsonLd + itemListJsonLdScript);
    
    const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
    const priceText = priceMin != null ? `from £${priceMin.toLocaleString()}` : '';
    
    let seoContent = `
<article itemscope itemtype="https://schema.org/CollectionPage">
  <h1 itemprop="name">${destinationName} Holiday Deals & Offers from the UK</h1>
  <section aria-label="Best ${destinationName} Deals">
    <p>Looking for the best ${destinationName} holiday deals? Browse ${packageCount} ${destinationName} holiday packages from the UK, with prices starting ${priceText}. Popular trip styles include ${topTags.slice(0, 3).join(', ')}, with typical durations of ${durText}.</p>
  </section>
  
  <section aria-label="Featured ${destinationName} Holiday Deals">
    <h2>Featured ${destinationName} Deals</h2>
    <ul>
`;
    
    for (const pkg of featuredPackages) {
      const url = `${CANONICAL_HOST}/Holidays/${destinationSlug.toLowerCase()}/${pkg.slug}`;
      const priceTag = pkg.price ? `From £${pkg.price.toLocaleString()}` : 'Price on request';
      seoContent += `      <li><a href="${url}">${pkg.title}</a> - ${priceTag}</li>\n`;
    }
    
    seoContent += `    </ul>
  </section>
  
  <section aria-label="${destinationName} Holiday FAQs">
    <h2>Frequently Asked Questions</h2>
`;
    
    for (const faq of faqs) {
      seoContent += `    <details>
      <summary>${faq.question}</summary>
      <p>${faq.answer}</p>
    </details>
`;
    }
    
    seoContent += `  </section>
  
  <section aria-label="Browse More">
    <p><a href="${CANONICAL_HOST}/destinations/${destinationSlug}">See all ${destinationName} holidays and packages</a></p>
    <p>For enquiries: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
  </section>
  
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/destinations">Destinations</a></li>
      <li><a href="${CANONICAL_HOST}/destinations/${destinationSlug}">${destinationName} Holidays</a></li>
      <li>Holiday Deals</li>
    </ol>
  </nav>
</article>
`;
    
    html = injectSeoContentBeforeRoot(html, seoContent);
    
    setCache(cacheKey, html);
    return { html, fromCache: false };
  } catch (error: any) {
    console.error('[SEO Inject] Error injecting holiday deals SEO:', error);
    const template = await getBaseTemplate();
    return { html: template, fromCache: false, error: error.message };
  }
}
