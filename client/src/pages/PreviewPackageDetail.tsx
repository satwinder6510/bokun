import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Plane, MapPin, Hotel, Utensils, ArrowLeft, Check, Phone, Shield, Calendar } from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";
import type { FlightPackage } from "@shared/schema";

export default function PreviewPackageDetail() {
  const { id } = useParams<{ id: string }>();
  
  const { data: pkg, isLoading } = useQuery<FlightPackage>({
    queryKey: ['/api/packages', id],
    enabled: !!id,
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

  if (!pkg) {
    return (
      <div className="min-h-screen bg-stone-50">
        <PreviewHeader />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Package Not Found</h1>
          <Link href="/preview/packages">
            <Button variant="outline">Back to Packages</Button>
          </Link>
        </div>
        <PreviewFooter />
      </div>
    );
  }

  const included = [
    "Return flights from London",
    "Airport transfers",
    "Accommodation as per itinerary",
    "Selected meals included",
    "Guided tours where mentioned",
    "ATOL & TTA protection"
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-stone-200">
        <div className="container mx-auto px-4 py-3">
          <Link href="/preview/packages" className="inline-flex items-center text-slate-600 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Packages
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative h-[400px]">
        <img 
          src={pkg.featuredImage || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80"}
          alt={pkg.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="container mx-auto">
            {pkg.category && (
              <Badge className="bg-white/20 text-white backdrop-blur mb-3">
                <MapPin className="h-3 w-3 mr-1" /> {pkg.category}
              </Badge>
            )}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {pkg.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/90">
              {pkg.duration && (
                <span className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> {pkg.duration}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Plane className="h-5 w-5" /> Flights Included
              </span>
              <span className="flex items-center gap-2">
                <Hotel className="h-5 w-5" /> Hotel Accommodation
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
                      {pkg.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* What's Included */}
              <Card className="border-stone-200">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">What's Included</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {included.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-slate-600">
                        <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Itinerary */}
              {pkg.itinerary && pkg.itinerary.length > 0 && (
                <Card className="border-stone-200">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Itinerary</h2>
                    <div className="space-y-6">
                      {pkg.itinerary.map((day, i) => (
                        <div key={i} className="relative pl-8 pb-6 border-l-2 border-stone-200 last:pb-0">
                          <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-slate-800" />
                          <h3 className="font-bold text-slate-800 mb-1">Day {day.day}: {day.title}</h3>
                          <p className="text-slate-600">{day.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Booking Card */}
              <Card className="border-stone-200 sticky top-32">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <p className="text-sm text-slate-500 mb-1">From</p>
                    <p className="text-4xl font-bold text-slate-800">
                      £{pkg.price}
                      <span className="text-lg font-normal text-slate-500">pp</span>
                    </p>
                    <p className="text-sm text-slate-500 mt-1">Based on 2 sharing</p>
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
                      <span>ATOL & TTA Protected</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Your money is 100% protected when you book with us. We're members of the Travel Trust Association.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Need Help */}
              <Card className="border-stone-200 bg-slate-50">
                <CardContent className="p-6 text-center">
                  <Phone className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-800 mb-1">Need Help?</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Our travel experts are here to help
                  </p>
                  <a href="tel:02081830518" className="text-xl font-bold text-slate-800 hover:text-slate-600">
                    0208 183 0518
                  </a>
                  <p className="text-xs text-slate-500 mt-1">Mon-Sat 9am-6pm</p>
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
