import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { setMetaTags } from "@/lib/meta-tags";
import { captureAISearch } from "@/lib/posthog";
import { MapPin, Clock, Plane, Sparkles, Package, Search, SlidersHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";

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
  eurAmount?: number;
  eurToGbpRate?: number;
}

const countryToCode: Record<string, string> = {
  'italy': 'IT', 'spain': 'ES', 'france': 'FR', 'germany': 'DE',
  'portugal': 'PT', 'greece': 'GR', 'croatia': 'HR', 'austria': 'AT',
  'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH',
  'bulgaria': 'BG', 'slovakia': 'SK', 'hungary': 'HU',
};

const capitalCities: Record<string, string> = {
  'IT': 'Rome', 'ES': 'Madrid', 'FR': 'Paris', 'DE': 'Berlin',
  'PT': 'Lisbon', 'GR': 'Athens', 'HR': 'Zagreb', 'AT': 'Vienna',
  'NL': 'Amsterdam', 'BE': 'Brussels', 'CH': 'Bern',
  'BG': 'Sofia', 'SK': 'Bratislava', 'HU': 'Budapest',
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

interface AISearchResult {
  id: number | string;
  type: "package" | "tour";
  title: string;
  description?: string;
  category?: string;
  countries?: string[];
  price?: number;
  duration?: string;
  durationDays?: number;
  image?: string;
  slug?: string;
  score: number;
  tags?: string[];
}

interface AISearchResponse {
  results: AISearchResult[];
  total: number;
}

const HOLIDAY_TYPES = [
  { value: "Beach", label: "Beach" },
  { value: "Adventure", label: "Adventure" },
  { value: "Cultural", label: "Cultural" },
  { value: "City Break", label: "City Break" },
  { value: "Cruise", label: "Cruise" },
  { value: "River Cruise", label: "River Cruise" },
  { value: "Safari", label: "Safari" },
  { value: "Wildlife", label: "Wildlife" },
  { value: "Luxury", label: "Luxury" },
  { value: "Multi-Centre", label: "Multi-Centre" },
  { value: "Island", label: "Island" },
  { value: "Solo Travellers", label: "Solo Travellers" },
];

const MAX_HOLIDAY_TYPES = 3;

function ResultCard({ result, cityTaxInfo }: { result: AISearchResult; cityTaxInfo?: CityTaxInfo }) {
  const countrySlug = result.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const basePrice = result.price || 0;
  const cityTax = cityTaxInfo?.totalTaxPerPerson || 0;
  const totalPrice = basePrice + cityTax;

  const href = result.type === "package" 
    ? `/Holidays/${countrySlug}/${result.slug}` 
    : `/tour/${result.id}`;

  return (
    <Link href={href}>
      <div 
        className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer"
        data-testid={`card-ai-result-${result.type}-${result.id}`}
      >
        <div className="absolute inset-0">
          {result.image ? (
            <img 
              src={getProxiedImageUrl(result.image)}
              alt={result.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
              }}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              {result.type === "package" ? (
                <Package className="w-16 h-16 text-muted-foreground" />
              ) : (
                <MapPin className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10 flex flex-col gap-2">
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            {result.type === "package" ? "Flight Package" : "Land Tour"}
          </Badge>
          {result.category && (
            <span className="bg-white/90 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold text-foreground line-clamp-1 max-w-[140px] sm:max-w-[180px]">
              {result.category}
            </span>
          )}
        </div>

        {result.type === "package" && (
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
            <span className="text-white/80 text-[10px] sm:text-xs font-bold tracking-wider flex items-center gap-1">
              <Plane className="w-3 h-3 shrink-0" />
              FLIGHT+
            </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 sm:p-6 sm:pb-8 z-10">
          <h3 className="text-white text-lg sm:text-xl font-bold mb-2 sm:mb-3 line-clamp-2 leading-tight font-heading">
            {result.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-white/90 mb-3 sm:mb-4">
            {result.category && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span>{result.category}</span>
              </div>
            )}
            {result.duration && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span>{result.duration}</span>
              </div>
            )}
          </div>
          {result.price && (
            <div className="mb-3 sm:mb-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs sm:text-sm text-white/80">from</span>
                <span className="text-2xl sm:text-3xl font-bold text-white">
                  {formatPrice(totalPrice)}
                </span>
                <span className="text-[10px] sm:text-xs text-white/60">total pp</span>
              </div>
              {cityTax > 0 && (
                <p className="text-[10px] sm:text-xs text-white/60 mt-1">
                  {formatPrice(basePrice)} + {formatPrice(cityTax)} City taxes paid locally
                  {cityTaxInfo?.eurAmount && cityTaxInfo.eurAmount > 0 && cityTaxInfo.eurToGbpRate && (
                    <span> (€{cityTaxInfo.eurAmount.toFixed(2)} @ {cityTaxInfo.eurToGbpRate.toFixed(2)})</span>
                  )}
                </p>
              )}
            </div>
          )}
          <Button variant="secondary" size="sm" className="w-full">
            view details
          </Button>
        </div>
      </div>
    </Link>
  );
}

function ResultSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl aspect-[3/4] bg-muted">
      <Skeleton className="w-full h-full" />
    </div>
  );
}

export default function AISearch() {
  const [destination, setDestination] = useState<string>("all");
  const [duration, setDuration] = useState<number[]>([14]);
  const [budget, setBudget] = useState<number[]>([1000]);
  const [travelers, setTravelers] = useState<number>(2);
  const [holidayTypes, setHolidayTypes] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const toggleHolidayType = (value: string) => {
    setHolidayTypes(prev => {
      if (prev.includes(value)) {
        return prev.filter(t => t !== value);
      }
      if (prev.length >= MAX_HOLIDAY_TYPES) {
        return prev;
      }
      return [...prev, value];
    });
  };

  useEffect(() => {
    setMetaTags(
      "AI Search - Find Your Perfect Holiday Faster | Flights and Packages",
      "Use our smart search to find your dream holiday. Filter by destination, duration, budget and holiday type to discover the perfect trip.",
      logoImage
    );
  }, []);

  const { data: filterOptions } = useQuery<{ 
    destinations: string[]; 
    maxPrice: number; 
    maxDuration: number;
    holidayTypesByDestination: Record<string, string[]>;
  }>({
    queryKey: ["/api/ai-search/filters"],
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

  // Calculate city tax for a search result
  const calculateCityTaxForResult = (result: AISearchResult): CityTaxInfo | undefined => {
    if (!cityTaxes || cityTaxes.length === 0) return undefined;
    if (result.type !== "package") return undefined; // Only for packages
    
    const country = result.category;
    if (!country) return undefined;
    
    const nights = parseDurationNights(result.duration);
    if (nights <= 0) return undefined;
    
    const countryCode = getCountryCode(country);
    if (!countryCode) return undefined;
    
    const capitalCityName = capitalCities[countryCode];
    if (!capitalCityName) return undefined;
    
    const capitalTax = cityTaxes.find(
      t => t.cityName.toLowerCase() === capitalCityName.toLowerCase() && t.countryCode === countryCode
    );
    if (!capitalTax) return undefined;
    
    let ratePerNight = 0;
    if (capitalTax.pricingType === 'flat_rate') {
      ratePerNight = capitalTax.taxPerNightPerPerson || 0;
    } else {
      ratePerNight = capitalTax.rate4Star || capitalTax.rate3Star || capitalTax.taxPerNightPerPerson || 0;
    }
    
    if (ratePerNight <= 0) return undefined;
    
    const totalTaxEUR = ratePerNight * nights;
    const totalTaxGBP = Math.round(totalTaxEUR * eurToGbpRate);
    
    return {
      totalTaxPerPerson: totalTaxGBP,
      cityName: capitalCityName,
      nights,
      ratePerNight,
      currency: 'GBP',
      eurAmount: capitalTax.currency === 'EUR' ? totalTaxEUR : undefined,
      eurToGbpRate: capitalTax.currency === 'EUR' ? eurToGbpRate : undefined,
    };
  };

  const destinations = filterOptions?.destinations || [];
  const maxPrice = filterOptions?.maxPrice || 10000;
  const maxDuration = filterOptions?.maxDuration || 21;
  const holidayTypesByDestination = filterOptions?.holidayTypesByDestination || {};
  
  // Get available holiday types for selected destination
  const getAvailableHolidayTypes = () => {
    if (destination === "all") {
      // Show all holiday types when no destination selected
      return HOLIDAY_TYPES;
    }
    const availableTypes = holidayTypesByDestination[destination] || [];
    if (availableTypes.length === 0) {
      // Fallback to all types if no data for destination
      return HOLIDAY_TYPES;
    }
    return HOLIDAY_TYPES.filter(type => availableTypes.includes(type.value));
  };
  
  const availableHolidayTypes = getAvailableHolidayTypes();
  
  // Clear selected holiday types that are no longer available when destination changes
  useEffect(() => {
    if (destination !== "all") {
      const available = holidayTypesByDestination[destination] || [];
      if (available.length > 0) {
        setHolidayTypes(prev => prev.filter(t => available.includes(t)));
      }
    }
  }, [destination, holidayTypesByDestination]);

  const buildSearchParams = () => {
    const params = new URLSearchParams();
    if (destination !== "all") params.set("destination", destination);
    params.set("maxDuration", duration[0].toString());
    params.set("maxBudget", budget[0].toString());
    params.set("travelers", travelers.toString());
    if (holidayTypes.length > 0) params.set("holidayTypes", holidayTypes.join(","));
    return params.toString();
  };

  const { data, isLoading, refetch } = useQuery<AISearchResponse>({
    queryKey: ["/api/ai-search", destination, duration[0], budget[0], travelers, holidayTypes.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/ai-search?${buildSearchParams()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: hasSearched,
    staleTime: 0, // Always fetch fresh data when filters change
  });

  // Track searches in PostHog
  const lastTrackedSearch = useRef<string>("");
  useEffect(() => {
    if (data && hasSearched) {
      const searchKey = `${destination}-${duration[0]}-${budget[0]}-${travelers}-${holidayTypes.join(",")}`;
      if (searchKey !== lastTrackedSearch.current) {
        lastTrackedSearch.current = searchKey;
        const packagesCount = data.results.filter(r => r.type === "package").length;
        const toursCount = data.results.filter(r => r.type === "tour").length;
        captureAISearch({
          destination: destination === "all" ? "All Destinations" : destination,
          duration: duration[0],
          budget: budget[0],
          travelers,
          holiday_types: holidayTypes,
          results_count: data.results.length,
          packages_count: packagesCount,
          tours_count: toursCount,
        });
      }
    }
  }, [data, hasSearched, destination, duration, budget, travelers, holidayTypes]);

  const handleSearch = () => {
    setHasSearched(true);
    refetch();
  };

  const results = data?.results || [];

  const formatBudget = (value: number) => {
    if (value >= maxPrice) return `£${(value / 1000).toFixed(0)}k+`;
    return `£${value.toLocaleString()}`;
  };

  const formatDuration = (days: number) => {
    if (days >= maxDuration) return `${days}+ days`;
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="pt-20 md:pt-24">
        <div className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background py-12 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Search
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 font-heading" data-testid="text-ai-search-heading">
              Find Your Perfect Holiday Faster
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tell us what you're looking for and we'll match you with the best holidays from our collection
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
          <Card className="shadow-lg border-0">
            <CardContent className="p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Destination
                  </Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger data-testid="select-destination">
                      <SelectValue placeholder="Choose destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Destination</SelectItem>
                      {destinations.map((dest) => (
                        <SelectItem key={dest} value={dest}>{dest}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Duration (up to {formatDuration(duration[0])})
                  </Label>
                  <div className="pt-2">
                    <Slider
                      value={duration}
                      onValueChange={setDuration}
                      min={3}
                      max={maxDuration}
                      step={1}
                      className="w-full"
                      data-testid="slider-duration"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>3 days</span>
                      <span>{maxDuration}+ days</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="text-primary font-bold">£</span>
                    Budget per person
                  </Label>
                  <div className="pt-2">
                    <Slider
                      value={budget}
                      onValueChange={setBudget}
                      min={500}
                      max={maxPrice}
                      step={100}
                      className="w-full"
                      data-testid="slider-budget"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>£500</span>
                      <span>£{(maxPrice / 1000).toFixed(0)}k+</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Travellers
                  </Label>
                  <Select value={travelers.toString()} onValueChange={(v) => setTravelers(parseInt(v))}>
                    <SelectTrigger data-testid="select-travelers">
                      <SelectValue placeholder="Number of travellers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Traveller (Solo)</SelectItem>
                      <SelectItem value="2">2 Travellers</SelectItem>
                      <SelectItem value="3">3 Travellers</SelectItem>
                      <SelectItem value="4">4 Travellers</SelectItem>
                      <SelectItem value="5">5 Travellers</SelectItem>
                      <SelectItem value="6">6+ Travellers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  Holiday Type
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    (select up to {MAX_HOLIDAY_TYPES})
                  </span>
                </Label>
                <div className="flex flex-wrap gap-2" data-testid="holiday-type-selector">
                  {availableHolidayTypes.map((type) => {
                    const isSelected = holidayTypes.includes(type.value);
                    const isDisabled = !isSelected && holidayTypes.length >= MAX_HOLIDAY_TYPES;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => toggleHolidayType(type.value)}
                        disabled={isDisabled}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium transition-all
                          ${isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }
                          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                        data-testid={`toggle-holiday-${type.value}`}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
                {holidayTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No type selected - showing all holiday types
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <Button 
                  size="lg" 
                  onClick={handleSearch}
                  className="px-12 gap-2"
                  data-testid="button-search"
                >
                  <Search className="w-5 h-5" />
                  Find My Holiday
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {!hasSearched ? (
            <div className="text-center py-16">
              <Sparkles className="w-16 h-16 mx-auto mb-6 text-primary/30" />
              <h2 className="text-2xl font-semibold text-foreground mb-2 font-heading">
                Ready to explore?
              </h2>
              <p className="text-muted-foreground">
                Adjust the filters above and click "Find My Holiday" to discover your perfect trip
              </p>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ResultSkeleton key={i} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-16 h-16 mx-auto mb-6 text-muted-foreground/50" />
              <h2 className="text-2xl font-semibold text-foreground mb-2 font-heading">
                No matches found
              </h2>
              <p className="text-muted-foreground mb-6">
                Try adjusting your filters to find more options
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDestination("all");
                  setDuration([14]);
                  setBudget([5000]);
                  setTravelers(2);
                  setHolidayTypes([]);
                }}
                data-testid="button-reset-filters"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-muted-foreground" data-testid="text-results-count">
                  Found {results.length} matching holiday{results.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Plane className="w-4 h-4" />
                  <span>Flight packages shown first</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {results.map((result) => (
                  <ResultCard 
                    key={`${result.type}-${result.id}`} 
                    result={result} 
                    cityTaxInfo={calculateCityTaxForResult(result)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
