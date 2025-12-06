import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBlogPostSchema, updateBlogPostSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Plus, Edit, Trash2, X, Check, Eye, ExternalLink, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { BlogPost, InsertBlogPost, UpdateBlogPost } from "@shared/schema";

export default function AdminBlog() {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<InsertBlogPost | UpdateBlogPost>({
    resolver: zodResolver(editingId !== null ? updateBlogPostSchema : insertBlogPostSchema),
    defaultValues: {
      title: "",
      slug: "",
      content: "",
      excerpt: "",
      metaTitle: "",
      metaDescription: "",
      featuredImage: "",
      author: "Flights and Packages",
      isPublished: true,
      publishedAt: null,
    },
  });

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/admin"],
  });

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (data: InsertBlogPost) => {
      return await apiRequest("POST", "/api/blog", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      setIsAdding(false);
      form.reset();
      toast({ title: "Blog post created successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create blog post", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateBlogPost }) => {
      return await apiRequest("PATCH", `/api/blog/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      setEditingId(null);
      form.reset();
      toast({ title: "Blog post updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update blog post", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/blog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/admin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Blog post deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete blog post", variant: "destructive" });
    },
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 200);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    form.setValue("title", title);
    if (!editingId) {
      form.setValue("slug", generateSlug(title));
    }
  };

  const handleSubmit = (data: InsertBlogPost | UpdateBlogPost) => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: data as UpdateBlogPost });
    } else {
      createMutation.mutate(data as InsertBlogPost);
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingId(post.id);
    form.reset({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt,
      metaTitle: post.metaTitle || "",
      metaDescription: post.metaDescription || "",
      featuredImage: post.featuredImage || "",
      author: post.author,
      isPublished: post.isPublished,
      publishedAt: post.publishedAt,
    });
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    form.reset({
      title: "",
      slug: "",
      content: "",
      excerpt: "",
      metaTitle: "",
      metaDescription: "",
      featuredImage: "",
      author: "Flights and Packages",
      isPublished: true,
      publishedAt: null,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-blog-management">Blog Management</h1>
            <p className="text-muted-foreground mt-1">{posts.length} blog posts</p>
          </div>
          <div className="flex gap-2">
            <a href="/dashboard">
              <Button variant="outline" data-testid="button-back-dashboard">
                Back to Dashboard
              </Button>
            </a>
            {!isAdding && editingId === null && (
              <Button onClick={() => setIsAdding(true)} data-testid="button-add-post">
                <Plus className="w-4 h-4 mr-2" />
                Add Post
              </Button>
            )}
          </div>
        </div>

        {(isAdding || editingId !== null) && (
          <Card className="mb-8" data-testid="card-blog-form">
            <CardHeader>
              <CardTitle data-testid="heading-form-title">
                {editingId !== null ? "Edit Blog Post" : "Add New Blog Post"}
              </CardTitle>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)}>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onChange={handleTitleChange}
                              placeholder="Enter post title"
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL Slug *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="url-friendly-slug"
                              data-testid="input-slug"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="excerpt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Excerpt * (shown on listing page)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Brief summary of the post"
                            rows={2}
                            data-testid="textarea-excerpt"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content * (HTML supported)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Full post content..."
                            rows={12}
                            className="font-mono text-sm"
                            data-testid="textarea-content"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="featuredImage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Featured Image URL</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="https://example.com/image.jpg"
                            data-testid="input-featured-image"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="metaTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SEO Title (max 70 chars)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="SEO optimized title"
                              data-testid="input-meta-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="author"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Author</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Author name"
                              data-testid="input-author"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="metaDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SEO Description (max 160 chars)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="SEO meta description"
                            data-testid="input-meta-description"
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
                      <FormItem className="flex items-center gap-2 space-y-0">
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

        {!isAdding && editingId === null && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search blog posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground" data-testid="text-loading">Loading blog posts...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground" data-testid="text-empty">
              {searchQuery ? "No matching blog posts found" : "No blog posts yet. Add your first one!"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <Card key={post.id} data-testid={`card-post-${post.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg truncate" data-testid={`text-title-${post.id}`}>
                          {post.title}
                        </CardTitle>
                        <Badge variant={post.isPublished ? "default" : "secondary"}>
                          {post.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2" data-testid={`text-excerpt-${post.id}`}>
                        {post.excerpt}
                      </CardDescription>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>/{post.slug}</span>
                        {post.publishedAt && (
                          <span>{format(new Date(post.publishedAt), "dd MMM yyyy")}</span>
                        )}
                        <span>by {post.author}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="outline" data-testid={`button-view-${post.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </a>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(post)}
                        data-testid={`button-edit-${post.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this post?")) {
                            deleteMutation.mutate(post.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${post.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
