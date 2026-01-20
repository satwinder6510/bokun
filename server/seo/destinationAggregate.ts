import type { FlightPackage } from '@shared/schema';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';
const CONTACT_EMAIL = 'holidayenq@flightsandpackages.com';

export interface DurationBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface DestinationAggregate {
  destinationName: string;
  destinationSlug: string;
  packageCount: number;
  priceMin: number | null;
  priceMedian: number | null;
  priceMax: number | null;
  topTags: string[];
  durationBuckets: DurationBucket[];
  topDurationBuckets: string[];
  topInclusions: { name: string; frequency: number; percentage: number }[];
  topHotels: string[];
  featuredPackages: FlightPackage[];
  allPackages: FlightPackage[];
}

export function normalizeSlug(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').trim();
}

export function parseNights(durationStr: string | null | undefined): number | null {
  if (!durationStr) return null;
  const match = durationStr.match(/(\d+)\s*(?:nights?|days?)/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (durationStr.toLowerCase().includes('day') && !durationStr.toLowerCase().includes('night')) {
    return num - 1;
  }
  return num;
}

export function median(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function normalizeInclusion(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getDurationBucket(nights: number): { label: string; min: number; max: number } {
  if (nights <= 4) return { label: '1–4 nights', min: 1, max: 4 };
  if (nights <= 7) return { label: '5–7 nights', min: 5, max: 7 };
  if (nights <= 10) return { label: '8–10 nights', min: 8, max: 10 };
  if (nights <= 14) return { label: '11–14 nights', min: 11, max: 14 };
  return { label: '15+ nights', min: 15, max: 999 };
}

export function buildDestinationAggregate(
  packages: FlightPackage[],
  destinationSlug: string
): DestinationAggregate {
  const destinationPackages = packages.filter((p) =>
    p.category?.toLowerCase() === destinationSlug.toLowerCase() ||
    normalizeSlug(p.category || '') === destinationSlug.toLowerCase()
  ).filter(p => p.isPublished);

  const destinationName = destinationPackages[0]?.category ||
    destinationSlug.charAt(0).toUpperCase() + destinationSlug.slice(1).replace(/-/g, ' ');

  const prices = destinationPackages
    .map(p => p.price)
    .filter((p): p is number => p != null && p > 0);

  const tagCounts: Record<string, number> = {};
  for (const pkg of destinationPackages) {
    for (const tag of pkg.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  const durationBucketCounts: Record<string, { label: string; min: number; max: number; count: number }> = {};
  for (const pkg of destinationPackages) {
    const nights = parseNights(pkg.duration);
    if (nights != null) {
      const bucket = getDurationBucket(nights);
      if (!durationBucketCounts[bucket.label]) {
        durationBucketCounts[bucket.label] = { ...bucket, count: 0 };
      }
      durationBucketCounts[bucket.label].count++;
    }
  }
  const durationBuckets = Object.values(durationBucketCounts)
    .sort((a, b) => a.min - b.min);

  const topDurationBuckets = durationBuckets
    .filter(b => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(b => b.label);

  const inclusionCounts: Record<string, number> = {};
  for (const pkg of destinationPackages) {
    for (const item of pkg.whatsIncluded || []) {
      const normalized = normalizeInclusion(item);
      if (normalized.length > 3) {
        inclusionCounts[normalized] = (inclusionCounts[normalized] || 0) + 1;
      }
    }
  }
  const totalPackages = destinationPackages.length;
  const topInclusions = Object.entries(inclusionCounts)
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      frequency: count,
      percentage: totalPackages > 0 ? (count / totalPackages) * 100 : 0
    }))
    .filter(item => item.percentage >= 20)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  const hotelCounts: Record<string, number> = {};
  for (const pkg of destinationPackages) {
    const hotelName = pkg.accommodations?.[0]?.name;
    if (hotelName) {
      hotelCounts[hotelName] = (hotelCounts[hotelName] || 0) + 1;
    }
  }
  const topHotels = Object.entries(hotelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hotel]) => hotel);

  const featuredPackages = [...destinationPackages]
    .sort((a, b) => {
      if (a.displayOrder != null && b.displayOrder != null) {
        return a.displayOrder - b.displayOrder;
      }
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 10);

  return {
    destinationName,
    destinationSlug,
    packageCount: destinationPackages.length,
    priceMin: prices.length > 0 ? Math.min(...prices) : null,
    priceMedian: median(prices),
    priceMax: prices.length > 0 ? Math.max(...prices) : null,
    topTags,
    durationBuckets,
    topDurationBuckets,
    topInclusions,
    topHotels,
    featuredPackages,
    allPackages: destinationPackages
  };
}

export interface DestinationFaqItem {
  question: string;
  answer: string;
}

export function generateDestinationFaqs(agg: DestinationAggregate): DestinationFaqItem[] {
  const faqs: DestinationFaqItem[] = [];
  const { destinationName, packageCount, priceMin, topTags, topDurationBuckets, topInclusions, topHotels } = agg;

  faqs.push({
    question: `How many holiday packages are available to ${destinationName}?`,
    answer: `We currently have ${packageCount} holiday packages to ${destinationName} in our collection, with options for different travel styles and budgets.`
  });

  if (topDurationBuckets.length > 0) {
    const durText = topDurationBuckets.join(' or ');
    faqs.push({
      question: `How long are typical holidays to ${destinationName}?`,
      answer: `Most of our ${destinationName} holidays last ${durText}. We offer trips ranging from short breaks to extended tours to suit your schedule.`
    });
  }

  if (priceMin != null) {
    faqs.push({
      question: `What is the starting price for ${destinationName} holidays?`,
      answer: `${destinationName} holiday packages start from £${priceMin.toLocaleString()} per person. Prices vary based on departure dates, accommodation, and inclusions.`
    });
  }

  if (topTags.length > 0) {
    faqs.push({
      question: `What types of holidays to ${destinationName} do you offer?`,
      answer: `Our ${destinationName} collection includes ${topTags.slice(0, 4).join(', ')} holidays. Browse our packages to find your ideal trip.`
    });
  }

  const flightsIncluded = topInclusions.find(i => 
    i.name.toLowerCase().includes('flight') || i.name.toLowerCase().includes('return flight')
  );
  if (flightsIncluded && flightsIncluded.percentage >= 50) {
    faqs.push({
      question: `Are flights included in ${destinationName} holiday packages?`,
      answer: `Many of our ${destinationName} packages include return flights from the UK. Check individual package details for specific inclusions.`
    });
  } else {
    faqs.push({
      question: `Are flights included in ${destinationName} holiday packages?`,
      answer: `Some packages include flights while others are land-only arrangements. Each package clearly states what's included.`
    });
  }

  const transfersIncluded = topInclusions.find(i => 
    i.name.toLowerCase().includes('transfer') || i.name.toLowerCase().includes('airport')
  );
  if (transfersIncluded && transfersIncluded.percentage >= 40) {
    faqs.push({
      question: `Are airport transfers included?`,
      answer: `Many of our ${destinationName} packages include airport transfers. This is noted in the "What's Included" section of each package.`
    });
  }

  faqs.push({
    question: `Is travel insurance included in ${destinationName} holidays?`,
    answer: `Travel insurance is not included in our packages. We strongly recommend arranging comprehensive travel insurance before departure to cover cancellations, medical emergencies, and baggage.`
  });

  faqs.push({
    question: `Are there any local taxes to pay in ${destinationName}?`,
    answer: `Local city or tourist taxes may apply and are usually payable directly to your hotel upon check-in or check-out. These are not included in our package prices.`
  });

  faqs.push({
    question: `How do I receive my booking confirmation?`,
    answer: `Once your booking is processed and payment confirmed, you will receive a confirmation email to the address provided at ${CONTACT_EMAIL} with all your travel documents and vouchers.`
  });

  faqs.push({
    question: `Can I customise my ${destinationName} holiday package?`,
    answer: `Yes! Contact us at ${CONTACT_EMAIL} to tailor your holiday. We can adjust dates, upgrade accommodation, add excursions, or combine destinations.`
  });

  if (topHotels.length > 0) {
    faqs.push({
      question: `Which hotels are featured in ${destinationName} packages?`,
      answer: `Popular accommodations in our ${destinationName} collection include ${topHotels.slice(0, 3).join(', ')}. Browse packages for full hotel details and options.`
    });
  }

  faqs.push({
    question: `What is the best time to visit ${destinationName}?`,
    answer: `Our ${destinationName} packages are available throughout the year with departures to suit different seasons. Check individual package availability for specific dates.`
  });

  return faqs.slice(0, 12);
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildDestinationGuideHtml(agg: DestinationAggregate, faqs: DestinationFaqItem[]): string {
  const { destinationName, packageCount, priceMin, topTags, durationBuckets, topDurationBuckets, topInclusions, topHotels } = agg;
  
  let html = '';

  const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
  const stylesText = topTags.length > 0 ? topTags.slice(0, 4).join(', ') : 'diverse travel experiences';
  const priceText = priceMin != null ? `Prices start from £${priceMin.toLocaleString()} (GBP).` : '';
  
  html += `<section aria-label="Destination Overview">
  <p>Explore ${packageCount} ${destinationName} holiday packages, with trips commonly lasting ${durText}. Popular styles in our ${destinationName} collection include ${stylesText}. ${priceText}</p>
</section>
`;

  if (topTags.length > 0) {
    html += `<section aria-label="Popular Styles">
  <h2>Popular Holiday Styles</h2>
  <ul>
${topTags.map(tag => `    <li>${escapeHtml(tag)}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  const activeBuckets = durationBuckets.filter(b => b.count > 0);
  if (activeBuckets.length > 0) {
    html += `<section aria-label="Trip Lengths">
  <h2>Typical Trip Lengths</h2>
  <ul>
${activeBuckets.map(b => `    <li>${escapeHtml(b.label)}: ${b.count} package${b.count > 1 ? 's' : ''}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  if (topInclusions.length > 0) {
    html += `<section aria-label="Common Inclusions">
  <h2>What's Commonly Included</h2>
  <ul>
`;
    for (const inc of topInclusions) {
      const prefix = inc.percentage >= 60 ? 'Many packages include' : 'Some packages include';
      html += `    <li>${prefix} ${escapeHtml(inc.name.toLowerCase())}</li>\n`;
    }
    html += `  </ul>
</section>
`;
  }

  if (topHotels.length > 0) {
    html += `<section aria-label="Featured Accommodations">
  <h2>Where You'll Stay</h2>
  <ul>
${topHotels.map(hotel => `    <li>${escapeHtml(hotel)}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  if (faqs.length > 0) {
    html += `<section aria-label="Frequently Asked Questions">
  <h2>Frequently Asked Questions About ${escapeHtml(destinationName)} Holidays</h2>
`;
    for (const faq of faqs) {
      html += `  <details>
    <summary>${escapeHtml(faq.question)}</summary>
    <p>${escapeHtml(faq.answer)}</p>
  </details>
`;
    }
    html += `</section>
`;
  }

  return html;
}

export function buildDestinationPackageListHtml(agg: DestinationAggregate): string {
  const { destinationName, destinationSlug, featuredPackages } = agg;
  
  if (featuredPackages.length === 0) return '';

  const packageLinks = featuredPackages.map((p) => {
    const url = `${CANONICAL_HOST}/Holidays/${destinationSlug.toLowerCase()}/${p.slug}`;
    const priceText = p.price ? `From £${p.price.toLocaleString()}` : 'Price on request';
    return `    <li><a href="${url}">${escapeHtml(p.title)}</a> - ${priceText}</li>`;
  }).join('\n');

  return `<section aria-label="Available Packages">
  <h2>Holiday Packages to ${escapeHtml(destinationName)}</h2>
  <ul>
${packageLinks}
  </ul>
</section>
`;
}

export function buildDestinationBreadcrumbHtml(agg: DestinationAggregate): string {
  const { destinationName, destinationSlug } = agg;
  return `<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="${CANONICAL_HOST}/">Home</a></li>
    <li><a href="${CANONICAL_HOST}/destinations">Destinations</a></li>
    <li>${escapeHtml(destinationName)}</li>
  </ol>
</nav>
`;
}

export function buildDestinationNoscriptHtml(agg: DestinationAggregate): string {
  const { destinationName, destinationSlug, packageCount, priceMin, topTags, topDurationBuckets, featuredPackages } = agg;
  
  const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
  const stylesText = topTags.length > 0 ? topTags.slice(0, 3).join(', ') : '';
  const priceText = priceMin != null ? ` Prices start from £${priceMin.toLocaleString()}.` : '';

  let html = `<article itemscope itemtype="https://schema.org/TouristDestination">
  <h1 itemprop="name">${escapeHtml(destinationName)} Holidays</h1>
  <p itemprop="description">Explore ${packageCount} ${escapeHtml(destinationName)} packages${stylesText ? ` including ${stylesText}` : ''}, with trips lasting ${durText}.${priceText}</p>
`;

  if (featuredPackages.length > 0) {
    html += `  <h2>Featured Packages</h2>
  <ul>
`;
    for (const pkg of featuredPackages.slice(0, 5)) {
      const url = `${CANONICAL_HOST}/Holidays/${destinationSlug.toLowerCase()}/${pkg.slug}`;
      html += `    <li><a href="${url}">${escapeHtml(pkg.title)}</a></li>\n`;
    }
    html += `  </ul>
`;
  }

  html += `  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/destinations">Destinations</a></li>
      <li>${escapeHtml(destinationName)}</li>
    </ol>
  </nav>
</article>
`;

  return html;
}

export function generateDestinationMetaFallback(agg: DestinationAggregate): { title: string; description: string } {
  const { destinationName, packageCount, priceMin, topTags, topDurationBuckets } = agg;

  const title = `${destinationName} Holidays & Packages | Flights and Packages`;

  const tagText = topTags.length > 0 ? ` including ${topTags.slice(0, 2).join(' and ')}` : '';
  const durationText = topDurationBuckets.length > 0 ? ` Trips last ${topDurationBuckets[0]}.` : '';
  const priceText = priceMin != null ? ` From £${priceMin.toLocaleString()}.` : '';
  
  const description = `Explore ${packageCount} ${destinationName} holiday packages${tagText}.${durationText}${priceText} Book with Flights and Packages.`;

  return { title, description };
}

export function generateDestinationItemListJsonLd(agg: DestinationAggregate): object {
  const { destinationSlug, featuredPackages } = agg;
  
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${agg.destinationName} Holiday Packages`,
    "numberOfItems": featuredPackages.length,
    "itemListElement": featuredPackages.map((pkg, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "TouristTrip",
        "name": pkg.title,
        "url": `${CANONICAL_HOST}/Holidays/${destinationSlug.toLowerCase()}/${pkg.slug}`,
        "touristType": "Leisure",
        ...(pkg.price ? {
          "offers": {
            "@type": "Offer",
            "price": pkg.price,
            "priceCurrency": "GBP",
            "availability": "https://schema.org/InStock"
          }
        } : {})
      }
    }))
  };
}

export function generateEnhancedDestinationJsonLd(agg: DestinationAggregate, path: string): object {
  const { destinationName, packageCount, priceMin, topTags, topDurationBuckets } = agg;
  
  const tagText = topTags.length > 0 ? ` including ${topTags.slice(0, 3).join(', ')}` : '';
  const durationText = topDurationBuckets.length > 0 ? ` Trips commonly last ${topDurationBuckets.join(' or ')}.` : '';
  const priceText = priceMin != null ? ` Prices start from £${priceMin.toLocaleString()} per person.` : '';
  
  const description = `Explore ${packageCount} ${destinationName} holiday packages${tagText}.${durationText}${priceText}`;

  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    "name": destinationName,
    "description": description,
    "url": `${CANONICAL_HOST}${path}`,
    "containedInPlace": {
      "@type": "Country",
      "name": destinationName
    }
  };
}
