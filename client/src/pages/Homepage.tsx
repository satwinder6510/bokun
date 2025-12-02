import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { TourCard } from "@/components/TourCard";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";
import { Search, X, ChevronLeft, ChevronRight, ChevronDown, Menu, Shield, Users, Award, Plane, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
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
import type { BokunProductSearchResponse, BokunProduct, FlightPackage } from "@shared/schema";

// Fallback hero images (used when no products/packages have images)
const fallbackHeroImages = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80"
];

// Placeholder image for destinations without images
const placeholderImage = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=75";

// Testimonials data
const testimonials = [
  {
    name: "Sarah Mitchell",
    location: "London, UK",
    text: "Absolutely incredible experience! The team at Flights and Packages made our dream honeymoon a reality. Every detail was perfectly planned.",
    rating: 5
  },
  {
    name: "James Thompson",
    location: "Manchester, UK",
    text: "Best travel agency we've ever used. The flight-inclusive packages offer amazing value and the customer service is outstanding.",
    rating: 5
  },
  {
    name: "Emily Roberts",
    location: "Birmingham, UK",
    text: "From booking to return, everything was seamless. The tours were well-organized and our guide was exceptional. Highly recommend!",
    rating: 5
  }
];

// Why Book With Us features
const trustFeatures = [
  {
    icon: Shield,
    title: "ATOL Protected",
    description: "Your holiday is 100% financially protected"
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
    icon: Plane,
    title: "Flights Included",
    description: "Convenient packages with flights from UK airports"
  }
];

