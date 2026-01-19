import { storage } from '../storage';
import type { FlightPackage } from '@shared/schema';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';

interface TourFeedItem {
  id: string | number;
  slug: string;
  title: string;
  summary: string;
  destination: string;
  duration: number | null;
  price_from: number | null;
  currency: string;
  image_url: string | null;
  page_url: string;
  last_updated: string;
}

interface DestinationFeedItem {
  id: string;
  slug: string;
  name: string;
  package_count: number;
  page_url: string;
  last_updated: string;
}

function parseDuration(durationStr: string | null | undefined): number | null {
  if (!durationStr) return null;
  const match = durationStr.match(/(\d+)\s*(?:nights?|days?)/i);
  return match ? parseInt(match[1], 10) : null;
}

export async function generateToursFeed(): Promise<TourFeedItem[]> {
  const items: TourFeedItem[] = [];
  
  try {
    const packages = await storage.getAllFlightPackages();
    const publishedPackages = packages.filter((p: FlightPackage) => p.isPublished);
    
    for (const pkg of publishedPackages) {
      items.push({
        id: pkg.id,
        slug: pkg.slug,
        title: pkg.title,
        summary: pkg.excerpt || pkg.description?.substring(0, 300) || '',
        destination: pkg.category || '',
        duration: parseDuration(pkg.duration),
        price_from: pkg.price || null,
        currency: pkg.currency || 'GBP',
        image_url: pkg.featuredImage || null,
        page_url: `${CANONICAL_HOST}/packages/${pkg.slug}`,
        last_updated: (pkg.updatedAt || new Date()).toISOString()
      });
    }
    
    const cachedProducts = await storage.getCachedProducts('GBP');
    for (const product of cachedProducts) {
      const keyPhotoUrl = product.keyPhoto?.originalUrl || null;
      const destination = product.googlePlace?.country || product.locationCode?.country || '';
      items.push({
        id: product.id,
        slug: product.id.toString(),
        title: product.title,
        summary: product.excerpt || '',
        destination,
        duration: null,
        price_from: product.price || null,
        currency: 'GBP',
        image_url: keyPhotoUrl,
        page_url: `${CANONICAL_HOST}/tour/${product.id}`,
        last_updated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[Feeds] Error generating tours feed:', error);
  }
  
  return items;
}

export async function generateDestinationsFeed(): Promise<DestinationFeedItem[]> {
  const items: DestinationFeedItem[] = [];
  
  try {
    const packages = await storage.getAllFlightPackages();
    const publishedPackages = packages.filter((p: FlightPackage) => p.isPublished);
    
    const destinationCounts = new Map<string, number>();
    for (const pkg of publishedPackages) {
      if (pkg.category) {
        const count = destinationCounts.get(pkg.category) || 0;
        destinationCounts.set(pkg.category, count + 1);
      }
    }
    
    const entries = Array.from(destinationCounts.entries());
    for (const [destination, count] of entries) {
      const slug = destination.toLowerCase().replace(/\s+/g, '-');
      items.push({
        id: slug,
        slug,
        name: destination,
        package_count: count,
        page_url: `${CANONICAL_HOST}/destinations/${slug}`,
        last_updated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[Feeds] Error generating destinations feed:', error);
  }
  
  return items;
}

export async function generatePackagesFeed(): Promise<TourFeedItem[]> {
  const items: TourFeedItem[] = [];
  
  try {
    const packages = await storage.getAllFlightPackages();
    const publishedPackages = packages.filter((p: FlightPackage) => p.isPublished);
    
    for (const pkg of publishedPackages) {
      items.push({
        id: pkg.id,
        slug: pkg.slug,
        title: pkg.title,
        summary: pkg.excerpt || pkg.description?.substring(0, 300) || '',
        destination: pkg.category || '',
        duration: parseDuration(pkg.duration),
        price_from: pkg.price || null,
        currency: pkg.currency || 'GBP',
        image_url: pkg.featuredImage || null,
        page_url: `${CANONICAL_HOST}/packages/${pkg.slug}`,
        last_updated: (pkg.updatedAt || new Date()).toISOString()
      });
    }
  } catch (error) {
    console.error('[Feeds] Error generating packages feed:', error);
  }
  
  return items;
}
