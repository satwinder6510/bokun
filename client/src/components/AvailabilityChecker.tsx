import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Users, Loader2, ShoppingCart, CreditCard, ChevronDown, Check, Minus, Plus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { apiRequest } from "@/lib/queryClient";
import { format, addMonths } from "date-fns";
import { useLocation } from "wouter";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface Rate {
  id?: number;
  title?: string;
  description?: string;
  pricedPerPerson?: boolean;
  minPerBooking?: number;
  maxPerBooking?: number;
}

interface BookableExtra {
  id?: number;
  title?: string;
  information?: string;
  price?: number;
  pricingType?: string;
  pricingTypeLabel?: string;
  included?: boolean;
  free?: boolean;
}

interface AvailabilityCheckerProps {
  productId: string;
  productTitle: string;
  rates?: Rate[];
  bookableExtras?: BookableExtra[];
  startingPrice?: number;
}

interface AvailabilityData {
  id?: string;
  date?: number;
  localizedDate?: string;
  time?: string;
  startTime?: string;
  availabilityCount?: number;
  unlimitedAvailability?: boolean;
  soldOut?: boolean;
  unavailable?: boolean;
  rates?: Array<{
    id?: number;
    title?: string;
    pricedPerPerson?: boolean;
    extraConfigs?: Array<{
      activityExtraId?: number;
      selectionType?: string;
      pricingType?: string;
      pricedPerPerson?: boolean;
    }>;
  }>;
  pricesByRate?: Array<{
    activityRateId?: number;
    pricePerCategoryUnit?: Array<{
      id?: number;
      amount?: {
        amount?: number;
        currency?: string;
      };
    }>;
    extraPricePerCategoryUnit?: Array<{
      id?: number;
      prices?: Array<{
        id?: number;
        amount?: {
          amount?: number;
          currency?: string;
        };
      }>;
    }>;
  }>;
}