export default function Homepage() {
  const { selectedCurrency } = useCurrency();
  const { toast } = useToast();
  const [products, setProducts] = useState<BokunProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Fetch flight packages with loading/error handling
  const { 
    data: flightPackages = [], 
    isLoading: packagesLoading,
    isError: packagesError 
  } = useQuery<FlightPackage[]>({
    queryKey: ['/api/packages'],
  });

  // Get featured packages (first 3 with images, or first 3 overall)
  const featuredPackages = flightPackages
    .filter(pkg => pkg.featuredImage)
    .slice(0, 3)
    .concat(flightPackages.filter(pkg => !pkg.featuredImage))
    .slice(0, 3);

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
      image: products.find(p => p.googlePlace?.country === country)?.keyPhoto?.originalUrl
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
  
  // Add featured packages to hero (max 2)
  featuredPackages.slice(0, 2).forEach(pkg => {
    heroSlides.push({
      image: pkg.featuredImage || fallbackHeroImages[0],
      title: pkg.title,
      subtitle: pkg.category,
      price: pkg.price,
      link: `/packages/${pkg.slug}`,
      type: 'package'
    });
  });

  // Add featured tours to hero (fill up to 5 slides)
  const toursWithImages = products.filter(p => p.keyPhoto?.originalUrl);
  toursWithImages.slice(0, 5 - heroSlides.length).forEach(tour => {
    heroSlides.push({
      image: tour.keyPhoto?.originalUrl || fallbackHeroImages[1],
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

  // Auto-advance hero carousel
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

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
      // Send to contact endpoint as newsletter signup
      await apiRequest("POST", "/api/contact", {
        firstName: "Newsletter",
        lastName: "Subscriber",
        email: email,
        phone: "",
        subject: "Newsletter Subscription",
        message: `Newsletter signup from: ${email}`,
      });
      toast({
        title: "Successfully subscribed!",
        description: "You'll receive our latest travel deals and offers.",
      });
      setEmail("");
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
                  <a 
                    href="/packages" 
                    className="text-base font-medium hover:text-primary transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-packages"
                  >
                    Flight Packages
                  </a>
                  <a 
                    href="#tours" 
                    className="text-base font-medium hover:text-primary transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="mobile-link-tours"
                  >
                    Tours
                  </a>
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-2 text-muted-foreground">Destinations</p>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {allCountries.slice(0, 15).map((country) => (
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
            <a href="/packages" className="text-base font-medium hover:text-primary transition-colors" data-testid="link-packages">
              Flight Packages
            </a>
            <a href="#tours" className="text-base font-medium hover:text-primary transition-colors" data-testid="link-tours">
              Tours
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
            <a href="/contact">
              <Button size="sm" variant="default" data-testid="button-contact">
                Contact Us
              </Button>
            </a>
          </nav>
        </div>
      </header>

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
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-4 md:mb-6 leading-tight" data-testid="text-hero-title">
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
                  className="text-base md:text-lg px-8 md:px-12 py-6 md:py-7 bg-primary hover:bg-primary/90 text-white font-semibold"
                  data-testid="button-hero-view"
                >
                  {heroSlides[currentSlide]?.type === 'package' ? 'View Package' : 'View Tour'}
                </Button>
              </a>
              <a href={heroSlides[currentSlide]?.type === 'package' ? '#tours' : '/packages'}>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-base md:text-lg px-8 md:px-12 py-6 md:py-7 bg-secondary hover:bg-secondary/90 text-white border-secondary font-semibold"
                  data-testid="button-hero-alternate"
                >
                  {heroSlides[currentSlide]?.type === 'package' ? 'Browse Tours' : 'Flight Packages'}
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
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-bold tracking-wider uppercase mb-2">
              FLIGHTS INCLUDED
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-packages-title">
              Flight Inclusive Packages
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Complete holiday packages with flights from UK airports. Everything arranged for your perfect getaway.
            </p>
          </div>

          {packagesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-[16/12] bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : packagesError ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Unable to load packages. Please try again later.</p>
            </div>
          ) : featuredPackages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No packages available yet.</p>
              <a href="/contact">
                <Button variant="outline">Contact Us for Custom Packages</Button>
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {featuredPackages.map((pkg) => (
                  <a 
                    key={pkg.id} 
                    href={`/packages/${pkg.slug}`}
                    className="group"
                    data-testid={`card-package-${pkg.id}`}
                  >
                    <Card className="overflow-hidden hover-elevate h-full">
                      <div className="relative aspect-[16/10] overflow-hidden">
                        {pkg.featuredImage ? (
                          <img
                            src={pkg.featuredImage}
                            alt={pkg.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <Plane className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <span className="inline-block bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full mb-2">
                            {pkg.category}
                          </span>
                          <h3 className="text-white text-xl font-bold line-clamp-2">
                            {pkg.title}
                          </h3>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                          {pkg.excerpt || "Experience an unforgettable journey with flights and accommodation included."}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs text-muted-foreground">From</span>
                            <p className="text-2xl font-bold text-primary">
                              £{pkg.price.toFixed(0)}
                              <span className="text-sm font-normal text-muted-foreground ml-1">{pkg.priceLabel}</span>
                            </p>
                          </div>
                          <Button variant="secondary" size="sm">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>

              <div className="text-center">
                <a href="/packages">
                  <Button size="lg" variant="outline" data-testid="button-view-all-packages">
                    View All Flight Packages
                  </Button>
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Featured Tours Section */}
      <section id="tours" className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-8">
            <p className="text-primary text-sm font-bold tracking-wider uppercase mb-2">
              700+ EXPERIENCES
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-tours-title">
              Explore Our Tours
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Discover handpicked experiences from trusted local operators worldwide
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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
                  className={`px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                    selectedCategory === null
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  data-testid="button-category-all"
                >
                  All
                </button>
                {categories.slice(0, 10).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
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
          )}

          {/* Results count */}
          {(searchQuery || selectedCategory || selectedCountry) && (
            <p className="text-center text-muted-foreground mb-8" data-testid="text-results-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'tour' : 'tours'} found
              {selectedCountry && ` in ${selectedCountry}`}
            </p>
          )}

          {/* Tours Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="aspect-[3/4] bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (searchQuery || selectedCategory || selectedCountry) ? (
            // Show filtered results
            filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xl font-semibold mb-2" data-testid="text-no-results">
                  No tours found
                </p>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your search or filters
                </p>
                <Button
                  variant="outline"
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
                  onClick={() => document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-view-all-tours"
                >
                  View All {products.length} Tours
                </Button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Destination Inspiration */}
      {topDestinations.length > 0 && (
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-6 md:px-8">
            <div className="text-center mb-12">
              <p className="text-primary text-sm font-bold tracking-wider uppercase mb-2">
                GET INSPIRED
              </p>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Popular Destinations
              </h2>
              <p className="text-muted-foreground text-lg">
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
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-bold tracking-wider uppercase mb-2">
              YOUR PEACE OF MIND
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Why Book With Us
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {trustFeatures.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-bold tracking-wider uppercase mb-2">
              WHAT OUR CUSTOMERS SAY
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Trusted by Thousands
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-yellow-500">★</span>
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 italic">
                  "{testimonial.text}"
                </p>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-16 md:py-24 bg-primary text-white">
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
                variant="secondary"
                className="font-semibold"
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

      {/* Footer */}
      <footer className="bg-background border-t py-12 md:py-16">
        <div className="container mx-auto px-6 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <img 
                src={logoImage} 
                alt="Flights and Packages" 
                className="h-10 mb-4"
              />
              <p className="text-muted-foreground text-sm">
                Your trusted partner for unforgettable travel experiences. ATOL protected holidays from UK airports.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/" className="text-muted-foreground hover:text-primary transition-colors">Home</a></li>
                <li><a href="/packages" className="text-muted-foreground hover:text-primary transition-colors">Flight Packages</a></li>
                <li><a href="#tours" className="text-muted-foreground hover:text-primary transition-colors">Tours</a></li>
                <li><a href="/blog" className="text-muted-foreground hover:text-primary transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Popular Destinations</h4>
              <ul className="space-y-2 text-sm">
                {topDestinations.slice(0, 5).map((dest) => (
                  <li key={dest.name}>
                    <button 
                      onClick={() => {
                        setSelectedCountry(dest.name);
                        document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      {dest.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Email: info@flightsandpackages.com</li>
                <li>Phone: +44 (0) 123 456 7890</li>
              </ul>
              <div className="flex gap-2 mt-4">
                <img 
                  src={travelTrustLogo} 
                  alt="Travel Trust Association" 
                  className="h-10"
                />
              </div>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Flights and Packages. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
