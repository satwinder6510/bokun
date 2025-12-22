import { useEffect, useRef } from "react";
import { captureScrollDepth } from "@/lib/posthog";

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
  | 'other';

interface UseScrollDepthOptions {
  pageType: PageType;
  properties?: Record<string, unknown>;
  thresholds?: number[];
}

export function useScrollDepth({
  pageType,
  properties,
  thresholds = [25, 50, 75, 100]
}: UseScrollDepthOptions): void {
  const trackedThresholds = useRef<Set<number>>(new Set());
  const propertiesRef = useRef(properties);
  const thresholdsRef = useRef(thresholds);

  // Update refs when values change
  propertiesRef.current = properties;
  thresholdsRef.current = thresholds;

  // Only reset and re-attach when pageType changes (i.e., navigating to a new page)
  useEffect(() => {
    trackedThresholds.current = new Set();

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      if (docHeight <= 0) return;
      
      const scrollPercent = Math.round((scrollTop / docHeight) * 100);

      for (const threshold of thresholdsRef.current) {
        if (scrollPercent >= threshold && !trackedThresholds.current.has(threshold)) {
          trackedThresholds.current.add(threshold);
          captureScrollDepth(threshold, pageType, propertiesRef.current);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pageType]);
}
