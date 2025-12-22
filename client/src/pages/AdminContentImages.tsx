import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Image, MapPin, Tag, Loader2, Plus, X } from "lucide-react";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import { MediaPicker } from "@/components/MediaPicker";
import type { ContentImage, FlightPackage } from "@shared/schema";

type HomepageData = {
  specialOffers: FlightPackage[];
  destinations: { name: string; count: number; image: string | null }[];
  collections: { tag: string; count: number; image: string | null }[];
  blogPosts: any[];
};

export default function AdminContentImages() {
  const { toast } = useToast();

  const { data: contentImages = [], isLoading: imagesLoading } = useQuery<ContentImage[]>({
    queryKey: ["/api/admin/content-images"],
  });

  const { data: homepageData, isLoading: homepageLoading } = useQuery<HomepageData>({
    queryKey: ["/api/packages/homepage"],
  });

  const upsertMutation = useMutation({
    mutationFn: (data: { type: string; name: string; imageUrl: string }) =>
      apiRequest("POST", "/api/admin/content-images", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages/homepage"] });
      toast({ title: "Image saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save image", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/content-images/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages/homepage"] });
      toast({ title: "Custom image removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove image", description: error.message, variant: "destructive" });
    },
  });

  const getCustomImage = (type: string, name: string) => {
    return contentImages.find(img => img.type === type && img.name === name);
  };

  const handleImageSelect = (type: string, name: string, imageUrl: string) => {
    upsertMutation.mutate({ type, name, imageUrl });
  };

  const destinations = homepageData?.destinations || [];
  const collections = homepageData?.collections || [];

  const isLoading = imagesLoading || homepageLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/packages">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="heading-content-images">
              <Image className="w-8 h-8" />
              Content Images
            </h1>
            <p className="text-muted-foreground mt-1">
              Control images displayed for destinations and collections on the homepage
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="destinations" className="space-y-6">
            <TabsList>
              <TabsTrigger value="destinations" className="gap-2" data-testid="tab-destinations">
                <MapPin className="w-4 h-4" />
                Destinations ({destinations.length})
              </TabsTrigger>
              <TabsTrigger value="collections" className="gap-2" data-testid="tab-collections">
                <Tag className="w-4 h-4" />
                Collections ({collections.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="destinations">
              <Card>
                <CardHeader>
                  <CardTitle>Destination Images</CardTitle>
                  <CardDescription>
                    Set custom images for each destination (country). If not set, the first package image is used.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {destinations.map((dest) => {
                      const customImage = getCustomImage("destination", dest.name);
                      const displayImage = customImage?.imageUrl || dest.image;
                      
                      return (
                        <div 
                          key={dest.name} 
                          className="border rounded-lg overflow-hidden"
                          data-testid={`destination-${dest.name}`}
                        >
                          <div className="relative h-32 bg-muted">
                            {displayImage ? (
                              <img 
                                src={getProxiedImageUrl(displayImage)}
                                alt={dest.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Image className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            {customImage && (
                              <div className="absolute top-2 right-2">
                                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                  Custom
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-semibold">{dest.name}</h3>
                            <p className="text-sm text-muted-foreground">{dest.count} packages</p>
                            <div className="flex gap-2 mt-3">
                              <MediaPicker
                                onSelect={(imageUrl) => handleImageSelect("destination", dest.name, imageUrl)}
                                destination={dest.name}
                                trigger={
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    data-testid={`button-edit-${dest.name}`}
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    {customImage ? "Change" : "Set Image"}
                                  </Button>
                                }
                              />
                              {customImage && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(customImage.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-${dest.name}`}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="collections">
              <Card>
                <CardHeader>
                  <CardTitle>Collection Images</CardTitle>
                  <CardDescription>
                    Set custom images for each collection (tag). If not set, the first package image is used.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {collections.map((collection) => {
                      const customImage = getCustomImage("collection", collection.tag);
                      const displayImage = customImage?.imageUrl || collection.image;
                      
                      return (
                        <div 
                          key={collection.tag} 
                          className="border rounded-lg overflow-hidden"
                          data-testid={`collection-${collection.tag}`}
                        >
                          <div className="relative h-32 bg-muted">
                            {displayImage ? (
                              <img 
                                src={getProxiedImageUrl(displayImage)}
                                alt={collection.tag}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Image className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            {customImage && (
                              <div className="absolute top-2 right-2">
                                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                  Custom
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-semibold">{collection.tag}</h3>
                            <p className="text-sm text-muted-foreground">{collection.count} packages</p>
                            <div className="flex gap-2 mt-3">
                              <MediaPicker
                                onSelect={(imageUrl) => handleImageSelect("collection", collection.tag, imageUrl)}
                                trigger={
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    data-testid={`button-edit-${collection.tag}`}
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    {customImage ? "Change" : "Set Image"}
                                  </Button>
                                }
                              />
                              {customImage && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(customImage.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-${collection.tag}`}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
