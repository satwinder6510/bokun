import type { ImageVariant } from './media';

// Image size presets for different contexts
const IMAGE_SIZES = {
  thumb: { width: 400, quality: 70 },
  card: { width: 800, quality: 75 },
  gallery: { width: 1280, quality: 80 },
  hero: { width: 1600, quality: 80 },
} as const;

/**
 * Gets an optimized image URL for Bokun S3 images.
 * Routes through the server-side image proxy for resizing and WebP conversion.
 */
function getOptimizedBokunUrl(url: string, size: keyof typeof IMAGE_SIZES): string {
  const { width, quality } = IMAGE_SIZES[size];
  return `/api/image-proxy?url=${encodeURIComponent(url)}&w=${width}&q=${quality}&format=webp`;
}

/**
 * Gets a proxied/optimized image URL.
 * 
 * For internal media (/api/media/slug/variant), automatically converts to the specified variant.
 * For Bokun S3 images, routes through the image-proxy endpoint with resizing.
 * For other external images needing CORS proxy, routes through the image-proxy endpoint.
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

  // Bokun S3 images - optimize through proxy with resizing
  // Covers all Bokun bucket variants: bokun.s3, bokun-images.s3, bokun-images-eu-west-1.s3, etc.
  if (url.includes('bokun') && url.includes('s3.amazonaws.com')) {
    const size = variant === 'hero' ? 'hero' : 
                 variant === 'gallery' ? 'gallery' : 
                 variant === 'thumb' ? 'thumb' : 'card';
    return getOptimizedBokunUrl(url, size);
  }

  // External images that need CORS proxy
  if (url.includes('admin.citiesandbeaches.com') || url.includes('citiesandbeaches.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }

  // Other external images (Unsplash) typically have proper CORS and built-in optimization
  return url;
}

/**
 * Gets an image URL optimized for hero sections (1600px width, WebP).
 * This is specifically optimized for LCP - uses aggressive compression.
 */
export function getHeroImageUrl(url: string | null | undefined): string {
  if (!url) {
    return "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280&q=70&auto=format";
  }
  
  // Bokun S3 images need server-side optimization
  if (url.includes('bokun') && url.includes('s3.amazonaws.com')) {
    return getOptimizedBokunUrl(url, 'hero');
  }
  
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
