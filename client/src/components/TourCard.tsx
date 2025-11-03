import { Link } from "wouter";
import { MapPin, Clock } from "lucide-react";
import type { BokunProduct } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";

interface TourCardProps {
  product: BokunProduct;
}

export function TourCard({ product }: TourCardProps) {
  const imagePlaceholder = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
  const imageUrl = product.keyPhoto?.originalUrl || imagePlaceholder;
  
  return (
    <Link href={`/tour/${product.id}`}>
      <Card 
        className="overflow-hidden hover-elevate active-elevate-2 cursor-pointer h-full"
        data-testid={`card-tour-${product.id}`}
      >
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
            data-testid={`img-tour-${product.id}`}
          />
        </div>
        <CardContent className="p-6">
          <h3 
            className="text-xl font-semibold mb-2 line-clamp-2"
            data-testid={`text-tour-title-${product.id}`}
          >
            {product.title}
          </h3>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
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

          {product.excerpt && (
            <p 
              className="text-sm text-muted-foreground mb-4 line-clamp-2"
              data-testid={`text-excerpt-${product.id}`}
            >
              {product.excerpt}
            </p>
          )}

          {product.price && (
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-muted-foreground">From</span>
              <span 
                className="text-2xl font-semibold"
                data-testid={`text-price-${product.id}`}
              >
                £{product.price.toFixed(2)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
