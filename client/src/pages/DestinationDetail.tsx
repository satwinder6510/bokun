import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TourCard } from "@/components/TourCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, MapPin, Plane, Map, BookOpen, Calendar, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { setMetaTags, addJsonLD } from "@/lib/meta-tags";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import type { FlightPackage, BokunProduct, BlogPost } from "@shared/schema";

interface DestinationData {
  destination: string;
  flightPackages: FlightPackage[];
  landTours: BokunProduct[];
  blogPosts: BlogPost[];
}

function formatGBP(price: number): string {
  return new Intl.NumberFormat('en-GB', { 
    style: 'currency', 
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

function formatDate(dateString: string | Date | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

function FlightPackageCard({ pkg, countrySlug }: { pkg: FlightPackage; countrySlug: string }) {
  return (
    <Link href={`/Holidays/${countrySlug}/${pkg.slug}`}>
      <Card className="overflow-hidden group cursor-pointer h-full hover-elevate" data-testid={`card-package-${pkg.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={pkg.featuredImage || "/placeholder.jpg"} 
            alt={pkg.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className="bg-blue-600 text-white">
              <Plane className="h-3 w-3 mr-1" />
              Flights Included
            </Badge>
          </div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {pkg.title}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{pkg.duration}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">From</span>
              <p className="text-xl font-bold text-primary">
                {(pkg.price || pkg.singlePrice) ? formatGBP(pkg.price || pkg.singlePrice || 0) : "Price on request"}
              </p>
              <span className="text-xs text-muted-foreground">per person</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <article 
        className="group cursor-pointer h-full"
        itemScope 
        itemType="https://schema.org/BlogPosting"
        data-testid={`card-blog-${post.id}`}
      >
        <Card className="overflow-hidden h-full hover-elevate">
          {post.featuredImage && (
            <div className="relative aspect-[16/9] overflow-hidden">
              <img 
                src={getProxiedImageUrl(post.featuredImage)} 
                alt={post.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                itemProp="image"
                loading="lazy"
              />
            </div>
          )}
          <CardContent className="p-4">
            <h3 
              className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors"
              itemProp="headline"
            >
              {post.title}
            </h3>
            <p 
              className="text-muted-foreground text-sm mb-3 line-clamp-2"
              itemProp="description"
            >
              {post.excerpt}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {post.author && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span itemProp="author">{post.author}</span>
                </div>
              )}
              {post.publishedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <time dateTime={new Date(post.publishedAt).toISOString()} itemProp="datePublished">
                    {formatDate(post.publishedAt)}
                  </time>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </article>
    </Link>
  );
}


export default function DestinationDetail() {
  const [, holidaysParams] = useRoute("/Holidays/:country");
  const [, destinationsParams] = useRoute("/destinations/:country");
  const countrySlug = holidaysParams?.country || destinationsParams?.country || "";
  
  const destinationName = countrySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const { data, isLoading, error } = useQuery<DestinationData>({
    queryKey: ['/api/destinations', countrySlug],
    queryFn: () => apiRequest('GET', `/api/destinations/${encodeURIComponent(countrySlug)}`),
    enabled: !!countrySlug,
  });

  const displayName = data?.destination || destinationName;
  const blogPosts = data?.blogPosts || [];

  useEffect(() => {
    if (data) {
      const totalHolidays = data.flightPackages.length + data.landTours.length;
      const title = `${displayName} Holidays & Tours | Flights and Packages`;
      const description = `Discover ${totalHolidays} amazing holidays to ${displayName}. Browse flight packages, land tours, and travel guides. Book your perfect ${displayName} holiday today.`;
      
      setMetaTags(title, description);
      
      addJsonLD({
        "@context": "https://schema.org",
        "@type": "TouristDestination",
        "name": displayName,
        "description": description,
        "url": window.location.href,
        "touristType": {
          "@type": "Audience",
          "audienceType": "Holidaymakers"
        },
        "containsPlace": data.flightPackages.map(pkg => ({
          "@type": "TouristAttraction",
          "name": pkg.title,
          "url": `https://tours.flightsandpackages.com/Holidays/${countrySlug}/${pkg.slug}`
        }))
      });
    }
  }, [data, displayName, countrySlug]);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="bg-slate-800 text-white py-12">
          <div className="container mx-auto px-4">
            <Link href="/Holidays" className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Destinations
            </Link>
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8" />
              <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-destination-title">
                {displayName}
              </h1>
            </div>
            {data && (
              <p className="text-slate-300 mt-2">
                {data.flightPackages.length + data.landTours.length} holidays found
              </p>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Failed to load destination. Please try again.</p>
            </div>
          ) : data && (data.flightPackages.length > 0 || data.landTours.length > 0) ? (
            <div className="space-y-12">
              {data.flightPackages.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Plane className="h-5 w-5 text-blue-600" />
                    <h2 className="text-2xl font-semibold">Flight Packages to {displayName}</h2>
                    <Badge variant="secondary">{data.flightPackages.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {data.flightPackages.map((pkg) => (
                      <FlightPackageCard key={pkg.id} pkg={pkg} countrySlug={countrySlug} />
                    ))}
                  </div>
                </section>
              )}
              
              {data.landTours.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <Map className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-2xl font-semibold">Land Tours in {displayName}</h2>
                    <Badge variant="secondary">{data.landTours.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {data.landTours.map((tour) => (
                      <TourCard key={tour.id} product={tour} />
                    ))}
                  </div>
                </section>
              )}

              {blogPosts.length > 0 && (
                <section aria-labelledby="travel-guides-heading">
                  <div className="flex items-center gap-2 mb-6">
                    <BookOpen className="h-5 w-5 text-amber-600" />
                    <h2 id="travel-guides-heading" className="text-2xl font-semibold">
                      {displayName} Travel Guides & Articles
                    </h2>
                    <Badge variant="secondary">{blogPosts.length}</Badge>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Plan your perfect trip with our expert guides, tips, and insights about {displayName}.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {blogPosts.map((post) => (
                      <BlogCard key={post.id} post={post} />
                    ))}
                  </div>
                  <div className="mt-8 text-center">
                    <Link href="/blog">
                      <span className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                        View all travel articles
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                      </span>
                    </Link>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No holidays found for this destination yet.</p>
              <Link href="/Holidays" className="text-primary hover:underline mt-2 inline-block">
                Browse other destinations
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
