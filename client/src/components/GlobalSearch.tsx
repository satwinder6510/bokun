import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, X, Loader2, Package, MapPin, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { captureSearch, captureSearchResultClicked } from "@/lib/posthog";

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

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
  onClose?: () => void;
  autoFocus?: boolean;
  variant?: "default" | "hero";
}

export function GlobalSearch({ className, placeholder = "Search destinations, tours...", onClose, autoFocus = false, variant = "default" }: GlobalSearchProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return { results: [], suggestions: [], total: 0 };
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&maxResults=10`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const results = data?.results || [];
  const suggestions = data?.suggestions || [];

  const handleNavigate = useCallback((result: SearchResult, index: number) => {
    // Track the click in PostHog
    captureSearchResultClicked({
      search_query: query,
      result_type: result.type,
      result_id: result.id,
      result_title: result.title,
      result_position: index + 1,
    });
    
    if (result.type === "package") {
      navigate(`/Holidays/${result.category}/${result.slug}`);
    } else {
      navigate(`/tour/${result.id}`);
    }
    setQuery("");
    setIsOpen(false);
    onClose?.();
  }, [navigate, onClose, query]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleNavigate(results[selectedIndex], selectedIndex);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setQuery("");
        onClose?.();
        break;
    }
  }, [isOpen, results, selectedIndex, handleNavigate, onClose]);

  useEffect(() => {
    if (query.length >= 2) {
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setIsOpen(false);
    }
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Track search in PostHog when results come back
  useEffect(() => {
    if (debouncedQuery.length >= 2 && data) {
      captureSearch({
        search_query: debouncedQuery,
        search_type: 'global',
        results_count: data.total || 0,
      });
    }
  }, [debouncedQuery, data]);

  const formatPrice = (price: number | undefined) => {
    if (!price) return null;
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const isHero = variant === "hero";

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className={cn(
          "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
          isHero ? "left-4 h-5 w-5" : "left-3 h-4 w-4"
        )} />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className={cn(
            isHero 
              ? "pl-12 pr-12 h-12 md:h-14 text-base md:text-lg bg-stone-50 border-stone-200" 
              : "pl-10 pr-10 h-10"
          )}
          data-testid="input-global-search"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-1/2 -translate-y-1/2",
              isHero ? "right-2 h-10 w-10" : "right-1 h-8 w-8"
            )}
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            data-testid="button-clear-search"
          >
            <X className={isHero ? "h-5 w-5" : "h-4 w-4"} />
          </Button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-[70vh] overflow-hidden"
          data-testid="dropdown-search-results"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="overflow-y-auto max-h-[60vh]">
              {suggestions.length > 0 && (
                <div className="px-3 py-2 border-b bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Suggestions</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.slice(0, 4).map((suggestion, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="cursor-pointer text-xs"
                        onClick={() => handleSuggestionClick(suggestion)}
                        data-testid={`badge-suggestion-${i}`}
                      >
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="py-1">
                {results.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    className={cn(
                      "w-full px-3 py-3 flex items-start gap-3 text-left transition-colors",
                      selectedIndex === index
                        ? "bg-accent"
                        : "hover-elevate"
                    )}
                    onClick={() => handleNavigate(result, index)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    data-testid={`search-result-${result.type}-${result.id}`}
                  >
                    {result.image ? (
                      <img
                        src={result.image}
                        alt=""
                        className="w-16 h-12 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        {result.type === "package" ? (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm line-clamp-1">
                            {result.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {result.type === "package" ? "Package" : "Tour"}
                            </Badge>
                            {result.category && (
                              <span className="text-xs text-muted-foreground">
                                {result.category}
                              </span>
                            )}
                            {result.duration && (
                              <span className="text-xs text-muted-foreground">
                                {result.duration}
                              </span>
                            )}
                          </div>
                        </div>
                        {result.price && (
                          <p className="text-sm font-semibold text-primary whitespace-nowrap">
                            {formatPrice(result.price)}
                          </p>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>

              {data && data.total > 10 && (
                <div className="px-3 py-2 border-t text-center">
                  <button
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      navigate(`/search?q=${encodeURIComponent(query)}`);
                      setIsOpen(false);
                      onClose?.();
                    }}
                    data-testid="button-view-all-results"
                  >
                    View all {data.total} results
                  </button>
                </div>
              )}
            </div>
          ) : debouncedQuery.length >= 2 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No results found</p>
              <p className="text-sm mt-1">
                Try different keywords or check spelling
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-9 w-9"
      aria-label="Search"
      data-testid="button-open-search"
    >
      <Search className="h-5 w-5" />
    </Button>
  );
}
