import { useState, useCallback, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Calendar, Users, ChevronLeft, ChevronRight, ChevronDown, Plane } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { sanitizeHtml } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityChecker } from "@/components/AvailabilityChecker";
import { FlightPricingCalendar } from "@/components/FlightPricingCalendar";
import { useCurrency } from "@/contexts/CurrencyContext";
import { setMetaTags, addJsonLD, generateBreadcrumbSchema, generateTourSchema } from "@/lib/meta-tags";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { getHeroImageUrl, getThumbImageUrl } from "@/lib/imageProxy";
import { captureTourViewed } from "@/lib/posthog";
import { useScrollDepth } from "@/hooks/useScrollDepth";
import type { BokunProductDetails } from "@shared/schema";
import useEmblaCarousel from "embla-carousel-react";

export default function TourDetail() {
  const { selectedCurrency } = useCurrency();
  const { formatBokunPrice } = useExchangeRate();
  const [, params] = useRoute("/tour/:id");
  const productId = params?.id;
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    align: "start",
    slidesToScroll: 1
  });

  const { data: product, isLoading } = useQuery<BokunProductDetails>({
    queryKey: ["/api/bokun/product", productId],
    queryFn: async () => {
      // Always fetch USD prices from Bokun - conversion to GBP happens on frontend
      const response = await fetch(`/api/bokun/product/${productId}`);
      if (!response.ok) throw new Error('Failed to fetch product');
      return response.json();
    },
    enabled: !!productId,
  });

  // Check if there are flight packages linked to this tour
  const { data: flightPricingData } = useQuery<{ enabled: boolean; prices: any[] }>({
    queryKey: ["/api/tours", productId, "flight-pricing-check"],
    queryFn: async () => {
      const response = await fetch(`/api/tours/${productId}/flight-pricing`);
      if (!response.ok) return { enabled: false, prices: [] };
      return response.json();
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });

  const hasFlightPackages = flightPricingData?.enabled && flightPricingData?.prices?.length > 0;

  // Track scroll depth on tour detail page
  useScrollDepth({
    pageType: 'tour_detail',
    properties: product ? { tour_id: product.id, tour_title: product.title } : undefined
  });

  const imagePlaceholder = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80";
  const photos = product?.photos || [];

  useEffect(() => {
    if (product) {
      const title = `${product.title} - Tour in ${product.locationCode?.name || 'Worldwide'} | Flights and Packages`;
      const excerpt = product.excerpt || product.title;
      const description = excerpt.length > 160 ? excerpt.substring(0, 157) + '...' : excerpt;
      const ogImage = product.keyPhoto?.originalUrl || imagePlaceholder;
      const destination = product.locationCode?.name || 'Worldwide';
      
      setMetaTags(title, description, ogImage, { type: 'product' });

      const netPrice = product.nextDefaultPriceMoney?.amount ?? product.nextDefaultPrice ?? product.price ?? 0;
      const priceAmount = formatBokunPrice(netPrice);
      
      addJsonLD([
        generateBreadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Land Tours", url: "/tours" },
          { name: product.title, url: `/tour/${product.id}` }
        ]),
        generateTourSchema({
          name: product.title,
          description: excerpt.length > 200 ? excerpt.substring(0, 200) : excerpt,
          image: ogImage,
          price: priceAmount,
          currency: 'GBP',
          duration: product.durationText || undefined,
          destination: destination,
          url: `/tour/${product.id}`
        })
      ]);

      // Track tour viewed event
      captureTourViewed({
        tour_id: product.id,
        tour_title: product.title,
        tour_duration: product.durationText || undefined,
        tour_price: priceAmount
      });
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
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="container mx-auto px-6 md:px-8 py-16">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-stone-200 rounded-xl" />
            <div className="h-8 bg-stone-200 rounded w-3/4" />
            <div className="h-4 bg-stone-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Spacer for fixed header */}
      <div className="h-20" />

      {/* Gallery */}
      <section className="py-8">
        <div className="container mx-auto px-6 md:px-8">
          {/* Hero Image with Title Overlay */}
          <div className="relative rounded-xl overflow-hidden mb-4 bg-muted">
            <img
              src={getHeroImageUrl(product.keyPhoto?.originalUrl)}
              alt={product.title}
              width={1920}
              height={640}
              className="w-full aspect-[21/9] object-cover"
              data-testid="img-tour-hero"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-white/10 text-white border-white/30 gap-1 text-[10px] sm:text-xs">
                  LAND TOUR
                </Badge>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg" data-testid="text-tour-title-overlay">
                {product.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/90">
                {product.durationText && (
                  <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                    <span>{product.durationText}</span>
                  </div>
                )}
                {product.locationCode?.name && (
                  <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                    <span>{product.locationCode.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {photos.length > 0 && (
            <div className="relative group">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-4">
                  {photos.map((photo, index) => (
                    <div 
                      key={index} 
                      className="flex-[0_0_auto] w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(16.666%-0.833rem)] rounded-lg overflow-hidden aspect-[4/3] bg-muted"
                    >
                      <img
                        src={getThumbImageUrl(photo.originalUrl)}
                        alt={photo.description || `Tour photo ${index + 1}`}
                        width={400}
                        height={300}
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
                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur"
                    onClick={scrollPrev}
                    data-testid="button-gallery-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur"
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
          <div className="max-w-4xl">
            {/* Main Content */}
            <div className="space-y-8">
              <div>
                <h1 className="text-4xl font-semibold mb-4" data-testid="text-tour-title">
                  {product.title}
                </h1>
                
                <div className="flex flex-wrap gap-4 text-muted-foreground mb-6">
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50">
                    LAND TOUR
                  </Badge>
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

              {/* Sticky Navigation Tabs */}
              <div className="sticky top-16 bg-stone-50 z-10 pb-4 border-b mb-6">
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => document.getElementById('description-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    data-testid="nav-description"
                  >
                    Description
                  </Button>
                  {product.included && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => document.getElementById('included-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      data-testid="nav-included"
                    >
                      What's Included
                    </Button>
                  )}
                  {product.itinerary && product.itinerary.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => document.getElementById('itinerary-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      data-testid="nav-itinerary"
                    >
                      Itinerary
                    </Button>
                  )}
                  {hasFlightPackages && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => document.getElementById('flight-packages-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      data-testid="nav-flight-packages"
                    >
                      <Plane className="w-4 h-4 mr-1" />
                      Flight Packages
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => document.getElementById('availability-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    data-testid="nav-availability"
                  >
                    Availability
                  </Button>
                  {product.bookableExtras && product.bookableExtras.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => document.getElementById('extras-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      data-testid="nav-extras"
                    >
                      Add-ons
                    </Button>
                  )}
                  {(product.excluded || product.requirements || product.attention) && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => document.getElementById('more-info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      data-testid="nav-more-info"
                    >
                      More Info
                    </Button>
                  )}
                </div>
              </div>

              {/* Description Section */}
              <div id="description-section" className="space-y-4 scroll-mt-32" data-testid="content-description">
                  {product.description && (
                    <div 
                      className="prose prose-sm max-w-none text-base leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                    />
                  )}
                  {product.excerpt && !product.description && (
                    <div 
                      className="prose prose-sm max-w-none text-base leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.excerpt) }}
                    />
                  )}
                  
                  {product.customFields && product.customFields.find(f => f.code === "Accommodation options") && (
                    <div className="pt-6 border-t">
                      <h3 className="text-lg font-semibold mb-4" data-testid="text-hotel-details">Hotel Details by Location</h3>
                      <div
                        className="prose prose-sm max-w-none text-base leading-relaxed"
                        data-testid="content-hotel-details"
                        dangerouslySetInnerHTML={{ 
                          __html: sanitizeHtml(product.customFields.find(f => f.code === "Accommodation options")?.value || "") 
                        }}
                      />
                    </div>
                  )}
                </div>

              {/* What's Included Section */}
              {product.included && (
                <div id="included-section" className="space-y-4 pt-8 scroll-mt-32" data-testid="content-included">
                  <h2 className="text-2xl font-semibold mb-4">What's Included</h2>
                  <Card>
                    <CardContent className="p-6">
                      <div 
                        className="prose prose-sm max-w-none text-base leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.included) }}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Itinerary Section */}
              {product.itinerary && product.itinerary.length > 0 && (
                <div id="itinerary-section" className="space-y-4 pt-8 scroll-mt-32" data-testid="content-itinerary">
                  <h2 className="text-2xl font-semibold mb-4">Itinerary</h2>
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
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(day.body || day.excerpt || '') }}
                          />
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}

              {/* Flight Packages Section - only renders content if flight pricing exists */}
              {productId && hasFlightPackages && (
                <div id="flight-packages-section" className="pt-8 scroll-mt-32" data-testid="content-flight-packages">
                  <FlightPricingCalendar
                    bokunProductId={productId}
                    productTitle={product.title}
                  />
                </div>
              )}

              {/* Availability Section */}
              <div id="availability-section" className="space-y-4 pt-8 scroll-mt-32" data-testid="content-availability">
                <h2 className="text-2xl font-semibold mb-4">Check Availability & Pricing (Land Only)</h2>
                  {productId && (
                    <AvailabilityChecker
                      productId={productId}
                      productTitle={product.title}
                      rates={product.rates}
                      bookableExtras={product.bookableExtras}
                      startingPrice={product.price ? formatBokunPrice(product.price) : undefined}
                    />
                  )}
              </div>

              {/* Add-ons Section */}
              {product.bookableExtras && product.bookableExtras.length > 0 && (
                <div id="extras-section" className="space-y-4 pt-8 scroll-mt-32" data-testid="content-extras">
                  <h2 className="text-2xl font-semibold mb-4">Available Add-ons</h2>
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
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(extra.information) }}
                                />
                              )}
                            </div>
                            {extra.price && !extra.free && (
                              <span className="font-semibold" data-testid={`text-extra-price-${extra.id}`}>
                                £{formatBokunPrice(extra.price).toFixed(2)}
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
                </div>
              )}

              {/* More Info Section */}
              {(product.excluded || product.requirements || product.attention) && (
                <div id="more-info-section" className="space-y-6 pt-8 scroll-mt-32" data-testid="content-more-info">
                  <h2 className="text-2xl font-semibold mb-4">More Information</h2>
                  
                  {product.excluded && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Exclusions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div 
                          className="prose prose-sm max-w-none text-base leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.excluded) }}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {product.requirements && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">What Do I Need to Bring?</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div 
                          className="prose prose-sm max-w-none text-base leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.requirements) }}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {product.attention && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Please Note</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div 
                          className="prose prose-sm max-w-none text-base leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.attention) }}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
