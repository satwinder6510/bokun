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
  Globe, CheckCircle2, AlertCircle, Calendar as CalendarIcon, PoundSterling, GripVertical, Info
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FlightPackage, InsertFlightPackage, PackagePricing, Hotel } from "@shared/schema";
import { MediaPicker } from "@/components/MediaPicker";
import { Star } from "lucide-react";

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

type PackageFormData = {
  title: string;
  slug: string;
  category: string;
  tags: string[];
  price: number;
  singlePrice: number | null;
  pricingDisplay: "both" | "twin" | "single";
  currency: string;
  priceLabel: string;
  description: string;
  excerpt: string;
  whatsIncluded: string[];
  highlights: string[];
  itinerary: ItineraryDay[];
  accommodations: Accommodation[];
  otherInfo: string;
  excluded: string | null;
  requirements: string | null;
  attention: string | null;
  featuredImage: string;
  gallery: string[];
  videos: VideoItem[];
  duration: string;
  metaTitle: string;
  metaDescription: string;
  isPublished: boolean;
  isSpecialOffer: boolean;
  displayOrder: number;
  bokunProductId: string | null;
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
  "Beach", "City Break", "Family", "Adventure", "Luxury", 
  "Budget", "Cultural", "Safari", "Cruise", "River Cruise",
  "Golden Triangle", "Multi-Centre", "Wellness", "Religious", "Wildlife", "Island",
  "Solo Travellers"
];

