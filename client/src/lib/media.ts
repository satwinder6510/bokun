/**
 * Media Utilities
 * 
 * Provides helper functions for working with media assets,
 * including automatic variant selection based on usage context.
 */

export type ImageVariant = 'thumb' | 'card' | 'hero' | 'gallery';

/**
 * Variant dimensions for reference:
 * - thumb: 400px width (thumbnails, small previews)
 * - card: 800px width (package/tour cards)
 * - hero: 1920px width (hero sections, full-width banners)
 * - gallery: 1280px width (lightbox galleries, detail images)
 */

/**
 * Converts a media URL to use a specific variant.
 * Works with internal media API URLs (/api/media/slug/variant).
 * External URLs (unsplash, pexels, etc.) are returned unchanged.
 * 
 * @param url - Original image URL
 * @param variant - Desired variant (thumb, card, hero, gallery)
 * @returns URL with the specified variant
 */
export function getMediaVariant(url: string | null | undefined, variant: ImageVariant): string {
  if (!url) return '';
  
  // Check if it's an internal media API URL
  const mediaApiPattern = /^\/api\/media\/([^/]+)\/(thumb|card|hero|gallery)$/;
  const match = url.match(mediaApiPattern);
  
  if (match) {
    const slug = match[1];
    return `/api/media/${slug}/${variant}`;
  }
  
  // For external URLs or other formats, return as-is
  return url;
}

/**
 * Gets the appropriate image URL for a hero section.
 * Uses the 'hero' variant (1920px) for internal media.
 */
export function getHeroImage(url: string | null | undefined): string {
  return getMediaVariant(url, 'hero');
}

/**
 * Gets the appropriate image URL for a card display.
 * Uses the 'card' variant (800px) for internal media.
 */
export function getCardImage(url: string | null | undefined): string {
  return getMediaVariant(url, 'card');
}

/**
 * Gets the appropriate image URL for a thumbnail.
 * Uses the 'thumb' variant (400px) for internal media.
 */
export function getThumbImage(url: string | null | undefined): string {
  return getMediaVariant(url, 'thumb');
}

/**
 * Gets the appropriate image URL for a gallery/lightbox.
 * Uses the 'gallery' variant (1280px) for internal media.
 */
export function getGalleryImage(url: string | null | undefined): string {
  return getMediaVariant(url, 'gallery');
}
