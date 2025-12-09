import { useState } from "react";
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
import { 
  ArrowLeft, Plus, Trash2, Edit2, Star, Save, X, Search, Hotel, Loader2, 
  Globe, MapPin, Phone, Mail, ExternalLink, Image as ImageIcon
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import type { Hotel as HotelType } from "@shared/schema";

export default function AdminHotels() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<HotelType | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeGalleryUrl, setScrapeGalleryUrl] = useState("");
  const [scrapeCountry, setScrapeCountry] = useState("");
  const [scrapeCity, setScrapeCity] = useState("");
  const [isScraping, setIsScraping] = useState(false);

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

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Session': localStorage.getItem('admin_session_token') || '',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return response.json();
  };

  const { data: hotels = [], isLoading } = useQuery<HotelType[]>({
    queryKey: ["/api/admin/hotels"],
    queryFn: () => adminQueryFn("/api/admin/hotels"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/hotels/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hotels"] });
      toast({ title: "Hotel removed from library" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete hotel", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; updates: Partial<HotelType> }) => 
      adminFetch(`/api/admin/hotels/${data.id}`, { 
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hotels"] });
      toast({ title: "Hotel updated successfully" });
      setEditingHotel(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update hotel", description: error.message, variant: "destructive" });
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async (data: { url: string; galleryUrl?: string; country?: string; city?: string }) => {
      const response = await adminFetch("/api/admin/hotels/scrape", {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hotels"] });
      const galleryInfo = data.scrapedData?.gallerySource === 'auto-discovered' 
        ? ` (images from gallery: ${data.scrapedData?.galleryUrl})`
        : data.scrapedData?.gallerySource === 'manual'
        ? ' (images from custom gallery URL)'
        : ' (images from homepage)';
      toast({ 
        title: "Hotel imported successfully", 
        description: `${data.hotel?.name || 'Hotel'} added with ${data.importedImageCount || 0} images${galleryInfo}` 
      });
      setScrapeUrl("");
      setScrapeGalleryUrl("");
      setScrapeCountry("");
      setScrapeCity("");
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to import hotel", description: error.message, variant: "destructive" });
    },
  });

  const importFromPackagesMutation = useMutation({
    mutationFn: async () => {
      const response = await adminFetch("/api/admin/hotels/import-from-packages", {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hotels"] });
      toast({ 
        title: "Import complete", 
        description: `Imported ${data.imported} hotels, skipped ${data.skipped} duplicates` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to import hotels", description: error.message, variant: "destructive" });
    },
  });

  const removeDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const response = await adminFetch("/api/admin/hotels/remove-duplicates", {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hotels"] });
      toast({ 
        title: "Duplicates removed", 
        description: `Removed ${data.removed} duplicate hotels` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove duplicates", description: error.message, variant: "destructive" });
    },
  });

  const handleScrape = () => {
    if (!scrapeUrl) {
      toast({ title: "Please enter a URL", variant: "destructive" });
      return;
    }
    scrapeMutation.mutate({ 
      url: scrapeUrl,
      galleryUrl: scrapeGalleryUrl || undefined,
      country: scrapeCountry || undefined, 
      city: scrapeCity || undefined 
    });
  };

  const filteredHotels = hotels.filter(hotel => 
    hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hotel.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hotel.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={`w-3 h-3 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Hotels Library</h1>
            <p className="text-muted-foreground">Import hotels from websites and manage hotel information</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search hotels by name, city, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-hotels"
            />
          </div>
          <Button 
            variant="outline"
            onClick={() => removeDuplicatesMutation.mutate()} 
            disabled={removeDuplicatesMutation.isPending}
            data-testid="button-remove-duplicates"
          >
            {removeDuplicatesMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Duplicates
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={() => importFromPackagesMutation.mutate()} 
            disabled={importFromPackagesMutation.isPending}
            data-testid="button-import-from-packages"
          >
            {importFromPackagesMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Hotel className="h-4 w-4 mr-2" />
                Import from Packages
              </>
            )}
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-import-hotel">
            <Plus className="h-4 w-4 mr-2" />
            Import from URL
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredHotels.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Hotel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hotels yet</h3>
              <p className="text-muted-foreground mb-4">
                Import hotels from websites to build your library for use in flight packages.
              </p>
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-import-first-hotel">
                <Plus className="h-4 w-4 mr-2" />
                Import First Hotel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredHotels.map((hotel) => (
              <Card key={hotel.id} className="overflow-hidden" data-testid={`card-hotel-${hotel.id}`}>
                {hotel.featuredImage && (
                  <div className="aspect-video bg-muted relative">
                    <img 
                      src={hotel.featuredImage} 
                      alt={hotel.name}
                      className="w-full h-full object-cover"
                    />
                    {hotel.starRating && (
                      <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded">
                        {renderStars(hotel.starRating)}
                      </div>
                    )}
                  </div>
                )}
                {!hotel.featuredImage && (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{hotel.name}</CardTitle>
                      {(hotel.city || hotel.country) && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          {[hotel.city, hotel.country].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                    {!hotel.featuredImage && hotel.starRating && renderStars(hotel.starRating)}
                  </div>
                </CardHeader>
                <CardContent>
                  {hotel.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {hotel.description}
                    </p>
                  )}
                  
                  {hotel.amenities && hotel.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {hotel.amenities.slice(0, 4).map((amenity, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                      {hotel.amenities.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{hotel.amenities.length - 4} more
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    {hotel.images && hotel.images.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {hotel.images.length} images
                      </span>
                    )}
                    {hotel.sourceUrl && (
                      <a 
                        href={hotel.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditingHotel(hotel)}
                      data-testid={`button-edit-hotel-${hotel.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-delete-hotel-${hotel.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Hotel</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove "{hotel.name}" from the library? 
                            This won't delete images already added to packages.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteMutation.mutate(hotel.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Import Hotel from URL</DialogTitle>
              <DialogDescription>
                Paste a hotel website URL to automatically extract images, description, and amenities.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="scrape-url">Hotel Homepage URL</Label>
                <Input
                  id="scrape-url"
                  placeholder="https://www.hotel-example.com"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  data-testid="input-scrape-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used to extract hotel name and description
                </p>
              </div>
              
              <div>
                <Label htmlFor="scrape-gallery-url">Gallery/Photos Page URL (optional)</Label>
                <Input
                  id="scrape-gallery-url"
                  placeholder="https://www.hotel-example.com/gallery"
                  value={scrapeGalleryUrl}
                  onChange={(e) => setScrapeGalleryUrl(e.target.value)}
                  data-testid="input-scrape-gallery-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to auto-discover gallery. Only use if auto-discovery fails.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scrape-country">Country (optional)</Label>
                  <Input
                    id="scrape-country"
                    placeholder="e.g. Turkey"
                    value={scrapeCountry}
                    onChange={(e) => setScrapeCountry(e.target.value)}
                    data-testid="input-scrape-country"
                  />
                </div>
                <div>
                  <Label htmlFor="scrape-city">City (optional)</Label>
                  <Input
                    id="scrape-city"
                    placeholder="e.g. Istanbul"
                    value={scrapeCity}
                    onChange={(e) => setScrapeCity(e.target.value)}
                    data-testid="input-scrape-city"
                  />
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                The scraper will automatically search for a gallery or photos page to get 
                high-quality images. If none found, it will fall back to homepage images.
              </p>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleScrape} 
                disabled={scrapeMutation.isPending}
                data-testid="button-start-scrape"
              >
                {scrapeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    Import Hotel
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Hotel Dialog */}
        <Dialog open={!!editingHotel} onOpenChange={(open) => !open && setEditingHotel(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Hotel</DialogTitle>
              <DialogDescription>
                Update hotel information
              </DialogDescription>
            </DialogHeader>
            
            {editingHotel && (
              <EditHotelForm 
                hotel={editingHotel}
                onSave={(updates) => updateMutation.mutate({ id: editingHotel.id, updates })}
                onCancel={() => setEditingHotel(null)}
                isPending={updateMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function EditHotelForm({ 
  hotel, 
  onSave, 
  onCancel, 
  isPending 
}: { 
  hotel: HotelType; 
  onSave: (updates: Partial<HotelType>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(hotel.name);
  const [description, setDescription] = useState(hotel.description || "");
  const [country, setCountry] = useState(hotel.country || "");
  const [city, setCity] = useState(hotel.city || "");
  const [starRating, setStarRating] = useState(hotel.starRating?.toString() || "");
  const [address, setAddress] = useState(hotel.address || "");
  const [phone, setPhone] = useState(hotel.phone || "");
  const [email, setEmail] = useState(hotel.email || "");
  const [website, setWebsite] = useState(hotel.website || "");
  const [amenities, setAmenities] = useState(hotel.amenities?.join(", ") || "");
  const [featuredImage, setFeaturedImage] = useState(hotel.featuredImage || "");

  const handleSubmit = () => {
    onSave({
      name,
      description: description || null,
      country: country || null,
      city: city || null,
      starRating: starRating ? parseInt(starRating, 10) : null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      website: website || null,
      amenities: amenities ? amenities.split(",").map(a => a.trim()).filter(Boolean) : [],
      featuredImage: featuredImage || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="edit-name">Hotel Name</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-edit-hotel-name"
          />
        </div>
        
        <div>
          <Label htmlFor="edit-country">Country</Label>
          <Input
            id="edit-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            data-testid="input-edit-hotel-country"
          />
        </div>
        
        <div>
          <Label htmlFor="edit-city">City</Label>
          <Input
            id="edit-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            data-testid="input-edit-hotel-city"
          />
        </div>
        
        <div>
          <Label htmlFor="edit-star-rating">Star Rating</Label>
          <Input
            id="edit-star-rating"
            type="number"
            min="1"
            max="5"
            value={starRating}
            onChange={(e) => setStarRating(e.target.value)}
            placeholder="1-5"
            data-testid="input-edit-hotel-rating"
          />
        </div>
        
        <div>
          <Label htmlFor="edit-phone">Phone</Label>
          <Input
            id="edit-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="input-edit-hotel-phone"
          />
        </div>
        
        <div>
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="input-edit-hotel-email"
          />
        </div>
        
        <div>
          <Label htmlFor="edit-website">Website</Label>
          <Input
            id="edit-website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            data-testid="input-edit-hotel-website"
          />
        </div>
        
        <div className="col-span-2">
          <Label htmlFor="edit-address">Address</Label>
          <Input
            id="edit-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            data-testid="input-edit-hotel-address"
          />
        </div>
        
        <div className="col-span-2">
          <Label htmlFor="edit-featured-image">Featured Image URL</Label>
          <Input
            id="edit-featured-image"
            value={featuredImage}
            onChange={(e) => setFeaturedImage(e.target.value)}
            placeholder="/api/media/image-slug/card"
            data-testid="input-edit-hotel-featured-image"
          />
          {featuredImage && (
            <div className="mt-2 rounded overflow-hidden w-32 h-20">
              <img src={featuredImage} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        
        <div className="col-span-2">
          <Label htmlFor="edit-amenities">Amenities (comma separated)</Label>
          <Input
            id="edit-amenities"
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="WiFi, Pool, Restaurant, Spa"
            data-testid="input-edit-hotel-amenities"
          />
        </div>
        
        <div className="col-span-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            data-testid="input-edit-hotel-description"
          />
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-hotel">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}
