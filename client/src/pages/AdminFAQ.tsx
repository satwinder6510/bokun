import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFaqSchema, updateFaqSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Plus, Edit, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Faq, InsertFaq, UpdateFaq } from "@shared/schema";

export default function AdminFAQ() {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form for creating/editing FAQs
  const form = useForm<InsertFaq | UpdateFaq>({
    resolver: zodResolver(editingId !== null ? updateFaqSchema : insertFaqSchema),
    defaultValues: {
      question: "",
      answer: "",
      displayOrder: 0,
      isPublished: true,
    },
  });

  // Fetch all FAQs
  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ["/api/faqs/admin"],
  });

  // Create FAQ mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertFaq) => {
      return await apiRequest("POST", "/api/faqs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      setIsAdding(false);
      form.reset();
      toast({ title: "FAQ created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create FAQ", variant: "destructive" });
    },
  });

  // Update FAQ mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateFaq }) => {
      return await apiRequest("PATCH", `/api/faqs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      setEditingId(null);
      form.reset();
      toast({ title: "FAQ updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update FAQ", variant: "destructive" });
    },
  });

  // Delete FAQ mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/faqs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      toast({ title: "FAQ deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete FAQ", variant: "destructive" });
    },
  });

  const handleSubmit = (data: InsertFaq | UpdateFaq) => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: data as UpdateFaq });
    } else {
      createMutation.mutate(data as InsertFaq);
    }
  };

  const handleEdit = (faq: Faq) => {
    setEditingId(faq.id);
    form.reset({
      question: faq.question,
      answer: faq.answer,
      displayOrder: faq.displayOrder,
      isPublished: faq.isPublished,
    });
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    form.reset({
      question: "",
      answer: "",
      displayOrder: 0,
      isPublished: true,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold" data-testid="heading-faq-management">FAQ Management</h1>
          <div className="flex gap-2">
            <a href="/dashboard">
              <Button variant="outline" data-testid="button-back-dashboard">
                Back to Dashboard
              </Button>
            </a>
            {!isAdding && editingId === null && (
              <Button onClick={() => setIsAdding(true)} data-testid="button-add-faq">
                <Plus className="w-4 h-4 mr-2" />
                Add FAQ
              </Button>
            )}
          </div>
        </div>

        {/* Add/Edit Form */}
        {(isAdding || editingId !== null) && (
          <Card className="mb-8" data-testid="card-faq-form">
            <CardHeader>
              <CardTitle data-testid="heading-form-title">
                {editingId !== null ? "Edit FAQ" : "Add New FAQ"}
              </CardTitle>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)}>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="question"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Question *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter the question"
                            data-testid="input-question"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="answer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Answer *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Enter the answer"
                            rows={5}
                            data-testid="textarea-answer"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="displayOrder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Order</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-display-order"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isPublished"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0 pt-8">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-published"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Published</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCancel} data-testid="button-cancel">
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending} 
                    data-testid="button-save"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {editingId !== null ? "Update" : "Create"}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        )}

        {/* FAQ List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground" data-testid="text-loading">Loading FAQs...</p>
          </div>
        ) : faqs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground" data-testid="text-empty">No FAQs yet. Add your first one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {faqs.map((faq) => (
              <Card key={faq.id} data-testid={`card-faq-${faq.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2" data-testid={`text-question-${faq.id}`}>
                        {faq.question}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground" data-testid={`text-answer-${faq.id}`}>
                        {faq.answer}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(faq)}
                        data-testid={`button-edit-${faq.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(faq.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${faq.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardFooter className="text-sm text-muted-foreground" data-testid={`text-metadata-${faq.id}`}>
                  Order: {faq.displayOrder} | Status: {faq.isPublished ? "Published" : "Draft"}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
