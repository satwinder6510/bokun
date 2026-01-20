import { getCanonicalUrl } from './canonical';

interface MetaData {
  title: string;
  description: string;
  image?: string;
  type?: string;
  path: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateMetaTags(data: MetaData): string {
  const canonicalUrl = getCanonicalUrl(data.path);
  const safeTitle = escapeHtml(data.title);
  const safeDescription = escapeHtml(data.description);
  const ogType = data.type || 'website';
  
  let tags = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${canonicalUrl}" />
    
    <!-- Open Graph -->
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="Flights and Packages" />`;
  
  if (data.image) {
    const safeImage = escapeHtml(data.image);
    tags += `
    <meta property="og:image" content="${safeImage}" />
    <meta name="twitter:image" content="${safeImage}" />`;
  }
  
  tags += `
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />`;
  
  return tags;
}

export function generateTourMeta(tour: {
  title: string;
  excerpt?: string;
  description?: string;
  keyPhoto?: string;
  destination?: string;
  duration?: number;
}, path: string): string {
  const description = tour.excerpt || tour.description?.substring(0, 160) || 
    `Discover ${tour.title}${tour.destination ? ` in ${tour.destination}` : ''}${tour.duration ? ` - ${tour.duration} days` : ''}.`;
  
  return generateMetaTags({
    title: `${tour.title} | Flights and Packages`,
    description,
    image: tour.keyPhoto,
    type: 'product',
    path
  });
}

export function generateDestinationMeta(destination: {
  name: string;
  description?: string;
  image?: string;
  packageCount?: number;
}, path: string): string {
  const description = destination.description?.substring(0, 160) || 
    `Explore our ${destination.packageCount || ''} holiday packages to ${destination.name}. Find the perfect tour with Flights and Packages.`;
  
  return generateMetaTags({
    title: `${destination.name} Holidays | Flights and Packages`,
    description,
    image: destination.image,
    type: 'website',
    path
  });
}

// Generate noindex meta tag for pages that shouldn't be indexed
export function generateNoIndexMeta(title: string, description: string, path: string): string {
  const canonicalUrl = getCanonicalUrl(path);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  
  return `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="noindex, follow" />`;
}

// Check if a URL should be noindexed
export function shouldNoIndex(path: string, queryString?: string): boolean {
  const noIndexPaths = ['/ai-search', '/checkout', '/admin', '/2fa-setup'];
  
  // Check path-based noindex
  if (noIndexPaths.some(p => path.startsWith(p))) {
    return true;
  }
  
  // Check for heavy query params that indicate non-indexable content
  if (queryString) {
    const heavyParams = ['utm_', 'fbclid', 'gclid', 'ref=', 'source=', 'campaign='];
    if (heavyParams.some(p => queryString.includes(p))) {
      return true;
    }
  }
  
  return false;
}
