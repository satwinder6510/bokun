import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TourCard } from "@/components/TourCard";
import { FlightPackageCard, CityTaxInfo } from "@/components/FlightPackageCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, MapPin, Plane, Map, BookOpen, Calendar, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { setMetaTags, addJsonLD, generateBreadcrumbSchema } from "@/lib/meta-tags";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import type { FlightPackage, BokunProduct, BlogPost, CityTax } from "@shared/schema";

interface DestinationData {
  destination: string;
  flightPackages: FlightPackage[];
  landTours: BokunProduct[];
  blogPosts: BlogPost[];
}

function formatDate(dateString: string | Date | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <article 
        className="group cursor-pointer h-full"
        itemScope 
        itemType="https://schema.org/BlogPosting"
        data-testid={`card-blog-${post.id}`}
      >
        <Card className="overflow-hidden h-full hover-elevate">
          {post.featuredImage && (
            <div className="relative aspect-[16/9] overflow-hidden bg-muted">
              <img 
                src={getProxiedImageUrl(post.featuredImage)} 
                alt={post.title}
                width={640}
                height={360}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                itemProp="image"
                loading="lazy"
                decoding="async"
              />
            </div>
          )}
          <CardContent className="p-4">
            <h3 
              className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors"
              itemProp="headline"
            >
              {post.title}
            </h3>
            <p 
              className="text-muted-foreground text-sm mb-3 line-clamp-2"
              itemProp="description"
            >
              {post.excerpt}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {post.author && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span itemProp="author">{post.author}</span>
                </div>
              )}
              {post.publishedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <time dateTime={new Date(post.publishedAt).toISOString()} itemProp="datePublished">
                    {formatDate(post.publishedAt)}
                  </time>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </article>
    </Link>
  );
}


// Helper to parse duration string like "9 Days / 7 Nights" into nights
function parseDurationNights(duration: string | null): number {
  if (!duration) return 0;
  const nightsMatch = duration.match(/(\d+)\s*nights?/i);
  if (nightsMatch) return parseInt(nightsMatch[1], 10);
  const daysMatch = duration.match(/(\d+)\s*days?/i);
  if (daysMatch) return Math.max(0, parseInt(daysMatch[1], 10) - 1);
  return 0;
}

// Helper to get city tax rate for a star rating (default 4★)
function getCityTaxRate(cityTax: CityTax, starRating: number = 4): number {
  if (cityTax.pricingType === 'star_rating') {
    switch (starRating) {
      case 1: return cityTax.rate1Star ?? cityTax.taxPerNightPerPerson ?? 0;
      case 2: return cityTax.rate2Star ?? cityTax.taxPerNightPerPerson ?? 0;
      case 3: return cityTax.rate3Star ?? cityTax.taxPerNightPerPerson ?? 0;
      case 4: return cityTax.rate4Star ?? cityTax.taxPerNightPerPerson ?? 0;
      case 5: return cityTax.rate5Star ?? cityTax.taxPerNightPerPerson ?? 0;
      default: return cityTax.taxPerNightPerPerson ?? 0;
    }
  }
  return cityTax.taxPerNightPerPerson ?? 0;
}

// Country name to code mapping
const countryToCode: Record<string, string> = {
  'india': 'IN', 'indian': 'IN',
  'italy': 'IT', 'italian': 'IT',
  'france': 'FR', 'french': 'FR',
  'spain': 'ES', 'spanish': 'ES',
  'portugal': 'PT', 'portuguese': 'PT',
  'greece': 'GR', 'greek': 'GR',
  'germany': 'DE', 'german': 'DE',
  'austria': 'AT', 'austrian': 'AT',
  'switzerland': 'CH', 'swiss': 'CH',
  'belgium': 'BE',
  'czech': 'CZ', 'czechia': 'CZ',
  'hungary': 'HU', 'hungarian': 'HU',
  'bulgaria': 'BG', 'bulgarian': 'BG',
  'slovakia': 'SK', 'slovak': 'SK',
  'denmark': 'DK', 'danish': 'DK',
  'estonia': 'EE', 'estonian': 'EE',
  'croatia': 'HR', 'croatian': 'HR',
  'montenegro': 'ME',
  'romania': 'RO', 'romanian': 'RO',
  'latvia': 'LV',
  'iceland': 'IS', 'icelandic': 'IS',
  'dubai': 'AE', 'uae': 'AE', 'emirates': 'AE',
  'morocco': 'MA', 'moroccan': 'MA',
  'maldives': 'MV',
  'mauritius': 'MU',
  'malta': 'MT', 'maltese': 'MT',
  'cape verde': 'CV'
};

