import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Phone, ChevronDown, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";

interface HeaderProps {
  destinations?: string[];
  onDestinationSelect?: (destination: string | null) => void;
}

export function Header({ destinations = [], onDestinationSelect }: HeaderProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const phoneNumber = useDynamicPhoneNumber();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const handleDestinationClick = (destination: string | null) => {
    if (onDestinationSelect) {
      onDestinationSelect(destination);
    }
    // If we're not on the homepage, navigate there first
    if (location !== "/") {
      window.location.href = destination ? `/?destination=${encodeURIComponent(destination)}#tours` : "/#tours";
    } else {
      document.getElementById('tours')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navLinks = [
    { href: "/", label: "Home", testId: "link-home" },
    { href: "/packages", label: "Flight Packages", icon: Plane, testId: "link-packages" },
    { href: "/#tours", label: "Land Tours", testId: "link-tours", isAnchor: true },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between gap-2 md:gap-6">
        {/* Logo Section */}
        <div className="flex items-center gap-3 md:gap-6 flex-shrink-0 min-w-0">
          <Link href="/" className="flex items-center flex-shrink-0" data-testid="link-logo">
            <img 
              src={logoImage} 
              alt="Flights and Packages" 
              className="h-8 md:h-12 w-auto object-contain"
              data-testid="img-logo"
            />
          </Link>
          <img 
            src={travelTrustLogo} 
            alt="Travel Trust Association - Your Holidays 100% Financially Protected" 
            className="h-6 md:h-10 w-auto object-contain hidden sm:block"
            aria-label="Travel Trust Association member"
          />
        </div>
        
        {/* Mobile Menu */}
        <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu" className="flex-shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                <Link 
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  data-testid="mobile-link-home"
                >
                  Home
                </Link>
                <Link 
                  href="/packages"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  data-testid="mobile-link-packages"
                >
                  Flight Packages
                </Link>
                <a 
                  href="/#tours"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  data-testid="mobile-link-tours"
                >
                  Land Tours
                </a>
                
                {destinations.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-2 text-muted-foreground">Destinations</p>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {destinations.slice(0, 15).map((country) => (
                        <button
                          key={country}
                          onClick={() => {
                            handleDestinationClick(country);
                            setMobileMenuOpen(false);
                          }}
                          className="text-sm hover:text-primary transition-colors py-1.5 block w-full text-left"
                          data-testid={`mobile-menu-${country.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <Link 
                  href="/faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium hover:text-primary transition-colors py-2 border-t pt-4"
                  data-testid="mobile-link-faq"
                >
                  FAQ
                </Link>
                <Link 
                  href="/blog"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  data-testid="mobile-link-blog"
                >
                  Blog
                </Link>
                <Link 
                  href="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  data-testid="mobile-link-contact"
                >
                  Contact
                </Link>
                <a 
                  href={`tel:${phoneNumber.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium mt-2"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="mobile-link-phone"
                >
                  <Phone className="w-4 h-4" />
                  {phoneNumber}
                </a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Menu */}
        <nav className="hidden lg:flex items-center gap-4 lg:gap-6 flex-shrink-0">
          <Link 
            href="/" 
            className={`text-base font-medium hover:text-primary transition-colors ${isActive("/") && location === "/" ? "text-primary" : ""}`}
            data-testid="link-home"
          >
            Home
          </Link>
          <Link 
            href="/packages" 
            className={`text-base font-medium hover:text-primary transition-colors inline-flex items-center gap-1 ${isActive("/packages") ? "text-primary" : ""}`}
            data-testid="link-packages"
          >
            <Plane className="w-4 h-4" />
            Flight Packages
          </Link>
          <a 
            href="/#tours" 
            className="text-base font-medium hover:text-primary transition-colors"
            data-testid="link-tours"
          >
            Land Tours
          </a>
          
          {destinations.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="text-base font-medium hover:text-primary transition-colors inline-flex items-center gap-1" 
                  data-testid="button-destinations-menu"
                >
                  Destinations
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
                <DropdownMenuItem 
                  onClick={() => handleDestinationClick(null)}
                  className="font-medium"
                  data-testid="menu-item-all-destinations"
                >
                  All Destinations
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {destinations.map((country) => (
                  <DropdownMenuItem 
                    key={country}
                    onClick={() => handleDestinationClick(country)}
                    data-testid={`menu-item-${country.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {country}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Link 
            href="/faq" 
            className={`text-base font-medium hover:text-primary transition-colors ${isActive("/faq") ? "text-primary" : ""}`}
            data-testid="link-faq"
          >
            FAQ
          </Link>
          <Link 
            href="/blog" 
            className={`text-base font-medium hover:text-primary transition-colors ${isActive("/blog") ? "text-primary" : ""}`}
            data-testid="link-blog"
          >
            Blog
          </Link>
          <Link 
            href="/contact" 
            className={`text-base font-medium hover:text-primary transition-colors ${isActive("/contact") ? "text-primary" : ""}`}
            data-testid="link-contact"
          >
            Contact
          </Link>
          <a 
            href={`tel:${phoneNumber.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover-elevate transition-colors"
            data-testid="link-header-phone"
          >
            <Phone className="w-4 h-4" />
            {phoneNumber}
          </a>
        </nav>
      </div>
    </header>
  );
}
