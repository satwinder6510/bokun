import { getCanonicalUrl } from './canonical';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';

interface TourData {
  id: number | string;
  title: string;
  description?: string;
  excerpt?: string;
  destination?: string;
  duration?: number;
  priceFrom?: number;
  currency?: string;
  keyPhoto?: string;
  highlights?: string[];
  itinerary?: any[];
}

interface DestinationData {
  name: string;
  description?: string;
  image?: string;
  packageCount?: number;
}

function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function generateTourJsonLd(tour: TourData, path: string): string {
  const canonicalUrl = getCanonicalUrl(path);
  const description = tour.excerpt || tour.description?.substring(0, 500) || '';
  
  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "name": tour.title,
    "description": escapeJsonString(description),
    "url": canonicalUrl,
    "provider": {
      "@type": "TravelAgency",
      "name": "Flights and Packages",
      "url": CANONICAL_HOST
    }
  };
  
  if (tour.destination) {
    jsonLd.touristType = tour.destination;
    jsonLd.itinerary = {
      "@type": "ItemList",
      "name": `${tour.title} Itinerary`,
      "itemListElement": tour.itinerary?.map((day: any, index: number) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": day.title || `Day ${index + 1}`,
        "description": day.description || ''
      })) || []
    };
  }
  
  if (tour.keyPhoto) {
    jsonLd.image = tour.keyPhoto;
  }
  
  if (tour.priceFrom && tour.priceFrom > 0) {
    jsonLd.offers = {
      "@type": "Offer",
      "price": tour.priceFrom,
      "priceCurrency": tour.currency || "GBP",
      "availability": "https://schema.org/InStock"
    };
  }
  
  if (tour.duration) {
    jsonLd.duration = `P${tour.duration}D`;
  }
  
  return `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 0)}</script>`;
}

export function generateDestinationJsonLd(destination: DestinationData, path: string): string {
  const canonicalUrl = getCanonicalUrl(path);
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    "name": destination.name,
    "description": destination.description || `Explore holiday packages to ${destination.name}`,
    "url": canonicalUrl,
    "containedInPlace": {
      "@type": "Country",
      "name": destination.name
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${canonicalUrl}?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
  
  return `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 0)}</script>`;
}

export function generateBreadcrumbJsonLd(items: { name: string; url: string }[]): string {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
  
  return `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 0)}</script>`;
}

export function generateOrganizationJsonLd(): string {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "name": "Flights and Packages",
    "url": CANONICAL_HOST,
    "logo": `${CANONICAL_HOST}/favicon.png`,
    "sameAs": [],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+44-XXX-XXX-XXXX",
      "contactType": "customer service"
    }
  };
  
  return `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 0)}</script>`;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function generateFaqPageJsonLd(faqs: FaqItem[]): string {
  if (!faqs || faqs.length === 0) return '';
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer.replace(/<[^>]*>/g, '').trim()
      }
    }))
  };
  
  return `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 0)}</script>`;
}
