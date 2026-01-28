import { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Plane, Check, Calendar as CalendarIcon, Users, Phone, Mail, ChevronLeft, ChevronRight, MessageCircle, Play, X, Loader2, Hotel, Utensils } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/sanitize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { setMetaTags, addJsonLD, generateBreadcrumbSchema, generateTourSchema } from "@/lib/meta-tags";
import { useToast } from "@/hooks/use-toast";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ExpandableText } from "@/components/ExpandableText";
import { apiRequest } from "@/lib/queryClient";
import { getProxiedImageUrl, getHeroImageUrl, getGalleryImageUrl } from "@/lib/imageProxy";
import { cleanFragmentedHtmlArray } from "@/lib/utils";
import { 
  capturePackageViewed,
  captureCallCtaClicked, 
  captureChatCtaClicked, 
  captureEnquireCtaClicked,
  captureEnquirySubmitted,
  captureDateSelected,
  captureTabChanged,
  captureGalleryInteraction,
  captureCtaClicked
} from "@/lib/posthog";
import {
  trackViewContent,
  trackCallCta,
  trackChatCta,
  trackEnquireCta,
  trackEnquirySubmitted
} from "@/lib/meta-pixel";
import { useScrollDepth } from "@/hooks/useScrollDepth";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import atolLogo from "@assets/atol-protected-logo-png_seeklogo-13189_1765460348402.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FlightPackage, PackagePricing } from "@shared/schema";

// Window type with Tidio chat
interface WindowWithTidio extends Window {
  tidioChatApi?: {
    show: () => void;
    hide: () => void;
    open: () => void;
  };
}

// Video type for gallery
type VideoItem = {
  url: string;
  title?: string;
  platform: 'youtube' | 'vimeo';
  videoId: string;
};

type GalleryItem = {
  type: 'image' | 'video';
  url: string;
  video?: VideoItem;
};

// Extended hotel type with optional location
type HotelWithLocation = {
  name: string;
  images: string[];
  description: string;
  location?: string;
};

// Get video thumbnail URL
function getVideoThumbnail(video: VideoItem): string {
  if (video.platform === 'youtube') {
    return `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
  }
  return `https://vumbnail.com/${video.videoId}.jpg`;
}

// Get video embed URL
function getVideoEmbedUrl(video: VideoItem): string {
  if (video.platform === 'youtube') {
    return `https://www.youtube.com/embed/${video.videoId}?autoplay=1`;
  }
  return `https://player.vimeo.com/video/${video.videoId}?autoplay=1`;
}

// Utility to get cheapest date keys from pricing data
function getCheapestDateKeys(
  days: { dateKey: string; price: number | undefined; available: boolean }[]
): Set<string> {
  const available = days.filter(d => d.available && d.price !== undefined && Number.isFinite(d.price));
  if (!available.length) return new Set();
  const min = Math.min(...available.map(d => d.price!));
  return new Set(available.filter(d => d.price === min).map(d => d.dateKey));
}

// Price Calendar Widget Component
function PriceCalendarWidget({ 
  pricingData, 
  selectedDate, 
  onDateSelect,
  formatPrice 
}: { 
  pricingData: PackagePricing[];
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined, isAutoSelect?: boolean) => void;
  formatPrice: (price: number) => string;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

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
        
        // Auto-select the cheapest date on initial load (pass true to skip dialog opening)
        if (!hasAutoSelected) {
          setHasAutoSelected(true);
          onDateSelect(cheapestDate, true);
        }
      }
    }
  }, [pricingData, hasAutoSelected, onDateSelect]);

  // Get price for a specific date
  const getPriceForDate = (date: Date) => {
    const pricing = pricingData.find(p => {
      const pDate = parsePricingDate(p.departureDate);
      return pDate.toDateString() === date.toDateString();
    });
    return pricing?.price;
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

  // Build days array for current month and compute cheapest dates
  const monthDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return Array.from({ length: daysInMonth }).map((_, i) => {
      const dayNum = i + 1;
      const date = new Date(year, month, dayNum);
      const price = getPriceForDate(date);
      const isPast = date < today;
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return {
        dayNum,
        date,
        price,
        dateKey,
        available: !!price && !isPast
      };
    });
  }, [year, month, daysInMonth, pricingData]);

  // Get cheapest date keys for the current month
  const cheapestDateKeys = useMemo(() => getCheapestDateKeys(monthDays), [monthDays]);

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
      <div className="flex items-center justify-between p-2 lg:p-3 bg-primary/15">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={prevMonth}
          disabled={!hasPricesInPrevMonth}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-sm lg:text-base">{monthName}</span>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={nextMonth}
          disabled={!hasPricesInNextMonth}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 text-center text-xs lg:text-sm font-medium text-muted-foreground border-b bg-primary/5">
        {days.map(day => (
          <div key={day} className="py-2 lg:py-3">{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells for days before first of month */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-14 lg:h-16 border-b border-r last:border-r-0" />
        ))}

        {/* Days of the month */}
        {monthDays.map((day) => {
          const { dayNum, date, price, dateKey, available } = day;
          const isCheapest = cheapestDateKeys.has(dateKey);
          const isSelected = selectedDate?.toDateString() === date.toDateString();
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div
              key={dayNum}
              onClick={() => available && onDateSelect(date)}
              className={`
                h-14 lg:h-16 border-b border-r flex flex-col items-center justify-center text-xs lg:text-sm
                ${available ? 'cursor-pointer hover:bg-primary/10' : ''}
                ${isSelected ? 'bg-primary text-white' : ''}
                ${!available && price !== undefined ? 'text-muted-foreground/50' : ''}
                ${!available && price === undefined ? 'text-muted-foreground/30' : ''}
                ${isToday && !isSelected ? 'font-bold' : ''}
                ${isCheapest && !isSelected ? 'bg-green-100 dark:bg-green-900/40' : ''}
              `}
              data-testid={`calendar-day-${dayNum}`}
            >
              <span className={`${isSelected ? 'text-white' : ''}`}>
                {dayNum}
              </span>
              {price !== undefined && (
                <span className={`text-[10px] lg:text-xs font-semibold ${
                  isSelected 
                    ? 'text-white' 
                    : isCheapest 
                      ? 'text-green-700 dark:text-green-300 font-bold' 
                      : 'text-primary'
                } ${!available ? 'opacity-50' : ''}`}>
                  {formatPrice(price)}
                </span>
              )}
            </div>
          );
        })}

        {/* Fill remaining cells */}
        {Array.from({ length: (7 - ((firstDay + daysInMonth) % 7)) % 7 }).map((_, i) => (
          <div key={`end-empty-${i}`} className="h-14 lg:h-16 border-b border-r last:border-r-0" />
        ))}
      </div>
    </div>
  );
}

// Bokun Price Calendar Widget Component (for Bokun Departures + Flights module)
type BokunPricingEntryType = {
  departureDate: string;
  rateTitle: string;
  rateId: number;
  landPrice: number;
  airportCode: string;
  airportName: string;
  flightPrice: number;
  combinedPrice: number;
  durationNights: number | null;
};

