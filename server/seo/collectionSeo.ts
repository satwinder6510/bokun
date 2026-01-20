import type { FlightPackage } from '@shared/schema';
import { parseNights, median } from './destinationAggregate';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';
const CONTACT_EMAIL = 'holidayenq@flightsandpackages.com';

export interface CollectionConfig {
  slug: string;
  name: string;
  h1: string;
  metaTitleSuffix: string;
  keywords: string[];
  tagMatches: string[];
  titleMatches: string[];
  featuredLimit: number;
}

export const COLLECTION_CONFIGS: Record<string, CollectionConfig> = {
  'river-cruises': {
    slug: 'river-cruises',
    name: 'River Cruises',
    h1: 'River Cruises',
    metaTitleSuffix: 'River Cruise Packages from the UK',
    keywords: ['river cruise', 'river cruises', 'river cruise packages'],
    tagMatches: ['river cruise', 'river-cruise', 'river cruises'],
    titleMatches: ['river cruise'],
    featuredLimit: 12
  },
  'twin-centre': {
    slug: 'twin-centre',
    name: 'Twin-Centre Holidays',
    h1: 'Twin-Centre Holidays',
    metaTitleSuffix: 'Twin-Centre Holiday Packages from the UK',
    keywords: ['twin-centre', 'twin centre', 'twin-centre holidays', 'two-centre'],
    tagMatches: ['twin-centre', 'twin centre', 'two-centre', 'two centre', 'twin city'],
    titleMatches: ['twin-centre', 'twin centre', 'two-centre', 'two centre'],
    featuredLimit: 12
  },
  'golden-triangle': {
    slug: 'golden-triangle',
    name: 'Golden Triangle Tours',
    h1: 'Golden Triangle Tours',
    metaTitleSuffix: 'Golden Triangle Tour Packages from the UK',
    keywords: ['golden triangle', 'golden triangle tours', 'golden triangle india'],
    tagMatches: ['golden triangle'],
    titleMatches: ['golden triangle'],
    featuredLimit: 12
  },
  'multi-centre': {
    slug: 'multi-centre',
    name: 'Multi-Centre Holidays',
    h1: 'Multi-Centre Holidays',
    metaTitleSuffix: 'Multi-Centre Holiday Packages from the UK',
    keywords: ['multi-centre', 'multi centre', 'multi-centre holidays', 'multi-destination'],
    tagMatches: ['multi-centre', 'multi centre', 'multi-destination', 'multi destination'],
    titleMatches: ['multi-centre', 'multi centre', 'multi-destination'],
    featuredLimit: 12
  },
  'solo-travel': {
    slug: 'solo-travel',
    name: 'Solo Travel',
    h1: 'Solo Travel Holidays',
    metaTitleSuffix: 'Solo Travel Packages from the UK',
    keywords: ['solo travel', 'solo traveller', 'solo holidays', 'travelling alone'],
    tagMatches: ['solo', 'solo travel', 'solo traveller', 'solo travellers', 'singles'],
    titleMatches: ['solo'],
    featuredLimit: 12
  }
};

export function isConfiguredCollection(slug: string): boolean {
  return slug in COLLECTION_CONFIGS;
}

export function getCollectionConfig(slug: string): CollectionConfig | null {
  return COLLECTION_CONFIGS[slug] || null;
}

export interface CollectionAggregate {
  config: CollectionConfig;
  packageCount: number;
  priceMin: number | null;
  priceMedian: number | null;
  priceMax: number | null;
  topTags: string[];
  durationBuckets: { label: string; min: number; max: number; count: number }[];
  topDurationBuckets: string[];
  topInclusions: { name: string; frequency: number; percentage: number }[];
  topDestinations: { name: string; slug: string; count: number }[];
  featuredPackages: FlightPackage[];
  allPackages: FlightPackage[];
}

