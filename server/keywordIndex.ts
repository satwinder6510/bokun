/**
 * Keyword Index for AI Search
 * 
 * Scans package content and builds a searchable keyword index
 * that maps holiday types to packages based on their content.
 */

export interface KeywordMatch {
  holidayType: string;
  score: number;
  matchedTerms: string[];
}

export interface PackageKeywordIndex {
  packageId: number;
  extractedKeywords: string[];
  holidayTypeMatches: KeywordMatch[];
  destinationKeywords: string[];
}

// Holiday type keyword definitions - expanded for better matching
const holidayTypeKeywordSets: Record<string, { primary: string[]; secondary: string[] }> = {
  "Beach": {
    primary: ["beach", "beaches", "beachfront", "seaside", "oceanfront", "sandy", "coastline"],
    secondary: ["ocean", "sea", "coastal", "tropical", "island", "resort", "sun", "swimming", "snorkeling", "diving", "lagoon", "reef", "palm", "paradise", "relaxation", "sunset"]
  },
  "Adventure": {
    primary: ["adventure", "trekking", "hiking", "climbing", "rafting", "kayaking", "expedition"],
    secondary: ["outdoor", "active", "extreme", "adrenaline", "zipline", "jungle", "mountain", "trail", "explore", "excursion", "challenge", "wilderness", "camping", "biking", "cycling"]
  },
  "Cultural": {
    primary: ["cultural", "culture", "heritage", "historical", "museum", "temple", "ancient"],
    secondary: ["history", "art", "architecture", "ruins", "tradition", "local", "authentic", "historic", "monastery", "palace", "cathedral", "church", "mosque", "shrine", "archaeological", "civilization", "customs", "festival"]
  },
  "City Break": {
    primary: ["city break", "citybreak", "city tour", "urban", "metropolitan"],
    secondary: ["city", "downtown", "capital", "shopping", "nightlife", "restaurants", "skyline", "cosmopolitan", "market", "street", "cafe", "bars"]
  },
  "Cruise": {
    primary: ["cruise", "cruising", "ocean cruise", "sea cruise"],
    secondary: ["ship", "sailing", "yacht", "boat", "ocean liner", "cabin", "port", "onboard", "deck", "captain", "voyage"]
  },
  "River Cruise": {
    primary: ["river cruise", "riverboat", "river boat", "barge cruise"],
    secondary: ["river", "barge", "canal", "danube", "rhine", "nile", "mekong", "amazon", "douro", "seine", "waterway", "floating"]
  },
  "Safari": {
    primary: ["safari", "game drive", "game reserve", "wildlife reserve"],
    secondary: ["big five", "savanna", "savannah", "bush", "african wildlife", "serengeti", "masai", "kruger", "jeep", "ranger", "lodge", "camp", "game viewing"]
  },
  "Wildlife": {
    primary: ["wildlife", "bird watching", "birding", "nature reserve", "national park"],
    secondary: ["animals", "nature", "whale", "dolphin", "gorilla", "elephant", "lion", "tiger", "leopard", "sanctuary", "conservation", "endangered", "species", "fauna", "flora", "ecosystem"]
  },
  "Luxury": {
    primary: ["luxury", "luxurious", "5-star", "five star", "premium", "exclusive"],
    secondary: ["boutique", "villa", "private", "vip", "spa", "wellness", "gourmet", "champagne", "butler", "suite", "opulent", "elegant", "refined", "indulgence", "pampering"]
  },
  "Multi-Centre": {
    primary: ["multi-centre", "multi-center", "multi centre", "twin centre", "combination tour"],
    secondary: ["multiple destinations", "twin center", "two countries", "three countries", "combined", "circuit", "grand tour"]
  },
  "Island": {
    primary: ["island", "islands", "archipelago", "isle", "island hopping"],
    secondary: ["caribbean", "maldives", "seychelles", "mauritius", "fiji", "bali", "greek islands", "canary", "azores", "madeira", "zanzibar", "hawaii", "polynesia", "tropical island"]
  },
  "Solo Travellers": {
    primary: ["solo", "solo traveller", "solo traveler", "single supplement", "no single supplement"],
    secondary: ["single", "alone", "individual", "independent", "single room", "solo friendly"]
  },
  "Honeymoon": {
    primary: ["honeymoon", "romantic", "romance", "couples"],
    secondary: ["wedding", "anniversary", "love", "intimate", "secluded", "candlelit", "champagne", "sunset dinner", "private pool"]
  },
  "Family": {
    primary: ["family", "family-friendly", "kid-friendly", "children"],
    secondary: ["kids", "child", "multi-generational", "theme park", "playground", "fun", "educational"]
  }
};

