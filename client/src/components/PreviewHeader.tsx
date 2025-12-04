import { useState } from "react";
import { Link } from "wouter";
import { Phone, Shield, Headphones, Menu, X } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";

export default function PreviewHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50">
      {/* Top Bar - Trust & Contact */}
      <div className="bg-slate-900 text-white py-2.5">
        <div className="container mx-auto px-4 flex justify-between items-center text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>ATOL Protected</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-400" />
              <span>TTA Member Q7341</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Headphones className="h-4 w-4 text-stone-400" />
              <span>Personal Travel Advisors</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-stone-400">Speak to an expert:</span>
            <a href="tel:02081830518" className="font-bold text-base hover:text-sky-300 transition-colors">
              0208 183 0518
            </a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/design-preview">
                <img src={logoImage} alt="Flights and Packages" className="h-12 md:h-14 cursor-pointer" />
              </Link>
              <div className="hidden md:block border-l border-stone-200 pl-6">
                <img src={travelTrustLogo} alt="Travel Trust Association" className="h-10" />
              </div>
            </div>
            
            <nav className="hidden lg:flex items-center gap-8">
              <Link href="/design-preview" className="text-slate-700 hover:text-slate-900 font-medium transition-colors">
                Home
              </Link>
              <Link href="/preview/packages" className="text-slate-700 hover:text-slate-900 font-medium transition-colors">
                Flight Packages
              </Link>
              <Link href="/preview/tours" className="text-slate-700 hover:text-slate-900 font-medium transition-colors">
                Land Tours
              </Link>
              <Link href="/preview/blog" className="text-slate-700 hover:text-slate-900 font-medium transition-colors">
                Blog
              </Link>
              <Link href="/preview/contact" className="text-slate-700 hover:text-slate-900 font-medium transition-colors">
                Contact
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <a 
                href="tel:02081830518" 
                className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-md font-semibold transition-colors"
              >
                <Phone className="h-4 w-4" />
                0208 183 0518
              </a>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <nav className="lg:hidden pt-4 pb-2 border-t mt-4">
              <div className="flex flex-col gap-3">
                <Link href="/design-preview" className="text-slate-700 hover:text-slate-900 font-medium py-2">
                  Home
                </Link>
                <Link href="/preview/packages" className="text-slate-700 hover:text-slate-900 font-medium py-2">
                  Flight Packages
                </Link>
                <Link href="/preview/tours" className="text-slate-700 hover:text-slate-900 font-medium py-2">
                  Land Tours
                </Link>
                <Link href="/preview/blog" className="text-slate-700 hover:text-slate-900 font-medium py-2">
                  Blog
                </Link>
                <Link href="/preview/contact" className="text-slate-700 hover:text-slate-900 font-medium py-2">
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
