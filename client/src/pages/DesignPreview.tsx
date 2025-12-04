import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Phone, Shield, Users, Award, MapPin, Clock, ChevronRight, 
  ChevronLeft, Star, Plane, Globe, Heart, Calendar, ArrowRight
} from "lucide-react";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import type { FlightPackage, Review } from "@shared/schema";

const heroSlides = [
  {
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
    title: "Discover the World",
    subtitle: "Handcrafted holidays with flights included",
    destination: "Swiss Alps"
  },
  {
    image: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80",
    title: "Unforgettable Adventures",
    subtitle: "Expert-planned itineraries tailored to you",
    destination: "Lake District"
  },
  {
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80",
    title: "Relax in Paradise",
    subtitle: "Beach escapes with complete peace of mind",
    destination: "Maldives"
  }
];

const collections = [
  { name: "Beach Holidays", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=75", count: 24 },
  { name: "City Breaks", image: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=75", count: 18 },
  { name: "Cultural Tours", image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=75", count: 32 },
  { name: "Safari & Wildlife", image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=75", count: 12 },
  { name: "Cruise Holidays", image: "https://images.unsplash.com/photo-1548574505-5e239809ee19?w=400&q=75", count: 8 },
  { name: "Luxury Escapes", image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&q=75", count: 15 }
];

const destinations = [
  { name: "India", region: "Asia", image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=400&q=75", tours: 45 },
  { name: "Italy", region: "Europe", image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=75", tours: 28 },
  { name: "South Africa", region: "Africa", image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=75", tours: 18 },
  { name: "Thailand", region: "Asia", image: "https://images.unsplash.com/photo-1528181304800-259b08848526?w=400&q=75", tours: 22 },
  { name: "Portugal", region: "Europe", image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=75", tours: 15 },
  { name: "Maldives", region: "Indian Ocean", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&q=75", tours: 10 }
];

const testimonials = [
  {
    name: "Margaret & John",
    location: "Surrey",
    text: "We've booked three holidays with Flights and Packages now. The personal service is wonderful - they really listen to what you want. Our India tour was the trip of a lifetime.",
    rating: 5,
    tour: "Golden Triangle India"
  },
  {
    name: "David Thompson",
    location: "Yorkshire",
    text: "As a solo traveller, I was nervous about booking a group tour. The team put me at ease and matched me with a lovely group. Exceptional value for money.",
    rating: 5,
    tour: "Vietnam & Cambodia"
  },
  {
    name: "Susan & Peter",
    location: "Kent",
    text: "Everything was arranged perfectly - flights, hotels, transfers. No stress at all. We'll definitely be booking our next holiday with them.",
    rating: 5,
    tour: "Italian Lakes"
  }
];

export default function DesignPreview() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [email, setEmail] = useState("");

  const { data: packages = [] } = useQuery<FlightPackage[]>({
    queryKey: ['/api/packages'],
  });

  const featuredPackages = packages.filter(p => p.isPublished && p.featuredImage).slice(0, 6);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar - Trust & Contact */}
      <div className="bg-slate-800 text-white py-2">
        <div className="container mx-auto px-4 flex justify-between items-center text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-400" />
              <span>ATOL Protected</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              <span>TTA Member</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <a href="tel:02081830518" className="font-semibold hover:text-amber-400 transition-colors">
              0208 183 0518
            </a>
            <span className="text-slate-400 ml-2">Mon-Sat 9am-6pm</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logoImage} alt="Flights and Packages" className="h-12" />
              <img src={travelTrustLogo} alt="Travel Trust Association" className="h-10 hidden md:block" />
            </div>
            
            <nav className="hidden lg:flex items-center gap-8">
              <a href="#" className="text-slate-700 hover:text-amber-600 font-medium transition-colors">
                Destinations
              </a>
              <a href="#" className="text-slate-700 hover:text-amber-600 font-medium transition-colors">
                Flight Packages
              </a>
              <a href="#" className="text-slate-700 hover:text-amber-600 font-medium transition-colors">
                Land Tours
              </a>
              <a href="#" className="text-slate-700 hover:text-amber-600 font-medium transition-colors">
                Collections
              </a>
              <a href="#" className="text-slate-700 hover:text-amber-600 font-medium transition-colors">
                About Us
              </a>
            </nav>

            <div className="flex items-center gap-4">
              <a 
                href="tel:02081830518" 
                className="hidden md:flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                <Phone className="h-4 w-4" />
                Call Us
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Carousel */}
      <section className="relative h-[600px] overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.image})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            
            <div className="relative container mx-auto px-4 h-full flex items-center">
              <div className="max-w-2xl text-white">
                <Badge className="bg-amber-500 text-white mb-4 text-sm px-3 py-1">
                  {slide.destination}
                </Badge>
                <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
                  {slide.title}
                </h1>
                <p className="text-xl md:text-2xl text-white/90 mb-8">
                  {slide.subtitle}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white text-lg px-8">
                    Explore Holidays
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/20 text-lg px-8">
                    <Phone className="mr-2 h-5 w-5" />
                    Speak to an Expert
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Controls */}
        <button 
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button 
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentSlide ? "bg-amber-500" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </section>

      {/* Trust Banner */}
      <section className="bg-slate-50 border-y py-6">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: "100% Protected", desc: "ATOL & Trust Account" },
              { icon: Users, title: "Expert Advisors", desc: "Speak to real people" },
              { icon: Award, title: "Best Value", desc: "No hidden costs" },
              { icon: Heart, title: "Personal Service", desc: "Tailored to you" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="bg-amber-100 p-3 rounded-full">
                  <item.icon className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-6">
            Welcome to Flights and Packages
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-8">
            For over a decade, we've been helping travellers like you discover the world with 
            confidence. Our expert team handcrafts every holiday, combining the best flights, 
            handpicked hotels, and authentic experiences. With us, you're not just booking a 
            trip - you're gaining a trusted travel partner.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600">
              Browse All Holidays
            </Button>
            <Button size="lg" variant="outline">
              Request a Callback
            </Button>
          </div>
        </div>
      </section>

      {/* Collections */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Our Holiday Collections
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Browse our carefully curated collections to find your perfect getaway
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {collections.map((collection, i) => (
              <a 
                key={i}
                href="#"
                className="group relative aspect-[3/4] rounded-xl overflow-hidden"
              >
                <img 
                  src={collection.image} 
                  alt={collection.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="font-bold text-lg">{collection.name}</h3>
                  <p className="text-sm text-white/80">{collection.count} holidays</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Packages */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
                Featured Holidays
              </h2>
              <p className="text-lg text-slate-600">
                Handpicked experiences at exceptional value
              </p>
            </div>
            <a href="#" className="text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1">
              View All <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredPackages.length > 0 ? featuredPackages.map((pkg) => (
              <Card key={pkg.id} className="group overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img 
                    src={pkg.featuredImage || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=75"}
                    alt={pkg.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge className="bg-amber-500 text-white">{pkg.category}</Badge>
                    {pkg.tags && (pkg.tags as string[]).slice(0, 1).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="bg-white/90">{tag}</Badge>
                    ))}
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-xs text-slate-500">From</p>
                    <p className="text-xl font-bold text-slate-800">£{pkg.price}</p>
                    <p className="text-xs text-slate-500">{pkg.priceLabel}</p>
                  </div>
                </div>
                <CardContent className="p-5">
                  <h3 className="font-bold text-lg text-slate-800 mb-2 line-clamp-2 group-hover:text-amber-600 transition-colors">
                    {pkg.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                    {pkg.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {pkg.duration}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Plane className="h-4 w-4" />
                      Flights included
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm line-clamp-2 mb-4">
                    {pkg.excerpt || "Experience an unforgettable journey with expertly planned itineraries and handpicked accommodations."}
                  </p>
                  <Button className="w-full bg-slate-800 hover:bg-slate-900">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            )) : (
              [...Array(3)].map((_, i) => (
                <Card key={i} className="group overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img 
                      src={destinations[i]?.image}
                      alt="Sample holiday"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-amber-500 text-white">{destinations[i]?.name}</Badge>
                    </div>
                    <div className="absolute bottom-4 right-4 bg-white rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-xs text-slate-500">From</p>
                      <p className="text-xl font-bold text-slate-800">£{999 + i * 200}</p>
                      <p className="text-xs text-slate-500">per person</p>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    <h3 className="font-bold text-lg text-slate-800 mb-2 group-hover:text-amber-600 transition-colors">
                      Discover {destinations[i]?.name} - {destinations[i]?.tours} Day Adventure
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {7 + i * 2} Days
                      </span>
                      <span className="flex items-center gap-1">
                        <Plane className="h-4 w-4" />
                        Flights included
                      </span>
                    </div>
                    <Button className="w-full bg-slate-800 hover:bg-slate-900">
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Destinations */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Popular Destinations
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From ancient temples to pristine beaches, discover our most-loved destinations
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {destinations.map((dest, i) => (
              <a 
                key={i}
                href="#"
                className="group text-center"
              >
                <div className="relative aspect-square rounded-full overflow-hidden mb-3 mx-auto w-32 h-32 ring-4 ring-white shadow-lg group-hover:ring-amber-400 transition-all">
                  <img 
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <h3 className="font-bold text-slate-800 group-hover:text-amber-600 transition-colors">
                  {dest.name}
                </h3>
                <p className="text-sm text-slate-500">{dest.tours} tours</p>
              </a>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button size="lg" variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50">
              View All Destinations
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-amber-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-lg text-slate-600">
              Don't just take our word for it - hear from our happy travellers
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((review, i) => (
              <Card key={i} className="bg-white">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(review.rating)].map((_, j) => (
                      <Star key={j} className="h-5 w-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-600 mb-6 italic leading-relaxed">
                    "{review.text}"
                  </p>
                  <div className="border-t pt-4">
                    <p className="font-semibold text-slate-800">{review.name}</p>
                    <p className="text-sm text-slate-500">{review.location}</p>
                    <Badge variant="secondary" className="mt-2">{review.tour}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-slate-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Start Your Adventure?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Speak to one of our friendly travel experts today. We're here to help you 
            plan the perfect holiday.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href="tel:02081830518"
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-lg px-8 py-4 rounded-lg font-semibold transition-colors"
            >
              <Phone className="h-5 w-5" />
              Call 0208 183 0518
            </a>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/20 text-lg px-8 py-4">
              Request a Callback
            </Button>
          </div>
          <p className="text-white/60 mt-6">
            Lines open Monday to Saturday, 9am - 6pm
          </p>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-12 bg-white border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">
              Get Exclusive Offers
            </h3>
            <p className="text-slate-600 mb-6">
              Subscribe to receive special deals and travel inspiration
            </p>
            <div className="flex gap-2">
              <Input 
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button className="bg-amber-500 hover:bg-amber-600">
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <img src={logoImage} alt="Flights and Packages" className="h-10 mb-4 brightness-0 invert" />
              <p className="text-slate-400 mb-4">
                Your trusted partner for unforgettable holidays since 2012.
              </p>
              <div className="flex items-center gap-3">
                <img src={travelTrustLogo} alt="TTA" className="h-12 brightness-0 invert opacity-80" />
              </div>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-4">Popular Destinations</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-amber-400 transition-colors">India</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Italy</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Thailand</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">South Africa</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Maldives</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-4">Quick Links</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-amber-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">FAQs</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Terms & Conditions</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Privacy Policy</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-4">Contact Us</h4>
              <div className="space-y-3 text-slate-400">
                <p className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-amber-500" />
                  <a href="tel:02081830518" className="hover:text-amber-400">0208 183 0518</a>
                </p>
                <p className="text-sm">Monday - Saturday</p>
                <p className="text-sm">9:00am - 6:00pm</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-500 text-sm">
            <p>© 2024 Flights and Packages. All rights reserved.</p>
            <p className="mt-2">
              Member of the Travel Trust Association. ATOL Protected.
            </p>
          </div>
        </div>
      </footer>

      {/* Design Preview Notice */}
      <div className="fixed bottom-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
        <p className="text-sm font-semibold">Design Preview Mode</p>
        <p className="text-xs">This is a preview - not the live site</p>
      </div>
    </div>
  );
}
