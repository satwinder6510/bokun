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
