import type { FlightPackage } from '@shared/schema';
import { buildDestinationAggregate, DestinationAggregate, DestinationFaqItem } from './destinationAggregate';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';
const CONTACT_EMAIL = 'holidayenq@flightsandpackages.com';

export interface UkIntentConfig {
  destinationName: string;
  destinationSlug: string;
  featuredPackageLimit: number;
}

const UK_INTENT_DESTINATIONS: Record<string, UkIntentConfig> = {
  'india': {
    destinationName: 'India',
    destinationSlug: 'india',
    featuredPackageLimit: 12
  },
  'italy': {
    destinationName: 'Italy',
    destinationSlug: 'italy',
    featuredPackageLimit: 12
  }
};

export function isUkIntentDestination(slug: string): boolean {
  return slug.toLowerCase() in UK_INTENT_DESTINATIONS;
}

export function getUkIntentConfig(slug: string): UkIntentConfig | null {
  return UK_INTENT_DESTINATIONS[slug.toLowerCase()] || null;
}

export function buildUkIntentAggregate(
  packages: FlightPackage[],
  destinationSlug: string
): DestinationAggregate {
  const baseAgg = buildDestinationAggregate(packages, destinationSlug);
  const config = getUkIntentConfig(destinationSlug);
  
  if (config) {
    const sortedPackages = [...baseAgg.allPackages]
      .sort((a, b) => {
        if (a.displayOrder != null && b.displayOrder != null) {
          return a.displayOrder - b.displayOrder;
        }
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, config.featuredPackageLimit);
    
    return {
      ...baseAgg,
      featuredPackages: sortedPackages
    };
  }
  
  return baseAgg;
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

export function generateUkIntentFaqs(agg: DestinationAggregate): DestinationFaqItem[] {
  const faqs: DestinationFaqItem[] = [];
  const { destinationName, packageCount, priceMin, topTags, topDurationBuckets, topInclusions, topHotels } = agg;

  faqs.push({
    question: `What's included in ${destinationName} holiday packages from the UK?`,
    answer: `Our ${destinationName} holiday packages typically include return flights from UK airports, accommodation, and various excursions. ${topInclusions.length > 0 ? `Common inclusions are: ${topInclusions.slice(0, 5).map(i => i.name.toLowerCase()).join(', ')}.` : ''} Each package clearly lists all inclusions.`
  });

  const flightsIncluded = topInclusions.find(i => 
    i.name.toLowerCase().includes('flight') || i.name.toLowerCase().includes('return flight')
  );
  faqs.push({
    question: `Do your ${destinationName} holidays include flights?`,
    answer: flightsIncluded && flightsIncluded.percentage >= 50
      ? `Yes, most of our ${destinationName} holiday packages include return flights from UK airports. Check individual package details for specific flight inclusions and departure airports.`
      : `Many of our ${destinationName} packages include flights from UK airports, while some are land-only arrangements. Each package clearly states whether flights are included.`
  });

  if (topDurationBuckets.length > 0) {
    const durText = topDurationBuckets.join(' or ');
    faqs.push({
      question: `How long are your ${destinationName} tours typically?`,
      answer: `Most of our ${destinationName} tours last ${durText}. We offer trips ranging from short breaks to extended adventures to suit your schedule and interests.`
    });
  }

  if (priceMin != null) {
    faqs.push({
      question: `What is the starting price for ${destinationName} holidays?`,
      answer: `${destinationName} holiday packages start from £${priceMin.toLocaleString()} per person. Prices vary based on departure dates, accommodation choices, and package inclusions.`
    });
  }

  faqs.push({
    question: `Can I customise an ${destinationName} holiday package?`,
    answer: `Absolutely! We can tailor any ${destinationName} holiday to your preferences. Contact us at ${CONTACT_EMAIL} to adjust dates, upgrade hotels, add excursions, or create a bespoke itinerary.`
  });

  faqs.push({
    question: `Do I need travel insurance for ${destinationName}?`,
    answer: `Travel insurance is not included in our packages but is strongly recommended. We advise comprehensive coverage for cancellations, medical emergencies, and baggage protection before travelling to ${destinationName}.`
  });

  faqs.push({
    question: `Are local taxes included in ${destinationName} holiday prices?`,
    answer: `Local tourist taxes or city levies may apply in ${destinationName} and are typically payable directly at your hotel. These are not included in our package prices but will be noted where applicable.`
  });

  faqs.push({
    question: `How do I book and get confirmation?`,
    answer: `To book an ${destinationName} holiday, complete our enquiry form or email ${CONTACT_EMAIL}. Once your booking is confirmed and payment received, you'll receive all travel documents and vouchers by email.`
  });

  if (topTags.length > 0) {
    faqs.push({
      question: `What types of ${destinationName} holidays do you offer?`,
      answer: `Our ${destinationName} collection includes ${topTags.slice(0, 5).join(', ')} holidays. Browse our packages to find the perfect ${destinationName} experience for you.`
    });
  }

  if (topHotels.length > 0) {
    faqs.push({
      question: `Which hotels are featured in your ${destinationName} packages?`,
      answer: `Our ${destinationName} packages feature quality accommodations including ${topHotels.slice(0, 3).join(', ')}. Browse individual packages for full hotel details and upgrade options.`
    });
  }

  faqs.push({
    question: `What is the best time to visit ${destinationName}?`,
    answer: `${destinationName} offers year-round travel opportunities. Our packages are available throughout the seasons - check individual package dates to find the best time for your preferred activities.`
  });

  const transfersIncluded = topInclusions.find(i => 
    i.name.toLowerCase().includes('transfer') || i.name.toLowerCase().includes('airport')
  );
  if (transfersIncluded && transfersIncluded.percentage >= 40) {
    faqs.push({
      question: `Are airport transfers included?`,
      answer: `Many of our ${destinationName} packages include airport transfers for a seamless arrival experience. This is noted in each package's "What's Included" section.`
    });
  }

  faqs.push({
    question: `How do I contact you about ${destinationName} holidays?`,
    answer: `For any questions about our ${destinationName} holiday packages, email ${CONTACT_EMAIL} or use our online enquiry form. Our travel experts are happy to help with recommendations and bookings.`
  });

  faqs.push({
    question: `Can I travel solo to ${destinationName}?`,
    answer: `Yes! Many of our ${destinationName} packages welcome solo travellers. Prices shown are typically per person, and we can advise on single supplements or group tours perfect for solo adventurers.`
  });

  return faqs.slice(0, 14);
}

export function buildUkIntentH1(destinationName: string): string {
  return `${destinationName} Holidays & Packages from the UK`;
}

export function buildUkIntentOverview(agg: DestinationAggregate): string {
  const { destinationName, packageCount, priceMin, priceMedian, topTags, topDurationBuckets } = agg;
  
  const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
  const stylesText = topTags.length > 0 ? topTags.slice(0, 4).join(', ') : 'diverse travel experiences';
  
  let overview = `Explore ${packageCount} ${destinationName} holiday packages from the UK, `;
  overview += `offering unforgettable ${destinationName} holidays and ${destinationName} tours tailored to UK travellers. `;
  overview += `Typical trip lengths include ${durText}, `;
  overview += `with popular styles featuring ${stylesText}. `;
  
  if (priceMin != null) {
    overview += `Prices start from £${priceMin.toLocaleString()}`;
    if (priceMedian != null && priceMedian !== priceMin) {
      overview += ` with a median price of £${priceMedian.toLocaleString()}`;
    }
    overview += `. `;
  }
  
  overview += `For bespoke ${destinationName} holidays from the UK, contact ${CONTACT_EMAIL}.`;
  
  return overview;
}

export function buildUkIntentGuideHtml(agg: DestinationAggregate, faqs: DestinationFaqItem[]): string {
  const { destinationName, destinationSlug, packageCount, priceMin, topTags, durationBuckets, topDurationBuckets, topInclusions, topHotels, featuredPackages } = agg;
  
  let html = '';

  const overview = buildUkIntentOverview(agg);
  html += `<section aria-label="${destinationName} Holiday Overview">
  <p>${escapeHtml(overview)}</p>
</section>
`;

  if (topTags.length > 0) {
    html += `<section aria-label="Popular ${destinationName} Holiday Styles">
  <h2>Popular ${escapeHtml(destinationName)} Trip Styles</h2>
  <ul>
${topTags.map(tag => `    <li>${escapeHtml(tag)}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  const activeBuckets = durationBuckets.filter(b => b.count > 0);
  if (activeBuckets.length > 0) {
    html += `<section aria-label="${destinationName} Trip Lengths">
  <h2>Typical Trip Lengths</h2>
  <ul>
${activeBuckets.map(b => `    <li>${escapeHtml(b.label)}: ${b.count} package${b.count > 1 ? 's' : ''}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  if (topInclusions.length > 0) {
    html += `<section aria-label="What's Included in ${destinationName} Holidays">
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
    html += `<section aria-label="Featured ${destinationName} Accommodations">
  <h2>Featured Accommodations</h2>
  <ul>
${topHotels.map(hotel => `    <li>${escapeHtml(hotel)}</li>`).join('\n')}
  </ul>
</section>
`;
  }

  if (featuredPackages.length > 0) {
    html += `<section aria-label="Featured ${destinationName} Holidays">
  <h2>Featured ${escapeHtml(destinationName)} Holidays</h2>
  <ul>
`;
    for (const pkg of featuredPackages) {
      const url = `${CANONICAL_HOST}/Holidays/${destinationSlug.toLowerCase()}/${pkg.slug}`;
      const priceText = pkg.price ? `From £${pkg.price.toLocaleString()}` : 'Price on request';
      html += `    <li><a href="${url}">${escapeHtml(pkg.title)}</a> - ${priceText}</li>\n`;
    }
    html += `  </ul>
</section>
`;
  }

  if (faqs.length > 0) {
    html += `<section aria-label="Frequently Asked Questions About ${destinationName} Holidays">
  <h2>${escapeHtml(destinationName)} Holiday FAQs</h2>
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

export function generateUkIntentMetaFallback(agg: DestinationAggregate): { title: string; description: string } {
  const { destinationName, packageCount, priceMin, topTags, topDurationBuckets } = agg;

  const title = `${destinationName} Holidays & ${destinationName} Holiday Packages from the UK | Flights and Packages`;

  const tagText = topTags.length >= 3 ? `${topTags.slice(0, 3).join(', ')}` : (topTags.length > 0 ? topTags.join(', ') : 'various styles');
  const durationText = topDurationBuckets.length > 0 ? `Typical stays: ${topDurationBuckets[0]}.` : '';
  const priceText = priceMin != null ? `From £${priceMin.toLocaleString()}.` : '';
  
  const description = `Browse ${packageCount} ${destinationName} holiday packages from the UK. Popular trip styles: ${tagText}. ${durationText} ${priceText} Enquire at ${CONTACT_EMAIL}.`;

  return { title, description: description.trim() };
}

export function generateUkIntentDestinationJsonLd(agg: DestinationAggregate, path: string): object {
  const { destinationName, packageCount, priceMin, topTags, topDurationBuckets } = agg;
  
  const tagText = topTags.length > 0 ? ` including ${topTags.slice(0, 3).join(', ')} holidays` : '';
  const durationText = topDurationBuckets.length > 0 ? ` Trips commonly last ${topDurationBuckets.join(' or ')}.` : '';
  const priceText = priceMin != null ? ` Prices start from £${priceMin.toLocaleString()} per person.` : '';
  
  const description = `Explore ${packageCount} ${destinationName} holiday packages from the UK${tagText}.${durationText}${priceText} Book ${destinationName} tours and holidays with Flights and Packages.`;

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

export function generateUkIntentItemListJsonLd(agg: DestinationAggregate): object {
  const { destinationName, destinationSlug, featuredPackages } = agg;
  
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${destinationName} Holiday Packages from the UK`,
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

export function generateUkIntentFaqPageJsonLd(faqs: DestinationFaqItem[]): object {
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

export function buildUkIntentBreadcrumbHtml(agg: DestinationAggregate): string {
  const { destinationName } = agg;
  return `<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="${CANONICAL_HOST}/">Home</a></li>
    <li><a href="${CANONICAL_HOST}/destinations">Destinations</a></li>
    <li>${escapeHtml(destinationName)} Holidays</li>
  </ol>
</nav>
`;
}

export function buildUkIntentNoscriptHtml(agg: DestinationAggregate): string {
  const { destinationName, destinationSlug, packageCount, priceMin, topTags, topDurationBuckets, featuredPackages } = agg;
  
  const durText = topDurationBuckets.length > 0 ? topDurationBuckets.join(' or ') : 'various durations';
  const stylesText = topTags.length > 0 ? `, including ${topTags.slice(0, 3).join(', ')}` : '';
  const priceText = priceMin != null ? ` Prices start from £${priceMin.toLocaleString()}.` : '';

  let html = `<article itemscope itemtype="https://schema.org/TouristDestination">
  <h1 itemprop="name">${escapeHtml(destinationName)} Holidays & Packages from the UK</h1>
  <p itemprop="description">Explore ${packageCount} ${escapeHtml(destinationName)} holiday packages from the UK${stylesText}, with trips lasting ${durText}.${priceText}</p>
`;

  if (featuredPackages.length > 0) {
    html += `  <h2>Featured ${escapeHtml(destinationName)} Holidays</h2>
  <ul>
`;
    for (const pkg of featuredPackages.slice(0, 6)) {
      const url = `${CANONICAL_HOST}/Holidays/${destinationSlug.toLowerCase()}/${pkg.slug}`;
      html += `    <li><a href="${url}">${escapeHtml(pkg.title)}</a></li>\n`;
    }
    html += `  </ul>
`;
  }

  html += `  <p>Contact: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="${CANONICAL_HOST}/">Home</a></li>
      <li><a href="${CANONICAL_HOST}/destinations">Destinations</a></li>
      <li>${escapeHtml(destinationName)} Holidays</li>
    </ol>
  </nav>
</article>
`;

  return html;
}

export function buildHubLinkSection(destinationSlug: string, destinationName: string): string {
  return `<section aria-label="Browse More ${destinationName} Holidays">
  <p><a href="${CANONICAL_HOST}/destinations/${destinationSlug}">See all ${destinationName} holidays and packages</a> from Flights and Packages.</p>
</section>
`;
}
