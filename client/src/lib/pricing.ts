/**
 * Bokun Pricing Utilities
 * 
 * Bokun API returns net prices in USD. This module:
 * 1. Converts USD to GBP using the configurable exchange rate
 * 2. Applies the 10% markup for display and booking purposes.
 */

// 10% markup on all Bokun net prices
const BOKUN_MARKUP_PERCENTAGE = 10;

// Default exchange rate (fallback if API unavailable)
const DEFAULT_USD_TO_GBP_RATE = 0.79;

// Cache for exchange rate to avoid repeated API calls
let cachedExchangeRate: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the current exchange rate from the API
 * @returns The USD to GBP exchange rate
 */
export async function fetchExchangeRate(): Promise<number> {
  // Return cached rate if still valid
  if (cachedExchangeRate !== null && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedExchangeRate;
  }
  
  try {
    const response = await fetch('/api/exchange-rate');
    if (response.ok) {
      const data = await response.json();
      const rate = data.rate as number;
      cachedExchangeRate = rate;
      cacheTimestamp = Date.now();
      return rate;
    }
  } catch (error) {
    console.warn('Failed to fetch exchange rate, using default:', error);
  }
  
  return DEFAULT_USD_TO_GBP_RATE;
}

/**
 * Get the cached exchange rate (sync version for immediate use)
 * Returns the cached rate or default if not cached
 */
export function getExchangeRate(): number {
  return cachedExchangeRate ?? DEFAULT_USD_TO_GBP_RATE;
}

/**
 * Set the exchange rate (for use by hooks that fetch it)
 */
export function setExchangeRate(rate: number): void {
  cachedExchangeRate = rate;
  cacheTimestamp = Date.now();
}

/**
 * Convert USD price to GBP
 * @param usdPrice - The price in USD
 * @param exchangeRate - Optional custom exchange rate (defaults to cached/default rate)
 * @returns The price in GBP
 */
export function convertUsdToGbp(usdPrice: number, exchangeRate?: number): number {
  const rate = exchangeRate ?? getExchangeRate();
  return usdPrice * rate;
}

/**
 * Apply markup to a Bokun net price (legacy function - still works with USD prices)
 * @param netPrice - The net price from Bokun API (USD)
 * @returns The price with markup applied (still in USD - use applyBokunPricing for full conversion)
 * @deprecated Use applyBokunPricing for proper USD→GBP conversion with markup
 */
export function applyBokunMarkup(netPrice: number): number {
  return netPrice * (1 + BOKUN_MARKUP_PERCENTAGE / 100);
}

/**
 * Apply full Bokun pricing: USD→GBP conversion + 10% markup
 * This is the main function to use for displaying Bokun prices to UK customers
 * 
 * @param usdNetPrice - The net price from Bokun API in USD
 * @param exchangeRate - Optional custom exchange rate
 * @returns The final price in GBP with markup applied
 */
export function applyBokunPricing(usdNetPrice: number, exchangeRate?: number): number {
  const gbpPrice = convertUsdToGbp(usdNetPrice, exchangeRate);
  return gbpPrice * (1 + BOKUN_MARKUP_PERCENTAGE / 100);
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