function BokunPriceCalendarWidget({ 
  pricingData, 
  selectedDate, 
  onDateSelect,
  formatPrice 
}: { 
  pricingData: BokunPricingEntryType[];
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined, isAutoSelect?: boolean) => void;
  formatPrice: (price: number) => string;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Helper to parse date string without timezone issues
  const parsePricingDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Navigate to month with cheapest future price when data changes
  useEffect(() => {
    if (pricingData.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find future pricing entries
      const futurePricing = pricingData
        .filter(p => {
          const d = parsePricingDate(p.departureDate);
          return d >= today && p.combinedPrice > 0;
        })
        .sort((a, b) => a.combinedPrice - b.combinedPrice);
      
      if (futurePricing.length > 0) {
        const cheapestEntry = futurePricing[0];
        const cheapestDate = parsePricingDate(cheapestEntry.departureDate);
        const newMonth = new Date(cheapestDate.getFullYear(), cheapestDate.getMonth(), 1);
        setCurrentMonth(newMonth);
        
        // Auto-select the cheapest date on initial load (pass true to skip dialog opening)
        if (!hasAutoSelected) {
          setHasAutoSelected(true);
          onDateSelect(cheapestDate, true);
        }
      }
    }
  }, [pricingData, hasAutoSelected, onDateSelect]);

  // Get cheapest price for a specific date
  const getPriceForDate = (date: Date) => {
    const pricesForDate = pricingData.filter(p => {
      const pDate = parsePricingDate(p.departureDate);
      return pDate.toDateString() === date.toDateString();
    });
    if (pricesForDate.length === 0) return undefined;
    return Math.min(...pricesForDate.map(p => p.combinedPrice));
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

  // Build days array for current month and compute cheapest dates
  const monthDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return Array.from({ length: daysInMonth }).map((_, i) => {
      const dayNum = i + 1;
      const date = new Date(year, month, dayNum);
      const price = getPriceForDate(date);
      const isPast = date < today;
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return {
        dayNum,
        date,
        price,
        dateKey,
        available: !!price && !isPast
      };
    });
  }, [year, month, daysInMonth, pricingData]);

  // Get cheapest date keys for the current month
  const cheapestDateKeys = useMemo(() => getCheapestDateKeys(monthDays), [monthDays]);

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Check if there are prices in adjacent months for navigation
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
      <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/30">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={prevMonth}
          disabled={!hasPricesInPrevMonth}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold">{monthName}</span>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={nextMonth}
          disabled={!hasPricesInNextMonth}
        >
          <ChevronRight className="h-5 w-5" />
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
        {monthDays.map((day) => {
          const { dayNum, date, price, dateKey, available } = day;
          const isCheapest = cheapestDateKeys.has(dateKey);
          const isSelected = selectedDate?.toDateString() === date.toDateString();
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div
              key={dayNum}
              onClick={() => available && onDateSelect(date)}
              className={`
                h-14 border-b border-r flex flex-col items-center justify-center text-xs
                ${available ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30' : ''}
                ${isSelected ? 'bg-blue-600 text-white' : ''}
                ${!available && price !== undefined ? 'text-muted-foreground/50' : ''}
                ${!available && price === undefined ? 'text-muted-foreground/30' : ''}
                ${isToday && !isSelected ? 'font-bold' : ''}
                ${isCheapest && !isSelected ? 'bg-green-100 dark:bg-green-900/40' : ''}
              `}
              data-testid={`bokun-calendar-day-${dayNum}`}
            >
              <span className={`${isSelected ? 'text-white' : ''}`}>
                {dayNum}
              </span>
              {price !== undefined && (
                <span className={`text-[10px] font-semibold ${
                  isSelected 
                    ? 'text-white' 
                    : isCheapest 
                      ? 'text-green-700 dark:text-green-300 font-bold' 
                      : 'text-blue-600 dark:text-blue-400'
                } ${!available ? 'opacity-50' : ''}`}>
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

export default function PackageDetailTest() {
  const { toast } = useToast();
  const phoneNumber = useDynamicPhoneNumber();
  const searchString = useSearch();
  
  // Parse URL params - check for ?pricing=solo to default to solo pricing
  const preferSoloPricing = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("pricing") === "solo";
  }, [searchString]);
  
  // Support both old route (/packages/:slug) and new route (/Holidays/:country/:slug)
  const [, oldParams] = useRoute("/packages/:slug");
  const [, oldTestParams] = useRoute("/packages-test/:slug");
  const [, newParams] = useRoute("/Holidays/:country/:slug");
  const [, newTestParams] = useRoute("/Holidays-test/:country/:slug");
  const slug = newTestParams?.slug || newParams?.slug || oldTestParams?.slug || oldParams?.slug;
  const countrySlug = newTestParams?.country || newParams?.country;
  
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  
  // Handler to select date and scroll to CTA section
  // isAutoSelect = true means this is an auto-selection on page load, so don't open dialog
  const handleDateSelect = useCallback((date: Date | undefined, isAutoSelect?: boolean) => {
    setSelectedDate(date);
    // Only scroll to CTA if a date was actually selected AND it's not an auto-selection
    if (date && !isAutoSelect) {
      // Check if desktop (lg breakpoint = 1024px)
      const isDesktop = window.innerWidth >= 1024;
      
      if (isDesktop) {
        // On desktop, scroll to enquiry section and open dialog
        setTimeout(() => {
          const enquirySection = document.getElementById('desktop-enquiry-section');
          if (enquirySection) {
            const elementPosition = enquirySection.getBoundingClientRect().top + window.scrollY;
            const offsetPosition = elementPosition - 100; // Offset for header
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
          }
          // Open the enquiry dialog after scrolling
          setTimeout(() => {
            setEnquiryOpen(true);
          }, 300);
        }, 100);
      } else {
        // On mobile, scroll to CTA section
        setTimeout(() => {
          const ctaSection = document.getElementById('cta-section');
          if (ctaSection) {
            const elementPosition = ctaSection.getBoundingClientRect().top + window.scrollY;
            const offsetPosition = elementPosition - 20;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
          }
        }, 100);
      }
    }
  }, []);
  const [showAllItinerary, setShowAllItinerary] = useState(false);
  
  // Hotel image lightbox state
  const [hotelLightbox, setHotelLightbox] = useState<{ images: string[]; index: number; hotelName: string } | null>(null);
  
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

  // Type for coming soon response
  type ComingSoonResponse = {
    comingSoon: true;
    title: string;
    category: string;
    featuredImage?: string;
    excerpt?: string;
  };

  const { data: packageData, isLoading } = useQuery<FlightPackage | ComingSoonResponse>({
    queryKey: ["/api/packages", slug],
    enabled: !!slug,
  });

  // Check if it's a coming soon response
  const isComingSoon = packageData && 'comingSoon' in packageData && packageData.comingSoon;
  const pkg = isComingSoon ? undefined : packageData as FlightPackage | undefined;

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

  // Bokun departure pricing (from Bokun Departures + Flights module)
  type BokunPricingEntry = {
    departureDate: string;
    rateTitle: string;
    rateId: number;
    landPrice: number;
    airportCode: string;
    airportName: string;
    flightPrice: number;
    combinedPrice: number;
    durationNights: number | null;
  };
  
  type BokunPricingResponse = {
    enabled: boolean;
    prices: BokunPricingEntry[];
    minPrice: number;
    durationNights: number | null;
    totalDepartures: number;
  };

  const { data: bokunPricing } = useQuery<BokunPricingResponse>({
    queryKey: ["/api/packages", pkg?.id, "bokun-pricing"],
    queryFn: async () => {
      console.log("[Public Page] Fetching Bokun pricing for package:", pkg?.id);
      const response = await fetch(`/api/packages/${pkg?.id}/bokun-pricing`);
      if (!response.ok) throw new Error("Failed to fetch Bokun pricing");
      const data = await response.json();
      console.log("[Public Page] Bokun pricing received:", data.prices?.length || 0, "entries, enabled:", data.enabled);
      return data;
    },
    enabled: !!pkg?.id,
  });

  // Bokun pricing state - Airport is primary selection, rates are secondary
  const [selectedBokunAirport, setSelectedBokunAirport] = useState<string>("");
  const [selectedBokunRate, setSelectedBokunRate] = useState<string>("");
  const [selectedBokunDate, setSelectedBokunDate] = useState<Date | undefined>();

  // Get unique airports from Bokun pricing, sorted by cheapest price
  // When preferSoloPricing, only consider single room rates for pricing
  const bokunAirports = bokunPricing?.enabled && bokunPricing.prices.length > 0
    ? Array.from(new Set(bokunPricing.prices.map(p => p.airportCode)))
        .map(code => {
          const airportPrices = bokunPricing.prices.filter(p => p.airportCode === code);
          const entry = airportPrices[0];
          // Filter by rate type if preferSoloPricing
          const relevantPrices = preferSoloPricing
            ? airportPrices.filter(p => /single/i.test(p.rateTitle))
            : airportPrices;
          // Fall back to all prices if no matching rates found
          const pricesToUse = relevantPrices.length > 0 ? relevantPrices : airportPrices;
          const minPrice = Math.min(...pricesToUse.map(p => p.combinedPrice));
          return { code, name: entry?.airportName || code, minPrice };
        })
        .sort((a, b) => a.minPrice - b.minPrice)
    : [];

  // Calculate min price respecting solo pricing preference (for header display)
  const bokunDisplayMinPrice = useMemo(() => {
    if (!bokunPricing?.enabled || bokunPricing.prices.length === 0) {
      return bokunPricing?.minPrice || 0;
    }
    if (preferSoloPricing) {
      // Filter to single room rates only
      const singleRatePrices = bokunPricing.prices.filter(p => /single/i.test(p.rateTitle));
      if (singleRatePrices.length > 0) {
        return Math.min(...singleRatePrices.map(p => p.combinedPrice));
      }
    }
    // Default to API's minPrice
    return bokunPricing.minPrice;
  }, [bokunPricing, preferSoloPricing]);

  // Get unique rates FOR THE SELECTED AIRPORT, sorted to prefer Double/Twin first
  // Rates show airport-specific combined prices (land + flight for that airport)
  const bokunRates = bokunPricing?.enabled && bokunPricing.prices.length > 0 && selectedBokunAirport
    ? Array.from(new Set(
        bokunPricing.prices
          .filter(p => p.airportCode === selectedBokunAirport)
          .map(p => p.rateTitle)
      ))
        .map(title => {
          // Get price for this rate at the selected airport
          const rateEntry = bokunPricing.prices.find(p => 
            p.rateTitle === title && p.airportCode === selectedBokunAirport
          );
          const price = rateEntry?.combinedPrice || 0;
          const landPrice = rateEntry?.landPrice || 0;
          // Check room types for sorting preference
          const isSingle = /single/i.test(title);
          const isDouble = /double/i.test(title);
          const isTwin = /twin/i.test(title);
          const isStandard = /standard/i.test(title);
          return { title, price, landPrice, isSingle, isDouble, isTwin, isStandard };
        })
        .sort((a, b) => {
          // If preferSoloPricing, prefer Single first
          if (preferSoloPricing) {
            if (a.isSingle && !b.isSingle) return -1;
            if (!a.isSingle && b.isSingle) return 1;
          } else {
            // Default: Prefer Double first, then Twin
            if (a.isDouble && !b.isDouble) return -1;
            if (!a.isDouble && b.isDouble) return 1;
            if (a.isTwin && !b.isTwin) return -1;
            if (!a.isTwin && b.isTwin) return 1;
          }
          // Then by price
          return a.price - b.price;
        })
    : [];

  // Auto-select cheapest Bokun airport
  useEffect(() => {
    if (bokunAirports.length > 0 && !selectedBokunAirport) {
      setSelectedBokunAirport(bokunAirports[0].code);
    }
  }, [bokunAirports, selectedBokunAirport]);

  // Auto-select preferred rate (Twin Standard) when airport changes
  useEffect(() => {
    if (bokunRates.length > 0) {
      const isValidRate = bokunRates.some(r => r.title === selectedBokunRate);
      if (!selectedBokunRate || !isValidRate) {
        setSelectedBokunRate(bokunRates[0].title);
      }
    }
  }, [bokunRates, selectedBokunRate]);

  // Filter Bokun pricing by selected airport AND rate
  const filteredBokunPricing = bokunPricing?.prices
    ? bokunPricing.prices.filter(p => 
        (!selectedBokunAirport || p.airportCode === selectedBokunAirport) &&
        (!selectedBokunRate || p.rateTitle === selectedBokunRate)
      )
    : [];

  // Get selected Bokun pricing based on selected date
  const selectedBokunPricing = selectedBokunDate && filteredBokunPricing.length > 0
    ? filteredBokunPricing.find(p => {
        const pDate = new Date(p.departureDate + 'T00:00:00');
        return pDate.toDateString() === selectedBokunDate.toDateString();
      })
    : undefined;

  // Auto-select cheapest Bokun airport and revalidate when airports list changes
  useEffect(() => {
    if (bokunAirports.length > 0) {
      const isValidAirport = bokunAirports.some(a => a.code === selectedBokunAirport);
      if (!selectedBokunAirport || !isValidAirport) {
        setSelectedBokunAirport(bokunAirports[0].code);
        setSelectedBokunDate(undefined);
      }
    }
  }, [bokunAirports, selectedBokunAirport]);

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

  // Track scroll depth on package detail page
  useScrollDepth({
    pageType: 'package_detail',
    properties: pkg ? { package_id: pkg.id, package_title: pkg.title } : undefined
  });
  
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

  // Show sticky CTA bar after scrolling past hero section (mobile only)
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const threshold = 400; // Show after scrolling 400px (past hero)
      setShowStickyBar(scrollY > threshold);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      const countrySlug = pkg.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
      
      setMetaTags(title, description, ogImage, { type: 'product' });

      addJsonLD([
        generateBreadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Flight Packages", url: "/packages" },
          { name: pkg.category, url: `/Holidays/${countrySlug}` },
          { name: pkg.title, url: `/Holidays/${countrySlug}/${pkg.slug}` }
        ]),
        generateTourSchema({
          name: pkg.title,
          description: description,
          image: ogImage,
          price: pkg.price,
          currency: pkg.currency,
          duration: pkg.duration || undefined,
          destination: pkg.category,
          url: `/Holidays/${countrySlug}/${pkg.slug}`
        })
      ]);

      // Track package viewed event (PostHog)
      capturePackageViewed({
        package_id: pkg.id,
        package_title: pkg.title,
        package_slug: pkg.slug,
        package_country: pkg.category,
        package_duration: pkg.duration || undefined,
        package_price: pkg.price
      });

      // Track package viewed event (Meta Pixel)
      trackViewContent({
        content_name: pkg.title,
        content_category: pkg.category || 'Flight Package',
        content_ids: [String(pkg.id)],
        content_type: 'product',
        value: pkg.price,
        currency: 'GBP'
      });
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
      // Get original referrer from sessionStorage (captured on first page load)
      let originalReferrer = sessionStorage.getItem('original_referrer');
      if (!originalReferrer) {
        const ref = document.referrer;
        originalReferrer = (ref && !ref.includes(window.location.hostname)) ? ref : 'Direct';
      }
      
      await apiRequest("POST", `/api/packages/${slug}/enquiry`, {
        packageId: pkg?.id,
        packageTitle: pkg?.title,
        ...formData,
        numberOfTravelers: formData.numberOfTravelers ? parseInt(formData.numberOfTravelers) : null,
        selectedDate: selectedDate ? selectedDate.toISOString() : null,
        selectedAirport: selectedAirport || null,
        selectedAirportName: airports.find(a => a.code === selectedAirport)?.name || null,
        pricePerPerson: selectedPricing?.price || pkg?.price || null,
        referrer: originalReferrer,
        pageUrl: window.location.href,
      });

      // Track successful enquiry submission (PostHog)
      captureEnquirySubmitted(true, {
        package_id: pkg?.id,
        package_title: pkg?.title,
        package_slug: slug
      });
      // Track successful enquiry submission (Meta Pixel)
      trackEnquirySubmitted({
        content_name: pkg?.title,
        content_category: pkg?.category || 'Flight Package',
        value: pkg?.price,
        currency: 'GBP'
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
      // Track failed enquiry submission
      captureEnquirySubmitted(false, {
        package_id: pkg?.id,
        package_title: pkg?.title,
        package_slug: slug,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });

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
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="container mx-auto px-6 md:px-8 py-32">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-stone-200 rounded-xl" />
            <div className="h-8 bg-stone-200 rounded w-3/4" />
            <div className="h-4 bg-stone-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // Coming Soon page for unpublished packages
  if (isComingSoon && packageData && 'comingSoon' in packageData) {
    const comingSoonData = packageData as ComingSoonResponse;
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="relative">
          {comingSoonData.featuredImage && (
            <div className="absolute inset-0 h-[50vh]">
              <img 
                src={comingSoonData.featuredImage} 
                alt={comingSoonData.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-stone-50" />
            </div>
          )}
          <div className="relative container mx-auto px-6 md:px-8 pt-32 pb-16">
            <div className="max-w-2xl mx-auto text-center">
              <Badge className="mb-4 bg-amber-500 hover:bg-amber-600" data-testid="badge-coming-soon">
                Coming Soon
              </Badge>
              <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${comingSoonData.featuredImage ? 'text-white' : 'text-stone-900'}`}>
                {comingSoonData.title}
              </h1>
              {comingSoonData.excerpt && (
                <p className={`text-lg mb-8 ${comingSoonData.featuredImage ? 'text-white/90' : 'text-stone-600'}`}>
                  {comingSoonData.excerpt}
                </p>
              )}
              <div className="bg-white rounded-xl shadow-lg p-8 mt-8">
                <h2 className="text-xl font-semibold mb-4">Be the First to Know!</h2>
                <p className="text-stone-600 mb-6">
                  This exciting package is coming soon. Contact us to register your interest and be notified when it becomes available.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href={`/Holidays/${comingSoonData.category}`}>
                    <Button variant="outline" data-testid="button-explore-country">
                      <MapPin className="w-4 h-4 mr-2" />
                      Explore {comingSoonData.category}
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button data-testid="button-contact-us">
                      <Mail className="w-4 h-4 mr-2" />
                      Contact Us
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
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
  
  // Safely parse videos - handle both structured objects and potential edge cases
  const videos: VideoItem[] = ((pkg.videos || []) as any[]).filter((video): video is VideoItem => {
    return video && 
           typeof video === 'object' && 
           typeof video.videoId === 'string' && 
           (video.platform === 'youtube' || video.platform === 'vimeo');
  });
  
  // Combine images and videos into gallery items
  // Featured image uses hero variant (1920px), gallery images use gallery variant (1280px)
  const allGalleryItems: GalleryItem[] = [
    // Featured image first - hero variant for full-width display
    ...(pkg.featuredImage ? [{ type: 'image' as const, url: getHeroImageUrl(pkg.featuredImage) }] : []),
    // Then gallery images - gallery variant for lightbox display
    ...gallery.filter(Boolean).map(img => ({ type: 'image' as const, url: getGalleryImageUrl(img) })),
    // Then videos at the end (only valid structured videos)
    ...videos.map(video => ({ type: 'video' as const, url: getVideoThumbnail(video), video })),
  ];
  
  const itinerary = pkg.itinerary || [];
  const accommodations = pkg.accommodations || [];
  const whatsIncluded = cleanFragmentedHtmlArray(pkg.whatsIncluded || []);
  const highlights = cleanFragmentedHtmlArray(pkg.highlights || []);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Mobile Full-Screen Video Hero (if available) */}
      {pkg.mobileHeroVideo && (
        <section className="md:hidden relative w-full min-h-[60vh] max-h-[80vh] bg-black overflow-hidden">
          <video
            src={pkg.mobileHeroVideo}
            className="w-full min-h-[60vh] object-contain"
            autoPlay
            loop
            muted
            playsInline
            poster={allGalleryItems[0]?.url || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80"}
            data-testid="video-package-hero-mobile"
            onError={(e) => {
              // Hide video section and show standard gallery on error
              const target = e.target as HTMLVideoElement;
              const section = target.closest('section');
              if (section) section.style.display = 'none';
              const fallbackSection = document.getElementById('package-gallery-section');
              if (fallbackSection) fallbackSection.classList.remove('hidden');
            }}
          />
          {/* Strong Gradient Overlay for text visibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
          {/* Title Overlay with backdrop - positioned at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-12">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge className="bg-black/60 backdrop-blur-md text-white border-white/40 text-xs font-medium shadow-lg" data-testid="badge-category-overlay-mobile">
                {pkg.category}
              </Badge>
              <Badge variant="outline" className="bg-black/60 backdrop-blur-md text-white border-white/40 gap-1 text-xs font-medium shadow-lg">
                <Plane className="w-3 h-3 shrink-0" />
                <span>FLIGHT+</span>
              </Badge>
              {pkg.bokunProductId && (
                <Badge variant="outline" className="bg-blue-600/80 backdrop-blur-md text-white border-blue-400/60 text-xs font-medium shadow-lg" data-testid="badge-bokun-ref-mobile">
                  B{pkg.bokunProductId}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.5)'}} data-testid="text-title-overlay-mobile">
              {pkg.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white font-medium" style={{textShadow: '0 1px 4px rgba(0,0,0,0.8)'}}>
              {pkg.duration && (
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="w-4 h-4 shrink-0 drop-shadow-lg" />
                  <span>{pkg.duration}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-sm">
                <MapPin className="w-4 h-4 shrink-0 drop-shadow-lg" />
                <span>{pkg.category}</span>
              </div>
            </div>
            {/* Mobile Price Badge */}
            <div className="mt-4 inline-block bg-white backdrop-blur-sm rounded-lg px-4 py-2 shadow-xl">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="text-xl font-bold text-secondary" data-testid="hero-price-mobile-video">
                {formatPrice(pkg.price)}
              </p>
              <p className="text-xs text-muted-foreground">per person</p>
            </div>
          </div>
        </section>
      )}

      {/* Mobile Hero Image (when no video) */}
      {!pkg.mobileHeroVideo && (
        <section className="lg:hidden relative w-full aspect-[4/3] bg-muted">
          <img
            src={allGalleryItems[0]?.url || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80"}
            alt={pkg.title}
            className="w-full h-full object-cover"
            data-testid="img-package-hero-mobile"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          {/* Title Overlay */}
          <div className="absolute bottom-6 left-0 right-0 px-6">
            <h1 className="text-2xl font-bold text-white mb-2">{pkg.title}</h1>
            <div className="flex items-center gap-3 text-white/90 text-sm">
              {pkg.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {pkg.duration}
                </span>
              )}
              {pkg.category && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {pkg.category}
                </span>
              )}
            </div>
            {pkg.price && (
              <div className="mt-3 inline-block bg-white backdrop-blur-sm rounded-lg px-4 py-2 shadow-xl">
                <p className="text-xs text-muted-foreground">From</p>
                <p className="text-xl font-bold text-secondary">
                  {formatPrice(pkg.price)}
                </p>
                <p className="text-xs text-muted-foreground">per person</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Gallery - Hidden on mobile in test layout */}
      <section id="package-gallery-section" className="hidden lg:block pt-4 pb-8">
        <div className="container mx-auto px-6 md:px-8">
          {/* Hero Image with Title Overlay - 21:9 aspect ratio */}
          <div className="relative rounded-xl overflow-hidden mb-4 bg-muted">
            <img
              src={allGalleryItems[0]?.url || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80"}
              alt={pkg.title}
              width={1920}
              height={640}
              className="w-full aspect-[16/9] md:aspect-[21/9] object-cover"
              id="package-hero-image-fallback"
              data-testid="img-package-hero"
              loading="eager"
              decoding="async"
              // @ts-ignore - fetchpriority is valid HTML but not in React types yet
              fetchpriority="high"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80";
              }}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-[10px] sm:text-xs" data-testid="badge-category-overlay">
                  {pkg.category}
                </Badge>
                <Badge variant="outline" className="bg-white/10 text-white border-white/30 gap-1 text-[10px] sm:text-xs">
                  <Plane className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">Flights Included</span>
                  <span className="sm:hidden">FLIGHT+</span>
                </Badge>
                {pkg.bokunProductId && (
                  <Badge variant="outline" className="bg-blue-600/80 backdrop-blur-sm text-white border-blue-400/60 text-[10px] sm:text-xs" data-testid="badge-bokun-ref">
                    B{pkg.bokunProductId}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg" data-testid="text-title-overlay">
                {pkg.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/90">
                {pkg.duration && (
                  <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                    <span>{pkg.duration}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span>{pkg.category}</span>
                </div>
              </div>
            </div>
            
            {/* Desktop Price Badge - Top Right */}
            <div className="hidden md:block absolute top-6 right-6">
              <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg">
                <p className="text-xs text-muted-foreground">From</p>
                <p className="text-2xl font-bold text-secondary" data-testid="hero-price-desktop">
                  {formatPrice(pkg.price)}
                </p>
                <p className="text-xs text-muted-foreground">per person</p>
              </div>
            </div>
            
          </div>
          
          {/* Gallery Carousel */}
          {allGalleryItems.length > 1 && (
            <div className="relative group">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-4">
                  {allGalleryItems.map((item, index) => (
                    <div 
                      key={index} 
                      className={`flex-[0_0_auto] w-[80%] sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(16.666%-0.833rem)] rounded-lg overflow-hidden aspect-[4/3] relative bg-muted ${item.type === 'video' ? 'cursor-pointer' : ''}`}
                      onClick={() => item.type === 'video' && item.video && setActiveVideo(item.video)}
                    >
                      <img
                        src={item.url}
                        alt={item.type === 'video' ? `Video: ${item.video?.title || 'Watch video'}` : `${pkg.title} photo ${index + 1}`}
                        width={400}
                        height={300}
                        className="w-full h-full object-cover"
                        data-testid={item.type === 'video' ? `video-gallery-${index}` : `img-gallery-${index}`}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";
                        }}
                      />
                      {item.type === 'video' && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center hover:bg-black/40 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                            <Play className="w-5 h-5 text-red-600 ml-1" fill="currentColor" />
                          </div>
                          <span className="absolute bottom-2 left-2 text-xs bg-black/70 text-white px-2 py-0.5 rounded">
                            {item.video?.platform === 'youtube' ? 'YouTube' : 'Vimeo'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {allGalleryItems.length > 6 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur"
                    onClick={scrollPrev}
                    data-testid="button-gallery-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur"
                    onClick={scrollNext}
                    data-testid="button-gallery-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Video Player Modal */}
          {activeVideo && (
            <div 
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setActiveVideo(null)}
            >
              <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-12 right-0 text-white hover:bg-white/20"
                  onClick={() => setActiveVideo(null)}
                  data-testid="button-close-video"
                >
                  <X className="w-6 h-6" />
                </Button>
                <iframe
                  src={getVideoEmbedUrl(activeVideo)}
                  className="w-full h-full rounded-lg"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  data-testid="iframe-video-player"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ==================== DESKTOP 2-COLUMN LAYOUT ==================== */}
      <div className="hidden lg:block">
        <div className="container mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-[1fr_380px] gap-8">
            {/* Left Column - Main Content */}
            <div className="space-y-8">
              {/* About This Package - Quick Info Cards */}
              <div className="bg-muted/30 -mx-4 px-4 py-6 rounded-lg">
                <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">About This Package</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <Card className="text-center p-4">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-secondary" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Duration</p>
                    <p className="font-semibold text-sm md:text-base">{pkg.duration || 'Contact us'}</p>
                  </Card>
                  <Card className="text-center p-4">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-secondary" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Destination</p>
                    <p className="font-semibold text-sm md:text-base">{pkg.category}</p>
                  </Card>
                  <Card className="text-center p-4">
                    <Hotel className="w-8 h-8 mx-auto mb-2 text-secondary" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Accommodation</p>
                    <p className="font-semibold text-sm md:text-base">{accommodations.length > 0 ? `${accommodations.length} Hotel${accommodations.length > 1 ? 's' : ''}` : 'Included'}</p>
                  </Card>
                  <Card className="text-center p-4">
                    <Utensils className="w-8 h-8 mx-auto mb-2 text-secondary" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Board</p>
                    <p className="font-semibold text-sm md:text-base">As per itinerary</p>
                  </Card>
                </div>
              </div>

              {/* What's Included */}
              {whatsIncluded.length > 0 && (
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">What's Included</h2>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {whatsIncluded.map((item, index) => (
                          <div key={index} className="flex items-start gap-2" data-testid={`included-desktop-${index}`}>
                            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Package Details - Tabbed Content (Desktop) */}
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-6">Package Details</h2>
                <Tabs defaultValue="description" className="w-full">
                  <TabsList className="w-full justify-start mb-6 overflow-x-auto">
                    <TabsTrigger value="description" className="text-lg font-semibold" data-testid="tab-description-desktop">Description</TabsTrigger>
                    {itinerary.length > 0 && (
                      <TabsTrigger value="itinerary" className="text-lg font-semibold" data-testid="tab-itinerary-desktop">Itinerary</TabsTrigger>
                    )}
                    <TabsTrigger value="accommodation" className="text-lg font-semibold" data-testid="tab-accommodation-desktop">Accommodation</TabsTrigger>
                    {(pkg.excluded || pkg.requirements || pkg.attention) && (
                      <TabsTrigger value="info" className="text-lg font-semibold" data-testid="tab-info-desktop">Info</TabsTrigger>
                    )}
                    {pkg.review && (
                      <TabsTrigger value="reviews" className="text-lg font-semibold" data-testid="tab-reviews-desktop">Reviews</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="description" className="space-y-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div 
                          className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line [&>p]:mb-4"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.description) }}
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
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {highlights.map((highlight, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                                <span>{highlight}</span>
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
                        <Card key={index} data-testid={`itinerary-desktop-day-${day.day}`}>
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
                              className="prose prose-sm md:prose-base max-w-none dark:prose-invert text-muted-foreground whitespace-pre-line [&>p]:mb-4"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(day.description) }}
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
                          <Hotel className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">Accommodation details coming soon</p>
                        </CardContent>
                      </Card>
                    ) : (
                      accommodations.map((hotel, index) => (
                        <Card key={index} data-testid={`hotel-desktop-${index}`}>
                          <CardHeader>
                            <CardTitle>{hotel.name}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div 
                              className="prose prose-sm md:prose-base max-w-none dark:prose-invert text-muted-foreground mb-4 whitespace-pre-line [&>p]:mb-4"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(hotel.description) }}
                            />
                            {hotel.images && hotel.images.length > 0 && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {hotel.images.slice(0, 4).map((img, imgIndex) => (
                                  <img 
                                    key={imgIndex}
                                    src={img}
                                    alt={`${hotel.name} ${imgIndex + 1}`}
                                    className="w-full aspect-[4/3] object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setHotelLightbox({ images: hotel.images, index: imgIndex, hotelName: hotel.name })}
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

                  <TabsContent value="info" className="space-y-4">
                    {pkg.excluded && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Exclusions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.excluded) }}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {pkg.requirements && (
                      <Card>
                        <CardHeader>
                          <CardTitle>What Do I Need to Bring?</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.requirements) }}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {pkg.attention && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Please Note</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.attention) }}
                          />
                        </CardContent>
                      </Card>
                    )}

                  </TabsContent>

                  {pkg.review && (
                    <TabsContent value="reviews" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Customer Reviews</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.review) }}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </div>

            {/* Right Column - Sidebar (scrolls with page) */}
            <div data-testid="desktop-sidebar">
              <div className="space-y-4">
                {/* Price & Booking Card */}
                <Card className="border-2 border-secondary/30">
                  <CardHeader className="bg-secondary/5">
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">From</span>
                      <div className="flex items-baseline gap-3 flex-wrap">
                        {(pkg.pricingDisplay === "both" || pkg.pricingDisplay === "twin" || !pkg.pricingDisplay) && (
                          <div>
                            <p className="text-3xl font-bold text-foreground" data-testid="text-price-desktop">
                              {formatPrice(pkg.price)}
                            </p>
                            <span className="text-xs text-muted-foreground">pp twin share</span>
                          </div>
                        )}
                        {pkg.pricingDisplay === "single" && pkg.singlePrice !== null && pkg.singlePrice !== undefined && (
                          <div>
                            <p className="text-3xl font-bold text-foreground">
                              {formatPrice(pkg.singlePrice)}
                            </p>
                            <span className="text-xs text-muted-foreground">pp solo</span>
                          </div>
                        )}
                        {pkg.pricingDisplay === "both" && pkg.singlePrice !== null && pkg.singlePrice !== undefined && (
                          <div className="border-l pl-3 border-border">
                            <p className="text-xl font-semibold text-foreground">
                              {formatPrice(pkg.singlePrice)}
                            </p>
                            <span className="text-xs text-muted-foreground">pp solo</span>
                          </div>
                        )}
                      </div>
                      <Badge className="bg-secondary text-white mt-2">
                        <Plane className="w-4 h-4 mr-1" />
                        Flights Included
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {/* Quick Info */}
                    <div className="space-y-2 text-sm">
                      {pkg.duration && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{pkg.duration}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{pkg.category}</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Pricing Calendar */}
                    {pricing.length > 0 && (
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
                              className="w-full p-2 border rounded-md bg-white text-foreground text-sm"
                              data-testid="select-airport-desktop"
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
                              onDateSelect={handleDateSelect}
                              formatPrice={formatPrice}
                            />
                            
                            {selectedDate && selectedPricing && (
                              <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                                <div className="text-center">
                                  <p className="font-medium text-sm">
                                    {selectedDate.toLocaleDateString('en-GB', { 
                                      weekday: 'short',
                                      day: 'numeric', 
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </p>
                                  <p className="text-2xl font-bold text-secondary mt-1">
                                    {formatPrice(selectedPricing.price)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">per person</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {!selectedAirport && airports.length > 1 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            Select a departure airport
                          </p>
                        )}
                      </div>
                    )}

                    {/* Bokun Departures + Flights Calendar */}
                    {bokunPricing?.enabled && bokunPricing.prices.length > 0 && bokunAirports.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Plane className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-blue-600">Flight + Tour Package</p>
                            <p className="text-xs text-muted-foreground">
                              From {formatPrice(bokunDisplayMinPrice)} pp
                            </p>
                          </div>
                        </div>
                        
                        {bokunAirports.length > 0 && (
                          <div>
                            <Label className="text-sm text-muted-foreground mb-1 block">Flying from</Label>
                            <select
                              value={selectedBokunAirport}
                              onChange={(e) => {
                                setSelectedBokunAirport(e.target.value);
                                setSelectedBokunRate("");
                                setSelectedBokunDate(undefined);
                              }}
                              className="w-full p-2 border rounded-md bg-white text-foreground text-sm"
                              data-testid="select-bokun-airport-desktop"
                            >
                              {bokunAirports.map(airport => (
                                <option key={airport.code} value={airport.code}>
                                  {airport.name} ({formatPrice(airport.minPrice)})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {bokunRates.length > 1 && selectedBokunAirport && (
                          <div>
                            <Label className="text-sm text-muted-foreground mb-1 block">Room Type</Label>
                            <select
                              value={selectedBokunRate}
                              onChange={(e) => {
                                setSelectedBokunRate(e.target.value);
                                setSelectedBokunDate(undefined);
                              }}
                              className="w-full p-2 border rounded-md bg-white text-foreground text-sm"
                              data-testid="select-bokun-rate-desktop"
                            >
                              {bokunRates.map(rate => (
                                <option key={rate.title} value={rate.title}>
                                  {rate.title} ({formatPrice(rate.price)})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {selectedBokunAirport && filteredBokunPricing.length > 0 && (
                          <div className="space-y-3">
                            <BokunPriceCalendarWidget
                              pricingData={filteredBokunPricing}
                              selectedDate={selectedBokunDate}
                              onDateSelect={setSelectedBokunDate}
                              formatPrice={formatPrice}
                            />
                            
                            {selectedBokunDate && selectedBokunPricing && (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-center">
                                  <p className="font-medium text-sm">
                                    {selectedBokunDate.toLocaleDateString('en-GB', { 
                                      weekday: 'short',
                                      day: 'numeric', 
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </p>
                                  <p className="text-2xl font-bold text-blue-600 mt-1">
                                    {formatPrice(selectedBokunPricing.combinedPrice)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">per person incl. flights</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <Separator />

                    {/* CTA Buttons */}
                    <div className="space-y-2" id="desktop-enquiry-section">
                      <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            className="w-full bg-secondary hover:bg-secondary/90 text-white"
                            size="lg"
                            onClick={() => {
                              captureEnquireCtaClicked({
                                package_title: pkg.title,
                                package_id: pkg.id,
                                package_slug: slug
                              });
                              trackEnquireCta({
                                content_name: pkg.title,
                                content_category: pkg.category || 'Flight Package'
                              });
                            }}
                            data-testid="button-enquire-desktop"
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Enquire Now
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Enquire About This Package</DialogTitle>
                            <DialogDescription>
                              Fill in your details and we'll get back to you within 24 hours.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleSubmitEnquiry} className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="firstName">First Name *</Label>
                                <Input
                                  id="firstName"
                                  value={formData.firstName}
                                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                  required
                                  data-testid="input-first-name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name *</Label>
                                <Input
                                  id="lastName"
                                  value={formData.lastName}
                                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                  required
                                  data-testid="input-last-name"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="email">Email *</Label>
                              <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                required
                                data-testid="input-email"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="phone">Phone Number *</Label>
                              <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                required
                                data-testid="input-phone"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="message">Message</Label>
                              <Textarea
                                id="message"
                                value={formData.message}
                                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                placeholder="Tell us about your travel plans..."
                                rows={4}
                                data-testid="input-message"
                              />
                            </div>
                            <Button 
                              type="submit" 
                              className="w-full bg-secondary hover:bg-secondary/90"
                              disabled={isSubmitting}
                              data-testid="button-submit-enquiry"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                'Send Enquiry'
                              )}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          captureCallCtaClicked({
                            package_title: pkg.title,
                            package_id: pkg.id,
                            package_slug: slug,
                            phone_number: phoneNumber
                          });
                          trackCallCta({
                            content_name: pkg.title,
                            content_category: pkg.category || 'Flight Package'
                          });
                          window.location.href = `tel:${phoneNumber.replace(/\s/g, '')}`;
                        }}
                        data-testid="button-call-desktop"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        {phoneNumber}
                      </Button>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <img src={travelTrustLogo} alt="Travel Trust Association" className="h-8 object-contain" />
                      <img src={atolLogo} alt="ATOL Protected" className="h-8 object-contain" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ==================== END DESKTOP LAYOUT ==================== */}

      {/* ==================== MOBILE LAYOUT (unchanged) ==================== */}
      {/* About This Package - Quick Info Cards - MOBILE ONLY */}
      <section className="py-6 md:py-8 bg-muted/30 lg:hidden">
        <div className="container mx-auto px-4 md:px-8">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">About This Package</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Duration Card */}
            <Card className="text-center p-4">
              <Clock className="w-8 h-8 mx-auto mb-2 text-secondary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Duration</p>
              <p className="font-semibold text-sm md:text-base">{pkg.duration || 'Contact us'}</p>
            </Card>
            
            {/* Destination Card */}
            <Card className="text-center p-4">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-secondary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Destination</p>
              <p className="font-semibold text-sm md:text-base">{pkg.category}</p>
            </Card>
            
            {/* Accommodation Card */}
            <Card className="text-center p-4">
              <Hotel className="w-8 h-8 mx-auto mb-2 text-secondary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Accommodation</p>
              <p className="font-semibold text-sm md:text-base">{accommodations.length > 0 ? `${accommodations.length} Hotel${accommodations.length > 1 ? 's' : ''}` : 'Included'}</p>
            </Card>
            
            {/* Board Card */}
            <Card className="text-center p-4">
              <Utensils className="w-8 h-8 mx-auto mb-2 text-secondary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Board</p>
              <p className="font-semibold text-sm md:text-base">As per itinerary</p>
            </Card>
          </div>
        </div>
      </section>

      {/* What's Included Section - Mobile only */}
      {whatsIncluded.length > 0 && (
        <section className="py-6 md:py-8 lg:hidden">
          <div className="container mx-auto px-4 md:px-8">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">What's Included</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {whatsIncluded.map((item, index) => (
                    <div key={index} className="flex items-start gap-2" data-testid={`included-new-${index}`}>
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Availability Calendar Section - Hidden on desktop (sidebar has calendar) */}
      <section className="py-6 md:py-8 bg-muted/30 lg:hidden" id="availability-calendar">
        <div className="container mx-auto px-4 md:px-8">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Check Availability & Prices</h2>
          
          {/* Manual Pricing Calendar */}
          {pricing.length > 0 && (
            <Card className="border-2 border-secondary/30">
              <CardHeader className="bg-secondary/5 pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-sm text-muted-foreground">From</span>
                    <p className="text-2xl font-bold text-foreground">{formatPrice(pkg.price)}</p>
                    <span className="text-xs text-muted-foreground">per person</span>
                  </div>
                  <Badge className="bg-secondary text-white">
                    <Plane className="w-4 h-4 mr-1" />
                    Flights Included
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {airports.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">Departing from</Label>
                    <select
                      value={selectedAirport}
                      onChange={(e) => {
                        setSelectedAirport(e.target.value);
                        setSelectedDate(undefined);
                      }}
                      className="w-full md:w-auto min-w-[200px] p-2 border rounded-md bg-white text-foreground text-sm"
                      data-testid="select-airport-new"
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
                  <PriceCalendarWidget
                    pricingData={sortedPricing}
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    formatPrice={formatPrice}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Bokun Pricing Calendar - Reuse existing component logic */}
          {bokunPricing?.enabled && bokunPricing.prices.length > 0 && bokunAirports.length > 0 && !pricing.length && (
            <Card className="border-2 border-blue-300 dark:border-blue-700">
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20 pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-sm text-muted-foreground">From</span>
                    <p className="text-2xl font-bold text-foreground">{formatPrice(pkg.price)}</p>
                    <span className="text-xs text-muted-foreground">per person</span>
                  </div>
                  <Badge className="bg-blue-600 text-white">
                    <Plane className="w-4 h-4 mr-1" />
                    Flight + Tour
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-1 block">Departing from</Label>
                  <select
                    value={selectedBokunAirport}
                    onChange={(e) => {
                      setSelectedBokunAirport(e.target.value);
                      setSelectedBokunDate(undefined);
                    }}
                    className="w-full md:w-auto min-w-[200px] p-2 border rounded-md bg-white text-foreground text-sm"
                    data-testid="select-bokun-airport-new"
                  >
                    {bokunAirports.length > 1 && <option value="">Select Airport</option>}
                    {bokunAirports.map(airport => (
                      <option key={airport.code} value={airport.code}>
                        {airport.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBokunAirport && (
                  <div className="text-center py-4 text-muted-foreground">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2" />
                    <p>Select dates from the calendar below</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No pricing available message */}
          {!pricing.length && !(bokunPricing?.enabled && bokunPricing.prices.length > 0) && (
            <Card>
              <CardContent className="py-8 text-center">
                <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Contact us for availability and pricing</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Package Details - Tabbed Content (Mobile only) */}
      <section className="py-8 md:py-12 lg:hidden">
        <div className="container mx-auto px-4 md:px-8">
          <h2 className="text-xl md:text-2xl font-bold mb-6">Package Details</h2>
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start mb-6 overflow-x-auto">
              <TabsTrigger value="description" className="text-base font-semibold" data-testid="tab-description-new">Description</TabsTrigger>
              {itinerary.length > 0 && (
                <TabsTrigger value="itinerary" className="text-base font-semibold" data-testid="tab-itinerary-new">Itinerary</TabsTrigger>
              )}
              <TabsTrigger value="accommodation" className="text-base font-semibold" data-testid="tab-accommodation-new">Accommodation</TabsTrigger>
              {(pkg.excluded || pkg.requirements || pkg.attention) && (
                <TabsTrigger value="info" className="text-base font-semibold" data-testid="tab-info-new">Info</TabsTrigger>
              )}
              {pkg.review && (
                <TabsTrigger value="reviews" className="text-base font-semibold" data-testid="tab-reviews-new">Reviews</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="description" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div 
                    className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line [&>p]:mb-4"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.description) }}
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
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {highlights.map((highlight, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                          <span>{highlight}</span>
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
                  <Card key={index} data-testid={`itinerary-day-new-${day.day}`}>
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
                        className="prose prose-sm md:prose-base max-w-none dark:prose-invert text-muted-foreground whitespace-pre-line [&>p]:mb-4"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(day.description) }}
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
                    <Hotel className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Accommodation details coming soon</p>
                  </CardContent>
                </Card>
              ) : (
                accommodations.map((hotel, index) => (
                  <Card key={index} data-testid={`accommodation-new-${index}`}>
                    <CardHeader>
                      <CardTitle>{hotel.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="prose prose-sm md:prose-base max-w-none dark:prose-invert text-muted-foreground mb-4 whitespace-pre-line [&>p]:mb-4"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(hotel.description) }}
                      />
                      {hotel.images && hotel.images.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {hotel.images.slice(0, 4).map((img, imgIndex) => (
                            <img 
                              key={imgIndex}
                              src={img}
                              alt={`${hotel.name} ${imgIndex + 1}`}
                              className="w-full aspect-[4/3] object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              data-testid={`hotel-image-new-${index}-${imgIndex}`}
                              onClick={() => setHotelLightbox({ images: hotel.images, index: imgIndex, hotelName: hotel.name })}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80";
                              }}
                            />
                          ))}
                          {hotel.images.length > 4 && (
                            <button
                              onClick={() => setHotelLightbox({ images: hotel.images, index: 0, hotelName: hotel.name })}
                              className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded"
                            >
                              +{hotel.images.length - 4} more
                            </button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="info" className="space-y-4">
              {pkg.excluded && (
                <Card>
                  <CardHeader>
                    <CardTitle>Exclusions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.excluded) }}
                    />
                  </CardContent>
                </Card>
              )}

              {pkg.requirements && (
                <Card>
                  <CardHeader>
                    <CardTitle>What Do I Need to Bring?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.requirements) }}
                    />
                  </CardContent>
                </Card>
              )}

              {pkg.attention && (
                <Card>
                  <CardHeader>
                    <CardTitle>Please Note</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.attention) }}
                    />
                  </CardContent>
                </Card>
              )}

            </TabsContent>

            {pkg.review && (
              <TabsContent value="reviews" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Reviews</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.review) }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </section>

      {/* Hide old mobile sections in test layout */}
      <div className="hidden">
      {/* Mobile Availability Calendar - Shown only on mobile */}
      {pricing.length > 0 && (
        <section className="lg:hidden pb-6" id="pricing-mobile">
          <div className="container mx-auto px-4">
            <Card className="border-2 border-secondary/30">
              <CardHeader className="bg-secondary/5 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">From</span>
                    <p className="text-2xl font-bold text-foreground">{formatPrice(pkg.price)}</p>
                    <span className="text-xs text-muted-foreground">per person</span>
                  </div>
                  <Badge className="bg-secondary text-white">
                    <Plane className="w-4 h-4 mr-1" />
                    Flights Included
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
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
                      className="w-full p-2 border rounded-md bg-white text-foreground text-sm"
                      data-testid="select-airport-mobile"
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
                      onDateSelect={handleDateSelect}
                      formatPrice={formatPrice}
                    />
                    
                    {selectedDate && selectedPricing && (
                      <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">
                              {selectedDate.toLocaleDateString('en-GB', { 
                                weekday: 'short',
                                day: 'numeric', 
                                month: 'short'
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              From {selectedPricing.departureAirportName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-secondary">
                              {formatPrice(selectedPricing.price)}
                            </p>
                            <p className="text-xs text-muted-foreground">per person</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      data-testid="button-enquire-mobile"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Enquire Now
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardContent>
            </Card>

            {/* Mobile What's Included */}
            {whatsIncluded.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">What's Included</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {whatsIncluded.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm" data-testid={`included-mobile-${index}`}>
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Mobile Bokun Departures + Flights Calendar - Shown when Bokun pricing is available */}
      {bokunPricing?.enabled && bokunPricing.prices.length > 0 && bokunAirports.length > 0 && (
        <section className="lg:hidden pb-6" id="bokun-pricing-mobile">
          <div className="container mx-auto px-4">
            <Card className="border-2 border-blue-300 dark:border-blue-700">
              <CardHeader className="bg-blue-50 dark:bg-blue-950/30 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                      <Plane className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Flight + Tour Package</p>
                      <p className="text-xs text-muted-foreground">
                        {bokunPricing.durationNights ? `${bokunPricing.durationNights} nights` : 'Flights included'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">From</span>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatPrice(bokunDisplayMinPrice)}</p>
                    <span className="text-xs text-muted-foreground">per person</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                  <p className="font-medium">Select Departure Date</p>
                </div>
                
                {/* Airport Selector - Primary selection */}
                {bokunAirports.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">Flying from</Label>
                    <select
                      value={selectedBokunAirport}
                      onChange={(e) => {
                        setSelectedBokunAirport(e.target.value);
                        setSelectedBokunRate("");
                        setSelectedBokunDate(undefined);
                      }}
                      className="w-full p-2 border rounded-md bg-white dark:bg-gray-900 text-foreground text-sm"
                      data-testid="select-bokun-airport-mobile"
                    >
                      {bokunAirports.map(airport => (
                        <option key={airport.code} value={airport.code}>
                          {airport.name} (from {formatPrice(airport.minPrice)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Room Type Selector - only show if multiple rates for selected airport */}
                {bokunRates.length > 1 && selectedBokunAirport && (
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">Room Type</Label>
                    <select
                      value={selectedBokunRate}
                      onChange={(e) => {
                        setSelectedBokunRate(e.target.value);
                        setSelectedBokunDate(undefined);
                      }}
                      className="w-full p-2 border rounded-md bg-white dark:bg-gray-900 text-foreground text-sm"
                      data-testid="select-bokun-rate-mobile"
                    >
                      {bokunRates.map(rate => (
                        <option key={rate.title} value={rate.title}>
                          {rate.title} ({formatPrice(rate.price)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedBokunAirport && filteredBokunPricing.length > 0 && (
                  <div className="space-y-3">
                    <BokunPriceCalendarWidget
                      pricingData={filteredBokunPricing}
                      selectedDate={selectedBokunDate}
                      onDateSelect={setSelectedBokunDate}
                      formatPrice={formatPrice}
                    />
                    
                    {selectedBokunDate && selectedBokunPricing && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">
                              {selectedBokunDate.toLocaleDateString('en-GB', { 
                                weekday: 'short',
                                day: 'numeric', 
                                month: 'short'
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              From {selectedBokunPricing.airportName}
                            </p>
                            {selectedBokunPricing.rateTitle && selectedBokunPricing.rateTitle !== "Standard Rate" && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                {selectedBokunPricing.rateTitle}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                              {formatPrice(selectedBokunPricing.combinedPrice)}
                            </p>
                            <p className="text-xs text-muted-foreground">per person</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="button-enquire-bokun-mobile"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Enquire Now
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
      </div>
      {/* End of hidden old mobile sections */}

      {/* Main Content - OLD LAYOUT (hidden on desktop, kept for mobile fallback) */}
      <section className="py-8 md:py-12 lg:hidden">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 gap-8">
            {/* Left Column - Content */}
            <div>
              {/* Mobile: Continuous scrolling content - HIDDEN in test layout (content moved above) */}
              <div className="hidden">
                {/* Overview Section */}
                <div id="overview-mobile">
                  <h2 className="text-xl font-bold mb-4">About This Package</h2>
                  <Card>
                    <CardContent className="pt-6">
                      <ExpandableText 
                        html={pkg.description}
                        maxLines={6}
                        className="whitespace-pre-line"
                        testId="content-description-mobile"
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Highlights */}
                {highlights.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Tour Highlights</h2>
                    <Card>
                      <CardContent className="pt-6">
                        <ul className="space-y-2">
                          {highlights.map((highlight, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <Check className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Itinerary Section */}
                <div id="itinerary-mobile">
                  <h2 className="text-xl font-bold mb-4">Itinerary</h2>
                  {itinerary.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Detailed itinerary coming soon</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {(showAllItinerary ? itinerary : itinerary.slice(0, 3)).map((day, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-4">
                              <Badge variant="outline" className="text-lg px-4 py-1">
                                Day {day.day}
                              </Badge>
                              <CardTitle className="text-lg">{day.title}</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <ExpandableText 
                              html={day.description}
                              maxLines={4}
                              className="text-muted-foreground"
                              testId={`content-itinerary-day-${day.day}`}
                            />
                          </CardContent>
                        </Card>
                      ))}
                      {itinerary.length > 3 && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowAllItinerary(!showAllItinerary)}
                          data-testid="button-toggle-itinerary"
                        >
                          {showAllItinerary ? (
                            <>Show less</>
                          ) : (
                            <>Show all {itinerary.length} days</>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Hotels Section */}
                <div id="hotels-mobile">
                  <h2 className="text-xl font-bold mb-4">Hotels</h2>
                  {accommodations.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Accommodation details coming soon</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {(accommodations as HotelWithLocation[]).map((hotel, index) => (
                        <Card key={index}>
                          <CardHeader>
                            <CardTitle>{hotel.name}</CardTitle>
                            {hotel.location && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                <span>{hotel.location}</span>
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <ExpandableText 
                              html={hotel.description || ''}
                              maxLines={3}
                              className="text-muted-foreground"
                              testId={`content-hotel-${index}`}
                            />
                            {hotel.images && hotel.images.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {hotel.images.slice(0, 4).map((img, imgIndex) => (
                                  <img 
                                    key={imgIndex}
                                    src={img}
                                    alt={`${hotel.name} ${imgIndex + 1}`}
                                    className="w-full aspect-[4/3] object-cover rounded-lg"
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
                      ))}
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div id="info-mobile">
                  <h2 className="text-xl font-bold mb-4">Additional Information</h2>
                  <div className="space-y-4">
                    {pkg.excluded && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Exclusions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.excluded) }}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {pkg.requirements && (
                      <Card>
                        <CardHeader>
                          <CardTitle>What Do I Need to Bring?</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.requirements) }}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {pkg.attention && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Please Note</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.attention) }}
                          />
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle>Other Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {pkg.otherInfo ? (
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.otherInfo) }}
                          />
                        ) : (
                          <p className="text-muted-foreground">
                            Please contact us for terms and conditions, visa requirements, and other details.
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground border-t pt-4">
                          Please note that it is your responsibility to check and comply with entry requirements for the destination(s) you plan to visit. We suggest you use the FCDO foreign travel advice{' '}
                          <a 
                            href="https://www.gov.uk/foreign-travel-advice" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-secondary hover:underline"
                          >
                            site
                          </a>.
                        </p>
                      </CardContent>
                    </Card>

                    {/* India e-Visa Tips - Mobile */}
                    {pkg.category?.toLowerCase() === 'india' && (
                      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                        <CardHeader>
                          <CardTitle className="text-amber-800 dark:text-amber-200">Mandatory Tips for Applying for an Indian e-Visa</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                            Failure to follow these steps may result in repeated errors or an incomplete application:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
                            <li>Use a desktop or laptop (do not use a mobile phone or tablet)</li>
                            <li>Use Google Chrome or Microsoft Edge only</li>
                            <li>Do not use autofill when entering personal details</li>
                            <li>Complete the application in one sitting</li>
                          </ul>
                          <div className="border-t border-amber-200 dark:border-amber-700 pt-4">
                            <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">Official Government Website</p>
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              For your reference, the only official Government of India e-Visa website is:{' '}
                              <a 
                                href="https://indianvisaonline.gov.in/evisa/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-secondary hover:underline font-medium"
                              >
                                https://indianvisaonline.gov.in/evisa/
                              </a>
                            </p>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 italic">
                              Please be cautious, as there are many unofficial websites online that charge additional fees and often cause technical issues.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Customer Reviews - Mobile */}
                    {pkg.review && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Customer Reviews</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.review) }}
                            data-testid="content-reviews-mobile"
                          />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop: Tabbed content */}
              <Tabs defaultValue="overview" className="w-full hidden lg:block">
                <TabsList className={`grid w-full mb-6 ${pkg.review ? 'grid-cols-5' : 'grid-cols-4'}`}>
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="itinerary" data-testid="tab-itinerary">Itinerary</TabsTrigger>
                  <TabsTrigger value="accommodation" data-testid="tab-accommodation">Hotels</TabsTrigger>
                  <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
                  {pkg.review && (
                    <TabsTrigger value="reviews" data-testid="tab-reviews">Reviews</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {/* Description - Full details */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.description) }}
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
                              <span>{highlight}</span>
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
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(day.description) }}
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
                            className="prose prose-sm md:prose-base max-w-none dark:prose-invert text-muted-foreground mb-4"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(hotel.description) }}
                          />
                          {hotel.images && hotel.images.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {hotel.images.slice(0, 4).map((img, imgIndex) => (
                                <img 
                                  key={imgIndex}
                                  src={img}
                                  alt={`${hotel.name} ${imgIndex + 1}`}
                                  className="w-full aspect-[4/3] object-cover rounded-lg"
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

                <TabsContent value="info" className="space-y-4">
                  {pkg.excluded && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Exclusions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div 
                          className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.excluded) }}
                          data-testid="content-excluded"
                        />
                      </CardContent>
                    </Card>
                  )}

                  {pkg.requirements && (
                    <Card>
                      <CardHeader>
                        <CardTitle>What Do I Need to Bring?</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div 
                          className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.requirements) }}
                          data-testid="content-requirements"
                        />
                      </CardContent>
                    </Card>
                  )}

                  {pkg.attention && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Please Note</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div 
                          className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.attention) }}
                          data-testid="content-attention"
                        />
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>Other Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pkg.otherInfo ? (
                        <div 
                          className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.otherInfo) }}
                          data-testid="content-other-info"
                        />
                      ) : (
                        <p className="text-muted-foreground">
                          Please contact us for terms and conditions, visa requirements, and other details.
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground border-t pt-4" data-testid="fcdo-disclaimer">
                        Please note that it is your responsibility to check and comply with entry requirements for the destination(s) you plan to visit. We suggest you use the FCDO foreign travel advice{' '}
                        <a 
                          href="https://www.gov.uk/foreign-travel-advice" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-secondary hover:underline"
                        >
                          site
                        </a>.
                      </p>
                    </CardContent>
                  </Card>

                  {/* India e-Visa Tips - Desktop */}
                  {pkg.category?.toLowerCase() === 'india' && (
                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" data-testid="india-visa-tips">
                      <CardHeader>
                        <CardTitle className="text-amber-800 dark:text-amber-200">Mandatory Tips for Applying for an Indian e-Visa</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          Failure to follow these steps may result in repeated errors or an incomplete application:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
                          <li>Use a desktop or laptop (do not use a mobile phone or tablet)</li>
                          <li>Use Google Chrome or Microsoft Edge only</li>
                          <li>Do not use autofill when entering personal details</li>
                          <li>Complete the application in one sitting</li>
                        </ul>
                        <div className="border-t border-amber-200 dark:border-amber-700 pt-4">
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">Official Government Website</p>
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            For your reference, the only official Government of India e-Visa website is:{' '}
                            <a 
                              href="https://indianvisaonline.gov.in/evisa/" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-secondary hover:underline font-medium"
                            >
                              https://indianvisaonline.gov.in/evisa/
                            </a>
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 italic">
                            Please be cautious, as there are many unofficial websites online that charge additional fees and often cause technical issues.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Reviews Tab - Only shown when review content exists */}
                {pkg.review && (
                  <TabsContent value="reviews" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Customer Reviews</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div 
                          className="prose prose-sm md:prose-base max-w-none dark:prose-invert whitespace-pre-line"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(pkg.review) }}
                          data-testid="content-reviews"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}
              </Tabs>
            </div>

            {/* Right Column - Booking Sidebar - Hidden on mobile (shown in mobile section above) */}
            <div className="hidden lg:block" id="pricing">
              <div className="sticky top-24">
                <Card className="border-2 border-secondary/30">
                  <CardHeader className="bg-secondary/5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-sm text-muted-foreground">From</span>
                        <div className="flex items-baseline gap-3 flex-wrap">
                          {(pkg.pricingDisplay === "both" || pkg.pricingDisplay === "twin" || !pkg.pricingDisplay) && (
                            <div>
                              <p className="text-3xl font-bold text-foreground" data-testid="text-price">
                                {formatPrice(pkg.price)}
                              </p>
                              <span className="text-xs text-muted-foreground">pp twin share</span>
                            </div>
                          )}
                          {pkg.pricingDisplay === "single" && pkg.singlePrice !== null && pkg.singlePrice !== undefined && (
                            <div>
                              <p className="text-3xl font-bold text-foreground" data-testid="text-single-price">
                                {formatPrice(pkg.singlePrice)}
                              </p>
                              <span className="text-xs text-muted-foreground">pp solo</span>
                            </div>
                          )}
                          {pkg.pricingDisplay === "both" && pkg.singlePrice !== null && pkg.singlePrice !== undefined && (
                            <div className="border-l pl-3 border-border">
                              <p className="text-xl font-semibold text-foreground" data-testid="text-single-price">
                                {formatPrice(pkg.singlePrice)}
                              </p>
                              <span className="text-xs text-muted-foreground">pp solo</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-secondary text-white shrink-0">
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
                                className="w-full p-2 border rounded-md bg-white text-foreground text-sm"
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
                                onDateSelect={handleDateSelect}
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

                    {/* Bokun Departures + Flights Calendar */}
                    {bokunPricing?.enabled && bokunPricing.prices.length > 0 && bokunAirports.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                              <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium text-blue-600 dark:text-blue-400">Flight + Tour Package</p>
                              <p className="text-xs text-muted-foreground">
                                From {formatPrice(bokunDisplayMinPrice)} pp
                                {bokunPricing.durationNights && ` · ${bokunPricing.durationNights} nights`}
                              </p>
                            </div>
                          </div>
                          
                          {/* Airport Selector - Primary selection */}
                          {bokunAirports.length > 0 && (
                            <div>
                              <Label className="text-sm text-muted-foreground mb-1 block">Flying from</Label>
                              <select
                                value={selectedBokunAirport}
                                onChange={(e) => {
                                  setSelectedBokunAirport(e.target.value);
                                  setSelectedBokunRate("");
                                  setSelectedBokunDate(undefined);
                                }}
                                className="w-full p-2 border rounded-md bg-white dark:bg-gray-900 text-foreground text-sm"
                                data-testid="select-bokun-airport"
                              >
                                {bokunAirports.map(airport => (
                                  <option key={airport.code} value={airport.code}>
                                    {airport.name} (from {formatPrice(airport.minPrice)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Room Type Selector - only show if multiple rates for selected airport */}
                          {bokunRates.length > 1 && selectedBokunAirport && (
                            <div>
                              <Label className="text-sm text-muted-foreground mb-1 block">Room Type</Label>
                              <select
                                value={selectedBokunRate}
                                onChange={(e) => {
                                  setSelectedBokunRate(e.target.value);
                                  setSelectedBokunDate(undefined);
                                }}
                                className="w-full p-2 border rounded-md bg-white dark:bg-gray-900 text-foreground text-sm"
                                data-testid="select-bokun-rate"
                              >
                                {bokunRates.map(rate => (
                                  <option key={rate.title} value={rate.title}>
                                    {rate.title} ({formatPrice(rate.price)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {selectedBokunAirport && filteredBokunPricing.length > 0 && (
                            <div className="space-y-3">
                              <BokunPriceCalendarWidget
                                pricingData={filteredBokunPricing}
                                selectedDate={selectedBokunDate}
                                onDateSelect={setSelectedBokunDate}
                                formatPrice={formatPrice}
                              />
                              
                              {selectedBokunDate && selectedBokunPricing && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="font-medium">
                                        {selectedBokunDate.toLocaleDateString('en-GB', { 
                                          weekday: 'long',
                                          day: 'numeric', 
                                          month: 'long',
                                          year: 'numeric'
                                        })}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        From {selectedBokunPricing.airportName}
                                      </p>
                                      {selectedBokunPricing.rateTitle && selectedBokunPricing.rateTitle !== "Standard Rate" && (
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                          {selectedBokunPricing.rateTitle}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        {formatPrice(selectedBokunPricing.combinedPrice)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">per person</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <Separator />
                    <Button 
                      className="w-full" 
                      size="lg" 
                      asChild
                    >
                      <a 
                        href={`tel:${phoneNumber.replace(/\s/g, "")}`} 
                        data-testid="button-call"
                        onClick={() => {
                          captureCallCtaClicked({
                            package_title: pkg?.title,
                            package_id: pkg?.id,
                            package_slug: slug,
                            phone_number: phoneNumber
                          });
                          trackCallCta({
                            content_name: pkg?.title,
                            content_category: pkg?.category || 'Flight Package'
                          });
                        }}
                      >
                        <Phone className="w-5 h-5 mr-2" />
                        {phoneNumber}
                      </a>
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="w-full" 
                      size="lg" 
                      disabled={isChatLoading}
                      onClick={() => {
                        const win = window as WindowWithTidio;
                        
                        // Track PostHog event
                        captureChatCtaClicked({
                          package_title: pkg?.title,
                          package_id: pkg?.id,
                          package_slug: slug
                        });
                        // Track Meta Pixel event
                        trackChatCta({
                          content_name: pkg?.title,
                          content_category: pkg?.category || 'Flight Package'
                        });
                        
                        // Open Tidio chat
                        const openTidio = () => {
                          setIsChatLoading(false);
                          if (win.tidioChatApi) {
                            win.tidioChatApi.show();
                            win.tidioChatApi.open();
                          }
                        };
                        
                        if (win.tidioChatApi) {
                          openTidio();
                        } else {
                          // Show loading state while waiting for Tidio
                          setIsChatLoading(true);
                          const handleReady = () => {
                            openTidio();
                            document.removeEventListener("tidioChat-ready", handleReady);
                          };
                          document.addEventListener("tidioChat-ready", handleReady);
                          // Timeout after 5 seconds to prevent infinite loading
                          setTimeout(() => {
                            setIsChatLoading(false);
                            document.removeEventListener("tidioChat-ready", handleReady);
                          }, 5000);
                        }
                      }}
                      data-testid="button-chat"
                    >
                      {isChatLoading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <MessageCircle className="w-5 h-5 mr-2" />
                      )}
                      {isChatLoading ? "Opening chat..." : "Chat with us"}
                    </Button>
                    <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" 
                          size="lg" 
                          data-testid="button-enquire"
                          onClick={() => {
                            captureEnquireCtaClicked({
                              package_title: pkg?.title,
                              package_id: pkg?.id,
                              package_slug: slug
                            });
                            trackEnquireCta({
                              content_name: pkg?.title,
                              content_category: pkg?.category || 'Flight Package',
                              value: pkg?.price,
                              currency: 'GBP'
                            });
                          }}
                        >
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
                            onClick={() => {
                              captureCtaClicked('enquire', 'package_detail', {
                                cta_label: 'Submit Enquiry',
                                package_id: pkg?.id,
                                package_title: pkg?.title,
                                package_slug: slug
                              });
                            }}
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
                    <img 
                      src={atolLogo} 
                      alt="ATOL Protected" 
                      className="h-14"
                    />
                    <div className="text-sm">
                      <p className="font-medium">Fully Protected</p>
                      <p className="text-muted-foreground">Your money is secure</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Mobile CTA Bar */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-lg z-50 lg:hidden transition-transform duration-300 ${
          showStickyBar ? 'translate-y-0' : 'translate-y-full'
        }`}
        data-testid="sticky-cta-bar"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="text-lg font-bold text-primary truncate" data-testid="text-sticky-price">
                {formatPrice(bokunPricing?.enabled && bokunPricing.prices.length > 0 ? bokunDisplayMinPrice : (pkg?.price || 0))}
                <span className="text-xs font-normal text-muted-foreground ml-1">pp</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a 
                href={`tel:${phoneNumber.replace(/\s/g, '')}`}
                className="flex items-center justify-center h-11 w-11 rounded-md border bg-background hover-elevate active-elevate-2"
                data-testid="button-sticky-call"
                onClick={() => {
                  if (pkg) {
                    captureCallCtaClicked({ 
                      package_id: pkg.id, 
                      package_title: pkg.title,
                      phone_number: phoneNumber 
                    });
                    trackCallCta({ 
                      content_name: pkg.title,
                      content_category: 'package' 
                    });
                  }
                }}
              >
                <Phone className="h-5 w-5 text-primary" />
              </a>
              <Button 
                onClick={() => setEnquiryOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap"
                data-testid="button-sticky-enquire"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Enquire Now
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Add bottom padding to prevent content being hidden by sticky bar on mobile */}
      <div className="h-20 lg:hidden" aria-hidden="true" />

      {/* Hotel Image Lightbox */}
      <Dialog open={!!hotelLightbox} onOpenChange={() => setHotelLightbox(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 bg-black border-none">
          {/* Large Close Button */}
          <button
            onClick={() => setHotelLightbox(null)}
            className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/40 rounded-full p-3 transition-colors"
            aria-label="Close lightbox"
          >
            <X className="w-8 h-8 text-white" />
          </button>
          
          <DialogHeader className="absolute top-0 left-0 right-16 z-10 p-4 bg-gradient-to-b from-black/60 to-transparent">
            <DialogTitle className="text-white text-lg">
              {hotelLightbox?.hotelName} ({(hotelLightbox?.index ?? 0) + 1}/{hotelLightbox?.images.length})
            </DialogTitle>
          </DialogHeader>
          
          {hotelLightbox && (
            <div className="relative flex items-center justify-center min-h-[50vh] md:min-h-[70vh]">
              <img
                src={hotelLightbox.images[hotelLightbox.index]}
                alt={`${hotelLightbox.hotelName} ${hotelLightbox.index + 1}`}
                className="max-w-full max-h-[80vh] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";
                }}
              />
              
              {/* Navigation arrows */}
              {hotelLightbox.images.length > 1 && (
                <>
                  <button
                    onClick={() => setHotelLightbox({
                      ...hotelLightbox,
                      index: hotelLightbox.index === 0 ? hotelLightbox.images.length - 1 : hotelLightbox.index - 1
                    })}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-2 transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={() => setHotelLightbox({
                      ...hotelLightbox,
                      index: hotelLightbox.index === hotelLightbox.images.length - 1 ? 0 : hotelLightbox.index + 1
                    })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-2 transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                </>
              )}
              
              {/* Thumbnail strip */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 overflow-x-auto">
                <div className="flex gap-2 justify-center">
                  {hotelLightbox.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setHotelLightbox({ ...hotelLightbox, index: idx })}
                      className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all ${
                        idx === hotelLightbox.index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
