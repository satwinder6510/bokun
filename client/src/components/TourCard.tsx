import { Link } from "wouter";
import { MapPin, Clock } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { BokunProduct } from "@shared/schema";

interface TourCardProps {
  product: BokunProduct;
}

export function TourCard({ product }: TourCardProps) {
  const { selectedCurrency } = useCurrency();
  const imagePlaceholder = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
  const imageUrl = product.keyPhoto?.originalUrl || imagePlaceholder;
  
  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const firstCategory = product.activityCategories?.[0];
  
  return (
    <Link href={`/tour/${product.id}`}>
      <div 
        className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer"
        data-testid={`card-tour-${product.id}`}
      >
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            data-testid={`img-tour-${product.id}`}
          />
        </div>

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Top Badge - Category */}
        {firstCategory && (
          <div className="absolute top-4 left-4 z-10">
            <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-foreground">
              {formatCategoryName(firstCategory)}
            </span>
          </div>
        )}

        {/* "DISCOVER" label */}
        <div className="absolute top-4 right-4 z-10">
          <span className="text-white/80 text-xs font-bold tracking-wider">
            DISCOVER
          </span>
        </div>

        {/* Bottom content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
          {/* Tour Title */}
          <h3 
            className="text-white text-2xl font-bold mb-3 line-clamp-2 leading-tight"
            data-testid={`text-tour-title-${product.id}`}
          >
            {product.title}
          </h3>

          {/* Location and Duration */}
          <div className="flex items-center gap-4 text-sm text-white/90 mb-4">
            {product.locationCode?.name && (
              <div className="flex items-center gap-1" data-testid={`text-location-${product.id}`}>
                <MapPin className="w-4 h-4" />
                <span>{product.locationCode.name}</span>
              </div>
            )}
            {product.durationText && (
              <div className="flex items-center gap-1" data-testid={`text-duration-${product.id}`}>
                <Clock className="w-4 h-4" />
                <span>{product.durationText}</span>
              </div>
            )}
          </div>

          {/* Price and CTA */}
          <div className="flex items-center justify-between">
            {product.price && (
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-white/80">from</span>
                <div className="flex flex-col">
                  <span 
                    className="text-3xl font-bold text-white"
                    data-testid={`text-price-${product.id}`}
                  >
                    £{product.price.toFixed(0)}
                  </span>
                  <span className="text-xs text-white/60">{selectedCurrency.code}</span>
                </div>
                <span className="text-sm text-white/80">/pp</span>
              </div>
            )}
            
            {/* View More button */}
            <div className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold transition-colors">
              view more
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
