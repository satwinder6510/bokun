import * as cheerio from 'cheerio';
import type { InsertFlightPackage } from '@shared/schema';

const DEMO_BASE_URL = 'https://demo.flightsandpackages.com/flightsandpackages';
const FETCH_TIMEOUT = 30000;

interface ScrapeResult {
  success: boolean;
  packages: ScrapedPackage[];
  errors: string[];
  message: string;
}

async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeUrl(url: string, baseUrl: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return new URL(url, baseUrl).href;
  return new URL(url, baseUrl).href;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function parsePrice(priceStr: string): number {
  const match = priceStr.match(/[\d,]+/);
  if (match) {
    return parseInt(match[0].replace(/,/g, ''), 10);
  }
  return 0;
}

function parseCurrency(priceStr: string): string {
  if (priceStr.includes('£')) return 'GBP';
  if (priceStr.includes('$')) return 'USD';
  if (priceStr.includes('€')) return 'EUR';
  return 'GBP';
}

export interface ScrapedPackage {
  title: string;
  slug: string;
  category: string;
  price: number;
  currency: string;
  priceLabel: string;
  duration: string;
  excerpt: string;
  description: string;
  featuredImage: string;
  gallery: string[];
  highlights: string[];
  whatsIncluded: string[];
  itinerary: Array<{
    day: number;
    title: string;
    description: string;
  }>;
  accommodations: Array<{
    name: string;
    description: string;
    images: string[];
  }>;
  isPublished: boolean;
  displayOrder: number;
}

export async function scrapeHomepage(): Promise<ScrapedPackage[]> {
  const packages: ScrapedPackage[] = [];
  
  try {
    const response = await fetch(DEMO_BASE_URL + '/');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let displayOrder = 0;
    
    $('.slide-item, .cruise-offer-card, .holiday-card').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2, h3, .title').first().text().trim();
      const priceText = $el.find('.price, [class*="price"]').text();
      const durationText = $el.find('.duration, [class*="duration"], [class*="night"]').text().trim();
      const imageUrl = $el.find('img').first().attr('src') || '';
      const category = $el.find('.category, .region').text().trim() || 'Holidays';
      
      if (title && title.length > 5) {
        packages.push({
          title,
          slug: generateSlug(title),
          category: category || 'Holidays',
          price: parsePrice(priceText) || 1999,
          currency: parseCurrency(priceText),
          priceLabel: 'per person',
          duration: durationText || '7 Days / 6 Nights',
          excerpt: `Discover the wonders of ${title}`,
          description: '',
          featuredImage: imageUrl.startsWith('http') ? imageUrl : `${DEMO_BASE_URL}/${imageUrl}`,
          gallery: [],
          highlights: [],
          whatsIncluded: [],
          itinerary: [],
          accommodations: [],
          isPublished: false,
          displayOrder: displayOrder++,
        });
      }
    });
  } catch (error) {
    console.error('Error scraping homepage:', error);
  }
  
  return packages;
}

export async function scrapeItineraryPage(url: string): Promise<Partial<ScrapedPackage> | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const title = $('h1, .main-title, .package-title').first().text().trim();
    const priceText = $('.price, [class*="price"]').first().text();
    const description = $('.overview, .description, [class*="overview"]').first().text().trim();
    
    const highlights: string[] = [];
    $('.highlights li, .highlight-item').each((_, el) => {
      const text = $(el).text().trim();
      if (text) highlights.push(text);
    });
    
    const whatsIncluded: string[] = [];
    $('.whats-included li, .included-item, .includes li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) whatsIncluded.push(text);
    });
    
    const itinerary: ScrapedPackage['itinerary'] = [];
    $('.itinerary-day, .day-item, [class*="itinerary"] .day').each((i, el) => {
      const $day = $(el);
      const dayTitle = $day.find('h3, h4, .day-title').first().text().trim();
      const dayDesc = $day.find('p, .description').first().text().trim();
      
      if (dayTitle || dayDesc) {
        itinerary.push({
          day: i + 1,
          title: dayTitle || `Day ${i + 1}`,
          description: dayDesc,
        });
      }
    });
    
    const gallery: string[] = [];
    $('.gallery img, .slider img, .carousel img').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        gallery.push(src.startsWith('http') ? src : `${DEMO_BASE_URL}/${src}`);
      }
    });
    
    const accommodations: ScrapedPackage['accommodations'] = [];
    $('.accommodation-item, .hotel-card, [class*="accommodation"]').each((_, el) => {
      const $acc = $(el);
      const name = $acc.find('h3, h4, .hotel-name').first().text().trim();
      const accDesc = $acc.find('p, .description').first().text().trim();
      const accImages: string[] = [];
      
      $acc.find('img').each((_, img) => {
        const src = $(img).attr('src');
        if (src) accImages.push(src.startsWith('http') ? src : `${DEMO_BASE_URL}/${src}`);
      });
      
      if (name) {
        accommodations.push({
          name,
          description: accDesc,
          images: accImages,
        });
      }
    });
    
    return {
      title,
      slug: generateSlug(title),
      price: parsePrice(priceText),
      currency: parseCurrency(priceText),
      description,
      highlights,
      whatsIncluded,
      itinerary,
      gallery,
      accommodations,
    };
  } catch (error) {
    console.error('Error scraping itinerary page:', error);
    return null;
  }
}

