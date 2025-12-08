import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Search, Upload, Image as ImageIcon, Check, MapPin, Eye } from "lucide-react";

type PackageUsage = {
  packageId: number;
  packageTitle: string;
  usageType: string;
};

type MediaAsset = {
  id: number;
  slug: string;
  filename?: string;
  mimeType: string;
  width: number;
  height: number;
  source: string;
  destinations?: string[];
  usedInPackages?: PackageUsage[];
};

type StockImage = {
  id: string;
  provider: 'unsplash' | 'pexels';
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
  description: string;
};

type MediaPickerProps = {
  onSelect: (imageUrl: string) => void;
  trigger?: React.ReactNode;
  multiple?: boolean;
  onSelectMultiple?: (imageUrls: string[]) => void;
  destination?: string;
  currentPackageId?: number;
};

export function MediaPicker({ 
  onSelect, 
  trigger, 
  multiple = false, 
  onSelectMultiple,
  destination,
  currentPackageId
}: MediaPickerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockSearchQuery, setStockSearchQuery] = useState(destination || "");
  const [stockResults, setStockResults] = useState<StockImage[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [hideInUse, setHideInUse] = useState(false);

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

  const { data: assets = [], isLoading: assetsLoading, refetch: refetchAssets } = useQuery<MediaAsset[]>({
    queryKey: ['/api/admin/media/assets', 'picker', destination],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (destination) {
        params.set('destination', destination);
      }
      return adminFetch(`/api/admin/media/assets?${params.toString()}`);
    },
    enabled: open,
  });

  const importStockMutation = useMutation({
    mutationFn: async (image: StockImage) => {
      const tags = destination ? [{ type: 'destination', value: destination }] : [];
      return adminFetch('/api/admin/media/stock/import', {
        method: 'POST',
        body: JSON.stringify({ image, tags }),
      });
    },
    onSuccess: (data) => {
      toast({ title: "Image imported successfully" });
      refetchAssets();
      const imageUrl = `/api/media/${data.slug}/card`;
      if (multiple) {
        setSelectedImages(prev => [...prev, imageUrl]);
      } else {
        onSelect(imageUrl);
        setOpen(false);
      }
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      const tags = destination ? [{ type: 'destination', value: destination }] : [];
      formData.append('tags', JSON.stringify(tags));
      const response = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: {
          'X-Admin-Session': localStorage.getItem('admin_session_token') || '',
        },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Image uploaded successfully" });
      refetchAssets();
      const imageUrl = `/api/media/${data.slug}/card`;
      if (multiple) {
        setSelectedImages(prev => [...prev, imageUrl]);
      } else {
        onSelect(imageUrl);
        setOpen(false);
      }
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSearchStock = async () => {
    if (!stockSearchQuery.trim()) return;
    setIsSearchingStock(true);
    try {
      const results = await adminFetch(`/api/admin/media/stock/search?query=${encodeURIComponent(stockSearchQuery)}&perPage=20`);
      setStockResults(results);
    } catch (error: any) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleSelectLibraryImage = (asset: MediaAsset) => {
    const imageUrl = `/api/media/${asset.slug}/card`;
    if (multiple) {
      if (selectedImages.includes(imageUrl)) {
        setSelectedImages(prev => prev.filter(url => url !== imageUrl));
      } else {
        setSelectedImages(prev => [...prev, imageUrl]);
      }
    } else {
      onSelect(imageUrl);
      setOpen(false);
    }
  };

  const handleConfirmMultiple = () => {
    if (onSelectMultiple && selectedImages.length > 0) {
      onSelectMultiple(selectedImages);
      setSelectedImages([]);
      setOpen(false);
    }
  };

  const isUsedInOtherPackages = (asset: MediaAsset): boolean => {
    if (!asset.usedInPackages || asset.usedInPackages.length === 0) return false;
    if (!currentPackageId) return asset.usedInPackages.length > 0;
    return asset.usedInPackages.some(u => u.packageId !== currentPackageId);
  };

  const getUsageTooltip = (asset: MediaAsset): string => {
    if (!asset.usedInPackages || asset.usedInPackages.length === 0) return "";
    const otherPackages = currentPackageId 
      ? asset.usedInPackages.filter(u => u.packageId !== currentPackageId)
      : asset.usedInPackages;
    if (otherPackages.length === 0) return "";
    return otherPackages.map(u => `${u.packageTitle} (${u.usageType})`).join(", ");
  };

  // Filter and sort assets
  let filteredAssets = assets.filter(asset =>
    (asset.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.slug.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Optionally hide in-use images
  if (hideInUse) {
    filteredAssets = filteredAssets.filter(asset => !isUsedInOtherPackages(asset));
  }

  // Sort: matching destination first, then by whether in-use
  if (destination) {
    filteredAssets.sort((a, b) => {
      const aHasDest = a.destinations?.some(d => d.toLowerCase() === destination.toLowerCase()) ? 1 : 0;
      const bHasDest = b.destinations?.some(d => d.toLowerCase() === destination.toLowerCase()) ? 1 : 0;
      if (aHasDest !== bHasDest) return bHasDest - aHasDest;
      const aInUse = isUsedInOtherPackages(a) ? 1 : 0;
      const bInUse = isUsedInOtherPackages(b) ? 1 : 0;
      return aInUse - bInUse;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" data-testid="button-open-media-picker">
            <ImageIcon className="h-4 w-4 mr-2" />
            Choose Image
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Select Image
            {destination && (
              <Badge variant="outline" className="ml-2">
                <MapPin className="h-3 w-3 mr-1" />
                {destination}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="library" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="library" data-testid="tab-library">Library</TabsTrigger>
            <TabsTrigger value="stock" data-testid="tab-stock">Stock Photos</TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-4">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
                data-testid="input-search-library"
              />
              <Button
                variant={hideInUse ? "default" : "outline"}
                size="sm"
                onClick={() => setHideInUse(!hideInUse)}
                data-testid="button-toggle-hide-inuse"
              >
                <Eye className="h-4 w-4 mr-1" />
                {hideInUse ? "Show All" : "Hide In-Use"}
              </Button>
            </div>
            <ScrollArea className="h-[400px]">
              {assetsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No images in library. Try the Stock Photos or Upload tab.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {filteredAssets.map((asset) => {
                    const imageUrl = `/api/media/${asset.slug}/card`;
                    const isSelected = selectedImages.includes(imageUrl);
                    const inUse = isUsedInOtherPackages(asset);
                    const usageTooltip = getUsageTooltip(asset);
                    const hasDestination = destination && asset.destinations?.some(
                      d => d.toLowerCase() === destination.toLowerCase()
                    );
                    
                    return (
                      <Tooltip key={asset.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                              isSelected ? 'border-primary ring-2 ring-primary/20' : 
                              inUse ? 'border-muted opacity-60' :
                              'border-transparent hover:border-muted-foreground/30'
                            }`}
                            onClick={() => handleSelectLibraryImage(asset)}
                            data-testid={`media-item-${asset.id}`}
                          >
                            <img
                              src={`/api/media/${asset.slug}/thumb`}
                              alt={asset.filename || asset.slug}
                              className={`w-full aspect-[4/3] object-cover ${inUse ? 'grayscale-[30%]' : ''}`}
                            />
                            {inUse && (
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Badge variant="secondary" className="text-xs bg-background/90">
                                  In Use
                                </Badge>
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                            {hasDestination && !inUse && (
                              <Badge variant="default" className="absolute top-1 left-1 text-xs">
                                <MapPin className="h-2 w-2 mr-0.5" />
                                {destination}
                              </Badge>
                            )}
                            {!hasDestination && (
                              <Badge variant="secondary" className="absolute bottom-1 left-1 text-xs">
                                {asset.source}
                              </Badge>
                            )}
                          </div>
                        </TooltipTrigger>
                        {usageTooltip && (
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-xs">Used in: {usageTooltip}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stock" className="mt-4">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search Unsplash & Pexels..."
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchStock()}
                className="flex-1"
                data-testid="input-search-stock"
              />
              <Button onClick={handleSearchStock} disabled={isSearchingStock} data-testid="button-search-stock">
                {isSearchingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {destination && (
              <p className="text-xs text-muted-foreground mb-3">
                Tip: Search pre-filled with "{destination}" - imported images will be tagged with this destination.
              </p>
            )}
            <ScrollArea className="h-[400px]">
              {stockResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Search for images above. Try "{destination || 'beach'}", "mountains", or "travel".
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {stockResults.map((image) => (
                    <div
                      key={`${image.provider}-${image.id}`}
                      className="relative cursor-pointer rounded-lg overflow-hidden border hover:border-primary transition-colors group"
                      onClick={() => importStockMutation.mutate(image)}
                      data-testid={`stock-image-${image.id}`}
                    >
                      <img
                        src={image.previewUrl}
                        alt={image.description}
                        className="w-full aspect-[4/3] object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {importStockMutation.isPending ? (
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        ) : (
                          <span className="text-white text-sm font-medium">Click to Import</span>
                        )}
                      </div>
                      <Badge 
                        variant={image.provider === 'unsplash' ? 'default' : 'secondary'} 
                        className="absolute top-1 left-1 text-xs"
                      >
                        {image.provider}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-lg">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Upload an image from your computer</p>
              {destination && (
                <p className="text-xs text-muted-foreground mb-4">
                  Image will be tagged with: <Badge variant="outline">{destination}</Badge>
                </p>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="media-picker-upload"
                data-testid="input-file-upload"
              />
              <label htmlFor="media-picker-upload">
                <Button variant="outline" asChild disabled={uploadMutation.isPending}>
                  <span>
                    {uploadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Choose File
                  </span>
                </Button>
              </label>
            </div>
          </TabsContent>
        </Tabs>

        {multiple && selectedImages.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
            </span>
            <Button onClick={handleConfirmMultiple} data-testid="button-confirm-selection">
              Add Selected Images
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
