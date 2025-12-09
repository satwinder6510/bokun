import { useQuery } from "@tanstack/react-query";
import { setMetaTags } from "@/lib/meta-tags";
import { useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, ArrowLeft, Share2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { BlogPost } from "@shared/schema";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function BlogPostPage() {
  const [, params] = useRoute("/blog/:slug");
  const { toast } = useToast();
  const slug = params?.slug;

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: [`/api/blog/slug/${slug}`],
    enabled: !!slug,
  });

  useEffect(() => {
    if (post) {
      const title = post.metaTitle || `${post.title} - Flights and Packages Blog`;
      const description = post.metaDescription || post.excerpt;
      setMetaTags(title, description);
    }
  }, [post]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.excerpt,
          url: url,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied!",
          description: "The blog post link has been copied to your clipboard.",
        });
      } catch (err) {
        toast({
          title: "Failed to copy",
          description: "Please copy the link manually.",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-muted-foreground" data-testid="text-loading">Loading...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4" data-testid="text-not-found">Blog Post Not Found</h1>
          <p className="text-muted-foreground mb-6">The blog post you're looking for doesn't exist or has been removed.</p>
          <a href="/blog">
            <Button data-testid="button-back-to-blog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="pt-20">
        <article className="container mx-auto px-6 md:px-8 py-16 max-w-4xl">
          {post.featuredImage && (
            <div className="aspect-[21/9] w-full overflow-hidden rounded-lg mb-8 bg-muted">
              <img
                src={post.featuredImage}
                alt={post.title}
                className="w-full h-full object-cover"
                data-testid="img-featured"
              />
            </div>
          )}

          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="heading-title">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1" data-testid="text-author">
                <span className="font-medium">{post.author}</span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <div className="flex items-center gap-1" data-testid="text-date">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(post.publishedAt || post.createdAt), "MMMM d, yyyy")}</span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <div className="flex items-center gap-1" data-testid="text-reading-time">
                <Clock className="w-4 h-4" />
                <span>{Math.ceil(post.content.split(' ').length / 200)} min read</span>
              </div>
            </div>
          </div>

          <div 
            className="prose prose-lg max-w-none prose-headings:font-bold prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-2xl prose-h3:mt-6 prose-h3:mb-3 prose-p:leading-relaxed prose-p:mb-4 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:shadow-md prose-strong:font-semibold prose-ul:my-4 prose-ol:my-4"
            dangerouslySetInnerHTML={{ __html: post.content }}
            data-testid="content-body"
          />

          <Card className="mt-12 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-3">Ready to Explore?</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Discover our curated collection of flight packages and start planning your next adventure.
              </p>
              <a href="/packages">
                <Button size="lg" data-testid="button-browse-packages">
                  Browse Flight Packages
                </Button>
              </a>
            </CardContent>
          </Card>
        </article>
      </main>

      <Footer />
    </div>
  );
}