// Capital cities per country code
const capitalCities: Record<string, string> = {
  'IT': 'Rome', 'FR': 'Paris', 'ES': 'Madrid', 'PT': 'Lisbon',
  'GR': 'Athens', 'DE': 'Berlin', 'AT': 'Vienna', 'CH': 'Zurich',
  'BE': 'Brussels', 'CZ': 'Prague', 'HU': 'Budapest', 'HR': 'Zagreb',
  'ME': 'Podgorica', 'RO': 'Bucharest', 'LV': 'Riga', 'IS': 'Reykjavik',
  'AE': 'Dubai', 'MA': 'Marrakech', 'MV': 'Male', 'MU': 'Port Louis',
  'MT': 'Valletta', 'CV': 'Praia', 'IN': 'Delhi',
  'BG': 'Sofia', 'SK': 'Bratislava', 'DK': 'Copenhagen', 'EE': 'Tallinn'
};

// Get country code from country name
function getCountryCode(countryName: string): string | null {
  const lower = countryName.toLowerCase();
  for (const [name, code] of Object.entries(countryToCode)) {
    if (lower.includes(name)) return code;
  }
  return null;
}

export default function DestinationDetail() {
  const [, holidaysParams] = useRoute("/Holidays/:country");
  const [, destinationsParams] = useRoute("/destinations/:country");
  const countrySlug = holidaysParams?.country || destinationsParams?.country || "";
  
  const destinationName = countrySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const { data, isLoading, error } = useQuery<DestinationData>({
    queryKey: ['/api/destinations', countrySlug],
    queryFn: () => apiRequest('GET', `/api/destinations/${encodeURIComponent(countrySlug)}`),
    enabled: !!countrySlug,
  });

  // Fetch city taxes for city tax calculation
  const { data: cityTaxes } = useQuery<CityTax[]>({
    queryKey: ['/api/city-taxes'],
  });

  // Fetch EUR to GBP exchange rate
  const { data: siteSettings } = useQuery<{ eurToGbpRate?: number }>({
    queryKey: ['/api/admin/site-settings'],
  });
  const eurToGbpRate = siteSettings?.eurToGbpRate ?? 0.84;

  // Calculate city tax for a package based on its destination country and duration
  const calculateCityTaxForPackage = (pkg: FlightPackage): CityTaxInfo | undefined => {
    if (!cityTaxes || cityTaxes.length === 0) return undefined;
    
    const country = pkg.category;
    if (!country) return undefined;
    
    const nights = parseDurationNights(pkg.duration);
    if (nights <= 0) return undefined;
    
    // Get country code from country name
    const countryCode = getCountryCode(country);
    if (!countryCode) return undefined;
    
    // Get capital city name for this country
    const capitalCityName = capitalCities[countryCode];
    if (!capitalCityName) return undefined;
    
    // Find capital city tax
    const capitalTax = cityTaxes.find(
      t => t.cityName.toLowerCase() === capitalCityName.toLowerCase() && t.countryCode === countryCode
    );
    
    if (!capitalTax) return undefined;
    
    // Use 4-star rate as default
    let taxPerNight = getCityTaxRate(capitalTax, 4);
    
    // Convert EUR to GBP if needed
    if (capitalTax.currency === 'EUR') {
      taxPerNight = taxPerNight * eurToGbpRate;
    }
    
    const totalTaxPerPerson = Math.round(taxPerNight * nights * 100) / 100;
    
    // Calculate EUR amount before conversion
    const originalTaxPerNight = getCityTaxRate(capitalTax, 4);
    const eurAmount = capitalTax.currency === 'EUR' ? originalTaxPerNight * nights : undefined;
    
    return {
      totalTaxPerPerson,
      cityName: capitalTax.cityName,
      nights,
      ratePerNight: taxPerNight,
      currency: capitalTax.currency || 'EUR',
      eurAmount,
      eurToGbpRate: capitalTax.currency === 'EUR' ? eurToGbpRate : undefined,
    };
  };

  const displayName = data?.destination || destinationName;
  const blogPosts = data?.blogPosts || [];

  useEffect(() => {
    if (data) {
      const totalHolidays = data.flightPackages.length + data.landTours.length;
      const title = `${displayName} Holidays & Tours | Flights and Packages`;
      const description = `Discover ${totalHolidays} amazing holidays to ${displayName}. Browse flight packages, land tours, and travel guides. Book your perfect ${displayName} holiday today.`;
      
      setMetaTags(title, description);
      
      addJsonLD([
        generateBreadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Destinations", url: "/Holidays" },
          { name: displayName, url: `/Holidays/${countrySlug}` }
        ]),
        {
          "@context": "https://schema.org",
          "@type": "TouristDestination",
          "name": displayName,
          "description": description,
          "url": `https://tours.flightsandpackages.com/Holidays/${countrySlug}`,
          "touristType": {
            "@type": "Audience",
            "audienceType": "Holidaymakers"
          },
          "containsPlace": data.flightPackages.map(pkg => ({
            "@type": "TouristAttraction",
            "name": pkg.title,
            "url": `https://tours.flightsandpackages.com/Holidays/${countrySlug}/${pkg.slug}`
          }))
        }
      ]);
    }
  }, [data, displayName, countrySlug]);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="bg-slate-800 text-white py-12">
          <div className="container mx-auto px-4">
            <Link href="/Holidays" className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Destinations
            </Link>
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8" />
              <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-destination-title">
                {displayName}
              </h1>
            </div>
            {data && (
              <p className="text-slate-300 mt-2">
                {data.flightPackages.length + data.landTours.length} holidays found
              </p>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Failed to load destination. Please try again.</p>
            </div>
          ) : data && (data.flightPackages.length > 0 || data.landTours.length > 0) ? (
            <div className="space-y-12">
              {data.flightPackages.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Plane className="h-5 w-5 text-blue-600" />
                    <h2 className="text-2xl font-semibold">Flight Packages to {displayName}</h2>
                    <Badge variant="secondary">{data.flightPackages.length}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {data.flightPackages.map((pkg) => (
                      <FlightPackageCard key={pkg.id} pkg={pkg} cityTaxInfo={calculateCityTaxForPackage(pkg)} />
                    ))}
                  </div>
                </section>
              )}
              
              {data.landTours.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Map className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-2xl font-semibold">Land Tours in {displayName}</h2>
                    <Badge variant="secondary">{data.landTours.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {data.landTours.map((tour) => (
                      <TourCard key={tour.id} product={tour} />
                    ))}
                  </div>
                </section>
              )}

              {blogPosts.length > 0 && (
                <section aria-labelledby="travel-guides-heading">
                  <div className="flex items-center gap-2 mb-6">
                    <BookOpen className="h-5 w-5 text-amber-600" />
                    <h2 id="travel-guides-heading" className="text-2xl font-semibold">
                      {displayName} Travel Guides & Articles
                    </h2>
                    <Badge variant="secondary">{blogPosts.length}</Badge>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Plan your perfect trip with our expert guides, tips, and insights about {displayName}.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {blogPosts.map((post) => (
                      <BlogCard key={post.id} post={post} />
                    ))}
                  </div>
                  <div className="mt-8 text-center">
                    <Link href="/blog">
                      <span className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                        View all travel articles
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                      </span>
                    </Link>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No holidays found for this destination yet.</p>
              <Link href="/Holidays" className="text-primary hover:underline mt-2 inline-block">
                Browse other destinations
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
