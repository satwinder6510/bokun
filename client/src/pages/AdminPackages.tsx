import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, Edit2, Eye, Package, Search,
  Plane, Save, X, Clock, MapPin, Download, Upload, ImagePlus, Loader2,
  Globe, CheckCircle2, AlertCircle, Calendar as CalendarIcon, PoundSterling, GripVertical, Info,
  ChevronUp, ChevronDown, PlusCircle, ExternalLink
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Calendar } from "@/components/ui/calendar";
import { DayPicker } from "react-day-picker";
import { format, parseISO, isValid } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FlightPackage, InsertFlightPackage, PackagePricing, Hotel, PackageSeason } from "@shared/schema";
import { MediaPicker } from "@/components/MediaPicker";
import { Star, RefreshCw } from "lucide-react";

// UK Airports list
const UK_AIRPORTS = [
  { code: "LHR", name: "London Heathrow" },
  { code: "LGW", name: "London Gatwick" },
  { code: "STN", name: "London Stansted" },
  { code: "LTN", name: "London Luton" },
  { code: "MAN", name: "Manchester" },
  { code: "BHX", name: "Birmingham" },
  { code: "EDI", name: "Edinburgh" },
  { code: "GLA", name: "Glasgow" },
  { code: "BRS", name: "Bristol" },
  { code: "NCL", name: "Newcastle" },
  { code: "LPL", name: "Liverpool" },
  { code: "EMA", name: "East Midlands" },
  { code: "LBA", name: "Leeds Bradford" },
  { code: "BFS", name: "Belfast International" },
  { code: "CWL", name: "Cardiff" },
];

type ItineraryDay = {
  day: number;
  title: string;
  description: string;
};

type Accommodation = {
  name: string;
  images: string[];
  description: string;
};

type VideoItem = {
  url: string;
  title?: string;
  platform: 'youtube' | 'vimeo';
  videoId: string;
};

// Common destination countries for quick selection
const COMMON_COUNTRIES = [
  "India", "Maldives", "Dubai", "Sri Lanka", "Thailand", "Vietnam", 
  "Cambodia", "Bali", "Japan", "China", "Nepal", "Singapore", "Malaysia", "Indonesia",
  "Egypt", "Morocco", "Kenya", "Tanzania", "South Africa", "Mauritius",
  "Jordan", "Oman", "Saudi Arabia", "Turkey", "Greece", "Italy", "Spain",
  "Portugal", "France", "Croatia", "Iceland", "Norway", "USA", "Canada",
  "Mexico", "Peru", "Brazil", "Argentina", "Australia", "New Zealand", "Fiji"
];

type PackageFormData = {
  title: string;
  slug: string;
  category: string;
  countries: string[];
  tags: string[];
  price: number;
  singlePrice: number | null;
  pricingDisplay: "both" | "twin" | "single";
  pricingModule: "manual" | "open_jaw_seasonal" | "bokun_departures";
  flightApiSource: "european" | "serp";
  currency: string;
  priceLabel: string;
  description: string;
  excerpt: string;
  whatsIncluded: string[];
  highlights: string[];
  itinerary: ItineraryDay[];
  accommodations: Accommodation[];
  otherInfo: string;
  review: string | null;
  excluded: string | null;
  requirements: string | null;
  attention: string | null;
  featuredImage: string;
  gallery: string[];
  mobileHeroVideo: string;
  desktopHeroVideo: string;
  customExclusions: string[];
  cityTaxConfig: { city: string; nights: number; starRating?: number }[];
  additionalChargeName: string;
  additionalChargeCurrency: string;
  additionalChargeForeignAmount: string;
  additionalChargeExchangeRate: string;
  videos: VideoItem[];
  duration: string;
  boardBasisOverride: string;
  hotelOverride: string;
  metaTitle: string;
  metaDescription: string;
  isPublished: boolean;
  isUnlisted: boolean;
  isSpecialOffer: boolean;
  displayOrder: number;
  bokunProductId: string | null;
  enabledHotelCategories: string[];
};

type BokunTourResult = {
  id: string;
  title: string;
  excerpt: string;
  price: number;
  durationText: string;
  keyPhotoUrl: string;
  location: string;
};

// Common tag options for quick selection
const COMMON_TAGS = [
  "City Breaks", "Twin-Centre", "All-inclusive", "Gems",
  "Beach", "Family", "Adventure", "Luxury", 
  "Budget", "Cultural", "Safari", "Cruise", "River Cruise",
  "Golden Triangle", "Multi-Centre", "Wellness", "Religious", "Wildlife", "Island",
  "Solo Travellers"
];

const emptyPackage: PackageFormData = {
  title: "",
  slug: "",
  category: "",
  countries: [],
  tags: [],
  price: 0,
  singlePrice: null,
  pricingDisplay: "both",
  pricingModule: "manual",
  flightApiSource: "european",
  currency: "GBP",
  priceLabel: "per adult",
  description: "",
  excerpt: "",
  whatsIncluded: [],
  highlights: [],
  itinerary: [],
  accommodations: [],
  otherInfo: "",
  review: null,
  excluded: null,
  requirements: null,
  attention: null,
  featuredImage: "",
  gallery: [],
  mobileHeroVideo: "",
  desktopHeroVideo: "",
  customExclusions: [],
  cityTaxConfig: [],
  additionalChargeName: "",
  additionalChargeCurrency: "EUR",
  additionalChargeForeignAmount: "",
  additionalChargeExchangeRate: "0.84",
  videos: [],
  duration: "",
  boardBasisOverride: "",
  hotelOverride: "",
  metaTitle: "",
  metaDescription: "",
  isPublished: false,
  isUnlisted: false,
  isSpecialOffer: false,
  displayOrder: 0,
  bokunProductId: null,
  enabledHotelCategories: [],
};

// Helper function to parse YouTube/Vimeo URLs
function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo'; videoId: string } | null {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return { platform: 'youtube', videoId: match[1] };
    }
  }
  
  // Vimeo patterns
  const vimeoPatterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];
  
  for (const pattern of vimeoPatterns) {
    const match = url.match(pattern);
    if (match) {
      return { platform: 'vimeo', videoId: match[1] };
    }
  }
  
  return null;
}

