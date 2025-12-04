import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, MapPin, Search, ArrowRight, Users, Star } from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";

interface BokunProduct {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  keyPhoto?: { url: string };
  durationText?: string;
  location?: { country: string; city?: string };
  priceFrom?: number;
  reviewAverageScore?: number;
  reviewCount?: number;
}

export default function PreviewTours() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: products = [], isLoading } = useQuery<BokunProduct[]>({
    queryKey: ['/api/bokun/search', 'GBP'],
    select: (data: any) => data.items || [],
  });

  const filteredProducts = products.filter((product: BokunProduct) =>
    product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.location?.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Hero Banner */}
      <section className="bg-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Land Tours & Experiences</h1>
          <p className="text-xl text-white/80 max-w-2xl mb-8">
            Discover curated tours and experiences worldwide. Expertly selected for quality and value.
          </p>
          
          {/* Search */}
          <div className="max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                type="text"
                placeholder="Search destinations or tours..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg bg-white text-slate-800 border-0"
                data-testid="input-tour-search"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tours Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <p className="text-slate-600">
              {isLoading ? "Loading..." : `Showing ${filteredProducts.length} tours`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
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
          ) : filteredProducts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.slice(0, 24).map((product: BokunProduct) => (
                <Link key={product.id} href={`/preview/tours/${product.slug || product.id}`}>
                  <Card className="group overflow-hidden border-stone-200 hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img 
                        src={product.keyPhoto?.url || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=75"}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {product.location?.city || product.location?.country || "Multiple Locations"}
                      </p>
                      <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-slate-600 transition-colors line-clamp-2">
                        {product.title}
                      </h3>
                      
                      <div className="flex items-center gap-3 text-sm text-slate-600 mb-3">
                        {product.durationText && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" /> {product.durationText}
                          </span>
                        )}
                        {product.reviewAverageScore && (
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> 
                            {product.reviewAverageScore.toFixed(1)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                        <div className="text-left">
                          <p className="text-xs text-slate-500">From</p>
                          <p className="text-xl font-bold text-slate-800">
                            £{product.priceFrom || 0}
                            <span className="text-sm font-normal text-slate-500">pp</span>
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-slate-600">
                          View <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-xl text-slate-600 mb-4">No tours found matching your search.</p>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Need a Complete Package?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            View our flight-inclusive packages for a complete holiday experience.
          </p>
          <Link href="/preview/packages">
            <Button size="lg" className="bg-white hover:bg-stone-100 text-slate-900">
              View Flight Packages
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <PreviewFooter />
    </div>
  );
}
