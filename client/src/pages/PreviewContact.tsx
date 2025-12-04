import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";
import PreviewHeader from "@/components/PreviewHeader";
import PreviewFooter from "@/components/PreviewFooter";
import { useToast } from "@/hooks/use-toast";

export default function PreviewContact() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Message Sent",
      description: "Thank you for your enquiry. We'll be in touch shortly.",
    });
    
    setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <PreviewHeader />

      {/* Hero Banner */}
      <section className="bg-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-white/80 max-w-2xl">
            We're here to help with your travel plans. Get in touch with our friendly team.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-stone-200">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-slate-800 mb-6">Get in Touch</h2>
                  
                  <div className="space-y-6">
                    <a href="tel:02081830518" className="flex items-start gap-4 group">
                      <div className="p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                        <Phone className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Phone</p>
                        <p className="text-slate-600">0208 183 0518</p>
                        <p className="text-sm text-slate-500">Mon-Sat, 9am-6pm</p>
                      </div>
                    </a>

                    <a href="mailto:info@flightsandpackages.com" className="flex items-start gap-4 group">
                      <div className="p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                        <Mail className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Email</p>
                        <p className="text-slate-600">info@flightsandpackages.com</p>
                        <p className="text-sm text-slate-500">We reply within 24 hours</p>
                      </div>
                    </a>

                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 rounded-lg">
                        <MapPin className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Address</p>
                        <p className="text-slate-600">Flights and Packages Ltd</p>
                        <p className="text-sm text-slate-500">London, United Kingdom</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 rounded-lg">
                        <Clock className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Opening Hours</p>
                        <p className="text-slate-600">Monday - Saturday</p>
                        <p className="text-sm text-slate-500">9:00 AM - 6:00 PM</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200 bg-slate-50">
                <CardContent className="p-6 text-center">
                  <h3 className="font-bold text-slate-800 mb-2">Prefer to Chat?</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Call us directly for immediate assistance
                  </p>
                  <a 
                    href="tel:02081830518"
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-md font-semibold transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    0208 183 0518
                  </a>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="border-stone-200">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">Send Us a Message</h2>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Your Name *
                        </label>
                        <Input 
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          className="border-stone-300"
                          data-testid="input-contact-name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Email Address *
                        </label>
                        <Input 
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          className="border-stone-300"
                          data-testid="input-contact-email"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Phone Number
                        </label>
                        <Input 
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="border-stone-300"
                          data-testid="input-contact-phone"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Subject *
                        </label>
                        <Input 
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          required
                          className="border-stone-300"
                          data-testid="input-contact-subject"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Your Message *
                      </label>
                      <Textarea 
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                        rows={6}
                        className="border-stone-300 resize-none"
                        placeholder="Tell us about your travel plans..."
                        data-testid="input-contact-message"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      size="lg" 
                      className="bg-slate-800 hover:bg-slate-900"
                      disabled={isSubmitting}
                      data-testid="button-contact-submit"
                    >
                      {isSubmitting ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
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
