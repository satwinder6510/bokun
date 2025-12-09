import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { storage } from './storage';
import * as mediaService from './mediaService';

export interface ScrapedHotelData {
  name: string;
  description: string;
  starRating?: number;
  amenities: string[];
  address?: string;
  images: string[];
  phone?: string;
  email?: string;
  checkInTime?: string;
  checkOutTime?: string;
  galleryUrl?: string; // The URL used for images (for admin display)
  gallerySource?: 'auto-discovered' | 'manual' | 'homepage-fallback';
}

// Common user agent to avoid blocking
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Rate limiting: track domains and last request time
const domainLastRequest = new Map<string, number>();
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests to same domain

async function rateLimitedFetch(url: string): Promise<string> {
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  
  const lastRequest = domainLastRequest.get(domain) || 0;
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequest;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  domainLastRequest.set(domain, Date.now());
  
  // Use AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: controller.signal,
  });
  
  clearTimeout(timeoutId);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  
  return response.text();
}

// Extract images from the page
function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];
  const seenUrls = new Set<string>();
  
  // Look for high-quality images in common hotel image containers
  const imageSelectors = [
    'img[src*="gallery"]',
    'img[src*="room"]',
    'img[src*="hotel"]',
    'img[src*="photo"]',
    '.gallery img',
    '.slider img',
    '.carousel img',
    '[data-gallery] img',
    'picture source[srcset]',
    'img[data-src]',
    'img[data-lazy]',
    'img.lazyload',
  ];
  
  // Also check OpenGraph and schema.org images
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    const fullUrl = resolveUrl(ogImage, baseUrl);
    if (fullUrl && !seenUrls.has(fullUrl)) {
      images.push(fullUrl);
      seenUrls.add(fullUrl);
    }
  }
  
  // Schema.org image
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const schemaImages = json.image || json.photo || [];
      const imgArray = Array.isArray(schemaImages) ? schemaImages : [schemaImages];
      imgArray.forEach((img: string | { url?: string }) => {
        const imgUrl = typeof img === 'string' ? img : img?.url;
        if (imgUrl) {
          const fullUrl = resolveUrl(imgUrl, baseUrl);
          if (fullUrl && !seenUrls.has(fullUrl)) {
            images.push(fullUrl);
            seenUrls.add(fullUrl);
          }
        }
      });
    } catch (e) {
      // Ignore JSON parse errors
    }
  });
  
  // Find images using selectors
  imageSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy') || $(el).attr('srcset')?.split(',')[0]?.trim()?.split(' ')[0];
      if (src) {
        const fullUrl = resolveUrl(src, baseUrl);
        if (fullUrl && !seenUrls.has(fullUrl) && isValidImageUrl(fullUrl)) {
          images.push(fullUrl);
          seenUrls.add(fullUrl);
        }
      }
    });
  });
  
  // Fallback: get all reasonably sized images
  if (images.length < 3) {
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      const width = parseInt($(el).attr('width') || '0', 10);
      const height = parseInt($(el).attr('height') || '0', 10);
      
      // Only include images that appear to be content images (not icons/logos)
      if (src && (width > 200 || height > 200 || (!width && !height))) {
        const fullUrl = resolveUrl(src, baseUrl);
        if (fullUrl && !seenUrls.has(fullUrl) && isValidImageUrl(fullUrl)) {
          images.push(fullUrl);
          seenUrls.add(fullUrl);
        }
      }
    });
  }
  
  return images.slice(0, 20); // Limit to 20 images
}

function isValidImageUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  // Exclude common non-content images
  if (lowerUrl.includes('logo') || lowerUrl.includes('icon') || lowerUrl.includes('sprite')) {
    return false;
  }
  // Must be a valid image extension or image service
  return /\.(jpg|jpeg|png|webp|gif)/i.test(url) || 
         url.includes('cloudinary') || 
         url.includes('imgix') ||
         url.includes('unsplash') ||
         url.includes('booking.com/images');
}

