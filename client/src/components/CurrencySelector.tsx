import { Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrency, CURRENCIES } from '@/contexts/CurrencyContext';

export function CurrencySelector() {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();

  return (
    <Select
      value={selectedCurrency.code}
      onValueChange={(code) => {
        const currency = CURRENCIES.find(c => c.code === code);
        if (currency) {
          setSelectedCurrency(currency);
        }
      }}
    >
      <SelectTrigger 
        className="w-[120px] bg-transparent border-border/40 hover-elevate"
        data-testid="select-currency"
      >
        <SelectValue>
          <span className="flex items-center gap-2">
            <span className="font-medium">{selectedCurrency.symbol}</span>
            <span className="text-sm">{selectedCurrency.code}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((currency) => (
          <SelectItem 
            key={currency.code} 
            value={currency.code}
            data-testid={`option-currency-${currency.code.toLowerCase()}`}
          >
            <div className="flex items-center justify-between w-full gap-3">
              <span className="flex items-center gap-2">
                <span className="font-medium w-6">{currency.symbol}</span>
                <span className="text-sm">{currency.code}</span>
              </span>
              {selectedCurrency.code === currency.code && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
