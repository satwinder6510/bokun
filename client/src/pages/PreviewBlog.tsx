import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, User, ArrowRight } from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";
import type { BlogPost } from "@shared/schema";

export default function PreviewBlog() {
  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog'],
  });

  const publishedPosts = posts.filter(p => p.isPublished);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Hero Banner */}
      <section className="bg-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Travel Blog</h1>
          <p className="text-xl text-white/80 max-w-2xl">
            Travel inspiration, destination guides, and tips from our expert team.
          </p>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden border-stone-200 animate-pulse">
                  <div className="aspect-[16/9] bg-stone-200" />
                  <CardContent className="p-6">
                    <div className="h-4 bg-stone-200 rounded mb-3 w-1/3" />
                    <div className="h-6 bg-stone-200 rounded mb-3" />
                    <div className="h-4 bg-stone-200 rounded w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : publishedPosts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {publishedPosts.map((post) => (
                <Link key={post.id} href={`/preview/blog/${post.slug}`}>
                  <Card className="group overflow-hidden border-stone-200 hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <img 
                        src={post.featuredImage || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=75"}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(post.publishedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {post.author}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-slate-600 transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                      <p className="text-slate-600 line-clamp-3 mb-4">
                        {post.excerpt}
                      </p>
                      <span className="inline-flex items-center text-slate-800 font-medium group-hover:text-slate-600">
                        Read More <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-stone-200">
              <CardContent className="p-12 text-center">
                <p className="text-xl text-slate-600 mb-2">No blog posts yet</p>
                <p className="text-slate-500">Check back soon for travel inspiration and tips.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <PreviewFooter />
    </div>
  );
}
