import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Phone, Shield, Users, Award, MapPin, Clock, ChevronRight, 
  ChevronLeft, Star, Plane, Globe, Heart, Calendar, ArrowRight, Headphones
} from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";
import type { FlightPackage, Review } from "@shared/schema";

const heroSlides = [
  {
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80",
    title: "Your Journey Starts Here",
    subtitle: "Expertly crafted holidays with personal service",
    destination: "Speak to our travel experts"
  },
  {
    image: "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=1920&q=80",
    title: "Travel With Confidence",
    subtitle: "Fully protected, fully supported holidays",
    destination: "ATOL Protected"
  },
  {
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80",
    title: "Discover Extraordinary Places",
    subtitle: "Handpicked destinations, personally recommended",
    destination: "Over 700 tours worldwide"
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
    name: "Margaret & John Harrison",
    location: "Surrey",
    text: "We've booked three holidays with Flights and Packages now. The personal service is wonderful - they really listen to what you want. Our India tour was the trip of a lifetime. Sarah was our advisor and she thought of everything.",
    rating: 5,
    tour: "Golden Triangle India"
  },
  {
    name: "David Thompson",
    location: "Yorkshire", 
    text: "As a solo traveller in my 60s, I was nervous about booking a group tour. The team put me at ease and matched me with a lovely group of similar age. Exceptional value and I felt looked after throughout.",
    rating: 5,
    tour: "Vietnam & Cambodia"
  },
  {
    name: "Susan & Peter Clarke",
    location: "Kent",
    text: "Everything was arranged perfectly - flights, hotels, transfers. No stress at all. When our flight was delayed, someone from the team called to check we were okay. That's real service.",
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
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Hero Carousel */}
      <section className="relative h-[550px] overflow-hidden">
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
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-slate-900/30" />
            
            <div className="relative container mx-auto px-4 h-full flex items-center">
              <div className="max-w-2xl text-white">
                <p className="text-lg text-white/80 mb-3 font-medium">
                  {slide.destination}
                </p>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                  {slide.title}
                </h1>
                <p className="text-xl md:text-2xl text-white/90 mb-10 leading-relaxed">
                  {slide.subtitle}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button size="lg" className="bg-white hover:bg-stone-100 text-slate-900 text-lg px-8 py-6 font-semibold">
                    Browse Holidays
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-slate-900 text-lg px-8 py-6 font-semibold">
                    <Phone className="mr-2 h-5 w-5" />
                    Call Our Experts
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Controls */}
        <button 
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button 
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide ? "bg-white w-8" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      </section>

      {/* Trust Banner */}
      <section className="bg-white border-b border-stone-200 py-5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: "100% Financial Protection", desc: "ATOL bonded & TTA member" },
              { icon: Headphones, title: "Personal Travel Advisors", desc: "Speak to real experts" },
              { icon: Award, title: "No Hidden Costs", desc: "Transparent pricing always" },
              { icon: Heart, title: "Tailored To You", desc: "Every holiday personalised" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="bg-slate-100 p-3 rounded-lg">
                  <item.icon className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="py-20 bg-stone-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-6">
              Your Trusted Travel Partner
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-4">
              For over a decade, we've been helping British travellers explore the world with complete peace of mind. 
              When you book with us, you speak to real people who genuinely care about creating your perfect holiday.
            </p>
            <p className="text-lg text-slate-600 leading-relaxed mb-10">
              No call centres. No chatbots. Just friendly, knowledgeable advisors who take the time to understand 
              exactly what you're looking for.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-slate-800 hover:bg-slate-900 text-lg px-8 py-6">
                Browse All Holidays
              </Button>
              <Button size="lg" variant="outline" className="border-slate-300 text-slate-700 hover:bg-white text-lg px-8 py-6">
                <Phone className="mr-2 h-5 w-5" />
                Request a Callback
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white border-y border-stone-200">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Planning your holiday should be enjoyable, not stressful
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {[
              {
                step: "1",
                title: "Have a Chat With Us",
                desc: "Call or request a callback. Tell us about your dream holiday - where you'd like to go, how long for, and what matters most to you.",
                icon: Phone
              },
              {
                step: "2", 
                title: "We Create Your Itinerary",
                desc: "Your dedicated advisor puts together a detailed, personalised proposal. We handle flights, hotels, transfers - everything.",
                icon: Calendar
              },
              {
                step: "3",
                title: "Relax and Enjoy",
                desc: "Book with confidence knowing you're fully protected. We're available throughout your trip if you need us.",
                icon: Heart
              }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
                    <item.icon className="h-9 w-9 text-slate-700" />
                  </div>
                  <span className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button size="lg" className="bg-slate-800 hover:bg-slate-900 text-lg px-8 py-6">
              <Phone className="mr-2 h-5 w-5" />
              Speak to an Advisor
            </Button>
            <p className="text-slate-500 mt-3 text-sm">Mon-Sat 9am-6pm • No obligation</p>
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="py-20 bg-stone-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Popular Destinations
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Explore our most loved destinations, each with its own unique character
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {destinations.map((dest, i) => (
              <a 
                key={i}
                href="#"
                className="group bg-white rounded-xl overflow-hidden border border-stone-200 hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img 
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-500 mb-1">{dest.region}</p>
                  <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-slate-600 transition-colors">{dest.name}</h3>
                  <p className="text-slate-600 mb-3">{dest.tours} holidays available</p>
                  <span className="inline-flex items-center text-slate-700 font-medium group-hover:gap-2 transition-all">
                    View holidays <ArrowRight className="h-4 w-4 ml-1" />
                  </span>
                </div>
              </a>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button size="lg" variant="outline" className="border-slate-300 text-slate-700 hover:bg-white text-lg px-8 py-6">
              View All Destinations
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Holidays */}
      <section className="py-20 bg-white border-y border-stone-200">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
                Featured Holidays
              </h2>
              <p className="text-lg text-slate-600">
                Some of our most popular holidays, recommended by our advisors
              </p>
            </div>
            <a href="#" className="text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1">
              View All Holidays <ChevronRight className="h-5 w-5" />
            </a>
          </div>

          {/* Holiday Cards - Clean Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&q=80",
                title: "Golden Triangle of India",
                location: "Delhi, Agra & Jaipur",
                days: "10",
                price: "1,499",
                highlight: "Best Seller"
              },
              {
                image: "https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&q=80",
                title: "Thailand Beach & Culture",
                location: "Bangkok, Chiang Mai & Phuket",
                days: "12",
                price: "1,299",
                highlight: null
              },
              {
                image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80",
                title: "Italian Lakes & Venice",
                location: "Lake Como, Lake Garda & Venice",
                days: "8",
                price: "1,149",
                highlight: null
              },
              {
                image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&q=80",
                title: "South African Safari",
                location: "Kruger, Cape Town & Garden Route",
                days: "14",
                price: "2,299",
                highlight: "Popular"
              },
              {
                image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&q=80",
                title: "Portugal Coast to Coast",
                location: "Lisbon, Porto & The Algarve",
                days: "10",
                price: "1,099",
                highlight: null
              },
              {
                image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80",
                title: "Maldives Beach Escape",
                location: "Male & Island Resort",
                days: "7",
                price: "1,799",
                highlight: null
              }
            ].map((pkg, i) => (
              <Card key={i} className="group overflow-hidden border-stone-200 hover:shadow-lg transition-shadow">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img 
                    src={pkg.image}
                    alt={pkg.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {pkg.highlight && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-slate-800 text-white">{pkg.highlight}</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {pkg.location}
                  </p>
                  <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-slate-600 transition-colors">
                    {pkg.title}
                  </h3>
                  <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" /> {pkg.days} Days
                      </span>
                      <span className="flex items-center gap-1">
                        <Plane className="h-4 w-4" /> Flights Inc.
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">From</p>
                      <p className="text-xl font-bold text-slate-800">£{pkg.price}<span className="text-sm font-normal text-slate-500">pp</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-stone-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Real feedback from real travellers
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((review, i) => (
              <Card key={i} className="bg-white border-stone-200">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(review.rating)].map((_, j) => (
                      <Star key={j} className="h-5 w-5 fill-slate-700 text-slate-700" />
                    ))}
                  </div>
                  <p className="text-slate-700 leading-relaxed mb-6">
                    "{review.text}"
                  </p>
                  <div className="pt-4 border-t border-stone-100">
                    <p className="font-semibold text-slate-800">{review.name}</p>
                    <p className="text-sm text-slate-500">{review.location}</p>
                    <p className="text-sm text-slate-600 mt-1">{review.tour}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-6 text-slate-600">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-800">10+</p>
                <p className="text-sm">Years Experience</p>
              </div>
              <div className="w-px h-12 bg-stone-300"></div>
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-800">5,000+</p>
                <p className="text-sm">Happy Customers</p>
              </div>
              <div className="w-px h-12 bg-stone-300"></div>
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-800">98%</p>
                <p className="text-sm">Would Recommend</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Plan Your Holiday?
          </h2>
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Speak to one of our friendly travel advisors. No pressure, no obligation - 
            just honest advice to help you find your perfect trip.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href="tel:02081830518"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-100 text-slate-900 text-lg px-8 py-4 rounded-md font-semibold transition-colors"
            >
              <Phone className="h-5 w-5" />
              Call 0208 183 0518
            </a>
            <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-slate-900 text-lg px-8 py-4">
              Request a Callback
            </Button>
          </div>
          <p className="text-white/50 mt-8">
            Monday to Saturday, 9am - 6pm
          </p>
        </div>
      </section>

      <PreviewFooter />

      {/* Design Preview Notice */}
      <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
        <p className="text-sm font-semibold">Design Preview Mode</p>
        <p className="text-xs">This is a preview - not the live site</p>
      </div>
    </div>
  );
}