export function validatePackageData(data: Partial<ScrapedPackage>): InsertFlightPackage | null {
  if (!data.title || !data.slug || !data.category || !data.price || !data.currency) {
    return null;
  }
  
  return {
    title: data.title,
    slug: data.slug,
    category: data.category,
    price: data.price,
    currency: data.currency,
    priceLabel: data.priceLabel || 'per person',
    duration: data.duration || '',
    excerpt: data.excerpt || '',
    description: data.description || '',
    featuredImage: data.featuredImage || '',
    gallery: data.gallery || [],
    highlights: data.highlights || [],
    whatsIncluded: data.whatsIncluded || [],
    itinerary: data.itinerary || [],
    accommodations: data.accommodations || [],
    otherInfo: '',
    metaTitle: data.title,
    metaDescription: data.excerpt || data.description?.substring(0, 160) || '',
    isPublished: data.isPublished ?? false,
    displayOrder: data.displayOrder ?? 0,
  };
}

export async function scrapeFromUrl(url: string): Promise<ScrapeResult> {
  const packages: ScrapedPackage[] = [];
  const errors: string[] = [];
  
  try {
    const baseUrl = new URL(url).origin;
    console.log(`Starting scrape from: ${url}`);
    
    const html = await fetchWithTimeout(url);
    const $ = cheerio.load(html);
    
    let displayOrder = 0;
    const packageLinks: string[] = [];
    
    $('a[href*="itinerary"], a[href*="package"], a[href*="holiday"], a[href*="cruise"], a[href*="offer"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes('#') && !href.includes('javascript:')) {
        const fullUrl = normalizeUrl(href, url);
        if (!packageLinks.includes(fullUrl) && fullUrl.includes(baseUrl)) {
          packageLinks.push(fullUrl);
        }
      }
    });
    
    $('.package-card, .cruise-card, .holiday-card, .offer-card, .slide-item, [class*="itinerary-card"], [class*="package-item"]').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first().attr('href');
      if (link) {
        const fullUrl = normalizeUrl(link, url);
        if (!packageLinks.includes(fullUrl) && fullUrl.includes(baseUrl)) {
          packageLinks.push(fullUrl);
        }
      }
    });
    
    console.log(`Found ${packageLinks.length} potential package links`);
    
    if (packageLinks.length > 0) {
      const limit = Math.min(packageLinks.length, 20);
      
      for (let i = 0; i < limit; i++) {
        const packageUrl = packageLinks[i];
        console.log(`Scraping package ${i + 1}/${limit}: ${packageUrl}`);
        
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const packageHtml = await fetchWithTimeout(packageUrl);
          const $pkg = cheerio.load(packageHtml);
          
          const title = $pkg('h1, .page-title, .package-title, .itinerary-title').first().text().trim();
          if (!title || title.length < 3) {
            console.log(`Skipping ${packageUrl} - no valid title found`);
            continue;
          }
          
          const priceText = $pkg('.price, [class*="price"], .cost').first().text();
          const price = parsePrice(priceText) || 1999;
          const currency = parseCurrency(priceText);
          
          const description = $pkg('.overview, .description, [class*="overview"], .content p').first().text().trim();
          const excerpt = description.substring(0, 200) + (description.length > 200 ? '...' : '');
          
          const durationText = $pkg('.duration, [class*="duration"], [class*="nights"], [class*="days"]').first().text().trim();
          
          let category = $pkg('.category, .region, .destination, [class*="category"]').first().text().trim();
          if (!category) {
            if (title.toLowerCase().includes('africa') || title.toLowerCase().includes('safari')) category = 'Africa';
            else if (title.toLowerCase().includes('asia') || title.toLowerCase().includes('thai') || title.toLowerCase().includes('bali')) category = 'Asia';
            else if (title.toLowerCase().includes('europ') || title.toLowerCase().includes('italy') || title.toLowerCase().includes('spain')) category = 'Europe';
            else if (title.toLowerCase().includes('cruise')) category = 'Cruises';
            else category = 'Holidays';
          }
          
          const featuredImage = $pkg('img.hero, .hero img, .banner img, .featured-image img, header img').first().attr('src') || 
                               $pkg('img').first().attr('src') || '';
          
          const gallery: string[] = [];
          $pkg('.gallery img, .slider img, .carousel img, .photos img').each((_, img) => {
            const src = $pkg(img).attr('src');
            if (src) gallery.push(normalizeUrl(src, packageUrl));
          });
          
          const highlights: string[] = [];
          $pkg('.highlights li, .highlight-item, [class*="highlight"] li').each((_, li) => {
            const text = $pkg(li).text().trim();
            if (text && text.length > 3) highlights.push(text);
          });
          
          const whatsIncluded: string[] = [];
          $pkg('.whats-included li, .included-item, [class*="include"] li, .inclusions li').each((_, li) => {
            const text = $pkg(li).text().trim();
            if (text && text.length > 3) whatsIncluded.push(text);
          });
          
          const itinerary: ScrapedPackage['itinerary'] = [];
          $pkg('.itinerary-day, .day-item, [class*="itinerary"] .day, .timeline-item, [class*="day-"]').each((j, day) => {
            const $day = $pkg(day);
            const dayTitle = $day.find('h3, h4, .day-title, .title').first().text().trim();
            const dayDesc = $day.find('p, .description, .content').first().text().trim();
            
            if (dayTitle || dayDesc) {
              itinerary.push({
                day: j + 1,
                title: dayTitle || `Day ${j + 1}`,
                description: dayDesc,
              });
            }
          });
          
          const accommodations: ScrapedPackage['accommodations'] = [];
          $pkg('.accommodation-item, .hotel-card, [class*="accommodation"], .hotel-item, [class*="hotel"]').each((_, acc) => {
            const $acc = $pkg(acc);
            const name = $acc.find('h3, h4, .hotel-name, .name').first().text().trim();
            const accDesc = $acc.find('p, .description').first().text().trim();
            const accImages: string[] = [];
            
            $acc.find('img').each((_, img) => {
              const src = $pkg(img).attr('src');
              if (src) accImages.push(normalizeUrl(src, packageUrl));
            });
            
            if (name && name.length > 2) {
              accommodations.push({
                name,
                description: accDesc,
                images: accImages,
              });
            }
          });
          
          packages.push({
            title,
            slug: generateSlug(title),
            category,
            price,
            currency,
            priceLabel: 'per person',
            duration: durationText || '7 Days / 6 Nights',
            excerpt,
            description,
            featuredImage: normalizeUrl(featuredImage, packageUrl),
            gallery,
            highlights,
            whatsIncluded,
            itinerary,
            accommodations,
            isPublished: false,
            displayOrder: displayOrder++,
          });
          
          console.log(`Successfully scraped: ${title}`);
          
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Failed to scrape ${packageUrl}: ${errorMsg}`);
          console.error(`Error scraping ${packageUrl}:`, errorMsg);
        }
      }
    }
    
    if (packages.length === 0) {
      console.log('No package links found, trying to scrape current page as a single package...');
      
      const title = $('h1, .page-title, .package-title').first().text().trim();
      const priceText = $('.price, [class*="price"]').first().text();
      const description = $('.overview, .description, [class*="overview"]').first().text().trim();
      
      if (title && title.length > 3) {
        packages.push({
          title,
          slug: generateSlug(title),
          category: 'Holidays',
          price: parsePrice(priceText) || 1999,
          currency: parseCurrency(priceText),
          priceLabel: 'per person',
          duration: '7 Days / 6 Nights',
          excerpt: description.substring(0, 200),
          description,
          featuredImage: $('img').first().attr('src') || '',
          gallery: [],
          highlights: [],
          whatsIncluded: [],
          itinerary: [],
          accommodations: [],
          isPublished: false,
          displayOrder: 0,
        });
      }
    }
    
    return {
      success: packages.length > 0,
      packages,
      errors,
      message: packages.length > 0 
        ? `Successfully scraped ${packages.length} package(s)` 
        : 'No packages could be extracted from the URL. The page structure may not be compatible.',
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Scrape error:', errorMsg);
    return {
      success: false,
      packages: [],
      errors: [errorMsg],
      message: `Failed to scrape URL: ${errorMsg}`,
    };
  }
}

export const samplePackages: InsertFlightPackage[] = [
  {
    title: "Thailand, Bali & Malaysia Adventure",
    slug: "thailand-bali-malaysia-adventure",
    category: "Asia",
    price: 1499,
    currency: "GBP",
    priceLabel: "per person",
    duration: "14 Nights / 15 Days",
    excerpt: "Experience the best of Southeast Asia with this incredible three-country adventure featuring beaches, temples, and vibrant cities.",
    description: "Embark on an unforgettable journey through three of Southeast Asia's most captivating destinations. Begin your adventure in vibrant Thailand, where ancient temples meet modern city life. Continue to the magical island of Bali, known for its artistic culture and stunning landscapes. Finally, explore the diverse wonders of Malaysia, from the towering Petronas Towers to pristine tropical beaches.",
    featuredImage: "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800",
    gallery: [
      "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800",
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800",
      "https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?w=800",
      "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800"
    ],
    highlights: [
      "Visit the magnificent Grand Palace and Wat Pho in Bangkok",
      "Explore the stunning rice terraces of Ubud, Bali",
      "Relax on the pristine beaches of Phuket and Langkawi",
      "Experience the vibrant night markets of Kuala Lumpur",
      "Discover ancient temples and spiritual ceremonies",
      "Enjoy authentic local cuisine across three countries"
    ],
    whatsIncluded: [
      "Return flights from London Heathrow",
      "All internal flights between destinations",
      "14 nights accommodation in 4-star hotels",
      "Daily breakfast at all hotels",
      "Private airport transfers throughout",
      "Full-day guided tours in each destination",
      "Entrance fees to all major attractions",
      "24/7 local support and emergency assistance"
    ],
    itinerary: [
      { day: 1, title: "Departure from UK", description: "Depart from London Heathrow on your overnight flight to Bangkok, Thailand." },
      { day: 2, title: "Arrival in Bangkok", description: "Arrive in Bangkok and transfer to your hotel. Spend the evening exploring the vibrant Khao San Road area. Dinner included at Centara Grand at Central World, Bangkok." },
      { day: 3, title: "Bangkok City Tour", description: "Full day exploring the Grand Palace, Wat Pho, and the famous reclining Buddha. Evening cruise on the Chao Phraya River. Breakfast and lunch included." },
      { day: 4, title: "Bangkok to Phuket", description: "Morning flight to Phuket. Afternoon at leisure to enjoy the beach and pool at Kata Beach Resort, Phuket." },
      { day: 5, title: "Phuket Island Tour", description: "Island hopping tour visiting Phi Phi Islands, Maya Bay, and snorkeling opportunities. Breakfast and lunch included." },
      { day: 6, title: "Phuket to Bali", description: "Fly to Bali and transfer to your resort in Seminyak. Evening at leisure at The Legian Seminyak, Bali." },
      { day: 7, title: "Bali Temples & Rice Terraces", description: "Visit Tanah Lot Temple and the stunning Tegallalang Rice Terraces in Ubud. Breakfast and lunch included." },
      { day: 8, title: "Ubud Cultural Experience", description: "Full day in Ubud exploring the Monkey Forest, art markets, and traditional dance performance. Breakfast and dinner included." },
      { day: 9, title: "Bali Beach Day", description: "Free day to relax at the resort, enjoy spa treatments, or explore on your own." },
      { day: 10, title: "Bali to Kuala Lumpur", description: "Fly to Kuala Lumpur, Malaysia. Evening visit to the Petronas Twin Towers. Breakfast and dinner included at Mandarin Oriental." },
      { day: 11, title: "Kuala Lumpur City Tour", description: "Full day exploring Batu Caves, Merdeka Square, and the bustling Central Market. Breakfast and lunch included." },
      { day: 12, title: "KL to Langkawi", description: "Morning flight to Langkawi island. Afternoon cable car ride and sky bridge experience at The Datai Langkawi." },
      { day: 13, title: "Langkawi Island Tour", description: "Island hopping tour and mangrove cruise. Evening sunset dinner on the beach. Breakfast and dinner included." },
      { day: 14, title: "Langkawi Beach Day", description: "Final day at leisure to enjoy the pristine beaches and resort facilities." },
      { day: 15, title: "Return to UK", description: "Transfer to airport for your return flight to London. Arrive home with wonderful memories." }
    ],
    accommodations: [
      {
        name: "Centara Grand at Central World, Bangkok (2 nights)",
        description: "Luxury 5-star hotel in the heart of Bangkok, connected to one of the largest shopping malls in Southeast Asia. Features stunning city views, world-class dining, rooftop pool, spa & wellness, fine dining, fitness center, and free WiFi.",
        images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"]
      },
      {
        name: "Kata Beach Resort, Phuket (2 nights)",
        description: "Beachfront 4-star resort overlooking Kata Beach with traditional Thai architecture and modern amenities. Perfect for beach lovers and water sports enthusiasts. Features private beach, swimming pools, spa, water sports, and multiple restaurants.",
        images: ["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800"]
      },
      {
        name: "The Legian Seminyak, Bali (4 nights)",
        description: "Award-winning 5-star luxury resort on Seminyak Beach offering spacious suites, personalized butler service, and breathtaking sunset views over the Indian Ocean. Features private pool suites, butler service, beachfront location, spa, and fine dining.",
        images: ["https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800"]
      },
      {
        name: "Mandarin Oriental, Kuala Lumpur (2 nights)",
        description: "Iconic 5-star luxury hotel at the foot of the Petronas Twin Towers. Experience legendary service, exquisite dining, and the finest accommodation in the city. Features city views, award-winning spa, multiple restaurants, pool, and club lounge.",
        images: ["https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800"]
      },
      {
        name: "The Datai Langkawi (3 nights)",
        description: "Nestled in an ancient rainforest, this award-winning 5-star resort offers unparalleled seclusion, natural beauty, and world-class facilities on one of Malaysia's most beautiful beaches. Features rainforest setting, private beach, golf course, nature trails, and holistic spa.",
        images: ["https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?w=800"]
      }
    ],
    metaTitle: "Thailand, Bali & Malaysia Adventure - 15 Day Tour | Flights and Packages",
    metaDescription: "Experience the best of Southeast Asia on this 15-day adventure through Thailand, Bali, and Malaysia. Includes flights, 4-5 star hotels, and guided tours.",
    isPublished: false,
    displayOrder: 1
  },
  {
    title: "Best of Italy: Rome, Florence & Venice",
    slug: "best-of-italy-rome-florence-venice",
    category: "Europe",
    price: 1299,
    currency: "GBP",
    priceLabel: "per person",
    duration: "7 Days / 6 Nights",
    excerpt: "Discover Italy's most iconic cities on this classic tour featuring ancient ruins, Renaissance art, and romantic canals.",
    description: "Journey through Italy's cultural heartland on this unforgettable 7-day tour. Begin in the Eternal City of Rome, where ancient history comes alive at the Colosseum and Vatican. Travel to Florence, the birthplace of the Renaissance, and marvel at Michelangelo's David. End your adventure in magical Venice, gliding through romantic canals and exploring St. Mark's Square.",
    featuredImage: "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=800",
    gallery: [
      "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=800",
      "https://images.unsplash.com/photo-1534445867742-43195f401b6c?w=800",
      "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=800",
      "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800"
    ],
    highlights: [
      "Skip-the-line access to the Colosseum and Vatican Museums",
      "See Michelangelo's David at the Accademia Gallery",
      "Romantic gondola ride through Venice's canals",
      "Traditional cooking class in Florence",
      "High-speed train travel between cities",
      "Expert local guides at all major sites"
    ],
    whatsIncluded: [
      "Return flights from London to Rome, returning from Venice",
      "6 nights in centrally located 4-star hotels",
      "Daily breakfast and 2 dinners",
      "High-speed train tickets between cities",
      "Skip-the-line entrance to major attractions",
      "Professional English-speaking guides",
      "Venice water taxi transfers",
      "Authentic Italian cooking class"
    ],
    itinerary: [
      { day: 1, title: "Arrival in Rome", description: "Arrive at Rome Fiumicino Airport and transfer to your hotel near the Spanish Steps. Evening walking tour of Rome's famous fountains. Welcome dinner at Hotel de Russie." },
      { day: 2, title: "Ancient Rome", description: "Full day exploring the Colosseum, Roman Forum, and Palatine Hill with skip-the-line access. Afternoon visit to the Pantheon. Breakfast included." },
      { day: 3, title: "Vatican City", description: "Morning tour of the Vatican Museums, Sistine Chapel, and St. Peter's Basilica. Afternoon at leisure. Breakfast included." },
      { day: 4, title: "Rome to Florence", description: "High-speed train to Florence. Afternoon walking tour including Piazza della Signoria and Ponte Vecchio. Evening cooking class with dinner at Portrait Firenze." },
      { day: 5, title: "Florence Art & Culture", description: "Visit the Uffizi Gallery and Accademia to see Michelangelo's David. Afternoon free to explore the leather markets. Breakfast included." },
      { day: 6, title: "Florence to Venice", description: "Train to Venice. Afternoon exploration of St. Mark's Square and Doge's Palace. Sunset gondola ride. Stay at Gritti Palace." },
      { day: 7, title: "Departure from Venice", description: "Morning at leisure for final exploration. Transfer to Venice Marco Polo Airport for your flight home. Breakfast included." }
    ],
    accommodations: [
      {
        name: "Hotel de Russie, Rome (3 nights)",
        description: "Elegant 5-star hotel between the Spanish Steps and Piazza del Popolo, featuring beautiful secret gardens, a renowned luxury spa, exceptional fine dining, fitness center, and concierge service.",
        images: ["https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=800"]
      },
      {
        name: "Portrait Firenze, Florence (2 nights)",
        description: "Boutique 5-star luxury hotel on the Arno River offering stunning views of Ponte Vecchio. Part of the exclusive Lungarno Collection. Features river views, rooftop terrace, personalized service, art collection, and premium location.",
        images: ["https://images.unsplash.com/photo-1534445867742-43195f401b6c?w=800"]
      },
      {
        name: "Gritti Palace, Venice (1 night)",
        description: "Historic 5-star palazzo on the Grand Canal offering legendary Venetian hospitality, exquisite Michelin dining, breathtaking water views, water taxi service, and the famous Club del Doge Restaurant.",
        images: ["https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=800"]
      }
    ],
    metaTitle: "Best of Italy Tour: Rome, Florence & Venice | 7 Days | Flights and Packages",
    metaDescription: "Experience Italy's finest cities on this 7-day tour. Visit the Colosseum, see Michelangelo's David, and enjoy a gondola ride in Venice. Flights included.",
    isPublished: false,
    displayOrder: 2
  },
  {
    title: "African Safari: Kenya & Tanzania",
    slug: "african-safari-kenya-tanzania",
    category: "Africa",
    price: 3499,
    currency: "GBP",
    priceLabel: "per person",
    duration: "10 Days / 9 Nights",
    excerpt: "Witness the Big Five and the Great Migration on this once-in-a-lifetime safari adventure through East Africa.",
    description: "Experience the ultimate African adventure on this 10-day safari through Kenya and Tanzania. Witness the magnificent wildlife of the Masai Mara, stand in awe at the Serengeti's endless plains, and descend into the Ngorongoro Crater - the world's largest intact caldera. This expertly crafted journey puts you at the heart of nature's greatest spectacle.",
    featuredImage: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800",
    gallery: [
      "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800",
      "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=800",
      "https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=800",
      "https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800"
    ],
    highlights: [
      "Witness the Big Five: Lion, Elephant, Buffalo, Leopard & Rhino",
      "Experience the Great Migration (seasonal)",
      "Descend into the Ngorongoro Crater",
      "Visit an authentic Maasai village",
      "Sundowner drinks on the African plains",
      "Expert naturalist guides throughout"
    ],
    whatsIncluded: [
      "Return flights from London to Nairobi",
      "Internal flights Nairobi-Serengeti-Nairobi",
      "9 nights in premium safari lodges and tented camps",
      "All meals during safari (Full Board)",
      "All game drives in 4x4 vehicles",
      "Park entrance fees and conservation levies",
      "Professional English-speaking safari guides",
      "Flying Doctors emergency evacuation insurance"
    ],
    itinerary: [
      { day: 1, title: "Arrival in Nairobi", description: "Arrive in Nairobi and transfer to your hotel. Evening welcome dinner and safari briefing at Hemingways Nairobi." },
      { day: 2, title: "Nairobi to Masai Mara", description: "Morning flight to the Masai Mara. Afternoon game drive to spot lions, cheetahs, and elephants. All meals included at Mara Serena Safari Lodge." },
      { day: 3, title: "Masai Mara Safari", description: "Full day of game drives including a visit to the Mara River. Optional hot air balloon safari. All meals included." },
      { day: 4, title: "Maasai Village & Safari", description: "Morning visit to an authentic Maasai village. Afternoon game drive. Sundowner drinks on the plains. All meals included." },
      { day: 5, title: "Masai Mara to Serengeti", description: "Cross into Tanzania and drive to the Serengeti. Afternoon game viewing en route. All meals at Four Seasons Safari Lodge Serengeti." },
      { day: 6, title: "Serengeti Full Day", description: "Full day exploring the Serengeti plains searching for big cats, elephants, and wildebeest herds. All meals included." },
      { day: 7, title: "Serengeti Sunrise Drive", description: "Early morning game drive to catch predators on the hunt. Afternoon at leisure enjoying lodge facilities. All meals included." },
      { day: 8, title: "Serengeti to Ngorongoro", description: "Drive to the Ngorongoro Conservation Area. Afternoon nature walk with Maasai guides. All meals at Ngorongoro Serena Safari Lodge." },
      { day: 9, title: "Ngorongoro Crater", description: "Full day exploring the crater floor - home to the densest concentration of wildlife in Africa. All meals included." },
      { day: 10, title: "Return to UK", description: "Morning flight to Arusha, then connect to your international flight home via Nairobi. Breakfast included." }
    ],
    accommodations: [
      {
        name: "Hemingways Nairobi (1 night)",
        description: "Intimate 5-star boutique hotel in the leafy Karen suburb, offering colonial elegance with modern luxury. Named after the famous author who loved Kenya. Features spa, fine dining, gardens, library, and boutique rooms.",
        images: ["https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=800"]
      },
      {
        name: "Mara Serena Safari Lodge (3 nights)",
        description: "Perched on a hill overlooking the Mara Triangle, this stunning 4-star lodge offers panoramic views and traditional Maasai-inspired architecture. Features infinity pool, game drives, bush dinners, wildlife viewing deck, and spa.",
        images: ["https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=800"]
      },
      {
        name: "Four Seasons Safari Lodge Serengeti (3 nights)",
        description: "Ultra-luxury 5-star lodge in the heart of the Serengeti offering private infinity pool suites and unparalleled wildlife viewing from your room. Features private pools, spa, discovery centre, multiple restaurants, and wildlife watering hole.",
        images: ["https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=800"]
      },
      {
        name: "Ngorongoro Serena Safari Lodge (2 nights)",
        description: "Built into the crater rim, this remarkable 4-star lodge offers stunning views into the world's largest intact volcanic caldera. Features crater views, stone architecture, local artwork, viewing platform, and restaurant.",
        images: ["https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800"]
      }
    ],
    metaTitle: "African Safari: Kenya & Tanzania | 10 Days | Flights and Packages",
    metaDescription: "Witness the Big Five on this 10-day luxury safari through Kenya and Tanzania. Visit Masai Mara, Serengeti, and Ngorongoro Crater. Flights included.",
    isPublished: false,
    displayOrder: 3
  }
];
