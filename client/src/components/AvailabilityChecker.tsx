import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, DollarSign, AlertCircle, CheckCircle2, XCircle, Users, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, addMonths } from "date-fns";

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

export function AvailabilityChecker({ productId, productTitle, rates, bookableExtras }: AvailabilityCheckerProps) {
  const { toast } = useToast();
  const [departureDate, setDepartureDate] = useState<Date>();
  const [selectedRate, setSelectedRate] = useState<string>("");
  const [numberOfPeople, setNumberOfPeople] = useState<string>("2");
  const [availabilities, setAvailabilities] = useState<AvailabilityData[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [dateRange, setDateRange] = useState<{ fromMonth?: Date; toMonth?: Date }>({});

  // Auto-adjust number of people when rate is selected
  useEffect(() => {
    if (selectedRate && rates) {
      const rate = rates.find(r => String(r.id) === selectedRate);
      if (rate && rate.minPerBooking === rate.maxPerBooking) {
        // If rate requires exact number of people, set it automatically
        setNumberOfPeople(String(rate.minPerBooking));
      }
    }
  }, [selectedRate, rates]);

  // Fetch available dates for the next 6 months on mount
  const { data: initialAvailability, isLoading: isLoadingDates } = useQuery({
    queryKey: ["/api/bokun/availability", productId, "initial"],
    queryFn: async () => {
      const today = new Date();
      const sixMonthsLater = addMonths(today, 6);
      const formattedStart = format(today, "yyyy-MM-dd");
      const formattedEnd = format(sixMonthsLater, "yyyy-MM-dd");
      
      const response = await apiRequest(
        "GET",
        `/api/bokun/availability/${productId}?start=${formattedStart}&end=${formattedEnd}&currency=GBP`
      );
      return response;
    },
  });

  // Parse available dates from the API response
  useEffect(() => {
    if (initialAvailability && Array.isArray(initialAvailability)) {
      const dates = initialAvailability
        .filter((a: any) => !a.soldOut && !a.unavailable)
        .map((a: any) => {
          // Extract date from ID field (format: "77405_20251204" -> YYYYMMDD)
          if (a.id && typeof a.id === 'string') {
            try {
              const match = a.id.match(/_(\d{8})$/);
              if (match) {
                const dateStr = match[1]; // e.g., "20251204"
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
                const day = parseInt(dateStr.substring(6, 8));
                const parsedDate = new Date(year, month, day);
                return parsedDate;
              }
            } catch (error) {
              return null;
            }
          }
          return null;
        })
        .filter((d: Date | null): d is Date => d !== null);
      
      setAvailableDates(dates);
      
      // Calculate the date range (earliest and latest months with availability)
      if (dates.length > 0) {
        const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
        const earliest = sortedDates[0];
        const latest = sortedDates[sortedDates.length - 1];
        
        // Set fromMonth to the start of the earliest month
        const fromMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        // Set toMonth to the start of the latest month
        const toMonth = new Date(latest.getFullYear(), latest.getMonth(), 1);
        
        setDateRange({ fromMonth, toMonth });
      }
    }
  }, [initialAvailability]);

  const checkAvailabilityMutation = useMutation({
    mutationFn: async () => {
      if (!departureDate) {
        throw new Error("Please select a departure date");
      }

      const formattedDate = format(departureDate, "yyyy-MM-dd");

      const response = await apiRequest(
        "GET",
        `/api/bokun/availability/${productId}?start=${formattedDate}&end=${formattedDate}&currency=GBP`
      );
      return response;
    },
    onSuccess: (data: any) => {
      const availabilityArray = Array.isArray(data) ? data : [];
      setAvailabilities(availabilityArray);
      toast({
        title: "Availability Loaded",
        description: `Found ${availabilityArray.length} available slots`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Check Availability",
        description: error.message || "Could not retrieve availability data",
        variant: "destructive",
      });
    },
  });

  const handleCheckAvailability = () => {
    checkAvailabilityMutation.mutate();
  };

  const getAvailabilityStatus = (availability: AvailabilityData) => {
    if (availability.soldOut) {
      return { icon: XCircle, text: "Sold Out", color: "text-destructive" };
    }
    if (availability.unavailable) {
      return { icon: AlertCircle, text: "Unavailable", color: "text-muted-foreground" };
    }
    if (availability.unlimitedAvailability) {
      return { icon: CheckCircle2, text: "Unlimited", color: "text-green-600" };
    }
    if (availability.availabilityCount !== undefined && availability.availabilityCount > 0) {
      return { 
        icon: CheckCircle2, 
        text: `${availability.availabilityCount} available`, 
        color: "text-green-600" 
      };
    }
    return { icon: AlertCircle, text: "Unknown", color: "text-muted-foreground" };
  };

  // Helper function to check if a date is available
  const isDateAvailable = (date: Date) => {
    return availableDates.some(
      (availableDate) =>
        availableDate.getFullYear() === date.getFullYear() &&
        availableDate.getMonth() === date.getMonth() &&
        availableDate.getDate() === date.getDate()
    );
  };

  return (
    <Card data-testid="card-availability-checker">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isLoadingDates && <Loader2 className="h-5 w-5 animate-spin" />}
          {!isLoadingDates && <CalendarIcon className="h-5 w-5" />}
          Check Availability
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {productTitle}
          {isLoadingDates && " • Loading available dates..."}
          {!isLoadingDates && availableDates.length > 0 && ` • ${availableDates.length} dates available`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rates && rates.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Room & Hotel Category</label>
            <Select value={selectedRate} onValueChange={setSelectedRate}>
              <SelectTrigger data-testid="select-rate">
                <SelectValue placeholder="Select room type and category" />
              </SelectTrigger>
              <SelectContent>
                {rates.map((rate) => (
                  <SelectItem key={rate.id} value={String(rate.id)}>
                    {rate.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRate && rates.find(r => String(r.id) === selectedRate) && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                {rates.find(r => String(r.id) === selectedRate)?.pricedPerPerson && (
                  <span>Per person pricing • </span>
                )}
                {rates.find(r => String(r.id) === selectedRate)?.minPerBooking && 
                 rates.find(r => String(r.id) === selectedRate)?.maxPerBooking && (
                  <span>
                    {rates.find(r => String(r.id) === selectedRate)?.minPerBooking === 
                     rates.find(r => String(r.id) === selectedRate)?.maxPerBooking
                      ? `Requires exactly ${rates.find(r => String(r.id) === selectedRate)?.minPerBooking} ${
                          rates.find(r => String(r.id) === selectedRate)?.minPerBooking === 1 ? 'person' : 'people'
                        }`
                      : `${rates.find(r => String(r.id) === selectedRate)?.minPerBooking}-${
                          rates.find(r => String(r.id) === selectedRate)?.maxPerBooking
                        } people`
                    }
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Number of People
          </label>
          <Input
            type="number"
            min="1"
            max="20"
            value={numberOfPeople}
            onChange={(e) => setNumberOfPeople(e.target.value)}
            disabled={
              !!(selectedRate && 
              rates && 
              rates.find(r => String(r.id) === selectedRate)?.minPerBooking === 
              rates.find(r => String(r.id) === selectedRate)?.maxPerBooking)
            }
            data-testid="input-people-count"
          />
          {selectedRate && 
           rates && 
           rates.find(r => String(r.id) === selectedRate)?.minPerBooking === 
           rates.find(r => String(r.id) === selectedRate)?.maxPerBooking && (
            <p className="text-xs text-muted-foreground">
              This rate requires exactly {rates.find(r => String(r.id) === selectedRate)?.minPerBooking} {
                rates.find(r => String(r.id) === selectedRate)?.minPerBooking === 1 ? 'person' : 'people'
              }
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tour Departure Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                data-testid="button-departure-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {departureDate ? format(departureDate, "PPP") : "Select departure date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 max-w-fit" align="start">
              <Calendar
                mode="single"
                selected={departureDate}
                onSelect={setDepartureDate}
                initialFocus
                numberOfMonths={2}
                showOutsideDays={false}
                fromMonth={dateRange.fromMonth}
                toMonth={dateRange.toMonth}
                defaultMonth={dateRange.fromMonth}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  // Disable if before today or not in available dates
                  return date < today || (availableDates.length > 0 && !isDateAvailable(date));
                }}
                modifiers={{
                  available: availableDates,
                }}
                modifiersClassNames={{
                  available: "bg-primary/10 font-semibold",
                }}
                data-testid="calendar-departure-date"
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Highlighted dates are available departure dates for this tour
          </p>
        </div>

        <Button
          onClick={handleCheckAvailability}
          disabled={!departureDate || checkAvailabilityMutation.isPending || (rates && rates.length > 0 && !selectedRate)}
          className="w-full"
          data-testid="button-check-availability"
        >
          {checkAvailabilityMutation.isPending ? "Checking..." : "Check Availability & Pricing"}
        </Button>

        {availabilities.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Available Slots</h4>
              <Badge variant="outline" data-testid="text-availability-count">
                {availabilities.length} results
              </Badge>
            </div>
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-3">
                {availabilities.map((availability, index) => {
                  const status = getAvailabilityStatus(availability);
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={index}
                      className="rounded-lg border bg-card p-3 space-y-2"
                      data-testid={`card-availability-${index}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {availability.localizedDate || availability.date || "Date not specified"}
                            {(availability.time || availability.startTime) && 
                             (availability.time !== '00:00' && availability.startTime !== '00:00') && 
                             ` at ${availability.time || availability.startTime}`}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 ${status.color}`}>
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">{status.text}</span>
                        </div>
                      </div>

                      {availability.pricesByRate && availability.pricesByRate.length > 0 && availability.rates && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Pricing Options:</div>
                          <div className="flex flex-wrap gap-2">
                            {availability.pricesByRate
                              .filter((priceInfo) => {
                                // If a rate is selected, only show that rate's pricing
                                if (selectedRate) {
                                  return String(priceInfo.activityRateId) === selectedRate;
                                }
                                return true;
                              })
                              .map((priceInfo) => {
                                const rate = availability.rates?.find(r => r.id === priceInfo.activityRateId);
                                const price = priceInfo.pricePerCategoryUnit?.[0]?.amount;
                                
                                if (!rate || !price || price.amount === undefined) return null;
                                
                                // Convert USD to GBP (approximate rate: 1 USD = 0.79 GBP)
                                const gbpAmount = price.currency === 'USD' ? price.amount * 0.79 : price.amount;
                                
                                // Find board basis info from extraConfigs
                                const includedExtra = rate.extraConfigs?.find(
                                  ec => ec.pricingType === 'INCLUDED_IN_PRICE' && bookableExtras?.some(be => be.id === ec.activityExtraId)
                                );
                                const includedExtraName = includedExtra 
                                  ? bookableExtras?.find(be => be.id === includedExtra.activityExtraId)?.title
                                  : null;
                                
                                return (
                                  <div key={priceInfo.activityRateId} className="flex flex-col gap-0.5 text-xs bg-muted/30 rounded px-2 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground">{rate.title}:</span>
                                      <span className="font-semibold text-primary">
                                        £{gbpAmount.toFixed(2)}
                                      </span>
                                      <span className="text-muted-foreground text-[10px]">
                                        {rate.pricedPerPerson ? 'per person' : 'total'}
                                      </span>
                                    </div>
                                    {includedExtraName && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {includedExtraName} included
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {bookableExtras && bookableExtras.length > 0 && availability.pricesByRate && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="text-xs font-medium text-muted-foreground">Additional Options & Pricing:</div>
                          <div className="space-y-1.5">
                            {bookableExtras.map((extra) => {
                              // Find pricing from the availability response for this extra
                              let extraPrice: number | undefined;
                              
                              // Look through pricesByRate for the selected rate (or first rate if none selected)
                              const relevantPriceData = availability.pricesByRate?.find(pr => 
                                selectedRate ? String(pr.activityRateId) === selectedRate : true
                              );
                              
                              if (relevantPriceData?.extraPricePerCategoryUnit) {
                                const extraPricing = relevantPriceData.extraPricePerCategoryUnit.find(
                                  epc => epc.id === extra.id
                                );
                                if (extraPricing?.prices?.[0]?.amount) {
                                  extraPrice = extraPricing.prices[0].amount.amount;
                                }
                              }
                              
                              // Convert USD to GBP (approximate rate: 1 USD = 0.79 GBP)
                              const gbpPrice = extraPrice !== undefined ? extraPrice * 0.79 : undefined;
                              
                              return (
                                <div key={extra.id} className="flex items-start justify-between gap-2 text-xs bg-muted/30 rounded p-2">
                                  <div className="flex-1">
                                    <div className="font-medium">{extra.title}</div>
                                    {extra.information && (
                                      <div className="text-[10px] text-muted-foreground mt-0.5">{extra.information}</div>
                                    )}
                                    {extra.pricingTypeLabel && (
                                      <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {extra.pricingTypeLabel}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    {extra.free || extra.included ? (
                                      <Badge variant="secondary" className="text-[10px] h-5">
                                        {extra.free ? "Free" : "Included"}
                                      </Badge>
                                    ) : gbpPrice !== undefined && gbpPrice > 0 ? (
                                      <div className="font-semibold text-primary">£{gbpPrice.toFixed(2)}</div>
                                    ) : (
                                      <div className="text-[10px] text-muted-foreground">Price varies</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {!checkAvailabilityMutation.isPending && availabilities.length === 0 && departureDate && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Click "Check Availability" to see pricing for this departure
          </div>
        )}
      </CardContent>
    </Card>
  );
}
