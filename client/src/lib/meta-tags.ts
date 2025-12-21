const BASE_URL = 'https://tours.flightsandpackages.com';
const DEFAULT_OG_IMAGE = 'https://tours.flightsandpackages.com/og-image.jpg';

export function setMetaTags(
  title: string, 
  description: string, 
  ogImage?: string,
  options?: {
    type?: 'website' | 'article' | 'product';
    noIndex?: boolean;
  }
) {
  // Update title
  document.title = title;

  // Update/create meta description
  let descMeta = document.querySelector('meta[name="description"]');
  if (!descMeta) {
    descMeta = document.createElement('meta');
    descMeta.setAttribute('name', 'description');
    document.head.appendChild(descMeta);
  }
  descMeta.setAttribute('content', description);

  // Update/create canonical link (preserve case for route consistency)
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  const canonicalUrl = BASE_URL + window.location.pathname;
  canonical.setAttribute('href', canonicalUrl);

  // Handle robots meta for noIndex pages
  if (options?.noIndex) {
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow');
  }

  // Update/create Open Graph tags
  updateOGTag('og:type', options?.type || 'website');
  updateOGTag('og:title', title);
  updateOGTag('og:description', description);
  updateOGTag('og:image', ogImage || DEFAULT_OG_IMAGE);
  updateOGTag('og:url', canonicalUrl);
  updateOGTag('og:site_name', 'Flights and Packages');

  // Add Twitter Card tags
  updateMetaTag('twitter:card', 'summary_large_image');
  updateMetaTag('twitter:title', title);
  updateMetaTag('twitter:description', description);
  updateMetaTag('twitter:image', ogImage || DEFAULT_OG_IMAGE);
}

function updateOGTag(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function updateMetaTag(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

// Store schemas to allow multiple
let currentSchemas: object[] = [];

function stripContext(schema: object): object {
  const { "@context": _, ...rest } = schema as { "@context"?: string; [key: string]: unknown };
  return rest;
}

export function addJsonLD(schema: object | object[], replace: boolean = true) {
  if (replace) {
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());
    currentSchemas = [];
  }
  
  const schemas = Array.isArray(schema) ? schema : [schema];
  currentSchemas.push(...schemas);
  
  // When combining multiple schemas, use @graph with single @context at root
  // Strip @context from individual nodes to avoid invalid JSON-LD
  const combinedSchema = currentSchemas.length === 1 
    ? currentSchemas[0] 
    : { 
        "@context": "https://schema.org", 
        "@graph": currentSchemas.map(stripContext) 
      };
  
  const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
  existingScripts.forEach(script => script.remove());
  
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(combinedSchema);
  document.head.appendChild(script);
}

// Generate breadcrumb schema
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith('http') ? item.url : BASE_URL + item.url
    }))
  };
}

// Generate organization schema (for homepage/all pages)
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "name": "Flights and Packages",
    "url": BASE_URL,
    "logo": BASE_URL + "/logo.png",
    "description": "Book 700+ unique tours worldwide with Flights and Packages. Flight-inclusive holiday packages to destinations across the globe.",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+44-7342-788278",
      "contactType": "customer service",
      "areaServed": "GB",
      "availableLanguage": "English"
    },
    "sameAs": []
  };
}

// Generate product/tour schema
export function generateTourSchema(tour: {
  name: string;
  description: string;
  image: string;
  price?: number;
  currency?: string;
  duration?: string;
  destination?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "name": tour.name,
    "description": tour.description,
    "image": tour.image,
    "url": tour.url.startsWith('http') ? tour.url : BASE_URL + tour.url,
    ...(tour.destination && {
      "touristType": "Holidaymaker",
      "itinerary": {
        "@type": "ItemList",
        "itemListElement": [{
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "Place",
            "name": tour.destination
          }
        }]
      }
    }),
    ...(tour.price && {
      "offers": {
        "@type": "Offer",
        "price": tour.price,
        "priceCurrency": tour.currency || "GBP",
        "availability": "https://schema.org/InStock",
        "validFrom": new Date().toISOString().split('T')[0]
      }
    }),
    ...(tour.duration && {
      "duration": tour.duration
    }),
    "provider": {
      "@type": "TravelAgency",
      "name": "Flights and Packages",
      "url": BASE_URL
    }
  };
}

// Generate article schema for blog posts
export function generateArticleSchema(article: {
  title: string;
  description: string;
  image?: string;
  author: string;
  publishedAt: string;
  modifiedAt?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "image": article.image || DEFAULT_OG_IMAGE,
    "author": {
      "@type": "Person",
      "name": article.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "Flights and Packages",
      "logo": {
        "@type": "ImageObject",
        "url": BASE_URL + "/logo.png"
      }
    },
    "datePublished": article.publishedAt,
    "dateModified": article.modifiedAt || article.publishedAt,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": article.url.startsWith('http') ? article.url : BASE_URL + article.url
    }
  };
}

// Generate FAQ schema
export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}
