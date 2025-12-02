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
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, Plus, Trash2, Edit2, Star, Save, X, Search, MessageSquare, Loader2
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Review, InsertReview } from "@shared/schema";

type ReviewFormData = {
  customerName: string;
  rating: number;
  reviewText: string;
  location: string;
  isPublished: boolean;
  displayOrder: number;
};

const emptyReview: ReviewFormData = {
  customerName: "",
  rating: 5,
  reviewText: "",
  location: "",
  isPublished: true,
  displayOrder: 0,
};

export default function AdminReviews() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [formData, setFormData] = useState<ReviewFormData>(emptyReview);

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/admin/reviews"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertReview) => apiRequest("POST", "/api/admin/reviews", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({ title: "Review created successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create review", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertReview> }) => 
      apiRequest("PATCH", `/api/admin/reviews/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({ title: "Review updated successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update review", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({ title: "Review deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete review", description: error.message, variant: "destructive" });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) => 
      apiRequest("PATCH", `/api/admin/reviews/${id}`, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update review", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingReview(null);
    setFormData(emptyReview);
  };

  const openCreateDialog = () => {
    setEditingReview(null);
    setFormData(emptyReview);
    setIsDialogOpen(true);
  };

  const openEditDialog = (review: Review) => {
    setEditingReview(review);
    setFormData({
      customerName: review.customerName,
      rating: review.rating,
      reviewText: review.reviewText,
      location: review.location || "",
      isPublished: review.isPublished,
      displayOrder: review.displayOrder || 0,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data: InsertReview = {
      customerName: formData.customerName,
      rating: formData.rating,
      reviewText: formData.reviewText,
      location: formData.location || undefined,
      isPublished: formData.isPublished,
      displayOrder: formData.displayOrder,
    };

    if (editingReview) {
      updateMutation.mutate({ id: editingReview.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredReviews = reviews.filter(review => 
    review.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    review.reviewText.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (review.location && review.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/packages">
              <Button variant="ghost" size="icon" data-testid="button-back-admin">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Reviews Management</h1>
            </div>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-review">
            <Plus className="h-4 w-4 mr-2" />
            Add Review
          </Button>
        </div>
      </header>

      <main className="container py-8 px-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Customer Reviews</CardTitle>
                <CardDescription>
                  Manage customer testimonials displayed on the homepage
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-reviews"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No reviews found</h3>
                <p className="text-muted-foreground mt-2">
                  {searchQuery ? "Try a different search term" : "Add your first customer review"}
                </p>
                {!searchQuery && (
                  <Button onClick={openCreateDialog} className="mt-4" data-testid="button-add-first-review">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Review
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="hidden md:table-cell">Review</TableHead>
                      <TableHead className="hidden sm:table-cell">Location</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReviews.map((review) => (
                      <TableRow key={review.id} data-testid={`row-review-${review.id}`}>
                        <TableCell className="font-medium">{review.customerName}</TableCell>
                        <TableCell>{renderStars(review.rating)}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-xs truncate">
                          {review.reviewText}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {review.location || "-"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={review.isPublished}
                            onCheckedChange={(checked) => 
                              togglePublishMutation.mutate({ id: review.id, isPublished: checked })
                            }
                            data-testid={`switch-publish-${review.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(review)}
                              data-testid={`button-edit-${review.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-delete-${review.id}`}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Review</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this review from {review.customerName}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(review.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid={`button-confirm-delete-${review.id}`}
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
      </main>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReview ? "Edit Review" : "Add New Review"}</DialogTitle>
            <DialogDescription>
              {editingReview ? "Update the customer review details" : "Create a new customer testimonial"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="e.g., John Smith"
                data-testid="input-customer-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">Rating *</Label>
              <Select
                value={formData.rating.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, rating: parseInt(value) }))}
              >
                <SelectTrigger data-testid="select-rating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Stars - Excellent</SelectItem>
                  <SelectItem value="4">4 Stars - Very Good</SelectItem>
                  <SelectItem value="3">3 Stars - Good</SelectItem>
                  <SelectItem value="2">2 Stars - Fair</SelectItem>
                  <SelectItem value="1">1 Star - Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reviewText">Review Text *</Label>
              <Textarea
                id="reviewText"
                value={formData.reviewText}
                onChange={(e) => setFormData(prev => ({ ...prev, reviewText: e.target.value }))}
                placeholder="Enter the customer's review..."
                rows={4}
                data-testid="input-review-text"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., London, UK"
                data-testid="input-location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                data-testid="input-display-order"
              />
              <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isPublished"
                checked={formData.isPublished}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublished: checked }))}
                data-testid="switch-is-published"
              />
              <Label htmlFor="isPublished">Published</Label>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-cancel">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </DialogClose>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.customerName || !formData.reviewText || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-review"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingReview ? "Update Review" : "Create Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
