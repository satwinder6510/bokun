import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ArrowRight, Palmtree, Building2, Users, Mountain, Gem, Wallet, 
  Landmark, Binoculars, Ship, Waves, Triangle, Map, Flower2, Church, PawPrint, 
  Umbrella, User } from "lucide-react";

interface DestinationData {
  name: string;
  flightPackageCount: number;
  landTourCount: number;
  image?: string;
}

interface CollectionData {
  tag: string;
  slug: string;
  title: string;
  description: string;
  packageCount: number;
  tourCount: number;
  totalCount: number;
}

interface CollectionsResponse {
  collections: CollectionData[];
  total: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "Beach": <Palmtree className="h-6 w-6" />,
  "City Break": <Building2 className="h-6 w-6" />,
  "Family": <Users className="h-6 w-6" />,
  "Adventure": <Mountain className="h-6 w-6" />,
  "Luxury": <Gem className="h-6 w-6" />,
  "Budget": <Wallet className="h-6 w-6" />,
  "Cultural": <Landmark className="h-6 w-6" />,
  "Safari": <Binoculars className="h-6 w-6" />,
  "Cruise": <Ship className="h-6 w-6" />,
  "River Cruise": <Waves className="h-6 w-6" />,
  "Golden Triangle": <Triangle className="h-6 w-6" />,
  "Multi-Centre": <Map className="h-6 w-6" />,
  "Wellness": <Flower2 className="h-6 w-6" />,
  "Religious": <Church className="h-6 w-6" />,
  "Wildlife": <PawPrint className="h-6 w-6" />,
  "Island": <Umbrella className="h-6 w-6" />,
  "Solo Travellers": <User className="h-6 w-6" />
};

export default function HolidaysLanding() {
  const { data: destinations = [], isLoading: destinationsLoading } = useQuery<DestinationData[]>({
    queryKey: ["/api/destinations"],
  });

  const { data: collectionsData, isLoading: collectionsLoading } = useQuery<CollectionsResponse>({
    queryKey: ['/api/collections']
  });

  const collections = collectionsData?.collections || [];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero with Search */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-holidays-title">
                Find Your Perfect Holiday
              </h1>
              <p className="text-xl text-slate-300 mb-8">
                Search our curated collection of flight packages and land tours
              </p>
              <div className="max-w-xl mx-auto">
                <GlobalSearch 
                  placeholder="Search destinations, tours, packages..."
                  className="bg-white rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Destinations Section */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800">
                  Browse by Destination
                </h2>
                <p className="text-slate-600 mt-1">
                  Choose your dream destination
                </p>
              </div>
            </div>

            {destinationsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : destinations.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {destinations.slice(0, 10).map((destination) => (
                  <Link 
                    key={destination.name}
                    href={`/destinations/${encodeURIComponent(destination.name.toLowerCase().replace(/\s+/g, '-'))}`}
                  >
                    <div 
                      className="relative overflow-hidden rounded-lg h-48 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                      data-testid={`card-destination-${destination.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {destination.image ? (
                        <img 
                          src={destination.image} 
                          alt={destination.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin className="h-4 w-4" />
                          <h3 className="text-lg font-bold">{destination.name}</h3>
                        </div>
                        <p className="text-xs text-white/80">
                          {destination.flightPackageCount + destination.landTourCount} holidays
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}

            {destinations.length > 10 && (
              <div className="text-center mt-8">
                <Link 
                  href="/destinations"
                  className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
                  data-testid="link-view-all-destinations"
                >
                  View all {destinations.length} destinations
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Collections Section */}
        <section className="py-12 md:py-16 bg-white border-y border-stone-200">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800">
                  Holiday Ideas & Inspiration
                </h2>
                <p className="text-slate-600 mt-1">
                  Browse by type of experience
                </p>
              </div>
            </div>

            {collectionsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-md" />
                ))}
              </div>
            ) : collections.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {collections.map((collection) => (
                  <Link 
                    key={collection.slug}
                    href={`/holidays/${collection.slug}`}
                  >
                    <Card 
                      className="p-4 h-full flex items-center gap-4 cursor-pointer hover-elevate group"
                      data-testid={`card-collection-${collection.slug}`}
                    >
                      <div className="text-primary shrink-0">
                        {ICON_MAP[collection.tag] || <Map className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 group-hover:text-primary transition-colors truncate">
                          {collection.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {collection.totalCount} {collection.totalCount === 1 ? 'holiday' : 'holidays'}
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
