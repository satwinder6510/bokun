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
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    timeout: 30000,
  });
  
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
  if (description) return cleanText(description);
  
  // Try meta description
  description = $('meta[name="description"]').attr('content') || '';
  if (description) return cleanText(description);
  
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
  ];
  
  for (const selector of descSelectors) {
    const text = $(selector).first().text();
    if (text && text.length > 100) {
      return cleanText(text.slice(0, 2000));
    }
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

// Main scraping function
export async function scrapeHotelWebsite(url: string): Promise<ScrapedHotelData> {
  console.log(`Scraping hotel website: ${url}`);
  
  const html = await rateLimitedFetch(url);
  const $ = cheerio.load(html);
  
  const name = extractName($);
  const description = extractDescription($);
  const starRating = extractStarRating($);
  const amenities = extractAmenities($);
  const images = extractImages($, url);
  
  // Try to extract contact info
  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = html.match(/(?:\+|00)?[\d\s\-().]{10,}/);
  
  console.log(`Scraped hotel: ${name}, ${images.length} images, ${amenities.length} amenities`);
  
  return {
    name: name || 'Unknown Hotel',
    description,
    starRating,
    amenities,
    images,
    email: emailMatch?.[0],
    phone: phoneMatch?.[0]?.trim(),
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
      // Download the image
      const response = await fetch(imageUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
      });
      
      if (!response.ok) continue;
      
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Generate a slug for the hotel image
      const slug = `hotel-${hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Process and upload using media service
      const asset = await mediaService.processAndUploadImage(
        buffer,
        `${slug}.jpg`,
        contentType,
        'hotel_scrape',
        imageUrl
      );
      
      // Tag with location if provided
      if (asset && (country || city)) {
        const tags: string[] = [];
        if (country) tags.push(country);
        if (city) tags.push(city);
        
        for (const tag of tags) {
          await storage.createMediaTag({
            mediaAssetId: asset.id,
            tagType: 'destination',
            tagValue: tag,
          });
        }
      }
      
      if (asset) {
        importedUrls.push(`/api/media/${asset.slug}/card`);
      }
    } catch (error) {
      console.error(`Failed to import image ${imageUrl}:`, error);
    }
  }
  
  return importedUrls;
}