function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    if (url.startsWith('data:')) return null;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return new URL(url, baseUrl).href;
    if (url.startsWith('http')) return url;
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

// Extract hotel description
function extractDescription($: cheerio.CheerioAPI): string {
  // Try Schema.org first
  let description = '';
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      if (json.description) {
        description = json.description;
      }
    } catch (e) {}
  });
  
  if (description) return cleanText(description);
  
  // Try OpenGraph
  description = $('meta[property="og:description"]').attr('content') || '';
  if (description && description.length > 50) return cleanText(description);
  
  // Try meta description
  description = $('meta[name="description"]').attr('content') || '';
  if (description && description.length > 50) return cleanText(description);
  
  // Try common hotel description selectors
  const descSelectors = [
    '[class*="description"]',
    '[class*="about"]',
    '[id*="description"]',
    '[id*="about"]',
    '.hotel-description',
    '.property-description',
    'article p',
    '.content p',
    'main p',
    '.main-content p',
    '#content p',
    '.intro',
    '.overview',
    '.summary',
  ];
  
  for (const selector of descSelectors) {
    const text = $(selector).first().text();
    if (text && text.length > 50) {
      return cleanText(text.slice(0, 2000));
    }
  }
  
  // Fallback: collect all paragraphs with substantial text
  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const text = cleanText($(el).text());
    if (text.length > 80 && !text.toLowerCase().includes('cookie') && 
        !text.toLowerCase().includes('privacy') && !text.toLowerCase().includes('copyright')) {
      paragraphs.push(text);
    }
  });
  
  if (paragraphs.length > 0) {
    return paragraphs.slice(0, 3).join(' ').slice(0, 2000);
  }
  
  return '';
}

// Extract hotel name
function extractName($: cheerio.CheerioAPI): string {
  // Try Schema.org first
  let name = '';
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      if (json['@type'] === 'Hotel' || json['@type'] === 'LodgingBusiness') {
        name = json.name || '';
      }
    } catch (e) {}
  });
  
  if (name) return cleanText(name);
  
  // Try OpenGraph
  name = $('meta[property="og:title"]').attr('content') || '';
  if (name) return cleanText(name);
  
  // Try title tag
  name = $('title').text() || '';
  if (name) {
    // Remove common suffixes
    name = name.split('|')[0].split('-')[0].split('–')[0].trim();
    return cleanText(name);
  }
  
  // Try h1
  name = $('h1').first().text() || '';
  return cleanText(name);
}

// Extract star rating
function extractStarRating($: cheerio.CheerioAPI): number | undefined {
  // Try Schema.org
  let rating: number | undefined;
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      if (json.starRating) {
        rating = typeof json.starRating === 'object' ? json.starRating.ratingValue : json.starRating;
      }
    } catch (e) {}
  });
  
  if (rating) return Math.min(5, Math.max(1, Math.round(rating)));
  
  // Look for star indicators in the page
  const starSelectors = [
    '[class*="star"]',
    '[class*="rating"]',
    '.stars',
  ];
  
  for (const selector of starSelectors) {
    const el = $(selector).first();
    const text = el.text();
    const match = text.match(/(\d)\s*star/i);
    if (match) {
      return Math.min(5, Math.max(1, parseInt(match[1], 10)));
    }
    
    // Count star icons
    const starIcons = el.find('svg, i, span').length;
    if (starIcons >= 1 && starIcons <= 5) {
      return starIcons;
    }
  }
  
  return undefined;
}

