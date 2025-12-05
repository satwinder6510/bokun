import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { setExchangeRate, getExchangeRate, applyBokunPricing } from "@/lib/pricing";

interface ExchangeRateResponse {
  rate: number;
}

/**
 * Hook to fetch and cache the USD to GBP exchange rate
 * Updates the pricing module's cached rate when data is fetched
 */
export function useExchangeRate() {
  const { data, isLoading, error } = useQuery<ExchangeRateResponse>({
    queryKey: ["/api/exchange-rate"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  useEffect(() => {
    if (data?.rate) {
      setExchangeRate(data.rate);
    }
  }, [data]);

  const rate = data?.rate ?? getExchangeRate();

  return {
    rate,
    isLoading,
    error,
    formatBokunPrice: (usdPrice: number) => applyBokunPricing(usdPrice, rate),
  };
}