// Destination keywords for better location matching
const destinationKeywords: Record<string, string[]> = {
  "India": ["india", "indian", "delhi", "mumbai", "jaipur", "kerala", "goa", "rajasthan", "taj mahal", "agra", "bangalore", "chennai", "golden triangle", "himalaya"],
  "Maldives": ["maldives", "maldivian", "male", "atoll", "overwater", "water villa"],
  "Sri Lanka": ["sri lanka", "sri lankan", "colombo", "kandy", "sigiriya", "galle", "ceylon"],
  "Thailand": ["thailand", "thai", "bangkok", "phuket", "chiang mai", "krabi", "koh samui", "pattaya"],
  "Vietnam": ["vietnam", "vietnamese", "hanoi", "ho chi minh", "saigon", "halong", "hoi an", "mekong"],
  "Japan": ["japan", "japanese", "tokyo", "kyoto", "osaka", "mount fuji", "cherry blossom", "sakura"],
  "South Africa": ["south africa", "cape town", "johannesburg", "kruger", "garden route", "safari"],
  "Kenya": ["kenya", "kenyan", "nairobi", "masai mara", "mombasa", "amboseli", "safari"],
  "Tanzania": ["tanzania", "tanzanian", "serengeti", "zanzibar", "kilimanjaro", "ngorongoro", "safari"],
  "Egypt": ["egypt", "egyptian", "cairo", "luxor", "aswan", "nile", "pyramid", "pharaoh", "sphinx"],
  "Morocco": ["morocco", "moroccan", "marrakech", "fez", "casablanca", "sahara", "medina", "atlas"],
  "Greece": ["greece", "greek", "athens", "santorini", "mykonos", "crete", "rhodes", "acropolis"],
  "Italy": ["italy", "italian", "rome", "venice", "florence", "milan", "tuscany", "amalfi", "sicily"],
  "Spain": ["spain", "spanish", "barcelona", "madrid", "seville", "malaga", "ibiza", "canary"],
  "Portugal": ["portugal", "portuguese", "lisbon", "porto", "algarve", "madeira", "azores"],
  "Turkey": ["turkey", "turkish", "istanbul", "cappadocia", "antalya", "bodrum", "ephesus"],
  "Dubai": ["dubai", "uae", "abu dhabi", "emirates", "arabian", "burj", "desert safari"],
  "Bali": ["bali", "balinese", "ubud", "seminyak", "kuta", "indonesian"],
  "Australia": ["australia", "australian", "sydney", "melbourne", "queensland", "great barrier reef", "uluru"],
  "New Zealand": ["new zealand", "auckland", "queenstown", "milford sound", "hobbiton", "maori"],
  "Peru": ["peru", "peruvian", "lima", "cusco", "machu picchu", "inca", "sacred valley", "amazon"],
  "Costa Rica": ["costa rica", "costa rican", "san jose", "arenal", "monteverde", "rainforest"],
  "Mexico": ["mexico", "mexican", "cancun", "playa del carmen", "riviera maya", "tulum", "aztec", "mayan"],
  "Cuba": ["cuba", "cuban", "havana", "trinidad", "vintage cars", "salsa"],
  "Caribbean": ["caribbean", "jamaica", "bahamas", "barbados", "st lucia", "antigua", "aruba", "turks caicos"]
};

/**
 * Extract keywords from text content
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  
  // Clean HTML and normalize
  const cleanText = text
    .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
    .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
    .replace(/[^\w\s-]/g, ' ')  // Remove special chars except hyphens
    .toLowerCase()
    .trim();
  
  // Split into words and filter
  const words = cleanText.split(/\s+/).filter(w => w.length > 2);
  
  // Return unique words
  return Array.from(new Set(words));
}

/**
 * Calculate holiday type matches for a package based on its content
 */
