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
  ArrowLeft, Plus, Trash2, Edit2, Phone, Save, X, Loader2, ExternalLink
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
  tag: string;
  isDefault: boolean;
  isActive: boolean;
};

const emptyForm: TrackingNumberFormData = {
  phoneNumber: "",
  label: "",
  tag: "",
  isDefault: false,
  isActive: true,
};

export default function AdminTrackingNumbers() {
  const { toast } = useToast();
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
      label: number.label || "",
      tag: number.tag || "",
      isDefault: number.isDefault,
      isActive: number.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data: InsertTrackingNumber = {
      phoneNumber: formData.phoneNumber,
      label: formData.label || null,
      tag: formData.tag || null,
      isDefault: formData.isDefault,
      isActive: formData.isActive,
    };

    if (editingNumber) {
      updateMutation.mutate({ id: editingNumber.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const defaultNumber = trackingNumbers.find(n => n.isDefault);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Tracking Numbers</h1>
            <p className="text-muted-foreground">Show different phone numbers based on URL tags</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
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
              <CardTitle className="text-sm font-medium">Default Number</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate" data-testid="text-default-number">
                {defaultNumber?.phoneNumber || "Not set"}
              </div>
              <p className="text-xs text-muted-foreground">Shown when no tag matches</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>All Tracking Numbers</CardTitle>
                <CardDescription>
                  Add tags and phone numbers for different campaigns
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog} data-testid="button-add-number">
                <Plus className="w-4 h-4 mr-2" />
                Add Number
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : trackingNumbers.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tracking numbers yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first tracking number to get started
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Number
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackingNumbers.map((number) => (
                      <TableRow key={number.id} data-testid={`row-tracking-number-${number.id}`}>
                        <TableCell className="font-mono font-medium">
                          {number.phoneNumber}
                          {number.isDefault && (
                            <Badge variant="secondary" className="ml-2">Default</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {number.tag ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">?{number.tag}</Badge>
                              <a 
                                href={`/?${number.tag}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {number.label || <span className="text-muted-foreground">—</span>}
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
                                    Are you sure you want to delete this tracking number? This action cannot be undone.
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
              Show different phone numbers based on a simple tag in the URL. 
              When visitors arrive via a tagged link, they'll see the matching phone number throughout the site.
            </p>
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Example:</h4>
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p>1. Create a tracking number with tag <code className="bg-background px-1 rounded">tzl</code></p>
                <p>2. Share the URL: <code className="bg-background px-1 rounded">tours.flightsandpackages.com/?tzl</code></p>
                <p>3. Visitors from that link see your campaign phone number</p>
              </div>
              <p className="text-xs">
                The tag is remembered during the visitor's session, so they'll see the same number as they browse the site.
              </p>
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
                : "Add a phone number with an optional tag for tracking"}
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
              <Label htmlFor="tag">Tag</Label>
              <Input
                id="tag"
                value={formData.tag}
                onChange={(e) => setFormData({ ...formData, tag: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                placeholder="e.g., tzl, fb, gads"
                className="font-mono"
                data-testid="input-tag"
              />
              <p className="text-xs text-muted-foreground">
                URL will be: tours.flightsandpackages.com/?{formData.tag || "tag"}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., TikTok Campaign"
                data-testid="input-label"
              />
              <p className="text-xs text-muted-foreground">For your reference only</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">Default Number</Label>
                <p className="text-xs text-muted-foreground">Show when no tag matches</p>
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
                <p className="text-xs text-muted-foreground">Enable this tracking number</p>
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
              disabled={!formData.phoneNumber || createMutation.isPending || updateMutation.isPending}
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
