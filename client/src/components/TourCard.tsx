import { Link } from "wouter";
import { MapPin, Clock } from "lucide-react";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { getCardImageUrl } from "@/lib/imageProxy";
import type { BokunProduct } from "@shared/schema";

interface TourCardProps {
  product: BokunProduct;
}

export function TourCard({ product }: TourCardProps) {
  const { formatBokunPrice } = useExchangeRate();
  const imageUrl = getCardImageUrl(product.keyPhoto?.originalUrl);
  
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
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Top Badge - Category */}
        {firstCategory && (
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10">
            <span className="bg-white/90 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold text-foreground line-clamp-1 max-w-[140px] sm:max-w-[180px]">
              {formatCategoryName(firstCategory)}
            </span>
          </div>
        )}

        {/* "LAND TOUR" label */}
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
          <span className="text-white/80 text-[10px] sm:text-xs font-bold tracking-wider">
            LAND TOUR
          </span>
        </div>

        {/* Bottom content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 z-10">
          {/* Tour Title */}
          <h3 
            className="text-white text-lg sm:text-2xl font-bold mb-2 sm:mb-3 line-clamp-2 leading-tight"
            data-testid={`text-tour-title-${product.id}`}
          >
            {product.title}
          </h3>

          {/* Location and Duration */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-white/90 mb-3 sm:mb-4">
            {product.locationCode?.name && (
              <div className="flex items-center gap-1" data-testid={`text-location-${product.id}`}>
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span>{product.locationCode.name}</span>
              </div>
            )}
            {product.durationText && (
              <div className="flex items-center gap-1" data-testid={`text-duration-${product.id}`}>
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span>{product.durationText}</span>
              </div>
            )}
          </div>

          {/* Price (converted from USD to GBP with 10% markup) */}
          {product.price && (
            <div className="flex items-baseline gap-1 mb-3 sm:mb-4">
              <span className="text-xs sm:text-sm text-white/80">from</span>
              <div className="flex flex-col">
                <span 
                  className="text-2xl sm:text-3xl font-bold text-white"
                  data-testid={`text-price-${product.id}`}
                >
                  £{formatBokunPrice(product.price).toFixed(0)}
                </span>
                <span className="text-[10px] sm:text-xs text-white/60">GBP</span>
              </div>
              <span className="text-xs sm:text-sm text-white/80">/pp</span>
            </div>
          )}
          
          {/* View More Button */}
          <div className="bg-slate-800 hover:bg-slate-900 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors text-center">
            view more
          </div>
        </div>
      </div>
    </Link>
  );
}
