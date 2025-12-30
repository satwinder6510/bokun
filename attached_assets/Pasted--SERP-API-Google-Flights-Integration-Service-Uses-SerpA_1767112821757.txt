/**
 * SERP API Google Flights Integration Service
 * 
 * Uses SerpApi's Google Flights API for non-European destinations.
 * Provides similar interface to the existing flight API for seamless integration.
 */

import fetch from "node-fetch";
import type { FlightOffer } from "@shared/schema";
import { smartRoundPrice, type CombinedPriceResult } from "./flightApi";

const SERPAPI_BASE = "https://serpapi.com/search";

// Hold baggage surcharge - SERP API only supports carry-on bag filtering,
// so we add a fixed amount to cover typical hold/checked baggage costs
const HOLD_BAGGAGE_SURCHARGE_GBP = 100;

interface SerpFlightSearchParams {
  departAirports: string[];   // Array of airport codes e.g., ["LGW", "STN"]
  arriveAirport: string;      // Single airport code e.g., "DEL"
  nights: number;             // Duration in nights
  startDate: string;          // YYYY-MM-DD format
  endDate: string;            // YYYY-MM-DD format
  specificDates?: string[];   // Optional: specific dates to search (YYYY-MM-DD format)
}

interface SerpFlightLeg {
  departure_airport: {
    name: string;
    id: string;
    time: string;
  };
  arrival_airport: {
    name: string;
    id: string;
    time: string;
  };
  duration: number;
  airplane: string;
  airline: string;
  airline_logo: string;
  travel_class: string;
  flight_number: string;
  legroom: string;
  extensions: string[];
  overnight?: boolean;
  often_delayed_by_over_30_min?: boolean;
}

interface SerpFlight {
  flights: SerpFlightLeg[];
  total_duration: number;
  carbon_emissions?: {
    this_flight: number;
    typical_for_this_route: number;
    difference_percent: number;
  };
  price: number;
  type: string;
  airline_logo: string;
  departure_token?: string;
  booking_token?: string;
  extensions?: string[];
  layovers?: {
    duration: number;
    name: string;
    id: string;
    overnight?: boolean;
  }[];
}

interface SerpApiResponse {
  search_metadata?: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_flights_url: string;
    raw_html_file: string;
    prettify_html_file: string;
    total_time_taken: number;
  };
  search_parameters?: Record<string, string>;
  best_flights?: SerpFlight[];
  other_flights?: SerpFlight[];
  price_insights?: {
    lowest_price: number;
    price_level: string;
    typical_price_range: [number, number];
    price_history: number[][];
  };
  airports?: {
    departure: { airport: { id: string; name: string }; city: string; country: string; country_code: string; image: string; thumbnail: string }[];
    arrival: { airport: { id: string; name: string }; city: string; country: string; country_code: string; image: string; thumbnail: string }[];
  }[];
  error?: string;
}

// Normalized flight offer that matches our internal structure
export interface SerpFlightOffer {
  departureAirport: string;
  departureAirportName: string;
  arrivalAirport: string;
  arrivalAirportName: string;
  departureDate: string;      // YYYY-MM-DD
  departureTime: string;      // HH:mm
  returnDate: string;         // YYYY-MM-DD
  returnTime: string;         // HH:mm
  pricePerPerson: number;     // GBP
  airline: string;
  duration: number;           // minutes
  stops: number;
  bookingToken?: string;
}

/**
 * Fetch flights for a single date
 */
