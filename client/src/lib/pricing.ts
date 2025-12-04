/**
 * Bokun Pricing Utilities
 * 
 * Bokun API returns net prices. This module applies the required markup
 * for display and booking purposes.
 */

// 10% markup on all Bokun net prices
const BOKUN_MARKUP_PERCENTAGE = 10;

/**
 * Apply markup to a Bokun net price
 * @param netPrice - The net price from Bokun API
 * @returns The price with markup applied
 */
export function applyBokunMarkup(netPrice: number): number {
  return netPrice * (1 + BOKUN_MARKUP_PERCENTAGE / 100);
}

/**
 * Get the current markup percentage (for display purposes if needed)
 */
export function getBokunMarkupPercentage(): number {
  return BOKUN_MARKUP_PERCENTAGE;
}

/**
 * Smart rounding to psychological price points ending in x49, x69, or x99
 * Finds the closest ending among these options.
 * 
 * Examples:
 * - 460 → 469 (closest to x69)
 * - 440 → 449 (closest to x49)
 * - 485 → 499 (closest to x99)
 * - 520 → 499 (closest to x99, going down)
 * 
 * @param price - The raw price to round
 * @returns The price rounded to nearest x49, x69, or x99
 */
export function smartRoundPrice(price: number): number {
  const hundreds = Math.floor(price / 100);
  const remainder = price % 100;
  
  // Possible endings for this hundreds bucket
  const candidates = [
    hundreds * 100 + 49,       // x49 in current hundred
    hundreds * 100 + 69,       // x69 in current hundred
    hundreds * 100 + 99,       // x99 in current hundred
    (hundreds + 1) * 100 + 49, // x49 in next hundred
  ];
  
  // Also consider previous hundred's x99 if we're close to it
  if (hundreds > 0) {
    candidates.push((hundreds - 1) * 100 + 99);
  }
  
  // Find the candidate closest to the original price
  let closest = candidates[0];
  let minDiff = Math.abs(price - closest);
  
  for (const candidate of candidates) {
    const diff = Math.abs(price - candidate);
    if (diff < minDiff || (diff === minDiff && candidate > closest)) {
      // Prefer higher price on ties (x99 over x49 if equidistant)
      closest = candidate;
      minDiff = diff;
    }
  }
  
  return closest;
}

/**
 * Calculate combined package price with markup and smart rounding
 * 
 * @param flightPrice - Flight price per person (GBP)
 * @param landTourPrice - Land tour price per person
 * @param markupPercent - Markup percentage (e.g., 15 for 15%)
 * @returns Object with price breakdown
 */
export function calculatePackagePrice(
  flightPrice: number,
  landTourPrice: number,
  markupPercent: number
): {
  flightPricePerPerson: number;
  landTourPricePerPerson: number;
  subtotal: number;
  markupPercent: number;
  afterMarkup: number;
  finalPrice: number;
} {
  const subtotal = flightPrice + landTourPrice;
  const afterMarkup = subtotal * (1 + markupPercent / 100);
  const finalPrice = smartRoundPrice(afterMarkup);
  
  return {
    flightPricePerPerson: flightPrice,
    landTourPricePerPerson: landTourPrice,
    subtotal,
    markupPercent,
    afterMarkup,
    finalPrice,
  };
}
