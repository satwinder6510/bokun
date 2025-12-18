import { createContext, useContext, ReactNode } from 'react';
import { siteConfig } from '@/config/site';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

// Get currency from site configuration
const SITE_CURRENCY: Currency = siteConfig.currency;

interface CurrencyContextType {
  selectedCurrency: Currency;
  formatCurrency: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const formatCurrency = (amount: number): string => {
    return `${SITE_CURRENCY.symbol}${amount.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ selectedCurrency: SITE_CURRENCY, formatCurrency }}>
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
