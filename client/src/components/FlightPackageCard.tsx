import { Link } from "wouter";
import { MapPin, Clock, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProxiedImageUrl } from "@/lib/imageProxy";
import type { FlightPackage } from "@shared/schema";
import type { CityTaxInfo } from "@/lib/cityTaxCalc";

interface FlightPackageCardProps {
  pkg: FlightPackage;
  cityTaxInfo?: CityTaxInfo;
  showSinglePrice?: boolean;
  pricingSuffix?: string;
}

function formatGBP(price: number): string {
  return new Intl.NumberFormat('en-GB', { 
    style: 'currency', 
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

export function FlightPackageCard({ pkg, cityTaxInfo, showSinglePrice = false, pricingSuffix }: FlightPackageCardProps) {
  const countrySlug = pkg.category?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  
  const basePrice = showSinglePrice 
    ? (pkg.singlePrice || pkg.price) 
    : (pkg.price || pkg.singlePrice);
  
  const cityTax = cityTaxInfo?.totalTaxPerPerson || 0;
  const additionalChargeName = (pkg as any)?.additionalChargeName || null;
  const additionalChargeCurrency = (pkg as any)?.additionalChargeCurrency || "EUR";
  const additionalChargeForeignAmount = parseFloat((pkg as any)?.additionalChargeForeignAmount) || 0;
  const additionalChargeExchangeRate = parseFloat((pkg as any)?.additionalChargeExchangeRate) || 0.84;
  const additionalChargeGbpAmount = Math.round(additionalChargeForeignAmount * additionalChargeExchangeRate * 100) / 100;
  const totalLocalCharges = cityTax + additionalChargeGbpAmount;
  const totalPrice = (basePrice || 0) + totalLocalCharges;
  
  let packageUrl = `/Holidays/${countrySlug}/${pkg.slug}`;
  if (pricingSuffix) {
    packageUrl += pricingSuffix;
  } else if (showSinglePrice) {
    packageUrl += '?pricing=solo';
  }

  return (
    <Link href={packageUrl}>
      <div 
        className="relative overflow-hidden rounded-xl aspect-[3/4] group cursor-pointer"
        data-testid={`card-package-${pkg.id}`}
      >
        <div className="absolute inset-0 bg-muted">
          {pkg.featuredImage ? (
            <img
              src={getProxiedImageUrl(pkg.featuredImage, 'card')}
              alt={pkg.title}
              width={400}
              height={533}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>

        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary text-primary-foreground">
            Flight Package
          </span>
          {pkg.duration && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-slate-700">
              {pkg.duration}
            </span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2 leading-tight">
            {pkg.title}
          </h3>
          {pkg.category && (
            <p className="text-xs text-white/70 mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {pkg.category}
            </p>
          )}
          {basePrice && basePrice > 0 ? (
            <div className="mb-2">
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-white/80">from</span>
                <span className="text-xl font-bold text-white">
                  {formatGBP(totalPrice)}
                </span>
                <span className="text-[10px] text-white/60">total pp</span>
              </div>
              {totalLocalCharges > 0 && (
                <p className="text-[10px] text-white/60 mt-0.5">
                  {formatGBP(basePrice)} + {(() => {
                    const parts: string[] = [];
                    if (cityTax > 0) {
                      let cityPart = `${formatGBP(cityTax)} City taxes`;
                      if (cityTaxInfo?.eurAmount && cityTaxInfo.eurAmount > 0 && cityTaxInfo.eurToGbpRate) {
                        cityPart += ` (€${cityTaxInfo.eurAmount.toFixed(2)} @ ${cityTaxInfo.eurToGbpRate.toFixed(2)})`;
                      }
                      parts.push(cityPart);
                    }
                    if (additionalChargeName && additionalChargeGbpAmount > 0) {
                      parts.push(`${formatGBP(additionalChargeGbpAmount)} ${additionalChargeName} (${additionalChargeCurrency} ${additionalChargeForeignAmount.toFixed(2)} @ ${additionalChargeExchangeRate.toFixed(2)})`);
                    }
                    return parts.join(' + ');
                  })()} paid locally
                </p>
              )}
            </div>
          ) : (
            <div className="mb-2">
              <span className="text-sm text-white/80">Price on request</span>
            </div>
          )}
          <Button variant="secondary" size="sm" className="w-full text-xs">
            View Details
          </Button>
        </div>
      </div>
    </Link>
  );
}

export type { CityTaxInfo };
