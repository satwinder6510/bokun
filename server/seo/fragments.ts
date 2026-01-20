import type { FlightPackage } from '@shared/schema';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBulletPoints(html: string | null | undefined, maxItems: number = 7): string[] {
  if (!html) return [];
  
  const liMatches = html.match(/<li[^>]*>(.*?)<\/li>/gi);
  if (liMatches && liMatches.length > 0) {
    return liMatches
      .slice(0, maxItems)
      .map(li => stripHtml(li))
      .filter(text => text.length > 0);
  }
  
  const lines = stripHtml(html)
    .split(/[•\-\n]/)
    .map(line => line.trim())
    .filter(line => line.length > 5);
  
  return lines.slice(0, maxItems);
}

export function buildInclusionsHtml(pkg: FlightPackage): string {
  if (!pkg.whatsIncluded || pkg.whatsIncluded.length === 0) {
    return '';
  }
  
  const items = pkg.whatsIncluded.slice(0, 7);
  if (items.length === 0) return '';
  
  let html = '<section aria-label="What is included">\n';
  html += '  <h2>What\'s Included</h2>\n';
  html += '  <ul>\n';
  for (const item of items) {
    html += `    <li>${escapeHtml(item)}</li>\n`;
  }
  html += '  </ul>\n';
  html += '</section>\n';
  
  return html;
}

export function buildExclusionsHtml(pkg: FlightPackage): string {
  if (!pkg.excluded) return '';
  
  const items = extractBulletPoints(pkg.excluded, 7);
  if (items.length === 0) return '';
  
  let html = '<section aria-label="What is not included">\n';
  html += '  <h2>What\'s Not Included</h2>\n';
  html += '  <ul>\n';
  for (const item of items) {
    html += `    <li>${escapeHtml(item)}</li>\n`;
  }
  html += '  </ul>\n';
  html += '</section>\n';
  
  return html;
}

export function buildHighlightsHtml(pkg: FlightPackage): string {
  if (!pkg.highlights || pkg.highlights.length === 0) {
    return '';
  }
  
  const items = pkg.highlights.slice(0, 7);
  if (items.length === 0) return '';
  
  let html = '<section aria-label="Tour Highlights">\n';
  html += '  <h2>Tour Highlights</h2>\n';
  html += '  <ul>\n';
  for (const item of items) {
    html += `    <li>${escapeHtml(item)}</li>\n`;
  }
  html += '  </ul>\n';
  html += '</section>\n';
  
  return html;
}

export function buildRequirementsHtml(pkg: FlightPackage): string {
  if (!pkg.requirements) return '';
  
  const items = extractBulletPoints(pkg.requirements, 6);
  if (items.length === 0) return '';
  
  let html = '<section aria-label="What to bring">\n';
  html += '  <h2>What to Bring</h2>\n';
  html += '  <ul>\n';
  for (const item of items) {
    html += `    <li>${escapeHtml(item)}</li>\n`;
  }
  html += '  </ul>\n';
  html += '</section>\n';
  
  return html;
}

