import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BokunProductDetails } from "@shared/schema";

export default function TourDetail() {
  const [, params] = useRoute("/tour/:id");
  const productId = params?.id;

  const { data: product, isLoading } = useQuery<BokunProductDetails>({
    queryKey: ["/api/bokun/product", productId],
    enabled: !!productId,
  });

  const imagePlaceholder = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80";
  const photos = product?.photos || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-6 md:px-8 h-20 flex items-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-6 md:px-8 py-16">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-muted rounded-xl" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Tour Not Found</h2>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to Tours
            </Button>
          </Link>
          <h1 className="text-lg font-semibold" data-testid="text-site-title">
            Tour Discoveries
          </h1>
        </div>
      </header>

      {/* Gallery */}
      <section className="py-8">
        <div className="container mx-auto px-6 md:px-8">
          <div className="rounded-xl overflow-hidden mb-4">
            <img
              src={product.keyPhoto?.originalUrl || imagePlaceholder}
              alt={product.title}
              className="w-full aspect-[21/9] object-cover"
              data-testid="img-tour-hero"
            />
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {photos.slice(0, 6).map((photo, index) => (
                <div key={index} className="rounded-lg overflow-hidden aspect-[4/3]">
                  <img
                    src={photo.originalUrl || imagePlaceholder}
                    alt={photo.description || `Tour photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    data-testid={`img-gallery-${index}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <section className="pb-16">
        <div className="container mx-auto px-6 md:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="text-4xl font-semibold mb-4" data-testid="text-tour-title">
                  {product.title}
                </h1>
                
                <div className="flex flex-wrap gap-4 text-muted-foreground mb-6">
                  {product.durationText && (
                    <div className="flex items-center gap-2" data-testid="text-duration">
                      <Clock className="w-4 h-4" />
                      <span>{product.durationText}</span>
                    </div>
                  )}
                  {product.locationCode?.name && (
                    <div className="flex items-center gap-2" data-testid="text-location">
                      <MapPin className="w-4 h-4" />
                      <span>{product.locationCode.name}</span>
                    </div>
                  )}
                </div>

                {product.activityCategories && product.activityCategories.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-6">
                    {product.activityCategories.map((category) => (
                      <Badge key={category} variant="outline" data-testid={`badge-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                        {category}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Tabs */}
              <Tabs defaultValue="description" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="description" data-testid="tab-description">Description</TabsTrigger>
                  {product.itinerary && product.itinerary.length > 0 && (
                    <TabsTrigger value="itinerary" data-testid="tab-itinerary">Itinerary</TabsTrigger>
                  )}
                  {product.bookableExtras && product.bookableExtras.length > 0 && (
                    <TabsTrigger value="extras" data-testid="tab-extras">Add-ons</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="description" className="space-y-4 pt-6" data-testid="content-description">
                  {product.description && (
                    <div className="prose prose-sm max-w-none">
                      <p className="text-base leading-relaxed">{product.description}</p>
                    </div>
                  )}
                  {product.excerpt && !product.description && (
                    <div className="prose prose-sm max-w-none">
                      <p className="text-base leading-relaxed">{product.excerpt}</p>
                    </div>
                  )}
                </TabsContent>

                {product.itinerary && product.itinerary.length > 0 && (
                  <TabsContent value="itinerary" className="space-y-4 pt-6" data-testid="content-itinerary">
                    {product.itinerary.map((day) => (
                      <Card key={day.id}>
                        <CardHeader>
                          <CardTitle className="text-lg" data-testid={`text-itinerary-day-${day.day}`}>
                            Day {day.day}: {day.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm leading-relaxed">{day.body || day.excerpt}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                )}

                {product.bookableExtras && product.bookableExtras.length > 0 && (
                  <TabsContent value="extras" className="space-y-4 pt-6" data-testid="content-extras">
                    {product.bookableExtras.map((extra) => (
                      <Card key={extra.id}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold mb-1" data-testid={`text-extra-title-${extra.id}`}>
                                {extra.title}
                              </h4>
                              {extra.information && (
                                <p className="text-sm text-muted-foreground">{extra.information}</p>
                              )}
                            </div>
                            {extra.price && !extra.free && (
                              <span className="font-semibold" data-testid={`text-extra-price-${extra.id}`}>
                                £{extra.price.toFixed(2)}
                              </span>
                            )}
                            {extra.free && (
                              <Badge variant="outline">Free</Badge>
                            )}
                            {extra.included && (
                              <Badge>Included</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                )}
              </Tabs>
            </div>

            {/* Booking Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardContent className="p-6 space-y-6">
                  {product.price && (
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm text-muted-foreground">From</span>
                        <span className="text-3xl font-semibold" data-testid="text-price">
                          £{product.price.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">per person</p>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Select Date
                      </label>
                      <p className="text-sm text-muted-foreground">Coming soon</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        <Users className="w-4 h-4 inline mr-2" />
                        Travelers
                      </label>
                      <p className="text-sm text-muted-foreground">Coming soon</p>
                    </div>
                  </div>

                  <Separator />

                  <Button className="w-full" size="lg" disabled data-testid="button-add-to-cart">
                    Add to Cart (Coming Soon)
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Booking functionality will be available soon
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
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
