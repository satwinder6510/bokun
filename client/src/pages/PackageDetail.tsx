import { useState, useEffect, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Plane, Check, Calendar as CalendarIcon, Users, Phone, Mail, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { useToast } from "@/hooks/use-toast";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";
import { Header } from "@/components/Header";
import { apiRequest } from "@/lib/queryClient";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FlightPackage, PackagePricing } from "@shared/schema";

// Price Calendar Widget Component
function PriceCalendarWidget({ 
  pricingData, 
  selectedDate, 
  onDateSelect,
  formatPrice 
}: { 
  pricingData: PackagePricing[];
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  formatPrice: (price: number) => string;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Helper to parse date string without timezone issues (defined early for useEffect)
  const parsePricingDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Navigate to month with cheapest future price when data changes
  useEffect(() => {
    console.log("[Calendar] useEffect triggered, pricingData length:", pricingData.length);
    if (pricingData.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find future pricing entries with valid prices
      const futurePricing = pricingData
        .filter(p => {
          const d = parsePricingDate(p.departureDate);
          return d >= today && p.price > 0;
        })
        .sort((a, b) => a.price - b.price); // Sort by price, cheapest first
      
      console.log("[Calendar] Future pricing entries:", futurePricing.length);
      
      if (futurePricing.length > 0) {
        // Navigate to the month of the cheapest future price
        const cheapestEntry = futurePricing[0];
        const cheapestDate = parsePricingDate(cheapestEntry.departureDate);
        const newMonth = new Date(cheapestDate.getFullYear(), cheapestDate.getMonth(), 1);
        console.log("[Calendar] Cheapest price:", cheapestEntry.price, "on", cheapestDate.toDateString());
        console.log("[Calendar] Setting current month to:", newMonth.toDateString());
        setCurrentMonth(newMonth);
      }
    }
  }, [pricingData]);

  // Get price for a specific date
  const getPriceForDate = (date: Date) => {
    const pricing = pricingData.find(p => {
      const pDate = parsePricingDate(p.departureDate);
      return pDate.toDateString() === date.toDateString();
    });
    return pricing?.price;
  };

  // Check if date has pricing
  const hasPrice = (date: Date) => {
    return pricingData.some(p => {
      const pDate = parsePricingDate(p.departureDate);
      return pDate.toDateString() === date.toDateString();
    });
  };

  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert to Monday = 0
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Check if there are prices in adjacent months for navigation (using timezone-safe parsing)
  const hasPricesInPrevMonth = pricingData.some(p => {
    const d = parsePricingDate(p.departureDate);
    return d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() < month);
  });

  const hasPricesInNextMonth = pricingData.some(p => {
    const d = parsePricingDate(p.departureDate);
    return d.getFullYear() > year || (d.getFullYear() === year && d.getMonth() > month);
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Month Navigation */}
      <div className="flex items-center justify-between p-2 bg-muted/50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={prevMonth}
          disabled={!hasPricesInPrevMonth}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold">{monthName}</span>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={nextMonth}
          disabled={!hasPricesInNextMonth}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b">
        {days.map(day => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells for days before first of month */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-14 border-b border-r last:border-r-0" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const date = new Date(year, month, dayNum);
          const price = getPriceForDate(date);
          const isSelected = selectedDate?.toDateString() === date.toDateString();
          const isToday = new Date().toDateString() === date.toDateString();
          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div
              key={dayNum}
              onClick={() => price && !isPast && onDateSelect(date)}
              className={`
                h-14 border-b border-r flex flex-col items-center justify-center text-xs
                ${price && !isPast ? 'cursor-pointer hover:bg-secondary/10' : ''}
                ${isSelected ? 'bg-secondary text-white' : ''}
                ${isPast ? 'text-muted-foreground/50' : ''}
                ${isToday && !isSelected ? 'font-bold' : ''}
              `}
              data-testid={`calendar-day-${dayNum}`}
            >
              <span className={`${isSelected ? 'text-white' : ''}`}>
                {dayNum}
              </span>
              {price && !isPast && (
                <span className={`text-[10px] font-semibold ${isSelected ? 'text-white' : 'text-secondary'}`}>
                  {formatPrice(price)}
                </span>
              )}
            </div>
          );
        })}

        {/* Fill remaining cells */}
        {Array.from({ length: (7 - ((firstDay + daysInMonth) % 7)) % 7 }).map((_, i) => (
          <div key={`end-empty-${i}`} className="h-14 border-b border-r last:border-r-0" />
        ))}
      </div>
    </div>
  );
}