export function buildAttentionHtml(pkg: FlightPackage): string {
  if (!pkg.attention) return '';
  
  const text = stripHtml(pkg.attention);
  if (text.length < 10) return '';
  
  let html = '<section aria-label="Important Information">\n';
  html += '  <h2>Important Information</h2>\n';
  html += `  <p>${escapeHtml(text.substring(0, 500))}</p>\n`;
  html += '</section>\n';
  
  return html;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function generateAutomatedFaqs(pkg: FlightPackage): FaqItem[] {
  const faqs: FaqItem[] = [];
  const hotelName = pkg.accommodations?.[0]?.name;
  const currency = pkg.currency || 'GBP';
  const price = pkg.price;
  const priceLabel = pkg.priceLabel || 'per person';

  // 1. Duration FAQ
  if (pkg.duration) {
    faqs.push({
      question: `How long is the ${pkg.title}?`,
      answer: `The ${pkg.title} duration is ${pkg.duration}.`
    });
  }

  // 2. Price FAQ
  if (price) {
    const priceText = `${currency === 'GBP' ? '£' : currency}${price} ${priceLabel}`;
    faqs.push({
      question: `How much does the ${pkg.title} cost?`,
      answer: `Prices for the ${pkg.title} start from ${priceText}. Prices are subject to availability and can change based on departure dates.`
    });
  }

  // 3. Accommodation FAQ
  if (hotelName) {
    faqs.push({
      question: `Where will I stay during the ${pkg.title}?`,
      answer: `Accommodation for this holiday is provided at ${hotelName}. Please check the accommodation section for more details.`
    });
  }

  // 4. Inclusions FAQ
  if (pkg.whatsIncluded && pkg.whatsIncluded.length > 0) {
    faqs.push({
      question: `What is included in the ${pkg.title} package?`,
      answer: `The package includes: ${pkg.whatsIncluded.join(', ')}.`
    });
  }

  // 5. Insurance FAQ (from otherInfo)
  if (pkg.otherInfo?.toLowerCase().includes('insurance')) {
    faqs.push({
      question: `Is travel insurance included in the ${pkg.title}?`,
      answer: `Travel insurance is not included. We strongly recommend that you arrange your own comprehensive travel insurance before departure.`
    });
  }

  // 6. Exclusions FAQ (from otherInfo or excluded field)
  const exclusionsText = pkg.excluded || (pkg.otherInfo?.toLowerCase().includes('exclusions') ? pkg.otherInfo : '');
  if (exclusionsText) {
    faqs.push({
      question: `What is not included in the ${pkg.title}?`,
      answer: `Typically, tips, personal expenses, laundry, and items not mentioned in the inclusions are not included. Please refer to the exclusions section for a full list.`
    });
  }

  // 7. Local Taxes FAQ (from otherInfo)
  if (pkg.otherInfo?.toLowerCase().includes('tax')) {
    faqs.push({
      question: `Are there any local taxes to pay for the ${pkg.title}?`,
      answer: `Local city or tourist taxes may apply and are usually payable directly to the hotel upon arrival or departure.`
    });
  }

  // 8. Check-in/out FAQ (from otherInfo)
  if (pkg.otherInfo?.toLowerCase().includes('check')) {
    faqs.push({
      question: `What are the check-in and check-out times for the ${pkg.title}?`,
      answer: `Standard hotel check-in is typically from 2:00 PM and check-out is by 11:00 AM, though this can vary by hotel.`
    });
  }

  // 9. Booking confirmation FAQ
  faqs.push({
    question: `How do I receive confirmation for my ${pkg.title} booking?`,
    answer: `Once your booking is processed and payment is confirmed, you will receive a confirmation email with all your travel documents and vouchers.`
  });

  // 10. Destination FAQ
  if (pkg.category) {
    faqs.push({
      question: `Where does the ${pkg.title} take place?`,
      answer: `This holiday package takes you to ${pkg.category}.`
    });
  }

  return faqs.slice(0, 10);
}

export function buildFaqHtml(faqs: FaqItem[]): string {
  if (!faqs || faqs.length === 0) return '';
  
  let html = '<section aria-label="Frequently Asked Questions">\n';
  html += '  <h2>Frequently Asked Questions</h2>\n';
  for (const faq of faqs) {
    html += '  <details>\n';
    html += `    <summary>${escapeHtml(faq.question)}</summary>\n`;
    html += `    <p>${escapeHtml(stripHtml(faq.answer))}</p>\n`;
    html += '  </details>\n';
  }
  html += '</section>\n';
  
  return html;
}

export function buildSuitabilityHtml(pkg: FlightPackage): string {
  const tags = pkg.tags || [];
  if (tags.length === 0) return '';
  
  const suitableFor: string[] = [];
  const notSuitableFor: string[] = [];
  
  const tagMap: Record<string, { suitable: string[], notSuitable: string[] }> = {
    'Beach': { suitable: ['Beach lovers', 'Relaxation seekers'], notSuitable: [] },
    'Adventure': { suitable: ['Active travelers', 'Outdoor enthusiasts'], notSuitable: ['Those with mobility issues'] },
    'Cultural': { suitable: ['History buffs', 'Cultural explorers'], notSuitable: [] },
    'City Break': { suitable: ['Urban explorers', 'Couples'], notSuitable: [] },
    'Safari': { suitable: ['Wildlife enthusiasts', 'Nature lovers', 'Photography enthusiasts'], notSuitable: ['Young children under 5'] },
    'Wildlife': { suitable: ['Nature lovers', 'Photography enthusiasts'], notSuitable: [] },
    'Luxury': { suitable: ['Couples', 'Special occasions', 'Honeymoons'], notSuitable: [] },
    'Family': { suitable: ['Families with children', 'Multi-generational groups'], notSuitable: [] },
    'Cruise': { suitable: ['Those who enjoy water travel', 'Scenic route lovers'], notSuitable: ['Those prone to seasickness'] },
    'River Cruise': { suitable: ['Relaxed pace travelers', 'Scenic route lovers'], notSuitable: [] },
    'Solo Travellers': { suitable: ['Solo travelers', 'Independent explorers'], notSuitable: [] },
    'Honeymoon': { suitable: ['Couples', 'Newlyweds', 'Romantic getaways'], notSuitable: [] },
  };
  
  for (const tag of tags) {
    const mapping = tagMap[tag];
    if (mapping) {
      suitableFor.push(...mapping.suitable);
      notSuitableFor.push(...mapping.notSuitable);
    }
  }
  
  const uniqueSuitable = Array.from(new Set(suitableFor)).slice(0, 6);
  const uniqueNotSuitable = Array.from(new Set(notSuitableFor)).slice(0, 4);
  
  if (uniqueSuitable.length === 0 && uniqueNotSuitable.length === 0) return '';
  
  let html = '<section aria-label="Who this tour is for">\n';
  
  if (uniqueSuitable.length > 0) {
    html += '  <h2>Best For</h2>\n';
    html += '  <ul>\n';
    for (const item of uniqueSuitable) {
      html += `    <li>${escapeHtml(item)}</li>\n`;
    }
    html += '  </ul>\n';
  }
  
  if (uniqueNotSuitable.length > 0) {
    html += '  <h3>May Not Be Suitable For</h3>\n';
    html += '  <ul>\n';
    for (const item of uniqueNotSuitable) {
      html += `    <li>${escapeHtml(item)}</li>\n`;
    }
    html += '  </ul>\n';
  }
  
  html += '</section>\n';
  
  return html;
}

export function buildRelatedToursHtml(relatedPackages: FlightPackage[], currentSlug: string): string {
  const filtered = relatedPackages
    .filter(p => p.slug !== currentSlug && p.isPublished)
    .slice(0, 3);
  
  if (filtered.length === 0) return '';
  
  let html = '<section aria-label="Related Tours">\n';
  html += '  <h2>Related Tours</h2>\n';
  html += '  <ul>\n';
  for (const pkg of filtered) {
    const url = `${CANONICAL_HOST}/packages/${pkg.slug}`;
    html += `    <li><a href="${url}">${escapeHtml(pkg.title)}</a> - From £${pkg.price || 'TBC'}</li>\n`;
  }
  html += '  </ul>\n';
  html += '</section>\n';
  
  return html;
}

export function buildItinerarySummaryHtml(pkg: FlightPackage): string {
  if (!pkg.itinerary || pkg.itinerary.length === 0) return '';
  
  const days = pkg.itinerary.slice(0, 5);
  if (days.length === 0) return '';
  
  let html = '<section aria-label="Itinerary">\n';
  html += '  <h2>Itinerary Overview</h2>\n';
  html += '  <ol>\n';
  for (const day of days) {
    const title = escapeHtml(day.title);
    const desc = escapeHtml(stripHtml(day.description).substring(0, 150));
    html += `    <li><strong>Day ${day.day}: ${title}</strong> - ${desc}...</li>\n`;
  }
  if (pkg.itinerary.length > 5) {
    html += `    <li>...and ${pkg.itinerary.length - 5} more days</li>\n`;
  }
  html += '  </ol>\n';
  html += '</section>\n';
  
  return html;
}

export function buildAllFragments(
  pkg: FlightPackage, 
  faqs: FaqItem[], 
  relatedPackages: FlightPackage[]
): string {
  let fragments = '';
  
  fragments += buildInclusionsHtml(pkg);
  fragments += buildExclusionsHtml(pkg);
  fragments += buildHighlightsHtml(pkg);
  fragments += buildItinerarySummaryHtml(pkg);
  fragments += buildRequirementsHtml(pkg);
  fragments += buildSuitabilityHtml(pkg);
  fragments += buildFaqHtml(faqs);
  fragments += buildRelatedToursHtml(relatedPackages, pkg.slug);
  fragments += buildAttentionHtml(pkg);
  
  return fragments;
}
