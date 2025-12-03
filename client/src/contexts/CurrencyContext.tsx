import { createContext, useContext, ReactNode } from 'react';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

// Fixed currency for UK-based business - all prices in GBP
const GBP_CURRENCY: Currency = { code: 'GBP', symbol: '£', name: 'British Pound' };

interface CurrencyContextType {
  selectedCurrency: Currency;
  formatCurrency: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const formatCurrency = (amount: number): string => {
    return `${GBP_CURRENCY.symbol}${amount.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider value={{ selectedCurrency: GBP_CURRENCY, formatCurrency }}>
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
