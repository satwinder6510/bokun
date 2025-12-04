import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, ArrowLeft, Check, Phone, Shield, Calendar, Star, Users, Globe } from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";

export default function PreviewTourDetail() {
  const { slug } = useParams<{ slug: string }>();
  
  const { data: product, isLoading } = useQuery<any>({
    queryKey: ['/api/bokun/product', slug],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <PreviewHeader />
        <div className="container mx-auto px-4 py-16">
          <div className="animate-pulse">
            <div className="h-8 bg-stone-200 rounded w-1/4 mb-4" />
            <div className="h-12 bg-stone-200 rounded w-3/4 mb-8" />
            <div className="aspect-[21/9] bg-stone-200 rounded-lg mb-8" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-stone-50">
        <PreviewHeader />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Tour Not Found</h1>
          <Link href="/preview/tours">
            <Button variant="outline">Back to Tours</Button>
          </Link>
        </div>
        <PreviewFooter />
      </div>
    );
  }

  const highlights = [
    "Professional English-speaking guide",
    "Small group experience",
    "All entrance fees included",
    "Free cancellation available",
    "Instant confirmation",
    "Mobile voucher accepted"
  ];

  const location = product.location?.city || product.location?.country || "Various Locations";
  const price = product.priceFrom || 0;
  const markedUpPrice = Math.round(price * 1.1);

  return (
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-stone-200">
        <div className="container mx-auto px-4 py-3">
          <Link href="/preview/tours" className="inline-flex items-center text-slate-600 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tours
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative h-[400px]">
        <img 
          src={product.keyPhoto?.url || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80"}
          alt={product.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="container mx-auto">
            <Badge className="bg-white/20 text-white backdrop-blur mb-3">
              <MapPin className="h-3 w-3 mr-1" /> {location}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {product.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/90">
              {product.durationText && (
                <span className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> {product.durationText}
                </span>
              )}
              {product.reviewAverageScore && (
                <span className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400 fill-amber-400" /> 
                  {product.reviewAverageScore.toFixed(1)} ({product.reviewCount || 0} reviews)
                </span>
              )}
              <span className="flex items-center gap-2">
                <Globe className="h-5 w-5" /> Land Tour Only
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Overview */}
              <Card className="border-stone-200">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Overview</h2>
                  <div className="prose prose-slate max-w-none">
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {product.excerpt || product.description || "Discover this amazing experience with expert guides and unforgettable memories."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Highlights */}
              <Card className="border-stone-200">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Highlights</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {highlights.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-slate-600">
                        <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Important Info */}
              <Card className="border-stone-200">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Important Information</h2>
                  <div className="space-y-4 text-slate-600">
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">What to Bring</h3>
                      <p>Comfortable walking shoes, sunscreen, camera, and appropriate clothing for the weather.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">Meeting Point</h3>
                      <p>Details provided upon booking confirmation. Usually hotel pickup is available.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">Cancellation Policy</h3>
                      <p>Free cancellation up to 24 hours before the experience. Full refund if cancelled due to weather.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Booking Card */}
              <Card className="border-stone-200 sticky top-32">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <p className="text-sm text-slate-500 mb-1">From</p>
                    <p className="text-4xl font-bold text-slate-800">
                      £{markedUpPrice}
                      <span className="text-lg font-normal text-slate-500">pp</span>
                    </p>
                    <p className="text-sm text-slate-500 mt-1">Land tour only</p>
                  </div>

                  <Button size="lg" className="w-full bg-slate-800 hover:bg-slate-900 mb-3">
                    <Calendar className="h-5 w-5 mr-2" />
                    Check Availability
                  </Button>

                  <Button size="lg" variant="outline" className="w-full border-slate-300 mb-6">
                    <Phone className="h-5 w-5 mr-2" />
                    Call to Enquire
                  </Button>

                  <div className="pt-4 border-t border-stone-200">
                    <div className="flex items-center gap-3 text-sm text-slate-600 mb-3">
                      <Shield className="h-5 w-5 text-emerald-500" />
                      <span>Secure Booking</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Your booking is protected and your payment is secure.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Need Flights */}
              <Card className="border-stone-200 bg-slate-50">
                <CardContent className="p-6 text-center">
                  <h3 className="font-bold text-slate-800 mb-2">Need Flights Too?</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    We can arrange flight-inclusive packages with this tour.
                  </p>
                  <a href="tel:02081830518" className="text-lg font-bold text-slate-800 hover:text-slate-600">
                    0208 183 0518
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <PreviewFooter />
    </div>
  );
}
