import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Plane, MapPin, ArrowRight } from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";
import type { FlightPackage } from "@shared/schema";

export default function PreviewPackages() {
  const { data: packages = [], isLoading } = useQuery<FlightPackage[]>({
    queryKey: ['/api/packages'],
  });

  const publishedPackages = packages.filter(p => p.isPublished);

  return (
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Hero Banner */}
      <section className="bg-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Flight Packages</h1>
          <p className="text-xl text-white/80 max-w-2xl">
            Complete holiday packages with flights, hotels, and transfers included. 
            Fully protected and personally tailored.
          </p>
        </div>
      </section>

      {/* Packages Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden border-stone-200 animate-pulse">
                  <div className="aspect-[4/3] bg-stone-200" />
                  <CardContent className="p-5">
                    <div className="h-4 bg-stone-200 rounded mb-2 w-1/2" />
                    <div className="h-6 bg-stone-200 rounded mb-3" />
                    <div className="h-4 bg-stone-200 rounded w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : publishedPackages.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedPackages.map((pkg) => (
                <Link key={pkg.id} href={`/preview/packages/${pkg.id}`}>
                  <Card className="group overflow-hidden border-stone-200 hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img 
                        src={pkg.featuredImage || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=75"}
                        alt={pkg.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {pkg.tags && (pkg.tags as string[]).length > 0 && (
                        <div className="absolute top-3 left-3 flex gap-2">
                          <Badge className="bg-slate-800 text-white">
                            {(pkg.tags as string[])[0]}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {pkg.destination || pkg.category}
                      </p>
                      <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-slate-600 transition-colors line-clamp-2">
                        {pkg.title}
                      </h3>
                      <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          {pkg.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" /> {pkg.duration}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Plane className="h-4 w-4" /> Flights Inc.
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">From</p>
                          <p className="text-xl font-bold text-slate-800">
                            £{pkg.price}
                            <span className="text-sm font-normal text-slate-500">pp</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-xl text-slate-600 mb-4">No packages available at the moment.</p>
              <p className="text-slate-500">Please check back soon or contact us for bespoke options.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Can't Find What You're Looking For?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Our travel advisors can create a bespoke package tailored to your requirements.
          </p>
          <Button size="lg" className="bg-white hover:bg-stone-100 text-slate-900">
            Speak to an Advisor
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <PreviewFooter />
    </div>
  );
}
