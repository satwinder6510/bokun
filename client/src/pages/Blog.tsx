import { useQuery } from "@tanstack/react-query";
import { setMetaTags } from "@/lib/meta-tags";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight, Phone } from "lucide-react";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";
import type { BlogPost } from "@shared/schema";
import { format } from "date-fns";

export default function Blog() {
  const phoneNumber = useDynamicPhoneNumber();
  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
  });

  useEffect(() => {
    const title = "Travel Blog & Tips - Flights and Packages";
    const description = "Read our latest travel guides, destination highlights, and expert tips for planning your perfect vacation. Discover hidden gems and insider knowledge.";
    setMetaTags(title, description);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center" data-testid="link-logo">
            <img
              src="/attached_assets/flights-and-packages-logo_1763744942036.png"
              alt="Flights and Packages"
              className="h-10 md:h-12 w-auto"
              data-testid="img-logo"
            />
          </a>
          <div className="flex items-center gap-3">
            <a 
              href={`tel:${phoneNumber.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover-elevate transition-colors"
              data-testid="link-header-phone"
            >
              <Phone className="w-4 h-4" />
              {phoneNumber}
            </a>
            <a href="/">
              <Button variant="outline" size="sm" data-testid="button-back-home">
                Back to Home
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="pt-20">
        <div className="container mx-auto px-6 md:px-8 py-16 max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Travel Blog</h1>
            <p className="text-lg text-muted-foreground">
              Discover expert travel tips, destination guides, and insider knowledge
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-loading">Loading blog posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-empty">No blog posts available yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-blog-posts">
              {posts.map((post) => (
                <a 
                  key={post.id} 
                  href={`/blog/${post.slug}`}
                  className="group"
                  data-testid={`link-blog-post-${post.id}`}
                >
                  <Card className="h-full overflow-hidden hover-elevate transition-all">
                    {post.featuredImage && (
                      <div className="aspect-video w-full overflow-hidden bg-muted">
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          data-testid={`img-featured-${post.id}`}
                        />
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1" data-testid={`date-published-${post.id}`}>
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(post.publishedAt || post.createdAt), "MMM d, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{Math.ceil(post.content.split(' ').length / 200)} min read</span>
                        </div>
                      </div>

                      <h2 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2" data-testid={`title-${post.id}`}>
                        {post.title}
                      </h2>

                      <p className="text-muted-foreground mb-4 line-clamp-3" data-testid={`excerpt-${post.id}`}>
                        {post.excerpt}
                      </p>

                      <div className="flex items-center gap-2 text-primary font-medium">
                        <span>Read more</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground" data-testid="text-copyright">
              © 2025 Flights and Packages. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="/" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-home">
                Home
              </a>
              <a href="/blog" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-blog">
                Blog
              </a>
              <a href="/contact" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-contact">
                Contact
              </a>
              <a href="/terms" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-terms">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
