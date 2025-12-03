import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
];

// Default currency for UK-based business
const DEFAULT_CURRENCY = CURRENCIES[0]; // GBP

// Map country codes to currency codes
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // United States
  'US': 'USD',
  // Canada
  'CA': 'CAD',
  // United Kingdom
  'GB': 'GBP',
  // India
  'IN': 'INR',
  // Eurozone countries
  'AT': 'EUR', // Austria
  'BE': 'EUR', // Belgium
  'CY': 'EUR', // Cyprus
  'EE': 'EUR', // Estonia
  'FI': 'EUR', // Finland
  'FR': 'EUR', // France
  'DE': 'EUR', // Germany
  'GR': 'EUR', // Greece
  'IE': 'EUR', // Ireland
  'IT': 'EUR', // Italy
  'LV': 'EUR', // Latvia
  'LT': 'EUR', // Lithuania
  'LU': 'EUR', // Luxembourg
  'MT': 'EUR', // Malta
  'NL': 'EUR', // Netherlands
  'PT': 'EUR', // Portugal
  'SK': 'EUR', // Slovakia
  'SI': 'EUR', // Slovenia
  'ES': 'EUR', // Spain
};

async function detectCurrencyFromLocation(): Promise<Currency> {
  try {
    // Use ipapi.co free tier (1000 requests/day, no API key needed)
    // Increased timeout to 5 seconds for slower mobile networks
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch location');
    }
    
    const data = await response.json();
    const countryCode = data.country_code;
    
    if (countryCode && COUNTRY_TO_CURRENCY[countryCode]) {
      const currencyCode = COUNTRY_TO_CURRENCY[countryCode];
      const currency = CURRENCIES.find(c => c.code === currencyCode);
      if (currency) {
        console.log(`Detected location: ${countryCode}, setting currency to ${currencyCode}`);
        return currency;
      }
    }
  } catch (error) {
    console.warn('Failed to detect location, using default GBP:', error);
  }
  
  // Default to GBP for UK-based business if detection fails
  return DEFAULT_CURRENCY;
}

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  formatCurrency: (amount: number, currencyCode?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('selectedCurrency');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return CURRENCIES.find(c => c.code === parsed.code) || DEFAULT_CURRENCY;
      } catch {
        return DEFAULT_CURRENCY;
      }
    }
    return DEFAULT_CURRENCY; // GBP default, will be updated by geo-detection if different location
  });

  const setSelectedCurrency = (currency: Currency) => {
    setSelectedCurrencyState(currency);
    localStorage.setItem('selectedCurrency', JSON.stringify(currency));
  };

  const formatCurrency = (amount: number, currencyCode?: string): string => {
    const currency = currencyCode
      ? CURRENCIES.find(c => c.code === currencyCode) || selectedCurrency
      : selectedCurrency;
    
    return `${currency.symbol}${amount.toFixed(2)}`;
  };

  // Detect currency from geo-location on first visit
  useEffect(() => {
    const saved = localStorage.getItem('selectedCurrency');
    
    // Only detect location if user hasn't set a preference
    if (!saved) {
      detectCurrencyFromLocation().then(detectedCurrency => {
        setSelectedCurrency(detectedCurrency);
      });
    }
  }, []);

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
