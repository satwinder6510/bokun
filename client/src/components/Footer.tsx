import { useState } from "react";
import { Link } from "wouter";
import { Phone, Mail, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import atolLogo from "@assets/atol-protected-logo-png_seeklogo-13189_1765460348402.png";

export function Footer() {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();
  const phoneNumber = useDynamicPhoneNumber();
  const phoneNumberClean = phoneNumber.replace(/\s/g, "");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setIsSubscribing(true);
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Successfully subscribed!",
          description: "You'll receive our latest offers and travel inspiration.",
        });
        setEmail("");
      } else {
        toast({
          title: "Subscription failed",
          description: data.error || "Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Subscription failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  const destinations = [
    "India", "Thailand", "Vietnam", "Sri Lanka", "Maldives", "Bali",
    "Italy", "Greece", "Portugal", "Spain", "Croatia", "Turkey",
    "South Africa", "Kenya", "Tanzania", "Morocco", "Egypt", "Jordan"
  ];

  return (
    <>
      {/* Newsletter */}
      <section className="py-14 bg-white border-y border-stone-200">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">
              Stay Inspired
            </h3>
            <p className="text-slate-600 mb-6">
              Receive exclusive offers and travel ideas straight to your inbox
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <Input 
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 border-stone-300"
                data-testid="input-newsletter-email"
                required
              />
              <Button 
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 px-6" 
                data-testid="button-subscribe"
                disabled={isSubscribing}
              >
                {isSubscribing ? "..." : "Subscribe"}
              </Button>
            </form>
            <p className="text-xs text-slate-400 mt-3">We respect your privacy. Unsubscribe at any time.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12">
            {/* Company Info */}
            <div>
              <img src={logoImage} alt="Flights and Packages" className="h-10 mb-4 brightness-0 invert" />
              <p className="text-stone-400 mb-6 leading-relaxed">
                Your trusted travel partner for over 15 years. We create unforgettable holidays with personal service and complete financial protection.
              </p>
              <div className="flex items-center gap-4">
                <img src={travelTrustLogo} alt="Travel Trust Association" className="h-12 brightness-0 invert opacity-80" />
                <img src={atolLogo} alt="ATOL Protected" className="h-14 invert" />
              </div>
            </div>

            {/* Destinations */}
            <div>
              <h4 className="font-bold text-lg mb-4">Popular Destinations</h4>
              <div className="grid grid-cols-2 gap-2">
                {destinations.slice(0, 12).map((dest) => (
                  <Link key={dest} href={`/destinations/${encodeURIComponent(dest.toLowerCase().replace(/\s+/g, '-'))}`} className="text-stone-400 hover:text-white text-sm transition-colors">
                    {dest}
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-lg mb-4">Quick Links</h4>
              <div className="flex flex-col gap-2">
                <Link href="/packages" className="text-stone-400 hover:text-white text-sm transition-colors">
                  Flight Packages
                </Link>
                <Link href="/tours" className="text-stone-400 hover:text-white text-sm transition-colors">
                  Land Tours
                </Link>
                <Link href="/blog" className="text-stone-400 hover:text-white text-sm transition-colors">
                  Travel Blog
                </Link>
                <Link href="/faq" className="text-stone-400 hover:text-white text-sm transition-colors">
                  FAQs
                </Link>
                <Link href="/contact" className="text-stone-400 hover:text-white text-sm transition-colors">
                  Contact Us
                </Link>
                <Link href="/terms" className="text-stone-400 hover:text-white text-sm transition-colors">
                  Terms & Conditions
                </Link>
                <a href="#" className="text-stone-400 hover:text-white text-sm transition-colors">
                  Privacy Policy
                </a>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-lg mb-4">Contact Us</h4>
              <div className="flex flex-col gap-4">
                <a href={`tel:${phoneNumberClean}`} className="flex items-center gap-3 text-stone-400 hover:text-white transition-colors">
                  <Phone className="h-5 w-5" />
                  <div>
                    <p className="font-semibold text-white">{phoneNumber}</p>
                    <p className="text-sm">Mon-Sun 9am - 6pm</p>
                  </div>
                </a>
                <a href="mailto:holidayenq@flightsandpackages.com" className="flex items-center gap-3 text-stone-400 hover:text-white transition-colors">
                  <Mail className="h-5 w-5" />
                  <span>holidayenq@flightsandpackages.com</span>
                </a>
                <div className="flex items-start gap-3 text-stone-400">
                  <MapPin className="h-5 w-5 mt-0.5" />
                  <div>
                    <p>Flights and Packages Ltd</p>
                    <p className="text-sm">Airport House, Purley Way</p>
                    <p className="text-sm">Croydon, Surrey CR0 0XZ</p>
                    <p className="text-sm">United Kingdom</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-stone-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-stone-500 text-sm">
              © {new Date().getFullYear()} Flights and Packages Ltd. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-stone-500 text-sm">
              <span>ATOL Protected T7311</span>
              <span>•</span>
              <span>TTA Member U6837</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
