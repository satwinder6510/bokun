import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, User, ArrowLeft, Share2 } from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";
import type { BlogPost } from "@shared/schema";

export default function PreviewBlogPost() {
  const { slug } = useParams<{ slug: string }>();
  
  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: ['/api/blog', slug],
    enabled: !!slug,
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <PreviewHeader />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto animate-pulse">
            <div className="h-8 bg-stone-200 rounded w-1/4 mb-4" />
            <div className="h-12 bg-stone-200 rounded w-3/4 mb-8" />
            <div className="aspect-[16/9] bg-stone-200 rounded-lg mb-8" />
            <div className="space-y-4">
              <div className="h-4 bg-stone-200 rounded" />
              <div className="h-4 bg-stone-200 rounded" />
              <div className="h-4 bg-stone-200 rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-stone-50">
        <PreviewHeader />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Post Not Found</h1>
          <Link href="/preview/blog">
            <Button variant="outline">Back to Blog</Button>
          </Link>
        </div>
        <PreviewFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-stone-200">
        <div className="container mx-auto px-4 py-3">
          <Link href="/preview/blog" className="inline-flex items-center text-slate-600 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Link>
        </div>
      </div>

      {/* Article */}
      <article className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <header className="mb-8">
              <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(post.publishedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {post.author}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                {post.title}
              </h1>
              <p className="text-xl text-slate-600">
                {post.excerpt}
              </p>
            </header>

            {/* Featured Image */}
            {post.featuredImage && (
              <div className="rounded-xl overflow-hidden mb-8">
                <img 
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full aspect-[16/9] object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div 
              className="prose prose-lg prose-slate max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-a:text-slate-800 prose-strong:text-slate-800"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Share */}
            <div className="border-t border-stone-200 mt-12 pt-8">
              <div className="flex items-center justify-between">
                <p className="text-slate-600">Share this article:</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Card className="border-stone-200 mt-12">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold text-slate-800 mb-3">
                  Ready to Start Your Adventure?
                </h3>
                <p className="text-slate-600 mb-6">
                  Speak to our travel experts and let us create your perfect holiday.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/preview/packages">
                    <Button size="lg" className="bg-slate-800 hover:bg-slate-900">
                      View Packages
                    </Button>
                  </Link>
                  <a 
                    href="tel:02081830518"
                    className="inline-flex items-center gap-2 text-slate-800 font-semibold hover:text-slate-600"
                  >
                    Or call 0208 183 0518
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </article>

      <PreviewFooter />
    </div>
  );
}
