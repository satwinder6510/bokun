import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { setMetaTags, addJsonLD, generateBreadcrumbSchema } from "@/lib/meta-tags";
import { MapPin, Clock, Plane, Star, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import type { FlightPackage } from "@shared/schema";

function PackageCard({ pkg }: { pkg: FlightPackage }) {
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
        data-testid={`card-special-offer-${pkg.id}`}
      >
        <div className="absolute inset-0 bg-muted">
          <img 
            src={getProxiedImageUrl(pkg.featuredImage)}
            alt={pkg.title}
            width={400}
            height={533}
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

        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10 flex flex-col gap-2">
          <span className="bg-amber-500 text-white px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold flex items-center gap-1">
            <Star className="w-3 h-3" /> Special Offer
          </span>
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

export default function SpecialOffers() {
  const { data: packages = [], isLoading } = useQuery<FlightPackage[]>({
    queryKey: ["/api/packages/special-offers"],
  });

  useEffect(() => {
    const title = "Special Offers - Flight Inclusive Packages | Flights and Packages";
    const description = "Discover our exclusive special offers on flight-inclusive holiday packages. Limited-time deals to India, Maldives, Dubai, and more destinations worldwide.";
    
    setMetaTags(title, description, logoImage);
    
    addJsonLD([
      generateBreadcrumbSchema([
        { name: "Home", url: "/" },
        { name: "Flight Packages", url: "/packages" },
        { name: "Special Offers", url: "/special-offers" }
      ]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Special Offers - Flight Inclusive Packages",
        "description": description,
        "url": "https://tours.flightsandpackages.com/special-offers",
        "numberOfItems": packages.length,
      }
    ]);
  }, [packages.length]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="mb-8">
            <Link href="/packages">
              <Button variant="ghost" size="sm" className="mb-4 gap-2" data-testid="link-back-to-packages">
                <ChevronLeft className="w-4 h-4" /> Back to Packages
              </Button>
            </Link>
            
            <p className="text-teal-600 font-semibold text-sm uppercase tracking-wider mb-2">
              Exclusive offers for you
            </p>
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-8 h-8 text-amber-500" />
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="text-special-offers-title">
                Special Offers
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Exclusive deals on our most popular flight-inclusive packages
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-16">
              <Star className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Special Offers Available</h2>
              <p className="text-muted-foreground mb-6">Check back soon for exclusive deals on our packages.</p>
              <Link href="/packages">
                <Button data-testid="button-browse-all-packages">Browse All Packages</Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground mb-6" data-testid="text-offers-count">
                Showing {packages.length} special offer{packages.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {packages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
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
