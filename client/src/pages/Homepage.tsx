import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setMetaTags, addJsonLD, generateOrganizationSchema } from "@/lib/meta-tags";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";
import { getProxiedImageUrl, getHeroImageUrl, getCardImageUrl } from "@/lib/imageProxy";
import { Search, X, ChevronDown, Shield, Users, Award, Plane, Loader2, MapPin, Clock, Phone, Map as MapIcon, ArrowRight, Sparkles, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { captureDestinationViewed, captureSearch, captureFilterApplied, captureNewsletterSignup, captureAISearch } from "@/lib/posthog";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import type { FlightPackage, Review } from "@shared/schema";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";

// Fallback hero images (used when no products/packages have images)
// Optimized: reduced width to 1280px and quality to 70 for faster loading
const fallbackHeroImages = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280&q=70&auto=format",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1280&q=70&auto=format",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1280&q=70&auto=format"
];

// Placeholder image for destinations without images
const placeholderImage = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=60&auto=format";

// Fallback testimonials (used when no reviews in database)
const fallbackTestimonials = [
  {
    customerName: "Sarah Mitchell",
    location: "London, UK",
    reviewText: "Absolutely incredible experience! The team at Flights and Packages made our dream honeymoon a reality. Every detail was perfectly planned.",
    rating: 5
  },
  {
    customerName: "James Thompson",
    location: "Manchester, UK",
    reviewText: "Best travel agency we've ever used. The flight-inclusive packages offer amazing value and the customer service is outstanding.",
    rating: 5
  },
  {
    customerName: "Emily Roberts",
    location: "Birmingham, UK",
    reviewText: "From booking to return, everything was seamless. The holiday was well-organised and our guide was exceptional. Highly recommend!",
    rating: 5
  }
];

// City tax interfaces and helpers
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

const countryToCodeMap: Record<string, string> = {
  'italy': 'IT', 'spain': 'ES', 'france': 'FR', 'germany': 'DE',
  'portugal': 'PT', 'greece': 'GR', 'croatia': 'HR', 'austria': 'AT',
  'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH',
};

const capitalCitiesMap: Record<string, string> = {
  'IT': 'Rome', 'ES': 'Madrid', 'FR': 'Paris', 'DE': 'Berlin',
  'PT': 'Lisbon', 'GR': 'Athens', 'HR': 'Zagreb', 'AT': 'Vienna',
  'NL': 'Amsterdam', 'BE': 'Brussels', 'CH': 'Bern',
};

function parseDurationNightsHome(duration: string | null | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/(\d+)\s*night/i);
  return match ? parseInt(match[1], 10) : 0;
}

function getCountryCodeHome(countryName: string): string | null {
  const lower = countryName.toLowerCase();
  for (const [name, code] of Object.entries(countryToCodeMap)) {
    if (lower.includes(name)) return code;
  }
  return null;
}

// AI Search interfaces and constants
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

// Why Book With Us features
const trustFeatures = [
  {
    icon: Shield,
    title: "ATOL Protected",
    description: "Your Flight Inclusive Package is 100% financially protected"
  },
  {
    icon: Users,
    title: "Expert Advisors",
    description: "Dedicated travel specialists at your service"
  },
  {
    icon: Award,
    title: "Best Price Guarantee",
    description: "Competitive prices with no hidden fees"
  },
  {
    icon: Phone,
    title: "24/7 Support",
    description: "We're here to help before, during and after your trip"
  }
];

