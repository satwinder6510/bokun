import { useQuery } from "@tanstack/react-query";
import { setMetaTags } from "@/lib/meta-tags";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Mail } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { Faq } from "@shared/schema";

export default function FAQ() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch published FAQs
  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ["/api/faqs"],
  });

  // Set meta tags for SEO
  useEffect(() => {
    const title = "Frequently Asked Questions - Flights and Packages";
    const description = "Find answers to common questions about booking tours, travel packages, and our services. Get help with your travel planning needs.";
    setMetaTags(title, description);
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Main Content */}
      <main className="pt-20">
        <div className="container mx-auto px-6 md:px-8 py-16 max-w-4xl">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-lg text-muted-foreground">
              Find answers to common questions about our tours and services
            </p>
          </div>

          {/* FAQ List */}
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-loading">Loading FAQs...</p>
            </div>
          ) : faqs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-empty">No FAQs available at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4 mb-16" data-testid="list-faqs">
              {faqs.map((faq) => (
                <Card key={faq.id} className="overflow-hidden" data-testid={`card-faq-${faq.id}`}>
                  <CardHeader
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => toggleExpand(faq.id)}
                    data-testid={`button-toggle-${faq.id}`}
                  >
                    <div className="flex justify-between items-center gap-4">
                      <h3 className="text-lg font-semibold flex-1" data-testid={`text-question-${faq.id}`}>
                        {faq.question}
                      </h3>
                      {expandedId === faq.id ? (
                        <ChevronUp className="w-5 h-5 flex-shrink-0" data-testid={`icon-chevron-up-${faq.id}`} />
                      ) : (
                        <ChevronDown className="w-5 h-5 flex-shrink-0" data-testid={`icon-chevron-down-${faq.id}`} />
                      )}
                    </div>
                  </CardHeader>
                  {expandedId === faq.id && (
                    <CardContent className="pt-0">
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-line" data-testid={`text-answer-${faq.id}`}>
                        {faq.answer}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Got a Question Section */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20" data-testid="card-contact-section">
            <CardContent className="p-8 md:p-12 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-primary" data-testid="icon-mail" />
              <h2 className="text-2xl md:text-3xl font-bold mb-3" data-testid="heading-contact-title">Got a Question?</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto" data-testid="text-contact-description">
                Can't find what you're looking for? Our team is here to help you plan your perfect trip.
              </p>
              <a href="/contact">
                <Button size="lg" data-testid="button-contact-us">
                  Contact Us
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
