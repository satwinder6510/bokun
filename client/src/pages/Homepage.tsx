import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { TourCard } from "@/components/TourCard";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";
import { getProxiedImageUrl, getHeroImageUrl, getCardImageUrl } from "@/lib/imageProxy";
import { Search, X, ChevronLeft, ChevronRight, ChevronDown, Shield, Users, Award, Plane, Loader2, MapPin, Clock, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import type { BokunProductSearchResponse, BokunProduct, FlightPackage, Review } from "@shared/schema";
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
    reviewText: "From booking to return, everything was seamless. The tours were well-organised and our guide was exceptional. Highly recommend!",
    rating: 5
  }
];

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
    icon: Shield,
    title: "Trust Account",
    description: "Your land tour is 100% financially protected"
  }
];

export default function Homepage() {
  const { selectedCurrency } = useCurrency();
  const { toast } = useToast();
  const phoneNumber = useDynamicPhoneNumber();
  const [products, setProducts] = useState<BokunProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Fetch homepage settings
  interface HomepageSettings {
    carouselSlides: number;
    packagesCount: number;
    carouselInterval: number;
  }
  
  const { data: homepageSettings } = useQuery<HomepageSettings>({
    queryKey: ['/api/homepage-settings'],
  });
  
  const carouselSlideCount = homepageSettings?.carouselSlides || 3;
  const packagesDisplayCount = homepageSettings?.packagesCount || 3;
  const carouselIntervalMs = (homepageSettings?.carouselInterval || 6) * 1000;

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

  const fetchProductsMutation = useMutation<BokunProductSearchResponse, Error, void>({
    mutationFn: async () => {
      // Always fetch USD prices from Bokun - conversion to GBP happens on frontend
      const response = await apiRequest("POST", "/api/bokun/products", {
        page: 1,
        pageSize: 1000,
      });
      return response as BokunProductSearchResponse;
    },
    onSuccess: (data) => {
      setProducts(data.items || []);
      setIsLoading(false);
    },
    onError: () => {
      setIsLoading(false);
    },
  });

  // Fetch products on initial load
  useEffect(() => {
    setIsLoading(true);
    fetchProductsMutation.mutate();
  }, []);

  // Set meta tags and structured data for homepage
  useEffect(() => {
    const title = "Flights and Packages - Book 700+ Tours Worldwide";
    const description = "Discover and book 700+ unique tours worldwide with Flights and Packages. Explore destinations, compare prices, check availability, and find your perfect adventure.";
    
    setMetaTags(title, description, logoImage);

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      name: 'Flights and Packages',
      url: 'https://tours.flightsandpackages.com',
      logo: logoImage,
      description: description,
      sameAs: []
    };
    addJsonLD(schema);
  }, []);

  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const categories = Array.from(
    new Set(
      products.flatMap(p => p.activityCategories || [])
    )
  ).sort();

  // Extract countries with full names and count tours per country
  const countryData = new Map<string, { name: string; count: number }>();
  products.forEach(p => {
    const countryName = p.googlePlace?.country;
    if (countryName) {
      const existing = countryData.get(countryName);
      if (existing) {
        existing.count++;
      } else {
        countryData.set(countryName, { name: countryName, count: 1 });
      }
    }
  });

  const allCountries = Array.from(countryData.keys()).sort();
  
  // Top destinations for inspiration section
  const topDestinations = Array.from(countryData.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([country, data]) => ({
      name: country,
      count: data.count,
      image: getCardImageUrl(products.find(p => p.googlePlace?.country === country)?.keyPhoto?.originalUrl)
    }));

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery || 
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.excerpt || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.locationCode?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || 
      (product.activityCategories || []).includes(selectedCategory);
    
    const matchesCountry = !selectedCountry || 
      product.googlePlace?.country === selectedCountry;
    
    return matchesSearch && matchesCategory && matchesCountry;
  });

  // Featured tours (first 8 with images)
  const featuredTours = products
    .filter(p => p.keyPhoto?.originalUrl)
    .slice(0, 8);

  // Build dynamic hero slides from real products
  type HeroSlide = {
    image: string;
    title: string;
    subtitle: string;
    price?: number;
    link: string;
    type: 'tour' | 'package';
  };

  const heroSlides: HeroSlide[] = [];
  
  // Add featured packages to hero carousel (based on admin settings)
  // Show packages first, then fill with tours up to carouselSlideCount
  const packagesForCarousel = featuredPackages.slice(0, Math.min(carouselSlideCount, featuredPackages.length));
  packagesForCarousel.forEach(pkg => {
    heroSlides.push({
      image: getHeroImageUrl(pkg.featuredImage) || fallbackHeroImages[0],
      title: pkg.title,
      subtitle: pkg.category,
      price: pkg.price,
      link: `/packages/${pkg.slug}`,
      type: 'package'
    });
  });

  // Add featured tours to hero (fill up to carouselSlideCount total)
  // Use getHeroImageUrl to optimize Bokun S3 images (resized to 1600px, WebP)
  const toursWithImages = products.filter(p => p.keyPhoto?.originalUrl);
  const remainingSlots = carouselSlideCount - heroSlides.length;
  toursWithImages.slice(0, remainingSlots).forEach(tour => {
    heroSlides.push({
      image: getHeroImageUrl(tour.keyPhoto?.originalUrl) || fallbackHeroImages[1],
      title: tour.title,
      subtitle: tour.locationCode?.name || 'Explore Now',
      price: tour.price,
      link: `/tour/${tour.id}`,
      type: 'tour'
    });
  });

  // Fallback if no products loaded yet
  if (heroSlides.length === 0) {
    fallbackHeroImages.forEach((img, i) => {
      heroSlides.push({
        image: img,
        title: i === 0 ? 'Discover Paradise' : i === 1 ? 'Adventure Awaits' : 'Journey Beyond',
        subtitle: 'Explore breathtaking destinations worldwide',
        link: '#tours',
        type: 'tour'
      });
    });
  }

  // Auto-advance hero carousel based on admin settings
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, carouselIntervalMs);
    return () => clearInterval(interval);
  }, [heroSlides.length, carouselIntervalMs]);

  const nextSlide = () => {
    if (heroSlides.length <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const prevSlide = () => {
    if (heroSlides.length <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

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
        toast({
          title: "Successfully subscribed!",
          description: "You'll receive our latest travel deals and offers.",
        });
        setEmail("");
      } else {
        toast({
          title: "Subscription failed",
          description: data.error || "Please try again or contact us directly.",
          variant: "destructive",
        });
      }
    } catch {
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

      {/* Hero Section with Dual CTAs */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Carousel Slides */}
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover"
              loading={index === 0 ? "eager" : "lazy"}
              decoding={index === 0 ? "sync" : "async"}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== fallbackHeroImages[0]) {
                  target.src = fallbackHeroImages[0];
                }
              }}
            />
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </div>
        ))}
        
        {/* Centered Content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white max-w-4xl px-4 md:px-6">
            <p className="text-xs md:text-base font-bold tracking-[0.3em] mb-3 md:mb-6 uppercase text-white/90">
              {heroSlides[currentSlide]?.type === 'package' ? 'FLIGHT INCLUSIVE PACKAGE' : 'YOUR JOURNEY BEGINS HERE'}
            </p>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-6 leading-tight" data-testid="text-hero-title">
              {heroSlides[currentSlide]?.title || 'Discover Paradise'}
            </h1>
            <p className="text-lg md:text-2xl font-medium mb-4 md:mb-6 text-white/90">
              {heroSlides[currentSlide]?.subtitle || 'Explore breathtaking destinations worldwide'}
            </p>
            
            {/* Price display if available */}
            {heroSlides[currentSlide]?.price && (
              <div className="mb-6 md:mb-8">
                <span className="text-sm md:text-lg text-white/80">from </span>
                <span className="text-3xl md:text-5xl font-bold">
                  {heroSlides[currentSlide]?.type === 'package' ? '£' : selectedCurrency.symbol}
                  {heroSlides[currentSlide]?.price?.toFixed(0)}
                </span>
                <span className="text-sm md:text-lg text-white/80 ml-1">/pp</span>
              </div>
            )}
            
            {/* Dynamic CTA based on slide type */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={heroSlides[currentSlide]?.link || '#tours'}>
                <Button 
                  size="lg" 
                  className="text-base md:text-lg px-8 md:px-12 py-6 md:py-7 bg-white hover:bg-stone-100 text-slate-900 font-semibold border-white ring-offset-white focus-visible:ring-slate-400"
                  data-testid="button-hero-view"
                >
                  {heroSlides[currentSlide]?.type === 'package' ? 'View Package' : 'View Tour'}
                </Button>
              </a>
              <a href={heroSlides[currentSlide]?.type === 'package' ? '#tours' : '/packages'}>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-base md:text-lg px-8 md:px-12 py-6 md:py-7 border-2 border-white text-white hover:bg-white hover:text-slate-900 font-semibold"
                  data-testid="button-hero-alternate"
                >
                  {heroSlides[currentSlide]?.type === 'package' ? 'Browse Land Tours' : 'Flight Packages'}
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        {heroSlides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full transition-colors z-10"
              aria-label="Previous slide"
              data-testid="button-hero-prev"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full transition-colors z-10"
              aria-label="Next slide"
              data-testid="button-hero-next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Carousel Indicators */}
        {heroSlides.length > 1 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentSlide ? 'bg-white w-8' : 'bg-white/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
                data-testid={`button-hero-dot-${index}`}
              />
            ))}
          </div>
        )}

        {/* Scroll indicator */}
        <div className="hidden lg:flex absolute bottom-16 left-1/2 -translate-x-1/2 text-white text-center animate-bounce flex-col items-center">
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* Featured Flight Packages Section */}
      <section className="py-16 md:py-24 bg-white border-y border-stone-200">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <p className="text-slate-500 text-sm font-bold tracking-wider uppercase mb-2 flex items-center justify-center gap-2">
              <Plane className="w-4 h-4" />
              FLIGHTS INCLUDED
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4" data-testid="text-packages-title">
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
                      <div className="absolute inset-0">
                        {pkg.featuredImage ? (
                          <img
                            src={getProxiedImageUrl(pkg.featuredImage)}
                            alt={pkg.title}
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
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs sm:text-sm text-white/80">from</span>
                            <div className="flex flex-col">
                              <span className="text-2xl sm:text-3xl font-bold text-white">
                                £{pkg.price.toFixed(0)}
                              </span>
                              <span className="text-[10px] sm:text-xs text-white/60">pp twin share</span>
                            </div>
                          </div>
                          {pkg.singlePrice !== null && pkg.singlePrice !== undefined && (
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

      {/* Featured Land Tours Section */}
      <section id="tours" className="py-16 md:py-24 bg-stone-50">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-8">
            <p className="text-slate-500 text-sm font-bold tracking-wider uppercase mb-2">
              700+ EXPERIENCES
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4" data-testid="text-tours-title">
              Explore Our Land Tours
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Discover handpicked experiences from trusted local operators worldwide
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search destinations, tours, or experiences..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-12 h-14 text-base"
                data-testid="input-search"
              />
              {searchQuery && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Category Pills */}
          {categories.length > 0 && (
            <div className="mb-12">
              <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar justify-center flex-wrap">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all border ${
                    selectedCategory === null
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  data-testid="button-category-all"
                >
                  All
                </button>
                {categories.slice(0, 10).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all border ${
                      selectedCategory === category
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                    data-testid={`button-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {formatCategoryName(category)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results count */}
          {(searchQuery || selectedCategory || selectedCountry) && (
            <p className="text-center text-slate-600 mb-8" data-testid="text-results-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'tour' : 'tours'} found
              {selectedCountry && ` in ${selectedCountry}`}
            </p>
          )}

          {/* Tours Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="aspect-[3/4] bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (searchQuery || selectedCategory || selectedCountry) ? (
            // Show filtered results
            filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xl font-semibold text-slate-800 mb-2" data-testid="text-no-results">
                  No land tours found
                </p>
                <p className="text-slate-600 mb-6">
                  Try adjusting your search or filters
                </p>
                <Button
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-white"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory(null);
                    setSelectedCountry(null);
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear All Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <TourCard key={product.id} product={product} />
                ))}
              </div>
            )
          ) : (
            // Show featured tours
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {featuredTours.map((product) => (
                  <TourCard key={product.id} product={product} />
                ))}
              </div>
              <div className="text-center">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-white"
                  onClick={() => document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-view-all-tours"
                >
                  View All {products.length} Land Tours
                </Button>
              </div>
            </>
          )}
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
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                Popular Destinations
              </h2>
              <p className="text-slate-600 text-lg">
                Discover our most sought-after travel destinations
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {topDestinations.map((dest, index) => (
                <button
                  key={dest.name}
                  onClick={() => {
                    setSelectedCountry(dest.name);
                    document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`relative overflow-hidden rounded-xl group ${
                    index === 0 ? 'col-span-2 md:col-span-1 row-span-2 aspect-[3/4]' : 'aspect-[4/3]'
                  }`}
                  data-testid={`button-destination-${dest.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <img
                    src={dest.image || placeholderImage}
                    alt={dest.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-left">
                    <h3 className="text-white text-xl md:text-2xl font-bold mb-1">
                      {dest.name}
                    </h3>
                    <p className="text-white/80 text-sm">
                      {dest.count} {dest.count === 1 ? 'tour' : 'tours'}
                    </p>
                  </div>
                </button>
              ))}
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
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
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

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-white border-y border-stone-200">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <p className="text-slate-500 text-sm font-bold tracking-wider uppercase mb-2">
              WHAT OUR CUSTOMERS SAY
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Trusted by Thousands
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-6 bg-white border-stone-200" data-testid={`card-testimonial-${index}`}>
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
                  <p className="text-sm text-slate-500">{testimonial.location || ""}</p>
                </div>
              </Card>
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