// Get video thumbnail URL
function getVideoThumbnail(video: VideoItem): string {
  if (video.platform === 'youtube') {
    return `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
  }
  // Vimeo thumbnails require an API call, so we'll use a placeholder
  return `https://vumbnail.com/${video.videoId}.jpg`;
}

type ScrapedData = {
  title: string;
  price: number;
  category: string;
  slug: string;
  overview: string;
  whatsIncluded: string[];
  highlights: string[];
  itinerary: { day: number; title: string; description: string }[];
  hotelImages: string[];
  accommodations: { name: string; description: string; images: string[] }[];
  featuredImage: string;
};

export default function AdminPackages() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingPackage, setEditingPackage] = useState<FlightPackage | null>(null);
  const [formData, setFormData] = useState<PackageFormData>(emptyPackage);
  const [newIncluded, setNewIncluded] = useState("");
  const [newHighlight, setNewHighlight] = useState("");
  const [newTag, setNewTag] = useState("");
  const [editingHighlightIndex, setEditingHighlightIndex] = useState<number | null>(null);
  const [editingHighlightValue, setEditingHighlightValue] = useState("");
  const [editingIncludedIndex, setEditingIncludedIndex] = useState<number | null>(null);
  const [editingIncludedValue, setEditingIncludedValue] = useState("");
  const [newExclusion, setNewExclusion] = useState("");
  const [editingExclusionIndex, setEditingExclusionIndex] = useState<number | null>(null);
  const [editingExclusionValue, setEditingExclusionValue] = useState("");
  const [selectedCityTax, setSelectedCityTax] = useState("");
  const [cityTaxNights, setCityTaxNights] = useState(1);
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [isUploadingMobileVideo, setIsUploadingMobileVideo] = useState(false);
  const [isUploadingDesktopVideo, setIsUploadingDesktopVideo] = useState(false);
  const [uploadingHotelIndex, setUploadingHotelIndex] = useState<number | null>(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState<{ hotelIndex: number; imageIndex: number } | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<{ hotelIndex: number; imageIndex: number } | null>(null);
  const [draggedGalleryIndex, setDraggedGalleryIndex] = useState<number | null>(null);
  const [dragOverGalleryIndex, setDragOverGalleryIndex] = useState<number | null>(null);
  const [draggedVideoIndex, setDraggedVideoIndex] = useState<number | null>(null);
  const [dragOverVideoIndex, setDragOverVideoIndex] = useState<number | null>(null);
  const [draggedAccommodationIndex, setDraggedAccommodationIndex] = useState<number | null>(null);
  const [dragOverAccommodationIndex, setDragOverAccommodationIndex] = useState<number | null>(null);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const featuredImageRef = useRef<HTMLInputElement>(null);
  const galleryImagesRef = useRef<HTMLInputElement>(null);
  const mobileVideoRef = useRef<HTMLInputElement>(null);
  const desktopVideoRef = useRef<HTMLInputElement>(null);
  const hotelImageRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  
  // Scraper test state
  const [scraperDialogOpen, setScraperDialogOpen] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [imageProcessingProgress, setImageProcessingProgress] = useState({ current: 0, total: 0 });

  // Pricing calendar state
  const [pricingAirport, setPricingAirport] = useState("");
  const [pricingPrice, setPricingPrice] = useState<number>(0);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [existingPricing, setExistingPricing] = useState<PackagePricing[]>([]);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);
  
  // Dynamic flight pricing state
  const [flightDestAirport, setFlightDestAirport] = useState("");
  const [flightDepartAirports, setFlightDepartAirports] = useState<string[]>(["LGW", "STN", "LTN", "LHR", "MAN"]);
  const [flightDuration, setFlightDuration] = useState<number>(7);
  const [flightStartDate, setFlightStartDate] = useState("");
  const [flightEndDate, setFlightEndDate] = useState("");
  const [flightMarkup, setFlightMarkup] = useState<number>(5);
  const [isFetchingFlightPrices, setIsFetchingFlightPrices] = useState(false);
  const [flightPriceResults, setFlightPriceResults] = useState<any>(null);
  
  // Open-jaw and internal flight state (SERP API only)
  const [flightType, setFlightType] = useState<"round_trip" | "open_jaw">("round_trip");
  const [openJawArriveAirport, setOpenJawArriveAirport] = useState(""); // Where outbound lands
  const [openJawDepartAirport, setOpenJawDepartAirport] = useState(""); // Where return departs from
  const [hasInternalFlight, setHasInternalFlight] = useState(false);
  const [internalFromAirport, setInternalFromAirport] = useState(""); // Internal flight from
  const [internalToAirport, setInternalToAirport] = useState(""); // Internal flight to
  const [internalFlightOffsetDays, setInternalFlightOffsetDays] = useState<number>(1); // Days after arrival for internal flight
  
  // Seasonal land pricing state (for manual packages)
  const [packageSeasons, setPackageSeasons] = useState<PackageSeason[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [editingSeasonData, setEditingSeasonData] = useState<PackageSeason | null>(null);
  const [seasonForm, setSeasonForm] = useState({
    seasonName: "",
    startDate: "",
    endDate: "",
    landCostPerPerson: 0,
    hotelCostPerPerson: null as number | null,
    notes: "",
  });

  // Bokun tour import state
  const [bokunSearchOpen, setBokunSearchOpen] = useState(false);
  const [bokunSearchQuery, setBokunSearchQuery] = useState("");
  const [bokunSearchResults, setBokunSearchResults] = useState<BokunTourResult[]>([]);
  const [isSearchingBokun, setIsSearchingBokun] = useState(false);
  const [isImportingBokun, setIsImportingBokun] = useState(false);
  const [importedPriceBreakdown, setImportedPriceBreakdown] = useState<{
    singleRoomPrice?: number;
    doubleRoomPrice?: number;
    rates?: { id: number; title: string; minPerBooking: number; price: number }[];
  } | null>(null);
  
  // Bokun departures state (for bokun_departures pricing module)
  const [bokunDepartures, setBokunDepartures] = useState<any[]>([]);
  const [isLoadingDepartures, setIsLoadingDepartures] = useState(false);
  const [isSyncingDepartures, setIsSyncingDepartures] = useState(false);
  const [lastDepartureSync, setLastDepartureSync] = useState<string | null>(null);
  const [bokunFlightDestAirport, setBokunFlightDestAirport] = useState("");
  const [bokunFlightReturnAirport, setBokunFlightReturnAirport] = useState(""); // For open-jaw: where return flight departs
  const [bokunFlightDepartAirports, setBokunFlightDepartAirports] = useState<string[]>(["LGW", "STN", "LTN", "LHR", "MAN"]);
  const [isFetchingBokunFlights, setIsFetchingBokunFlights] = useState(false);
  const [bokunFlightResults, setBokunFlightResults] = useState<{ success?: boolean; updated?: number; error?: string } | null>(null);
  const [bokunFlightMarkup, setBokunFlightMarkup] = useState(10);
  const [bokunFlightType, setBokunFlightType] = useState<"roundtrip" | "openjaw">("roundtrip");
  
  // Hotel library picker state
  const [hotelPickerOpen, setHotelPickerOpen] = useState(false);
  const [hotelSearchQuery, setHotelSearchQuery] = useState("");

  // Helper for admin fetch with cookie-based auth
  const adminQueryFn = async (url: string) => {
    const response = await fetch(url, {
      credentials: 'include',
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return response.json();
  };

  const { data: packages = [], isLoading } = useQuery<FlightPackage[]>({
    queryKey: ["/api/admin/packages"],
  });
  
  // Hotels library query for hotel picker
  const { data: hotelsLibrary = [] } = useQuery<Hotel[]>({
    queryKey: ["/api/admin/hotels"],
    queryFn: () => adminQueryFn("/api/admin/hotels"),
    enabled: hotelPickerOpen,
  });
  
  // City taxes query for city tax configuration
  type CityTaxItem = { 
    id: number; 
    cityName: string; 
    taxPerNightPerPerson: number; 
    currency: string; 
    pricingType: string;
    rate1Star?: number;
    rate2Star?: number;
    rate3Star?: number;
    rate4Star?: number;
    rate5Star?: number;
  };
  const { data: cityTaxes = [] } = useQuery<CityTaxItem[]>({
    queryKey: ["/api/admin/city-taxes"],
    queryFn: () => adminQueryFn("/api/admin/city-taxes"),
  });
  
  // Star rating state for adding new city tax entries
  const [cityTaxStarRating, setCityTaxStarRating] = useState<number>(4);
  
  // Helper to get tax rate based on pricing type and star rating
  const getCityTaxRate = (taxInfo: CityTaxItem, starRating?: number): number => {
    if (taxInfo.pricingType === 'star_rating') {
      // Default to 4-star rating if not specified
      const rating = starRating || 4;
      switch (rating) {
        case 1: return taxInfo.rate1Star || 0;
        case 2: return taxInfo.rate2Star || 0;
        case 3: return taxInfo.rate3Star || 0;
        case 4: return taxInfo.rate4Star || 0;
        case 5: return taxInfo.rate5Star || 0;
        default: return taxInfo.rate4Star || 0;
      }
    }
    return taxInfo.taxPerNightPerPerson || 0;
  };
  
  // Filter hotels based on search
  const filteredHotels = hotelsLibrary.filter(hotel => 
    hotel.name.toLowerCase().includes(hotelSearchQuery.toLowerCase()) ||
    hotel.city?.toLowerCase().includes(hotelSearchQuery.toLowerCase()) ||
    hotel.country?.toLowerCase().includes(hotelSearchQuery.toLowerCase())
  );
  
  // Import hotel from library to accommodations
  const importHotelFromLibrary = (hotel: Hotel) => {
    const newAccommodation: Accommodation = {
      name: hotel.name,
      description: hotel.description || '',
      images: hotel.images || [],
    };
    setFormData({
      ...formData,
      accommodations: [...(formData.accommodations || []), newAccommodation],
    });
    setHotelPickerOpen(false);
    setHotelSearchQuery("");
    toast({ title: `"${hotel.name}" added to accommodations` });
  };

  const createMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      return apiRequest("POST", "/api/admin/packages", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: "Package created successfully" });
      setIsCreating(false);
      setFormData(emptyPackage);
    },
    onError: (error: Error) => {
      toast({ title: "Error creating package", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PackageFormData> }) => {
      return apiRequest("PATCH", `/api/admin/packages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: "Package updated successfully" });
      setEditingPackage(null);
      setFormData(emptyPackage);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating package", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/packages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ title: "Package deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting package", description: error.message, variant: "destructive" });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: number; isPublished: boolean }) => {
      return apiRequest("PATCH", `/api/admin/packages/${id}`, { isPublished });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating package", description: error.message, variant: "destructive" });
    },
  });

  const importSamplesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/packages/import-samples", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({ 
        title: "Sample packages imported", 
        description: `Imported ${data.imported} packages${data.errors?.length ? `. ${data.errors.length} skipped.` : ''}`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error importing samples", description: error.message, variant: "destructive" });
    },
  });

  const filteredPackages = packages.filter(pkg =>
    pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pkg.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleScrapeTest = async () => {
    if (!scrapeUrl) {
      toast({ title: "Please enter a URL", variant: "destructive" });
      return;
    }
    
    // Validate URL domain
    if (!scrapeUrl.includes('holidays.flightsandpackages.com')) {
      toast({ 
        title: "Invalid URL", 
        description: "Please use a URL from holidays.flightsandpackages.com (not tours.flightsandpackages.com)", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsScraping(true);
    setScrapedData(null);
    
    try {
      const response = await fetch('/api/admin/scrape-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      
      if (!response.ok) {
        throw new Error('Scrape failed');
      }
      
      const result = await response.json();
      if (result.success) {
        setScrapedData(result.extracted);
        toast({ title: "Scrape successful!" });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error: any) {
      toast({ title: "Scrape failed", description: error.message, variant: "destructive" });
    } finally {
      setIsScraping(false);
    }
  };

  const handleImportScrapedData = async (optimizeImages: boolean = false) => {
    if (!scrapedData) return;
    
    let processedGallery = scrapedData.hotelImages || [];
    let processedFeaturedImage = scrapedData.featuredImage || '';
    let processedAccommodations = scrapedData.accommodations?.map(acc => ({
      name: acc.name,
      description: acc.description,
      images: acc.images || [],
    })) || [];
    
    if (optimizeImages) {
      setIsProcessingImages(true);
      
      try {
        // Collect all images to process
        const allImages = [
          ...(scrapedData.hotelImages || []),
          scrapedData.featuredImage,
          ...(scrapedData.accommodations?.flatMap(acc => acc.images || []) || [])
        ].filter(Boolean);
        
        setImageProcessingProgress({ current: 0, total: allImages.length });
        
        if (allImages.length > 0) {
          toast({ title: "Processing images...", description: `Optimizing ${allImages.length} images` });
          
          const response = await fetch('/api/admin/process-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrls: allImages,
              packageSlug: scrapedData.slug || 'package',
              maxImages: 20
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            
            if (result.images && result.images.length > 0) {
              // Map original URLs to processed URLs
              const urlMap = new Map<string, string>();
              allImages.forEach((url, index) => {
                if (result.images[index]) {
                  urlMap.set(url, result.images[index].card);
                }
              });
              
              // Update gallery with optimized card-size images
              processedGallery = (scrapedData.hotelImages || []).map(url => 
                urlMap.get(url) || url
              );
              
              // Update featured image
              if (scrapedData.featuredImage && urlMap.has(scrapedData.featuredImage)) {
                const featuredIndex = allImages.indexOf(scrapedData.featuredImage);
                if (featuredIndex >= 0 && result.images[featuredIndex]) {
                  processedFeaturedImage = result.images[featuredIndex].hero;
                }
              }
              
              // Update accommodation images
              processedAccommodations = scrapedData.accommodations?.map(acc => ({
                name: acc.name,
                description: acc.description,
                images: (acc.images || []).map(url => urlMap.get(url) || url),
              })) || [];
              
              toast({ 
                title: "Images optimized!", 
                description: `Processed ${result.processed} of ${result.total} images` 
              });
            }
          } else {
            toast({ 
              title: "Image processing failed", 
              description: "Using original image URLs",
              variant: "destructive"
            });
          }
        }
      } catch (error: any) {
        console.error("Image processing error:", error);
        toast({ 
          title: "Image processing error", 
          description: error.message,
          variant: "destructive"
        });
      } finally {
        setIsProcessingImages(false);
        setImageProcessingProgress({ current: 0, total: 0 });
      }
    }
    
    // Clean the slug to ensure it only contains valid characters
    const cleanSlug = (scrapedData.slug || scrapedData.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    setFormData({
      ...emptyPackage,
      title: scrapedData.title,
      slug: cleanSlug,
      category: scrapedData.category,
      price: scrapedData.price,
      description: scrapedData.overview,
      whatsIncluded: scrapedData.whatsIncluded,
      highlights: scrapedData.highlights,
      itinerary: scrapedData.itinerary,
      accommodations: processedAccommodations,
      featuredImage: processedFeaturedImage,
      gallery: processedGallery,
    });
    
    setScraperDialogOpen(false);
    setIsCreating(true);
    setEditingPackage(null);
    toast({ title: "Data imported to form", description: "Review and save the package" });
  };

  const handleOpenCreate = () => {
    setFormData(emptyPackage);
    setIsCreating(true);
    setEditingPackage(null);
  };

  const handleOpenEdit = async (pkg: FlightPackage) => {
    setFormData({
      title: pkg.title,
      slug: pkg.slug,
      category: pkg.category,
      countries: (pkg.countries || []) as string[],
      tags: (pkg.tags || []) as string[],
      price: pkg.price,
      singlePrice: pkg.singlePrice || null,
      pricingDisplay: (pkg.pricingDisplay as "both" | "twin" | "single") || "both",
      pricingModule: (pkg.pricingModule === "open_jaw_seasonal" ? "open_jaw_seasonal" : pkg.pricingModule === "bokun_departures" ? "bokun_departures" : "manual") as "manual" | "open_jaw_seasonal" | "bokun_departures",
      flightApiSource: ((pkg as any).flightApiSource as "european" | "serp") || "european",
      currency: pkg.currency,
      priceLabel: pkg.priceLabel,
      description: pkg.description,
      excerpt: pkg.excerpt || "",
      whatsIncluded: (pkg.whatsIncluded || []) as string[],
      highlights: (pkg.highlights || []) as string[],
      itinerary: (pkg.itinerary || []) as ItineraryDay[],
      accommodations: (pkg.accommodations || []) as Accommodation[],
      otherInfo: pkg.otherInfo || "",
      review: pkg.review || null,
      excluded: pkg.excluded || null,
      requirements: pkg.requirements || null,
      attention: pkg.attention || null,
      featuredImage: pkg.featuredImage || "",
      gallery: (pkg.gallery || []) as string[],
      mobileHeroVideo: pkg.mobileHeroVideo || "",
      desktopHeroVideo: pkg.desktopHeroVideo || "",
      customExclusions: (pkg.customExclusions || []) as string[],
      cityTaxConfig: ((pkg as any).cityTaxConfig || []) as { city: string; nights: number; starRating?: number }[],
      additionalChargeName: (pkg as any).additionalChargeName || "",
      additionalChargeCurrency: (pkg as any).additionalChargeCurrency || "EUR",
      additionalChargeForeignAmount: (pkg as any).additionalChargeForeignAmount || "",
      additionalChargeExchangeRate: (pkg as any).additionalChargeExchangeRate || "0.84",
      videos: (pkg.videos || []) as VideoItem[],
      duration: pkg.duration || "",
      boardBasisOverride: pkg.boardBasisOverride || "",
      hotelOverride: pkg.hotelOverride || "",
      metaTitle: pkg.metaTitle || "",
      metaDescription: pkg.metaDescription || "",
      isPublished: pkg.isPublished,
      isUnlisted: pkg.isUnlisted || false,
      isSpecialOffer: pkg.isSpecialOffer || false,
      displayOrder: pkg.displayOrder,
      bokunProductId: pkg.bokunProductId || null,
      enabledHotelCategories: ((pkg as any).enabledHotelCategories || []) as string[],
    });
    // Clear imported price breakdown when editing existing package
    setImportedPriceBreakdown(null);
    setEditingPackage(pkg);
    setIsCreating(false);
    
    // Reset pricing state
    setPricingAirport("");
    setPricingPrice(pkg.price || 0);
    setSelectedDates([]);
    
    // Load existing pricing for this package
    await loadPackagePricing(pkg.id);
    
    // Load seasons for open-jaw pricing
    await loadPackageSeasons(pkg.id);
    
    // Load Bokun departures if using bokun_departures module
    if (pkg.pricingModule === "bokun_departures" && pkg.bokunProductId) {
      await loadBokunDepartures(pkg.id);
    }
  };

  const loadPackagePricing = async (packageId: number) => {
    setIsLoadingPricing(true);
    try {
      console.log("Loading pricing for package:", packageId);
      const response = await fetch(`/api/admin/packages/${packageId}/pricing`);
      if (response.ok) {
        const pricing = await response.json();
        console.log("Pricing loaded:", pricing.length, "entries");
        setExistingPricing(pricing);
      } else {
        console.error("Failed to load pricing, status:", response.status);
      }
    } catch (error) {
      console.error("Failed to load pricing:", error);
    } finally {
      setIsLoadingPricing(false);
    }
  };
  
  // Seasonal land pricing functions
  const loadPackageSeasons = async (packageId: number) => {
    setIsLoadingSeasons(true);
    try {
      const response = await fetch(`/api/admin/packages/${packageId}/seasons`, {
        credentials: 'include',
      });
      if (response.ok) {
        const seasons = await response.json();
        setPackageSeasons(seasons);
      }
    } catch (error) {
      console.error("Failed to load seasons:", error);
    } finally {
      setIsLoadingSeasons(false);
    }
  };
  
  const handleAddSeason = () => {
    setEditingSeasonData(null);
    // Pre-populate land cost from the package's imported Bokun price
    const defaultLandCost = editingPackage?.price || 0;
    setSeasonForm({
      seasonName: "",
      startDate: "",
      endDate: "",
      landCostPerPerson: defaultLandCost,
      hotelCostPerPerson: null,
      notes: "",
    });
    setSeasonDialogOpen(true);
  };
  
  const handleEditSeason = (season: PackageSeason) => {
    setEditingSeasonData(season);
    setSeasonForm({
      seasonName: season.seasonName,
      startDate: format(new Date(season.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(season.endDate), "yyyy-MM-dd"),
      landCostPerPerson: season.landCostPerPerson,
      hotelCostPerPerson: season.hotelCostPerPerson,
      notes: season.notes || "",
    });
    setSeasonDialogOpen(true);
  };
  
  const handleSaveSeason = async () => {
    if (!editingPackage || !seasonForm.seasonName || !seasonForm.startDate || !seasonForm.endDate || !seasonForm.landCostPerPerson) {
      toast({ title: "Missing information", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    try {
      const url = editingSeasonData 
        ? `/api/admin/seasons/${editingSeasonData.id}`
        : `/api/admin/packages/${editingPackage.id}/seasons`;
      
      const response = await fetch(url, {
        method: editingSeasonData ? "PATCH" : "POST",
        credentials: 'include',
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(seasonForm),
      });
      
      if (response.ok) {
        toast({ title: editingSeasonData ? "Season updated" : "Season added" });
        setSeasonDialogOpen(false);
        await loadPackageSeasons(editingPackage.id);
      } else {
        throw new Error("Failed to save season");
      }
    } catch (error) {
      toast({ title: "Error saving season", variant: "destructive" });
    }
  };
  
  const handleDeleteSeason = async (seasonId: number) => {
    if (!editingPackage) return;
    
    try {
      const response = await fetch(`/api/admin/seasons/${seasonId}`, {
        method: "DELETE",
        credentials: 'include',
      });
      
      if (response.ok) {
        toast({ title: "Season deleted" });
        await loadPackageSeasons(editingPackage.id);
      }
    } catch (error) {
      toast({ title: "Error deleting season", variant: "destructive" });
    }
  };
  
  // Bokun departures functions
  const loadBokunDepartures = async (packageId: number) => {
    setIsLoadingDepartures(true);
    try {
      const response = await fetch(`/api/admin/packages/${packageId}/departures`, {
        credentials: 'include',
      });
      if (response.ok) {
        const departures = await response.json();
        setBokunDepartures(departures);
        if (departures.length > 0 && departures[0].lastSyncedAt) {
          setLastDepartureSync(departures[0].lastSyncedAt);
        }
      }
    } catch (error) {
      console.error("Failed to load Bokun departures:", error);
    } finally {
      setIsLoadingDepartures(false);
    }
  };
  
  const handleSyncDepartures = async () => {
    if (!editingPackage) return;
    
    setIsSyncingDepartures(true);
    try {
      const response = await fetch(`/api/admin/packages/${editingPackage.id}/sync-departures`, {
        method: "POST",
        credentials: 'include',
        headers: { 
          "Content-Type": "application/json",
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({ 
          title: "Departures synced", 
          description: `Found ${result.departuresCount} departures with ${result.ratesCount} rates` 
        });
        setLastDepartureSync(result.lastSyncedAt);
        await loadBokunDepartures(editingPackage.id);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync departures");
      }
    } catch (error: any) {
      toast({ 
        title: "Error syncing departures", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsSyncingDepartures(false);
    }
  };
  
  const handleFetchBokunDepartureFlights = async () => {
    if (!editingPackage || bokunDepartures.length === 0) {
      toast({ title: "No departures to update", description: "Please sync departures first", variant: "destructive" });
      return;
    }
    
    if (!bokunFlightDestAirport) {
      toast({ title: "Missing destination airport", description: "Please enter the destination airport", variant: "destructive" });
      return;
    }
    
    if (bokunFlightType === "openjaw" && !bokunFlightReturnAirport) {
      toast({ title: "Missing return airport", description: "Please enter the return departure airport for open-jaw flights", variant: "destructive" });
      return;
    }
    
    if (bokunFlightDepartAirports.length === 0) {
      toast({ title: "No departure airports", description: "Please select at least one UK departure airport", variant: "destructive" });
      return;
    }
    
    setIsFetchingBokunFlights(true);
    setBokunFlightResults(null);
    
    try {
      const response = await fetch("/api/admin/packages/fetch-bokun-departure-flights", {
        method: "POST",
        credentials: 'include',
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId: editingPackage.id,
          destinationAirport: bokunFlightDestAirport,
          returnAirport: bokunFlightType === "openjaw" ? bokunFlightReturnAirport : undefined,
          departureAirports: bokunFlightDepartAirports,
          duration: parseInt(editingPackage.duration || "7"),
          markup: bokunFlightMarkup,
          flightType: bokunFlightType,
          flightApiSource: formData.flightApiSource,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setBokunFlightResults({ success: true, updated: result.updated });
        toast({ 
          title: "Flight prices updated", 
          description: `Updated ${result.updated} departure rates with flight prices` 
        });
        await loadBokunDepartures(editingPackage.id);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch flight prices");
      }
    } catch (error: any) {
      setBokunFlightResults({ error: error.message });
      toast({ 
        title: "Error fetching flights", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsFetchingBokunFlights(false);
    }
  };
  
  const handleFetchSerpFlightPrices = async () => {
    // Validate based on flight type - now works for both European and SERP APIs
    const isOpenJaw = flightType === "open_jaw";
    
    if (isOpenJaw) {
      if (!editingPackage || !openJawArriveAirport || !openJawDepartAirport || flightDepartAirports.length === 0 || !flightStartDate || !flightEndDate) {
        toast({ title: "Missing information", description: "Please fill in arrival and departure airports", variant: "destructive" });
        return;
      }
      if (hasInternalFlight && (!internalFromAirport || !internalToAirport)) {
        toast({ title: "Missing internal flight info", description: "Please fill in internal flight from/to airports", variant: "destructive" });
        return;
      }
    } else {
      if (!editingPackage || !flightDestAirport || flightDepartAirports.length === 0 || !flightStartDate || !flightEndDate) {
        toast({ title: "Missing information", variant: "destructive" });
        return;
      }
    }
    
    if (packageSeasons.length === 0) {
      toast({ title: "No seasons defined", description: "Add at least one season with land costs first", variant: "destructive" });
      return;
    }
    
    setIsFetchingFlightPrices(true);
    setFlightPriceResults(null);
    
    try {
      const response = await fetch("/api/admin/packages/fetch-serp-flight-prices", {
        method: "POST",
        credentials: 'include',
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId: editingPackage.id,
          destinationAirport: isOpenJaw ? openJawArriveAirport : flightDestAirport,
          departureAirports: flightDepartAirports,
          duration: flightDuration,
          startDate: flightStartDate,
          endDate: flightEndDate,
          markup: flightMarkup,
          seasons: packageSeasons,
          flightApiSource: formData.flightApiSource || "serp",
          // Open-jaw specific parameters
          flightType: isOpenJaw ? "open_jaw" : "round_trip",
          openJawArriveAirport: isOpenJaw ? openJawArriveAirport : undefined,
          openJawDepartAirport: isOpenJaw ? openJawDepartAirport : undefined,
          // Internal flight parameters
          hasInternalFlight: isOpenJaw && hasInternalFlight,
          internalFromAirport: hasInternalFlight ? internalFromAirport : undefined,
          internalToAirport: hasInternalFlight ? internalToAirport : undefined,
          internalFlightOffsetDays: hasInternalFlight ? internalFlightOffsetDays : undefined,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setFlightPriceResults(result);
        await loadPackagePricing(editingPackage.id);
      } else {
        const error = await response.json();
        setFlightPriceResults({ error: error.message || "Failed to fetch prices" });
      }
    } catch (error) {
      setFlightPriceResults({ error: "Network error fetching prices" });
    } finally {
      setIsFetchingFlightPrices(false);
    }
  };

  const handleAddPricingEntries = async () => {
    if (!editingPackage || !pricingAirport || !pricingPrice || selectedDates.length === 0) {
      toast({ 
        title: "Missing information", 
        description: "Please select an airport, enter a price, and pick at least one date",
        variant: "destructive" 
      });
      return;
    }
    
    const airport = UK_AIRPORTS.find(a => a.code === pricingAirport);
    if (!airport) return;
    
    setIsSavingPricing(true);
    try {
      const entries = selectedDates.map(date => ({
        departureAirport: airport.code,
        departureAirportName: airport.name,
        departureDate: format(date, "yyyy-MM-dd"),
        price: pricingPrice,
        currency: "GBP",
      }));
      
      const response = await fetch(`/api/admin/packages/${editingPackage.id}/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({ 
          title: "Pricing added", 
          description: `Added ${result.created} price entries for ${airport.name}` 
        });
        setSelectedDates([]);
        await loadPackagePricing(editingPackage.id);
      } else {
        throw new Error("Failed to save pricing");
      }
    } catch (error) {
      toast({ title: "Error saving pricing", variant: "destructive" });
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleDeletePricingEntry = async (pricingId: number) => {
    if (!editingPackage) return;
    
    try {
      const response = await fetch(`/api/admin/packages/${editingPackage.id}/pricing/${pricingId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        toast({ title: "Pricing entry deleted" });
        await loadPackagePricing(editingPackage.id);
      }
    } catch (error) {
      toast({ title: "Error deleting pricing", variant: "destructive" });
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingPackage) return;
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingCsv(true);
    try {
      const formData = new FormData();
      formData.append('csv', file);
      
      const response = await fetch(`/api/admin/packages/${editingPackage.id}/pricing/upload-csv`, {
        method: "POST",
        body: formData,
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({ 
          title: "CSV pricing imported successfully", 
          description: result.message || `Imported ${result.created} pricing entries from ${result.airports} airports`
        });
        console.log("CSV upload success, reloading pricing...", result);
        await loadPackagePricing(editingPackage.id);
        console.log("Pricing reloaded successfully");
      } else {
        console.error("CSV upload failed:", result);
        throw new Error(result.error || result.details || "Failed to upload CSV");
      }
    } catch (error: any) {
      toast({ 
        title: "Error uploading CSV", 
        description: error.message || "Failed to process pricing CSV",
        variant: "destructive" 
      });
    } finally {
      setIsUploadingCsv(false);
      if (csvFileRef.current) {
        csvFileRef.current.value = '';
      }
    }
  };

  const handleDownloadCsv = async () => {
    if (!editingPackage) return;
    
    setIsDownloadingCsv(true);
    try {
      const response = await fetch(`/api/admin/packages/${editingPackage.id}/pricing/download-csv`);
      
      if (!response.ok) {
        throw new Error("Failed to download CSV");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pricing-${editingPackage.slug || editingPackage.id}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "CSV downloaded successfully" });
    } catch (error: any) {
      toast({ 
        title: "Error downloading CSV", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPackage) {
      updateMutation.mutate({ id: editingPackage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Bokun tour search handler
  const handleBokunSearch = async () => {
    if (!bokunSearchQuery.trim()) {
      toast({ title: "Please enter a search term", variant: "destructive" });
      return;
    }
    
    setIsSearchingBokun(true);
    try {
      const response = await fetch(`/api/admin/packages/bokun-search?query=${encodeURIComponent(bokunSearchQuery)}`);
      if (!response.ok) {
        throw new Error("Search failed");
      }
      const data = await response.json();
      setBokunSearchResults(data.tours || []);
      if (data.tours?.length === 0) {
        toast({ title: "No tours found", description: "Try a different search term" });
      }
    } catch (error: any) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearchingBokun(false);
    }
  };

  // Import content from a Bokun tour
  const handleImportBokunTour = async (productId: string) => {
    setIsImportingBokun(true);
    try {
      const response = await fetch(`/api/admin/packages/bokun-tour/${productId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tour details");
      }
      const tourData = await response.json();
      
      // Update form with imported data
      setFormData({
        ...emptyPackage,
        bokunProductId: tourData.bokunProductId,
        title: tourData.title,
        slug: tourData.slug,
        category: tourData.category,
        price: tourData.price || 0,
        singlePrice: tourData.singlePrice || null,
        description: tourData.description,
        excerpt: tourData.excerpt,
        highlights: tourData.highlights || [],
        whatsIncluded: tourData.whatsIncluded || [],
        itinerary: tourData.itinerary || [],
        duration: tourData.duration,
        featuredImage: tourData.featuredImage,
        gallery: tourData.gallery || [],
        excluded: tourData.excluded || null,
        requirements: tourData.requirements || null,
        attention: tourData.attention || null,
      });
      
      // Store price breakdown for tooltip display
      if (tourData._rateInfo) {
        setImportedPriceBreakdown(tourData._rateInfo);
      }
      
      setBokunSearchOpen(false);
      setIsCreating(true);
      setEditingPackage(null);
      
      // Build import summary showing what was found
      const importedItems = [];
      if (tourData.itinerary?.length > 0) importedItems.push(`${tourData.itinerary.length} itinerary days`);
      if (tourData.highlights?.length > 0) importedItems.push(`${tourData.highlights.length} highlights`);
      if (tourData.whatsIncluded?.length > 0) importedItems.push(`${tourData.whatsIncluded.length} included items`);
      if (tourData.gallery?.length > 0) importedItems.push(`${tourData.gallery.length} photos`);
      
      const summaryText = importedItems.length > 0 
        ? `Imported: ${importedItems.join(', ')}. Review details and add flight pricing.`
        : `Basic info imported. You may need to add itinerary and other details manually.`;
      
      toast({ 
        title: "Tour content imported", 
        description: summaryText
      });
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImportingBokun(false);
    }
  };

  // Export pricing with Bokun net prices
  const handleExportPricingCsv = async () => {
    if (!editingPackage) return;
    
    try {
      window.location.href = `/api/admin/packages/${editingPackage.id}/pricing/export-csv`;
      toast({ title: "Downloading pricing CSV" });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    }
  };

  const handleFetchFlightPrices = async () => {
    if (!editingPackage) {
      toast({ title: "Save package first", variant: "destructive" });
      return;
    }
    
    // For manual packages without Bokun, use the package base price as land cost
    const landCostForManual = !formData.bokunProductId ? (formData.price || 0) : null;
    
    if (!flightDestAirport || flightDepartAirports.length === 0 || !flightStartDate || !flightEndDate) {
      toast({ 
        title: "Missing flight configuration", 
        description: "Please fill in destination airport, departure airports, and date range",
        variant: "destructive" 
      });
      return;
    }
    
    setIsFetchingFlightPrices(true);
    setFlightPriceResults(null);
    
    try {
      const response = await fetch("/api/admin/packages/fetch-flight-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: editingPackage.id,
          bokunProductId: formData.bokunProductId || null,
          landCostOverride: landCostForManual,  // For manual packages without Bokun
          destAirport: flightDestAirport,
          departAirports: flightDepartAirports.join("|"),
          durationNights: flightDuration,
          startDate: flightStartDate,
          endDate: flightEndDate,
          markupPercent: flightMarkup,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setFlightPriceResults(result);
        toast({ 
          title: "Flight prices fetched", 
          description: `Found ${result.pricesFound || 0} price entries. ${result.saved || 0} saved to package.` 
        });
        await loadPackagePricing(editingPackage.id);
      } else {
        throw new Error(result.error || "Failed to fetch flight prices");
      }
    } catch (error: any) {
      toast({ 
        title: "Error fetching flight prices", 
        description: error.message,
        variant: "destructive" 
      });
      setFlightPriceResults({ error: error.message });
    } finally {
      setIsFetchingFlightPrices(false);
    }
  };

  const toggleDepartAirport = (code: string) => {
    setFlightDepartAirports(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const addItineraryDay = () => {
    const nextDay = (formData.itinerary?.length || 0) + 1;
    setFormData({
      ...formData,
      itinerary: [...(formData.itinerary || []), { day: nextDay, title: "", description: "" }],
    });
  };

  const updateItineraryDay = (index: number, field: keyof ItineraryDay, value: string | number) => {
    const updated = [...(formData.itinerary || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, itinerary: updated });
  };

  const removeItineraryDay = (index: number) => {
    const updated = (formData.itinerary || []).filter((_, i) => i !== index);
    // Renumber remaining days
    const renumbered = updated.map((day, i) => ({ ...day, day: i + 1 }));
    setFormData({ ...formData, itinerary: renumbered });
  };

  const moveItineraryDayUp = (index: number) => {
    if (index === 0) return;
    const updated = [...(formData.itinerary || [])];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    // Renumber all days
    const renumbered = updated.map((day, i) => ({ ...day, day: i + 1 }));
    setFormData({ ...formData, itinerary: renumbered });
  };

  const moveItineraryDayDown = (index: number) => {
    const itinerary = formData.itinerary || [];
    if (index >= itinerary.length - 1) return;
    const updated = [...itinerary];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    // Renumber all days
    const renumbered = updated.map((day, i) => ({ ...day, day: i + 1 }));
    setFormData({ ...formData, itinerary: renumbered });
  };

  const insertItineraryDayBefore = (index: number) => {
    const itinerary = formData.itinerary || [];
    const newDay = { day: index + 1, title: "", description: "" };
    const updated = [
      ...itinerary.slice(0, index),
      newDay,
      ...itinerary.slice(index)
    ];
    // Renumber all days
    const renumbered = updated.map((day, i) => ({ ...day, day: i + 1 }));
    setFormData({ ...formData, itinerary: renumbered });
  };

  const addAccommodation = () => {
    setFormData({
      ...formData,
      accommodations: [...(formData.accommodations || []), { name: "", images: [], description: "" }],
    });
  };

  const updateAccommodation = (index: number, field: keyof Accommodation, value: string | string[]) => {
    const updated = [...(formData.accommodations || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, accommodations: updated });
  };

  const removeAccommodation = (index: number) => {
    const updated = (formData.accommodations || []).filter((_, i) => i !== index);
    setFormData({ ...formData, accommodations: updated });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingFeatured(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);
      
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formDataUpload,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setFormData({ ...formData, featuredImage: data.url });
      toast({ title: "Image uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploadingFeatured(false);
      if (featuredImageRef.current) {
        featuredImageRef.current.value = '';
      }
    }
  };

  const handleGalleryImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploadingGallery(true);
    try {
      const formDataUpload = new FormData();
      for (let i = 0; i < files.length; i++) {
        formDataUpload.append('images', files[i]);
      }
      
      const response = await fetch('/api/admin/upload-multiple', {
        method: 'POST',
        body: formDataUpload,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      const newUrls = data.images.map((img: any) => img.url);
      setFormData({ ...formData, gallery: [...(formData.gallery || []), ...newUrls] });
      toast({ title: `${data.count} image(s) uploaded successfully` });
    } catch (error) {
      toast({ title: "Failed to upload images", variant: "destructive" });
    } finally {
      setIsUploadingGallery(false);
      if (galleryImagesRef.current) {
        galleryImagesRef.current.value = '';
      }
    }
  };

  const handleMobileVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate video file
    if (!file.type.startsWith('video/')) {
      toast({ title: "Please select a video file", variant: "destructive" });
      return;
    }
    
    // Max 50MB for mobile video
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Video must be under 50MB", variant: "destructive" });
      return;
    }
    
    setIsUploadingMobileVideo(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('video', file);
      
      const response = await fetch('/api/admin/upload-video', {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setFormData({ ...formData, mobileHeroVideo: data.url });
      toast({ title: "Video uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload video", variant: "destructive" });
    } finally {
      setIsUploadingMobileVideo(false);
      if (mobileVideoRef.current) {
        mobileVideoRef.current.value = '';
      }
    }
  };

  const handleDesktopVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      toast({ title: "Please select a video file", variant: "destructive" });
      return;
    }
    
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "Video must be under 100MB", variant: "destructive" });
      return;
    }
    
    setIsUploadingDesktopVideo(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('video', file);
      
      const response = await fetch('/api/admin/upload-video', {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setFormData({ ...formData, desktopHeroVideo: data.url });
      toast({ title: "Desktop video uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload video", variant: "destructive" });
    } finally {
      setIsUploadingDesktopVideo(false);
      if (desktopVideoRef.current) {
        desktopVideoRef.current.value = '';
      }
    }
  };

  const handleHotelImagesUpload = async (hotelIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingHotelIndex(hotelIndex);
    try {
      const formDataUpload = new FormData();
      for (let i = 0; i < files.length; i++) {
        formDataUpload.append('images', files[i]);
      }
      
      const response = await fetch('/api/admin/upload-multiple', {
        method: 'POST',
        body: formDataUpload,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      const newUrls = data.images.map((img: any) => img.url);
      
      const updatedAccommodations = [...(formData.accommodations || [])];
      updatedAccommodations[hotelIndex] = {
        ...updatedAccommodations[hotelIndex],
        images: [...(updatedAccommodations[hotelIndex].images || []), ...newUrls]
      };
      setFormData({ ...formData, accommodations: updatedAccommodations });
      
      toast({ title: `${data.count} image(s) uploaded successfully` });
    } catch (error) {
      toast({ title: "Failed to upload images", variant: "destructive" });
    } finally {
      setUploadingHotelIndex(null);
      if (hotelImageRefs.current[hotelIndex]) {
        hotelImageRefs.current[hotelIndex]!.value = '';
      }
    }
  };

  const removeHotelImage = (hotelIndex: number, imageIndex: number) => {
    const updatedAccommodations = [...(formData.accommodations || [])];
    updatedAccommodations[hotelIndex] = {
      ...updatedAccommodations[hotelIndex],
      images: updatedAccommodations[hotelIndex].images.filter((_, i) => i !== imageIndex)
    };
    setFormData({ ...formData, accommodations: updatedAccommodations });
    toast({ title: "Image removed" });
  };

  const handleDragStart = (hotelIndex: number, imageIndex: number) => {
    setDraggedImageIndex({ hotelIndex, imageIndex });
  };

  const handleDragOver = (e: React.DragEvent, hotelIndex: number, imageIndex: number) => {
    e.preventDefault();
    if (draggedImageIndex?.hotelIndex === hotelIndex) {
      setDragOverImageIndex({ hotelIndex, imageIndex });
    }
  };

  const handleDragEnd = () => {
    if (draggedImageIndex && dragOverImageIndex && 
        draggedImageIndex.hotelIndex === dragOverImageIndex.hotelIndex &&
        draggedImageIndex.imageIndex !== dragOverImageIndex.imageIndex) {
      
      const hotelIndex = draggedImageIndex.hotelIndex;
      const updatedAccommodations = [...(formData.accommodations || [])];
      const images = [...updatedAccommodations[hotelIndex].images];
      
      // Remove the dragged image and insert it at the new position
      const [movedImage] = images.splice(draggedImageIndex.imageIndex, 1);
      images.splice(dragOverImageIndex.imageIndex, 0, movedImage);
      
      updatedAccommodations[hotelIndex] = {
        ...updatedAccommodations[hotelIndex],
        images
      };
      
      setFormData({ ...formData, accommodations: updatedAccommodations });
      toast({ title: "Image order updated" });
    }
    
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const handleGalleryDragStart = (imageIndex: number) => {
    setDraggedGalleryIndex(imageIndex);
  };

  const handleGalleryDragOver = (e: React.DragEvent, imageIndex: number) => {
    e.preventDefault();
    setDragOverGalleryIndex(imageIndex);
  };

  const handleGalleryDragEnd = () => {
    if (draggedGalleryIndex !== null && dragOverGalleryIndex !== null && 
        draggedGalleryIndex !== dragOverGalleryIndex) {
      
      const gallery = [...(formData.gallery || [])];
      const [movedImage] = gallery.splice(draggedGalleryIndex, 1);
      gallery.splice(dragOverGalleryIndex, 0, movedImage);
      
      setFormData({ ...formData, gallery });
      toast({ title: "Gallery order updated" });
    }
    
    setDraggedGalleryIndex(null);
    setDragOverGalleryIndex(null);
  };

  const handleVideoDragStart = (videoIndex: number) => {
    setDraggedVideoIndex(videoIndex);
  };

  const handleVideoDragOver = (e: React.DragEvent, videoIndex: number) => {
    e.preventDefault();
    setDragOverVideoIndex(videoIndex);
  };

  const handleVideoDragEnd = () => {
    if (draggedVideoIndex !== null && dragOverVideoIndex !== null && 
        draggedVideoIndex !== dragOverVideoIndex) {
      
      const videos = [...(formData.videos || [])];
      const [movedVideo] = videos.splice(draggedVideoIndex, 1);
      videos.splice(dragOverVideoIndex, 0, movedVideo);
      
      setFormData({ ...formData, videos });
      toast({ title: "Video order updated" });
    }
    
    setDraggedVideoIndex(null);
    setDragOverVideoIndex(null);
  };

  const handleAccommodationDragStart = (index: number) => {
    setDraggedAccommodationIndex(index);
  };

  const handleAccommodationDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverAccommodationIndex(index);
  };

  const handleAccommodationDragEnd = () => {
    if (draggedAccommodationIndex !== null && dragOverAccommodationIndex !== null && 
        draggedAccommodationIndex !== dragOverAccommodationIndex) {
      
      const accommodations = [...(formData.accommodations || [])];
      const [movedAccommodation] = accommodations.splice(draggedAccommodationIndex, 1);
      accommodations.splice(dragOverAccommodationIndex, 0, movedAccommodation);
      
      setFormData({ ...formData, accommodations });
      toast({ title: "Hotel order updated" });
    }
    
    setDraggedAccommodationIndex(null);
    setDragOverAccommodationIndex(null);
  };

  const isEditing = isCreating || editingPackage !== null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              <h1 className="text-xl font-semibold">Flight Packages</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search packages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search"
              />
            </div>
            <Dialog open={bokunSearchOpen} onOpenChange={setBokunSearchOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-bokun">
                  <Plane className="w-4 h-4 mr-2" />
                  Import from Bokun
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import from Bokun Land Tour</DialogTitle>
                  <DialogDescription>
                    Search for a Bokun land tour to import its content. You can then add flight pricing.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search Bokun tours (e.g., India, Safari, Maldives...)"
                      value={bokunSearchQuery}
                      onChange={(e) => setBokunSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBokunSearch()}
                      className="flex-1"
                      data-testid="input-bokun-search"
                    />
                    <Button 
                      onClick={handleBokunSearch} 
                      disabled={isSearchingBokun}
                      data-testid="button-bokun-search"
                    >
                      {isSearchingBokun ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Search
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {bokunSearchResults.length > 0 && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {bokunSearchResults.map((tour) => (
                        <div 
                          key={tour.id}
                          className="flex items-center gap-4 p-3 border rounded-lg hover-elevate cursor-pointer"
                          onClick={() => !isImportingBokun && handleImportBokunTour(tour.id)}
                          data-testid={`card-bokun-tour-${tour.id}`}
                        >
                          {tour.keyPhotoUrl && (
                            <img 
                              src={tour.keyPhotoUrl} 
                              alt={tour.title}
                              className="w-20 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{tour.title}</h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {tour.location} {tour.durationText && `• ${tour.durationText}`}
                            </p>
                            {tour.price > 0 && (
                              <p className="text-sm font-medium text-primary">
                                Bokun Net: {formatPrice(tour.price)}
                              </p>
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            disabled={isImportingBokun}
                            data-testid={`button-import-tour-${tour.id}`}
                          >
                            {isImportingBokun ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-1" />
                                Import
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {bokunSearchResults.length === 0 && bokunSearchQuery && !isSearchingBokun && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No tours found. Try a different search term.</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={scraperDialogOpen} onOpenChange={setScraperDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-scrape-test">
                  <Globe className="w-4 h-4 mr-2" />
                  Test Scraper
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Test URL Scraper</DialogTitle>
                  <DialogDescription>
                    Scrape package data from the external holidays website
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">Use URLs from holidays.flightsandpackages.com</p>
                    <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                      Example: https://holidays.flightsandpackages.com/Holidays/India/Golden-Triangle-Tour
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://holidays.flightsandpackages.com/Holidays/..."
                      value={scrapeUrl}
                      onChange={(e) => setScrapeUrl(e.target.value)}
                      className="flex-1"
                      data-testid="input-scrape-url"
                    />
                    <Button 
                      onClick={handleScrapeTest} 
                      disabled={isScraping}
                      data-testid="button-run-scrape"
                    >
                      {isScraping ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Scraping...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Test Scrape
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {scrapedData && (
                    <div className="space-y-4 border rounded-lg p-4 bg-muted/50" data-testid="scrape-results">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg flex items-center gap-2" data-testid="status-scrape-success">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          Extracted Data
                        </h3>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleImportScrapedData(false)} 
                            variant="outline"
                            disabled={isProcessingImages}
                            data-testid="button-import-scraped"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Import (Original URLs)
                          </Button>
                          <Button 
                            onClick={() => handleImportScrapedData(true)}
                            disabled={isProcessingImages}
                            data-testid="button-import-optimized"
                          >
                            {isProcessingImages ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <ImagePlus className="w-4 h-4 mr-2" />
                                Import & Optimize Images
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {scrapedData.featuredImage && (
                        <div className="flex gap-4 items-start">
                          <img 
                            src={scrapedData.featuredImage} 
                            alt="Featured" 
                            className="w-32 h-24 object-cover rounded border"
                            data-testid="img-featured-preview"
                          />
                          <div className="flex-1 space-y-2">
                            <p className="font-semibold text-lg" data-testid="text-scraped-title">{scrapedData.title}</p>
                            <div className="flex gap-4">
                              <Badge variant="secondary" data-testid="badge-scraped-category">{scrapedData.category}</Badge>
                              <span className="font-bold text-primary" data-testid="text-scraped-price">£{scrapedData.price}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {!scrapedData.featuredImage && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-muted-foreground">Title</Label>
                            <p className="font-medium" data-testid="text-scraped-title">{scrapedData.title}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Price</Label>
                            <p className="font-medium" data-testid="text-scraped-price">£{scrapedData.price}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Category</Label>
                            <p className="font-medium" data-testid="text-scraped-category">{scrapedData.category}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Slug</Label>
                            <p className="font-medium text-muted-foreground" data-testid="text-scraped-slug">{scrapedData.slug}</p>
                          </div>
                        </div>
                      )}
                      
                      <Separator />
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <Label className="text-muted-foreground">What's Included</Label>
                          <p className="font-medium" data-testid="text-included-count">{scrapedData.whatsIncluded?.length || 0} items</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Highlights</Label>
                          <p className="font-medium" data-testid="text-highlights-count">{scrapedData.highlights?.length || 0} items</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Itinerary Days</Label>
                          <p className="font-medium" data-testid="text-itinerary-count">{scrapedData.itinerary?.length || 0} days</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Accommodations</Label>
                          <p className="font-medium" data-testid="text-accommodations-count">{scrapedData.accommodations?.length || 0} hotels</p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <Label className="text-muted-foreground">Overview (preview)</Label>
                        <p className="text-sm mt-1 line-clamp-4" data-testid="text-overview-preview">{scrapedData.overview?.substring(0, 500)}...</p>
                      </div>
                      
                      {scrapedData.whatsIncluded?.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">What's Included (first 5)</Label>
                          <ul className="text-sm mt-1 list-disc list-inside space-y-1" data-testid="list-included-items">
                            {scrapedData.whatsIncluded.slice(0, 5).map((item, i) => (
                              <li key={i} className="line-clamp-1" data-testid={`text-included-item-${i}`}>{item}</li>
                            ))}
                            {scrapedData.whatsIncluded.length > 5 && (
                              <li className="text-muted-foreground">...and {scrapedData.whatsIncluded.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      
                      {scrapedData.itinerary?.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Itinerary Preview (first 3 days)</Label>
                          <div className="space-y-2 mt-2" data-testid="list-itinerary-preview">
                            {scrapedData.itinerary.slice(0, 3).map((day, i) => (
                              <div key={i} className="bg-background p-2 rounded border text-sm" data-testid={`itinerary-day-${day.day}`}>
                                <p className="font-medium">Day {day.day}: {day.title}</p>
                                <p className="text-muted-foreground text-xs line-clamp-2">{day.description?.substring(0, 150)}...</p>
                              </div>
                            ))}
                            {scrapedData.itinerary.length > 3 && (
                              <p className="text-muted-foreground text-sm">...and {scrapedData.itinerary.length - 3} more days</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {scrapedData.accommodations?.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Accommodations ({scrapedData.accommodations.length} hotels)</Label>
                          <div className="space-y-2 mt-2" data-testid="list-accommodations-preview">
                            {scrapedData.accommodations.map((hotel, i) => (
                              <div key={i} className="flex gap-3 bg-background p-2 rounded border" data-testid={`accommodation-${i}`}>
                                {hotel.images?.[0] && (
                                  <img 
                                    src={hotel.images[0]} 
                                    alt={hotel.name}
                                    className="w-16 h-16 object-cover rounded"
                                    data-testid={`img-accommodation-${i}`}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm" data-testid={`text-accommodation-name-${i}`}>{hotel.name}</p>
                                  <p className="text-muted-foreground text-xs line-clamp-2">{hotel.description?.substring(0, 100)}...</p>
                                  <p className="text-muted-foreground text-xs">{hotel.images?.length || 0} images</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {scrapedData.hotelImages?.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">All Hotel Images ({scrapedData.hotelImages.length})</Label>
                          <div className="flex gap-2 mt-2 overflow-x-auto" data-testid="gallery-hotel-images">
                            {scrapedData.hotelImages.slice(0, 5).map((img, i) => (
                              <img 
                                key={i} 
                                src={img} 
                                alt={`Hotel ${i + 1}`}
                                className="w-20 h-20 object-cover rounded border"
                                data-testid={`img-hotel-${i}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              variant="outline" 
              onClick={() => importSamplesMutation.mutate()}
              disabled={importSamplesMutation.isPending}
              data-testid="button-import-samples"
            >
              <Download className="w-4 h-4 mr-2" />
              {importSamplesMutation.isPending ? "Importing..." : "Import Samples"}
            </Button>
            <Button onClick={handleOpenCreate} data-testid="button-create">
              <Plus className="w-4 h-4 mr-2" />
              Add Package
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {isEditing ? (
          <Card>
            <CardHeader className="space-y-4">
              <Button 
                variant="ghost" 
                className="w-fit -ml-2"
                onClick={() => { setIsCreating(false); setEditingPackage(null); }}
                data-testid="button-back-to-packages"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Packages
              </Button>
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{editingPackage ? "Edit Package" : "Create New Package"}</CardTitle>
                  <CardDescription>
                    {editingPackage ? `Editing: ${editingPackage.title}` : "Fill in the details for your new package"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
                    <TabsTrigger value="accommodation">Hotels</TabsTrigger>
                    <TabsTrigger value="pricing" disabled={!editingPackage}>Pricing</TabsTrigger>
                    <TabsTrigger value="seo">SEO</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="title">Title *</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              title: e.target.value,
                              slug: formData.slug || generateSlug(e.target.value),
                            });
                          }}
                          required
                          data-testid="input-title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="slug">URL Slug *</Label>
                        <Input
                          id="slug"
                          value={formData.slug}
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                          required
                          data-testid="input-slug"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="category">Primary Destination *</Label>
                        <Input
                          id="category"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          placeholder="e.g., India, Maldives"
                          required
                          data-testid="input-category"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Used for URL routing</p>
                      </div>
                      
                      {/* Countries Section - for multi-country packages */}
                      <div className="col-span-2">
                        <Label>All Countries Covered</Label>
                        <p className="text-xs text-muted-foreground mb-2">Select all countries this package visits</p>
                        <div className="space-y-3">
                          {/* Selected countries */}
                          {formData.countries.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {formData.countries.map((country, index) => (
                                <Badge key={index} variant="default" className="flex items-center gap-1">
                                  {country}
                                  <button
                                    type="button"
                                    onClick={() => setFormData({
                                      ...formData,
                                      countries: formData.countries.filter((_, i) => i !== index)
                                    })}
                                    className="ml-1 hover:text-destructive"
                                    data-testid={`button-remove-country-${index}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Quick country buttons */}
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {COMMON_COUNTRIES.filter(c => !formData.countries.includes(c)).map((country) => (
                              <Button
                                key={country}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setFormData({
                                  ...formData,
                                  countries: [...formData.countries, country]
                                })}
                                className="h-6 text-xs px-2"
                                data-testid={`button-add-country-${country.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                + {country}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      {/* Tags Section */}
                      <div>
                        <Label>Tags</Label>
                        <div className="mt-2 space-y-3">
                          {/* Current tags */}
                          {formData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {formData.tags.map((tag, index) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => setFormData({
                                      ...formData,
                                      tags: formData.tags.filter((_, i) => i !== index)
                                    })}
                                    className="ml-1 hover:text-destructive"
                                    data-testid={`button-remove-tag-${index}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Quick tag buttons */}
                          <div className="flex flex-wrap gap-1">
                            {COMMON_TAGS.filter(tag => !formData.tags.includes(tag)).map((tag) => (
                              <Button
                                key={tag}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setFormData({
                                  ...formData,
                                  tags: [...formData.tags, tag]
                                })}
                                className="h-7 text-xs"
                                data-testid={`button-add-tag-${tag.toLowerCase().replace(' ', '-')}`}
                              >
                                + {tag}
                              </Button>
                            ))}
                          </div>
                          
                          {/* Custom tag input */}
                          <div className="flex gap-2">
                            <Input
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              placeholder="Add custom tag..."
                              className="flex-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newTag.trim()) {
                                  e.preventDefault();
                                  if (!formData.tags.includes(newTag.trim())) {
                                    setFormData({
                                      ...formData,
                                      tags: [...formData.tags, newTag.trim()]
                                    });
                                  }
                                  setNewTag("");
                                }
                              }}
                              data-testid="input-custom-tag"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
                                  setFormData({
                                    ...formData,
                                    tags: [...formData.tags, newTag.trim()]
                                  });
                                  setNewTag("");
                                }
                              }}
                              data-testid="button-add-custom-tag"
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="price">Twin Share Price (GBP) *</Label>
                          {importedPriceBreakdown && importedPriceBreakdown.doubleRoomPrice && (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5">
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80">
                                <div className="space-y-2">
                                  <h4 className="font-semibold">Bokun Rate Breakdown</h4>
                                  {importedPriceBreakdown.rates?.map((rate, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">{rate.title}</span>
                                      <span>£{rate.price.toFixed(2)}</span>
                                    </div>
                                  ))}
                                  <Separator className="my-2" />
                                  <div className="flex justify-between text-sm font-medium">
                                    <span>Double Room (Twin Share)</span>
                                    <span>£{importedPriceBreakdown.doubleRoomPrice.toFixed(2)}</span>
                                  </div>
                                  {importedPriceBreakdown.singleRoomPrice && (
                                    <div className="flex justify-between text-sm font-medium">
                                      <span>Single Room (Solo)</span>
                                      <span>£{importedPriceBreakdown.singleRoomPrice.toFixed(2)}</span>
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Prices include 10% markup on Bokun USD rate (converted at 0.75 exchange rate)
                                  </p>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">Price per person when 2 sharing</p>
                        <Input
                          id="price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                          required
                          data-testid="input-price"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="singlePrice">Solo Traveller Price (GBP)</Label>
                          {importedPriceBreakdown && importedPriceBreakdown.singleRoomPrice && (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5">
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80">
                                <div className="space-y-2">
                                  <h4 className="font-semibold">Single Room Rate</h4>
                                  <div className="flex justify-between text-sm font-medium">
                                    <span>Single Room (Solo)</span>
                                    <span>£{importedPriceBreakdown.singleRoomPrice.toFixed(2)}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Price includes 10% markup on Bokun USD rate
                                  </p>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">Price per person for single room (optional)</p>
                        <Input
                          id="singlePrice"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.singlePrice ?? ""}
                          onChange={(e) => setFormData({ ...formData, singlePrice: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="Leave blank if not applicable"
                          data-testid="input-single-price"
                        />
                      </div>
                      <div>
                        <Label htmlFor="priceLabel">Price Label</Label>
                        <p className="text-xs text-muted-foreground mb-1">Shown under price</p>
                        <Input
                          id="priceLabel"
                          value={formData.priceLabel}
                          onChange={(e) => setFormData({ ...formData, priceLabel: e.target.value })}
                          placeholder="per adult"
                          data-testid="input-price-label"
                        />
                      </div>
                      <div>
                        <Label htmlFor="pricingDisplay">Pricing Display</Label>
                        <p className="text-xs text-muted-foreground mb-1">Which prices to show</p>
                        <Select
                          value={formData.pricingDisplay}
                          onValueChange={(value: "both" | "twin" | "single") => setFormData({ ...formData, pricingDisplay: value })}
                        >
                          <SelectTrigger id="pricingDisplay" data-testid="select-pricing-display">
                            <SelectValue placeholder="Select display option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both">Show Both Prices</SelectItem>
                            <SelectItem value="twin">Twin Share Only</SelectItem>
                            <SelectItem value="single">Solo Traveller Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="duration">Duration</Label>
                        <Input
                          id="duration"
                          value={formData.duration || ""}
                          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                          placeholder="e.g., 11 Nights / 12 Days"
                          data-testid="input-duration"
                        />
                      </div>
                      <div>
                        <Label htmlFor="displayOrder">Display Order</Label>
                        <Input
                          id="displayOrder"
                          type="number"
                          value={formData.displayOrder}
                          onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                          data-testid="input-display-order"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="boardBasisOverride">Board Basis Override</Label>
                        <Input
                          id="boardBasisOverride"
                          value={formData.boardBasisOverride || ""}
                          onChange={(e) => setFormData({ ...formData, boardBasisOverride: e.target.value })}
                          placeholder="e.g., Half Board, All Inclusive"
                          data-testid="input-board-basis-override"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Leave blank to show "As per itinerary"</p>
                      </div>
                      <div>
                        <Label htmlFor="hotelOverride">Hotel Override</Label>
                        <Input
                          id="hotelOverride"
                          value={formData.hotelOverride || ""}
                          onChange={(e) => setFormData({ ...formData, hotelOverride: e.target.value })}
                          placeholder="e.g., 4-Star, Luxury Resort"
                          data-testid="input-hotel-override"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Leave blank to show hotel count</p>
                      </div>
                    </div>

                    {/* Image Guidelines Info Box */}
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4" data-testid="image-guidelines-box">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-2">
                        <ImagePlus className="w-4 h-4" />
                        Image Size Guidelines
                      </h4>
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p><strong>Featured/Hero:</strong> 1600 x 900 px (16:9) - Max 400KB</p>
                        <p><strong>Gallery:</strong> 1600 x 1067 px (3:2) - Max 350KB each</p>
                        <p><strong>Format:</strong> JPEG or WebP preferred. Landscape orientation.</p>
                        <p className="text-blue-600 dark:text-blue-300 text-xs mt-2">Tip: Keep important content centered - edges may be cropped on mobile.</p>
                      </div>
                    </div>

                    <div>
                      <Label>Featured Image (Hero)</Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Recommended: <strong>1600 x 900 px</strong> (16:9 ratio). Max 400KB. Keep important content centered.
                      </p>
                      <div className="mt-2 space-y-3">
                        <input
                          ref={featuredImageRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFeaturedImageUpload}
                          className="hidden"
                          data-testid="input-featured-image-file"
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => featuredImageRef.current?.click()}
                            disabled={isUploadingFeatured}
                            className="w-full sm:flex-1"
                            data-testid="button-upload-featured"
                          >
                            {isUploadingFeatured ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload from Computer
                              </>
                            )}
                          </Button>
                          <MediaPicker
                            onSelect={(url) => setFormData({ ...formData, featuredImage: url })}
                            destination={formData.category}
                            currentPackageId={editingPackage?.id}
                            trigger={
                              <Button type="button" variant="secondary" className="w-full sm:flex-1" data-testid="button-media-picker-featured">
                                <ImagePlus className="w-4 h-4 mr-2" />
                                Browse Library / Stock
                              </Button>
                            }
                          />
                          {formData.featuredImage && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setFormData({ ...formData, featuredImage: "" })}
                              data-testid="button-remove-featured"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {formData.featuredImage && (
                          <div className="relative">
                            <img src={formData.featuredImage} alt="Featured" className="h-40 w-auto rounded-md object-cover" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Gallery Images</Label>
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 mt-2 mb-3">
                        <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                          <ImagePlus className="w-3 h-3 flex-shrink-0" />
                          <span><strong>1600×1067px</strong> (3:2 ratio) • JPEG/WebP • Max 350KB each</span>
                        </p>
                      </div>
                      <div className="space-y-3">
                        <input
                          ref={galleryImagesRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryImagesUpload}
                          className="hidden"
                          data-testid="input-gallery-files"
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => galleryImagesRef.current?.click()}
                            disabled={isUploadingGallery}
                            className="w-full sm:flex-1"
                            data-testid="button-upload-gallery"
                          >
                            {isUploadingGallery ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <ImagePlus className="w-4 h-4 mr-2" />
                                Upload from Computer
                              </>
                            )}
                          </Button>
                          <MediaPicker
                            multiple
                            destination={formData.category}
                            currentPackageId={editingPackage?.id}
                            onSelect={(url) => {
                              const existingGallery = formData.gallery || [];
                              if (!existingGallery.includes(url)) {
                                setFormData({ ...formData, gallery: [...existingGallery, url] });
                              }
                            }}
                            onSelectMultiple={(urls) => {
                              const existingGallery = formData.gallery || [];
                              const newUrls = urls.filter(url => !existingGallery.includes(url));
                              if (newUrls.length > 0) {
                                setFormData({ ...formData, gallery: [...existingGallery, ...newUrls] });
                              }
                            }}
                            trigger={
                              <Button type="button" variant="secondary" className="w-full sm:flex-1" data-testid="button-media-picker-gallery">
                                <ImagePlus className="w-4 h-4 mr-2" />
                                Browse Library / Stock
                              </Button>
                            }
                          />
                        </div>
                        {(formData.gallery || []).length > 0 && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <GripVertical className="w-3 h-3" />
                            Drag images to reorder. First image appears first in gallery.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {(formData.gallery || []).map((url, i) => (
                            <div 
                              key={i} 
                              className={`relative group cursor-move transition-all ${
                                draggedGalleryIndex === i ? 'opacity-50 scale-95' : ''
                              } ${
                                dragOverGalleryIndex === i ? 'ring-2 ring-primary ring-offset-2' : ''
                              }`}
                              draggable
                              onDragStart={() => handleGalleryDragStart(i)}
                              onDragOver={(e) => handleGalleryDragOver(e, i)}
                              onDragEnd={handleGalleryDragEnd}
                              data-testid={`gallery-image-draggable-${i}`}
                            >
                              <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <GripVertical className="w-3 h-3" />
                              </div>
                              <img src={url} alt="" className="h-20 w-28 object-cover rounded-md" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, gallery: (formData.gallery || []).filter((_, idx) => idx !== i) }); }}
                                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                data-testid={`button-remove-gallery-${i}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        {(formData.gallery || []).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No gallery images yet. Click to upload.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Mobile Hero Video (Optional)</Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Upload a short video to display as the hero background on mobile devices. Max <strong>50MB</strong>. MP4 format recommended.
                      </p>
                      <div className="mt-2 space-y-3">
                        <input
                          ref={mobileVideoRef}
                          type="file"
                          accept="video/*"
                          onChange={handleMobileVideoUpload}
                          className="hidden"
                          data-testid="input-mobile-video-file"
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => mobileVideoRef.current?.click()}
                            disabled={isUploadingMobileVideo}
                            className="w-full sm:flex-1"
                            data-testid="button-upload-mobile-video"
                          >
                            {isUploadingMobileVideo ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading Video...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Mobile Video
                              </>
                            )}
                          </Button>
                          {formData.mobileHeroVideo && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setFormData({ ...formData, mobileHeroVideo: "" })}
                              data-testid="button-remove-mobile-video"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {formData.mobileHeroVideo && (
                          <div className="relative">
                            <video 
                              src={formData.mobileHeroVideo} 
                              className="h-40 w-auto rounded-md object-cover"
                              controls
                              muted
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Desktop Hero Video (Optional)</Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Upload a video to display as the hero background on desktop devices. Max <strong>100MB</strong>. MP4 format recommended.
                      </p>
                      <div className="mt-2 space-y-3">
                        <input
                          ref={desktopVideoRef}
                          type="file"
                          accept="video/*"
                          onChange={handleDesktopVideoUpload}
                          className="hidden"
                          data-testid="input-desktop-video-file"
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => desktopVideoRef.current?.click()}
                            disabled={isUploadingDesktopVideo}
                            className="w-full sm:flex-1"
                            data-testid="button-upload-desktop-video"
                          >
                            {isUploadingDesktopVideo ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Uploading Video...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Desktop Video
                              </>
                            )}
                          </Button>
                          {formData.desktopHeroVideo && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setFormData({ ...formData, desktopHeroVideo: "" })}
                              data-testid="button-remove-desktop-video"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {formData.desktopHeroVideo && (
                          <div className="relative">
                            <video 
                              src={formData.desktopHeroVideo} 
                              className="h-40 w-auto rounded-md object-cover"
                              controls
                              muted
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Gallery Videos</Label>
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 mt-2 mb-3">
                        <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                          <Globe className="w-3 h-3 flex-shrink-0" />
                          <span>Paste a <strong>YouTube</strong> or <strong>Vimeo</strong> link. Videos appear in gallery with play button.</span>
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                            value={newVideoUrl}
                            onChange={(e) => setNewVideoUrl(e.target.value)}
                            data-testid="input-video-url"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (!newVideoUrl.trim()) {
                                toast({ title: "Please enter a video URL", variant: "destructive" });
                                return;
                              }
                              const parsed = parseVideoUrl(newVideoUrl.trim());
                              if (!parsed) {
                                toast({ 
                                  title: "Invalid video URL", 
                                  description: "Please paste a valid YouTube or Vimeo link",
                                  variant: "destructive" 
                                });
                                return;
                              }
                              const newVideo: VideoItem = {
                                url: newVideoUrl.trim(),
                                platform: parsed.platform,
                                videoId: parsed.videoId,
                              };
                              setFormData({ ...formData, videos: [...(formData.videos || []), newVideo] });
                              setNewVideoUrl("");
                              toast({ title: "Video added to gallery" });
                            }}
                            data-testid="button-add-video"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        {(formData.videos || []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(formData.videos || []).map((video, i) => (
                              <div 
                                key={i} 
                                className={`relative group cursor-move transition-all ${
                                  draggedVideoIndex === i ? 'opacity-50 scale-95' : ''
                                } ${
                                  dragOverVideoIndex === i ? 'ring-2 ring-primary ring-offset-2' : ''
                                }`}
                                draggable
                                onDragStart={() => handleVideoDragStart(i)}
                                onDragOver={(e) => handleVideoDragOver(e, i)}
                                onDragEnd={handleVideoDragEnd}
                                data-testid={`video-item-${i}`}
                              >
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                  <GripVertical className="w-3 h-3" />
                                </div>
                                <div className="relative h-20 w-28 rounded-md overflow-hidden border pointer-events-none">
                                  <img 
                                    src={getVideoThumbnail(video)} 
                                    alt={video.title || `Video ${i + 1}`} 
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                  />
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                                      <div className="w-0 h-0 border-l-[10px] border-l-red-600 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-1" />
                                    </div>
                                  </div>
                                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1 rounded">
                                    {video.platform === 'youtube' ? 'YouTube' : 'Vimeo'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData({ 
                                      ...formData, 
                                      videos: (formData.videos || []).filter((_, idx) => idx !== i) 
                                    });
                                  }}
                                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-20"
                                  data-testid={`button-remove-video-${i}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {(formData.videos || []).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No videos yet. Paste a YouTube or Vimeo link above.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="isPublished"
                          checked={formData.isPublished}
                          onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                          data-testid="switch-published"
                        />
                        <Label htmlFor="isPublished">Published</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="isSpecialOffer"
                          checked={formData.isSpecialOffer}
                          onCheckedChange={(checked) => setFormData({ ...formData, isSpecialOffer: checked })}
                          data-testid="switch-special-offer"
                        />
                        <Label htmlFor="isSpecialOffer" className="flex items-center gap-1">
                          <span className="text-amber-600">★</span> Special Offer
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="isUnlisted"
                          checked={formData.isUnlisted}
                          onCheckedChange={(checked) => setFormData({ ...formData, isUnlisted: checked })}
                          data-testid="switch-unlisted"
                        />
                        <Label htmlFor="isUnlisted" className="flex items-center gap-1">
                          <span className="text-muted-foreground">👁</span> Unlisted (hidden from listings)
                        </Label>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="content" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="excerpt">Short Description (Excerpt)</Label>
                      <Textarea
                        id="excerpt"
                        value={formData.excerpt || ""}
                        onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                        placeholder="Brief summary for cards..."
                        rows={2}
                        data-testid="input-excerpt"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Full Description (HTML) *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="<p>Detailed description...</p>"
                        rows={8}
                        required
                        data-testid="input-description"
                      />
                    </div>

                    <div>
                      <Label>Highlights</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newHighlight}
                          onChange={(e) => setNewHighlight(e.target.value)}
                          placeholder="Add a highlight..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newHighlight) {
                              e.preventDefault();
                              setFormData({ ...formData, highlights: [...(formData.highlights || []), newHighlight] });
                              setNewHighlight("");
                            }
                          }}
                          data-testid="input-highlight"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (newHighlight) {
                              setFormData({ ...formData, highlights: [...(formData.highlights || []), newHighlight] });
                              setNewHighlight("");
                            }
                          }}
                          data-testid="button-add-highlight"
                        >
                          Add
                        </Button>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {(formData.highlights || []).map((item, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 bg-muted px-3 py-1.5 rounded-md text-sm">
                            {editingHighlightIndex === i ? (
                              <Input
                                value={editingHighlightValue}
                                onChange={(e) => setEditingHighlightValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const updated = [...(formData.highlights || [])];
                                    updated[i] = editingHighlightValue;
                                    setFormData({ ...formData, highlights: updated });
                                    setEditingHighlightIndex(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingHighlightIndex(null);
                                  }
                                }}
                                onBlur={() => {
                                  const updated = [...(formData.highlights || [])];
                                  updated[i] = editingHighlightValue;
                                  setFormData({ ...formData, highlights: updated });
                                  setEditingHighlightIndex(null);
                                }}
                                autoFocus
                                className="h-7 flex-1"
                                data-testid={`input-edit-highlight-${i}`}
                              />
                            ) : (
                              <span 
                                className="flex-1 cursor-pointer hover:text-primary"
                                onClick={() => {
                                  setEditingHighlightIndex(i);
                                  setEditingHighlightValue(item);
                                }}
                                data-testid={`text-highlight-${i}`}
                              >
                                {item}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingHighlightIndex(i);
                                  setEditingHighlightValue(item);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                data-testid={`button-edit-highlight-${i}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, highlights: (formData.highlights || []).filter((_, idx) => idx !== i) })}
                                className="text-destructive hover:text-destructive/80"
                                data-testid={`button-remove-highlight-${i}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <Label>What's Included</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newIncluded}
                          onChange={(e) => setNewIncluded(e.target.value)}
                          placeholder="Add item..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newIncluded) {
                              e.preventDefault();
                              setFormData({ ...formData, whatsIncluded: [...(formData.whatsIncluded || []), newIncluded] });
                              setNewIncluded("");
                            }
                          }}
                          data-testid="input-included"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (newIncluded) {
                              setFormData({ ...formData, whatsIncluded: [...(formData.whatsIncluded || []), newIncluded] });
                              setNewIncluded("");
                            }
                          }}
                          data-testid="button-add-included"
                        >
                          Add
                        </Button>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {(formData.whatsIncluded || []).map((item, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 bg-muted px-3 py-1.5 rounded-md text-sm">
                            {editingIncludedIndex === i ? (
                              <Input
                                value={editingIncludedValue}
                                onChange={(e) => setEditingIncludedValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const updated = [...(formData.whatsIncluded || [])];
                                    updated[i] = editingIncludedValue;
                                    setFormData({ ...formData, whatsIncluded: updated });
                                    setEditingIncludedIndex(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingIncludedIndex(null);
                                  }
                                }}
                                onBlur={() => {
                                  const updated = [...(formData.whatsIncluded || [])];
                                  updated[i] = editingIncludedValue;
                                  setFormData({ ...formData, whatsIncluded: updated });
                                  setEditingIncludedIndex(null);
                                }}
                                autoFocus
                                className="h-7 flex-1"
                                data-testid={`input-edit-included-${i}`}
                              />
                            ) : (
                              <span 
                                className="flex-1 cursor-pointer hover:text-primary"
                                onClick={() => {
                                  setEditingIncludedIndex(i);
                                  setEditingIncludedValue(item);
                                }}
                                data-testid={`text-included-${i}`}
                              >
                                {item}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIncludedIndex(i);
                                  setEditingIncludedValue(item);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                data-testid={`button-edit-included-${i}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, whatsIncluded: (formData.whatsIncluded || []).filter((_, idx) => idx !== i) })}
                                className="text-destructive hover:text-destructive/80"
                                data-testid={`button-remove-included-${i}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <Label>What's Not Included (Custom)</Label>
                      <p className="text-xs text-muted-foreground mb-1">
                        Customize the "What's Not Included" section for this package. If empty, default items will be shown.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newExclusion}
                          onChange={(e) => setNewExclusion(e.target.value)}
                          placeholder="Add exclusion item..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newExclusion) {
                              e.preventDefault();
                              setFormData({ ...formData, customExclusions: [...(formData.customExclusions || []), newExclusion] });
                              setNewExclusion("");
                            }
                          }}
                          data-testid="input-exclusion"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (newExclusion) {
                              setFormData({ ...formData, customExclusions: [...(formData.customExclusions || []), newExclusion] });
                              setNewExclusion("");
                            }
                          }}
                          data-testid="button-add-exclusion"
                        >
                          Add
                        </Button>
                      </div>
                      {(formData.customExclusions || []).length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Using default exclusions: Local city/tourist tax, Visa fees, Travel insurance, Tips and gratuities, Personal expenses, Anything else not in What's Included
                        </p>
                      )}
                      <ul className="mt-2 space-y-1">
                        {(formData.customExclusions || []).map((item, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-md text-sm">
                            {editingExclusionIndex === i ? (
                              <Input
                                value={editingExclusionValue}
                                onChange={(e) => setEditingExclusionValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const updated = [...(formData.customExclusions || [])];
                                    updated[i] = editingExclusionValue;
                                    setFormData({ ...formData, customExclusions: updated });
                                    setEditingExclusionIndex(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingExclusionIndex(null);
                                  }
                                }}
                                onBlur={() => {
                                  const updated = [...(formData.customExclusions || [])];
                                  updated[i] = editingExclusionValue;
                                  setFormData({ ...formData, customExclusions: updated });
                                  setEditingExclusionIndex(null);
                                }}
                                autoFocus
                                className="h-7 flex-1"
                                data-testid={`input-edit-exclusion-${i}`}
                              />
                            ) : (
                              <span 
                                className="flex-1 cursor-pointer hover:text-primary"
                                onClick={() => {
                                  setEditingExclusionIndex(i);
                                  setEditingExclusionValue(item);
                                }}
                                data-testid={`text-exclusion-${i}`}
                              >
                                {item}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExclusionIndex(i);
                                  setEditingExclusionValue(item);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                data-testid={`button-edit-exclusion-${i}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, customExclusions: (formData.customExclusions || []).filter((_, idx) => idx !== i) })}
                                className="text-destructive hover:text-destructive/80"
                                data-testid={`button-remove-exclusion-${i}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {(formData.customExclusions || []).length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => setFormData({ ...formData, customExclusions: [] })}
                          data-testid="button-reset-exclusions"
                        >
                          Reset to Defaults
                        </Button>
                      )}
                    </div>

                    <Separator className="my-4" />
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">City Tax Configuration</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      Specify which cities guests will stay in and for how many nights. This calculates the local city tax shown as "Pay Locally".
                    </p>
                    <div className="space-y-2">
                      {cityTaxes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No city taxes configured. <Link href="/admin/city-taxes" className="text-primary underline">Add city taxes</Link> first.
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={selectedCityTax}
                              onChange={(e) => setSelectedCityTax(e.target.value)}
                              className="flex-1 min-w-[150px] p-2 border rounded-md bg-background text-sm"
                              data-testid="select-city-tax"
                            >
                              <option value="">Select a city...</option>
                              {cityTaxes
                                .filter(tax => !(formData.cityTaxConfig || []).find(c => c.city.toLowerCase() === tax.cityName.toLowerCase()))
                                .map(tax => (
                                  <option key={tax.id} value={tax.cityName}>
                                    {tax.cityName} {tax.pricingType === 'star_rating' ? '(by star)' : `(${tax.currency} ${tax.taxPerNightPerPerson}/night)`}
                                  </option>
                                ))
                              }
                            </select>
                            <Input
                              type="number"
                              min="1"
                              value={cityTaxNights}
                              onChange={(e) => setCityTaxNights(parseInt(e.target.value) || 1)}
                              className="w-20"
                              placeholder="Nights"
                              data-testid="input-city-tax-nights"
                            />
                            {(() => {
                              const selectedTaxInfo = cityTaxes.find(t => t.cityName === selectedCityTax);
                              if (selectedTaxInfo?.pricingType === 'star_rating') {
                                return (
                                  <select
                                    value={cityTaxStarRating}
                                    onChange={(e) => setCityTaxStarRating(parseInt(e.target.value))}
                                    className="w-24 p-2 border rounded-md bg-background text-sm"
                                    data-testid="select-city-tax-star"
                                  >
                                    <option value={3}>3★</option>
                                    <option value={4}>4★</option>
                                    <option value={5}>5★</option>
                                  </select>
                                );
                              }
                              return null;
                            })()}
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                if (selectedCityTax) {
                                  const selectedTaxInfo = cityTaxes.find(t => t.cityName === selectedCityTax);
                                  const newEntry: { city: string; nights: number; starRating?: number } = {
                                    city: selectedCityTax,
                                    nights: cityTaxNights,
                                  };
                                  if (selectedTaxInfo?.pricingType === 'star_rating') {
                                    newEntry.starRating = cityTaxStarRating;
                                  }
                                  setFormData({
                                    ...formData,
                                    cityTaxConfig: [...(formData.cityTaxConfig || []), newEntry]
                                  });
                                  setSelectedCityTax("");
                                  setCityTaxNights(1);
                                  setCityTaxStarRating(4);
                                }
                              }}
                              data-testid="button-add-city-tax"
                            >
                              Add
                            </Button>
                          </div>
                          {(formData.cityTaxConfig || []).length > 0 && (
                            <div className="space-y-1">
                              {(formData.cityTaxConfig || []).map((config, i) => {
                                const taxInfo = cityTaxes.find(t => t.cityName.toLowerCase() === config.city.toLowerCase());
                                const taxRate = taxInfo ? getCityTaxRate(taxInfo, config.starRating) : 0;
                                const taxPerPerson = config.nights * taxRate;
                                const isStarRatingBased = taxInfo?.pricingType === 'star_rating';
                                return (
                                  <div key={i} className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">{config.city}</span>
                                      {isStarRatingBased && (
                                        <select
                                          value={config.starRating || 4}
                                          onChange={(e) => {
                                            const updated = [...(formData.cityTaxConfig || [])];
                                            updated[i] = { ...updated[i], starRating: parseInt(e.target.value) };
                                            setFormData({ ...formData, cityTaxConfig: updated });
                                          }}
                                          className="w-16 h-7 text-center border rounded bg-background text-sm"
                                          data-testid={`select-star-rating-${i}`}
                                        >
                                          <option value={3}>3★</option>
                                          <option value={4}>4★</option>
                                          <option value={5}>5★</option>
                                        </select>
                                      )}
                                      <span className="text-muted-foreground">×</span>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={config.nights}
                                        className="w-16 h-7 text-center"
                                        onChange={(e) => {
                                          const updated = [...(formData.cityTaxConfig || [])];
                                          updated[i] = { ...updated[i], nights: parseInt(e.target.value) || 1 };
                                          setFormData({ ...formData, cityTaxConfig: updated });
                                        }}
                                        data-testid={`input-city-nights-${i}`}
                                      />
                                      <span className="text-muted-foreground">nights</span>
                                      {taxInfo && (
                                        <span className="text-xs text-muted-foreground">
                                          @ {taxInfo.currency} {taxRate.toFixed(2)} = {taxInfo.currency} {taxPerPerson.toFixed(2)}/person
                                        </span>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          cityTaxConfig: (formData.cityTaxConfig || []).filter((_, idx) => idx !== i)
                                        });
                                      }}
                                      data-testid={`button-remove-city-tax-${i}`}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                );
                              })}
                              {(() => {
                                const totalTax = (formData.cityTaxConfig || []).reduce((sum, config) => {
                                  const taxInfo = cityTaxes.find(t => t.cityName.toLowerCase() === config.city.toLowerCase());
                                  const rate = taxInfo ? getCityTaxRate(taxInfo, config.starRating) : 0;
                                  return sum + (config.nights * rate);
                                }, 0);
                                const currency = cityTaxes[0]?.currency || "EUR";
                                return totalTax > 0 ? (
                                  <div className="flex justify-end text-sm font-medium text-amber-700 dark:text-amber-400">
                                    Total city tax: {currency} {totalTax.toFixed(2)}/person
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <Separator className="my-4" />
                    
                    {/* Additional Local Charges */}
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Additional Local Charges</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Add any other charges paid locally (port charges, resort fees, etc.) - enter in foreign currency
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label htmlFor="additionalChargeName" className="text-xs">Charge Name</Label>
                          <Input
                            id="additionalChargeName"
                            value={formData.additionalChargeName || ""}
                            onChange={(e) => setFormData({ ...formData, additionalChargeName: e.target.value })}
                            placeholder="e.g., Port Charges"
                            data-testid="input-additional-charge-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="additionalChargeCurrency" className="text-xs">Currency</Label>
                          <select
                            id="additionalChargeCurrency"
                            value={formData.additionalChargeCurrency || "EUR"}
                            onChange={(e) => setFormData({ ...formData, additionalChargeCurrency: e.target.value })}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            data-testid="select-additional-charge-currency"
                          >
                            <option value="EUR">EUR (€)</option>
                            <option value="USD">USD ($)</option>
                            <option value="HRK">HRK (kn)</option>
                            <option value="CZK">CZK (Kč)</option>
                            <option value="PLN">PLN (zł)</option>
                            <option value="HUF">HUF (Ft)</option>
                            <option value="CHF">CHF (Fr)</option>
                            <option value="NOK">NOK (kr)</option>
                            <option value="SEK">SEK (kr)</option>
                            <option value="DKK">DKK (kr)</option>
                            <option value="TRY">TRY (₺)</option>
                            <option value="AED">AED (د.إ)</option>
                            <option value="THB">THB (฿)</option>
                            <option value="INR">INR (₹)</option>
                            <option value="JPY">JPY (¥)</option>
                            <option value="AUD">AUD ($)</option>
                            <option value="NZD">NZD ($)</option>
                            <option value="ZAR">ZAR (R)</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="additionalChargeForeignAmount" className="text-xs">Amount (per person)</Label>
                          <Input
                            id="additionalChargeForeignAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.additionalChargeForeignAmount || ""}
                            onChange={(e) => setFormData({ ...formData, additionalChargeForeignAmount: e.target.value })}
                            placeholder="0.00"
                            data-testid="input-additional-charge-foreign-amount"
                          />
                        </div>
                        <div>
                          <Label htmlFor="additionalChargeExchangeRate" className="text-xs">{formData.additionalChargeCurrency || "EUR"} → GBP Rate</Label>
                          <Input
                            id="additionalChargeExchangeRate"
                            type="number"
                            step="0.0001"
                            min="0"
                            value={formData.additionalChargeExchangeRate || "0.84"}
                            onChange={(e) => setFormData({ ...formData, additionalChargeExchangeRate: e.target.value })}
                            placeholder="0.84"
                            data-testid="input-additional-charge-exchange-rate"
                          />
                        </div>
                      </div>
                      {formData.additionalChargeName && formData.additionalChargeForeignAmount && parseFloat(formData.additionalChargeForeignAmount) > 0 && (
                        <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-md">
                          {formData.additionalChargeName}: £{(parseFloat(formData.additionalChargeForeignAmount) * parseFloat(formData.additionalChargeExchangeRate || "0.84")).toFixed(2)} per person ({formData.additionalChargeCurrency || "EUR"} {parseFloat(formData.additionalChargeForeignAmount).toFixed(2)} @ {parseFloat(formData.additionalChargeExchangeRate || "0.84").toFixed(2)}) paid locally
                        </div>
                      )}
                    </div>

                    <Separator className="my-4" />
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">Additional Tour Information (from Bokun)</h4>
                    
                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="excluded">What's Not Included (HTML)</Label>
                        <p className="text-xs text-muted-foreground mb-1">Items/services NOT included in the package</p>
                        <Textarea
                          id="excluded"
                          value={formData.excluded || ""}
                          onChange={(e) => setFormData({ ...formData, excluded: e.target.value || null })}
                          placeholder="Flights, travel insurance, personal expenses..."
                          rows={4}
                          data-testid="input-excluded"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="requirements">What to Bring (HTML)</Label>
                        <p className="text-xs text-muted-foreground mb-1">Items guests should bring</p>
                        <Textarea
                          id="requirements"
                          value={formData.requirements || ""}
                          onChange={(e) => setFormData({ ...formData, requirements: e.target.value || null })}
                          placeholder="Passport, comfortable walking shoes, sun protection..."
                          rows={4}
                          data-testid="input-requirements"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="attention">Please Note (HTML)</Label>
                        <p className="text-xs text-muted-foreground mb-1">Important information guests should be aware of</p>
                        <Textarea
                          id="attention"
                          value={formData.attention || ""}
                          onChange={(e) => setFormData({ ...formData, attention: e.target.value || null })}
                          placeholder="Physical fitness required, not suitable for children under 5..."
                          rows={4}
                          data-testid="input-attention"
                        />
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div>
                      <Label htmlFor="otherInfo">Other Information (HTML)</Label>
                      <Textarea
                        id="otherInfo"
                        value={formData.otherInfo || ""}
                        onChange={(e) => setFormData({ ...formData, otherInfo: e.target.value })}
                        placeholder="Terms, conditions, visa info..."
                        rows={6}
                        data-testid="input-other-info"
                      />
                    </div>

                    <Separator className="my-4" />

                    <div>
                      <Label htmlFor="review">Customer Review (HTML)</Label>
                      <p className="text-xs text-muted-foreground mb-1">Customer testimonial to display in Reviews tab. Leave empty to hide the Reviews tab.</p>
                      <Textarea
                        id="review"
                        value={formData.review || ""}
                        onChange={(e) => setFormData({ ...formData, review: e.target.value || null })}
                        placeholder="Customer testimonial or review..."
                        rows={6}
                        data-testid="input-review"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="itinerary" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label>Day-by-Day Itinerary</Label>
                      <Button type="button" variant="outline" onClick={addItineraryDay} data-testid="button-add-day">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Day
                      </Button>
                    </div>
                    {(formData.itinerary || []).length > 1 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ChevronUp className="w-3 h-3" />
                        <ChevronDown className="w-3 h-3" />
                        Use arrows to reorder days. Use + to insert a new day before.
                      </p>
                    )}
                    {(formData.itinerary || []).map((day, index) => (
                      <Card key={index}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => moveItineraryDayUp(index)}
                                  disabled={index === 0}
                                  data-testid={`button-move-day-up-${index}`}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => moveItineraryDayDown(index)}
                                  disabled={index === (formData.itinerary?.length || 0) - 1}
                                  data-testid={`button-move-day-down-${index}`}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </div>
                              <Badge variant="outline">Day {day.day}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => insertItineraryDayBefore(index)}
                                title="Insert day before"
                                data-testid={`button-insert-day-before-${index}`}
                              >
                                <PlusCircle className="w-4 h-4 text-primary" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItineraryDay(index)}
                                data-testid={`button-remove-day-${index}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Input
                            value={day.title}
                            onChange={(e) => updateItineraryDay(index, 'title', e.target.value)}
                            placeholder="Day title..."
                            data-testid={`input-day-title-${index}`}
                          />
                          <Textarea
                            value={day.description}
                            onChange={(e) => updateItineraryDay(index, 'description', e.target.value)}
                            placeholder="Day description..."
                            rows={3}
                            data-testid={`input-day-description-${index}`}
                          />
                        </CardContent>
                      </Card>
                    ))}
                    {(formData.itinerary || []).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No itinerary days added yet</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="accommodation" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Label>Accommodations</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => setHotelPickerOpen(true)} data-testid="button-import-from-library">
                          <Download className="w-4 h-4 mr-2" />
                          Import from Library
                        </Button>
                        <Button type="button" variant="outline" onClick={addAccommodation} data-testid="button-add-hotel">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Manual
                        </Button>
                      </div>
                    </div>
                    {(formData.accommodations || []).length > 1 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <GripVertical className="w-3 h-3" />
                        Drag hotels to reorder. First hotel appears first on the package page.
                      </p>
                    )}
                    {(formData.accommodations || []).map((hotel, index) => (
                      <Card 
                        key={index}
                        className={`cursor-move transition-all ${
                          draggedAccommodationIndex === index ? 'opacity-50 scale-[0.98]' : ''
                        } ${
                          dragOverAccommodationIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''
                        }`}
                        draggable
                        onDragStart={() => handleAccommodationDragStart(index)}
                        onDragOver={(e) => handleAccommodationDragOver(e, index)}
                        onDragEnd={handleAccommodationDragEnd}
                        data-testid={`card-hotel-draggable-${index}`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                              <CardTitle className="text-base">{hotel.name || `Hotel ${index + 1}`}</CardTitle>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAccommodation(index)}
                              data-testid={`button-remove-hotel-${index}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Input
                            value={hotel.name}
                            onChange={(e) => updateAccommodation(index, 'name', e.target.value)}
                            placeholder="Hotel name..."
                            data-testid={`input-hotel-name-${index}`}
                          />
                          <Textarea
                            value={hotel.description}
                            onChange={(e) => updateAccommodation(index, 'description', e.target.value)}
                            placeholder="Hotel description..."
                            rows={2}
                            data-testid={`input-hotel-description-${index}`}
                          />
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm">Hotel Images</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  ref={(el) => hotelImageRefs.current[index] = el}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => handleHotelImagesUpload(index, e)}
                                  data-testid={`input-hotel-images-file-${index}`}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => hotelImageRefs.current[index]?.click()}
                                  disabled={uploadingHotelIndex === index}
                                  data-testid={`button-upload-hotel-images-${index}`}
                                >
                                  {uploadingHotelIndex === index ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <ImagePlus className="w-4 h-4 mr-2" />
                                      Add Images
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 mb-3">
                              <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                <ImagePlus className="w-3 h-3 flex-shrink-0" />
                                <span><strong>1600×1067px</strong> (3:2 ratio) • JPEG/WebP • Max 350KB each</span>
                              </p>
                            </div>
                            {(hotel.images || []).length > 0 ? (
                              <>
                                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                  <GripVertical className="w-3 h-3" />
                                  Drag images to reorder. First image is the main photo.
                                </p>
                                <div className="grid grid-cols-4 gap-2">
                                  {(hotel.images || []).map((img, imgIdx) => (
                                    <div 
                                      key={imgIdx} 
                                      className={`relative group cursor-move transition-all ${
                                        draggedImageIndex?.hotelIndex === index && draggedImageIndex?.imageIndex === imgIdx 
                                          ? 'opacity-50 scale-95' 
                                          : ''
                                      } ${
                                        dragOverImageIndex?.hotelIndex === index && dragOverImageIndex?.imageIndex === imgIdx 
                                          ? 'ring-2 ring-primary ring-offset-2' 
                                          : ''
                                      }`}
                                      draggable
                                      onDragStart={() => handleDragStart(index, imgIdx)}
                                      onDragOver={(e) => handleDragOver(e, index, imgIdx)}
                                      onDragEnd={handleDragEnd}
                                      data-testid={`hotel-image-draggable-${index}-${imgIdx}`}
                                    >
                                      {imgIdx === 0 && (
                                        <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium z-10">
                                          Main
                                        </span>
                                      )}
                                      <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <GripVertical className="w-3 h-3" />
                                      </div>
                                      <img 
                                        src={img} 
                                        alt={`${hotel.name} image ${imgIdx + 1}`} 
                                        className="h-20 w-full object-cover rounded border"
                                      />
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); removeHotelImage(index, imgIdx); }}
                                        data-testid={`button-remove-hotel-image-${index}-${imgIdx}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className="border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground">
                                <ImagePlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No images yet. Click "Add Images" to upload.</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {(formData.accommodations || []).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No accommodations added yet</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="pricing" className="space-y-6 mt-4">
                    {!editingPackage ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Save the package first to add pricing</p>
                      </div>
                    ) : (
                      <>
                        {/* Pricing Module Selector */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Pricing Module</CardTitle>
                            <CardDescription>
                              Choose how pricing is generated for this package
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant={formData.pricingModule === "manual" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormData({ ...formData, pricingModule: "manual" })}
                                data-testid="button-module-manual"
                              >
                                Manual Pricing
                              </Button>
                              <Button
                                type="button"
                                variant={formData.pricingModule === "open_jaw_seasonal" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormData({ ...formData, pricingModule: "open_jaw_seasonal" })}
                                data-testid="button-module-openjaw"
                              >
                                Open-Jaw + Seasonal Land Cost
                              </Button>
                              {formData.bokunProductId && (
                                <Button
                                  type="button"
                                  variant={formData.pricingModule === "bokun_departures" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setFormData({ ...formData, pricingModule: "bokun_departures" })}
                                  data-testid="button-module-bokun-departures"
                                >
                                  Bokun Departures + Flights
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant={formData.pricingModule === "flights_hotels_api" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormData({ ...formData, pricingModule: "flights_hotels_api" })}
                                data-testid="button-module-flights-hotels"
                              >
                                Flight + Hotel API
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formData.pricingModule === "manual" && "Enter prices manually per departure airport and date"}
                              {formData.pricingModule === "open_jaw_seasonal" && "Define seasonal land costs, then fetch flight prices from your chosen API"}
                              {formData.pricingModule === "bokun_departures" && "Sync actual departure dates from Bokun, then add flight costs to each"}
                              {formData.pricingModule === "flights_hotels_api" && "Combine flight + hotel pricing for multi-city itineraries with specific hotels"}
                            </p>
                          </CardContent>
                        </Card>
                        
                        {/* Manual Pricing Module */}
                        {formData.pricingModule === "manual" && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Manual Pricing
                              </CardTitle>
                              <CardDescription>
                                Add prices per departure airport and date
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label>Departure Airport</Label>
                                  <select
                                    value={pricingAirport}
                                    onChange={(e) => setPricingAirport(e.target.value)}
                                    className="w-full mt-1 p-2 border rounded-md bg-background"
                                    data-testid="select-airport-manual"
                                  >
                                    <option value="">Select airport</option>
                                    {UK_AIRPORTS.map(airport => (
                                      <option key={airport.code} value={airport.code}>
                                        {airport.code} - {airport.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <Label>Price (£ per person)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={pricingPrice}
                                    onChange={(e) => setPricingPrice(parseFloat(e.target.value) || 0)}
                                    className="mt-1"
                                    data-testid="input-price-manual"
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <Label className="mb-2 block">Select Departure Dates</Label>
                                <DayPicker
                                  mode="multiple"
                                  selected={selectedDates}
                                  onSelect={(dates) => setSelectedDates(dates || [])}
                                  disabled={{ before: new Date() }}
                                  className="border rounded-lg p-3"
                                />
                              </div>
                              
                              {selectedDates.length > 0 && (
                                <p className="text-sm text-muted-foreground">
                                  {selectedDates.length} date(s) selected
                                </p>
                              )}
                              
                              <Button
                                type="button"
                                onClick={handleAddPricingEntries}
                                disabled={isSavingPricing || !pricingAirport || !pricingPrice || selectedDates.length === 0}
                                className="w-full"
                                data-testid="button-add-pricing"
                              >
                                {isSavingPricing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Adding Pricing...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Pricing Entries
                                  </>
                                )}
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* Open-Jaw Seasonal Pricing Module */}
                        {formData.pricingModule === "open_jaw_seasonal" && (
                          <>
                            {/* Seasonal Land Costs Section */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                  <CalendarIcon className="w-4 h-4" />
                                  Seasonal Land Costs
                                </CardTitle>
                                <CardDescription>
                                  Define land costs per person for different seasons
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {isLoadingSeasons ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                  </div>
                                ) : packageSeasons.length === 0 ? (
                                  <div className="text-center py-6 text-muted-foreground">
                                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No seasons defined yet</p>
                                    <p className="text-xs mt-1">Add seasons to define land costs for different periods</p>
                                  </div>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Season</TableHead>
                                        <TableHead>Dates</TableHead>
                                        <TableHead className="text-right">Land Cost (pp)</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {packageSeasons.map((season) => (
                                        <TableRow key={season.id}>
                                          <TableCell className="font-medium">{season.seasonName}</TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {format(new Date(season.startDate), "dd MMM")} - {format(new Date(season.endDate), "dd MMM yyyy")}
                                          </TableCell>
                                          <TableCell className="text-right font-mono">
                                            £{season.landCostPerPerson}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex gap-1">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEditSeason(season)}
                                                data-testid={`button-edit-season-${season.id}`}
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteSeason(season.id)}
                                                data-testid={`button-delete-season-${season.id}`}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                                
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleAddSeason}
                                  className="w-full"
                                  data-testid="button-add-season"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add Season
                                </Button>
                              </CardContent>
                            </Card>
                            
                            {/* Flight API Selection & Fetcher */}
                            <Card className="border-primary/20 bg-primary/5">
                              <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Plane className="w-4 h-4 text-primary" />
                                  Flight Pricing
                                </CardTitle>
                                <CardDescription>
                                  Fetch flight prices and combine with seasonal land costs
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {/* Flight API Source Selector */}
                                <div>
                                  <Label className="mb-2 block">Flight API Source</Label>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant={formData.flightApiSource === "european" ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setFormData({ ...formData, flightApiSource: "european" })}
                                      data-testid="button-api-european"
                                    >
                                      European Flight API
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={formData.flightApiSource === "serp" ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setFormData({ ...formData, flightApiSource: "serp" })}
                                      data-testid="button-api-serp"
                                    >
                                      SERP API (Google Flights)
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formData.flightApiSource === "european" 
                                      ? "Uses European Flight API for direct flight pricing (requires IP whitelisting)"
                                      : "Uses SERP API to get Google Flights pricing data"
                                    }
                                  </p>
                                </div>
                                
                                <Separator />
                                
                                {/* Flight Type Selector - Both API sources */}
                                <div>
                                  <Label className="mb-2 block">Flight Type</Label>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant={flightType === "round_trip" ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => {
                                        setFlightType("round_trip");
                                        setHasInternalFlight(false);
                                      }}
                                      data-testid="button-flight-roundtrip"
                                    >
                                      Round-Trip
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={flightType === "open_jaw" ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setFlightType("open_jaw")}
                                      data-testid="button-flight-openjaw"
                                    >
                                      Open-Jaw
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {flightType === "round_trip" 
                                      ? "Fly into and return from the same airport"
                                      : "Fly into one city, return from another (e.g., London → Delhi, Mumbai → London)"
                                    }
                                  </p>
                                </div>
                                
                                {packageSeasons.length === 0 ? (
                                  <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
                                    <p>Please add at least one season with land costs before fetching flight prices.</p>
                                  </div>
                                ) : (
                                  <>
                                    {/* Round-trip destination OR Open-jaw airports */}
                                    {flightType === "open_jaw" ? (
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <Label>Arrival Airport (Outbound)</Label>
                                            <Input
                                              value={openJawArriveAirport}
                                              onChange={(e) => setOpenJawArriveAirport(e.target.value.toUpperCase())}
                                              placeholder={formData.flightApiSource === "european" ? "e.g. DEL or IST|SAW" : "e.g., DEL (Delhi)"}
                                              className="mt-1 font-mono uppercase"
                                              data-testid="input-openjaw-arrive"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Where outbound flight lands{formData.flightApiSource === "european" ? ". Use | for multiple (e.g. IST|SAW)" : ""}
                                            </p>
                                          </div>
                                          <div>
                                            <Label>Departure Airport (Return)</Label>
                                            <Input
                                              value={openJawDepartAirport}
                                              onChange={(e) => setOpenJawDepartAirport(e.target.value.toUpperCase())}
                                              placeholder={formData.flightApiSource === "european" ? "e.g. BOM or IST|SAW" : "e.g., BOM (Mumbai)"}
                                              className="mt-1 font-mono uppercase"
                                              data-testid="input-openjaw-depart"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Where return flight departs{formData.flightApiSource === "european" ? ". Use | for multiple (e.g. IST|SAW)" : ""}
                                            </p>
                                          </div>
                                        </div>
                                        
                                        {/* Internal Flight Option */}
                                        <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              id="hasInternalFlight"
                                              checked={hasInternalFlight}
                                              onChange={(e) => setHasInternalFlight(e.target.checked)}
                                              className="h-4 w-4"
                                              data-testid="checkbox-internal-flight"
                                            />
                                            <Label htmlFor="hasInternalFlight" className="cursor-pointer">
                                              Include Internal Flight
                                            </Label>
                                          </div>
                                          
                                          {hasInternalFlight && (
                                            <div className="space-y-3">
                                              <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                  <Label>Internal From</Label>
                                                  <Input
                                                    value={internalFromAirport}
                                                    onChange={(e) => setInternalFromAirport(e.target.value.toUpperCase())}
                                                    placeholder="e.g., DEL"
                                                    maxLength={3}
                                                    className="mt-1 font-mono uppercase"
                                                    data-testid="input-internal-from"
                                                  />
                                                </div>
                                                <div>
                                                  <Label>Internal To</Label>
                                                  <Input
                                                    value={internalToAirport}
                                                    onChange={(e) => setInternalToAirport(e.target.value.toUpperCase())}
                                                    placeholder="e.g., JAI"
                                                    maxLength={3}
                                                    className="mt-1 font-mono uppercase"
                                                    data-testid="input-internal-to"
                                                  />
                                                </div>
                                              </div>
                                              <div className="w-1/2">
                                                <Label>Days After Arrival</Label>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  max="14"
                                                  value={internalFlightOffsetDays}
                                                  onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    // Validate: positive integer 0-14
                                                    if (!isNaN(val) && val >= 0 && val <= 14) {
                                                      setInternalFlightOffsetDays(val);
                                                    } else if (e.target.value === '') {
                                                      setInternalFlightOffsetDays(0);
                                                    }
                                                  }}
                                                  className="mt-1"
                                                  data-testid="input-internal-offset"
                                                />
                                                <p className="text-xs text-muted-foreground mt-1">
                                                  Internal flight on day {internalFlightOffsetDays + 1} of trip (0 = same day as arrival)
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                          <p className="text-xs text-muted-foreground">
                                            Add a domestic flight within the destination country (e.g., Delhi → Jaipur)</p>
                                        </div>
                                        
                                        <div>
                                          <Label>Duration (Nights)</Label>
                                          <Input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={flightDuration}
                                            onChange={(e) => setFlightDuration(parseInt(e.target.value) || 7)}
                                            className="mt-1 w-1/2"
                                            data-testid="input-duration"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label>Destination Airport Code</Label>
                                          <Input
                                            value={flightDestAirport}
                                            onChange={(e) => setFlightDestAirport(e.target.value.toUpperCase())}
                                            placeholder="e.g., DEL, BOM, GOI"
                                            maxLength={3}
                                            className="mt-1 font-mono uppercase"
                                            data-testid="input-dest-airport"
                                          />
                                        </div>
                                        <div>
                                          <Label>Duration (Nights)</Label>
                                          <Input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={flightDuration}
                                            onChange={(e) => setFlightDuration(parseInt(e.target.value) || 7)}
                                            className="mt-1"
                                            data-testid="input-duration"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div>
                                      <Label className="mb-2 block">Departure Airports</Label>
                                      <div className="flex flex-wrap gap-2">
                                        {UK_AIRPORTS.map(airport => (
                                          <Badge
                                            key={airport.code}
                                            variant={flightDepartAirports.includes(airport.code) ? "default" : "outline"}
                                            className="cursor-pointer"
                                            onClick={() => toggleDepartAirport(airport.code)}
                                            data-testid={`badge-airport-${airport.code}`}
                                          >
                                            {airport.code}
                                          </Badge>
                                        ))}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {flightDepartAirports.length} airports selected
                                      </p>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label>Start Date</Label>
                                        <Input
                                          type="text"
                                          value={flightStartDate}
                                          onChange={(e) => setFlightStartDate(e.target.value)}
                                          placeholder="DD/MM/YYYY"
                                          className="mt-1"
                                          data-testid="input-start-date"
                                        />
                                      </div>
                                      <div>
                                        <Label>End Date</Label>
                                        <Input
                                          type="text"
                                          value={flightEndDate}
                                          onChange={(e) => setFlightEndDate(e.target.value)}
                                          placeholder="DD/MM/YYYY"
                                          className="mt-1"
                                          data-testid="input-end-date"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="w-1/2">
                                      <Label>Markup %</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={flightMarkup}
                                        onChange={(e) => setFlightMarkup(parseFloat(e.target.value) || 0)}
                                        className="mt-1"
                                        data-testid="input-markup"
                                      />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Applied on top of flight + land cost
                                      </p>
                                    </div>
                                    
                                    <Separator />
                                    
                                    <Button
                                      type="button"
                                      onClick={handleFetchSerpFlightPrices}
                                      disabled={
                                        isFetchingFlightPrices || 
                                        flightDepartAirports.length === 0 || 
                                        !flightStartDate || 
                                        !flightEndDate ||
                                        (flightType === "open_jaw" 
                                          ? (!openJawArriveAirport || !openJawDepartAirport)
                                          : !flightDestAirport
                                        )
                                      }
                                      className="w-full"
                                      data-testid="button-fetch-flight-prices"
                                    >
                                      {isFetchingFlightPrices ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          Fetching Flight Prices...
                                        </>
                                      ) : (
                                        <>
                                          <Plane className="w-4 h-4 mr-2" />
                                          Fetch Flight Prices & Calculate Package Prices
                                        </>
                                      )}
                                    </Button>
                                    
                                    {flightPriceResults && (
                                      <div className={`p-3 rounded-lg text-sm ${flightPriceResults.error ? 'bg-destructive/10 text-destructive' : 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'}`}>
                                        {flightPriceResults.error ? (
                                          <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            {flightPriceResults.error}
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Found {flightPriceResults.pricesFound} prices, saved {flightPriceResults.saved} entries
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          </>
                        )}
                        
                        {/* Bokun Departures + Flights Pricing Module */}
                        {formData.pricingModule === "bokun_departures" && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4" />
                                Bokun Departure Dates
                              </CardTitle>
                              <CardDescription>
                                Sync actual departure dates and rates from Bokun, then add flight costs
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Sync Status and Button */}
                              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  {lastDepartureSync ? (
                                    <p className="text-sm">
                                      Last synced: {(() => {
                                        try {
                                          const date = new Date(lastDepartureSync);
                                          return isValid(date) ? format(date, "dd MMM yyyy HH:mm") : "Unknown";
                                        } catch { return "Unknown"; }
                                      })()}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Not synced yet</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-1">
                                    <p className="text-xs text-muted-foreground">
                                      {bokunDepartures.length} departures
                                    </p>
                                    {bokunDepartures[0]?.durationNights && (
                                      <Badge variant="secondary" className="text-xs">
                                        {bokunDepartures[0].durationNights} nights (auto-detected)
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  onClick={handleSyncDepartures}
                                  disabled={isSyncingDepartures}
                                  data-testid="button-sync-departures"
                                >
                                  {isSyncingDepartures ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Syncing...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      Sync from Bokun
                                    </>
                                  )}
                                </Button>
                              </div>
                              
                              {/* Download Bokun Prices Button */}
                              {bokunDepartures.length > 0 && (
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      // Generate CSV of Bokun land prices
                                      const headers = ["Date", "Rate", "Room", "Hotel", "Land Price (GBP)"];
                                      const rows: string[][] = [];
                                      
                                      bokunDepartures.forEach((departure: any) => {
                                        departure.rates?.forEach((rate: any) => {
                                          rows.push([
                                            departure.departureDate,
                                            rate.rateTitle || "",
                                            rate.roomCategory || "",
                                            rate.hotelCategory || "",
                                            rate.priceGbp?.toFixed(2) || "0"
                                          ]);
                                        });
                                      });
                                      
                                      const csvContent = [
                                        headers.join(","),
                                        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
                                      ].join("\n");
                                      
                                      const blob = new Blob([csvContent], { type: "text/csv" });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `bokun-prices-${formData.bokunProductId || "package"}.csv`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }}
                                    data-testid="button-download-bokun-prices"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Bokun Prices (CSV)
                                  </Button>
                                </div>
                              )}
                              
                              {/* Hotel Category Visibility */}
                              {bokunDepartures.length > 0 && (() => {
                                // Extract unique hotel categories from departures
                                const allCategories = new Set<string>();
                                bokunDepartures.forEach((departure: any) => {
                                  departure.rates?.forEach((rate: any) => {
                                    if (rate.hotelCategory) {
                                      allCategories.add(rate.hotelCategory);
                                    }
                                  });
                                });
                                const categories = Array.from(allCategories).sort();
                                
                                if (categories.length === 0) return null;
                                
                                return (
                                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                                    <p className="text-sm font-medium">Hotel Categories to Show on Site</p>
                                    <p className="text-xs text-muted-foreground mb-2">
                                      Select which hotel categories should be visible to customers. Unchecking all will show all categories.
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                      {categories.map((category) => {
                                        const isEnabled = formData.enabledHotelCategories.length === 0 || 
                                          formData.enabledHotelCategories.includes(category);
                                        return (
                                          <label 
                                            key={category}
                                            className="flex items-center gap-2 cursor-pointer"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isEnabled}
                                              onChange={(e) => {
                                                let newCategories: string[];
                                                if (e.target.checked) {
                                                  // If was empty (all enabled), start fresh with just this one
                                                  if (formData.enabledHotelCategories.length === 0) {
                                                    // When first checkbox is checked from "all", enable all then it's already checked
                                                    newCategories = [...formData.enabledHotelCategories];
                                                  } else {
                                                    newCategories = [...formData.enabledHotelCategories, category];
                                                  }
                                                } else {
                                                  // If all were enabled (empty array), set to all except this one
                                                  if (formData.enabledHotelCategories.length === 0) {
                                                    newCategories = categories.filter(c => c !== category);
                                                  } else {
                                                    newCategories = formData.enabledHotelCategories.filter(c => c !== category);
                                                  }
                                                }
                                                setFormData({ ...formData, enabledHotelCategories: newCategories });
                                              }}
                                              className="w-4 h-4 rounded border-gray-300"
                                              data-testid={`checkbox-hotel-${category.toLowerCase().replace(/\s+/g, '-')}`}
                                            />
                                            <span className="text-sm">{category}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    {formData.enabledHotelCategories.length > 0 && (
                                      <p className="text-xs text-muted-foreground mt-2">
                                        Showing: {formData.enabledHotelCategories.join(", ")}
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                              
                              {/* Departures Table */}
                              {isLoadingDepartures ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                              ) : bokunDepartures.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground">
                                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No departures synced yet</p>
                                  <p className="text-xs mt-1">Click "Sync from Bokun" to fetch departure dates</p>
                                </div>
                              ) : (
                                <div className="border rounded-lg overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Rate</TableHead>
                                        <TableHead>Room</TableHead>
                                        <TableHead>Hotel</TableHead>
                                        <TableHead className="text-right">Land (£)</TableHead>
                                        <TableHead className="text-right">Flight (£)</TableHead>
                                        <TableHead className="text-right">Total (£)</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {bokunDepartures.slice(0, 20).map((departure) => (
                                        departure.rates?.map((rate: any) => (
                                          <TableRow key={`${departure.id}-${rate.id}`}>
                                            <TableCell className="font-medium">
                                              {(() => {
                                                try {
                                                  const date = parseISO(departure.departureDate);
                                                  return isValid(date) ? format(date, "dd MMM yyyy") : departure.departureDate;
                                                } catch { return departure.departureDate || "-"; }
                                              })()}
                                            </TableCell>
                                            <TableCell className="text-sm max-w-[150px] truncate" title={rate.rateTitle}>
                                              {rate.rateTitle}
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant="outline" className="text-xs">
                                                {rate.roomCategory}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                              {rate.hotelCategory || "-"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                              £{rate.priceGbp?.toFixed(0) || 0}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-muted-foreground">
                                              {rate.flights && rate.flights.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 justify-end">
                                                  {rate.flights.map((f: any) => (
                                                    <Badge key={f.airportCode} variant="secondary" className="text-xs font-mono">
                                                      {f.airportCode}: £{f.flightPriceGbp?.toFixed(0)}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-medium">
                                              {rate.flights && rate.flights.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 justify-end">
                                                  {rate.flights.map((f: any) => (
                                                    <Badge key={f.airportCode} variant="outline" className="text-xs font-mono">
                                                      {f.airportCode}: £{f.combinedPriceGbp?.toFixed(0)}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))
                                      ))}
                                    </TableBody>
                                  </Table>
                                  {bokunDepartures.length > 20 && (
                                    <div className="p-2 text-center text-xs text-muted-foreground border-t">
                                      Showing first 20 of {bokunDepartures.length} departures
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Flight Configuration Section */}
                              {bokunDepartures.length > 0 && (
                                <div className="border-t pt-4 mt-4 space-y-4">
                                  <h4 className="font-medium flex items-center gap-2">
                                    <Plane className="w-4 h-4" />
                                    Add Flight Prices
                                  </h4>
                                  
                                  <div className="space-y-4">
                                    {/* Flight API Source Selector */}
                                    <div>
                                      <Label className="mb-2 block">Flight API Source</Label>
                                      <div className="flex gap-2">
                                        <Button
                                          type="button"
                                          variant={formData.flightApiSource === "european" ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setFormData({ ...formData, flightApiSource: "european" })}
                                          data-testid="button-bokun-api-european"
                                        >
                                          European Flight API
                                        </Button>
                                        <Button
                                          type="button"
                                          variant={formData.flightApiSource === "serp" ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setFormData({ ...formData, flightApiSource: "serp" })}
                                          data-testid="button-bokun-api-serp"
                                        >
                                          SERP API (Google Flights)
                                        </Button>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {formData.flightApiSource === "european" 
                                          ? "Uses European Flight API for direct flight pricing"
                                          : "Uses SERP API to get Google Flights pricing data"
                                        }
                                      </p>
                                    </div>
                                    
                                    {/* Flight Type Selector */}
                                    <div className="space-y-2">
                                      <Label>Flight Type</Label>
                                      <Select
                                        value={bokunFlightType}
                                        onValueChange={(value: "roundtrip" | "openjaw") => setBokunFlightType(value)}
                                      >
                                        <SelectTrigger data-testid="select-bokun-flight-type" className="w-full md:w-64">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="roundtrip">Round-trip</SelectItem>
                                          <SelectItem value="openjaw">Open-jaw (One-way x2)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground">
                                        {bokunFlightType === "openjaw" 
                                          ? "Fly into one city, return from another (e.g., UK → Delhi, Mumbai → UK)" 
                                          : "Fly into and return from the same airport"}
                                      </p>
                                    </div>
                                    
                                    {/* Airport inputs - different for round-trip vs open-jaw */}
                                    {bokunFlightType === "openjaw" ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label>Arrival Airport (Outbound)</Label>
                                          <Input
                                            placeholder="e.g. DEL or IST|SAW"
                                            value={bokunFlightDestAirport}
                                            onChange={(e) => setBokunFlightDestAirport(e.target.value.toUpperCase())}
                                            className="font-mono uppercase"
                                            data-testid="input-bokun-dest-airport"
                                          />
                                          <p className="text-xs text-muted-foreground">Where outbound lands. Use | for multiple (e.g. IST|SAW)</p>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Departure Airport (Return)</Label>
                                          <Input
                                            placeholder="e.g. BOM or IST|SAW"
                                            value={bokunFlightReturnAirport}
                                            onChange={(e) => setBokunFlightReturnAirport(e.target.value.toUpperCase())}
                                            className="font-mono uppercase"
                                            data-testid="input-bokun-return-airport"
                                          />
                                          <p className="text-xs text-muted-foreground">Where return departs. Use | for multiple (e.g. IST|SAW)</p>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <Label>Destination Airport (IATA Code)</Label>
                                        <Input
                                          placeholder="e.g. IST or IST|SAW for multiple"
                                          value={bokunFlightDestAirport}
                                          onChange={(e) => setBokunFlightDestAirport(e.target.value.toUpperCase())}
                                          className="font-mono uppercase w-full md:w-64"
                                          data-testid="input-bokun-dest-airport"
                                        />
                                        <p className="text-xs text-muted-foreground">Use | to search multiple airports (e.g. IST|SAW)</p>
                                      </div>
                                    )}
                                    
                                    {/* Markup */}
                                    <div className="space-y-2">
                                      <Label>Markup %</Label>
                                      <Input
                                        type="number"
                                        value={bokunFlightMarkup}
                                        onChange={(e) => setBokunFlightMarkup(parseInt(e.target.value) || 0)}
                                        min={0}
                                        max={100}
                                        className="w-full md:w-32"
                                        data-testid="input-bokun-markup"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* UK Departure Airports */}
                                  <div className="space-y-2">
                                    <Label>UK Departure Airports</Label>
                                    <div className="flex flex-wrap gap-2">
                                      {UK_AIRPORTS.map((airport) => (
                                        <Badge
                                          key={airport.code}
                                          variant={bokunFlightDepartAirports.includes(airport.code) ? "default" : "outline"}
                                          className="cursor-pointer"
                                          onClick={() => {
                                            if (bokunFlightDepartAirports.includes(airport.code)) {
                                              setBokunFlightDepartAirports(bokunFlightDepartAirports.filter(c => c !== airport.code));
                                            } else {
                                              setBokunFlightDepartAirports([...bokunFlightDepartAirports, airport.code]);
                                            }
                                          }}
                                        >
                                          {airport.code}
                                        </Badge>
                                      ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {bokunFlightDepartAirports.length} airports selected
                                    </p>
                                  </div>
                                  
                                  {/* Fetch Button */}
                                  <Button
                                    type="button"
                                    onClick={handleFetchBokunDepartureFlights}
                                    disabled={
                                      isFetchingBokunFlights || 
                                      !bokunFlightDestAirport || 
                                      (bokunFlightType === "openjaw" && !bokunFlightReturnAirport) ||
                                      bokunFlightDepartAirports.length === 0
                                    }
                                    className="w-full"
                                    data-testid="button-fetch-bokun-flights"
                                  >
                                    {isFetchingBokunFlights ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Fetching Flight Prices...
                                      </>
                                    ) : (
                                      <>
                                        <Plane className="w-4 h-4 mr-2" />
                                        Fetch Flight Prices for All Departures
                                      </>
                                    )}
                                  </Button>
                                  
                                  {bokunFlightResults && (
                                    <div className={`p-3 rounded-lg text-sm ${bokunFlightResults.error ? 'bg-destructive/10 text-destructive' : 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'}`}>
                                      {bokunFlightResults.error ? (
                                        <div className="flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4" />
                                          {bokunFlightResults.error}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <CheckCircle2 className="w-4 h-4" />
                                          Updated {bokunFlightResults.updated} departure rates with flight prices
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Flight + Hotel API Module */}
                        {formData.pricingModule === "flights_hotels_api" && (
                          <Card className="border-primary/20 bg-primary/5">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Plane className="w-4 h-4 text-primary" />
                                Flight + Hotel Configuration
                              </CardTitle>
                              <CardDescription>
                                Configure multi-city itinerary with specific hotels and flight pricing
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Configuration Required</AlertTitle>
                                <AlertDescription>
                                  Use the API endpoint <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/admin/packages/{formData.id}/flight-hotel-config</code> to configure cities, hotels, flights, and pricing settings.
                                  <br /><br />
                                  <strong>Quick Setup:</strong>
                                  <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
                                    <li>Search hotels: <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/admin/hotels/search?city=Delhi</code></li>
                                    <li>Configure package with hotel codes and date ranges</li>
                                    <li>Click "Fetch Prices" to calculate pricing for all dates</li>
                                  </ol>
                                </AlertDescription>
                              </Alert>

                              {/* Configuration Status */}
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm font-medium mb-2">Module Status</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <CalendarIcon className="w-4 h-4" />
                                  <span>Configuration and price fetching available via API</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Full admin UI coming soon. For now, use the REST API endpoints documented in FLIGHT_HOTEL_MODULE_README.md
                                </p>
                              </div>

                              {/* Quick Links */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    window.open(`/api/admin/packages/${formData.id}/flight-hotel-config`, '_blank');
                                  }}
                                  disabled={!formData.id}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Config (JSON)
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    window.open(`/api/admin/packages/${formData.id}/flight-hotel-prices`, '_blank');
                                  }}
                                  disabled={!formData.id}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Prices (JSON)
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        <Separator />
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* CSV Download/Upload Section */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Export / Import Pricing
                              </CardTitle>
                              <CardDescription>
                                Download to validate flight prices, edit selling prices, then re-upload
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                <p className="font-medium mb-1">CSV Format:</p>
                                <p className="text-muted-foreground text-xs">
                                  airport_code, date (YYYY-MM-DD), price, flight_cost (optional), land_cost (optional)
                                </p>
                              </div>
                              
                              {/* Download Button */}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleDownloadCsv}
                                disabled={isDownloadingCsv || existingPricing.length === 0}
                                className="w-full"
                                data-testid="button-download-csv"
                              >
                                {isDownloadingCsv ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Current Pricing CSV
                                  </>
                                )}
                              </Button>
                              
                              <Separator />
                              
                              {/* Upload Button */}
                              <input
                                type="file"
                                ref={csvFileRef}
                                accept=".csv"
                                onChange={handleCsvUpload}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => csvFileRef.current?.click()}
                                disabled={isUploadingCsv}
                                className="w-full"
                                data-testid="button-upload-csv"
                              >
                                {isUploadingCsv ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Modified CSV
                                  </>
                                )}
                              </Button>
                              
                              <p className="text-xs text-muted-foreground">
                                Uploading will replace existing prices for matching airport/date combinations
                              </p>
                            </CardContent>
                          </Card>

                          {/* Existing Pricing Entries */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4" />
                                Existing Pricing ({existingPricing.length})
                              </CardTitle>
                              <CardDescription>
                                All pricing entries for this package
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {isLoadingPricing ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                              ) : existingPricing.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No pricing entries yet</p>
                                </div>
                              ) : (
                                <div className="max-h-[400px] overflow-y-auto space-y-2">
                                  {existingPricing.map((entry) => (
                                    <div
                                      key={entry.id}
                                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                                      data-testid={`pricing-entry-${entry.id}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="font-mono">
                                          {entry.departureAirport}
                                        </Badge>
                                        <div>
                                          <p className="text-sm font-medium">
                                            {format(new Date(entry.departureDate), "EEE, MMM d, yyyy")}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {entry.departureAirportName}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-primary">
                                          £{entry.price.toLocaleString()}
                                        </span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeletePricingEntry(entry.id)}
                                          data-testid={`button-delete-pricing-${entry.id}`}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="seo" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="metaTitle">Meta Title</Label>
                      <Input
                        id="metaTitle"
                        value={formData.metaTitle || ""}
                        onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                        placeholder="SEO title..."
                        data-testid="input-meta-title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="metaDescription">Meta Description</Label>
                      <Textarea
                        id="metaDescription"
                        value={formData.metaDescription || ""}
                        onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                        placeholder="SEO description..."
                        rows={3}
                        data-testid="input-meta-description"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <Separator />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setIsCreating(false); setEditingPackage(null); }}
                    data-testid="button-cancel-form"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Package"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-muted h-20 rounded-lg" />
                ))}
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No packages yet</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "No packages match your search" : "Get started by adding your first flight package"}
                </p>
                <Button onClick={handleOpenCreate} data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Package
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPackages.map((pkg) => {
                    const countrySlug = pkg.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
                    return (
                    <TableRow key={pkg.id} data-testid={`row-package-${pkg.id}`}>
                      <TableCell className="text-muted-foreground">
                        {pkg.displayOrder}
                      </TableCell>
                      <TableCell>
                        <a 
                          href={`/Holidays/${countrySlug}/${pkg.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                          data-testid={`link-package-${pkg.id}`}
                        >
                          {pkg.featuredImage ? (
                            <img 
                              src={pkg.featuredImage} 
                              alt="" 
                              className="h-10 w-14 object-cover rounded"
                            />
                          ) : (
                            <div className="h-10 w-14 bg-muted rounded flex items-center justify-center">
                              <Plane className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium line-clamp-1 hover:underline">{pkg.title}</p>
                            <p className="text-xs text-muted-foreground">{pkg.duration}</p>
                          </div>
                        </a>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{pkg.category}</Badge>
                          {(pkg.tags as string[] || []).map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(pkg.price)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={pkg.isPublished}
                          onCheckedChange={(checked) => togglePublishMutation.mutate({ id: pkg.id, isPublished: checked })}
                          data-testid={`switch-publish-${pkg.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            data-testid={`button-view-${pkg.id}`}
                          >
                            <a href={`/Holidays/${countrySlug}/${pkg.slug}`} target="_blank" rel="noopener noreferrer">
                              <Eye className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(pkg)}
                            data-testid={`button-edit-${pkg.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-${pkg.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Package</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{pkg.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(pkg.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
        
        {/* Hotel Library Picker Dialog */}
        <Dialog open={hotelPickerOpen} onOpenChange={setHotelPickerOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Import Hotel from Library</DialogTitle>
              <DialogDescription>
                Select a hotel from your library to add to this package's accommodations.
              </DialogDescription>
            </DialogHeader>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search hotels by name, city, or country..."
                value={hotelSearchQuery}
                onChange={(e) => setHotelSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-hotel-library-search"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3">
              {filteredHotels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="mb-2">No hotels found in your library</p>
                  <a href="/admin/hotels" target="_blank" className="text-primary hover:underline text-sm">
                    Go to Hotels Library to import hotels
                  </a>
                </div>
              ) : (
                filteredHotels.map((hotel) => (
                  <Card 
                    key={hotel.id} 
                    className="hover-elevate cursor-pointer"
                    onClick={() => importHotelFromLibrary(hotel)}
                    data-testid={`hotel-library-item-${hotel.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {hotel.featuredImage ? (
                          <img 
                            src={hotel.featuredImage} 
                            alt={hotel.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{hotel.name}</h4>
                            {hotel.starRating && (
                              <div className="flex items-center gap-0.5">
                                {[...Array(hotel.starRating)].map((_, i) => (
                                  <Star key={i} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                ))}
                              </div>
                            )}
                          </div>
                          {(hotel.city || hotel.country) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {[hotel.city, hotel.country].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {hotel.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                              {hotel.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {hotel.images && hotel.images.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {hotel.images.length} images
                              </Badge>
                            )}
                            {hotel.amenities && hotel.amenities.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {hotel.amenities.length} amenities
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setHotelPickerOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Season Add/Edit Dialog */}
        <Dialog open={seasonDialogOpen} onOpenChange={setSeasonDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSeasonData ? "Edit Season" : "Add Season"}</DialogTitle>
              <DialogDescription>
                Define land costs for this season period
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Season Name</Label>
                <Input
                  value={seasonForm.seasonName}
                  onChange={(e) => setSeasonForm({ ...seasonForm, seasonName: e.target.value })}
                  placeholder="e.g., Peak Season, Shoulder Season"
                  className="mt-1"
                  data-testid="input-season-name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={seasonForm.startDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                    className="mt-1"
                    data-testid="input-season-start"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={seasonForm.endDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                    className="mt-1"
                    data-testid="input-season-end"
                  />
                </div>
              </div>
              
              <div>
                <Label>Land Cost Per Person (£)</Label>
                <Input
                  type="number"
                  min="0"
                  value={seasonForm.landCostPerPerson}
                  onChange={(e) => setSeasonForm({ ...seasonForm, landCostPerPerson: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                  data-testid="input-season-land-cost"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This is the tour/accommodation cost before adding flights
                </p>
              </div>
              
              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  value={seasonForm.notes}
                  onChange={(e) => setSeasonForm({ ...seasonForm, notes: e.target.value })}
                  placeholder="Any notes about this season"
                  className="mt-1"
                  data-testid="input-season-notes"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setSeasonDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSeason} data-testid="button-save-season">
                {editingSeasonData ? "Update Season" : "Add Season"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
