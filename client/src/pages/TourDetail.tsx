import { useState, useCallback, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityChecker } from "@/components/AvailabilityChecker";
import { useCurrency } from "@/contexts/CurrencyContext";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import type { BokunProductDetails } from "@shared/schema";
import useEmblaCarousel from "embla-carousel-react";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";

export default function TourDetail() {
  const { selectedCurrency } = useCurrency();
  const [, params] = useRoute("/tour/:id");
  const productId = params?.id;
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    align: "start",
    slidesToScroll: 1
  });

  const { data: product, isLoading } = useQuery<BokunProductDetails>({
    queryKey: ["/api/bokun/product", productId, selectedCurrency.code],
    queryFn: async () => {
      const response = await fetch(`/api/bokun/product/${productId}?currency=${selectedCurrency.code}`);
      if (!response.ok) throw new Error('Failed to fetch product');
      return response.json();
    },
    enabled: !!productId,
  });

  const imagePlaceholder = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80";
  const photos = product?.photos || [];

  // Set meta tags and structured data when product loads
  useEffect(() => {
    if (product) {
      const title = `${product.title} - Tour in ${product.locationCode?.name || 'Worldwide'} | Flights and Packages`;
      const excerpt = product.excerpt || product.title;
      const description = excerpt.length > 160 ? excerpt.substring(0, 157) + '...' : excerpt;
      const schemaDescription = excerpt.length > 200 ? excerpt.substring(0, 200) : excerpt;
      const ogImage = product.keyPhoto?.originalUrl || imagePlaceholder;
      
      setMetaTags(title, description, ogImage);

      // Add structured data for rich snippets
      // Use currency-adjusted price from API response
      const priceAmount = product.nextDefaultPriceMoney?.amount ?? product.nextDefaultPrice ?? product.price ?? 0;
      const priceCurrency = product.nextDefaultPriceMoney?.currency ?? selectedCurrency.code;
      
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'Tour',
        name: product.title,
        description: schemaDescription,
        image: ogImage,
        offers: {
          '@type': 'Offer',
          price: priceAmount.toString(),
          priceCurrency: priceCurrency,
          availability: 'https://schema.org/InStock'
        },
        destination: {
          '@type': 'Place',
          name: product.locationCode?.name || 'Worldwide'
        },
        duration: product.durationText || 'Variable',
        url: `https://tours.flightsandpackages.com/tour/${product.id}`
      };
      addJsonLD(schema);
    }
  }, [product, selectedCurrency.code]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Format category names for display
  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to Tours
            </Button>
          </Link>
          <Link href="/">
            <img 
              src={logoImage} 
              alt="Flights and Packages" 
              className="h-10 md:h-12 w-auto"
              data-testid="img-logo"
            />
          </Link>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-20" />

      {/* Gallery */}
      <section className="py-8">
        <div className="container mx-auto px-6 md:px-8">
          <div className="rounded-xl overflow-hidden mb-4">
            <img
              src={product.keyPhoto?.originalUrl || imagePlaceholder}
              alt={product.title}
              className="w-full aspect-[21/9] object-cover"
              data-testid="img-tour-hero"
              loading="lazy"
              decoding="async"
            />
          </div>
          {photos.length > 0 && (
            <div className="relative group">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-4">
                  {photos.map((photo, index) => (
                    <div 
                      key={index} 
                      className="flex-[0_0_auto] w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(16.666%-0.833rem)] rounded-lg overflow-hidden aspect-[4/3]"
                    >
                      <img
                        src={photo.originalUrl || imagePlaceholder}
                        alt={photo.description || `Tour photo ${index + 1}`}
                        className="w-full h-full object-cover"
                        data-testid={`img-gallery-${index}`}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {photos.length > 6 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur"
                    onClick={scrollPrev}
                    data-testid="button-gallery-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur"
                    onClick={scrollNext}
                    data-testid="button-gallery-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
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
                        {formatCategoryName(category)}
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
                  <TabsTrigger value="availability" data-testid="tab-availability">Availability</TabsTrigger>
                  {product.bookableExtras && product.bookableExtras.length > 0 && (
                    <TabsTrigger value="extras" data-testid="tab-extras">Add-ons</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="description" className="space-y-4 pt-6" data-testid="content-description">
                  {product.description && (
                    <div 
                      className="prose prose-sm max-w-none text-base leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  )}
                  {product.excerpt && !product.description && (
                    <div 
                      className="prose prose-sm max-w-none text-base leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: product.excerpt }}
                    />
                  )}
                  
                  {product.customFields && product.customFields.find(f => f.code === "Accommodation options") && (
                    <div className="pt-6 border-t">
                      <h3 className="text-lg font-semibold mb-4" data-testid="text-hotel-details">Hotel Details by Location</h3>
                      <div
                        className="prose prose-sm max-w-none text-base leading-relaxed"
                        data-testid="content-hotel-details"
                        dangerouslySetInnerHTML={{ 
                          __html: product.customFields.find(f => f.code === "Accommodation options")?.value || "" 
                        }}
                      />
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
                          <div 
                            className="text-sm leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: day.body || day.excerpt || '' }}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                )}

                <TabsContent value="availability" className="space-y-4 pt-6" data-testid="content-availability">
                  {productId && (
                    <AvailabilityChecker
                      productId={productId}
                      productTitle={product.title}
                      rates={product.rates}
                      bookableExtras={product.bookableExtras}
                    />
                  )}
                </TabsContent>

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
                                <div 
                                  className="text-sm text-muted-foreground prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: extra.information }}
                                />
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
                          {selectedCurrency.symbol}{product.price.toFixed(2)}
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
            <p data-testid="text-footer">© 2025 Flights and Packages. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
