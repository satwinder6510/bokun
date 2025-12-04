/**
 * Flight API Integration Service
 * 
 * Connects to external flight pricing API to fetch real-time flight prices.
 * Combines with Bokun land tour prices to create dynamic package pricing.
 */

import fetch from "node-fetch";
import type { FlightOffer, FlightTourPricingConfig } from "@shared/schema";

const FLIGHT_API_BASE = "http://87.102.127.86:8119/search/searchoffers.dll";

interface FlightSearchParams {
  departAirports: string; // Pipe-separated e.g., "LGW|STN|LTN"
  arriveAirport: string;  // 3-letter code e.g., "ATH"
  nights: number;         // Duration in nights
  startDate: string;      // DD/MM/YYYY format
  endDate: string;        // DD/MM/YYYY format
}

interface FlightApiResponse {
  Offers: FlightOffer[];
  error?: string;
}

/**
 * Smart rounding to psychological price points ending in x49, x69, or x99
 * Duplicated from client for server-side use
 */
export function smartRoundPrice(price: number): number {
  const hundreds = Math.floor(price / 100);
  
  const candidates = [
    hundreds * 100 + 49,       // x49 in current hundred
    hundreds * 100 + 69,       // x69 in current hundred
    hundreds * 100 + 99,       // x99 in current hundred
    (hundreds + 1) * 100 + 49, // x49 in next hundred
  ];
  
  if (hundreds > 0) {
    candidates.push((hundreds - 1) * 100 + 99);
  }
  
  let closest = candidates[0];
  let minDiff = Math.abs(price - closest);
  
  for (const candidate of candidates) {
    const diff = Math.abs(price - candidate);
    if (diff < minDiff || (diff === minDiff && candidate > closest)) {
      closest = candidate;
      minDiff = diff;
    }
  }
  
  return closest;
}

/**
 * Search for flights from the external API
 */