export function AvailabilityChecker({ productId, productTitle, rates, bookableExtras, startingPrice }: AvailabilityCheckerProps) {
  const { toast } = useToast();
  const { selectedCurrency } = useCurrency();
  const { addToCart } = useCart();
  const [, setLocation] = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [departureDate, setDepartureDate] = useState<Date>();
  const [selectedRate, setSelectedRate] = useState<string>("");
  const [numberOfPeople, setNumberOfPeople] = useState<number>(2);
  const [availabilities, setAvailabilities] = useState<AvailabilityData[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [dateRange, setDateRange] = useState<{ fromMonth?: Date; toMonth?: Date }>({});
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (selectedRate && rates) {
      const rate = rates.find(r => String(r.id) === selectedRate);
      if (rate && rate.minPerBooking === rate.maxPerBooking) {
        setNumberOfPeople(rate.minPerBooking || 1);
      }
    }
  }, [selectedRate, rates]);

  const { data: initialAvailability, isLoading: isLoadingDates } = useQuery({
    queryKey: ["/api/bokun/availability", productId, "initial", selectedCurrency.code],
    queryFn: async () => {
      const today = new Date();
      const sixMonthsLater = addMonths(today, 6);
      const formattedStart = format(today, "yyyy-MM-dd");
      const formattedEnd = format(sixMonthsLater, "yyyy-MM-dd");
      
      const response = await apiRequest(
        "GET",
        `/api/bokun/availability/${productId}?start=${formattedStart}&end=${formattedEnd}&currency=${selectedCurrency.code}`
      );
      return response;
    },
  });

  useEffect(() => {
    if (initialAvailability && Array.isArray(initialAvailability)) {
      const dates = initialAvailability
        .filter((a: any) => !a.soldOut && !a.unavailable)
        .map((a: any) => {
          if (a.id && typeof a.id === 'string') {
            try {
              const match = a.id.match(/_(\d{8})$/);
              if (match) {
                const dateStr = match[1];
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1;
                const day = parseInt(dateStr.substring(6, 8));
                return new Date(year, month, day);
              }
            } catch {
              return null;
            }
          }
          return null;
        })
        .filter((d: Date | null): d is Date => d !== null);
      
      setAvailableDates(dates);
      
      if (dates.length > 0) {
        const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
        const earliest = sortedDates[0];
        const latest = sortedDates[sortedDates.length - 1];
        setDateRange({ 
          fromMonth: new Date(earliest.getFullYear(), earliest.getMonth(), 1),
          toMonth: new Date(latest.getFullYear(), latest.getMonth(), 1)
        });
      }
    }
  }, [initialAvailability]);

  const checkAvailabilityMutation = useMutation({
    mutationFn: async (date: Date) => {
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await apiRequest(
        "GET",
        `/api/bokun/availability/${productId}?start=${formattedDate}&end=${formattedDate}&currency=${selectedCurrency.code}`
      );
      return response;
    },
    onSuccess: (data: any) => {
      const availabilityArray = Array.isArray(data) ? data : [];
      setAvailabilities(availabilityArray);
    },
    onError: (error: any) => {
      toast({
        title: "Could not load pricing",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setDepartureDate(date);
    if (date) {
      checkAvailabilityMutation.mutate(date);
    } else {
      setAvailabilities([]);
    }
  }, [checkAvailabilityMutation]);

  const isDateAvailable = useCallback((date: Date) => {
    return availableDates.some(
      (availableDate) =>
        availableDate.getFullYear() === date.getFullYear() &&
        availableDate.getMonth() === date.getMonth() &&
        availableDate.getDate() === date.getDate()
    );
  }, [availableDates]);

  const handleAddToCart = async (rateId: number, rateTitle: string, totalPrice: number, priceCurrency: string): Promise<boolean> => {
    if (!departureDate) {
      toast({ title: "Please select a date", variant: "destructive" });
      return false;
    }

    if (rates && rates.length > 0 && !selectedRate) {
      toast({ title: "Please select a room option", variant: "destructive" });
      return false;
    }

    if (priceCurrency !== selectedCurrency.code) {
      toast({
        title: "Currency mismatch",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return false;
    }

    const key = `${rateId}-${departureDate.getTime()}`;
    setAddingToCart(key);
    try {
      await addToCart({
        productId,
        productTitle,
        productPrice: totalPrice,
        currency: selectedCurrency.code,
        date: format(departureDate, "yyyy-MM-dd"),
        rateId,
        rateTitle,
        quantity: numberOfPeople,
      });
      toast({
        title: "Added to cart",
        description: `${productTitle} on ${format(departureDate, "MMM d, yyyy")}`,
      });
      setIsDrawerOpen(false);
      return true;
    } catch (error) {
      toast({
        title: "Failed to add to cart",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      return false;
    } finally {
      setAddingToCart(null);
    }
  };

  const handleBuyNow = async (rateId: number, rateTitle: string, totalPrice: number, priceCurrency: string) => {
    const success = await handleAddToCart(rateId, rateTitle, totalPrice, priceCurrency);
    if (success) {
      setLocation("/checkout");
    }
  };

  const incrementPeople = () => {
    const rate = rates?.find(r => String(r.id) === selectedRate);
    const max = rate?.maxPerBooking || 20;
    if (numberOfPeople < max) setNumberOfPeople(prev => prev + 1);
  };

  const decrementPeople = () => {
    const rate = rates?.find(r => String(r.id) === selectedRate);
    const min = rate?.minPerBooking || 1;
    if (numberOfPeople > min) setNumberOfPeople(prev => prev - 1);
  };

  const selectedRateObj = rates?.find(r => String(r.id) === selectedRate);
  const isFixedPeople = selectedRateObj?.minPerBooking === selectedRateObj?.maxPerBooking;

  const getPricingForSelectedRate = () => {
    if (!availabilities.length) return null;
    
    const availability = availabilities[0];
    if (!availability.pricesByRate) return null;

    const priceInfo = availability.pricesByRate.find(pr => 
      selectedRate ? String(pr.activityRateId) === selectedRate : true
    );

    if (!priceInfo) return null;

    const rate = availability.rates?.find(r => r.id === priceInfo.activityRateId);
    const price = priceInfo.pricePerCategoryUnit?.[0]?.amount;

    if (!rate || !price || price.amount === undefined) return null;

    const totalPrice = rate.pricedPerPerson 
      ? price.amount * numberOfPeople
      : price.amount;

    return {
      rateId: priceInfo.activityRateId!,
      rateTitle: rate.title!,
      pricePerPerson: price.amount,
      totalPrice,
      isPricedPerPerson: rate.pricedPerPerson,
    };
  };

  const pricing = getPricingForSelectedRate();

  const CalendarContent = () => (
    <Calendar
      mode="single"
      selected={departureDate}
      onSelect={handleDateSelect}
      numberOfMonths={isMobile ? 1 : 2}
      showOutsideDays={false}
      fromMonth={dateRange.fromMonth}
      toMonth={dateRange.toMonth}
      defaultMonth={dateRange.fromMonth}
      disabled={(date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today || (availableDates.length > 0 && !isDateAvailable(date));
      }}
      modifiers={{ available: availableDates }}
      modifiersClassNames={{ available: "bg-primary/10 font-semibold" }}
      className="rounded-md"
      data-testid="calendar-departure-date"
    />
  );

  const BookingForm = () => (
    <div className="space-y-4">
      {rates && rates.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Room & Hotel Category</label>
          <Select value={selectedRate} onValueChange={setSelectedRate}>
            <SelectTrigger data-testid="select-rate" className="w-full">
              <SelectValue placeholder="Select room type" />
            </SelectTrigger>
            <SelectContent>
              {rates.map((rate) => (
                <SelectItem key={rate.id} value={String(rate.id)}>
                  {rate.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Travelers
        </label>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={decrementPeople}
            disabled={isFixedPeople || numberOfPeople <= (selectedRateObj?.minPerBooking || 1)}
            data-testid="button-decrease-people"
            aria-label="Decrease number of travelers"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span 
            className="text-lg font-semibold w-12 text-center" 
            data-testid="text-people-count"
            aria-live="polite"
            aria-label={`${numberOfPeople} ${numberOfPeople === 1 ? 'traveler' : 'travelers'} selected`}
          >
            {numberOfPeople}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={incrementPeople}
            disabled={isFixedPeople || numberOfPeople >= (selectedRateObj?.maxPerBooking || 20)}
            data-testid="button-increase-people"
            aria-label="Increase number of travelers"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {numberOfPeople === 1 ? 'person' : 'people'}
          </span>
        </div>
        {isFixedPeople && (
          <p className="text-xs text-muted-foreground">
            This option requires exactly {selectedRateObj?.minPerBooking} {selectedRateObj?.minPerBooking === 1 ? 'person' : 'people'}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Departure Date</label>
        <div className="flex justify-center">
          <CalendarContent />
        </div>
        {availableDates.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {availableDates.length} dates available • Tap a highlighted date
          </p>
        )}
      </div>
    </div>
  );

  const PricingResults = () => {
    if (checkAvailabilityMutation.isPending) {
      return (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading prices...</span>
        </div>
      );
    }

    if (!departureDate || !availabilities.length) {
      return null;
    }

    const availability = availabilities[0];
    if (availability.soldOut || availability.unavailable) {
      return (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center">
          <p className="font-medium">Not available on this date</p>
          <p className="text-sm mt-1">Please select another date</p>
        </div>
      );
    }

    if (!pricing) {
      return (
        <div className="text-center py-4 text-muted-foreground">
          <p>No pricing available for this selection</p>
        </div>
      );
    }

    const canBook = departureDate && (!rates || rates.length === 0 || selectedRate);
    const key = `${pricing.rateId}-${departureDate.getTime()}`;
    const isAdding = addingToCart === key;

    return (
      <div className="space-y-4">
        <div className="bg-primary/5 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {format(departureDate, "EEEE, MMMM d, yyyy")}
              </p>
              {pricing.rateTitle && (
                <p className="font-medium">{pricing.rateTitle}</p>
              )}
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Check className="w-3 h-3 mr-1" />
              Available
            </Badge>
          </div>
          
          <div className="border-t pt-3">
            <div className="flex items-baseline justify-between">
              <div className="space-y-1">
                {pricing.isPricedPerPerson && (
                  <p className="text-sm text-muted-foreground">
                    {selectedCurrency.symbol}{pricing.pricePerPerson.toFixed(2)} × {numberOfPeople} {numberOfPeople === 1 ? 'person' : 'people'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Total price</p>
              </div>
              <p className="text-3xl font-bold text-primary" data-testid="text-total-price">
                {selectedCurrency.symbol}{pricing.totalPrice.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => handleAddToCart(pricing.rateId, pricing.rateTitle, pricing.totalPrice, selectedCurrency.code)}
            disabled={!canBook || isAdding}
            className="h-12"
            data-testid="button-add-to-cart"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isAdding ? "Adding..." : "Add to Cart"}
          </Button>
          <Button
            onClick={() => handleBuyNow(pricing.rateId, pricing.rateTitle, pricing.totalPrice, selectedCurrency.code)}
            disabled={!canBook || isAdding}
            className="h-12"
            data-testid="button-buy-now"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Book Now
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card data-testid="card-availability-checker" className="overflow-hidden">
        <CardContent className="p-0">
          {isLoadingDates ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading available dates...</span>
            </div>
          ) : (
            <div className="md:grid md:grid-cols-2">
              <div className="p-4 md:p-6 border-b md:border-b-0 md:border-r">
                <BookingForm />
              </div>
              
              <div className="p-4 md:p-6 bg-muted/30">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Your Selection
                </h3>
                
                {!departureDate ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Select a departure date</p>
                    <p className="text-sm mt-1">Pick a highlighted date from the calendar</p>
                  </div>
                ) : (
                  <PricingResults />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerTrigger asChild>
          <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t shadow-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                {startingPrice ? (
                  <>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="text-xl font-bold" data-testid="text-mobile-price">
                      {selectedCurrency.symbol}{startingPrice.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">per person</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Check availability</p>
                )}
              </div>
              <Button 
                className="h-12 px-6 gap-2"
                data-testid="button-check-availability-mobile"
              >
                <CalendarIcon className="w-4 h-4" />
                Select Date
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DrawerTrigger>
        
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Book This Tour</DrawerTitle>
            <DrawerDescription>{productTitle}</DrawerDescription>
          </DrawerHeader>
          
          <div className="px-4 pb-4 overflow-y-auto">
            <BookingForm />
            {departureDate && <div className="mt-6"><PricingResults /></div>}
          </div>
          
          <DrawerFooter className="border-t">
            <p className="text-xs text-center text-muted-foreground">
              Secure booking • Instant confirmation
            </p>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      
      <div className="h-24 md:hidden" />
    </>
  );
}
