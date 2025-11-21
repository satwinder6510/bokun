import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { TourCard } from "@/components/TourCard";
import { CurrencySelector } from "@/components/CurrencySelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BokunProductSearchResponse, BokunProduct } from "@shared/schema";

export default function Homepage() {
  const { selectedCurrency } = useCurrency();
  const [products, setProducts] = useState<BokunProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const hasFetched = useRef(false);

  const fetchProductsMutation = useMutation<BokunProductSearchResponse>({
    mutationFn: async () => {
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

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchProductsMutation.mutate();
    }
  }, []);

  // Set meta tags and structured data for homepage
  useEffect(() => {
    const title = "Flights and Packages - Book 700+ Tours Worldwide";
    const description = "Discover and book 700+ unique tours worldwide with Flights and Packages. Explore destinations, compare prices, check availability, and find your perfect adventure.";
    
    setMetaTags(title, description, logoImage);

    // Add organization structured data
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

  // Get all countries sorted alphabetically for dropdown
  const allCountries = Array.from(countryData.keys()).sort();
  
  // Get top 8 countries by tour count for quick access pills
  const topCountries = Array.from(countryData.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([country]) => country);

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

  // Featured tours for hero carousel (first 5 with images)
  const featuredTours = products
    .filter(p => p.keyPhoto?.originalUrl)
    .slice(0, 5);

  // Auto-advance carousel (only when we have slides)
  useEffect(() => {
    if (featuredTours.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % featuredTours.length);
      }, 6000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [featuredTours.length]);

  const nextSlide = () => {
    if (featuredTours.length < 2) return;
    setCurrentSlide((prev) => (prev + 1) % featuredTours.length);
  };

  const prevSlide = () => {
    if (featuredTours.length < 2) return;
    setCurrentSlide((prev) => (prev - 1 + featuredTours.length) % featuredTours.length);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center" data-testid="link-logo">
            <img 
              src={logoImage} 
              alt="Flights and Packages" 
              className="h-10 md:h-12 w-auto"
              data-testid="img-logo"
            />
          </a>
          <nav className="flex items-center gap-4 md:gap-6">
            <a href="/" className="text-base font-medium hover:text-primary transition-colors hidden md:inline" data-testid="link-home">
              Home
            </a>
            <a href="#tours" className="text-base font-medium hover:text-primary transition-colors hidden md:inline" data-testid="link-tours">
              Tours
            </a>
            <CurrencySelector />
            <Button size="sm" variant="default" className="hidden md:inline-flex">
              Contact Us
            </Button>
          </nav>
        </div>
      </header>

      {/* Fullscreen Hero Carousel */}
      <section className="relative h-screen w-full overflow-hidden">
        {isLoading || featuredTours.length === 0 ? (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        ) : (
          <>
            {/* Carousel Slides */}
            {featuredTours.map((tour, index) => (
              <div
                key={tour.id}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  index === currentSlide ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img
                  src={tour.keyPhoto?.originalUrl}
                  alt={tour.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                
                {/* Centered Content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white max-w-4xl px-4 md:px-6" data-testid="text-hero-title">
                    <p className="text-xs md:text-base font-bold tracking-[0.2em] mb-2 md:mb-4 uppercase">
                      DISCOVER
                    </p>
                    <h2 className="text-2xl sm:text-3xl md:text-6xl lg:text-7xl font-bold mb-3 md:mb-6 leading-tight">
                      {tour.title}
                    </h2>
                    {tour.locationCode?.name && (
                      <p className="text-sm md:text-2xl font-medium mb-4 md:mb-8 text-white/90">
                        {tour.locationCode.name}
                      </p>
                    )}
                    {tour.price && (
                      <div className="mb-4 md:mb-8">
                        <span className="text-sm md:text-lg text-white/80">from </span>
                        <div>
                          <span className="text-3xl sm:text-4xl md:text-6xl font-bold">{selectedCurrency.symbol}{tour.price.toFixed(0)}</span>
                          <span className="text-xs md:text-lg text-white/80 ml-1 md:ml-2">{selectedCurrency.code}</span>
                        </div>
                        <span className="text-sm md:text-lg text-white/80">/pp</span>
                      </div>
                    )}
                    <a href={`/tour/${tour.id}`}>
                      <Button size="default" className="text-xs md:text-lg px-4 md:px-8 py-2 md:py-6">
                        view more
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            ))}

            {/* Navigation Arrows */}
            {featuredTours.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full transition-colors z-10"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-3 rounded-full transition-colors z-10"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Carousel Indicators */}
            {featuredTours.length > 1 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {featuredTours.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentSlide ? 'bg-white w-8' : 'bg-white/50'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Scroll Down Indicator - Hidden on mobile/tablet */}
            <div className="hidden lg:flex absolute bottom-12 left-1/2 -translate-x-1/2 text-white text-center animate-bounce flex-col items-center">
              <p className="text-sm mb-2">Scroll Down</p>
              <p className="text-xs">Discover more content</p>
            </div>
          </>
        )}
      </section>

      {/* Search Bar Section */}
      <section className="py-12 bg-card border-b">
        <div className="container mx-auto px-6 md:px-8 max-w-3xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by destination (Thailand, Mexico, Colombo...) or tour name..."
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
          {searchQuery && !isLoading && (
            <p className="mt-3 text-sm text-center text-muted-foreground" data-testid="text-search-indicator">
              Found <span className="font-semibold text-foreground">{filteredProducts.length}</span> {filteredProducts.length === 1 ? 'tour' : 'tours'}
            </p>
          )}
        </div>
      </section>

      {/* Country Tabs */}
      {allCountries.length > 0 && (
        <section className="py-8 bg-card border-b overflow-hidden">
          <div className="container mx-auto px-6 md:px-8">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Browse by Destination
              </h4>
              <Select 
                value={selectedCountry || "all"} 
                onValueChange={(value) => setSelectedCountry(value === "all" ? null : value)}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-all-destinations">
                  <SelectValue placeholder="All Destinations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Destinations</SelectItem>
                  {allCountries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              <button
                onClick={() => setSelectedCountry(null)}
                className={`px-6 py-3 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                  selectedCountry === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                data-testid="button-country-all"
              >
                All Destinations
              </button>
              {topCountries.map((country) => (
                <button
                  key={country}
                  onClick={() => setSelectedCountry(country)}
                  className={`px-6 py-3 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                    selectedCountry === country
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  data-testid={`button-country-${country.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {country}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Horizontal Category Pills */}
      {categories.length > 0 && (
        <section className="py-8 bg-background overflow-hidden">
          <div className="container mx-auto px-6 md:px-8">
            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Filter by Activity
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-6 py-3 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                  selectedCategory === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                data-testid="button-category-all"
              >
                All Activities
              </button>
              {categories.slice(0, 15).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-3 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                    selectedCategory === category
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  data-testid={`button-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {formatCategoryName(category)}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tours Grid Section */}
      <section id="tours" className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-6 md:px-8">
          {/* Section Header */}
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-bold tracking-wider uppercase mb-2">
              Exclusive offers for you
            </p>
            <h3 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-section-title">
              {searchQuery 
                ? 'Search Results' 
                : selectedCountry && selectedCategory
                  ? `${formatCategoryName(selectedCategory)} Tours in ${selectedCountry}`
                  : selectedCountry
                    ? `Tours in ${selectedCountry}`
                    : selectedCategory 
                      ? `${formatCategoryName(selectedCategory)} Tours` 
                      : 'Special Tour Offers'}
            </h3>
            <p className="text-muted-foreground text-lg" data-testid="text-results-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'tour' : 'tours'} available
            </p>
          </div>

          {/* Tours Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="aspect-[3/4] bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl font-semibold mb-2" data-testid="text-no-results">
                No tours found{searchQuery && ` for "${searchQuery}"`}
              </p>
              <p className="text-muted-foreground mb-6">
                Try searching for destinations like Thailand, Mexico, Colombo, or Portugal
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search-empty"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <TourCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-16">
        <div className="container mx-auto px-6 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-lg mb-4">Flights and Packages</h4>
              <p className="text-sm text-muted-foreground">
                Discover unforgettable journeys across stunning destinations worldwide.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Quick Links</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/" className="hover:text-primary transition-colors">Home</a></li>
                <li><a href="#tours" className="hover:text-primary transition-colors">All Tours</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Destinations</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">FAQs</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Contact</h5>
              <p className="text-sm text-muted-foreground">
                Email: info@flightsandpackages.com
              </p>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground" data-testid="text-footer">
            <p>© 2025 Flights and Packages. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
