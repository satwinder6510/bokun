import fs from 'fs';
import path from 'path';
import { getCached, setCache } from './cache';
import { generateTourMeta, generateDestinationMeta } from './meta';
import { generateTourJsonLd, generateDestinationJsonLd, generateBreadcrumbJsonLd, generateOrganizationJsonLd, generateFaqPageJsonLd } from './jsonld';
import { getCanonicalUrl } from './canonical';
import { storage } from '../storage';
import type { FlightPackage } from '@shared/schema';
import { buildAllFragments, type FaqItem } from './fragments';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';

interface InjectionResult {
  html: string;
  fromCache: boolean;
  error?: string;
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

function injectIntoBody(html: string, content: string): string {
  return html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
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
    
    tour = await storage.getCachedProduct(tourId, 'GBP');
    
    if (!tour) {
      const packages = await storage.getAllFlightPackages();
      tour = packages.find((p: FlightPackage) => p.slug === tourId || p.id.toString() === tourId);
    }
    
    if (!tour) {
      return { html: template, fromCache: false, error: 'Tour not found' };
    }
    
    const metaTags = generateTourMeta({
      title: tour.title || tour.name,
      excerpt: tour.excerpt,
      description: tour.description,
      keyPhoto: tour.keyPhoto || tour.featuredImage,
      destination: tour.destination || tour.category,
      duration: tour.durationDays || parseDuration(tour.duration)
    }, requestPath);
    
    const jsonLd = generateTourJsonLd({
      id: tour.id,
      title: tour.title || tour.name,
      description: tour.description,
      excerpt: tour.excerpt,
      destination: tour.destination || tour.category,
      duration: tour.durationDays || parseDuration(tour.duration),
      priceFrom: tour.priceFrom || tour.price,
      currency: 'GBP',
      keyPhoto: tour.keyPhoto || tour.featuredImage,
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
    
    const previewContent = `
      <div style="display:none" aria-hidden="true">
        <h1>${tourTitle}</h1>
        <p>${tourDescription}</p>
        ${tourDestination ? `<p>Destination: ${tourDestination}</p>` : ''}
        ${tourDuration ? `<p>Duration: ${tourDuration} days</p>` : ''}
        ${tourPrice ? `<p>From £${tourPrice}</p>` : ''}
      </div>
    `;
    html = injectIntoBody(html, previewContent);
    
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
    
    const previewContent = `
      <div style="display:none" aria-hidden="true">
        <h1>${destinationName} Holidays</h1>
        <p>Explore our ${destinationPackages.length} holiday packages to ${destinationName}.</p>
        <ul>
          ${destinationPackages.slice(0, 10).map((p: FlightPackage) => `<li>${p.title} - From £${p.price || 'TBC'}</li>`).join('')}
        </ul>
      </div>
    `;
    html = injectIntoBody(html, previewContent);
    
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
    
    const metaTags = generateTourMeta({
      title: pkg.title,
      excerpt: pkg.excerpt || undefined,
      description: pkg.description || undefined,
      keyPhoto: pkg.featuredImage || undefined,
      destination: pkg.category || undefined,
      duration: parseDuration(pkg.duration)
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
    
    // Get FAQs (top 5 general FAQs for now)
    let faqs: FaqItem[] = [];
    try {
      const allFaqs = await storage.getPublishedFaqs();
      faqs = allFaqs.slice(0, 5).map(f => ({ question: f.question, answer: f.answer }));
    } catch (e) {
      // FAQs optional, continue without them
    }
    
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
    
    // Generate FAQ JSON-LD if FAQs exist
    const faqJsonLd = generateFaqPageJsonLd(faqs);
    
    let html = injectIntoHead(template, metaTags + jsonLd + breadcrumbs + faqJsonLd);
    
    // Build enhanced content fragments
    const fragments = buildAllFragments(pkg, faqs, relatedPackages);
    
    const previewContent = `
      <div style="display:none" aria-hidden="true">
        <h1>${pkg.title}</h1>
        <p>${pkg.excerpt || pkg.description?.substring(0, 300) || ''}</p>
        ${pkg.category ? `<p>Destination: ${pkg.category}</p>` : ''}
        ${pkg.duration ? `<p>Duration: ${pkg.duration}</p>` : ''}
        ${pkg.price ? `<p>From £${pkg.price}</p>` : ''}
        ${fragments}
      </div>
    `;
    html = injectIntoBody(html, previewContent);
    
    setCache(cacheKey, html);
    return { html, fromCache: false };
  } catch (error: any) {
    console.error('[SEO Inject] Error injecting package SEO:', error);
    const template = await getBaseTemplate();
    return { html: template, fromCache: false, error: error.message };
  }
}
