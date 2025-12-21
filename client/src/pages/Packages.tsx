import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { Search, MapPin, Clock, Plane, Star, Tag, ChevronRight, ArrowRight, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import type { FlightPackage, BlogPost } from "@shared/schema";

// Homepage data types
type HomepageData = {
  specialOffers: FlightPackage[];
  destinations: { name: string; count: number; image: string | null }[];
  collections: { tag: string; count: number; image: string | null }[];
  blogPosts: BlogPost[];
};

// Package Card Component
function PackageCard({ pkg, showSpecialBadge = false }: { pkg: FlightPackage; showSpecialBadge?: boolean }) {
  const countrySlug = pkg.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Link href={`/Holidays/${countrySlug}/${pkg.slug}`}>
      <div 
        className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer"
        data-testid={`card-package-${pkg.id}`}
      >
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10 flex flex-col gap-2">
          {showSpecialBadge && (
            <span className="bg-amber-500 text-white px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold flex items-center gap-1">
              <Star className="w-3 h-3" /> Special Offer
            </span>
          )}
          <span className="bg-white/90 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold text-foreground line-clamp-1 max-w-[140px] sm:max-w-[180px]">
            {pkg.category}
          </span>
        </div>

        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
          <span className="text-white/80 text-[10px] sm:text-xs font-bold tracking-wider flex items-center gap-1">
            <Plane className="w-3 h-3 shrink-0" />
            FLIGHT+
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 sm:p-6 sm:pb-8 z-10">
          <h3 className="text-white text-lg sm:text-xl font-bold mb-2 sm:mb-3 line-clamp-2 leading-tight">
            {pkg.title}
          </h3>
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
          <div className="flex items-baseline gap-2 mb-3 sm:mb-4 flex-wrap">
            <span className="text-xs sm:text-sm text-white/80">from</span>
            <span className="text-2xl sm:text-3xl font-bold text-white">
              {formatPrice(pkg.price)}
            </span>
            <span className="text-[10px] sm:text-xs text-white/60">pp</span>
          </div>
          <Button variant="secondary" size="sm" className="w-full">
            view more
          </Button>
        </div>
      </div>
    </Link>
  );
}

export default function Packages() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: homepageData, isLoading } = useQuery<HomepageData>({
    queryKey: ["/api/packages/homepage"],
  });

  const { data: allPackages = [] } = useQuery<FlightPackage[]>({
    queryKey: ["/api/packages"],
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

  // Filter packages by search
  const filteredPackages = searchQuery
    ? allPackages.filter(pkg => 
        pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pkg.excerpt || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const specialOffers = homepageData?.specialOffers || [];
  const destinations = homepageData?.destinations || [];
  const collections = homepageData?.collections || [];
  const blogPosts = homepageData?.blogPosts || [];

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Hero Section */}
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
          
          {/* Search Bar in Hero */}
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              placeholder="Search packages..." 
              className="pl-12 h-12 text-lg bg-white/95 backdrop-blur-sm border-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>
      </section>

      {/* Search Results (only shown when searching) */}
      {searchQuery && (
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">
                Search Results for "{searchQuery}"
              </h2>
              <Button variant="ghost" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            </div>
            {filteredPackages.length === 0 ? (
              <div className="text-center py-16">
                <Plane className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No packages found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPackages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Special Offers Section */}
      {!searchQuery && specialOffers.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Star className="w-6 h-6 text-amber-500" />
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="heading-special-offers">
                  Special Offers
                </h2>
              </div>
              <Link href="/packages">
                <Button variant="ghost" className="gap-2" data-testid="link-view-all-offers">
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {specialOffers.slice(0, 4).map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} showSpecialBadge />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Collections Section */}
      {!searchQuery && collections.length > 0 && (
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Tag className="w-6 h-6 text-primary" />
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="heading-collections">
                  Collections
                </h2>
              </div>
              <Link href="/holidays">
                <Button variant="ghost" className="gap-2" data-testid="link-view-all-collections">
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {collections.slice(0, 6).map((collection) => (
                <Link key={collection.tag} href={`/holidays/${collection.tag.toLowerCase().replace(/\s+/g, '-')}`}>
                  <Card className="hover-elevate cursor-pointer overflow-hidden h-full" data-testid={`card-collection-${collection.tag}`}>
                    <div className="relative h-32">
                      <img 
                        src={getProxiedImageUrl(collection.image)}
                        alt={collection.tag}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <CardContent className="p-3 text-center">
                      <h3 className="font-semibold text-sm">{collection.tag}</h3>
                      <p className="text-xs text-muted-foreground">{collection.count} packages</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Destinations Section */}
      {!searchQuery && destinations.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6 text-primary" />
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="heading-destinations">
                  Destinations
                </h2>
              </div>
              <Link href="/Holidays">
                <Button variant="ghost" className="gap-2" data-testid="link-view-all-destinations">
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {destinations.slice(0, 10).map((destination) => {
                const destinationSlug = destination.name.toLowerCase().replace(/\s+/g, '-');
                return (
                <Link key={destination.name} href={`/Holidays/${destinationSlug}`}>
                  <div 
                    className="relative rounded-xl overflow-hidden aspect-[4/3] group cursor-pointer"
                    data-testid={`card-destination-${destination.name}`}
                  >
                    <img 
                      src={getProxiedImageUrl(destination.image)}
                      alt={destination.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h3 className="font-bold text-lg">{destination.name}</h3>
                      <p className="text-sm text-white/80">{destination.count} package{destination.count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white/90 backdrop-blur-sm rounded-full p-2">
                        <ArrowRight className="w-4 h-4 text-foreground" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Blog Section */}
      {!searchQuery && blogPosts.length > 0 && (
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-primary" />
                <h2 className="text-2xl md:text-3xl font-bold" data-testid="heading-blog">
                  Travel Inspiration
                </h2>
              </div>
              <Link href="/blog">
                <Button variant="ghost" className="gap-2" data-testid="link-view-all-blog">
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogPosts.slice(0, 3).map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <Card className="hover-elevate cursor-pointer overflow-hidden h-full" data-testid={`card-blog-${post.id}`}>
                    <div className="relative h-48">
                      <img 
                        src={getProxiedImageUrl(post.featuredImage)}
                        alt={post.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80";
                        }}
                      />
                    </div>
                    <CardContent className="p-4">
                      <Badge variant="secondary" className="mb-2">Travel Guide</Badge>
                      <h3 className="font-bold text-lg line-clamp-2 mb-2">{post.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Loading State */}
      {isLoading && !searchQuery && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
