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
import { 
  ArrowLeft, Plus, Trash2, Edit2, Eye, Package, Search, 
  Plane, Save, X, Clock, MapPin, Download, Upload, ImagePlus, Loader2,
  Globe, CheckCircle2, AlertCircle, Calendar as CalendarIcon, PoundSterling
} from "lucide-react";
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
import type { FlightPackage, InsertFlightPackage, PackagePricing } from "@shared/schema";

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

type PackageFormData = {
  title: string;
  slug: string;
  category: string;
  price: number;
  currency: string;
  priceLabel: string;
  description: string;
  excerpt: string;
  whatsIncluded: string[];
  highlights: string[];
  itinerary: ItineraryDay[];
  accommodations: Accommodation[];
  otherInfo: string;
  featuredImage: string;
  gallery: string[];
  duration: string;
  metaTitle: string;
  metaDescription: string;
  isPublished: boolean;
  displayOrder: number;
};

const emptyPackage: PackageFormData = {
  title: "",
  slug: "",
  category: "",
  price: 0,
  currency: "GBP",
  priceLabel: "per adult",
  description: "",
  excerpt: "",
  whatsIncluded: [],
  highlights: [],
  itinerary: [],
  accommodations: [],
  otherInfo: "",
  featuredImage: "",
  gallery: [],
  duration: "",
  metaTitle: "",
  metaDescription: "",
  isPublished: false,
  displayOrder: 0,
};

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
  const [editingHighlightIndex, setEditingHighlightIndex] = useState<number | null>(null);
  const [editingHighlightValue, setEditingHighlightValue] = useState("");
  const [editingIncludedIndex, setEditingIncludedIndex] = useState<number | null>(null);
  const [editingIncludedValue, setEditingIncludedValue] = useState("");
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const featuredImageRef = useRef<HTMLInputElement>(null);
  const galleryImagesRef = useRef<HTMLInputElement>(null);
  
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

  const { data: packages = [], isLoading } = useQuery<FlightPackage[]>({
    queryKey: ["/api/admin/packages"],
  });

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
    
    setFormData({
      ...emptyPackage,
      title: scrapedData.title,
      slug: scrapedData.slug,
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
      price: pkg.price,
      currency: pkg.currency,
      priceLabel: pkg.priceLabel,
      description: pkg.description,
      excerpt: pkg.excerpt || "",
      whatsIncluded: (pkg.whatsIncluded || []) as string[],
      highlights: (pkg.highlights || []) as string[],
      itinerary: (pkg.itinerary || []) as ItineraryDay[],
      accommodations: (pkg.accommodations || []) as Accommodation[],
      otherInfo: pkg.otherInfo || "",
      featuredImage: pkg.featuredImage || "",
      gallery: (pkg.gallery || []) as string[],
      duration: pkg.duration || "",
      metaTitle: pkg.metaTitle || "",
      metaDescription: pkg.metaDescription || "",
      isPublished: pkg.isPublished,
      displayOrder: pkg.displayOrder,
    });
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{editingPackage ? "Edit Package" : "Create New Package"}</CardTitle>
                <CardDescription>
                  {editingPackage ? `Editing: ${editingPackage.title}` : "Fill in the details for your new package"}
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => { setIsCreating(false); setEditingPackage(null); }}
                data-testid="button-cancel"
              >
                <X className="w-4 h-4" />
              </Button>
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
                      <div>
                        <Label htmlFor="price">Price (GBP) *</Label>
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
                        <Label htmlFor="priceLabel">Price Label</Label>
                        <Input
                          id="priceLabel"
                          value={formData.priceLabel}
                          onChange={(e) => setFormData({ ...formData, priceLabel: e.target.value })}
                          placeholder="per adult"
                          data-testid="input-price-label"
                        />
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

                    <div>
                      <Label>Featured Image (Hero)</Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        Recommended: <strong>1920 x 823 px</strong> (21:9 ratio). Landscape only. Keep important content centered.
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
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => featuredImageRef.current?.click()}
                            disabled={isUploadingFeatured}
                            className="flex-1"
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
                                Upload Image
                              </>
                            )}
                          </Button>
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
                      <div className="mt-2 space-y-3">
                        <input
                          ref={galleryImagesRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryImagesUpload}
                          className="hidden"
                          data-testid="input-gallery-files"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => galleryImagesRef.current?.click()}
                          disabled={isUploadingGallery}
                          className="w-full"
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
                              Add Gallery Images
                            </>
                          )}
                        </Button>
                        <div className="flex flex-wrap gap-2">
                          {(formData.gallery || []).map((url, i) => (
                            <div key={i} className="relative group">
                              <img src={url} alt="" className="h-20 w-28 object-cover rounded-md" />
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, gallery: (formData.gallery || []).filter((_, idx) => idx !== i) })}
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

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="isPublished"
                          checked={formData.isPublished}
                          onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                          data-testid="switch-published"
                        />
                        <Label htmlFor="isPublished">Published</Label>
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
                    <div className="flex items-center justify-between">
                      <Label>Accommodations</Label>
                      <Button type="button" variant="outline" onClick={addAccommodation} data-testid="button-add-hotel">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Hotel
                      </Button>
                    </div>
                    {(formData.accommodations || []).map((hotel, index) => (
                      <Card key={index}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{hotel.name || `Hotel ${index + 1}`}</CardTitle>
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
                            <Label className="text-sm">Hotel Images (comma-separated URLs)</Label>
                            <Input
                              value={(hotel.images || []).join(", ")}
                              onChange={(e) => updateAccommodation(index, 'images', e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                              placeholder="https://..., https://..."
                              data-testid={`input-hotel-images-${index}`}
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(hotel.images || []).map((img, imgIdx) => (
                                <img key={imgIdx} src={img} alt="" className="h-12 w-16 object-cover rounded" />
                              ))}
                            </div>
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
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Add New Pricing */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Add Pricing Entries
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
                                      Processing CSV...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 mr-2" />
                                      Upload Pricing CSV
                                    </>
                                  )}
                                </Button>
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
                  {filteredPackages.map((pkg) => (
                    <TableRow key={pkg.id} data-testid={`row-package-${pkg.id}`}>
                      <TableCell className="text-muted-foreground">
                        {pkg.displayOrder}
                      </TableCell>
                      <TableCell>
                        <a 
                          href={`/packages/${pkg.slug}`}
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
                        <Badge variant="outline">{pkg.category}</Badge>
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
                            <a href={`/packages/${pkg.slug}`} target="_blank" rel="noopener noreferrer">
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
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