function calculateHolidayTypeMatches(
  keywords: string[],
  existingTags: string[]
): KeywordMatch[] {
  const matches: KeywordMatch[] = [];
  const keywordText = keywords.join(' ');
  
  for (const [holidayType, { primary, secondary }] of Object.entries(holidayTypeKeywordSets)) {
    let score = 0;
    const matchedTerms: string[] = [];
    
    // Check if holiday type is already in tags (highest score)
    if (existingTags.some(tag => tag.toLowerCase() === holidayType.toLowerCase())) {
      score += 50;
      matchedTerms.push(`tag:${holidayType}`);
    }
    
    // Check primary keywords (high score)
    for (const keyword of primary) {
      if (keywordText.includes(keyword)) {
        score += 15;
        matchedTerms.push(keyword);
      }
    }
    
    // Check secondary keywords (lower score)
    for (const keyword of secondary) {
      if (keywordText.includes(keyword)) {
        score += 5;
        matchedTerms.push(keyword);
      }
    }
    
    if (score > 0) {
      matches.push({ holidayType, score, matchedTerms });
    }
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Extract destination keywords from content
 */
function extractDestinationKeywords(keywords: string[], category: string, countries: string[]): string[] {
  const matched: string[] = [];
  const keywordText = keywords.join(' ');
  
  // Add category and countries
  if (category) matched.push(category.toLowerCase());
  for (const country of countries) {
    matched.push(country.toLowerCase());
  }
  
  // Check for destination keyword matches
  for (const [destination, destKeywords] of Object.entries(destinationKeywords)) {
    for (const keyword of destKeywords) {
      if (keywordText.includes(keyword)) {
        matched.push(destination.toLowerCase());
        break;
      }
    }
  }
  
  return Array.from(new Set(matched));
}

/**
 * Build keyword index for a single package
 */
export function indexPackage(pkg: {
  id: number;
  title: string;
  description?: string | null;
  excerpt?: string | null;
  category: string;
  countries?: string[];
  tags?: string[];
  highlights?: string[];
  whatsIncluded?: string[];
  itinerary?: Array<{ title: string; description: string }>;
}): PackageKeywordIndex {
  // Combine all text content
  const textParts: string[] = [
    pkg.title,
    pkg.description || '',
    pkg.excerpt || '',
    pkg.category,
    ...(pkg.countries || []),
    ...(pkg.tags || []),
    ...(pkg.highlights || []),
    ...(pkg.whatsIncluded || []),
    ...(pkg.itinerary?.map(i => `${i.title} ${i.description}`) || [])
  ];
  
  const fullText = textParts.join(' ');
  const extractedKeywords = extractKeywords(fullText);
  
  return {
    packageId: pkg.id,
    extractedKeywords,
    holidayTypeMatches: calculateHolidayTypeMatches(extractedKeywords, pkg.tags || []),
    destinationKeywords: extractDestinationKeywords(extractedKeywords, pkg.category, pkg.countries || [])
  };
}

/**
 * Score a package against search filters using the keyword index
 */
export function scorePackageWithIndex(
  index: PackageKeywordIndex,
  holidayTypeFilters: string[]
): number {
  if (holidayTypeFilters.length === 0) {
    return 10; // Base score when no filters
  }
  
  let totalScore = 0;
  let matchCount = 0;
  
  for (const filter of holidayTypeFilters) {
    const match = index.holidayTypeMatches.find(
      m => m.holidayType.toLowerCase() === filter.toLowerCase()
    );
    
    if (match) {
      totalScore += match.score;
      matchCount++;
    }
  }
  
  // Bonus for matching multiple filters
  if (matchCount > 1) {
    totalScore += matchCount * 10;
  }
  
  return totalScore;
}

// In-memory cache for the keyword index
let packageKeywordIndex: Map<number, PackageKeywordIndex> = new Map();

/**
 * Build keyword index for all packages
 */
export function buildPackageIndex(packages: Array<{
  id: number;
  title: string;
  description?: string | null;
  excerpt?: string | null;
  category: string;
  countries?: string[];
  tags?: string[];
  highlights?: string[];
  whatsIncluded?: string[];
  itinerary?: Array<{ title: string; description: string }>;
}>): void {
  console.log(`[Keyword Index] Building index for ${packages.length} packages...`);
  
  packageKeywordIndex = new Map();
  
  for (const pkg of packages) {
    const index = indexPackage(pkg);
    packageKeywordIndex.set(pkg.id, index);
  }
  
  // Log some stats
  let totalMatches = 0;
  const typeCounts: Record<string, number> = {};
  
  const indexValues = Array.from(packageKeywordIndex.values());
  for (const index of indexValues) {
    for (const match of index.holidayTypeMatches) {
      totalMatches++;
      typeCounts[match.holidayType] = (typeCounts[match.holidayType] || 0) + 1;
    }
  }
  
  console.log(`[Keyword Index] Index built: ${packageKeywordIndex.size} packages, ${totalMatches} holiday type matches`);
  console.log(`[Keyword Index] Holiday type distribution:`, typeCounts);
}

/**
 * Get the keyword index for a package
 */
export function getPackageIndex(packageId: number): PackageKeywordIndex | undefined {
  return packageKeywordIndex.get(packageId);
}

/**
 * Check if keyword index is built
 */
export function isIndexBuilt(): boolean {
  return packageKeywordIndex.size > 0;
}

/**
 * Get holiday type keywords for reference
 */
export function getHolidayTypeKeywords(): Record<string, { primary: string[]; secondary: string[] }> {
  return holidayTypeKeywordSets;
}