export default function Homepage() {
  const { selectedCurrency } = useCurrency();
  const { toast } = useToast();
  const phoneNumber = useDynamicPhoneNumber();
    const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testimonialSlide, setTestimonialSlide] = useState(0);

  // AI Search state
  const [aiDestination, setAiDestination] = useState<string>("all");
  const [aiDuration, setAiDuration] = useState<number[]>([14]);
  const [aiBudget, setAiBudget] = useState<number[]>([10000]); // Default to max, updated when API returns
  const [aiTravelers, setAiTravelers] = useState<number>(2);
  const [aiHolidayTypes, setAiHolidayTypes] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const lastTrackedSearch = useRef<string>("");

  const toggleHolidayType = (value: string) => {
    setAiHolidayTypes(prev => {
      if (prev.includes(value)) {
        return prev.filter(t => t !== value);
      }
      if (prev.length >= MAX_HOLIDAY_TYPES) {
        return prev;
      }
      return [...prev, value];
    });
  };

  // Fetch homepage settings
  interface HomepageSettings {
    packagesCount: number;
    heroImage: string | null;
  }
  
  const { data: homepageSettings } = useQuery<HomepageSettings>({
    queryKey: ['/api/homepage-settings'],
  });
  
  const packagesDisplayCount = homepageSettings?.packagesCount || 4;
  const configuredHeroImage = homepageSettings?.heroImage || null;

  // Fetch flight packages with loading/error handling
  const { 
    data: flightPackages = [], 
    isLoading: packagesLoading,
    isError: packagesError 
  } = useQuery<FlightPackage[]>({
    queryKey: ['/api/packages'],
  });

  // Get featured packages based on admin settings
  const featuredPackages = flightPackages
    .filter(pkg => pkg.featuredImage)
    .slice(0, packagesDisplayCount)
    .concat(flightPackages.filter(pkg => !pkg.featuredImage))
    .slice(0, packagesDisplayCount);

  // Fetch customer reviews from database
  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['/api/reviews'],
  });

  // Use database reviews if available, otherwise fallback to defaults
  const testimonials = reviews.length > 0 ? reviews : fallbackTestimonials;

  // Fetch destinations with flight packages and land tour counts
  interface Destination {
    name: string;
    flightPackageCount: number;
    landTourCount: number;
    image: string | null;
  }
  
  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: ['/api/destinations'],
    staleTime: 1000 * 60 * 10,
  });
  
  // Top 6 destinations for homepage display
  const topDestinations = destinations.slice(0, 6);

  // AI Search: Fetch filter options
  const { data: aiFilterOptions } = useQuery<{ 
    destinations: string[]; 
    maxPrice: number; 
    maxDuration: number;
    holidayTypesByDestination: Record<string, string[]>;
  }>({
    queryKey: ["/api/ai-search/filters"],
  });

  const aiDestinations = aiFilterOptions?.destinations || [];
  const aiMaxPrice = aiFilterOptions?.maxPrice || 10000;
  const aiMaxDuration = aiFilterOptions?.maxDuration || 21;
  const holidayTypesByDestination = aiFilterOptions?.holidayTypesByDestination || {};

  // Get available holiday types for selected destination
  const getAvailableHolidayTypes = () => {
    if (aiDestination === "all") {
      return HOLIDAY_TYPES;
    }
    const availableTypes = holidayTypesByDestination[aiDestination] || [];
    if (availableTypes.length === 0) {
      return HOLIDAY_TYPES;
    }
    return HOLIDAY_TYPES.filter(type => availableTypes.includes(type.value));
  };
  
  const availableHolidayTypes = getAvailableHolidayTypes();

  // Set budget to max when filter options load (so users see all results by default)
  const budgetInitialized = useRef(false);
  useEffect(() => {
    if (aiFilterOptions?.maxPrice && !budgetInitialized.current) {
      setAiBudget([aiFilterOptions.maxPrice]);
      budgetInitialized.current = true;
    }
  }, [aiFilterOptions?.maxPrice]);

  // Clear selected holiday types that are no longer available when destination changes
  useEffect(() => {
    if (aiDestination !== "all") {
      const available = holidayTypesByDestination[aiDestination] || [];
      if (available.length > 0) {
        setAiHolidayTypes(prev => prev.filter(t => available.includes(t)));
      }
    }
  }, [aiDestination, holidayTypesByDestination]);

  const buildAiSearchParams = () => {
    const params = new URLSearchParams();
    if (aiDestination !== "all") params.set("destination", aiDestination);
    params.set("maxDuration", aiDuration[0].toString());
    params.set("maxBudget", aiBudget[0].toString());
    params.set("travelers", aiTravelers.toString());
    if (aiHolidayTypes.length > 0) params.set("holidayTypes", aiHolidayTypes.join(","));
    return params.toString();
  };

  const { data: aiSearchData, isLoading: aiSearchLoading, refetch: refetchAiSearch } = useQuery<AISearchResponse>({
    queryKey: ["/api/ai-search", aiDestination, aiDuration[0], aiBudget[0], aiTravelers, aiHolidayTypes.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/ai-search?${buildAiSearchParams()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: hasSearched,
    staleTime: 0,
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

  // Calculate city tax for an AI search result
  const calculateCityTaxForResult = (result: AISearchResult): CityTaxInfo | undefined => {
    if (!cityTaxes || cityTaxes.length === 0) return undefined;
    if (result.type !== "package") return undefined;
    
    const country = result.category;
    if (!country) return undefined;
    
    const nights = parseDurationNightsHome(result.duration);
    if (nights <= 0) return undefined;
    
    const countryCode = getCountryCodeHome(country);
    if (!countryCode) return undefined;
    
    const capitalCityName = capitalCitiesMap[countryCode];
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
    };
  };

  // Track AI searches in PostHog
  useEffect(() => {
    if (aiSearchData && hasSearched) {
      const searchKey = `${aiDestination}-${aiDuration[0]}-${aiBudget[0]}-${aiTravelers}-${aiHolidayTypes.join(",")}`;
      if (searchKey !== lastTrackedSearch.current) {
        lastTrackedSearch.current = searchKey;
        const packagesCount = aiSearchData.results.filter(r => r.type === "package").length;
        const toursCount = aiSearchData.results.filter(r => r.type === "tour").length;
        captureAISearch({
          destination: aiDestination === "all" ? "All Destinations" : aiDestination,
          duration: aiDuration[0],
          budget: aiBudget[0],
          travelers: aiTravelers,
          holiday_types: aiHolidayTypes,
          results_count: aiSearchData.results.length,
          packages_count: packagesCount,
          tours_count: toursCount,
        });
      }
    }
  }, [aiSearchData, hasSearched, aiDestination, aiDuration, aiBudget, aiTravelers, aiHolidayTypes]);

  const handleAiSearch = () => {
    setHasSearched(true);
    refetchAiSearch();
  };

  const aiResults = aiSearchData?.results || [];

  const formatAiBudget = (value: number) => {
    if (value >= aiMaxPrice) return `£${(value / 1000).toFixed(0)}k+`;
    return `£${value.toLocaleString()}`;
  };

  const formatAiDuration = (days: number) => {
    if (days >= aiMaxDuration) return `${days}+ days`;
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  const formatAiPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  useEffect(() => {
    const title = "Flights and Packages - Book Flight Inclusive Holiday Packages";
    const description = "Book flight inclusive holiday packages from UK airports with Flights and Packages. ATOL protected holidays to destinations worldwide with expert travel advisors.";
    
    setMetaTags(title, description, logoImage);

    addJsonLD([
      generateOrganizationSchema(),
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Flights and Packages",
        "url": "https://tours.flightsandpackages.com",
        "description": description,
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://tours.flightsandpackages.com/tours?search={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      }
    ]);
  }, []);

  // Get hero background image - admin-configured image (from media library) takes priority
  // Media library images are served directly with proper caching, no proxy needed
  const heroBackgroundImage = configuredHeroImage || fallbackHeroImages[0];

  // Preload hero image for faster LCP
  useEffect(() => {
    if (heroBackgroundImage) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = heroBackgroundImage;
      (link as any).fetchPriority = 'high';
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [heroBackgroundImage]);

  // Auto-advance testimonial carousel every 8 seconds
  const totalSlides = Math.ceil(testimonials.length / 3);
  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialSlide((prev) => (prev + 1) % totalSlides);
    }, 8000);
    return () => clearInterval(interval);
  }, [totalSlides]);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setIsSubscribing(true);
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        captureNewsletterSignup(true, email);
        toast({
          title: "Successfully subscribed!",
          description: "You'll receive our latest travel deals and offers.",
        });
        setEmail("");
      } else {
        captureNewsletterSignup(false, email);
        toast({
          title: "Subscription failed",
          description: data.error || "Please try again or contact us directly.",
          variant: "destructive",
        });
      }
    } catch {
      captureNewsletterSignup(false, email);
      toast({
        title: "Subscription failed",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Hero Section - responsive height */}
      <section className="relative w-full h-[50vh] md:h-[60vh] lg:h-auto lg:min-h-[60vh] overflow-hidden">
        {/* Hero Background Image */}
        <img
          src={heroBackgroundImage}
          alt="Discover amazing destinations"
          className="w-full h-full object-cover lg:h-auto lg:object-contain lg:min-h-[60vh]"
          width={1920}
          height={600}
          loading="eager"
          decoding="async"
          // @ts-ignore - fetchpriority is valid HTML but not in React types yet
          fetchpriority="high"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== fallbackHeroImages[0]) {
              target.src = fallbackHeroImages[0];
            }
          }}
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
        
        {/* Centered Content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white max-w-4xl px-4 md:px-6">
            <p className="text-xs md:text-sm font-bold tracking-[0.3em] mb-3 md:mb-4 uppercase text-white/90">
              FLIGHT INCLUSIVE PACKAGES
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4 leading-tight" data-testid="text-hero-title">
              Your Perfect Holiday Awaits
            </h1>
            <p className="text-base md:text-xl font-medium mb-6 md:mb-8 text-white/90 max-w-2xl mx-auto">
              Discover handpicked flight inclusive holiday packages from UK airports
            </p>
            
            {/* Dual CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/packages">
                <Button 
                  size="lg" 
                  className="text-base px-8 py-6 bg-white hover:bg-stone-100 text-slate-900 font-semibold border-white ring-offset-white focus-visible:ring-slate-400"
                  data-testid="button-hero-packages"
                >
                  <Plane className="w-4 h-4 mr-2" />
                  Browse Packages
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="hidden lg:flex absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-center animate-bounce flex-col items-center">
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* AI-Powered Search - positioned after hero */}
      <section className="relative z-20 -mt-8 md:-mt-10 mb-8">
        <div className="container mx-auto px-4 md:px-8">
          <Card className="shadow-xl border-0 max-w-6xl mx-auto">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">AI-Powered Search</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Destination
                  </Label>
                  <Select value={aiDestination} onValueChange={setAiDestination}>
                    <SelectTrigger data-testid="select-ai-destination">
                      <SelectValue placeholder="Choose destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Destination</SelectItem>
                      {aiDestinations.map((dest) => (
                        <SelectItem key={dest} value={dest}>{dest}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Duration (up to {formatAiDuration(aiDuration[0])})
                  </Label>
                  <div className="pt-2">
                    <Slider
                      value={aiDuration}
                      onValueChange={setAiDuration}
                      min={3}
                      max={aiMaxDuration}
                      step={1}
                      className="w-full"
                      data-testid="slider-ai-duration"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>3 days</span>
                      <span>{aiMaxDuration}+ days</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="text-primary font-bold">£</span>
                    Budget per person
                  </Label>
                  <div className="pt-2">
                    <Slider
                      value={aiBudget}
                      onValueChange={setAiBudget}
                      min={500}
                      max={aiMaxPrice}
                      step={100}
                      className="w-full"
                      data-testid="slider-ai-budget"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>£500</span>
                      <span>£{(aiMaxPrice / 1000).toFixed(0)}k+</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Travellers
                  </Label>
                  <Select value={aiTravelers.toString()} onValueChange={(v) => setAiTravelers(parseInt(v))}>
                    <SelectTrigger data-testid="select-ai-travelers">
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

              <div className="space-y-2 mb-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  Holiday Type
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    (select up to {MAX_HOLIDAY_TYPES})
                  </span>
                </Label>
                <div className="flex flex-wrap gap-2" data-testid="holiday-type-selector">
                  {availableHolidayTypes.map((type) => {
                    const isSelected = aiHolidayTypes.includes(type.value);
                    const isDisabled = !isSelected && aiHolidayTypes.length >= MAX_HOLIDAY_TYPES;
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
              </div>

              <Button 
                onClick={handleAiSearch} 
                size="lg" 
                className="w-full md:w-auto px-8"
                disabled={aiSearchLoading}
                data-testid="button-ai-search"
              >
                {aiSearchLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Find Holidays
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* AI Search Results */}
      {hasSearched && (
        <section className="py-8 md:py-12 bg-stone-50">
          <div className="container mx-auto px-4 md:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-secondary">
                  {aiSearchLoading ? "Searching..." : `${aiResults.length} Holidays Found`}
                </h2>
                {aiResults.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setHasSearched(false);
                      setAiDestination("all");
                      setAiDuration([14]);
                      setAiBudget([aiMaxPrice]);
                      setAiTravelers(2);
                      setAiHolidayTypes([]);
                    }}
                    data-testid="button-clear-search"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {aiSearchLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="relative overflow-hidden rounded-xl aspect-[3/4] bg-muted">
                      <Skeleton className="w-full h-full" />
                    </div>
                  ))}
                </div>
              ) : aiResults.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No holidays found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your filters to see more results
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setAiBudget([aiMaxPrice]);
                      setAiDuration([aiMaxDuration]);
                      setAiHolidayTypes([]);
                      refetchAiSearch();
                    }}
                    data-testid="button-reset-filters"
                  >
                    Reset Filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {aiResults.map((result) => {
                    const countrySlug = result.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
                    const href = result.type === "package" 
                      ? `/Holidays/${countrySlug}/${result.slug}` 
                      : `/tour/${result.id}`;
                    
                    return (
                      <Link key={`${result.type}-${result.id}`} href={href}>
                        <div 
                          className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer"
                          data-testid={`card-ai-result-${result.type}-${result.id}`}
                        >
                          <div className="absolute inset-0 bg-muted">
                            {result.image ? (
                              <img
                                src={getProxiedImageUrl(result.image, 'card')}
                                alt={result.title}
                                width={400}
                                height={533}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                          </div>

                          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary text-primary-foreground">
                              Flight Package
                            </span>
                            {result.duration && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-slate-700">
                                {result.duration}
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2 leading-tight">
                              {result.title}
                            </h3>
                            {result.category && (
                              <p className="text-xs text-white/70 mb-2 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {result.category}
                              </p>
                            )}
                            {result.price && (() => {
                              const cityTaxInfo = calculateCityTaxForResult(result);
                              const cityTax = cityTaxInfo?.totalTaxPerPerson || 0;
                              const totalPrice = result.price + cityTax;
                              return (
                                <div className="mb-2">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xs text-white/80">from</span>
                                    <span className="text-xl font-bold text-white">
                                      {formatAiPrice(totalPrice)}
                                    </span>
                                    <span className="text-[10px] text-white/60">total pp</span>
                                  </div>
                                  {cityTax > 0 && (
                                    <p className="text-[10px] text-white/60 mt-0.5">
                                      {formatAiPrice(result.price)} + {formatAiPrice(cityTax)} City taxes paid locally
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                            <Button variant="secondary" size="sm" className="w-full text-xs">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Featured Flight Packages Section */}
      <section className="py-16 md:py-24 bg-white border-y border-stone-200">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <p className="text-slate-500 text-sm font-bold tracking-wider uppercase mb-2 flex items-center justify-center gap-2">
              <Plane className="w-4 h-4" />
              FLIGHTS INCLUDED
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary mb-4" data-testid="text-packages-title">
              Flight Inclusive Packages
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Complete holiday packages with flights from UK airports. Everything arranged for your perfect getaway.
            </p>
          </div>

          {packagesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[3/4] bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : packagesError ? (
            <div className="text-center py-12">
              <p className="text-slate-600">Unable to load packages. Please try again later.</p>
            </div>
          ) : featuredPackages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 mb-4">No packages available yet.</p>
              <a href="/contact">
                <Button variant="outline">Contact Us for Custom Packages</Button>
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {featuredPackages.map((pkg) => {
                  const countrySlug = pkg.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
                  return (
                  <a 
                    key={pkg.id} 
                    href={`/Holidays/${countrySlug}/${pkg.slug}`}
                    className="group"
                    data-testid={`card-package-${pkg.id}`}
                  >
                    <div className="relative overflow-hidden rounded-xl aspect-[3/4] cursor-pointer">
                      {/* Background Image */}
                      <div className="absolute inset-0 bg-muted">
                        {pkg.featuredImage ? (
                          <img
                            src={getProxiedImageUrl(pkg.featuredImage)}
                            alt={pkg.title}
                            width={400}
                            height={533}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                            <Plane className="w-16 h-16 text-white/50" />
                          </div>
                        )}
                      </div>

                      {/* Dark gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                      {/* Top Badge - Category */}
                      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10">
                        <span className="bg-white/90 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold text-foreground line-clamp-1 max-w-[140px] sm:max-w-[180px]">
                          {pkg.category}
                        </span>
                      </div>

                      {/* "FLIGHT +" label */}
                      <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                        <span className="text-white/80 text-[10px] sm:text-xs font-bold tracking-wider flex items-center gap-1">
                          <Plane className="w-3 h-3 shrink-0" />
                          FLIGHT+
                        </span>
                      </div>

                      {/* Bottom content overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 sm:p-6 sm:pb-8 z-10">
                        {/* Package Title */}
                        <h3 className="text-white text-lg sm:text-2xl font-bold mb-2 sm:mb-3 line-clamp-2 leading-tight">
                          {pkg.title}
                        </h3>

                        {/* Location and Duration info */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-white/90 mb-3 sm:mb-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                            <span>{pkg.category}</span>
                          </div>
                          {pkg.duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                              <span>{pkg.duration}</span>
                            </div>
                          )}
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-2 mb-3 sm:mb-4 flex-wrap">
                          {(pkg.pricingDisplay === "both" || pkg.pricingDisplay === "twin" || !pkg.pricingDisplay) && (
                            <div className="flex items-baseline gap-1">
                              <span className="text-xs sm:text-sm text-white/80">from</span>
                              <div className="flex flex-col">
                                <span className="text-2xl sm:text-3xl font-bold text-white">
                                  £{pkg.price.toFixed(0)}
                                </span>
                                <span className="text-[10px] sm:text-xs text-white/60">pp twin share</span>
                              </div>
                            </div>
                          )}
                          {pkg.pricingDisplay === "single" && pkg.singlePrice !== null && pkg.singlePrice !== undefined && (
                            <div className="flex items-baseline gap-1">
                              <span className="text-xs sm:text-sm text-white/80">from</span>
                              <div className="flex flex-col">
                                <span className="text-2xl sm:text-3xl font-bold text-white">
                                  £{pkg.singlePrice.toFixed(0)}
                                </span>
                                <span className="text-[10px] sm:text-xs text-white/60">pp solo</span>
                              </div>
                            </div>
                          )}
                          {pkg.pricingDisplay === "both" && pkg.singlePrice !== null && pkg.singlePrice !== undefined && (
                            <div className="flex flex-col">
                              <span className="text-lg sm:text-xl font-semibold text-white/90">
                                £{pkg.singlePrice.toFixed(0)}
                              </span>
                              <span className="text-[10px] sm:text-xs text-white/60">pp solo</span>
                            </div>
                          )}
                        </div>
                        
                        {/* View More Button */}
                        <Button variant="secondary" size="sm" className="w-full">
                          view more
                        </Button>
                      </div>
                    </div>
                  </a>
                  );
                })}
              </div>

              <div className="text-center">
                <a href="/packages">
                  <Button size="lg" className="bg-slate-800 hover:bg-slate-900 text-white border-slate-800 ring-offset-white focus-visible:ring-slate-400" data-testid="button-view-all-packages">
                    View All Flight Packages
                  </Button>
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Testimonials - content-visibility for improved LCP */}
      <section className="py-16 md:py-24 bg-stone-50 cv-auto">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <p className="text-slate-500 text-sm font-bold tracking-wider uppercase mb-2">
              WHAT OUR CUSTOMERS SAY
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary mb-4">
              Trusted!
            </h2>
          </div>

          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(-${testimonialSlide * 100}%)`,
              }}
            >
              {/* Group testimonials in sets of 3 */}
              {Array.from({ length: totalSlides }).map((_, slideIndex) => (
                <div 
                  key={slideIndex} 
                  className="flex-shrink-0 w-full grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  {testimonials.slice(slideIndex * 3, slideIndex * 3 + 3).map((testimonial, index) => (
                    <Card 
                      key={index} 
                      className="p-6 bg-white border-stone-200" 
                      data-testid={`card-testimonial-${slideIndex * 3 + index}`}
                    >
                      <div className="flex gap-1 mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <span key={i} className="text-yellow-500">★</span>
                        ))}
                      </div>
                      <p className="text-slate-600 mb-4 italic">
                        "{testimonial.reviewText}"
                      </p>
                      <div>
                        <p className="font-semibold text-slate-800">{testimonial.customerName}</p>
                        {testimonial.location && (
                          <p className="text-sm text-slate-500">Country Visited: {testimonial.location}</p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Slide indicators */}
          {totalSlides > 1 && (
            <div className="flex justify-center gap-1 mt-6">
              {Array.from({ length: totalSlides }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setTestimonialSlide(index)}
                  className="p-3 group"
                  data-testid={`button-testimonial-dot-${index}`}
                  aria-label={`Go to slide ${index + 1}`}
                >
                  <span className={`block w-3 h-3 rounded-full transition-colors ${
                    index === testimonialSlide ? 'bg-secondary' : 'bg-slate-300 group-hover:bg-slate-400'
                  }`} />
                </button>
              ))}
            </div>
          )}

          <p className="text-center text-slate-500 mt-8">
            See all our reviews on{" "}
            <a 
              href="https://www.trustpilot.com/review/flightsandpackages.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-secondary hover:underline"
              data-testid="link-trustpilot"
            >
              TrustPilot
            </a>
          </p>
        </div>
      </section>

      {/* Destination Inspiration */}
      {topDestinations.length > 0 && (
        <section className="py-16 md:py-24 bg-white border-y border-stone-200">
          <div className="container mx-auto px-6 md:px-8">
            <div className="text-center mb-12">
              <p className="text-slate-500 text-sm font-bold tracking-wider uppercase mb-2">
                GET INSPIRED
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-secondary mb-4">
                Popular Destinations
              </h2>
              <p className="text-slate-600 text-lg">
                Discover our most sought-after travel destinations
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {topDestinations.map((dest, index) => {
                const countrySlug = dest.name.replace(/\s+/g, '-');
                return (
                  <Link
                    key={dest.name}
                    href={`/Holidays/${countrySlug}`}
                    onClick={() => {
                      captureDestinationViewed(dest.name, dest.flightPackageCount);
                    }}
                    className={`relative overflow-hidden rounded-xl group block ${
                      index === 0 ? 'col-span-2 md:col-span-1 row-span-2 aspect-[3/4]' : 'aspect-[4/3]'
                    }`}
                    data-testid={`link-destination-${dest.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <img
                      src={dest.image || placeholderImage}
                      alt={dest.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-left">
                      <h3 className="text-white text-xl md:text-2xl font-bold mb-2">
                        {dest.name}
                      </h3>
                      {dest.flightPackageCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-white/90 text-xs bg-blue-600/80 px-2 py-1 rounded">
                          <Plane className="h-3 w-3" />
                          {dest.flightPackageCount} {dest.flightPackageCount === 1 ? 'package' : 'packages'}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="text-center mt-8">
              <Link href="/destinations">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-white"
                  data-testid="button-view-all-destinations"
                >
                  View All Destinations
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Why Book With Us */}
      <section className="py-16 md:py-24 bg-stone-50">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <p className="text-slate-500 text-sm font-bold tracking-wider uppercase mb-2">
              YOUR PEACE OF MIND
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary mb-4">
              Why Book With Us
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {trustFeatures.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
                  <feature.icon className="w-8 h-8 text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-16 md:py-24 bg-slate-800 text-white">
        <div className="container mx-auto px-6 md:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get Exclusive Travel Deals
            </h2>
            <p className="text-white/80 mb-8">
              Subscribe to our newsletter and be the first to know about special offers, new destinations, and travel tips.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60 flex-1"
                data-testid="input-newsletter-email"
              />
              <Button 
                type="submit" 
                className="bg-white text-slate-800 hover:bg-stone-100 font-semibold"
                disabled={isSubscribing}
                data-testid="button-newsletter-submit"
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  'Subscribe'
                )}
              </Button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