// Extract amenities
function extractAmenities($: cheerio.CheerioAPI): string[] {
  const amenities: string[] = [];
  const seen = new Set<string>();
  
  // Try Schema.org
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      if (json.amenityFeature && Array.isArray(json.amenityFeature)) {
        json.amenityFeature.forEach((a: { name?: string; value?: string }) => {
          const name = a.name || a.value;
          if (name && !seen.has(name.toLowerCase())) {
            amenities.push(name);
            seen.add(name.toLowerCase());
          }
        });
      }
    } catch (e) {}
  });
  
  if (amenities.length > 0) return amenities.slice(0, 20);
  
  // Look for amenity lists
  const amenitySelectors = [
    '[class*="amenit"] li',
    '[class*="facilit"] li',
    '[class*="feature"] li',
    '.amenities li',
    '.facilities li',
    'ul.features li',
  ];
  
  for (const selector of amenitySelectors) {
    $(selector).each((_, el) => {
      const text = cleanText($(el).text());
      if (text && text.length < 50 && !seen.has(text.toLowerCase())) {
        amenities.push(text);
        seen.add(text.toLowerCase());
      }
    });
    
    if (amenities.length >= 5) break;
  }
  
  return amenities.slice(0, 20);
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

// Gallery URL discovery keywords with priority weights
const GALLERY_KEYWORDS = [
  { pattern: '/gallery', weight: 10 },
  { pattern: '/photos', weight: 10 },
  { pattern: '/photo-gallery', weight: 10 },
  { pattern: '/images', weight: 8 },
  { pattern: '/media', weight: 7 },
  { pattern: '/rooms', weight: 6 },
  { pattern: '/accommodation', weight: 6 },
  { pattern: '/our-rooms', weight: 6 },
  { pattern: '/suites', weight: 5 },
  { pattern: '/facilities', weight: 4 },
  { pattern: '/amenities', weight: 4 },
  { pattern: '/virtual-tour', weight: 3 },
  { pattern: 'gallery', weight: 5 },  // keyword anywhere in URL
  { pattern: 'photos', weight: 5 },
  { pattern: 'bildergalerie', weight: 8 }, // German
  { pattern: 'galerie', weight: 7 }, // French/German
  { pattern: 'fotos', weight: 7 }, // Spanish
  { pattern: 'bilder', weight: 6 }, // German
];

// Discover gallery URLs from homepage
function discoverGalleryUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const candidates: { url: string; weight: number }[] = [];
  const seenUrls = new Set<string>();
  const baseUrlObj = new URL(baseUrl);
  
  // Find all links on the page
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    
    const resolvedUrl = resolveUrl(href, baseUrl);
    if (!resolvedUrl) return;
    
    // Only consider same-origin URLs
    try {
      const linkUrlObj = new URL(resolvedUrl);
      if (linkUrlObj.hostname !== baseUrlObj.hostname) return;
    } catch {
      return;
    }
    
    if (seenUrls.has(resolvedUrl)) return;
    seenUrls.add(resolvedUrl);
    
    const lowerUrl = resolvedUrl.toLowerCase();
    const linkText = $(el).text().toLowerCase();
    
    // Calculate weight based on URL patterns
    let totalWeight = 0;
    for (const { pattern, weight } of GALLERY_KEYWORDS) {
      if (lowerUrl.includes(pattern)) {
        totalWeight += weight;
      }
      // Also check link text
      if (linkText.includes(pattern.replace('/', ''))) {
        totalWeight += weight * 0.5;
      }
    }
    
    // Boost if in navigation
    const isInNav = $(el).closest('nav, header, .nav, .menu, .navigation').length > 0;
    if (isInNav && totalWeight > 0) {
      totalWeight += 3;
    }
    
    if (totalWeight > 0) {
      candidates.push({ url: resolvedUrl, weight: totalWeight });
    }
  });
  
  // Sort by weight descending
  candidates.sort((a, b) => b.weight - a.weight);
  
  // Return top candidates
  return candidates.slice(0, 5).map(c => c.url);
}

