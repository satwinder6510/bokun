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

interface ExchangeRates {
  [key: string]: number;
}

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  exchangeRates: ExchangeRates | null;
  convertFromGBP: (amount: number, toCurrency: string) => number;
  isRatesLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('selectedCurrency');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return CURRENCIES.find(c => c.code === parsed.code) || CURRENCIES[0]; // Default to USD
      } catch {
        return CURRENCIES[0]; // Default to USD
      }
    }
    return CURRENCIES[0]; // Default to USD (index 0)
  });

  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [isRatesLoading, setIsRatesLoading] = useState(true);

  const setSelectedCurrency = (currency: Currency) => {
    setSelectedCurrencyState(currency);
    localStorage.setItem('selectedCurrency', JSON.stringify(currency));
  };

  // Fetch exchange rates on mount (cached for 24 hours)
  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        // Check if rates are cached and still valid (24 hours)
        const cachedRates = localStorage.getItem('exchangeRates');
        const cachedTimestamp = localStorage.getItem('exchangeRatesTimestamp');
        
        if (cachedRates && cachedTimestamp) {
          const timestamp = parseInt(cachedTimestamp);
          const now = Date.now();
          const hoursSinceCache = (now - timestamp) / (1000 * 60 * 60);
          
          if (hoursSinceCache < 24) {
            // Use cached rates
            setExchangeRates(JSON.parse(cachedRates));
            setIsRatesLoading(false);
            return;
          }
        }

        // Fetch fresh rates from exchangerate-api.com (free, no API key)
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
        
        if (!response.ok) {
          throw new Error('Failed to fetch exchange rates');
        }
        
        const data = await response.json();
        const rates = data.rates as ExchangeRates;
        
        // Cache the rates
        localStorage.setItem('exchangeRates', JSON.stringify(rates));
        localStorage.setItem('exchangeRatesTimestamp', Date.now().toString());
        
        setExchangeRates(rates);
        setIsRatesLoading(false);
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
        // Fallback: use approximate static rates if API fails
        const fallbackRates: ExchangeRates = {
          'GBP': 1,
          'USD': 1.27,
          'EUR': 1.17,
          'CAD': 1.75,
          'INR': 105.5,
        };
        setExchangeRates(fallbackRates);
        setIsRatesLoading(false);
      }
    };

    fetchExchangeRates();
  }, []);

  // Convert amount from GBP to target currency
  const convertFromGBP = (amount: number, toCurrency: string): number => {
    if (!exchangeRates || toCurrency === 'GBP') {
      return amount;
    }
    
    const rate = exchangeRates[toCurrency];
    if (!rate) {
      return amount;
    }
    
    return amount * rate;
  };

  return (
    <CurrencyContext.Provider value={{ 
      selectedCurrency, 
      setSelectedCurrency, 
      exchangeRates, 
      convertFromGBP,
      isRatesLoading 
    }}>
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
