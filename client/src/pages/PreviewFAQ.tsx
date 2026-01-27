import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Phone, Mail } from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";
import type { Faq } from "@shared/schema";
import { sanitizeHtml } from "@/lib/sanitize";

export default function PreviewFAQ() {
  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ['/api/faqs'],
  });

  const publishedFaqs = faqs.filter(f => f.isPublished).sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Hero Banner */}
      <section className="bg-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-white/80 max-w-2xl">
            Find answers to common questions about our holidays, bookings, and services.
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* FAQ Accordion */}
            <div className="lg:col-span-2">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-6 bg-stone-200 rounded w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : publishedFaqs.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-4">
                  {publishedFaqs.map((faq) => (
                    <AccordionItem 
                      key={faq.id} 
                      value={`faq-${faq.id}`}
                      className="bg-white border border-stone-200 rounded-lg px-6"
                    >
                      <AccordionTrigger className="text-left text-lg font-semibold text-slate-800 hover:no-underline py-5">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-600 pb-5 leading-relaxed">
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(faq.answer) }} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <Card className="border-stone-200">
                  <CardContent className="p-8 text-center">
                    <p className="text-slate-600">No FAQs available at the moment.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Contact Sidebar */}
            <div className="space-y-6">
              <Card className="border-stone-200">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Still Have Questions?</h3>
                  <p className="text-slate-600 mb-6">
                    Our friendly team is here to help with any questions you might have.
                  </p>
                  
                  <div className="space-y-4">
                    <a href="tel:02081830518" className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <Phone className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="font-semibold text-slate-800">0208 183 0518</p>
                        <p className="text-sm text-slate-500">Mon-Sun 9am - 6pm</p>
                      </div>
                    </a>
                    
                    <a href="mailto:holidayenq@flightsandpackages.com" className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <Mail className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="font-semibold text-slate-800">Email Us</p>
                        <p className="text-sm text-slate-500">holidayenq@flightsandpackages.com</p>
                      </div>
                    </a>
                  </div>
                </CardContent>
              </Card>

              {/* Trust Card */}
              <Card className="border-stone-200 bg-slate-50">
                <CardContent className="p-6">
                  <h3 className="font-bold text-slate-800 mb-3">Your Money is Protected</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    We are members of the Travel Trust Association (TTA Q7341) and all our flight packages are ATOL protected. Your holiday investment is always safe with us.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <PreviewFooter />
    </div>
  );
}