// Main scraping function with two-step workflow
export async function scrapeHotelWebsite(
  url: string, 
  galleryUrl?: string // Optional manual gallery URL override
): Promise<ScrapedHotelData> {
  console.log(`Scraping hotel website: ${url}`);
  
  // Step 1: Fetch homepage for description and metadata
  const homepageHtml = await rateLimitedFetch(url);
  const $homepage = cheerio.load(homepageHtml);
  
  const name = extractName($homepage);
  const description = extractDescription($homepage);
  const starRating = extractStarRating($homepage);
  const amenities = extractAmenities($homepage);
  
  // Try to extract contact info from homepage
  const emailMatch = homepageHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = homepageHtml.match(/(?:\+|00)?[\d\s\-().]{10,}/);
  
  // Step 2: Determine gallery URL for images
  let images: string[] = [];
  let usedGalleryUrl: string | undefined;
  let gallerySource: 'auto-discovered' | 'manual' | 'homepage-fallback' = 'homepage-fallback';
  
  if (galleryUrl) {
    // Use manually provided gallery URL
    console.log(`Using manual gallery URL: ${galleryUrl}`);
    try {
      const galleryHtml = await rateLimitedFetch(galleryUrl);
      const $gallery = cheerio.load(galleryHtml);
      images = extractImages($gallery, galleryUrl);
      usedGalleryUrl = galleryUrl;
      gallerySource = 'manual';
      console.log(`Extracted ${images.length} images from manual gallery URL`);
    } catch (error) {
      console.error(`Failed to fetch manual gallery URL, falling back to homepage:`, error);
    }
  }
  
  // If no manual URL or it failed, try auto-discovery
  if (images.length === 0) {
    const discoveredGalleryUrls = discoverGalleryUrls($homepage, url);
    console.log(`Discovered ${discoveredGalleryUrls.length} potential gallery URLs:`, discoveredGalleryUrls.slice(0, 3));
    
    // Try each discovered gallery URL until we find one with images
    for (const candidateUrl of discoveredGalleryUrls) {
      try {
        console.log(`Trying gallery URL: ${candidateUrl}`);
        const galleryHtml = await rateLimitedFetch(candidateUrl);
        const $gallery = cheerio.load(galleryHtml);
        const galleryImages = extractImages($gallery, candidateUrl);
        
        if (galleryImages.length > images.length) {
          images = galleryImages;
          usedGalleryUrl = candidateUrl;
          gallerySource = 'auto-discovered';
          console.log(`Found ${galleryImages.length} images from: ${candidateUrl}`);
          
          // If we found a good number of images, stop searching
          if (images.length >= 5) break;
        }
      } catch (error) {
        console.error(`Failed to fetch gallery URL ${candidateUrl}:`, error);
      }
    }
  }
  
  // If still no images, fall back to homepage images
  if (images.length === 0) {
    console.log(`No gallery found, falling back to homepage images`);
    images = extractImages($homepage, url);
    usedGalleryUrl = url;
    gallerySource = 'homepage-fallback';
  }
  
  console.log(`Scraped hotel: ${name}, ${images.length} images from ${gallerySource}, ${amenities.length} amenities`);
  
  return {
    name: name || 'Unknown Hotel',
    description,
    starRating,
    amenities,
    images,
    email: emailMatch?.[0],
    phone: phoneMatch?.[0]?.trim(),
    galleryUrl: usedGalleryUrl,
    gallerySource,
  };
}

// Import scraped images to media library
export async function importHotelImages(
  hotelName: string,
  imageUrls: string[],
  country?: string,
  city?: string
): Promise<string[]> {
  const importedUrls: string[] = [];
  
  for (const imageUrl of imageUrls.slice(0, 10)) { // Limit to 10 images
    try {
      // Download the image with AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(imageUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Generate a filename for the hotel image
      const filename = `hotel-${hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      
      // Process and upload using media service
      const result = await mediaService.processImage(buffer, filename, {
        source: 'upload',
      });
      
      // Add destination tags after asset is created
      if (result && result.asset) {
        if (country) {
          await mediaService.addDestinationTag(result.asset.id, country);
        }
        if (city) {
          await mediaService.addDestinationTag(result.asset.id, city);
        }
        importedUrls.push(`/api/media/${result.asset.slug}/card`);
      }
    } catch (error) {
      console.error(`Failed to import image ${imageUrl}:`, error);
    }
  }
  
  return importedUrls;
}
