import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { setMetaTags, addJsonLD, generateBreadcrumbSchema } from "@/lib/meta-tags";
import { contactLeadSchema, type ContactLead } from "@shared/schema";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import { Mail, Phone, MapPin, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";
import { captureContactFormSubmitted } from "@/lib/posthog";

export default function Contact() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const phoneNumber = useDynamicPhoneNumber();

  useEffect(() => {
    const title = "Contact Us | Flights and Packages";
    const description = "Get in touch with Flights and Packages for tour inquiries, bookings, and customer support. We're here to help plan your perfect journey.";
    
    setMetaTags(title, description, logoImage);
    
    addJsonLD([
      generateBreadcrumbSchema([
        { name: "Home", url: "/" },
        { name: "Contact Us", url: "/contact" }
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "name": title,
        "description": description,
        "url": "https://tours.flightsandpackages.com/contact"
      }
    ]);
  }, []);

  const form = useForm<ContactLead>({
    resolver: zodResolver(contactLeadSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      bookingReference: "",
      message: "",
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (data: ContactLead) => {
      // Get original referrer from session storage (captured on first page load)
      const originalReferrer = sessionStorage.getItem('original_referrer') || 'Direct';
      const landingPage = sessionStorage.getItem('landing_page') || null;
      
      return await apiRequest("POST", "/api/contact", {
        ...data,
        pageUrl: window.location.href,
        referrer: originalReferrer,
        landingPage: landingPage,
      });
    },
    onSuccess: () => {
      captureContactFormSubmitted(true);
      toast({
        title: "Message sent successfully!",
        description: "We'll get back to you soon. Thank you for contacting us.",
      });
      form.reset();
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    },
    onError: (error: any) => {
      captureContactFormSubmitted(false, { error_message: error.message });
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactLead) => {
    contactMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Spacer for fixed header */}
      <div className="h-20" />

      {/* Contact Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-6 md:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions about a tour or need assistance? Fill out the form below and our team will get back to you as soon as possible.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            {/* Contact Information */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <p className="font-medium">Phone</p>
                      <a 
                        href={`tel:${phoneNumber.replace(/\s/g, "")}`}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        data-testid="link-contact-phone"
                      >
                        {phoneNumber}
                      </a>
                      <p className="text-sm text-muted-foreground mt-1">Mon-Sun 9am - 6pm</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <p className="font-medium">Email</p>
                      <a href="mailto:holidayenq@flightsandpackages.com" className="text-muted-foreground hover:text-primary transition-colors">
                        holidayenq@flightsandpackages.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <p className="font-medium">Address</p>
                      <p className="text-muted-foreground">
                        Airport House, Purley Way<br />
                        Croydon, Surrey, CR0 0XZ<br />
                        United Kingdom
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-6 rounded-md border">
                <h3 className="font-semibold mb-3">Why Choose Us?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ 700+ unique tours worldwide</li>
                  <li>✓ Expert travel guidance</li>
                  <li>✓ Secure payment processing</li>
                  <li>✓ TTA & ATOL protected</li>
                </ul>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="John" 
                              {...field} 
                              data-testid="input-firstName"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Doe" 
                              {...field} 
                              data-testid="input-lastName"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="john.doe@example.com" 
                            {...field} 
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input 
                            type="tel" 
                            placeholder="+44 20 1234 5678 or 020 1234 5678" 
                            {...field} 
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bookingReference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking Reference (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="REF123456" 
                            {...field} 
                            data-testid="input-bookingReference"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Message *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Please enter the details of your query..." 
                            className="min-h-[120px]" 
                            {...field} 
                            data-testid="input-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={contactMutation.isPending}
                    data-testid="button-submit"
                  >
                    {contactMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Message"
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