export interface CollectionFaqItem {
  question: string;
  answer: string;
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

function normalizeSlug(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').trim();
}

export function isPackageInCollection(pkg: FlightPackage, config: CollectionConfig): boolean {
  const tags = (pkg.tags || []).map(t => t.toLowerCase());
  const title = (pkg.title || '').toLowerCase();
  const description = (pkg.description || '').toLowerCase();
  
  const hasMatchingTag = config.tagMatches.some(match => 
    tags.some(tag => tag.includes(match.toLowerCase()))
  );
  
  const hasMatchingTitle = config.titleMatches.some(match =>
    title.includes(match.toLowerCase())
  );
  
  const hasMatchingDescription = config.titleMatches.some(match =>
    description.includes(match.toLowerCase())
  );
  
  return hasMatchingTag || hasMatchingTitle || hasMatchingDescription;
}

export function buildCollectionAggregate(packages: FlightPackage[], config: CollectionConfig): CollectionAggregate {
  const collectionPackages = packages
    .filter(p => p.isPublished)
    .filter(p => isPackageInCollection(p, config));

  const prices = collectionPackages
    .map(p => p.price)
    .filter((p): p is number => p != null && p > 0);

  const tagCounts: Record<string, number> = {};
  for (const pkg of collectionPackages) {
    for (const tag of pkg.tags || []) {
      const tagLower = tag.toLowerCase();
      const isCollectionTag = config.tagMatches.some(m => tagLower.includes(m.toLowerCase()));
      if (!isCollectionTag) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  const durationBucketCounts: Record<string, { label: string; min: number; max: number; count: number }> = {};
  for (const pkg of collectionPackages) {
    const nights = parseNights(pkg.duration);
    if (nights != null) {
      const bucket = getDurationBucket(nights);
      if (!durationBucketCounts[bucket.label]) {
        durationBucketCounts[bucket.label] = { ...bucket, count: 0 };
      }
      durationBucketCounts[bucket.label].count++;
    }
  }
  const durationBuckets = Object.values(durationBucketCounts).sort((a, b) => a.min - b.min);

  const topDurationBuckets = durationBuckets
    .filter(b => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(b => b.label);

  const inclusionCounts: Record<string, number> = {};
  for (const pkg of collectionPackages) {
    for (const item of pkg.whatsIncluded || []) {
      const normalized = normalizeInclusion(item);
      if (normalized.length > 3) {
        inclusionCounts[normalized] = (inclusionCounts[normalized] || 0) + 1;
      }
    }
  }
  const totalPackages = collectionPackages.length;
  const topInclusions = Object.entries(inclusionCounts)
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      frequency: count,
      percentage: totalPackages > 0 ? (count / totalPackages) * 100 : 0
    }))
    .filter(item => item.percentage >= 15)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  const destinationCounts: Record<string, number> = {};
  for (const pkg of collectionPackages) {
    if (pkg.category) {
      destinationCounts[pkg.category] = (destinationCounts[pkg.category] || 0) + 1;
    }
  }
  const topDestinations = Object.entries(destinationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      slug: normalizeSlug(name),
      count
    }));

  const featuredPackages = [...collectionPackages]
    .sort((a, b) => {
      if (a.displayOrder != null && b.displayOrder != null) {
        return a.displayOrder - b.displayOrder;
      }
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, config.featuredLimit);

  return {
    config,
    packageCount: collectionPackages.length,
    priceMin: prices.length > 0 ? Math.min(...prices) : null,
    priceMedian: median(prices),
    priceMax: prices.length > 0 ? Math.max(...prices) : null,
    topTags,
    durationBuckets,
    topDurationBuckets,
    topInclusions,
    topDestinations,
    featuredPackages,
    allPackages: collectionPackages
  };
}

