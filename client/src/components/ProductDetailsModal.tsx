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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Clock, Users, Star, Calendar } from "lucide-react";
import { AvailabilityChecker } from "@/components/AvailabilityChecker";
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="modal-product-details">
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
                {(product.price || product.nextDefaultPrice) && (
                  <div className="text-right shrink-0">
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="text-2xl font-semibold text-primary" data-testid="text-product-price">
                      £{(product.nextDefaultPrice || product.price)?.toFixed(2)}
                    </div>
                    {product.rates && product.rates.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Price varies by category
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogHeader>

            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
                <TabsTrigger value="availability" data-testid="tab-availability">Check Availability</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
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

                {product.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Tour Description</h4>
                    <div
                      className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                      data-testid="text-product-description"
                    />
                  </div>
                )}

                {product.itinerary && product.itinerary.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">Day-by-Day Itinerary</h4>
                    <div className="space-y-3">
                      {product.itinerary.map((day) => (
                        <div key={day.id} className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge variant="secondary" className="shrink-0">Day {day.day}</Badge>
                            <h5 className="font-medium text-sm flex-1">{day.title}</h5>
                          </div>
                          {day.body && (
                            <div
                              className="text-xs text-muted-foreground prose prose-xs max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: day.body }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {product.rates && product.rates.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">Pricing by Room & Hotel Category</h4>
                    <div className="space-y-2">
                      {product.rates.map((rate) => (
                        <div key={rate.id} className="border rounded-lg p-3 bg-card">
                          <div className="font-medium text-sm">{rate.title}</div>
                          {rate.description && (
                            <div className="text-xs text-muted-foreground mt-1">{rate.description}</div>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {rate.pricedPerPerson && <span>Per person pricing</span>}
                            {rate.minPerBooking && rate.maxPerBooking && (
                              <span>
                                {rate.minPerBooking === rate.maxPerBooking 
                                  ? `Exactly ${rate.minPerBooking} ${rate.minPerBooking === 1 ? 'person' : 'people'}`
                                  : `${rate.minPerBooking}-${rate.maxPerBooking} people`
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                      <strong>Note:</strong> Final pricing varies based on your selected room type and hotel category. 
                      Use the Availability Checker below to see exact pricing for your travel dates.
                    </div>
                  </div>
                )}

                {product.customFields && product.customFields.find(f => f.code === "Accommodation options") && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">Hotel Details by Location</h4>
                    <div
                      className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ 
                        __html: product.customFields.find(f => f.code === "Accommodation options")?.value || "" 
                      }}
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
              </TabsContent>

              <TabsContent value="availability">
                <div className="py-4">
                  {product.rates && product.rates.length > 0 ? (
                    <AvailabilityChecker
                      productId={productId!}
                      productTitle={product.title}
                      rates={product.rates}
                      bookableExtras={product.bookableExtras}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No availability information for this product
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
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
