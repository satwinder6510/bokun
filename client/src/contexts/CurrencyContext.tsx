import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
];

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
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(3000), // 3 second timeout
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
    console.warn('Failed to detect location, using default USD:', error);
  }
  
  // Default to USD if detection fails
  return CURRENCIES[0];
}

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('selectedCurrency');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return CURRENCIES.find(c => c.code === parsed.code) || CURRENCIES[0];
      } catch {
        return CURRENCIES[0];
      }
    }
    return CURRENCIES[0]; // Temporary default, will be updated by geo-detection
  });

  const setSelectedCurrency = (currency: Currency) => {
    setSelectedCurrencyState(currency);
    localStorage.setItem('selectedCurrency', JSON.stringify(currency));
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
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency }}>
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
