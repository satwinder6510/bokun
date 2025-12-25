import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Palmtree, Building2, Users, Mountain, Gem, Wallet, 
  Landmark, Binoculars, Ship, Waves, Triangle, Map,
  Flower2, Church, PawPrint, Umbrella, User, Plane, MapPin
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
  "Beach": <Palmtree className="h-10 w-10" />,
  "City Break": <Building2 className="h-10 w-10" />,
  "City Breaks": <Building2 className="h-10 w-10" />,
  "Family": <Users className="h-10 w-10" />,
  "Adventure": <Mountain className="h-10 w-10" />,
  "Luxury": <Gem className="h-10 w-10" />,
  "Budget": <Wallet className="h-10 w-10" />,
  "Cultural": <Landmark className="h-10 w-10" />,
  "Safari": <Binoculars className="h-10 w-10" />,
  "Cruise": <Ship className="h-10 w-10" />,
  "River Cruise": <Waves className="h-10 w-10" />,
  "Golden Triangle": <Triangle className="h-10 w-10" />,
  "Multi-Centre": <Map className="h-10 w-10" />,
  "Twin-Centre": <Map className="h-10 w-10" />,
  "Wellness": <Flower2 className="h-10 w-10" />,
  "Religious": <Church className="h-10 w-10" />,
  "Wildlife": <PawPrint className="h-10 w-10" />,
  "Island": <Umbrella className="h-10 w-10" />,
  "Solo Travellers": <User className="h-10 w-10" />,
  "Gems": <Gem className="h-10 w-10" />
};

const GRADIENT_MAP: Record<string, string> = {
  "Beach": "from-amber-500 via-orange-400 to-yellow-300",
  "City Break": "from-slate-700 via-slate-600 to-slate-500",
  "City Breaks": "from-slate-700 via-slate-600 to-slate-500",
  "Family": "from-sky-500 via-blue-400 to-cyan-300",
  "Adventure": "from-emerald-600 via-green-500 to-teal-400",
  "Luxury": "from-purple-600 via-violet-500 to-indigo-400",
  "Budget": "from-lime-500 via-green-400 to-emerald-300",
  "Cultural": "from-rose-600 via-pink-500 to-red-400",
  "Safari": "from-amber-600 via-yellow-500 to-orange-400",
  "Cruise": "from-blue-600 via-indigo-500 to-sky-400",
  "River Cruise": "from-cyan-600 via-teal-500 to-blue-400",
  "Golden Triangle": "from-yellow-500 via-amber-400 to-orange-300",
  "Multi-Centre": "from-indigo-600 via-purple-500 to-violet-400",
  "Twin-Centre": "from-indigo-600 via-purple-500 to-violet-400",
  "Wellness": "from-teal-500 via-emerald-400 to-green-300",
  "Religious": "from-stone-600 via-stone-500 to-stone-400",
  "Wildlife": "from-green-600 via-emerald-500 to-lime-400",
  "Island": "from-cyan-500 via-sky-400 to-blue-300",
  "Solo Travellers": "from-fuchsia-600 via-pink-500 to-rose-400",
  "Gems": "from-violet-600 via-purple-500 to-fuchsia-400"
};

export default function Collections() {
  const { data, isLoading } = useQuery<CollectionsResponse>({
    queryKey: ['/api/collections']
  });

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
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

        <div className="container mx-auto px-6 md:px-8 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : data?.collections && data.collections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data.collections.map((collection) => {
                const gradient = GRADIENT_MAP[collection.tag] || "from-slate-600 via-slate-500 to-slate-400";
                return (
                  <Link 
                    key={collection.slug}
                    href={`/holidays/${collection.slug}`}
                  >
                    <div 
                      className="relative overflow-hidden rounded-xl h-64 cursor-pointer group"
                      data-testid={`card-collection-${collection.slug}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      
                      <div className="absolute top-4 right-4 flex gap-2">
                        {collection.packageCount > 0 && (
                          <Badge className="bg-blue-600/90 text-white text-xs">
                            <Plane className="h-3 w-3 mr-1" />
                            {collection.packageCount}
                          </Badge>
                        )}
                        {collection.tourCount > 0 && (
                          <Badge className="bg-emerald-600/90 text-white text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            {collection.tourCount}
                          </Badge>
                        )}
                      </div>

                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/30 group-hover:text-white/40 transition-colors duration-300">
                        {ICON_MAP[collection.tag] || <Map className="h-10 w-10" />}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-5 text-white transform transition-transform duration-300 group-hover:translate-y-[-4px]">
                        <h2 className="text-2xl font-bold mb-1">{collection.title}</h2>
                        <p className="text-sm text-white/80 line-clamp-2 mb-2">
                          {collection.description}
                        </p>
                        <p className="text-sm text-white/90 font-medium">
                          {collection.totalCount} {collection.totalCount === 1 ? 'holiday' : 'holidays'} available
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">No collections available at the moment.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
