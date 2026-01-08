/**
 * Flight API Integration Service
 * 
 * Connects to external flight pricing API to fetch real-time flight prices.
 * Combines with Bokun land tour prices to create dynamic package pricing.
 */

import fetch from "node-fetch";
import type { FlightOffer, FlightTourPricingConfig } from "@shared/schema";

const FLIGHT_API_BASE = "http://87.102.127.86:8119/search/searchoffers.dll";
const FLIGHT_API_ONEWAY_BASE = "http://87.102.127.86:8119/owflights/owflights.dll";
const FLIGHT_API_AGENT_ID = "122";

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

// One-way flight search types
export interface OneWayFlightSearchParams {
  departAirports: string; // Pipe-separated e.g., "LGW|MAN|LTN"
  arriveAirports: string; // Pipe-separated e.g., "BJV|ADB|DLM"
  startDate: string;      // DD/MM/YYYY format
  endDate: string;        // DD/MM/YYYY format
}

export interface OneWayFlight {
  Fltsupplier: string;   // e.g., "Easyjet"
  Depapt: string;        // Departure airport code e.g., "LTN"
  Arrapt: string;        // Arrival airport code e.g., "ADB"
  Fltnum: string;        // Flight number e.g., "EZY2561"
  Depart: string;        // Departure datetime "DD/MM/YYYY HH:mm"
  Arrive: string;        // Arrival datetime "DD/MM/YYYY HH:mm"
  Fltprice: string;      // Price as string e.g., "95.99"
}

interface OneWayFlightApiResponse {
  Flights: OneWayFlight[];
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
  
  // Build query string with correct parameter names
  url.searchParams.set("agtid", FLIGHT_API_AGENT_ID);
  url.searchParams.set("page", "FLTDATE");
  url.searchParams.set("platform", "WEB");
  url.searchParams.set("depart", params.departAirports);
  url.searchParams.set("arrive", params.arriveAirport);
  url.searchParams.set("Startdate", params.startDate);
  url.searchParams.set("EndDate", params.endDate);
  url.searchParams.set("duration", params.nights.toString());
  url.searchParams.set("output", "JSON");
  
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
    
    // Get raw text first to handle error responses
    const rawText = await response.text();
    
    // Check for XML error response
    if (rawText.startsWith("<?xml") || rawText.includes("<Error>")) {
      const errorMatch = rawText.match(/<Error>(.*?)<\/Error>/i);
      const errorMessage = errorMatch ? errorMatch[1] : "Unknown error from flight API";
      console.error(`[FlightAPI] Error: ${errorMessage}`);
      
      if (errorMessage.includes("IP Address Does Not Match")) {
        throw new Error("Flight API access denied: Server IP not whitelisted. Contact Sunshine Technology Ltd to add this server's IP address.");
      }
      throw new Error(`Flight API error: ${errorMessage}`);
    }
    
    // Parse JSON response
    const data = JSON.parse(rawText) as FlightApiResponse;
    
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
 * Search for one-way flights from the external API
 * Supports open-jaw itineraries (UK→destination or destination→UK)
 * Covers: Aegean, Air Lingus, Air Malta, Correndon, Easyjet, Eurowings, 
 * Freebird, Jet2, Nouvelair, Fly Pegasus, Ryanair, Sun Express, Thomson, Vueling, Wizz Air
 */
export async function searchOneWayFlights(params: OneWayFlightSearchParams): Promise<OneWayFlight[]> {
  const url = new URL(FLIGHT_API_ONEWAY_BASE);
  
  // Build query string - note lowercase parameter names for one-way API
  url.searchParams.set("agtid", FLIGHT_API_AGENT_ID);
  url.searchParams.set("depart", params.departAirports);
  url.searchParams.set("Arrive", params.arriveAirports);
  url.searchParams.set("startdate", params.startDate);
  url.searchParams.set("enddate", params.endDate);
  
  console.log(`[FlightAPI] Searching one-way flights: ${url.toString()}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for larger searches
    
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
    
    // Get raw text first to handle error responses
    const rawText = await response.text();
    
    // Check for XML error response
    if (rawText.startsWith("<?xml") || rawText.includes("<Error>")) {
      const errorMatch = rawText.match(/<Error>(.*?)<\/Error>/i);
      const errorMessage = errorMatch ? errorMatch[1] : "Unknown error from flight API";
      console.error(`[FlightAPI] One-way error: ${errorMessage}`);
      
      if (errorMessage.includes("IP Address Does Not Match")) {
        throw new Error("Flight API access denied: Server IP not whitelisted. Contact Sunshine Technology Ltd to add this server's IP address.");
      }
      throw new Error(`Flight API error: ${errorMessage}`);
    }
    
    // Parse JSON response
    const data = JSON.parse(rawText) as OneWayFlightApiResponse;
    
    if (data.error) {
      console.error(`[FlightAPI] One-way error from API: ${data.error}`);
      return [];
    }
    
    console.log(`[FlightAPI] Found ${data.Flights?.length || 0} one-way flights`);
    return data.Flights || [];
  } catch (error) {
    console.error(`[FlightAPI] Error fetching one-way flights:`, error);
    throw error;
  }
}

/**
 * Get the cheapest one-way flight per date and departure airport
 * Returns a map: date -> airport -> cheapest flight
 */
export function getCheapestOneWayFlightsByDateAndAirport(
  flights: OneWayFlight[]
): Map<string, Map<string, OneWayFlight>> {
  const result = new Map<string, Map<string, OneWayFlight>>();
  
  for (const flight of flights) {
    // Extract date from Depart (format: DD/MM/YYYY HH:mm)
    const datePart = flight.Depart.split(" ")[0]; // DD/MM/YYYY
    const airport = flight.Depapt;
    const price = parseFloat(flight.Fltprice);
    
    if (!result.has(datePart)) {
      result.set(datePart, new Map());
    }
    
    const dateMap = result.get(datePart)!;
    const existing = dateMap.get(airport);
    
    if (!existing || price < parseFloat(existing.Fltprice)) {
      dateMap.set(airport, flight);
    }
  }
  
  return result;
}

/**
 * Get cheapest one-way flight price per date (across all airports)
 */
export function getCheapestOneWayFlightsByDate(flights: OneWayFlight[]): Map<string, OneWayFlight> {
  const cheapestByDate = new Map<string, OneWayFlight>();
  
  for (const flight of flights) {
    const datePart = flight.Depart.split(" ")[0];
    const currentPrice = parseFloat(flight.Fltprice);
    
    const existing = cheapestByDate.get(datePart);
    if (!existing || currentPrice < parseFloat(existing.Fltprice)) {
      cheapestByDate.set(datePart, flight);
    }
  }
  
  return cheapestByDate;
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
    
    // Round all monetary values to 2 decimal places for financial display
    results.push({
      date,
      isoDate,
      flightPricePerPerson: Math.round(flightPrice * 100) / 100,
      landTourPricePerPerson: Math.round(landTourPricePerPerson * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      markupPercent: config.markupPercent,
      afterMarkup: Math.round(afterMarkup * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
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
    
    // Round all monetary values to 2 decimal places for financial display
    results.push({
      date: targetDate,
      isoDate,
      flightPricePerPerson: Math.round(flightPrice * 100) / 100,
      landTourPricePerPerson: Math.round(landTourPricePerPerson * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      markupPercent: config.markupPercent,
      afterMarkup: Math.round(afterMarkup * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
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
