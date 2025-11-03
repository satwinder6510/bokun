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

interface AvailabilityCheckerProps {
  productId: string;
  productTitle: string;
  rates?: Rate[];
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
  }>;
}

export function AvailabilityChecker({ productId, productTitle, rates }: AvailabilityCheckerProps) {
  const { toast } = useToast();
  const [departureDate, setDepartureDate] = useState<Date>();
  const [selectedRate, setSelectedRate] = useState<string>("");
  const [numberOfPeople, setNumberOfPeople] = useState<string>("2");
  const [availabilities, setAvailabilities] = useState<AvailabilityData[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);

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
      console.log("Raw availability data:", initialAvailability.length, "items");
      console.log("First item:", initialAvailability[0]);
      
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
                console.log("Parsed date from ID:", a.id, "->", dateStr, "->", parsedDate);
                return parsedDate;
              }
            } catch (error) {
              console.error("Error parsing date from ID:", a.id, error);
              return null;
            }
          }
          return null;
        })
        .filter((d: Date | null): d is Date => d !== null);
      
      console.log("Available dates after filtering:", dates.length, dates);
      setAvailableDates(dates);
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
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={departureDate}
                onSelect={setDepartureDate}
                initialFocus
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
                            {(availability.time || availability.startTime) && ` at ${availability.time || availability.startTime}`}
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
                            {availability.pricesByRate.map((priceInfo) => {
                              const rate = availability.rates?.find(r => r.id === priceInfo.activityRateId);
                              const price = priceInfo.pricePerCategoryUnit?.[0]?.amount;
                              
                              if (!rate || !price) return null;
                              
                              return (
                                <div key={priceInfo.activityRateId} className="flex items-center gap-1 text-xs bg-muted/30 rounded px-2 py-1">
                                  <span className="text-muted-foreground">{rate.title}:</span>
                                  <span className="font-semibold text-primary">
                                    {price.currency === 'GBP' ? '£' : price.currency === 'USD' ? '$' : price.currency}
                                    {price.amount?.toFixed(2)}
                                  </span>
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
