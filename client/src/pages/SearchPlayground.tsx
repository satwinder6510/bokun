import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { setMetaTags } from "@/lib/meta-tags";
import { MapPin, Clock, Plane, Sparkles, Package, Search, MessageSquare, Send, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";

interface AISearchResult {
  id: number | string;
  type: "package" | "tour";
  title: string;
  description?: string;
  category?: string;
  countries?: string[];
  price?: number;
  duration?: string;
  durationDays?: number;
  image?: string;
  slug?: string;
  score: number;
  tags?: string[];
}

interface AISearchResponse {
  results: AISearchResult[];
  total: number;
}

const HOLIDAY_TYPES = [
  { value: "Beach", label: "Beach", emoji: "🏖️" },
  { value: "Adventure", label: "Adventure", emoji: "🧗" },
  { value: "Cultural", label: "Cultural", emoji: "🏛️" },
  { value: "City Break", label: "City Break", emoji: "🌆" },
  { value: "Cruise", label: "Cruise", emoji: "🚢" },
  { value: "River Cruise", label: "River Cruise", emoji: "🛳️" },
  { value: "Safari", label: "Safari", emoji: "🦁" },
  { value: "Wildlife", label: "Wildlife", emoji: "🐘" },
  { value: "Luxury", label: "Luxury", emoji: "💎" },
  { value: "Multi-Centre", label: "Multi-Centre", emoji: "📍" },
  { value: "Island", label: "Island", emoji: "🏝️" },
  { value: "Solo Travellers", label: "Solo", emoji: "🎒" },
];

const MAX_HOLIDAY_TYPES = 3;

function ResultCard({ result }: { result: AISearchResult }) {
  const countrySlug = result.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const href = result.type === "package" 
    ? `/Holidays/${countrySlug}/${result.slug}` 
    : `/tour/${result.id}`;

  return (
    <Link href={href}>
      <Card className="overflow-hidden hover-elevate cursor-pointer h-full">
        <div className="relative aspect-[16/10] overflow-hidden">
          {result.image ? (
            <img 
              src={getProxiedImageUrl(result.image)}
              alt={result.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              {result.type === "package" ? (
                <Package className="w-12 h-12 text-muted-foreground" />
              ) : (
                <MapPin className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant={result.type === "package" ? "default" : "secondary"}>
              {result.type === "package" ? (
                <><Plane className="w-3 h-3 mr-1" /> Flight+</>
              ) : (
                "Land Tour"
              )}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{result.title}</h3>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
            {result.category && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {result.category}
              </span>
            )}
            {result.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {result.duration}
              </span>
            )}
          </div>
          {result.price && (
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-muted-foreground">from</span>
              <span className="text-xl font-bold text-primary">{formatPrice(result.price)}</span>
              <span className="text-xs text-muted-foreground">pp</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ChatMessage({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={`flex gap-3 ${role === "user" ? "justify-end" : "justify-start"}`}>
      {role === "assistant" && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        role === "user" 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      }`}>
        <p className="text-sm">{content}</p>
      </div>
      {role === "user" && (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

export default function SearchPlayground() {
  const [destination, setDestination] = useState<string>("all");
  const [duration, setDuration] = useState<number[]>([14]);
  const [budget, setBudget] = useState<number[]>([10000]);
  const [travelers, setTravelers] = useState<number>(2);
  const [holidayTypes, setHolidayTypes] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [designMode, setDesignMode] = useState<"chat" | "cards" | "minimal">("chat");
  
  const [chatMessages, setChatMessages] = useState<Array<{role: "user" | "assistant"; content: string}>>([
    { role: "assistant", content: "Hi! I'm your AI travel assistant. Tell me about your dream holiday - where would you like to go, how long, and what kind of experience are you looking for?" }
  ]);

  const toggleHolidayType = (value: string) => {
    setHolidayTypes(prev => {
      if (prev.includes(value)) {
        return prev.filter(t => t !== value);
      }
      if (prev.length >= MAX_HOLIDAY_TYPES) {
        return prev;
      }
      return [...prev, value];
    });
  };

  useEffect(() => {
    setMetaTags(
      "Search Playground - Test AI Search Designs",
      "Test different AI search interface designs",
      logoImage
    );
  }, []);

  const { data: filterOptions } = useQuery<{ 
    destinations: string[]; 
    maxPrice: number; 
    maxDuration: number;
    holidayTypesByDestination: Record<string, string[]>;
  }>({
    queryKey: ["/api/ai-search/filters"],
  });

  const destinations = filterOptions?.destinations || [];
  const maxPrice = filterOptions?.maxPrice || 10000;
  const maxDuration = filterOptions?.maxDuration || 21;

  const buildSearchParams = () => {
    const params = new URLSearchParams();
    if (destination !== "all") params.set("destination", destination);
    params.set("maxDuration", duration[0].toString());
    params.set("maxBudget", budget[0].toString());
    params.set("travelers", travelers.toString());
    if (holidayTypes.length > 0) params.set("holidayTypes", holidayTypes.join(","));
    return params.toString();
  };

  const { data, isLoading, refetch } = useQuery<AISearchResponse>({
    queryKey: ["/api/ai-search", destination, duration[0], budget[0], travelers, holidayTypes.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/ai-search?${buildSearchParams()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: hasSearched,
    staleTime: 0,
  });

  const handleSearch = () => {
    setHasSearched(true);
    refetch();
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    setChatMessages(prev => [...prev, { role: "user", content: chatInput }]);
    
    setTimeout(() => {
      const response = parseUserIntent(chatInput);
      setChatMessages(prev => [...prev, { role: "assistant", content: response }]);
      setChatInput("");
      setHasSearched(true);
      refetch();
    }, 500);
  };

  const parseUserIntent = (input: string): string => {
    const lower = input.toLowerCase();
    
    if (lower.includes("beach") || lower.includes("sun")) {
      setHolidayTypes(["Beach"]);
    }
    if (lower.includes("adventure") || lower.includes("hiking")) {
      setHolidayTypes(["Adventure"]);
    }
    if (lower.includes("safari") || lower.includes("africa")) {
      setHolidayTypes(["Safari"]);
      setDestination("Kenya");
    }
    if (lower.includes("spain") || lower.includes("barcelona")) {
      setDestination("Spain");
    }
    if (lower.includes("italy") || lower.includes("rome")) {
      setDestination("Italy");
    }
    if (lower.includes("week")) {
      setDuration([7]);
    }
    if (lower.includes("2 weeks") || lower.includes("two weeks") || lower.includes("fortnight")) {
      setDuration([14]);
    }
    
    return `I found some great options for you! Here are holidays matching your preferences. You can refine your search using the filters below.`;
  };

  const results = data?.results || [];

  const formatBudget = (value: number) => {
    if (value >= maxPrice) return `£${(value / 1000).toFixed(0)}k+`;
    return `£${value.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 md:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <Badge variant="outline" className="mb-2">Playground</Badge>
              <h1 className="text-2xl font-bold">Search Design Playground</h1>
              <p className="text-muted-foreground">Test different AI search UI approaches</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={designMode === "chat" ? "default" : "outline"} 
                size="sm"
                onClick={() => setDesignMode("chat")}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Chat Style
              </Button>
              <Button 
                variant={designMode === "cards" ? "default" : "outline"} 
                size="sm"
                onClick={() => setDesignMode("cards")}
              >
                <Package className="w-4 h-4 mr-1" />
                Card Grid
              </Button>
              <Button 
                variant={designMode === "minimal" ? "default" : "outline"} 
                size="sm"
                onClick={() => setDesignMode("minimal")}
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Minimal
              </Button>
            </div>
          </div>

          {designMode === "chat" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <Card className="sticky top-24">
                  <CardContent className="p-4">
                    <div className="h-[400px] overflow-y-auto space-y-4 mb-4">
                      {chatMessages.map((msg, i) => (
                        <ChatMessage key={i} role={msg.role} content={msg.content} />
                      ))}
                    </div>
                    <form onSubmit={handleChatSubmit} className="flex gap-2">
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Tell me about your dream holiday..."
                        className="flex-1"
                      />
                      <Button type="submit" size="icon">
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <div className="mb-6">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {HOLIDAY_TYPES.map(type => (
                      <Button
                        key={type.value}
                        variant={holidayTypes.includes(type.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleHolidayType(type.value)}
                      >
                        {type.emoji} {type.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1,2,3,4].map(i => (
                      <Skeleton key={i} className="h-[300px] rounded-xl" />
                    ))}
                  </div>
                ) : results.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {results.slice(0, 8).map(result => (
                      <ResultCard key={`${result.type}-${result.id}`} result={result} />
                    ))}
                  </div>
                ) : hasSearched ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No results found. Try adjusting your search.
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Start a conversation to find your perfect holiday!
                  </div>
                )}
              </div>
            </div>
          )}

          {designMode === "cards" && (
            <div>
              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <Label className="mb-2 block">Destination</Label>
                      <Select value={destination} onValueChange={setDestination}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any destination" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Destinations</SelectItem>
                          {destinations.map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-2 block">Duration: up to {duration[0]} days</Label>
                      <Slider
                        value={duration}
                        onValueChange={setDuration}
                        min={1}
                        max={maxDuration}
                        step={1}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block">Budget: up to {formatBudget(budget[0])}</Label>
                      <Slider
                        value={budget}
                        onValueChange={setBudget}
                        min={500}
                        max={maxPrice}
                        step={100}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleSearch} className="w-full">
                        <Search className="w-4 h-4 mr-2" />
                        Search
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {HOLIDAY_TYPES.map(type => (
                      <Badge
                        key={type.value}
                        variant={holidayTypes.includes(type.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleHolidayType(type.value)}
                      >
                        {type.emoji} {type.label}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[1,2,3,4,5,6,7,8].map(i => (
                    <Skeleton key={i} className="h-[350px] rounded-xl" />
                  ))}
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {results.map(result => (
                    <ResultCard key={`${result.type}-${result.id}`} result={result} />
                  ))}
                </div>
              ) : hasSearched ? (
                <div className="text-center py-16 text-muted-foreground">
                  No results found. Try broader search criteria.
                </div>
              ) : null}
            </div>
          )}

          {designMode === "minimal" && (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/20 to-secondary/20 px-6 py-3 rounded-full mb-6">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-medium">AI Holiday Finder</span>
                </div>
                <h2 className="text-4xl font-bold mb-4">Where do you want to go?</h2>
              </div>

              <Card className="mb-8 border-2 border-primary/20">
                <CardContent className="p-8">
                  <div className="space-y-8">
                    <div className="text-center">
                      <Label className="text-lg mb-4 block">Pick your vibe</Label>
                      <div className="flex flex-wrap justify-center gap-3">
                        {HOLIDAY_TYPES.slice(0, 8).map(type => (
                          <button
                            key={type.value}
                            onClick={() => toggleHolidayType(type.value)}
                            className={`px-6 py-3 rounded-full text-lg transition-all ${
                              holidayTypes.includes(type.value)
                                ? "bg-primary text-primary-foreground scale-105"
                                : "bg-muted hover:bg-muted/80"
                            }`}
                          >
                            {type.emoji} {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <Label className="text-lg mb-4 block text-center">How long?</Label>
                        <div className="text-center text-3xl font-bold text-primary mb-4">
                          {duration[0]} days
                        </div>
                        <Slider
                          value={duration}
                          onValueChange={setDuration}
                          min={1}
                          max={21}
                          step={1}
                          className="py-4"
                        />
                      </div>
                      <div>
                        <Label className="text-lg mb-4 block text-center">Max budget</Label>
                        <div className="text-center text-3xl font-bold text-primary mb-4">
                          {formatBudget(budget[0])}
                        </div>
                        <Slider
                          value={budget}
                          onValueChange={setBudget}
                          min={500}
                          max={10000}
                          step={100}
                          className="py-4"
                        />
                      </div>
                    </div>

                    <Button onClick={handleSearch} size="lg" className="w-full text-lg py-6">
                      <Sparkles className="w-5 h-5 mr-2" />
                      Find My Perfect Holiday
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {isLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}

              {!isLoading && results.length > 0 && (
                <div className="space-y-4">
                  {results.slice(0, 6).map(result => (
                    <ResultCard key={`${result.type}-${result.id}`} result={result} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
