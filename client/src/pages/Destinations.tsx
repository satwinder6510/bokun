import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";

interface DestinationData {
  name: string;
  flightPackageCount: number;
  landTourCount: number;
  image?: string;
}

export default function Destinations() {
  const { data: destinations = [], isLoading } = useQuery<DestinationData[]>({
    queryKey: ["/api/destinations"],
  });

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="bg-slate-800 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-destinations-title">
              Explore Destinations
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Discover amazing holidays across the world with our flight packages and land tours
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : destinations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {destinations.map((destination) => (
                <Link 
                  key={destination.name}
                  href={`/Holidays/${encodeURIComponent(destination.name.toLowerCase().replace(/\s+/g, '-'))}`}
                >
                  <div 
                    className="relative overflow-hidden rounded-lg h-64 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl group"
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
                    <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-5 w-5" />
                        <h2 className="text-2xl font-bold">{destination.name}</h2>
                      </div>
                      <div className="flex gap-4 text-sm text-white/80">
                        {destination.flightPackageCount > 0 && (
                          <span>{destination.flightPackageCount} Flight Package{destination.flightPackageCount !== 1 ? 's' : ''}</span>
                        )}
                        {destination.landTourCount > 0 && (
                          <span>{destination.landTourCount} Land Tour{destination.landTourCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No destinations available yet.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
