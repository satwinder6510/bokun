import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Plane, MapPin } from "lucide-react";

interface CollectionData {
  tag: string;
  slug: string;
  title: string;
  description: string;
  packageCount: number;
  tourCount: number;
  totalCount: number;
  imageUrl?: string | null;
}

interface CollectionsResponse {
  collections: CollectionData[];
  total: number;
}

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

        <div className="container mx-auto px-4 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : data?.collections && data.collections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data.collections.map((collection) => (
                <Link 
                  key={collection.slug}
                  href={`/collections/${collection.slug}`}
                >
                  <div 
                    className="relative overflow-hidden rounded-lg h-64 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                    data-testid={`card-collection-${collection.slug}`}
                  >
                    {collection.imageUrl ? (
                      <img 
                        src={collection.imageUrl} 
                        alt={collection.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                      <h2 className="text-2xl font-bold mb-2">{collection.title}</h2>
                      <div className="flex gap-4 text-sm text-white/80">
                        {collection.packageCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Plane className="h-4 w-4" />
                            {collection.packageCount} Package{collection.packageCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {collection.tourCount > 0 && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {collection.tourCount} Tour{collection.tourCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
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
