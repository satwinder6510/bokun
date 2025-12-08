import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Image as ImageIcon,
  Upload,
  Search,
  Trash2,
  RefreshCw,
  Tag,
  ExternalLink,
  Clock,
  FileImage,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Undo2,
  Play,
  Eye,
  Filter,
  Download,
} from "lucide-react";

type MediaAsset = {
  id: number;
  slug: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  source: string;
  externalSourceId: string | null;
  externalSourceUrl: string | null;
  creditRequired: boolean;
  creditText: string | null;
  perceptualHash: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type CleanupJob = {
  id: number;
  jobType: string;
  status: string;
  affectedCount: number;
  createdBy: string;
  createdAt: string;
  previewedAt: string | null;
  executedAt: string | null;
  rolledBackAt: string | null;
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

export default function AdminMedia() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockResults, setStockResults] = useState<StockImage[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [cleanupType, setCleanupType] = useState("hotel_images_in_destination");

  // Fetch media assets
  const { data: assets = [], isLoading: assetsLoading, refetch: refetchAssets } = useQuery<MediaAsset[]>({
    queryKey: ['/api/admin/media/assets', sourceFilter],
    queryFn: async () => {
      const url = sourceFilter === 'all' 
        ? '/api/admin/media/assets?limit=100'
        : `/api/admin/media/assets?limit=100&source=${sourceFilter}`;
      return apiRequest('GET', url);
    },
  });

  // Fetch cleanup jobs
  const { data: cleanupJobs = [], refetch: refetchJobs } = useQuery<CleanupJob[]>({
    queryKey: ['/api/admin/media/cleanup-jobs'],
  });

  // Fetch stock API status
  const { data: stockStatus } = useQuery<{ unsplash: boolean; pexels: boolean }>({
    queryKey: ['/api/admin/media/stock/status'],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: {
          'X-Admin-Session': localStorage.getItem('adminSession') || '',
        },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Image uploaded successfully" });
      refetchAssets();
      setUploadDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/media/assets/${id}`),
    onSuccess: () => {
      toast({ title: "Asset deleted" });
      refetchAssets();
      setSelectedAsset(null);
    },
  });

  // Cleanup preview mutation
  const previewCleanupMutation = useMutation({
    mutationFn: (jobType: string) => apiRequest('POST', '/api/admin/media/cleanup-jobs', { jobType, scope: {} }),
    onSuccess: (data) => {
      toast({ title: "Cleanup previewed", description: `${data.preview.totalCount} items affected` });
      refetchJobs();
    },
  });

  // Execute cleanup mutation
  const executeCleanupMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest('POST', `/api/admin/media/cleanup-jobs/${jobId}/execute`),
    onSuccess: () => {
      toast({ title: "Cleanup executed successfully" });
      refetchJobs();
      refetchAssets();
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest('POST', `/api/admin/media/cleanup-jobs/${jobId}/rollback`),
    onSuccess: () => {
      toast({ title: "Cleanup rolled back" });
      refetchJobs();
      refetchAssets();
    },
  });

  // Stock image import mutation
  const importStockMutation = useMutation({
    mutationFn: (image: StockImage) => apiRequest('POST', '/api/admin/media/stock/import', { image, tags: [] }),
    onSuccess: () => {
      toast({ title: "Image imported successfully" });
      refetchAssets();
    },
  });

  // Search stock images
  const handleSearchStock = async () => {
    if (!stockSearchQuery.trim()) return;
    setIsSearchingStock(true);
    try {
      const results = await apiRequest('GET', `/api/admin/media/stock/search?query=${encodeURIComponent(stockSearchQuery)}&perPage=24`);
      setStockResults(results);
    } catch (error) {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setIsSearchingStock(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    formData.append('tags', JSON.stringify([]));
    
    uploadMutation.mutate(formData);
  };

  // Filter assets by search query
  const filteredAssets = assets.filter(asset => 
    asset.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'previewed': return 'bg-yellow-500';
      case 'rolled_back': return 'bg-orange-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-muted-foreground">Manage images across packages, blogs, destinations, and tours</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetchAssets()} data-testid="button-refresh-assets">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-image">
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Image</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Image File</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadMutation.isPending}
                    data-testid="input-upload-file"
                  />
                </div>
                {uploadMutation.isPending && (
                  <div className="text-center py-4">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p>Processing image and generating variants...</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="library" data-testid="tab-library">
            <FileImage className="w-4 h-4 mr-2" />
            Library ({assets.length})
          </TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock">
            <Download className="w-4 h-4 mr-2" />
            Stock Images
          </TabsTrigger>
          <TabsTrigger value="cleanup" data-testid="tab-cleanup">
            <Trash2 className="w-4 h-4 mr-2" />
            Cleanup Jobs
          </TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent value="library">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by filename or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-assets"
                />
              </div>
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48" data-testid="select-source-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="upload">Uploaded</SelectItem>
                <SelectItem value="unsplash">Unsplash</SelectItem>
                <SelectItem value="pexels">Pexels</SelectItem>
                <SelectItem value="migration">Migrated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assetsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No media assets found</h3>
                <p className="text-muted-foreground mb-4">Upload images or import from stock photo services</p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload First Image
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredAssets.map((asset) => (
                <Card
                  key={asset.id}
                  className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary ${
                    selectedAsset?.id === asset.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedAsset(asset)}
                  data-testid={`card-asset-${asset.id}`}
                >
                  <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                    <img
                      src={`/api/media/${asset.slug}/thumb`}
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                      }}
                    />
                    <Badge className="absolute top-2 right-2 text-xs" variant="secondary">
                      {asset.source}
                    </Badge>
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-medium truncate" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {asset.width}x{asset.height} · {formatBytes(asset.fileSize)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Asset Detail Panel */}
          {selectedAsset && (
            <Dialog open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Asset Details</DialogTitle>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-4">
                      <img
                        src={`/api/media/${selectedAsset.slug}/gallery`}
                        alt={selectedAsset.filename}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/media/${selectedAsset.slug}/hero`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Hero
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/media/${selectedAsset.slug}/gallery`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Gallery
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/media/${selectedAsset.slug}/card`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Card
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Filename</Label>
                      <p className="font-medium">{selectedAsset.filename}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Slug</Label>
                      <p className="font-mono text-sm">{selectedAsset.slug}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Dimensions</Label>
                        <p>{selectedAsset.width} × {selectedAsset.height}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">File Size</Label>
                        <p>{formatBytes(selectedAsset.fileSize)}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Source</Label>
                      <Badge variant="outline" className="ml-2">{selectedAsset.source}</Badge>
                    </div>
                    {selectedAsset.creditRequired && selectedAsset.creditText && (
                      <div>
                        <Label className="text-muted-foreground">Credit Required</Label>
                        <p className="text-sm">{selectedAsset.creditText}</p>
                      </div>
                    )}
                    <Separator />
                    <Button
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(selectedAsset.id)}
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-asset"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Asset
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* Stock Images Tab */}
        <TabsContent value="stock">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Stock Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search for images (e.g., 'beach vacation', 'hotel lobby')"
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchStock()}
                    data-testid="input-stock-search"
                  />
                </div>
                <Button 
                  onClick={handleSearchStock} 
                  disabled={isSearchingStock || !stockSearchQuery.trim()}
                  data-testid="button-stock-search"
                >
                  {isSearchingStock ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2">Search</span>
                </Button>
              </div>

              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Unsplash:</span>
                  {stockStatus?.unsplash ? (
                    <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600"><XCircle className="w-3 h-3 mr-1" />Not configured</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Pexels:</span>
                  {stockStatus?.pexels ? (
                    <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600"><XCircle className="w-3 h-3 mr-1" />Not configured</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {stockResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {stockResults.map((image) => (
                <Card key={`${image.provider}-${image.id}`} className="overflow-hidden">
                  <div className="aspect-square relative bg-muted">
                    <img
                      src={image.previewUrl}
                      alt={image.description}
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute top-2 right-2 text-xs capitalize">
                      {image.provider}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground truncate mb-2" title={image.photographer}>
                      by {image.photographer}
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => importStockMutation.mutate(image)}
                      disabled={importStockMutation.isPending}
                      data-testid={`button-import-${image.provider}-${image.id}`}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Import
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {stockResults.length === 0 && stockSearchQuery && !isSearchingStock && (
            <Card>
              <CardContent className="py-12 text-center">
                <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground">Try different search terms</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cleanup Tab */}
        <TabsContent value="cleanup">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Create Cleanup Job
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Cleanup Type</Label>
                  <Select value={cleanupType} onValueChange={setCleanupType}>
                    <SelectTrigger data-testid="select-cleanup-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel_images_in_destination">Hotel images in destination galleries</SelectItem>
                      <SelectItem value="duplicate_images">Duplicate images (by hash)</SelectItem>
                      <SelectItem value="unused_images">Unused images (30+ days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Safe by Design:</strong> All cleanup operations create a backup before execution and can be rolled back within 30 days.
                  </p>
                </div>
                <Button
                  onClick={() => previewCleanupMutation.mutate(cleanupType)}
                  disabled={previewCleanupMutation.isPending}
                  className="w-full"
                  data-testid="button-preview-cleanup"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Changes (Dry Run)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Cleanup Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {cleanupJobs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No cleanup jobs yet</p>
                  ) : (
                    <div className="space-y-3">
                      {cleanupJobs.map((job) => (
                        <div key={job.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={getStatusColor(job.status)} variant="outline">
                              {job.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(job.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">{job.jobType}</p>
                          <p className="text-xs text-muted-foreground mb-2">{job.affectedCount} items affected</p>
                          <div className="flex gap-2">
                            {job.status === 'previewed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => executeCleanupMutation.mutate(job.id)}
                                disabled={executeCleanupMutation.isPending}
                                data-testid={`button-execute-${job.id}`}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Execute
                              </Button>
                            )}
                            {job.status === 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rollbackMutation.mutate(job.id)}
                                disabled={rollbackMutation.isPending}
                                data-testid={`button-rollback-${job.id}`}
                              >
                                <Undo2 className="w-3 h-3 mr-1" />
                                Rollback
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}