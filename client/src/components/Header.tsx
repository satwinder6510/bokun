import { useState } from "react";
import { Link } from "wouter";
import { Menu, Phone, Shield, Headphones, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import atolLogo from "@assets/atol_1765460218085.png";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const phoneNumber = useDynamicPhoneNumber();
  const phoneNumberClean = phoneNumber.replace(/\s/g, "");

  return (
    <div className="sticky top-0 z-50">
      {/* Top Bar - Trust & Contact */}
      <div className="bg-slate-900 text-white py-2.5">
        <div className="container mx-auto px-4 flex justify-between items-center text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>ATOL Protected T7311</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-400" />
              <span>TTA Member U6837</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Headphones className="h-4 w-4 text-stone-400" />
              <span>Personal Travel Advisors</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-stone-400">Speak to an expert:</span>
            <a href={`tel:${phoneNumberClean}`} className="font-bold text-base hover:text-sky-300 transition-colors">
              {phoneNumber}
            </a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/">
                <img src={logoImage} alt="Flights and Packages" className="h-12 md:h-14 cursor-pointer" data-testid="img-logo" />
              </Link>
              <div className="hidden md:flex items-center gap-4 border-l border-stone-200 pl-6">
                <img src={travelTrustLogo} alt="Travel Trust Association" className="h-10" />
                <img src={atolLogo} alt="ATOL Protected" className="h-10 rounded-full" />
              </div>
            </div>
            
            <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
              <Link href="/" className="text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm xl:text-base whitespace-nowrap" data-testid="link-home">
                Home
              </Link>
              <Link href="/packages" className="text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm xl:text-base whitespace-nowrap" data-testid="link-packages">
                Flight Packages
              </Link>
              <Link href="/tours" className="text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm xl:text-base whitespace-nowrap" data-testid="link-tours">
                Land Tours
              </Link>
              <Link href="/holidays" className="text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm xl:text-base whitespace-nowrap" data-testid="link-collections">
                Collections
              </Link>
              <Link href="/destinations" className="text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm xl:text-base whitespace-nowrap" data-testid="link-destinations">
                Destinations
              </Link>
              <Link href="/blog" className="text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm xl:text-base whitespace-nowrap" data-testid="link-blog">
                Blog
              </Link>
              <Link href="/contact" className="text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm xl:text-base whitespace-nowrap" data-testid="link-contact">
                Contact
              </Link>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile phone icon only */}
              <a 
                href={`tel:${phoneNumberClean}`}
                className="flex md:hidden items-center justify-center w-10 h-10 bg-slate-800 hover:bg-slate-900 text-white rounded-md transition-colors"
                data-testid="link-header-phone-mobile"
                aria-label="Call us"
              >
                <Phone className="h-4 w-4" />
              </a>
              {/* Desktop phone with number */}
              <a 
                href={`tel:${phoneNumberClean}`}
                className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 lg:px-5 py-2.5 rounded-md font-semibold transition-colors whitespace-nowrap"
                data-testid="link-header-phone"
              >
                <Phone className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{phoneNumber}</span>
                <span className="lg:hidden">Call</span>
              </a>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden shrink-0"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <nav className="lg:hidden pt-4 pb-2 border-t mt-4">
              <div className="flex flex-col gap-3">
                <Link href="/" className="text-slate-700 hover:text-slate-900 font-medium py-2" data-testid="mobile-link-home">
                  Home
                </Link>
                <Link href="/packages" className="text-slate-700 hover:text-slate-900 font-medium py-2" data-testid="mobile-link-packages">
                  Flight Packages
                </Link>
                <Link href="/tours" className="text-slate-700 hover:text-slate-900 font-medium py-2" data-testid="mobile-link-tours">
                  Land Tours
                </Link>
                <Link href="/holidays" className="text-slate-700 hover:text-slate-900 font-medium py-2" data-testid="mobile-link-collections">
                  Collections
                </Link>
                <Link href="/destinations" className="text-slate-700 hover:text-slate-900 font-medium py-2" data-testid="mobile-link-destinations">
                  Destinations
                </Link>
                <Link href="/blog" className="text-slate-700 hover:text-slate-900 font-medium py-2" data-testid="mobile-link-blog">
                  Blog
                </Link>
                <Link href="/faq" className="text-slate-700 hover:text-slate-900 font-medium py-2" data-testid="mobile-link-faq">
                  FAQ
                </Link>
                <Link href="/contact" className="text-slate-700 hover:text-slate-900 font-medium py-2" data-testid="mobile-link-contact">
                  Contact
                </Link>
              </div>
            </nav>
          )}
        </div>
      </header>
    </div>
  );
}
