import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { Search, MapPin, Clock, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import type { FlightPackage } from "@shared/schema";

export default function Packages() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: packages = [], isLoading } = useQuery<FlightPackage[]>({
    queryKey: ["/api/packages"],
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/packages/categories"],
  });

  useEffect(() => {
    const title = "Flight Inclusive Packages - Flights and Packages";
    const description = "Explore our curated flight-inclusive holiday packages to India, Maldives, Dubai, and more. Complete travel packages with flights, hotels, and guided tours.";
    
    setMetaTags(title, description, logoImage);

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      name: 'Flights and Packages',
      url: 'https://tours.flightsandpackages.com/packages',
      logo: logoImage,
      description: description,
    };
    addJsonLD(schema);
  }, []);

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = !searchQuery || 
      pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pkg.excerpt || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || pkg.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Hero Section - Dark wash over image */}
      <section className="relative h-[50vh] min-h-[400px] pt-16 md:pt-20">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <p className="text-white text-sm font-bold tracking-wider uppercase mb-4 flex items-center gap-2" data-testid="badge-flights-included">
            <Plane className="w-4 h-4" />
            FLIGHTS INCLUDED
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4" data-testid="text-hero-title">
            Flight Inclusive Packages
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mb-8" data-testid="text-hero-subtitle">
            Complete holiday packages with flights, hotels, and curated experiences to world-class destinations
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button 
              variant="outline"
              className={`border-white/60 backdrop-blur-sm ${selectedCategory === null ? "bg-white text-foreground hover:bg-white/90" : "text-white hover:bg-white/20"}`}
              onClick={() => setSelectedCategory(null)}
              data-testid="button-filter-all"
            >
              All Destinations
            </Button>
            {categories.slice(0, 4).map((cat) => (
              <Button 
                key={cat}
                variant="outline"
                className={`border-white/60 backdrop-blur-sm ${selectedCategory === cat ? "bg-white text-foreground hover:bg-white/90" : "text-white hover:bg-white/20"}`}
                onClick={() => setSelectedCategory(cat)}
                data-testid={`button-filter-${cat.toLowerCase()}`}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="py-8 bg-muted/30 border-b">
        <div className="container mx-auto px-4 md:px-8">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              placeholder="Search packages..." 
              className="pl-12 h-12 text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>
      </section>

      {/* Packages Grid */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="text-center py-16">
              <Plane className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No packages found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || selectedCategory 
                  ? "Try adjusting your search or filter criteria" 
                  : "Check back soon for new flight-inclusive packages"}
              </p>
              {(searchQuery || selectedCategory) && (
                <Button 
                  variant="outline" 
                  onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <p className="text-muted-foreground" data-testid="text-results-count">
                  Showing {filteredPackages.length} package{filteredPackages.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPackages.map((pkg) => (
                  <Link key={pkg.id} href={`/packages/${pkg.slug}`}>
                    <div 
                      className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer"
                      data-testid={`card-package-${pkg.id}`}
                    >
                      {/* Background Image */}
                      <div className="absolute inset-0">
                        <img 
                          src={getProxiedImageUrl(pkg.featuredImage)}
                          alt={pkg.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
                          }}
                        />
                      </div>

                      {/* Dark gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                      {/* Top Badge - Category */}
                      <div className="absolute top-4 left-4 z-10">
                        <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-foreground">
                          {pkg.category}
                        </span>
                      </div>

                      {/* "FLIGHT +" label */}
                      <div className="absolute top-4 right-4 z-10">
                        <span className="text-white/80 text-xs font-bold tracking-wider flex items-center gap-1">
                          <Plane className="w-3 h-3" />
                          FLIGHT+
                        </span>
                      </div>

                      {/* Bottom content overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                        {/* Package Title */}
                        <h3 
                          className="text-white text-2xl font-bold mb-3 line-clamp-2 leading-tight"
                          data-testid={`text-title-${pkg.id}`}
                        >
                          {pkg.title}
                        </h3>

                        {/* Location and Duration */}
                        <div className="flex items-center gap-4 text-sm text-white/90 mb-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{pkg.category}</span>
                          </div>
                          {pkg.duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{pkg.duration}</span>
                            </div>
                          )}
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mb-4">
                          <span className="text-sm text-white/80">from</span>
                          <div className="flex flex-col">
                            <span 
                              className="text-3xl font-bold text-white"
                              data-testid={`text-price-${pkg.id}`}
                            >
                              {formatPrice(pkg.price)}
                            </span>
                            <span className="text-xs text-white/60">{pkg.priceLabel}</span>
                          </div>
                        </div>
                        
                        {/* View More Button */}
                        <div className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-4 py-2 rounded-md text-sm font-semibold transition-colors text-center">
                          view more
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
