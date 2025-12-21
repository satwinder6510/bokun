import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, MapPin, Clock, Filter, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TourCard } from "@/components/TourCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { setMetaTags, addJsonLD, generateBreadcrumbSchema } from "@/lib/meta-tags";
import { apiRequest } from "@/lib/queryClient";
import type { BokunProduct } from "@shared/schema";

interface BokunProductSearchResponse {
  items: BokunProduct[];
  totalHits: number;
}

export default function Tours() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [products, setProducts] = useState<BokunProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProductsMutation = useMutation<BokunProductSearchResponse, Error, void>({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bokun/products", {
        page: 1,
        pageSize: 1000,
      });
      return response as BokunProductSearchResponse;
    },
    onSuccess: (data) => {
      setProducts(data.items || []);
      setIsLoading(false);
    },
    onError: () => {
      setIsLoading(false);
    },
  });

  useEffect(() => {
    setIsLoading(true);
    fetchProductsMutation.mutate();
  }, []);

  useEffect(() => {
    const title = "Land Tours - Explore 700+ Tours Worldwide | Flights and Packages";
    const description = "Browse our collection of 700+ curated land tours worldwide. From cultural experiences to adventure trips, find your perfect tour with Flights and Packages.";
    
    setMetaTags(title, description);

    addJsonLD([
      generateBreadcrumbSchema([
        { name: "Home", url: "/" },
        { name: "Land Tours", url: "/tours" }
      ]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Land Tours",
        "description": description,
        "url": "https://tours.flightsandpackages.com/tours",
        "isPartOf": {
          "@type": "WebSite",
          "name": "Flights and Packages",
          "url": "https://tours.flightsandpackages.com"
        }
      }
    ]);
  }, []);

  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const categories = Array.from(
    new Set(
      products.flatMap(p => p.activityCategories || [])
    )
  ).sort();

  const countryData = new Map<string, { name: string; count: number }>();
  products.forEach(p => {
    const countryName = p.googlePlace?.country;
    if (countryName) {
      const existing = countryData.get(countryName);
      countryData.set(countryName, {
        name: countryName,
        count: (existing?.count || 0) + 1
      });
    }
  });

  const countries = Array.from(countryData.values())
    .sort((a, b) => b.count - a.count);

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery || 
      product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.locationCode?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.googlePlace?.country?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || 
      product.activityCategories?.includes(selectedCategory);
    
    const matchesCountry = !selectedCountry || 
      product.googlePlace?.country === selectedCountry;
    
    return matchesSearch && matchesCategory && matchesCountry;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedCountry(null);
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedCountry;

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Hero Section */}
      <section className="bg-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-tours-title">
            Land Tours & Experiences
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mb-8">
            Discover {products.length}+ curated tours worldwide. Expertly selected for quality and value.
          </p>
          
          {/* Search */}
          <div className="max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                type="text"
                placeholder="Search destinations or tours..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg bg-white text-slate-800 border-0"
                data-testid="input-tour-search"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white border-b border-stone-200 py-4 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="h-4 w-4" />
              <span>Filter by:</span>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 8).map(category => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                  data-testid={`filter-category-${category}`}
                >
                  {formatCategoryName(category)}
                </Badge>
              ))}
            </div>

            {/* Country Filter */}
            <div className="flex flex-wrap gap-2 ml-4 border-l border-stone-200 pl-4">
              {countries.slice(0, 6).map(country => (
                <Badge
                  key={country.name}
                  variant={selectedCountry === country.name ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedCountry(selectedCountry === country.name ? null : country.name)}
                  data-testid={`filter-country-${country.name}`}
                >
                  {country.name} ({country.count})
                </Badge>
              ))}
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto text-slate-600"
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Tours Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <p className="text-slate-600" data-testid="text-tour-count">
              {isLoading ? "Loading tours..." : `Showing ${filteredProducts.length} of ${products.length} tours`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl overflow-hidden">
                  <Skeleton className="w-full h-full" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <TourCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-xl text-slate-600 mb-4" data-testid="text-no-tours">
                No tours found matching your criteria.
              </p>
              <Button variant="outline" onClick={clearFilters} data-testid="button-clear-search">
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Looking for Flights Included?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            View our flight-inclusive packages for a complete holiday experience with return flights from the UK.
          </p>
          <Link href="/packages">
            <Button size="lg" className="bg-white hover:bg-stone-100 text-slate-900" data-testid="button-view-packages">
              View Flight Packages
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
