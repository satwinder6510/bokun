import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, Plus, Trash2, Edit2, Phone, Save, X, Search, Loader2, Eye, BarChart3
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import type { TrackingNumber, InsertTrackingNumber } from "@shared/schema";

type TrackingNumberFormData = {
  phoneNumber: string;
  label: string;
  source: string;
  campaign: string;
  medium: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
};

const emptyForm: TrackingNumberFormData = {
  phoneNumber: "",
  label: "",
  source: "",
  campaign: "",
  medium: "",
  isDefault: false,
  isActive: true,
  displayOrder: 0,
};

export default function AdminTrackingNumbers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<TrackingNumber | null>(null);
  const [formData, setFormData] = useState<TrackingNumberFormData>(emptyForm);

  const { data: trackingNumbers = [], isLoading } = useQuery<TrackingNumber[]>({
    queryKey: ["/api/admin/tracking-numbers"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertTrackingNumber) => apiRequest("POST", "/api/admin/tracking-numbers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tracking-numbers"] });
      toast({ title: "Tracking number created successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create tracking number", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertTrackingNumber> }) => 
      apiRequest("PATCH", `/api/admin/tracking-numbers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tracking-numbers"] });
      toast({ title: "Tracking number updated successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update tracking number", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/tracking-numbers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tracking-numbers"] });
      toast({ title: "Tracking number deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete tracking number", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      apiRequest("PATCH", `/api/admin/tracking-numbers/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tracking-numbers"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update tracking number", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingNumber(null);
    setFormData(emptyForm);
  };

  const openCreateDialog = () => {
    setEditingNumber(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (number: TrackingNumber) => {
    setEditingNumber(number);
    setFormData({
      phoneNumber: number.phoneNumber,
      label: number.label,
      source: number.source || "",
      campaign: number.campaign || "",
      medium: number.medium || "",
      isDefault: number.isDefault,
      isActive: number.isActive,
      displayOrder: number.displayOrder || 0,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data: InsertTrackingNumber = {
      phoneNumber: formData.phoneNumber,
      label: formData.label,
      source: formData.source || null,
      campaign: formData.campaign || null,
      medium: formData.medium || null,
      isDefault: formData.isDefault,
      isActive: formData.isActive,
      displayOrder: formData.displayOrder,
    };

    if (editingNumber) {
      updateMutation.mutate({ id: editingNumber.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredNumbers = trackingNumbers.filter(num => 
    num.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    num.phoneNumber.includes(searchQuery) ||
    (num.source?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (num.campaign?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const totalImpressions = trackingNumbers.reduce((sum, num) => sum + (num.impressions || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Tracking Numbers</h1>
            <p className="text-muted-foreground">Manage dynamic number insertion for call tracking</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Numbers</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-numbers">{trackingNumbers.length}</div>
              <p className="text-xs text-muted-foreground">
                {trackingNumbers.filter(n => n.isActive).length} active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-impressions">{totalImpressions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Times numbers were displayed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Default Number</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate" data-testid="text-default-number">
                {trackingNumbers.find(n => n.isDefault)?.phoneNumber || "Not set"}
              </div>
              <p className="text-xs text-muted-foreground">Shown when no source matches</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>All Tracking Numbers</CardTitle>
                <CardDescription>
                  Configure phone numbers for different marketing sources
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog} data-testid="button-add-number">
                <Plus className="w-4 h-4 mr-2" />
                Add Number
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by label, number, or source..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNumbers.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tracking numbers found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "Try a different search term" : "Add your first tracking number to get started"}
                </p>
                {!searchQuery && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Number
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-center">Impressions</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNumbers.map((number) => (
                      <TableRow key={number.id} data-testid={`row-tracking-number-${number.id}`}>
                        <TableCell className="font-mono font-medium">
                          {number.phoneNumber}
                          {number.isDefault && (
                            <Badge variant="secondary" className="ml-2">Default</Badge>
                          )}
                        </TableCell>
                        <TableCell>{number.label}</TableCell>
                        <TableCell>
                          {number.source ? (
                            <Badge variant="outline">{number.source}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Any</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {number.campaign ? (
                            <Badge variant="outline">{number.campaign}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Any</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {(number.impressions || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={number.isActive}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: number.id, isActive: checked })
                            }
                            data-testid={`switch-active-${number.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(number)}
                              data-testid={`button-edit-${number.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-delete-${number.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Tracking Number</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{number.label}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(number.id)}
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              <strong>Dynamic Number Insertion (DNI)</strong> displays different phone numbers to visitors 
              based on how they arrived at your site. This allows you to track which marketing channels 
              drive phone calls.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold text-foreground mb-2">UTM Parameters</h4>
                <p>Numbers are matched based on URL parameters:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><code className="bg-muted px-1 rounded">utm_source</code> - Traffic source (google, facebook)</li>
                  <li><code className="bg-muted px-1 rounded">utm_campaign</code> - Campaign name</li>
                  <li><code className="bg-muted px-1 rounded">utm_medium</code> - Marketing medium (cpc, email)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Matching Priority</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Exact match (source + campaign + medium)</li>
                  <li>Source + campaign match</li>
                  <li>Source + medium match</li>
                  <li>Source only match</li>
                  <li>Default number (fallback)</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNumber ? "Edit Tracking Number" : "Add Tracking Number"}
            </DialogTitle>
            <DialogDescription>
              {editingNumber 
                ? "Update the tracking number details" 
                : "Add a new phone number for call tracking"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="e.g., 0208 183 0518"
                data-testid="input-phone-number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Google Ads - Brand Campaign"
                data-testid="input-label"
              />
              <p className="text-xs text-muted-foreground">A descriptive name for this number</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="e.g., google"
                  data-testid="input-source"
                />
                <p className="text-xs text-muted-foreground">utm_source value</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign</Label>
                <Input
                  id="campaign"
                  value={formData.campaign}
                  onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                  placeholder="e.g., summer_sale"
                  data-testid="input-campaign"
                />
                <p className="text-xs text-muted-foreground">utm_campaign value</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="medium">Medium</Label>
              <Input
                id="medium"
                value={formData.medium}
                onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                placeholder="e.g., cpc, email, social"
                data-testid="input-medium"
              />
              <p className="text-xs text-muted-foreground">utm_medium value (optional)</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">Default Number</Label>
                <p className="text-xs text-muted-foreground">Show when no source matches</p>
              </div>
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                data-testid="switch-is-default"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">Include in number matching</p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-is-active"
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </DialogClose>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.phoneNumber || !formData.label || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingNumber ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
