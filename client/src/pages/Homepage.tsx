import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TourCard } from "@/components/TourCard";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BokunProductSearchResponse, BokunProduct } from "@shared/schema";

export default function Homepage() {
  const [products, setProducts] = useState<BokunProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetchProductsMutation = useMutation<BokunProductSearchResponse>({
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
    // Only fetch once on mount
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchProductsMutation.mutate();
    }
  }, []);

  // Format category names for display
  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Get unique categories from products
  const categories = Array.from(
    new Set(
      products.flatMap(p => p.activityCategories || [])
    )
  ).sort();

  // Filter products based on search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery || 
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.excerpt || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.locationCode?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || 
      (product.activityCategories || []).includes(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <h1 className="text-2xl font-semibold" data-testid="text-site-title">
            Tour Discoveries
          </h1>
          <nav className="flex items-center gap-6">
            <a href="/" className="text-base font-medium hover-elevate px-3 py-2 rounded-md" data-testid="link-home">
              Home
            </a>
            <a href="#tours" className="text-base font-medium hover-elevate px-3 py-2 rounded-md" data-testid="link-tours">
              Tours
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 border-b">
        <div className="container mx-auto px-6 md:px-8 max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight" data-testid="text-hero-title">
            Discover Unforgettable Journeys
          </h2>
          <p className="text-lg text-muted-foreground mb-8" data-testid="text-hero-subtitle">
            Explore curated tours across stunning destinations
          </p>
          
          {/* Search Bar */}
          <div className="flex gap-2 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by destination (Thailand, Mexico, Colombo...) or tour name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
                data-testid="input-search"
              />
              {searchQuery && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Search Results Indicator */}
          {searchQuery && !isLoading && (
            <div className="mt-4 text-sm text-muted-foreground" data-testid="text-search-indicator">
              Searching for <span className="font-medium text-foreground">{searchQuery}</span>...{' '}
              <span className="font-medium text-foreground">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'tour' : 'tours'} found
              </span> - see below
            </div>
          )}
        </div>
      </section>

      {/* Category Filters */}
      {categories.length > 0 && (
        <section className="py-8 border-b">
          <div className="container mx-auto px-6 md:px-8">
            <div className="flex gap-2 flex-wrap items-center justify-center">
              <Badge
                variant={selectedCategory === null ? "default" : "outline"}
                className="cursor-pointer hover-elevate px-4 py-2 text-sm"
                onClick={() => setSelectedCategory(null)}
                data-testid="button-category-all"
              >
                All Tours
              </Badge>
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer hover-elevate px-4 py-2 text-sm"
                  onClick={() => setSelectedCategory(category)}
                  data-testid={`button-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {formatCategoryName(category)}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tours Grid */}
      <section id="tours" className="py-16 md:py-24">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl md:text-3xl font-semibold" data-testid="text-section-title">
              {searchQuery 
                ? `Search Results` 
                : selectedCategory 
                  ? `${formatCategoryName(selectedCategory)} Tours` 
                  : 'All Tours'}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid="text-results-count">
              {searchQuery && filteredProducts.length < products.length
                ? `${filteredProducts.length} of ${products.length} tours`
                : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'tour' : 'tours'}`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-96 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg font-medium mb-2" data-testid="text-no-results">
                No tours found{searchQuery && ` for "${searchQuery}"`}
              </p>
              <p className="text-sm text-muted-foreground">
                Try searching for destinations like Thailand, Mexico, Colombo, or Portugal
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search-empty"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProducts.map((product) => (
                <TourCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center text-sm text-muted-foreground">
            <p data-testid="text-footer">© 2025 Tour Discoveries. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
