import type { FlightPackage } from '@shared/schema';
import { parseNights, median } from './destinationAggregate';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';
const CONTACT_EMAIL = 'holidayenq@flightsandpackages.com';

export interface RiverCruiseAggregate {
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

export interface RiverCruiseFaqItem {
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

export function isRiverCruisePackage(pkg: FlightPackage): boolean {
  const tags = pkg.tags || [];
  const title = (pkg.title || '').toLowerCase();
  const description = (pkg.description || '').toLowerCase();
  
  const hasRiverCruiseTag = tags.some(tag => 
    tag.toLowerCase().includes('river cruise') || 
    tag.toLowerCase().includes('river-cruise') ||
    tag.toLowerCase() === 'river cruises'
  );
  
  const hasRiverCruiseInContent = 
    title.includes('river cruise') || 
    description.includes('river cruise');
  
  return hasRiverCruiseTag || hasRiverCruiseInContent;
}

export function buildRiverCruiseAggregate(packages: FlightPackage[]): RiverCruiseAggregate {
  const riverCruisePackages = packages
    .filter(p => p.isPublished)
    .filter(isRiverCruisePackage);

  const prices = riverCruisePackages
    .map(p => p.price)
    .filter((p): p is number => p != null && p > 0);

  const tagCounts: Record<string, number> = {};
  for (const pkg of riverCruisePackages) {
    for (const tag of pkg.tags || []) {
      if (!tag.toLowerCase().includes('river cruise')) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  const durationBucketCounts: Record<string, { label: string; min: number; max: number; count: number }> = {};
  for (const pkg of riverCruisePackages) {
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
  for (const pkg of riverCruisePackages) {
    for (const item of pkg.whatsIncluded || []) {
      const normalized = normalizeInclusion(item);
      if (normalized.length > 3) {
        inclusionCounts[normalized] = (inclusionCounts[normalized] || 0) + 1;
      }
    }
  }
  const totalPackages = riverCruisePackages.length;
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
  for (const pkg of riverCruisePackages) {
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

  const featuredPackages = [...riverCruisePackages]
    .sort((a, b) => {
      if (a.displayOrder != null && b.displayOrder != null) {
        return a.displayOrder - b.displayOrder;
      }
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 12);

  return {
    packageCount: riverCruisePackages.length,
    priceMin: prices.length > 0 ? Math.min(...prices) : null,
    priceMedian: median(prices),
    priceMax: prices.length > 0 ? Math.max(...prices) : null,
    topTags,
    durationBuckets,
    topDurationBuckets,
    topInclusions,
    topDestinations,
    featuredPackages,
    allPackages: riverCruisePackages
  };
}

export function generateRiverCruiseFaqs(agg: RiverCruiseAggregate): RiverCruiseFaqItem[] {
  const faqs: RiverCruiseFaqItem[] = [];
  const { packageCount, priceMin, topTags, topDurationBuckets, topInclusions, topDestinations } = agg;

  faqs.push({
    question: "What's included in your river cruise packages from the UK?",
    answer: `Our river cruise packages typically include return flights from UK airports, full-board accommodation on the cruise ship, and guided excursions at ports of call. ${topInclusions.length > 0 ? `Common inclusions are: ${topInclusions.slice(0, 5).map(i => i.name.toLowerCase()).join(', ')}.` : ''} Each package clearly lists all inclusions.`
  });

  faqs.push({
    question: "Do your river cruises include flights from the UK?",
    answer: "Yes, most of our river cruise packages include return flights from UK airports. Check individual package details for specific flight inclusions and departure airports available."
  });

  if (topDurationBuckets.length > 0) {
    const durText = topDurationBuckets.join(' or ');
    faqs.push({
      question: "How long are your river cruise holidays typically?",
      answer: `Most of our river cruise holidays last ${durText}. We offer trips ranging from short breaks to extended voyages to suit your schedule and interests.`
    });
  }

  if (priceMin != null) {
    faqs.push({
      question: "What is the starting price for river cruises?",
      answer: `River cruise packages start from £${priceMin.toLocaleString()} per person. Prices vary based on departure dates, cabin type, and package inclusions.`
    });
  }

  if (topDestinations.length > 0) {
    const destText = topDestinations.slice(0, 4).map(d => d.name).join(', ');
    faqs.push({
      question: "Which destinations do your river cruises visit?",
      answer: `Our river cruise collection features voyages through ${destText} and more. Browse our packages to explore different rivers and regions across Europe and beyond.`
    });
  }

  faqs.push({
    question: "Can I customise a river cruise package?",
    answer: `Absolutely! We can tailor any river cruise to your preferences. Contact us at ${CONTACT_EMAIL} to adjust dates, upgrade cabins, add pre/post cruise stays, or create a bespoke itinerary.`
  });

  faqs.push({
    question: "Are meals included on river cruises?",
    answer: "Most of our river cruise packages include full-board dining with breakfast, lunch, and dinner served on board. Many also include drinks with meals. Check individual package details for specific dining arrangements."
  });

  faqs.push({
    question: "What cabin types are available?",
    answer: "River cruise ships typically offer a range of cabin types from standard cabins to suites with private balconies. Cabin options and upgrade availability are detailed in each package listing."
  });

  faqs.push({
    question: "Do I need travel insurance for a river cruise?",
    answer: "Travel insurance is not included in our packages but is strongly recommended. We advise comprehensive coverage including cruise-specific benefits for cancellations, medical emergencies, and trip interruption."
  });

  faqs.push({
    question: "How do I book and get confirmation?",
    answer: `To book a river cruise, complete our enquiry form or email ${CONTACT_EMAIL}. Once your booking is confirmed and payment received, you'll receive all travel documents and vouchers by email.`
  });

  if (topTags.length > 0) {
    faqs.push({
      question: "What types of river cruise experiences do you offer?",
      answer: `Our river cruise collection includes ${topTags.slice(0, 5).join(', ')} themed voyages. Browse our packages to find the perfect river cruise experience for you.`
    });
  }

  faqs.push({
    question: "Are river cruises suitable for solo travellers?",
    answer: "Yes! River cruises are popular with solo travellers. Many ships offer single cabins or reduced single supplements. Contact us for advice on the best options for solo adventurers."
  });

  faqs.push({
    question: "What is the best time for a river cruise?",
    answer: "River cruises operate throughout the year, with peak season during spring and summer for European rivers. Christmas market cruises are popular in winter. Each season offers unique experiences."
  });

  faqs.push({
    question: "How do I contact you about river cruises?",
    answer: `For any questions about our river cruise packages, email ${CONTACT_EMAIL} or use our online enquiry form. Our travel experts are happy to help with recommendations and bookings.`
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

export function buildRiverCruiseOverview(agg: RiverCruiseAggregate): string {
  const { packageCount, priceMin, priceMedian, topTags, topDurationBuckets, topDestinations } = agg;
  
  const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
  const stylesText = topTags.length > 0 ? topTags.slice(0, 3).join(', ') : 'scenic voyages';
  const destText = topDestinations.length > 0 ? topDestinations.slice(0, 3).map(d => d.name).join(', ') : 'Europe';
  
  let overview = `Explore ${packageCount} river cruise packages from the UK, `;
  overview += `offering unforgettable river cruises through ${destText} and beyond. `;
  overview += `Typical trip lengths include ${durText}, `;
  overview += `with popular themes featuring ${stylesText}. `;
  
  if (priceMin != null) {
    overview += `Prices start from £${priceMin.toLocaleString()}`;
    if (priceMedian != null && priceMedian !== priceMin) {
      overview += ` with a median price of £${priceMedian.toLocaleString()}`;
    }
    overview += `. `;
  }
  
  overview += `For bespoke river cruise packages from the UK, contact ${CONTACT_EMAIL}.`;
  
  return overview;
}

export function buildRiverCruiseGuideHtml(agg: RiverCruiseAggregate, faqs: RiverCruiseFaqItem[]): string {
  const { packageCount, priceMin, topTags, durationBuckets, topInclusions, topDestinations, featuredPackages } = agg;
  
  let html = '';

  const overview = buildRiverCruiseOverview(agg);
  html += `<section aria-label="River Cruises Overview">
  <p>${escapeHtml(overview)}</p>
</section>
`;

  if (topTags.length > 0) {
    html += `<section aria-label="Popular River Cruise Styles">
  <h2>Popular River Cruise Styles</h2>
  <ul>
${topTags.map(tag => `    <li>${escapeHtml(tag)}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  const activeBuckets = durationBuckets.filter(b => b.count > 0);
  if (activeBuckets.length > 0) {
    html += `<section aria-label="River Cruise Trip Lengths">
  <h2>Typical Trip Lengths</h2>
  <ul>
${activeBuckets.map(b => `    <li>${escapeHtml(b.label)}: ${b.count} package${b.count > 1 ? 's' : ''}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  if (topInclusions.length > 0) {
    html += `<section aria-label="What's Included in River Cruises">
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
    html += `<section aria-label="Top River Cruise Destinations">
  <h2>Top Destinations in Our River Cruises</h2>
  <ul>
${topDestinations.map(dest => `    <li><a href="${CANONICAL_HOST}/destinations/${escapeHtml(dest.slug)}">${escapeHtml(dest.name)}</a> (${dest.count} cruise${dest.count > 1 ? 's' : ''})</li>`).join('\n')}
  </ul>
</section>
`;
  }

  if (featuredPackages.length > 0) {
    html += `<section aria-label="Featured River Cruises">
  <h2>Featured River Cruises</h2>
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
    html += `<section aria-label="River Cruise FAQs">
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

export function generateRiverCruiseMetaTitle(): string {
  return 'River Cruises | River Cruise Packages from the UK | Flights and Packages';
}

export function generateRiverCruiseMetaDescription(agg: RiverCruiseAggregate): string {
  const { packageCount, priceMin, topDurationBuckets } = agg;
  const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
  
  let desc = `Browse ${packageCount} river cruise packages from the UK. `;
  if (priceMin != null) {
    desc += `From £${priceMin.toLocaleString()}. `;
  }
  desc += `Typical trips: ${durText}. Enquire at ${CONTACT_EMAIL}`;
  
  return desc.slice(0, 160);
}

export function generateRiverCruiseJsonLd(agg: RiverCruiseAggregate, faqs: RiverCruiseFaqItem[]): string {
  const { packageCount, priceMin, featuredPackages } = agg;
  
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
        "name": "River Cruises",
        "item": `${CANONICAL_HOST}/collections/river-cruises`
      }
    ]
  };

  const collectionPage = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "River Cruises",
    "url": `${CANONICAL_HOST}/collections/river-cruises`,
    "description": generateRiverCruiseMetaDescription(agg),
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
    "name": "Featured River Cruises",
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

export function buildRiverCruiseNoscriptHtml(agg: RiverCruiseAggregate): string {
  const { packageCount, priceMin, topDestinations, featuredPackages } = agg;
  
  let html = '<h1>River Cruises</h1>\n';
  html += `<p>Browse ${packageCount} river cruise packages from the UK`;
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
