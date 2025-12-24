import { useState } from "react";
import { X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChristmasBanner() {
  const [dismissed, setDismissed] = useState(false);

  // Auto-hide after January 2nd 2025
  const expiryDate = new Date("2025-01-02T23:59:59");
  const now = new Date();
  
  if (dismissed || now > expiryDate) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-red-700 via-red-600 to-green-700 text-white py-3 px-4 shadow-lg" data-testid="banner-christmas">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Gift className="h-5 w-5 flex-shrink-0 animate-pulse" />
          <p className="text-sm md:text-base">
            <span className="font-semibold">Merry Christmas!</span>
            <span className="hidden sm:inline"> from all of us at Flights and Packages.</span>
            <span className="ml-2 text-white/90">
              <span className="font-medium">Holiday Hours:</span> Closed 25 Dec, Open 26 Dec onwards
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20 flex-shrink-0"
          onClick={() => setDismissed(true)}
          data-testid="button-dismiss-christmas-banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
