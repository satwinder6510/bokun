import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plane, Calendar, ChevronLeft, ChevronRight, 
  Loader2, Clock, MapPin, Info 
} from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay, isBefore, startOfDay } from "date-fns";
import { siteConfig } from "@/config/site";

type CombinedPrice = {
  date: string;
  isoDate: string;
  flightPricePerPerson: number;
  landTourPricePerPerson: number;
  subtotal: number;
  markupPercent: number;
  afterMarkup: number;
  finalPrice: number;
  currency: string;
  departureAirport: string;
  departureAirportName: string;
  airline: string;
  outboundDeparture: string;
  outboundArrival: string;
  inboundDeparture: string;
  inboundArrival: string;
};

type FlightPricingResponse = {
  enabled: boolean;
  message?: string;
  config?: {
    arriveAirportCode: string;
    departAirports: string[];
    durationNights: number;
    markupPercent: number;
    searchStartDate: string;
    searchEndDate: string;
  };
  landTourPricePerPerson?: number;
  availableDates?: number;
  prices?: CombinedPrice[];
};

type DateOptionsResponse = {
  date: string;
  options: CombinedPrice[];
};

interface FlightPricingCalendarProps {
  bokunProductId: string;
  productTitle: string;
}

export function FlightPricingCalendar({ bokunProductId, productTitle }: FlightPricingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedIsoDate, setSelectedIsoDate] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  const { data: pricingData, isLoading, error } = useQuery<FlightPricingResponse>({
    queryKey: ["/api/tours", bokunProductId, "flight-pricing"],
    queryFn: async () => {
      const response = await fetch(`/api/tours/${bokunProductId}/flight-pricing`);
      if (!response.ok) throw new Error("Failed to fetch pricing");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: dateOptions, isLoading: isLoadingOptions } = useQuery<DateOptionsResponse>({
    queryKey: ["/api/tours", bokunProductId, "flight-pricing", selectedDate],
    queryFn: async () => {
      if (!selectedDate) throw new Error("No date selected");
      const urlDate = selectedDate.replace(/\//g, "-");
      const response = await fetch(`/api/tours/${bokunProductId}/flight-pricing/${urlDate}`);
      if (!response.ok) throw new Error("Failed to fetch options");
      return response.json();
    },
    enabled: !!selectedDate && detailsDialogOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { pricesByDate, minPriceByDate, minPrice, maxPrice } = useMemo(() => {
    if (!pricingData?.prices?.length) {
      return { 
        pricesByDate: new Map<string, CombinedPrice[]>(), 
        minPriceByDate: new Map<string, number>(),
        minPrice: 0, 
        maxPrice: 0 
      };
    }
    
    const pricesMap = new Map<string, CombinedPrice[]>();
    const minPrices = new Map<string, number>();
    
    pricingData.prices.forEach((price) => {
      const existing = pricesMap.get(price.isoDate) || [];
      existing.push(price);
      pricesMap.set(price.isoDate, existing);
      
      const currentMin = minPrices.get(price.isoDate) ?? Infinity;
      if (price.finalPrice < currentMin) {
        minPrices.set(price.isoDate, price.finalPrice);
      }
    });
    
    const allMinPrices = Array.from(minPrices.values());
    return {
      pricesByDate: pricesMap,
      minPriceByDate: minPrices,
      minPrice: Math.min(...allMinPrices),
      maxPrice: Math.max(...allMinPrices),
    };
  }, [pricingData?.prices]);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Checking flight prices...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !pricingData?.enabled || !pricingData?.prices?.length) {
    return null;
  }

  const getPriceColorClass = (price: number): string => {
    const range = maxPrice - minPrice;
    if (range === 0) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
    const normalized = (price - minPrice) / range;
    if (normalized < 0.33) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
    if (normalized < 0.66) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const handleDateClick = (date: Date) => {
    const isoDate = format(date, "yyyy-MM-dd");
    const priceOptions = pricesByDate.get(isoDate);
    if (priceOptions && priceOptions.length > 0) {
      setSelectedDate(priceOptions[0].date);
      setSelectedIsoDate(isoDate);
      setDetailsDialogOpen(true);
    }
  };

  const formatFlightTime = (dateTimeStr: string): string => {
    if (!dateTimeStr) return "";
    const parts = dateTimeStr.split(" ");
    return parts.length > 1 ? parts[1] : dateTimeStr;
  };

  const formatFlightDate = (dateTimeStr: string): string => {
    if (!dateTimeStr) return "";
    const parts = dateTimeStr.split(" ");
    return parts[0] || dateTimeStr;
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(0);
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/30">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/50">
              <Plane className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl flex items-center gap-2">
                Flight + Tour Packages
              </CardTitle>
              <CardDescription className="mt-1">
                Book with flights from UK airports - {pricingData.config?.durationNights} nights included
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">From</div>
              <div className="text-2xl font-bold text-primary">
                {siteConfig.currency.symbol}{formatPrice(minPrice)}
              </div>
              <div className="text-xs text-muted-foreground">per person</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold" data-testid="text-current-month">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}

            {Array.from({ length: startDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="h-16" />
            ))}

            {daysInMonth.map((day) => {
              const isoDate = format(day, "yyyy-MM-dd");
              const priceOptions = pricesByDate.get(isoDate);
              const dateMinPrice = minPriceByDate.get(isoDate);
              const isPast = isBefore(day, startOfDay(new Date()));
              const hasPrice = !!priceOptions && priceOptions.length > 0 && dateMinPrice !== undefined && !isPast;

              return (
                <div
                  key={isoDate}
                  className={`
                    h-16 p-1 border rounded-md flex flex-col items-center justify-center cursor-pointer
                    transition-all
                    ${hasPrice ? "hover:border-primary hover:shadow-sm" : ""}
                    ${isPast ? "opacity-40" : ""}
                    ${isToday(day) ? "border-primary" : "border-muted"}
                  `}
                  onClick={() => hasPrice && handleDateClick(day)}
                  data-testid={`calendar-day-${isoDate}`}
                >
                  <span className={`text-sm ${isToday(day) ? "font-bold text-primary" : ""}`}>
                    {format(day, "d")}
                  </span>
                  {hasPrice && dateMinPrice !== undefined && (
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${getPriceColorClass(dateMinPrice)}`}
                    >
                      {siteConfig.currency.symbol}{formatPrice(dateMinPrice)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-4 pt-4 border-t">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-100 dark:bg-green-900/30" />
              <span>Best Price</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30" />
              <span>Good Price</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-100 dark:bg-orange-900/30" />
              <span>Higher Price</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
            <Info className="h-3 w-3" />
            Click a date to see all flight options from different UK airports
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Flight Options for {selectedDate}
            </DialogTitle>
            <DialogDescription>
              Choose your preferred departure airport for {productTitle}
            </DialogDescription>
          </DialogHeader>

          {isLoadingOptions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading flight options...</span>
            </div>
          ) : dateOptions?.options && dateOptions.options.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Departure</TableHead>
                    <TableHead>Airline</TableHead>
                    <TableHead>Outbound</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dateOptions.options.map((option, idx) => (
                    <TableRow key={idx} data-testid={`row-flight-option-${idx}`}>
                      <TableCell>
                        <div className="font-medium">{option.departureAirportName}</div>
                        <div className="text-xs text-muted-foreground">{option.departureAirport}</div>
                      </TableCell>
                      <TableCell>{option.airline}</TableCell>
                      <TableCell>
                        <div className="text-sm">{formatFlightTime(option.outboundDeparture)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFlightDate(option.outboundDeparture)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatFlightTime(option.inboundDeparture)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFlightDate(option.inboundDeparture)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-lg">{siteConfig.currency.symbol}{formatPrice(option.finalPrice)}</div>
                        <div className="text-xs text-muted-foreground">per person</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                <h4 className="font-medium">Price Includes:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Plane className="h-4 w-4" /> Return flights from selected UK airport
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> {pricingData.config?.durationNights} nights accommodation
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Full tour itinerary as described
                  </li>
                </ul>
              </div>

              <div className="text-center pt-4">
                <Button size="lg" className="gap-2" data-testid="button-enquire">
                  <Calendar className="h-4 w-4" />
                  Enquire About This Date
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No flight options available for this date.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
