import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, DollarSign, AlertCircle, CheckCircle2, XCircle, Users } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

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
  date?: string;
  time?: string;
  availabilityCount?: number;
  unlimitedAvailability?: boolean;
  soldOut?: boolean;
  unavailable?: boolean;
  pricesByRate?: Array<{
    id?: string;
    title?: string;
    price?: number;
    currency?: string;
  }>;
}

export function AvailabilityChecker({ productId, productTitle, rates }: AvailabilityCheckerProps) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedRate, setSelectedRate] = useState<string>("");
  const [numberOfPeople, setNumberOfPeople] = useState<string>("2");
  const [availabilities, setAvailabilities] = useState<AvailabilityData[]>([]);

  console.log("AvailabilityChecker rates:", rates, "length:", rates?.length);

  const checkAvailabilityMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) {
        throw new Error("Please select both start and end dates");
      }

      const formattedStart = format(startDate, "yyyy-MM-dd");
      const formattedEnd = format(endDate, "yyyy-MM-dd");

      const response = await apiRequest(
        "GET",
        `/api/bokun/availability/${productId}?start=${formattedStart}&end=${formattedEnd}&currency=USD`
      );
      return response;
    },
    onSuccess: (data: any) => {
      setAvailabilities(data.availabilities || data.results || []);
      toast({
        title: "Availability Loaded",
        description: `Found ${(data.availabilities || data.results || []).length} available slots`,
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

  return (
    <Card data-testid="card-availability-checker">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Check Availability
        </CardTitle>
        <p className="text-sm text-muted-foreground">{productTitle}</p>
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
            data-testid="input-people-count"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-start-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  data-testid="calendar-start-date"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-end-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => startDate ? date < startDate : false}
                  data-testid="calendar-end-date"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Button
          onClick={handleCheckAvailability}
          disabled={!startDate || !endDate || checkAvailabilityMutation.isPending || (rates && rates.length > 0 && !selectedRate)}
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
                            {availability.date || "Date not specified"}
                            {availability.time && ` at ${availability.time}`}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 ${status.color}`}>
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">{status.text}</span>
                        </div>
                      </div>

                      {availability.pricesByRate && availability.pricesByRate.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Pricing Options:</div>
                          <div className="flex flex-wrap gap-2">
                            {availability.pricesByRate.map((rate, rateIndex) => (
                              <div key={rateIndex} className="flex items-center gap-1 text-xs bg-muted/30 rounded px-2 py-1">
                                <span className="text-muted-foreground">{rate.title}:</span>
                                <span className="font-semibold text-primary">£{rate.price?.toFixed(2)}</span>
                              </div>
                            ))}
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

        {!checkAvailabilityMutation.isPending && availabilities.length === 0 && startDate && endDate && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Click "Check Availability" to see available slots
          </div>
        )}
      </CardContent>
    </Card>
  );
}