export async function searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
  const url = new URL(FLIGHT_API_BASE);
  
  // Build query string
  url.searchParams.set("depapt", params.departAirports);
  url.searchParams.set("arrapt", params.arriveAirport);
  url.searchParams.set("nights", params.nights.toString());
  url.searchParams.set("sdate", params.startDate);
  url.searchParams.set("edate", params.endDate);
  
  console.log(`[FlightAPI] Searching flights: ${url.toString()}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Flight API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json() as FlightApiResponse;
    
    if (data.error) {
      console.error(`[FlightAPI] Error from API: ${data.error}`);
      return [];
    }
    
    console.log(`[FlightAPI] Found ${data.Offers?.length || 0} flight offers`);
    return data.Offers || [];
  } catch (error) {
    console.error(`[FlightAPI] Error fetching flights:`, error);
    throw error;
  }
}

/**
 * Get the cheapest flight per departure date
 * Groups flights by outbound departure date and returns cheapest for each
 */
export function getCheapestFlightsByDate(offers: FlightOffer[]): Map<string, FlightOffer> {
  const cheapestByDate = new Map<string, FlightOffer>();
  
  for (const offer of offers) {
    // Extract date from outdep (format: DD/MM/YYYY HH:mm)
    const datePart = offer.outdep.split(" ")[0]; // DD/MM/YYYY
    
    const existing = cheapestByDate.get(datePart);
    const currentPrice = parseFloat(offer.fltnetpricepp);
    
    if (!existing || currentPrice < parseFloat(existing.fltnetpricepp)) {
      cheapestByDate.set(datePart, offer);
    }
  }
  
  return cheapestByDate;
}

/**
 * Get all available flights for a specific date
 */
export function getFlightsForDate(offers: FlightOffer[], date: string): FlightOffer[] {
  // date format is DD/MM/YYYY
  return offers.filter(offer => {
    const datePart = offer.outdep.split(" ")[0];
    return datePart === date;
  }).sort((a, b) => {
    // Sort by price ascending
    return parseFloat(a.fltnetpricepp) - parseFloat(b.fltnetpricepp);
  });
}

export interface CombinedPriceResult {
  date: string; // DD/MM/YYYY
  isoDate: string; // YYYY-MM-DD for frontend sorting
  flightPricePerPerson: number;
  landTourPricePerPerson: number;
  subtotal: number;
  markupPercent: number;
  afterMarkup: number;
  finalPrice: number; // After smart rounding
  currency: string;
  flightDetails?: FlightOffer;
  departureAirport?: string;
  departureAirportName?: string;
}

/**
 * Calculate combined package prices for all available dates
 */
export async function calculateCombinedPrices(
  config: FlightTourPricingConfig,
  landTourPricePerPerson: number
): Promise<CombinedPriceResult[]> {
  // Fetch flights from API
  const offers = await searchFlights({
    departAirports: config.departAirports,
    arriveAirport: config.arriveAirportCode,
    nights: config.durationNights,
    startDate: config.searchStartDate,
    endDate: config.searchEndDate,
  });
  
  if (offers.length === 0) {
    console.log("[FlightAPI] No flight offers found");
    return [];
  }
  
  // Get cheapest flight per date
  const cheapestByDate = getCheapestFlightsByDate(offers);
  
  const results: CombinedPriceResult[] = [];
  
  for (const [date, flight] of Array.from(cheapestByDate.entries())) {
    const flightPrice = parseFloat(flight.fltnetpricepp);
    const subtotal = flightPrice + landTourPricePerPerson;
    const afterMarkup = subtotal * (1 + config.markupPercent / 100);
    const finalPrice = smartRoundPrice(afterMarkup);
    
    // Convert DD/MM/YYYY to YYYY-MM-DD for sorting
    const [day, month, year] = date.split("/");
    const isoDate = `${year}-${month}-${day}`;
    
    results.push({
      date,
      isoDate,
      flightPricePerPerson: flightPrice,
      landTourPricePerPerson,
      subtotal,
      markupPercent: config.markupPercent,
      afterMarkup,
      finalPrice,
      currency: "GBP",
      flightDetails: flight,
      departureAirport: flight.depapt,
      departureAirportName: flight.depname,
    });
  }
  
  // Sort by date ascending
  results.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  
  return results;
}

/**
 * Get prices for a specific date with all available flight options
 */
export async function getFlightsForDateWithPrices(
  config: FlightTourPricingConfig,
  landTourPricePerPerson: number,
  targetDate: string // DD/MM/YYYY format
): Promise<CombinedPriceResult[]> {
  // Fetch flights from API
  const offers = await searchFlights({
    departAirports: config.departAirports,
    arriveAirport: config.arriveAirportCode,
    nights: config.durationNights,
    startDate: config.searchStartDate,
    endDate: config.searchEndDate,
  });
  
  // Filter to specific date
  const dateFlights = getFlightsForDate(offers, targetDate);
  
  const results: CombinedPriceResult[] = [];
  
  for (const flight of dateFlights) {
    const flightPrice = parseFloat(flight.fltnetpricepp);
    const subtotal = flightPrice + landTourPricePerPerson;
    const afterMarkup = subtotal * (1 + config.markupPercent / 100);
    const finalPrice = smartRoundPrice(afterMarkup);
    
    const [day, month, year] = targetDate.split("/");
    const isoDate = `${year}-${month}-${day}`;
    
    results.push({
      date: targetDate,
      isoDate,
      flightPricePerPerson: flightPrice,
      landTourPricePerPerson,
      subtotal,
      markupPercent: config.markupPercent,
      afterMarkup,
      finalPrice,
      currency: "GBP",
      flightDetails: flight,
      departureAirport: flight.depapt,
      departureAirportName: flight.depname,
    });
  }
  
  return results;
}

/**
 * Default UK airports for flight search
 */
export const UK_AIRPORTS = [
  { code: "LGW", name: "London Gatwick" },
  { code: "STN", name: "London Stansted" },
  { code: "LTN", name: "London Luton" },
  { code: "LHR", name: "London Heathrow" },
  { code: "MAN", name: "Manchester" },
  { code: "BHX", name: "Birmingham" },
  { code: "BRS", name: "Bristol" },
  { code: "EDI", name: "Edinburgh" },
  { code: "GLA", name: "Glasgow" },
  { code: "NCL", name: "Newcastle" },
  { code: "LBA", name: "Leeds Bradford" },
  { code: "EMA", name: "East Midlands" },
  { code: "LPL", name: "Liverpool" },
  { code: "SOU", name: "Southampton" },
  { code: "CWL", name: "Cardiff" },
];

/**
 * Get default departure airports as pipe-separated string
 */
export function getDefaultDepartAirports(): string {
  return UK_AIRPORTS.slice(0, 9).map(a => a.code).join("|");
}
