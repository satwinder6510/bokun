import type { ImageVariant } from './media';

/**
 * Gets a proxied/optimized image URL.
 * 
 * For internal media (/api/media/slug/variant), automatically converts to the specified variant.
 * For external images needing CORS proxy, routes through the image-proxy endpoint.
 * 
 * @param url - Original image URL
 * @param variant - Optional variant for internal media (thumb, card, hero, gallery). Defaults to 'card'.
 * @returns Optimized/proxied URL
 */
export function getProxiedImageUrl(
  url: string | null | undefined, 
  variant: ImageVariant = 'card'
): string {
  const fallbackImage = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
  
  if (!url) {
    return fallbackImage;
  }

  // Handle internal media API URLs - convert to requested variant
  const mediaApiPattern = /^\/api\/media\/([^/]+)\/(thumb|card|hero|gallery)$/;
  const match = url.match(mediaApiPattern);
  
  if (match) {
    const slug = match[1];
    return `/api/media/${slug}/${variant}`;
  }

  // Local uploads don't need proxy
  if (url.startsWith('/uploads/') || url.startsWith('/objects/')) {
    return url;
  }

  // External images that need CORS proxy
  if (url.includes('admin.citiesandbeaches.com') || url.includes('citiesandbeaches.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }

  // Other external images (Unsplash, Bokun S3) typically have proper CORS
  return url;
}

/**
 * Gets an image URL optimized for hero sections (1920px width).
 */
export function getHeroImageUrl(url: string | null | undefined): string {
  return getProxiedImageUrl(url, 'hero');
}

/**
 * Gets an image URL optimized for cards (800px width).
 */
export function getCardImageUrl(url: string | null | undefined): string {
  return getProxiedImageUrl(url, 'card');
}

/**
 * Gets an image URL optimized for thumbnails (400px width).
 */
export function getThumbImageUrl(url: string | null | undefined): string {
  return getProxiedImageUrl(url, 'thumb');
}

/**
 * Gets an image URL optimized for galleries (1280px width).
 */
export function getGalleryImageUrl(url: string | null | undefined): string {
  return getProxiedImageUrl(url, 'gallery');
}
