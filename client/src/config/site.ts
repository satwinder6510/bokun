/**
 * Site Configuration
 * 
 * Centralized configuration for market-specific settings.
 * Edit this file to customize the site for different markets.
 */

export const siteConfig = {
  // Market/Region
  market: 'US', // US, UK, AU, etc.
  
  // Currency
  currency: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
  },
  
  // Since Bokun prices are in USD, no conversion needed for US market
  // Set to 1.0 for USD sites, or the actual rate for other currencies
  exchangeRate: 1.0,
  
  // Markup percentage on Bokun prices
  markupPercentage: 10,
  
  // Feature flags
  features: {
    flightPackages: false, // Disable flight packages for tours-only site
    landTours: true,
    blog: true,
    newsletter: true,
  },
  
  // Contact information
  contact: {
    phone: '+1 (555) 123-4567',
    email: 'info@example.com',
    address: '',
  },
  
  // Company info
  company: {
    name: 'Tours & Adventures',
    tagline: 'Discover Amazing Destinations',
  },
};

export type SiteConfig = typeof siteConfig;
