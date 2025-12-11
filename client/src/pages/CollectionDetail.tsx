import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TourCard } from "@/components/TourCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, MapPin, Plane, Map, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { FlightPackage, BokunProduct } from "@shared/schema";

interface SingleTravellerPrice {
  productId: string;
  singlePrice: number | null;
  currency: string;
  rateName: string | null;
  hasSingleRate: boolean;
}

const TAG_DISPLAY_NAMES: Record<string, string> = {
  "beach": "Beach Holidays",
  "city-break": "City Breaks",
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
  "solo-travellers": "Solo Travel"
};

interface CollectionData {
  flightPackages: FlightPackage[];
  landTours: BokunProduct[];
  tag: string;
  singlePrices?: Record<string, SingleTravellerPrice>;
}

function formatGBP(price: number): string {
  return new Intl.NumberFormat('en-GB', { 
    style: 'currency', 
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

function FlightPackageCard({ pkg }: { pkg: FlightPackage }) {
  const countrySlug = pkg.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  return (
    <Link href={`/Holidays/${countrySlug}/${pkg.slug}`}>
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
                {pkg.price ? formatGBP(pkg.price) : "Price on request"}
              </p>
              <span className="text-xs text-muted-foreground">per person</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface LandTourCardProps {
  tour: BokunProduct;
  singlePrice?: SingleTravellerPrice;
  isSoloCollection?: boolean;
}

function LandTourCard({ tour, singlePrice, isSoloCollection }: LandTourCardProps) {
  // Price is already converted to GBP with markup on the server
  const displayPrice = singlePrice?.singlePrice || null;
  
  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        <Badge className="bg-emerald-600 text-white">
          <Map className="h-3 w-3 mr-1" />
          Land Only
        </Badge>
        {isSoloCollection && singlePrice?.hasSingleRate && (
          <Badge className="bg-purple-600 text-white">
            <User className="h-3 w-3 mr-1" />
            Single Rate
          </Badge>
        )}
      </div>
      {isSoloCollection && displayPrice ? (
        <Link href={`/tour/${tour.id}`}>
          <Card className="overflow-hidden group cursor-pointer h-full hover-elevate" data-testid={`card-tour-${tour.id}`}>
            <div className="relative aspect-[4/3] overflow-hidden">
              <img 
                src={tour.keyPhoto?.originalUrl || "/placeholder.jpg"} 
                alt={tour.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <MapPin className="h-4 w-4" />
                <span>{tour.locationCode?.name || tour.googlePlace?.country || "Various"}</span>
              </div>
              <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                {tour.title}
              </h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                {tour.durationText && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{tour.durationText}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Solo traveller from</span>
                  <p className="text-xl font-bold text-primary">
                    {formatGBP(displayPrice)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {singlePrice?.hasSingleRate ? singlePrice.rateName : "per person"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <TourCard product={tour} />
      )}
    </div>
  );
}

export default function CollectionDetail() {
  const [, params] = useRoute("/holidays/:tag");
  const tagSlug = params?.tag || "";
  const displayName = TAG_DISPLAY_NAMES[tagSlug] || tagSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const { data, isLoading, error } = useQuery<CollectionData>({
    queryKey: ['/api/collections', tagSlug],
    queryFn: () => apiRequest('GET', `/api/collections/${encodeURIComponent(tagSlug)}`),
    enabled: !!tagSlug,
  });

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="bg-slate-800 text-white py-12">
          <div className="container mx-auto px-4">
            <Link href="/holidays" className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors">
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
          {isLoading ? (
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
                      <FlightPackageCard key={pkg.id} pkg={pkg} />
                    ))}
                  </div>
                </section>
              )}
              
              {data.landTours.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Map className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-2xl font-semibold">
                      {tagSlug === "solo-travellers" ? "Solo-Friendly Tours" : "Land Tours"}
                    </h2>
                    <Badge variant="secondary">{data.landTours.length}</Badge>
                  </div>
                  {tagSlug === "solo-travellers" && data.singlePrices && (
                    <p className="text-muted-foreground mb-4">
                      Prices shown are for single traveller occupancy where available
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {data.landTours.map((tour) => (
                      <LandTourCard 
                        key={tour.id} 
                        tour={tour} 
                        isSoloCollection={tagSlug === "solo-travellers"}
                        singlePrice={data.singlePrices?.[String(tour.id)]}
                      />
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