async function fetchFlightsForDate(
  apiKey: string,
  departureIds: string,
  arriveAirport: string,
  outboundDate: string,
  nights: number
): Promise<SerpFlightOffer[]> {
  const returnDate = addDays(outboundDate, nights);
  const offers: SerpFlightOffer[] = [];
  
  try {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set("engine", "google_flights");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("departure_id", departureIds);
    url.searchParams.set("arrival_id", arriveAirport);
    url.searchParams.set("outbound_date", outboundDate);
    url.searchParams.set("return_date", returnDate);
    url.searchParams.set("type", "1"); // Round trip
    url.searchParams.set("currency", "GBP");
    url.searchParams.set("gl", "uk");
    url.searchParams.set("hl", "en");
    url.searchParams.set("adults", "1");
    url.searchParams.set("bags", "1"); // Include 1 carry-on bag in price
    url.searchParams.set("stops", "2"); // 1 stop or fewer
    url.searchParams.set("travel_class", "1"); // Economy
    url.searchParams.set("sort_by", "2"); // Sort by price
    
    console.log(`[SerpAPI] Fetching flights for ${outboundDate} -> ${returnDate}`);
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      console.error(`[SerpAPI] Error: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const data = await response.json() as SerpApiResponse;
    
    if (data.error) {
      console.error(`[SerpAPI] API Error: ${data.error}`);
      return [];
    }
    
    // Process best_flights and other_flights
    const flights = [...(data.best_flights || []), ...(data.other_flights || [])];
    
    for (const flight of flights) {
      if (!flight.flights || flight.flights.length === 0) continue;
      
      const firstLeg = flight.flights[0];
      const lastLeg = flight.flights[flight.flights.length - 1];
      
      offers.push({
        departureAirport: firstLeg.departure_airport.id,
        departureAirportName: firstLeg.departure_airport.name,
        arrivalAirport: lastLeg.arrival_airport.id,
        arrivalAirportName: lastLeg.arrival_airport.name,
        departureDate: outboundDate,
        departureTime: firstLeg.departure_airport.time,
        returnDate: returnDate,
        returnTime: "",
        pricePerPerson: flight.price + HOLD_BAGGAGE_SURCHARGE_GBP,
        airline: firstLeg.airline,
        duration: flight.total_duration,
        stops: flight.flights.length - 1,
        bookingToken: flight.booking_token,
      });
    }
    
  } catch (error) {
    console.error(`[SerpAPI] Error fetching flights for ${outboundDate}:`, error);
  }
  
  return offers;
}

/**
 * Search for flights using SERP API Google Flights
 * Uses parallel fetching with concurrency limit for better performance
 */
export async function searchSerpFlights(params: SerpFlightSearchParams): Promise<SerpFlightOffer[]> {
  const apiKey = process.env.SERPAPI_KEY;
  
  if (!apiKey) {
    throw new Error("SERPAPI_KEY not configured. Please add your SerpApi key to secrets.");
  }
  
  // Use specific dates if provided (from Bokun availability), otherwise generate range
  let datesToSearch: string[];
  
  if (params.specificDates && params.specificDates.length > 0) {
    // Use only the Bokun-available dates
    datesToSearch = params.specificDates.slice(0, 50); // Max 50 dates
    console.log(`[SerpAPI] Searching ${datesToSearch.length} specific tour dates (from Bokun availability)`);
  } else {
    // Fallback to date range (shouldn't normally happen)
    const dates = generateDateRange(params.startDate, params.endDate);
    datesToSearch = dates.slice(0, 30);
    console.log(`[SerpAPI] Searching ${datesToSearch.length} dates from ${params.startDate} to ${params.endDate}`);
  }
  
  if (datesToSearch.length === 0) {
    console.log(`[SerpAPI] No dates to search`);
    return [];
  }
  
  // Search each departure airport (SERP API supports multiple in comma-separated format)
  const departureIds = params.departAirports.join(",");
  
  // Parallel fetch with concurrency limit of 10 for faster results
  const CONCURRENCY = 10;
  const allOffers: SerpFlightOffer[] = [];
  
  for (let i = 0; i < datesToSearch.length; i += CONCURRENCY) {
    const batch = datesToSearch.slice(i, i + CONCURRENCY);
    console.log(`[SerpAPI] Fetching batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(datesToSearch.length / CONCURRENCY)} (${batch.length} dates)`);
    
    const batchResults = await Promise.all(
      batch.map(date => fetchFlightsForDate(apiKey, departureIds, params.arriveAirport, date, params.nights))
    );
    
    for (const offers of batchResults) {
      allOffers.push(...offers);
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + CONCURRENCY < datesToSearch.length) {
      await sleep(500);
    }
  }
  
  console.log(`[SerpAPI] Found ${allOffers.length} total flight offers`);
  return allOffers;
}

/**
 * Get the cheapest SERP flight per departure date and airport
 */
export function getCheapestSerpFlightsByDateAndAirport(
  offers: SerpFlightOffer[]
): Map<string, SerpFlightOffer> {
  // Key: "YYYY-MM-DD|AIRPORT" e.g., "2025-03-15|LGW"
  const cheapestByDateAirport = new Map<string, SerpFlightOffer>();
  
  for (const offer of offers) {
    const key = `${offer.departureDate}|${offer.departureAirport}`;
    
    const existing = cheapestByDateAirport.get(key);
    
    if (!existing || offer.pricePerPerson < existing.pricePerPerson) {
      cheapestByDateAirport.set(key, offer);
    }
  }
  
  return cheapestByDateAirport;
}

/**
 * Calculate combined package prices using SERP API flights
 */
export async function calculateSerpCombinedPrices(
  config: {
    departAirports: string;      // Pipe-separated e.g., "LGW|STN"
    arriveAirportCode: string;
    durationNights: number;
    searchStartDate: string;     // DD/MM/YYYY format
    searchEndDate: string;       // DD/MM/YYYY format
    markupPercent: number;
  },
  landTourPricePerPerson: number
): Promise<CombinedPriceResult[]> {
  // Convert pipe-separated to array
  const departAirports = config.departAirports.split("|").filter(a => a.trim());
  
  // Convert DD/MM/YYYY to YYYY-MM-DD for SERP API
  const startDate = convertUKDateToISO(config.searchStartDate);
  const endDate = convertUKDateToISO(config.searchEndDate);
  
  // Fetch flights from SERP API
  const offers = await searchSerpFlights({
    departAirports,
    arriveAirport: config.arriveAirportCode,
    nights: config.durationNights,
    startDate,
    endDate,
  });
  
  if (offers.length === 0) {
    console.log("[SerpAPI] No flight offers found");
    return [];
  }
  
  // Get cheapest flight per date and airport
  const cheapestByDateAirport = getCheapestSerpFlightsByDateAndAirport(offers);
  
  const results: CombinedPriceResult[] = [];
  
  for (const [key, flight] of Array.from(cheapestByDateAirport.entries())) {
    const flightPrice = flight.pricePerPerson;
    const subtotal = flightPrice + landTourPricePerPerson;
    const afterMarkup = subtotal * (1 + config.markupPercent / 100);
    const finalPrice = smartRoundPrice(afterMarkup);
    
    // Convert YYYY-MM-DD to DD/MM/YYYY for display
    const ukDate = convertISOToUKDate(flight.departureDate);
    
    results.push({
      date: ukDate,
      isoDate: flight.departureDate,
      flightPricePerPerson: Math.round(flightPrice * 100) / 100,
      landTourPricePerPerson: Math.round(landTourPricePerPerson * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      markupPercent: config.markupPercent,
      afterMarkup: Math.round(afterMarkup * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
      currency: "GBP",
      departureAirport: flight.departureAirport,
      departureAirportName: flight.departureAirportName,
    });
  }
  
  // Sort by date ascending
  results.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  
  return results;
}

// Helper functions

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function convertUKDateToISO(ukDate: string): string {
  // DD/MM/YYYY -> YYYY-MM-DD
  const [day, month, year] = ukDate.split("/");
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function convertISOToUKDate(isoDate: string): string {
  // YYYY-MM-DD -> DD/MM/YYYY
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if SERP API key is configured
 */
export function isSerpApiConfigured(): boolean {
  return !!process.env.SERPAPI_KEY;
}
