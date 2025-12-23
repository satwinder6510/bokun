import { useState } from "react";
import { Filter, X, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterState {
  priceRange: [number, number];
  duration: string;
  destination: string;
  sortBy: string;
}

interface SearchFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  destinations?: string[];
  durations?: string[];
  priceMin?: number;
  priceMax?: number;
  resultCount?: number;
  className?: string;
}

const DEFAULT_DURATIONS = [
  "Any Duration",
  "1-3 nights",
  "4-7 nights",
  "8-14 nights",
  "15+ nights",
];

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "duration-short", label: "Duration: Shortest" },
  { value: "duration-long", label: "Duration: Longest" },
];

export function SearchFilters({
  filters,
  onFiltersChange,
  destinations = [],
  durations = DEFAULT_DURATIONS,
  priceMin = 0,
  priceMax = 10000,
  resultCount,
  className,
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters =
    filters.priceRange[0] > priceMin ||
    filters.priceRange[1] < priceMax ||
    (filters.duration && filters.duration !== "Any Duration") ||
    filters.destination;

  const activeFilterCount = [
    filters.priceRange[0] > priceMin || filters.priceRange[1] < priceMax,
    filters.duration && filters.duration !== "Any Duration",
    filters.destination,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      priceRange: [priceMin, priceMax],
      duration: "",
      destination: "",
      sortBy: "relevance",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Price Range */}
      <div className="space-y-4">
        <label className="text-sm font-medium">Price Range</label>
        <Slider
          value={filters.priceRange}
          min={priceMin}
          max={priceMax}
          step={50}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, priceRange: value as [number, number] })
          }
          className="w-full"
          data-testid="slider-price-range"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{formatPrice(filters.priceRange[0])}</span>
          <span>{formatPrice(filters.priceRange[1])}</span>
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Duration</label>
        <Select
          value={filters.duration || "Any Duration"}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, duration: value === "Any Duration" ? "" : value })
          }
        >
          <SelectTrigger data-testid="select-duration">
            <SelectValue placeholder="Any Duration" />
          </SelectTrigger>
          <SelectContent>
            {durations.map((duration) => (
              <SelectItem key={duration} value={duration}>
                {duration}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Destination */}
      {destinations.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Destination</label>
          <Select
            value={filters.destination || "all"}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, destination: value === "all" ? "" : value })
            }
          >
            <SelectTrigger data-testid="select-destination">
              <SelectValue placeholder="All Destinations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Destinations</SelectItem>
              {destinations.map((destination) => (
                <SelectItem key={destination} value={destination}>
                  {destination}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Desktop Filters */}
      <div className="hidden md:flex items-center gap-3">
        {/* Price Range Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "gap-2",
                (filters.priceRange[0] > priceMin || filters.priceRange[1] < priceMax) &&
                  "border-primary text-primary"
              )}
              data-testid="button-filter-price"
            >
              Price
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <h4 className="font-medium">Price Range</h4>
              <Slider
                value={filters.priceRange}
                min={priceMin}
                max={priceMax}
                step={50}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, priceRange: value as [number, number] })
                }
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{formatPrice(filters.priceRange[0])}</span>
                <span>{formatPrice(filters.priceRange[1])}</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Duration Select */}
        <Select
          value={filters.duration || "Any Duration"}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, duration: value === "Any Duration" ? "" : value })
          }
        >
          <SelectTrigger
            className={cn(
              "w-[160px]",
              filters.duration && filters.duration !== "Any Duration" && "border-primary text-primary"
            )}
            data-testid="select-duration-desktop"
          >
            <SelectValue placeholder="Duration" />
          </SelectTrigger>
          <SelectContent>
            {durations.map((duration) => (
              <SelectItem key={duration} value={duration}>
                {duration}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Destination Select */}
        {destinations.length > 0 && (
          <Select
            value={filters.destination || "all"}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, destination: value === "all" ? "" : value })
            }
          >
            <SelectTrigger
              className={cn("w-[180px]", filters.destination && "border-primary text-primary")}
              data-testid="select-destination-desktop"
            >
              <SelectValue placeholder="All Destinations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Destinations</SelectItem>
              {destinations.map((destination) => (
                <SelectItem key={destination} value={destination}>
                  {destination}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Mobile Filter Button */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className="md:hidden gap-2"
            data-testid="button-filters-mobile"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </SheetTitle>
          </SheetHeader>
          <div className="py-6">
            <FilterContent />
          </div>
          <SheetFooter className="flex-row gap-3">
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear All
              </Button>
            )}
            <Button onClick={() => setIsOpen(false)} className="flex-1">
              {resultCount !== undefined
                ? `Show ${resultCount} Results`
                : "Apply Filters"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sort */}
      <div className="ml-auto">
        <Select
          value={filters.sortBy || "relevance"}
          onValueChange={(value) => onFiltersChange({ ...filters, sortBy: value })}
        >
          <SelectTrigger className="w-[180px]" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filter Pills */}
      {hasActiveFilters && (
        <div className="w-full flex flex-wrap gap-2 pt-2">
          {(filters.priceRange[0] > priceMin || filters.priceRange[1] < priceMax) && (
            <Badge variant="secondary" className="gap-1">
              {formatPrice(filters.priceRange[0])} - {formatPrice(filters.priceRange[1])}
              <button
                onClick={() =>
                  onFiltersChange({ ...filters, priceRange: [priceMin, priceMax] })
                }
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.duration && filters.duration !== "Any Duration" && (
            <Badge variant="secondary" className="gap-1">
              {filters.duration}
              <button
                onClick={() => onFiltersChange({ ...filters, duration: "" })}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.destination && (
            <Badge variant="secondary" className="gap-1">
              {filters.destination}
              <button
                onClick={() => onFiltersChange({ ...filters, destination: "" })}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function getDefaultFilters(priceMin = 0, priceMax = 10000): FilterState {
  return {
    priceRange: [priceMin, priceMax],
    duration: "",
    destination: "",
    sortBy: "relevance",
  };
}

export function applyFilters<T extends { price?: number; duration?: string; category?: string }>(
  items: T[],
  filters: FilterState,
  priceMin = 0,
  priceMax = 10000
): T[] {
  let result = [...items];

  // Price filter
  if (filters.priceRange[0] > priceMin || filters.priceRange[1] < priceMax) {
    result = result.filter(
      (item) =>
        item.price !== undefined &&
        item.price >= filters.priceRange[0] &&
        item.price <= filters.priceRange[1]
    );
  }

  // Duration filter
  if (filters.duration && filters.duration !== "Any Duration") {
    result = result.filter((item) => {
      if (!item.duration) return false;
      const nights = parseDuration(item.duration);
      if (nights === null) return true;

      switch (filters.duration) {
        case "1-3 nights":
          return nights >= 1 && nights <= 3;
        case "4-7 nights":
          return nights >= 4 && nights <= 7;
        case "8-14 nights":
          return nights >= 8 && nights <= 14;
        case "15+ nights":
          return nights >= 15;
        default:
          return true;
      }
    });
  }

  // Destination filter
  if (filters.destination) {
    result = result.filter(
      (item) => item.category?.toLowerCase() === filters.destination.toLowerCase()
    );
  }

  // Sort
  switch (filters.sortBy) {
    case "price-low":
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case "price-high":
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case "duration-short":
      result.sort((a, b) => (parseDuration(a.duration) || 0) - (parseDuration(b.duration) || 0));
      break;
    case "duration-long":
      result.sort((a, b) => (parseDuration(b.duration) || 0) - (parseDuration(a.duration) || 0));
      break;
  }

  return result;
}

function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}