const emptyPackage: PackageFormData = {
  title: "",
  slug: "",
  category: "",
  tags: [],
  price: 0,
  singlePrice: null,
  pricingDisplay: "both",
  currency: "GBP",
  priceLabel: "per adult",
  description: "",
  excerpt: "",
  whatsIncluded: [],
  highlights: [],
  itinerary: [],
  accommodations: [],
  otherInfo: "",
  excluded: null,
  requirements: null,
  attention: null,
  featuredImage: "",
  gallery: [],
  videos: [],
  duration: "",
  metaTitle: "",
  metaDescription: "",
  isPublished: false,
  isSpecialOffer: false,
  displayOrder: 0,
  bokunProductId: null,
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
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
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
  
  // Hotel library picker state
  const [hotelPickerOpen, setHotelPickerOpen] = useState(false);
  const [hotelSearchQuery, setHotelSearchQuery] = useState("");

  // Helper for admin fetch with session header
  const adminQueryFn = async (url: string) => {
    const response = await fetch(url, {
      headers: {
        'X-Admin-Session': localStorage.getItem('admin_session_token') || '',
      },
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
      tags: (pkg.tags || []) as string[],
      price: pkg.price,
      singlePrice: pkg.singlePrice || null,
      pricingDisplay: (pkg.pricingDisplay as "both" | "twin" | "single") || "both",
      currency: pkg.currency,
      priceLabel: pkg.priceLabel,
      description: pkg.description,
      excerpt: pkg.excerpt || "",
      whatsIncluded: (pkg.whatsIncluded || []) as string[],
      highlights: (pkg.highlights || []) as string[],
      itinerary: (pkg.itinerary || []) as ItineraryDay[],
      accommodations: (pkg.accommodations || []) as Accommodation[],
      otherInfo: pkg.otherInfo || "",
      excluded: pkg.excluded || null,
      requirements: pkg.requirements || null,
      attention: pkg.attention || null,
      featuredImage: pkg.featuredImage || "",
      gallery: (pkg.gallery || []) as string[],
      videos: (pkg.videos || []) as VideoItem[],
      duration: pkg.duration || "",
      metaTitle: pkg.metaTitle || "",
      metaDescription: pkg.metaDescription || "",
      isPublished: pkg.isPublished,
      isSpecialOffer: pkg.isSpecialOffer || false,
      displayOrder: pkg.displayOrder,
      bokunProductId: pkg.bokunProductId || null,
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
    if (!editingPackage || !formData.bokunProductId) {
      toast({ title: "No Bokun tour linked", variant: "destructive" });
      return;
    }
    
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
          bokunProductId: formData.bokunProductId,
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
    setFormData({ ...formData, itinerary: updated });
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
                        <Label htmlFor="category">Category/Destination *</Label>
                        <Input
                          id="category"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          placeholder="e.g., India, Maldives"
                          required
                          data-testid="input-category"
                        />
                      </div>
                      
                      {/* Tags Section */}
                      <div className="col-span-2">
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
                  </TabsContent>

                  <TabsContent value="itinerary" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label>Day-by-Day Itinerary</Label>
                      <Button type="button" variant="outline" onClick={addItineraryDay} data-testid="button-add-day">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Day
                      </Button>
                    </div>
                    {(formData.itinerary || []).map((day, index) => (
                      <Card key={index}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">Day {day.day}</Badge>
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
                        {/* Dynamic Flight Pricing Section - Only show for Bokun-linked packages */}
                        {formData.bokunProductId && (
                          <Card className="border-primary/20 bg-primary/5">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Plane className="w-4 h-4 text-primary" />
                                Dynamic Flight Pricing
                              </CardTitle>
                              <CardDescription>
                                Automatically fetch live flight prices and combine with the Bokun land tour price
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Destination Airport Code</Label>
                                  <Input
                                    value={flightDestAirport}
                                    onChange={(e) => setFlightDestAirport(e.target.value.toUpperCase())}
                                    placeholder="e.g., SOF, ATH, IST"
                                    maxLength={3}
                                    className="mt-1 font-mono uppercase"
                                    data-testid="input-dest-airport"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">3-letter IATA code</p>
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
                                  Applied on top of flight + land tour price
                                </p>
                              </div>
                              
                              <Separator />
                              
                              <Button
                                type="button"
                                onClick={handleFetchFlightPrices}
                                disabled={isFetchingFlightPrices || !flightDestAirport || flightDepartAirports.length === 0 || !flightStartDate || !flightEndDate}
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
                                    Fetch Flight Prices & Save to Package
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
                            </CardContent>
                          </Card>
                        )}

                        <Separator />
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Add New Pricing - Manual */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Add Pricing Manually
                              </CardTitle>
                              <CardDescription>
                                Select airport, enter price, then pick departure dates
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
                                    data-testid="select-airport"
                                  >
                                    <option value="">Select airport...</option>
                                    {UK_AIRPORTS.map(airport => (
                                      <option key={airport.code} value={airport.code}>
                                        {airport.code} - {airport.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <Label>Price (GBP)</Label>
                                  <div className="relative mt-1">
                                    <PoundSterling className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={pricingPrice}
                                      onChange={(e) => setPricingPrice(parseFloat(e.target.value) || 0)}
                                      className="pl-9"
                                      data-testid="input-pricing-price"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div>
                                <Label className="mb-2 block">Select Departure Dates</Label>
                                <div className="border rounded-lg p-3 flex justify-center">
                                  <Calendar
                                    mode="multiple"
                                    selected={selectedDates}
                                    onSelect={(dates) => setSelectedDates(dates || [])}
                                    disabled={(date) => date < new Date()}
                                    className="rounded-md"
                                    data-testid="calendar-dates"
                                  />
                                </div>
                                {selectedDates.length > 0 && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    {selectedDates.length} date(s) selected
                                  </p>
                                )}
                              </div>

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
                                    Adding...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add {selectedDates.length} Price Entries
                                  </>
                                )}
                              </Button>

                              <Separator className="my-4" />

                              {/* CSV Upload Section */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Upload className="w-4 h-4 text-muted-foreground" />
                                  <Label>Or Upload CSV File</Label>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Upload a pricing CSV with format: Destination Airport, Board Basis rows, 
                                  then groups of Departure Airport/Date/Price rows.
                                </p>
                                <input
                                  ref={csvFileRef}
                                  type="file"
                                  accept=".csv"
                                  onChange={handleCsvUpload}
                                  className="hidden"
                                  data-testid="input-csv-upload"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => csvFileRef.current?.click()}
                                    disabled={isUploadingCsv}
                                    className="flex-1"
                                    data-testid="button-upload-csv"
                                  >
                                    {isUploadingCsv ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing CSV...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload Pricing CSV
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleExportPricingCsv}
                                    disabled={existingPricing.length === 0 && !formData.bokunProductId}
                                    data-testid="button-export-csv"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Export CSV
                                  </Button>
                                </div>
                                {formData.bokunProductId && (
                                  <div className="p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-xs">
                                    <p className="text-blue-800 dark:text-blue-200 flex items-center gap-1">
                                      <Plane className="w-3 h-3" />
                                      Linked to Bokun tour. Export includes Bokun net prices for reference.
                                    </p>
                                  </div>
                                )}
                              </div>
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
      </main>
    </div>
  );
}
