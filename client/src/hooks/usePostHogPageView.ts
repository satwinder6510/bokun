import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { capturePageView } from '@/lib/posthog';

type PageType = 
  | 'homepage'
  | 'packages_list'
  | 'package_detail'
  | 'tour_detail'
  | 'tours_list'
  | 'destination'
  | 'destinations_list'
  | 'collection'
  | 'collections_list'
  | 'blog'
  | 'blog_post'
  | 'contact'
  | 'faq'
  | 'terms'
  | 'special_offers'
  | 'checkout'
  | 'booking_confirmation'
  | 'other';

function getPageTypeFromPath(pathname: string): PageType {
  if (pathname === '/') return 'homepage';
  if (pathname === '/tours') return 'tours_list';
  if (pathname.startsWith('/tour/')) return 'tour_detail';
  if (pathname === '/packages') return 'packages_list';
  if (pathname.startsWith('/packages/')) return 'package_detail';
  if (pathname === '/special-offers') return 'special_offers';
  if (pathname === '/checkout') return 'checkout';
  if (pathname.startsWith('/booking/')) return 'booking_confirmation';
  if (pathname === '/terms') return 'terms';
  if (pathname === '/contact') return 'contact';
  if (pathname === '/faq') return 'faq';
  if (pathname === '/blog') return 'blog';
  if (pathname.startsWith('/blog/')) return 'blog_post';
  if (pathname === '/holidays') return 'collections_list';
  if (pathname.match(/^\/holidays\/[^/]+$/)) return 'collection';
  if (pathname === '/destinations' || pathname === '/Holidays') return 'destinations_list';
  if (pathname.match(/^\/destinations\/[^/]+$/) || pathname.match(/^\/Holidays\/[^/]+$/)) return 'destination';
  if (pathname.match(/^\/Holidays\/[^/]+\/[^/]+$/)) return 'package_detail';
  return 'other';
}

function extractPageProperties(pathname: string): Record<string, string | undefined> {
  const properties: Record<string, string | undefined> = {};
  
  const tourMatch = pathname.match(/^\/tour\/(\d+)/);
  if (tourMatch) {
    properties.tour_id = tourMatch[1];
  }
  
  const packageSlugMatch = pathname.match(/^\/packages\/([^/]+)$/);
  if (packageSlugMatch) {
    properties.package_slug = packageSlugMatch[1];
  }
  
  const holidayPackageMatch = pathname.match(/^\/Holidays\/([^/]+)\/([^/]+)$/);
  if (holidayPackageMatch) {
    properties.country = holidayPackageMatch[1];
    properties.package_slug = holidayPackageMatch[2];
  }
  
  const destinationMatch = pathname.match(/^\/(?:destinations|Holidays)\/([^/]+)$/);
  if (destinationMatch) {
    properties.destination = destinationMatch[1];
  }
  
  const collectionMatch = pathname.match(/^\/holidays\/([^/]+)$/);
  if (collectionMatch) {
    properties.collection_tag = collectionMatch[1];
  }
  
  const blogPostMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogPostMatch) {
    properties.blog_slug = blogPostMatch[1];
  }
  
  return properties;
}

export function usePostHogPageView(): void {
  const [location] = useLocation();
  const previousLocation = useRef<string | null>(null);
  
  useEffect(() => {
    if (location.startsWith('/admin') || location.startsWith('/preview') || location.startsWith('/login')) {
      return;
    }
    
    if (previousLocation.current !== location) {
      const pageType = getPageTypeFromPath(location);
      const properties = extractPageProperties(location);
      
      capturePageView(pageType as Parameters<typeof capturePageView>[0], {
        ...properties,
        previous_page: previousLocation.current || undefined,
      });
      
      previousLocation.current = location;
    }
  }, [location]);
}

export default usePostHogPageView;
