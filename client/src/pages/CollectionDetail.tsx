import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TourCard } from "@/components/TourCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, MapPin, Plane, Map } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { setMetaTags, addJsonLD, generateBreadcrumbSchema } from "@/lib/meta-tags";
import type { FlightPackage, BokunProduct } from "@shared/schema";

interface CityTax {
  id: number;
  cityName: string;
  countryCode: string;
  pricingType: 'flat_rate' | 'star_rating';
  taxPerNightPerPerson: number;
  rate1Star?: number | null;
  rate2Star?: number | null;
  rate3Star?: number | null;
  rate4Star?: number | null;
  rate5Star?: number | null;
  currency: string;
}

interface CityTaxInfo {
  totalTaxPerPerson: number;
  cityName: string;
  nights: number;
  ratePerNight: number;
  currency: string;
}

const countryToCode: Record<string, string> = {
  'italy': 'IT', 'spain': 'ES', 'france': 'FR', 'germany': 'DE',
  'portugal': 'PT', 'greece': 'GR', 'croatia': 'HR', 'austria': 'AT',
  'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH',
};

const capitalCities: Record<string, string> = {
  'IT': 'Rome', 'ES': 'Madrid', 'FR': 'Paris', 'DE': 'Berlin',
  'PT': 'Lisbon', 'GR': 'Athens', 'HR': 'Zagreb', 'AT': 'Vienna',
  'NL': 'Amsterdam', 'BE': 'Brussels', 'CH': 'Bern',
};

function parseDurationNights(duration: string | null | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/(\d+)\s*night/i);
  return match ? parseInt(match[1], 10) : 0;
}

function getCountryCode(countryName: string): string | null {
  const lower = countryName.toLowerCase();
  for (const [name, code] of Object.entries(countryToCode)) {
    if (lower.includes(name)) return code;
  }
  return null;
}

// Known collection tag slugs - if a slug is not in this list, it might be a destination
const KNOWN_COLLECTION_SLUGS = new Set([
  "beach", "city-breaks", "city-break", "family", "adventure", "luxury", "budget",
  "cultural", "safari", "cruise", "river-cruise", "golden-triangle", "multi-centre",
  "wellness", "religious", "wildlife", "island", "twin-centre", "all-inclusive",
  "gems", "solo-travellers"
]);

const TAG_DISPLAY_NAMES: Record<string, string> = {
  "beach": "Beach Holidays",
  "city-break": "City Breaks",
  "city-breaks": "City Breaks",
  "family": "Family Holidays",
  "adventure": "Adventure Tours",
  "luxury": "Luxury Escapes",
  "budget": "Value Holidays",
  "cultural": "Cultural Journeys",
  "safari": "Safari Adventures",
  "cruise": "Ocean Cruises",
  "river-cruise": "River Cruises",
  "golden-triangle": "Golden Triangle Tours",
  "multi-centre": "Multi-Centre Holidays",
  "wellness": "Wellness Retreats",
  "religious": "Pilgrimage Tours",
  "wildlife": "Wildlife Experiences",
  "island": "Island Escapes",
  "twin-centre": "Twin-Centre Holidays",
  "all-inclusive": "All-Inclusive Holidays",
  "gems": "Hidden Gems",
  "solo-travellers": "Solo Travel"
};

interface CollectionData {
  flightPackages: FlightPackage[];
  landTours: BokunProduct[];
  tag: string;
}

