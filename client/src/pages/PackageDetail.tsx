import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Plane, Check, ChevronDown, Menu, Calendar, Users, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CurrencySelector } from "@/components/CurrencySelector";
import { CartButton } from "@/components/CartButton";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FlightPackage } from "@shared/schema";

export default function PackageDetail() {
  const { toast } = useToast();
  const [, params] = useRoute("/packages/:slug");
  const slug = params?.slug;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
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
      await apiRequest("POST", "/api/packages/enquiry", {
        packageId: pkg?.id,
        packageTitle: pkg?.title,
        ...formData,
        numberOfTravelers: formData.numberOfTravelers ? parseInt(formData.numberOfTravelers) : null,
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
  const allImages = [pkg.featuredImage, ...gallery].filter(Boolean) as string[];
  const itinerary = pkg.itinerary || [];
  const accommodations = pkg.accommodations || [];
  const whatsIncluded = pkg.whatsIncluded || [];
  const highlights = pkg.highlights || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between gap-2 md:gap-6">
          <div className="flex items-center gap-3 md:gap-6 flex-shrink-0 min-w-0">
            <a href="/" className="flex items-center flex-shrink-0" data-testid="link-logo">
              <img 
                src={logoImage} 
                alt="Flights and Packages" 
                className="h-8 md:h-10 w-auto"
              />
            </a>
            <nav className="hidden lg:flex items-center gap-1">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="link-home">Home</Button>
              </Link>
              <Link href="/packages">
                <Button variant="ghost" size="sm" className="text-primary font-semibold" data-testid="link-packages">
                  <Plane className="w-4 h-4 mr-1" />
                  Packages
                </Button>
              </Link>
              <Link href="/faq">
                <Button variant="ghost" size="sm" data-testid="link-faq">FAQ</Button>
              </Link>
              <Link href="/blog">
                <Button variant="ghost" size="sm" data-testid="link-blog">Blog</Button>
              </Link>
              <Link href="/contact">
                <Button variant="ghost" size="sm" data-testid="link-contact">Contact</Button>
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <CurrencySelector />
            <CartButton />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" data-testid="button-mobile-menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-8">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">Home</Button>
                  </Link>
                  <Link href="/packages" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-primary">
                      <Plane className="w-4 h-4 mr-2" />
                      Flight Packages
                    </Button>
                  </Link>
                  <Link href="/faq" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">FAQ</Button>
                  </Link>
                  <Link href="/contact" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">Contact</Button>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero Image */}
      <section className="relative h-[60vh] min-h-[400px] pt-16 md:pt-20">
        <img 
          src={allImages[selectedImageIndex] || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80"}
          alt={pkg.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="container mx-auto">
            <Badge className="mb-4 bg-primary text-white" data-testid="badge-category">
              {pkg.category}
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4" data-testid="text-title">
              {pkg.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/90">
              {pkg.duration && (
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span data-testid="text-duration">{pkg.duration}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Plane className="w-5 h-5" />
                <span>Flights Included</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <span>{pkg.category}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Image Gallery Thumbnails */}
      {allImages.length > 1 && (
        <section className="py-4 bg-muted/30 border-b">
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`flex-shrink-0 w-20 h-14 rounded-md overflow-hidden border-2 transition-all ${
                    selectedImageIndex === index ? 'border-primary' : 'border-transparent'
                  }`}
                  data-testid={`button-thumbnail-${index}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

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
                        className="prose prose-sm max-w-none dark:prose-invert"
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
                              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                              <span>{highlight}</span>
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
                              <span>{item}</span>
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
                        <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
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
                          <p className="text-muted-foreground whitespace-pre-line">{day.description}</p>
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
                          <p className="text-muted-foreground mb-4 whitespace-pre-line">{hotel.description}</p>
                          {hotel.images && hotel.images.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {hotel.images.map((img, imgIndex) => (
                                <img 
                                  key={imgIndex}
                                  src={img}
                                  alt={`${hotel.name} ${imgIndex + 1}`}
                                  className="w-full h-24 object-cover rounded-md"
                                  data-testid={`hotel-image-${index}-${imgIndex}`}
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
                          className="prose prose-sm max-w-none dark:prose-invert"
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
                <Card className="border-2 border-primary/20">
                  <CardHeader className="bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-muted-foreground">From</span>
                        <p className="text-3xl font-bold text-primary" data-testid="text-price">
                          {formatPrice(pkg.price)}
                        </p>
                        <span className="text-sm text-muted-foreground">{pkg.priceLabel}</span>
                      </div>
                      <Badge className="bg-primary text-white">
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
                    <Separator />
                    <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" size="lg" data-testid="button-enquire">
                          <Mail className="w-5 h-5 mr-2" />
                          Enquire Now
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Request Quote</DialogTitle>
                          <DialogDescription>
                            Fill in your details and our team will contact you within 24 hours with a personalized quote.
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
                              <Label htmlFor="travelers">Number of Travelers</Label>
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
                    <Button variant="outline" className="w-full" size="lg" asChild>
                      <a href="tel:+442074000000" data-testid="button-call">
                        <Phone className="w-5 h-5 mr-2" />
                        Call Us
                      </a>
                    </Button>
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
                <li><Link href="/" className="text-muted-foreground hover:text-foreground">Tours</Link></li>
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