export function generateCollectionFaqs(agg: CollectionAggregate): CollectionFaqItem[] {
  const faqs: CollectionFaqItem[] = [];
  const { config, packageCount, priceMin, topTags, topDurationBuckets, topInclusions, topDestinations } = agg;
  const name = config.name;
  const nameLower = name.toLowerCase();

  faqs.push({
    question: `What's included in your ${nameLower} packages from the UK?`,
    answer: `Our ${nameLower} packages typically include return flights from UK airports, accommodation, and transfers between destinations. ${topInclusions.length > 0 ? `Common inclusions are: ${topInclusions.slice(0, 5).map(i => i.name.toLowerCase()).join(', ')}.` : ''} Each package clearly lists all inclusions.`
  });

  faqs.push({
    question: `Do your ${nameLower} include flights from the UK?`,
    answer: `Yes, most of our ${nameLower} packages include return flights from UK airports. Check individual package details for specific flight inclusions and departure airports available.`
  });

  if (topDurationBuckets.length > 0) {
    const durText = topDurationBuckets.join(' or ');
    faqs.push({
      question: `How long are your ${nameLower} typically?`,
      answer: `Most of our ${nameLower} last ${durText}. We offer trips ranging from short breaks to extended adventures to suit your schedule.`
    });
  }

  if (priceMin != null) {
    faqs.push({
      question: `What is the starting price for ${nameLower}?`,
      answer: `${name} packages start from £${priceMin.toLocaleString()} per person. Prices vary based on departure dates, accommodation choices, and package inclusions.`
    });
  }

  if (topDestinations.length > 0) {
    const destText = topDestinations.slice(0, 4).map(d => d.name).join(', ');
    faqs.push({
      question: `Which destinations do your ${nameLower} cover?`,
      answer: `Our ${nameLower} collection features trips to ${destText} and more. Browse our packages to explore different destinations and itineraries.`
    });
  }

  faqs.push({
    question: `Can I customise a ${nameLower.replace(/s$/, '')} package?`,
    answer: `Absolutely! We can tailor any ${nameLower.replace(/s$/, '')} to your preferences. Contact us at ${CONTACT_EMAIL} to adjust dates, upgrade hotels, add excursions, or create a bespoke itinerary.`
  });

  faqs.push({
    question: `Do I need travel insurance for ${nameLower}?`,
    answer: `Travel insurance is not included in our packages but is strongly recommended. We advise comprehensive coverage for cancellations, medical emergencies, and trip interruption.`
  });

  faqs.push({
    question: `How do I book and get confirmation?`,
    answer: `To book, complete our enquiry form or email ${CONTACT_EMAIL}. Once your booking is confirmed and payment received, you'll receive all travel documents and vouchers by email.`
  });

  if (topTags.length > 0) {
    faqs.push({
      question: `What types of ${nameLower} do you offer?`,
      answer: `Our ${nameLower} collection includes ${topTags.slice(0, 5).join(', ')} themed trips. Browse our packages to find the perfect experience for you.`
    });
  }

  faqs.push({
    question: `Are ${nameLower} suitable for families?`,
    answer: `Many of our ${nameLower} are perfect for families. Contact us to discuss family-friendly options, child pricing, and connecting room arrangements.`
  });

  faqs.push({
    question: `What is the best time to book ${nameLower}?`,
    answer: `We recommend booking 3-6 months in advance for the best availability and prices. Peak seasons fill up quickly, so early booking is advisable.`
  });

  faqs.push({
    question: `Are airport transfers included?`,
    answer: `Many of our ${nameLower} packages include airport transfers for a seamless experience. This is noted in each package's "What's Included" section.`
  });

  faqs.push({
    question: `How do I contact you about ${nameLower}?`,
    answer: `For any questions about our ${nameLower} packages, email ${CONTACT_EMAIL} or use our online enquiry form. Our travel experts are happy to help.`
  });

  return faqs.slice(0, 14);
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

export function buildCollectionOverview(agg: CollectionAggregate): string {
  const { config, packageCount, priceMin, priceMedian, topTags, topDurationBuckets, topDestinations } = agg;
  const name = config.name.toLowerCase();
  const keyword = config.keywords[0];
  
  const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
  const stylesText = topTags.length > 0 ? topTags.slice(0, 3).join(', ') : 'diverse experiences';
  const destText = topDestinations.length > 0 ? topDestinations.slice(0, 3).map(d => d.name).join(', ') : 'worldwide destinations';
  
  let overview = `Explore ${packageCount} ${keyword} packages from the UK, `;
  overview += `offering unforgettable ${name} to ${destText} and beyond. `;
  overview += `Typical trip lengths include ${durText}, `;
  overview += `with popular themes featuring ${stylesText}. `;
  
  if (priceMin != null) {
    overview += `Prices start from £${priceMin.toLocaleString()}`;
    if (priceMedian != null && priceMedian !== priceMin) {
      overview += ` with a median price of £${priceMedian.toLocaleString()}`;
    }
    overview += `. `;
  }
  
  overview += `For bespoke ${keyword} packages from the UK, contact ${CONTACT_EMAIL}.`;
  
  return overview;
}

export function buildCollectionGuideHtml(agg: CollectionAggregate, faqs: CollectionFaqItem[]): string {
  const { config, topTags, durationBuckets, topInclusions, topDestinations, featuredPackages } = agg;
  
  let html = '';

  const overview = buildCollectionOverview(agg);
  html += `<section aria-label="${config.name} Overview">
  <p>${escapeHtml(overview)}</p>
</section>
`;

  if (topTags.length > 0) {
    html += `<section aria-label="Popular ${config.name} Styles">
  <h2>Popular ${escapeHtml(config.name)} Styles</h2>
  <ul>
${topTags.map(tag => `    <li>${escapeHtml(tag)}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  const activeBuckets = durationBuckets.filter(b => b.count > 0);
  if (activeBuckets.length > 0) {
    html += `<section aria-label="${config.name} Trip Lengths">
  <h2>Typical Trip Lengths</h2>
  <ul>
${activeBuckets.map(b => `    <li>${escapeHtml(b.label)}: ${b.count} package${b.count > 1 ? 's' : ''}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  if (topInclusions.length > 0) {
    html += `<section aria-label="What's Included">
  <h2>What's Commonly Included</h2>
  <ul>
${topInclusions.map(inc => {
  const freqText = inc.percentage >= 70 ? 'Most packages include' : inc.percentage >= 40 ? 'Many packages include' : 'Some packages include';
  return `    <li>${freqText} ${escapeHtml(inc.name.toLowerCase())}</li>`;
}).join('\n')}
  </ul>
</section>
`;
  }

  if (topDestinations.length > 0) {
    html += `<section aria-label="Top Destinations">
  <h2>Top Destinations</h2>
  <ul>
${topDestinations.map(dest => `    <li><a href="${CANONICAL_HOST}/destinations/${escapeHtml(dest.slug)}">${escapeHtml(dest.name)}</a> (${dest.count} package${dest.count > 1 ? 's' : ''})</li>`).join('\n')}
  </ul>
</section>
`;
  }

  if (featuredPackages.length > 0) {
    html += `<section aria-label="Featured ${config.name}">
  <h2>Featured ${escapeHtml(config.name)}</h2>
  <ul>
${featuredPackages.map(pkg => {
  const priceText = pkg.price ? ` - From £${pkg.price.toLocaleString()}` : '';
  return `    <li><a href="${CANONICAL_HOST}/packages/${escapeHtml(pkg.slug)}">${escapeHtml(pkg.title)}</a>${priceText}</li>`;
}).join('\n')}
  </ul>
</section>
`;
  }

  if (faqs.length > 0) {
    html += `<section aria-label="${config.name} FAQs">
  <h2>Frequently Asked Questions</h2>
${faqs.map(faq => `  <details>
    <summary>${escapeHtml(faq.question)}</summary>
    <p>${escapeHtml(faq.answer)}</p>
  </details>`).join('\n')}
</section>
`;
  }

  return html;
}

export function generateCollectionMetaTitle(config: CollectionConfig): string {
  return `${config.name} | ${config.metaTitleSuffix} | Flights and Packages`;
}

export function generateCollectionMetaDescription(agg: CollectionAggregate): string {
  const { config, packageCount, priceMin, topDurationBuckets } = agg;
  const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
  
  let desc = `Browse ${packageCount} ${config.keywords[0]} packages from the UK. `;
  if (priceMin != null) {
    desc += `From £${priceMin.toLocaleString()}. `;
  }
  desc += `Typical trips: ${durText}. Enquire at ${CONTACT_EMAIL}`;
  
  return desc.slice(0, 160);
}

export function generateCollectionJsonLd(agg: CollectionAggregate, faqs: CollectionFaqItem[]): string {
  const { config, packageCount, featuredPackages } = agg;
  
  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": CANONICAL_HOST
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Collections",
        "item": `${CANONICAL_HOST}/collections`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": config.name,
        "item": `${CANONICAL_HOST}/collections/${config.slug}`
      }
    ]
  };

  const collectionPage = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": config.name,
    "url": `${CANONICAL_HOST}/collections/${config.slug}`,
    "description": generateCollectionMetaDescription(agg),
    "numberOfItems": packageCount
  };

  const itemListElements = featuredPackages.map((pkg, index) => {
    const item: any = {
      "@type": "ListItem",
      "position": index + 1,
      "name": pkg.title,
      "url": `${CANONICAL_HOST}/packages/${pkg.slug}`
    };
    
    if (pkg.price) {
      item.item = {
        "@type": "Product",
        "name": pkg.title,
        "url": `${CANONICAL_HOST}/packages/${pkg.slug}`,
        "offers": {
          "@type": "Offer",
          "priceCurrency": "GBP",
          "price": pkg.price,
          "availability": "https://schema.org/InStock"
        }
      };
    }
    
    return item;
  });

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Featured ${config.name}`,
    "numberOfItems": featuredPackages.length,
    "itemListElement": itemListElements
  };

  const faqPage = {
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

  return `
    <script type="application/ld+json">${JSON.stringify(breadcrumbList)}</script>
    <script type="application/ld+json">${JSON.stringify(collectionPage)}</script>
    <script type="application/ld+json">${JSON.stringify(itemList)}</script>
    <script type="application/ld+json">${JSON.stringify(faqPage)}</script>
  `;
}

export function buildCollectionNoscriptHtml(agg: CollectionAggregate): string {
  const { config, packageCount, priceMin, topDestinations, featuredPackages } = agg;
  
  let html = `<h1>${config.h1}</h1>\n`;
  html += `<p>Browse ${packageCount} ${config.keywords[0]} packages from the UK`;
  if (priceMin) html += `, from £${priceMin.toLocaleString()}`;
  html += '.</p>\n';
  
  if (topDestinations.length > 0) {
    html += '<p>Destinations: ' + topDestinations.slice(0, 5).map(d => d.name).join(', ') + '</p>\n';
  }
  
  if (featuredPackages.length > 0) {
    html += '<ul>\n';
    featuredPackages.slice(0, 6).forEach(pkg => {
      html += `  <li><a href="${CANONICAL_HOST}/packages/${pkg.slug}">${pkg.title}</a></li>\n`;
    });
    html += '</ul>\n';
  }
  
  return html;
}
