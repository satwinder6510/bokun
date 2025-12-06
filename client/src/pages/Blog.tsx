import { useQuery } from "@tanstack/react-query";
import { setMetaTags } from "@/lib/meta-tags";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { BlogPost } from "@shared/schema";
import { format } from "date-fns";

export default function Blog() {
  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
  });

  useEffect(() => {
    const title = "Travel Blog & Tips - Flights and Packages";
    const description = "Read our latest travel guides, destination highlights, and expert tips for planning your perfect vacation. Discover hidden gems and insider knowledge.";
    setMetaTags(title, description);
  }, []);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

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

      <Footer />
    </div>
  );
}
