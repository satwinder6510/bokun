import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { TourCard } from "@/components/TourCard";
import { CurrencySelector } from "@/components/CurrencySelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Search, X, ChevronLeft, ChevronRight, ChevronDown, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { BokunProductSearchResponse, BokunProduct } from "@shared/schema";

export default function Homepage() {
  const { selectedCurrency } = useCurrency();
  const [products, setProducts] = useState<BokunProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchProductsMutation = useMutation<BokunProductSearchResponse, Error, string>({
    mutationFn: async (currency: string) => {
      const response = await apiRequest("POST", "/api/bokun/products", {
        page: 1,
        pageSize: 1000,
        currency,
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

  // Fetch products when currency changes
  useEffect(() => {
    setIsLoading(true);
    fetchProductsMutation.mutate(selectedCurrency.code);
  }, [selectedCurrency.code]);

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
        <div className="container mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between gap-2 md:gap-6">
          <div className="flex items-center gap-3 md:gap-6 flex-shrink-0 min-w-0">
            <a href="/" className="flex items-center flex-shrink-0" data-testid="link-logo">
              <img 
                src={logoImage} 
                alt="Flights and Packages" 
                className="h-8 md:h-12 w-auto object-contain"
                data-testid="img-logo"
              />
            </a>
            <img 
              src={travelTrustLogo} 
              alt="Travel Trust Association - Your Holidays 100% Financially Protected" 
              className="h-6 md:h-10 w-auto object-contain hidden sm:block"
              aria-label="Travel Trust Association member"
            />
          </div>
          {/* Mobile Menu */}
          <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
            <div className="flex-shrink-0">
              <CurrencySelector />
            </div>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu" className="flex-shrink-0">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-6">
                  <a 
                    href="/" 
                    className="text-base font-medium hover:text-primary transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-home"
                  >
                    Home
                  </a>
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-2 text-muted-foreground">Destinations</p>
                    <button
                      onClick={() => {
                        setSelectedCountry(null);
                        setMobileMenuOpen(false);
                        document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-base font-medium hover:text-primary transition-colors py-2 block w-full text-left"
                      data-testid="mobile-menu-all-destinations"
                    >
                      All Destinations
                    </button>
                    <div className="max-h-[300px] overflow-y-auto mt-2 space-y-1">
                      {allCountries.map((country) => (
                        <button
                          key={country}
                          onClick={() => {
                            setSelectedCountry(country);
                            setMobileMenuOpen(false);
                            document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="text-sm hover:text-primary transition-colors py-1.5 block w-full text-left"
                          data-testid={`mobile-menu-${country.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  </div>
                  <a 
                    href="/blog" 
                    className="text-base font-medium hover:text-primary transition-colors py-2 border-t pt-4"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-blog"
                  >
                    Blog
                  </a>
                  <a 
                    href="/contact" 
                    className="text-base font-medium hover:text-primary transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-contact"
                  >
                    Contact
                  </a>
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-4 lg:gap-6 flex-shrink-0">
            <a href="/" className="text-base font-medium hover:text-primary transition-colors" data-testid="link-home">
              Home
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="text-base font-medium hover:text-primary transition-colors inline-flex items-center gap-1" 
                  data-testid="button-destinations-menu"
                >
                  Destinations
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
                <DropdownMenuItem 
                  onClick={() => {
                    setSelectedCountry(null);
                    document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="font-medium"
                  data-testid="menu-item-all-destinations"
                >
                  All Destinations
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {allCountries.map((country) => (
                  <DropdownMenuItem 
                    key={country}
                    onClick={() => {
                      setSelectedCountry(country);
                      document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    data-testid={`menu-item-${country.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {country}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <a href="/blog" className="text-base font-medium hover:text-primary transition-colors" data-testid="link-blog">
              Blog
            </a>
            <CurrencySelector />
            <a href="/contact">
              <Button size="sm" variant="default" data-testid="button-contact">
                Contact Us
              </Button>
            </a>
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
      <footer className="bg-card border-t py-12">
        <div className="container mx-auto px-6 md:px-8">
          {/* Top Section: Company Info & Links */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 pb-8 mb-8 border-b">
            {/* Left: Company Info */}
            <div className="flex-1 max-w-sm">
              <h4 className="font-bold text-lg mb-2">Flights and Packages</h4>
              <p className="text-sm text-muted-foreground">
                Discover unforgettable journeys across stunning destinations worldwide.
              </p>
            </div>
            
            {/* Right: Contact & Links */}
            <div className="flex gap-12">
              <div>
                <h5 className="font-semibold mb-3 text-sm">Quick Links</h5>
                <div className="space-y-2">
                  <a href="/" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                    Home
                  </a>
                  <a href="/faq" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                    FAQ
                  </a>
                  <a href="/blog" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                    Blog
                  </a>
                  <a href="/contact" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                    Contact
                  </a>
                  <a href="/terms" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                    Terms
                  </a>
                </div>
              </div>
              <div>
                <h5 className="font-semibold mb-3 text-sm">Email</h5>
                <a href="mailto:holidayenq@flightsandpackages.com" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  holidayenq@flightsandpackages.com
                </a>
              </div>
            </div>
          </div>
          
          {/* Destinations Grid */}
          <div className="pb-8 border-b">
            <h5 className="font-semibold mb-4 text-sm">Browse by Destination</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-2">
              {allCountries.map((country) => (
                <button
                  key={country}
                  onClick={() => {
                    setSelectedCountry(country);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                >
                  {country}
                </button>
              ))}
            </div>
          </div>
          
          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground" data-testid="text-footer">
              © 2025 Flights and Packages. All rights reserved.
            </p>
            <img 
              src={travelTrustLogo} 
              alt="Travel Trust Association" 
              className="h-8 w-auto opacity-60"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
