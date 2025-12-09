import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Palmtree, Building2, Users, Mountain, Gem, Wallet, 
  Landmark, Binoculars, Ship, Waves, Triangle, Map,
  Flower2, Church, PawPrint, Umbrella, ArrowRight
} from "lucide-react";

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
  "Beach": <Palmtree className="h-8 w-8" />,
  "City Break": <Building2 className="h-8 w-8" />,
  "Family": <Users className="h-8 w-8" />,
  "Adventure": <Mountain className="h-8 w-8" />,
  "Luxury": <Gem className="h-8 w-8" />,
  "Budget": <Wallet className="h-8 w-8" />,
  "Cultural": <Landmark className="h-8 w-8" />,
  "Safari": <Binoculars className="h-8 w-8" />,
  "Cruise": <Ship className="h-8 w-8" />,
  "River Cruise": <Waves className="h-8 w-8" />,
  "Golden Triangle": <Triangle className="h-8 w-8" />,
  "Multi-Centre": <Map className="h-8 w-8" />,
  "Wellness": <Flower2 className="h-8 w-8" />,
  "Religious": <Church className="h-8 w-8" />,
  "Wildlife": <PawPrint className="h-8 w-8" />,
  "Island": <Umbrella className="h-8 w-8" />
};

export default function Collections() {
  const { data, isLoading } = useQuery<CollectionsResponse>({
    queryKey: ['/api/collections']
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="bg-slate-800 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-collections-title">
              Holiday Collections
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Browse our curated collections of flight packages and land tours, grouped by holiday type
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-md" />
              ))}
            </div>
          ) : data?.collections && data.collections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data.collections.map((collection) => (
                <Link 
                  key={collection.slug}
                  href={`/holidays/${collection.slug}`}
                >
                  <Card 
                    className="p-6 h-full flex flex-col justify-between cursor-pointer hover-elevate group"
                    data-testid={`card-collection-${collection.slug}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="text-primary">
                        {ICON_MAP[collection.tag] || <Map className="h-8 w-8" />}
                      </div>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                        {collection.totalCount} {collection.totalCount === 1 ? 'holiday' : 'holidays'}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                        {collection.title}
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {collection.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-primary font-medium">
                      <span>Browse collection</span>
                      <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No collections available at the moment.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
