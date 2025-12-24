import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { setMetaTags } from "@/lib/meta-tags";
import { MapPin, Clock, Plane, Search, ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GlobalSearch } from "@/components/GlobalSearch";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import { captureSearch } from "@/lib/posthog";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";

interface SearchResult {
  id: number | string;
  type: "package" | "tour";
  title: string;
  description?: string;
  category?: string;
  countries?: string[];
  price?: number;
  duration?: string;
  image?: string;
  slug?: string;
  score: number;
  matchedFields: string[];
}

interface SearchResponse {
  results: SearchResult[];
  suggestions: string[];
  total: number;
}

function ResultCard({ result }: { result: SearchResult }) {
  const countrySlug = result.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const href = result.type === "package" 
    ? `/Holidays/${countrySlug}/${result.slug}` 
    : `/tour/${result.id}`;

  return (
    <Link href={href}>
      <div 
        className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer"
        data-testid={`card-result-${result.type}-${result.id}`}
      >
        <div className="absolute inset-0">
          {result.image ? (
            <img 
              src={getProxiedImageUrl(result.image)}
              alt={result.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
              }}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              {result.type === "package" ? (
                <Package className="w-16 h-16 text-muted-foreground" />
              ) : (
                <MapPin className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10 flex flex-col gap-2">
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            {result.type === "package" ? "Flight Package" : "Land Tour"}
          </Badge>
          {result.category && (
            <span className="bg-white/90 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold text-foreground line-clamp-1 max-w-[140px] sm:max-w-[180px]">
              {result.category}
            </span>
          )}
        </div>

        {result.type === "package" && (
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
            <span className="text-white/80 text-[10px] sm:text-xs font-bold tracking-wider flex items-center gap-1">
              <Plane className="w-3 h-3 shrink-0" />
              FLIGHT+
            </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 sm:p-6 sm:pb-8 z-10">
          <h3 className="text-white text-lg sm:text-xl font-bold mb-2 sm:mb-3 line-clamp-2 leading-tight">
            {result.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-white/90 mb-3 sm:mb-4">
            {result.category && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span>{result.category}</span>
              </div>
            )}
            {result.duration && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span>{result.duration}</span>
              </div>
            )}
          </div>
          {result.price && (
            <div className="flex items-baseline gap-2 mb-3 sm:mb-4 flex-wrap">
              <span className="text-xs sm:text-sm text-white/80">from</span>
              <span className="text-2xl sm:text-3xl font-bold text-white">
                {formatPrice(result.price)}
              </span>
              <span className="text-[10px] sm:text-xs text-white/60">pp</span>
            </div>
          )}
          <Button variant="secondary" size="sm" className="w-full">
            view details
          </Button>
        </div>
      </div>
    </Link>
  );
}

function ResultSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl aspect-[3/4] bg-muted">
      <Skeleton className="w-full h-full" />
    </div>
  );
}

export default function SearchResults() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const query = params.get("q") || "";

  const { data, isLoading, isError } = useQuery<SearchResponse>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (!query || query.length < 2) {
        return { results: [], suggestions: [], total: 0 };
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&maxResults=50`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const title = query 
      ? `Search: "${query}" - Flights and Packages` 
      : "Search - Flights and Packages";
    const description = query
      ? `Search results for "${query}". Find flight packages and tours matching your search.`
      : "Search for flight packages and tours.";
    
    setMetaTags(title, description, logoImage);
  }, [query]);

  useEffect(() => {
    if (query.length >= 2 && data) {
      captureSearch({
        search_query: query,
        search_type: 'search_page',
        results_count: data.total || 0,
      });
    }
  }, [query, data]);

  const results = data?.results || [];
  const suggestions = data?.suggestions || [];

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="pt-20 md:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/packages")}
              className="mb-4"
              data-testid="button-back-to-packages"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Packages
            </Button>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4" data-testid="text-search-heading">
              {query ? `Search results for "${query}"` : "Search"}
            </h1>

            <div className="max-w-xl">
              <GlobalSearch 
                placeholder="Search destinations, tours..." 
                autoFocus={!query}
                variant="default"
                initialValue={query}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ResultSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <Card className="p-8 text-center">
              <CardContent className="pt-6">
                <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Search Error</h2>
                <p className="text-muted-foreground mb-4">
                  Something went wrong. Please try again.
                </p>
                <Button onClick={() => navigate("/packages")} data-testid="button-browse-packages">
                  Browse All Packages
                </Button>
              </CardContent>
            </Card>
          ) : !query || query.length < 2 ? (
            <Card className="p-8 text-center">
              <CardContent className="pt-6">
                <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Start Searching</h2>
                <p className="text-muted-foreground">
                  Enter at least 2 characters to search for packages and tours.
                </p>
              </CardContent>
            </Card>
          ) : results.length === 0 ? (
            <Card className="p-8 text-center">
              <CardContent className="pt-6">
                <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h2 className="text-xl font-semibold mb-2">No Results Found</h2>
                <p className="text-muted-foreground mb-4">
                  We couldn't find any packages or tours matching "{query}".
                </p>
                {suggestions.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground mb-2">Try these suggestions:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {suggestions.map((suggestion, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="cursor-pointer hover-elevate"
                          onClick={() => navigate(`/search?q=${encodeURIComponent(suggestion)}`)}
                          data-testid={`badge-suggestion-${i}`}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={() => navigate("/packages")} data-testid="button-browse-packages">
                  Browse All Packages
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-muted-foreground mb-6" data-testid="text-results-count">
                Found {data?.total || results.length} result{(data?.total || results.length) !== 1 ? 's' : ''}
              </p>

              {suggestions.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Related searches:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 5).map((suggestion, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="cursor-pointer hover-elevate"
                        onClick={() => navigate(`/search?q=${encodeURIComponent(suggestion)}`)}
                        data-testid={`badge-related-${i}`}
                      >
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {results.map((result) => (
                  <ResultCard key={`${result.type}-${result.id}`} result={result} />
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
