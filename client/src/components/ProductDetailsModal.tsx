import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock, Users, Star, Calendar } from "lucide-react";
import type { BokunProductDetails } from "@shared/schema";

interface ProductDetailsModalProps {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailsModal({
  productId,
  open,
  onOpenChange,
}: ProductDetailsModalProps) {
  const { data: product, isLoading } = useQuery<BokunProductDetails>({
    queryKey: ["/api/bokun/product", productId],
    enabled: open && !!productId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]" data-testid="modal-product-details">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : product ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <DialogTitle className="text-2xl" data-testid="text-product-title">
                    {product.title}
                  </DialogTitle>
                  {product.excerpt && (
                    <DialogDescription className="text-base mt-2">
                      {product.excerpt}
                    </DialogDescription>
                  )}
                </div>
                {product.price && (
                  <div className="text-right shrink-0">
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="text-2xl font-semibold text-primary" data-testid="text-product-price">
                      ${product.price.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {product.keyPhoto?.originalUrl && (
                  <div className="rounded-lg overflow-hidden border">
                    <img
                      src={product.keyPhoto.originalUrl}
                      alt={product.title}
                      className="w-full h-64 object-cover"
                      data-testid="img-product-photo"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {product.durationText && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{product.durationText}</span>
                    </div>
                  )}

                  {product.locationCode?.name && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium">{product.locationCode.name}</span>
                    </div>
                  )}

                  {product.capacityType && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Capacity:</span>
                      <span className="font-medium">
                        {product.capacityType.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}

                  {product.bookingType && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Booking:</span>
                      <span className="font-medium">
                        {product.bookingType.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                </div>

                {product.reviewCount !== undefined && product.reviewCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{product.reviewRating?.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">
                      ({product.reviewCount} reviews)
                    </span>
                  </div>
                )}

                {product.activityCategories && product.activityCategories.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {product.activityCategories.map((category) => (
                        <Badge key={category} variant="outline">
                          {category.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {product.summary && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Tour Description</h4>
                    <div
                      className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: product.summary }}
                      data-testid="text-product-description"
                    />
                  </div>
                )}

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Technical Details</h4>
                  <div className="space-y-1 text-xs font-mono text-muted-foreground">
                    <div>Product ID: {product.id}</div>
                    {product.difficultyLevel && (
                      <div>Difficulty: {product.difficultyLevel}</div>
                    )}
                    {product.meetingType && (
                      <div>Meeting Type: {product.meetingType}</div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Product details not available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
