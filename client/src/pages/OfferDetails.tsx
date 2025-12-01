import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { useEffect } from "react";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Utensils, 
  Plane, 
  Check, 
  Star,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { CustomOffer } from "@shared/schema";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";

interface ItineraryDay {
  day: number;
  title: string;
  description: string;
}

interface Accommodation {
  name: string;
  description: string;
  image?: string;
}

export default function OfferDetails() {
  const [, params] = useRoute("/offer/:slug");
  const slug = params?.slug;

  const { data: offer, isLoading, error } = useQuery<CustomOffer>({
    queryKey: ['/api/offers', slug],
    enabled: !!slug,
  });

  useEffect(() => {
    if (offer) {
      const title = `${offer.title} - Flights and Packages`;
      const description = offer.overview?.slice(0, 160) || `Book ${offer.title} with Flights and Packages. ${offer.duration} in ${offer.destination}.`;
      
      setMetaTags(title, description, offer.featuredImage || logoImage);

      const schema = {
        '@context': 'https://schema.org',
        '@type': 'TravelAction',
        name: offer.title,
        description: offer.overview,
        location: {
          '@type': 'Place',
          name: offer.destination,
          address: {
            '@type': 'PostalAddress',
            addressCountry: offer.country
          }
        },
        offers: {
          '@type': 'Offer',
          price: offer.priceFrom,
          priceCurrency: offer.currency,
          availability: 'https://schema.org/InStock'
        }
      };
      addJsonLD(schema);
    }
  }, [offer]);

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'USD': return '$';
      default: return currency;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-[50vh] bg-muted animate-pulse" />
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="h-10 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
            <div className="h-40 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-2xl font-bold mb-4">Holiday Package Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The holiday package you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Homepage
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const itinerary: ItineraryDay[] = Array.isArray(offer.itinerary) ? offer.itinerary : [];
  const accommodation: Accommodation[] = Array.isArray(offer.accommodation) ? offer.accommodation : [];
  const gallery: string[] = Array.isArray(offer.gallery) ? offer.gallery : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[50vh] md:h-[60vh] w-full overflow-hidden">
        <img
          src={offer.featuredImage || 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600'}
          alt={offer.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Back button */}
        <div className="absolute top-6 left-6">
          <Link href="/">
            <Button variant="outline" className="bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="container mx-auto max-w-5xl">
            <div className="flex flex-wrap gap-2 mb-4">
              {offer.isFeatured && (
                <Badge className="bg-primary text-primary-foreground">
                  <Star className="w-3 h-3 mr-1" />
                  Featured
                </Badge>
              )}
              {offer.region && (
                <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur-sm border-0">
                  {offer.region}
                </Badge>
              )}
              {offer.country && (
                <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur-sm border-0">
                  {offer.country}
                </Badge>
              )}
            </div>
            
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-4" data-testid="text-offer-title">
              {offer.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-white/90">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {offer.destination}
              </span>
              {offer.duration && (
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {offer.duration}
                </span>
              )}
              {offer.mealPlan && (
                <span className="flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  {offer.mealPlan}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Plane className="w-4 h-4" />
                Flights Included
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Overview</h2>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-offer-overview">
                  {offer.overview}
                </p>
              </CardContent>
            </Card>

            {/* What's Included */}
            {offer.whatsIncluded && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary" />
                    What's Included
                  </h2>
                  <div 
                    className="prose prose-sm max-w-none text-muted-foreground [&_ul]:list-none [&_ul]:pl-0 [&_li]:flex [&_li]:items-start [&_li]:gap-2 [&_li]:mb-2 [&_li]:before:content-['✓'] [&_li]:before:text-primary [&_li]:before:font-bold"
                    dangerouslySetInnerHTML={{ __html: offer.whatsIncluded }}
                    data-testid="text-whats-included"
                  />
                </CardContent>
              </Card>
            )}

            {/* Highlights */}
            {offer.highlights && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-primary" />
                    Highlights
                  </h2>
                  <div 
                    className="prose prose-sm max-w-none text-muted-foreground [&_ul]:list-none [&_ul]:pl-0 [&_li]:flex [&_li]:items-start [&_li]:gap-2 [&_li]:mb-2 [&_li]:before:content-['★'] [&_li]:before:text-primary"
                    dangerouslySetInnerHTML={{ __html: offer.highlights }}
                    data-testid="text-highlights"
                  />
                </CardContent>
              </Card>
            )}

            {/* Itinerary */}
            {itinerary.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Day by Day Itinerary
                  </h2>
                  <Accordion type="single" collapsible className="w-full">
                    {itinerary.map((day, index) => (
                      <AccordionItem key={index} value={`day-${day.day}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                              {day.day}
                            </span>
                            <span className="font-semibold">{day.title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-14 text-muted-foreground">
                          {day.description}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}

            {/* Accommodation */}
            {accommodation.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary" />
                    Accommodation
                  </h2>
                  <div className="space-y-6">
                    {accommodation.map((hotel, index) => (
                      <div key={index} className="flex flex-col md:flex-row gap-4">
                        {hotel.image && (
                          <img
                            src={hotel.image}
                            alt={hotel.name}
                            className="w-full md:w-48 h-32 object-cover rounded-lg"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold mb-2">{hotel.name}</h3>
                          <p className="text-sm text-muted-foreground">{hotel.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gallery */}
            {gallery.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold mb-4">Gallery</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {gallery.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`${offer.title} - Image ${index + 1}`}
                        className="w-full aspect-[4/3] object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card className="overflow-hidden">
                <div className="bg-primary text-primary-foreground p-6">
                  <p className="text-sm opacity-90 mb-1">Price from</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold" data-testid="text-offer-price">
                      {getCurrencySymbol(offer.currency || 'GBP')}{offer.priceFrom}
                    </span>
                    <span className="text-lg opacity-90">per person</span>
                  </div>
                </div>
                
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Plane className="w-4 h-4 text-primary" />
                      <span>Return flights included</span>
                    </div>
                    {offer.nights && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>{offer.nights} nights accommodation</span>
                      </div>
                    )}
                    {offer.mealPlan && (
                      <div className="flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-primary" />
                        <span>{offer.mealPlan}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {offer.externalUrl ? (
                    <a 
                      href={offer.externalUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button className="w-full" size="lg" data-testid="button-enquire-now">
                        Enquire Now
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </a>
                  ) : (
                    <Link href="/contact">
                      <Button className="w-full" size="lg" data-testid="button-enquire-now">
                        Enquire Now
                      </Button>
                    </Link>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Price may vary based on travel dates and availability
                  </p>
                </CardContent>
              </Card>

              {/* Contact Card */}
              <Card className="mt-4">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Need Help?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Our travel experts are here to help you plan your perfect holiday.
                  </p>
                  <Link href="/contact">
                    <Button variant="outline" className="w-full" data-testid="button-contact-us">
                      Contact Us
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