function formatGBP(price: number): string {
  return new Intl.NumberFormat('en-GB', { 
    style: 'currency', 
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

function FlightPackageCard({ pkg, showSinglePrice = false, cityTaxInfo }: { pkg: FlightPackage; showSinglePrice?: boolean; cityTaxInfo?: CityTaxInfo }) {
  const countrySlug = pkg.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  // For solo collection, prefer single price; otherwise prefer double/twin price
  const basePrice = showSinglePrice 
    ? (pkg.singlePrice || pkg.price) 
    : (pkg.price || pkg.singlePrice);
  
  const cityTax = cityTaxInfo?.totalTaxPerPerson || 0;
  const totalPrice = (basePrice || 0) + cityTax;
  
  // Add ?pricing=solo when linking from solo collection
  const packageUrl = showSinglePrice 
    ? `/Holidays/${countrySlug}/${pkg.slug}?pricing=solo`
    : `/Holidays/${countrySlug}/${pkg.slug}`;
  
  return (
    <Link href={packageUrl}>
      <Card className="overflow-hidden group cursor-pointer h-full hover-elevate" data-testid={`card-package-${pkg.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={pkg.featuredImage || "/placeholder.jpg"} 
            alt={pkg.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className="bg-blue-600 text-white">
              <Plane className="h-3 w-3 mr-1" />
              Flights Included
            </Badge>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <MapPin className="h-4 w-4" />
            <span>{pkg.category}</span>
          </div>
          <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {pkg.title}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{pkg.duration}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">From</span>
              <p className="text-xl font-bold text-primary">
                {basePrice ? formatGBP(totalPrice) : "Price on request"}
              </p>
              <span className="text-xs text-muted-foreground">total cost per person</span>
              {cityTax > 0 && basePrice && (
                <p className="text-xs text-muted-foreground">{formatGBP(basePrice)} + {formatGBP(cityTax)} locally</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function LandTourCard({ tour }: { tour: BokunProduct }) {
  return (
    <div className="relative">
      <Badge className="absolute top-3 left-3 z-10 bg-emerald-600 text-white">
        <Map className="h-3 w-3 mr-1" />
        Land Only
      </Badge>
      <TourCard product={tour} />
    </div>
  );
}

export default function CollectionDetail() {
  const [, params] = useRoute("/collections/:tag");
  const [, setLocation] = useLocation();
  const tagSlug = params?.tag || "";
  const displayName = TAG_DISPLAY_NAMES[tagSlug] || tagSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  // Check if this is a known collection slug
  const isKnownCollection = KNOWN_COLLECTION_SLUGS.has(tagSlug.toLowerCase());

  const { data, isLoading, error } = useQuery<CollectionData>({
    queryKey: ['/api/collections', tagSlug],
    queryFn: () => apiRequest('GET', `/api/collections/${encodeURIComponent(tagSlug)}`),
    enabled: !!tagSlug && isKnownCollection,
  });

  // Redirect to destination page if this is not a known collection
  // This handles case-insensitive URL matching on production servers
  useEffect(() => {
    if (tagSlug && !isKnownCollection) {
      // Redirect to destination page (e.g., /collections/sri-lanka -> /Holidays/sri-lanka)
      setLocation(`/Holidays/${tagSlug}`, { replace: true });
    }
  }, [tagSlug, isKnownCollection, setLocation]);

  useEffect(() => {
    if (data) {
      const totalHolidays = data.flightPackages.length + data.landTours.length;
      const title = `${displayName} - ${totalHolidays} Holiday Packages | Flights and Packages`;
      const description = `Browse ${totalHolidays} ${displayName.toLowerCase()} from Flights and Packages. Find flight-inclusive packages and land tours for your perfect getaway.`;
      
      setMetaTags(title, description);
      
      addJsonLD([
        generateBreadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Collections", url: "/collections" },
          { name: displayName, url: `/collections/${tagSlug}` }
        ]),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": displayName,
          "description": description,
          "url": `https://holidays.flightsandpackages.com/collections/${tagSlug}`,
          "numberOfItems": totalHolidays
        }
      ]);
    }
  }, [data, displayName, tagSlug]);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="bg-slate-800 text-white py-12">
          <div className="container mx-auto px-4">
            <Link href="/collections" className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Collections
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-collection-title">
              {displayName}
            </h1>
            {data && (
              <p className="text-slate-300 mt-2">
                {data.flightPackages.length + data.landTours.length} holidays found
              </p>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {(isLoading || !isKnownCollection) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Failed to load collection. Please try again.</p>
            </div>
          ) : data && (data.flightPackages.length > 0 || data.landTours.length > 0) ? (
            <div className="space-y-10">
              {data.flightPackages.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Plane className="h-5 w-5 text-blue-600" />
                    <h2 className="text-2xl font-semibold">Flight Packages</h2>
                    <Badge variant="secondary">{data.flightPackages.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {data.flightPackages.map((pkg) => (
                      <FlightPackageCard 
                        key={pkg.id} 
                        pkg={pkg} 
                        showSinglePrice={tagSlug === "solo-travellers"} 
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {data.landTours.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Map className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-2xl font-semibold">Land Tours</h2>
                    <Badge variant="secondary">{data.landTours.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {data.landTours.map((tour) => (
                      <LandTourCard key={tour.id} tour={tour} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No holidays found in this collection yet.</p>
              <Link href="/collections" className="text-primary hover:underline mt-2 inline-block">
                Browse other collections
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