export default function PackageDetail() {
  const { toast } = useToast();
  const phoneNumber = useDynamicPhoneNumber();
  const [, params] = useRoute("/packages/:slug");
  const slug = params?.slug;
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  
  // Embla carousel for gallery
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    align: "start",
    slidesToScroll: 1
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preferredDates: "",
    numberOfTravelers: "",
    message: "",
  });

  const { data: pkg, isLoading } = useQuery<FlightPackage>({
    queryKey: ["/api/packages", slug],
    enabled: !!slug,
  });

  const { data: pricing = [] } = useQuery<PackagePricing[]>({
    queryKey: ["/api/packages", pkg?.id, "pricing"],
    queryFn: async () => {
      console.log("[Public Page] Fetching pricing for package:", pkg?.id);
      const response = await fetch(`/api/packages/${pkg?.id}/pricing`);
      if (!response.ok) throw new Error("Failed to fetch pricing");
      const data = await response.json();
      console.log("[Public Page] Pricing data received:", data.length, "entries");
      return data;
    },
    enabled: !!pkg?.id,
  });

  // Get unique airports from pricing data, sorted by cheapest price
  // Only include airports that have valid prices
  const airports = Array.from(new Set(pricing.map(p => p.departureAirport)))
    .map(code => {
      const entry = pricing.find(p => p.departureAirport === code);
      const airportPrices = pricing.filter(p => p.departureAirport === code && p.price > 0);
      // Find the minimum price for this airport (only if there are valid prices)
      const minPrice = airportPrices.length > 0 
        ? Math.min(...airportPrices.map(p => p.price))
        : Infinity;
      return { code, name: entry?.departureAirportName || code, minPrice, hasValidPrices: airportPrices.length > 0 };
    })
    .filter(airport => airport.hasValidPrices) // Exclude airports with no valid prices
    .sort((a, b) => a.minPrice - b.minPrice); // Sort by cheapest price first
  
  // Debug: Log pricing and airport state
  useEffect(() => {
    console.log("[Public Page] Current state - pricing:", pricing.length, "airports:", airports.length, "selectedAirport:", selectedAirport);
    if (airports.length > 0) {
      console.log("[Public Page] Cheapest airport:", airports[0].code, "at", airports[0].minPrice);
    }
  }, [pricing, airports, selectedAirport]);

  // Filter pricing by selected airport
  const filteredPricing = selectedAirport 
    ? pricing.filter(p => p.departureAirport === selectedAirport)
    : pricing;

  // Sort by date
  const sortedPricing = [...filteredPricing].sort((a, b) => 
    new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
  );

  // Get available dates for calendar
  const availableDates = sortedPricing.map(p => new Date(p.departureDate));

  // Get selected pricing based on selected date
  const selectedPricing = selectedDate 
    ? sortedPricing.find(p => {
        const pDate = new Date(p.departureDate);
        return pDate.toDateString() === selectedDate.toDateString();
      })
    : undefined;

  // Auto-populate form with selected date from calendar
  useEffect(() => {
    if (selectedDate) {
      const formattedDate = selectedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      setFormData(prev => ({
        ...prev,
        preferredDates: formattedDate
      }));
    }
  }, [selectedDate]);

  // Auto-select the cheapest airport (first in sorted list)
  useEffect(() => {
    if (airports.length > 0 && !selectedAirport) {
      console.log("[Public Page] Auto-selecting cheapest airport:", airports[0].code);
      setSelectedAirport(airports[0].code);
    }
  }, [airports, selectedAirport]);

  useEffect(() => {
    if (pkg) {
      const title = `${pkg.title} | Flight Package - Flights and Packages`;
      const description = pkg.excerpt || pkg.description.replace(/<[^>]*>/g, '').substring(0, 160);
      const ogImage = pkg.featuredImage || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80";
      
      setMetaTags(title, description, ogImage);

      const schema = {
        '@context': 'https://schema.org',
        '@type': 'TravelAction',
        name: pkg.title,
        description: description,
        image: ogImage,
        offers: {
          '@type': 'Offer',
          price: pkg.price.toString(),
          priceCurrency: pkg.currency,
          availability: 'https://schema.org/InStock'
        },
        destination: {
          '@type': 'Place',
          name: pkg.category
        },
        url: `https://tours.flightsandpackages.com/packages/${pkg.slug}`
      };
      addJsonLD(schema);
    }
  }, [pkg]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleSubmitEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await apiRequest("POST", `/api/packages/${slug}/enquiry`, {
        packageId: pkg?.id,
        packageTitle: pkg?.title,
        ...formData,
        numberOfTravelers: formData.numberOfTravelers ? parseInt(formData.numberOfTravelers) : null,
        selectedDate: selectedDate ? selectedDate.toISOString() : null,
        selectedAirport: selectedAirport || null,
        selectedAirportName: airports.find(a => a.code === selectedAirport)?.name || null,
        pricePerPerson: selectedPricing?.price || pkg?.price || null,
      });

      toast({
        title: "Enquiry Submitted",
        description: "Thank you! Our team will contact you within 24 hours.",
      });

      setEnquiryOpen(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        preferredDates: "",
        numberOfTravelers: "",
        message: "",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit enquiry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
          <div className="container mx-auto px-6 md:px-8 h-20 flex items-center">
            <Link href="/packages">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Packages
              </Button>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-6 md:px-8 py-32">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-muted rounded-xl" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Package Not Found</h2>
          <Link href="/packages">
            <Button data-testid="button-back-packages">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Packages
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const gallery = pkg.gallery || [];
  const allImages = [pkg.featuredImage, ...gallery].filter(Boolean).map(img => getProxiedImageUrl(img)) as string[];
  const itinerary = pkg.itinerary || [];
  const accommodations = pkg.accommodations || [];
  const whatsIncluded = pkg.whatsIncluded || [];
  const highlights = pkg.highlights || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Gallery - Bokun Style */}
      <section className="py-8 pt-24 md:pt-28">
        <div className="container mx-auto px-6 md:px-8">
          {/* Hero Image with Title Overlay - 21:9 aspect ratio */}
          <div className="relative rounded-xl overflow-hidden mb-4">
            <img
              src={allImages[0] || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80"}
              alt={pkg.title}
              className="w-full aspect-[21/9] object-cover"
              data-testid="img-package-hero"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80";
              }}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30" data-testid="badge-category-overlay">
                  {pkg.category}
                </Badge>
                <Badge variant="outline" className="bg-white/10 text-white border-white/30 gap-1">
                  <Plane className="w-3 h-3" />
                  Flights Included
                </Badge>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg" data-testid="text-title-overlay">
                {pkg.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-white/90">
                {pkg.duration && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{pkg.duration}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{pkg.category}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Gallery Carousel */}
          {allImages.length > 1 && (
            <div className="relative group">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-4">
                  {allImages.map((img, index) => (
                    <div 
                      key={index} 
                      className="flex-[0_0_auto] w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(16.666%-0.833rem)] rounded-lg overflow-hidden aspect-[4/3]"
                    >
                      <img
                        src={img}
                        alt={`${pkg.title} photo ${index + 1}`}
                        className="w-full h-full object-cover"
                        data-testid={`img-gallery-${index}`}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {allImages.length > 6 && (
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

      {/* Main Content */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Tabs */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="itinerary" data-testid="tab-itinerary">Itinerary</TabsTrigger>
                  <TabsTrigger value="accommodation" data-testid="tab-accommodation">Hotels</TabsTrigger>
                  <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {/* Description */}
                  <Card>
                    <CardHeader>
                      <CardTitle>About This Package</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: pkg.description }}
                        data-testid="content-description"
                      />
                    </CardContent>
                  </Card>

                  {/* Highlights */}
                  {highlights.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Tour Highlights</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {highlights.map((highlight, index) => (
                            <li key={index} className="flex items-start gap-2" data-testid={`highlight-${index}`}>
                              <Check className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                              <span dangerouslySetInnerHTML={{ __html: highlight }} />
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* What's Included */}
                  {whatsIncluded.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>What's Included</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {whatsIncluded.map((item, index) => (
                            <li key={index} className="flex items-start gap-2" data-testid={`included-${index}`}>
                              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <span dangerouslySetInnerHTML={{ __html: item }} />
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="itinerary" className="space-y-4">
                  {itinerary.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Detailed itinerary coming soon</p>
                      </CardContent>
                    </Card>
                  ) : (
                    itinerary.map((day, index) => (
                      <Card key={index} data-testid={`itinerary-day-${day.day}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="text-lg px-4 py-1">
                              Day {day.day}
                            </Badge>
                            <CardTitle className="text-lg">{day.title}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm max-w-none dark:prose-invert text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: day.description }}
                          />
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="accommodation" className="space-y-4">
                  {accommodations.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Accommodation details coming soon</p>
                      </CardContent>
                    </Card>
                  ) : (
                    accommodations.map((hotel, index) => (
                      <Card key={index} data-testid={`accommodation-${index}`}>
                        <CardHeader>
                          <CardTitle>{hotel.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm max-w-none dark:prose-invert text-muted-foreground mb-4"
                            dangerouslySetInnerHTML={{ __html: hotel.description }}
                          />
                          {hotel.images && hotel.images.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {hotel.images.map((img, imgIndex) => (
                                <img 
                                  key={imgIndex}
                                  src={img}
                                  alt={`${hotel.name} ${imgIndex + 1}`}
                                  className="w-full h-24 object-cover rounded-md"
                                  data-testid={`hotel-image-${index}-${imgIndex}`}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80";
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="info">
                  <Card>
                    <CardHeader>
                      <CardTitle>Other Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {pkg.otherInfo ? (
                        <div 
                          className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line"
                          dangerouslySetInnerHTML={{ __html: pkg.otherInfo }}
                          data-testid="content-other-info"
                        />
                      ) : (
                        <p className="text-muted-foreground">
                          Please contact us for terms and conditions, visa requirements, and other details.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column - Booking Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <Card className="border-2 border-secondary/30">
                  <CardHeader className="bg-secondary/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-muted-foreground">From</span>
                        <p className="text-3xl font-bold text-foreground" data-testid="text-price">
                          {formatPrice(pkg.price)}
                        </p>
                        <span className="text-sm text-muted-foreground">{pkg.priceLabel}</span>
                      </div>
                      <Badge className="bg-secondary text-white">
                        <Plane className="w-4 h-4 mr-1" />
                        Flights Included
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {pkg.duration && (
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Duration</p>
                          <p className="text-sm text-muted-foreground">{pkg.duration}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Destination</p>
                        <p className="text-sm text-muted-foreground">{pkg.category}</p>
                      </div>
                    </div>

                    {/* Pricing Calendar */}
                    {pricing.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-secondary" />
                            <p className="font-medium">Check Availability</p>
                          </div>
                          
                          {airports.length > 0 && (
                            <div>
                              <Label className="text-sm text-muted-foreground mb-1 block">Departing from</Label>
                              <select
                                value={selectedAirport}
                                onChange={(e) => {
                                  setSelectedAirport(e.target.value);
                                  setSelectedDate(undefined);
                                }}
                                className="w-full p-2 border rounded-md bg-background text-foreground text-sm"
                                data-testid="select-airport"
                              >
                                {airports.length > 1 && <option value="">Select Airport</option>}
                                {airports.map(airport => (
                                  <option key={airport.code} value={airport.code}>
                                    {airport.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {selectedAirport && (
                            <div className="space-y-3">
                              <PriceCalendarWidget
                                pricingData={sortedPricing}
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                                formatPrice={formatPrice}
                              />
                              
                              {selectedDate && selectedPricing && (
                                <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="font-medium">
                                        {selectedDate.toLocaleDateString('en-GB', { 
                                          weekday: 'long',
                                          day: 'numeric', 
                                          month: 'long',
                                          year: 'numeric'
                                        })}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        From {selectedPricing.departureAirportName}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-2xl font-bold text-secondary">
                                        {formatPrice(selectedPricing.price)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">per person</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {!selectedAirport && airports.length > 1 && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Please select a departure airport to see available dates
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    <Separator />
                    <Button className="w-full" size="lg" asChild>
                      <a href={`tel:${phoneNumber.replace(/\s/g, "")}`} data-testid="button-call">
                        <Phone className="w-5 h-5 mr-2" />
                        {phoneNumber}
                      </a>
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="w-full" 
                      size="lg" 
                      onClick={() => {
                        const win = window as any;
                        const openTidio = () => {
                          if (win.tidioChatApi) {
                            win.tidioChatApi.show();
                            win.tidioChatApi.open();
                          }
                        };
                        
                        if (win.tidioChatApi) {
                          openTidio();
                        } else {
                          // Tidio not loaded yet, set up callback for when it's ready
                          document.addEventListener("tidioChat-ready", openTidio);
                        }
                      }}
                      data-testid="button-chat"
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Chat with us
                    </Button>
                    <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full" size="lg" data-testid="button-enquire">
                          <Mail className="w-5 h-5 mr-2" />
                          Enquire Now
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Request Quote</DialogTitle>
                          <DialogDescription>
                            Fill in your details and our team will contact you within 24 hours with a personalised quote.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmitEnquiry} className="space-y-4 mt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="firstName">First Name *</Label>
                              <Input 
                                id="firstName"
                                value={formData.firstName}
                                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                                required
                                data-testid="input-first-name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="lastName">Last Name *</Label>
                              <Input 
                                id="lastName"
                                value={formData.lastName}
                                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                                required
                                data-testid="input-last-name"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="email">Email *</Label>
                            <Input 
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({...formData, email: e.target.value})}
                              required
                              data-testid="input-email"
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone">Phone *</Label>
                            <Input 
                              id="phone"
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => setFormData({...formData, phone: e.target.value})}
                              required
                              data-testid="input-phone"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="dates">Preferred Dates</Label>
                              <Input 
                                id="dates"
                                placeholder="e.g., March 2024"
                                value={formData.preferredDates}
                                onChange={(e) => setFormData({...formData, preferredDates: e.target.value})}
                                data-testid="input-dates"
                              />
                            </div>
                            <div>
                              <Label htmlFor="travelers">Number of Travellers</Label>
                              <Input 
                                id="travelers"
                                type="number"
                                min="1"
                                value={formData.numberOfTravelers}
                                onChange={(e) => setFormData({...formData, numberOfTravelers: e.target.value})}
                                data-testid="input-travelers"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="message">Additional Requirements</Label>
                            <Textarea 
                              id="message"
                              placeholder="Tell us about any special requirements..."
                              value={formData.message}
                              onChange={(e) => setFormData({...formData, message: e.target.value})}
                              data-testid="input-message"
                            />
                          </div>
                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={isSubmitting}
                            data-testid="button-submit-enquiry"
                          >
                            {isSubmitting ? "Submitting..." : "Submit Enquiry"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <p className="text-xs text-center text-muted-foreground">
                      No payment required until booking is confirmed
                    </p>
                  </CardContent>
                </Card>

                {/* Trust Badge */}
                <Card className="mt-4">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <img 
                      src={travelTrustLogo} 
                      alt="Travel Trust Association" 
                      className="h-12"
                    />
                    <div className="text-sm">
                      <p className="font-medium">Protected by TTA</p>
                      <p className="text-muted-foreground">Your money is secure</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-12">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <img 
                src={logoImage} 
                alt="Flights and Packages" 
                className="h-10 mb-4"
              />
              <p className="text-sm text-muted-foreground">
                Your trusted partner for flight-inclusive holiday packages to amazing destinations worldwide.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/" className="text-muted-foreground hover:text-foreground">Land Tours</Link></li>
                <li><Link href="/packages" className="text-muted-foreground hover:text-foreground">Flight Packages</Link></li>
                <li><Link href="/faq" className="text-muted-foreground hover:text-foreground">FAQ</Link></li>
                <li><Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="tel:+442074000000" className="text-muted-foreground hover:text-foreground">+44 20 7400 0000</a></li>
                <li><a href="mailto:info@flightsandpackages.com" className="text-muted-foreground hover:text-foreground">info@flightsandpackages.com</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Trust & Security</h4>
              <img 
                src={travelTrustLogo} 
                alt="Travel Trust Association" 
                className="h-16 mb-4"
              />
              <p className="text-xs text-muted-foreground">
                Member of the Travel Trust Association.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Flights and Packages. All rights reserved.</p>
            <div className="mt-2 space-x-4">
              <Link href="/terms" className="hover:text-foreground">Terms & Conditions</Link>
              <span>|</span>
              <Link href="/contact" className="hover:text-foreground">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
