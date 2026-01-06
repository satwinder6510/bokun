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
// Flat baggage surcharge for all flight types (shown as separate line item)
export const BAGGAGE_SURCHARGE_GBP = 150;

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
  arrivalDate: string;        // YYYY-MM-DD (actual arrival date)
  arrivalTime: string;        // HH:mm (actual arrival time)
  returnDate: string;         // YYYY-MM-DD
  returnTime: string;         // HH:mm
  pricePerPerson: number;     // GBP
  airline: string;
  duration: number;           // minutes
  stops: number;
  bookingToken?: string;
}

// Open-jaw flight search parameters
export interface OpenJawSearchParams {
  ukAirports: string[];           // UK departure airports e.g., ["LHR", "MAN", "BHX"]
  arriveAirport: string;          // Arrival city airport e.g., "DEL"
  departAirport: string;          // Return departure city airport e.g., "BOM" (different from arrival)
  nights: number;                 // Duration in nights
  startDate: string;              // YYYY-MM-DD format
  endDate: string;                // YYYY-MM-DD format
}

// Internal flight search parameters (one-way domestic flights)
export interface InternalFlightSearchParams {
  fromAirport: string;            // Departure airport e.g., "DEL"
  toAirport: string;              // Arrival airport e.g., "JAI"
  dates: string[];                // Array of dates to search (YYYY-MM-DD format)
}

// Internal flight result
export interface InternalFlightOffer {
  fromAirport: string;
  fromAirportName: string;
  toAirport: string;
  toAirportName: string;
  date: string;                   // YYYY-MM-DD
  departureTime: string;          // HH:mm
  arrivalTime: string;            // HH:mm
  pricePerPerson: number;         // GBP (or local currency converted)
  airline: string;
  duration: number;               // minutes
  stops: number;
}

// Open-jaw flight result with both legs
export interface OpenJawFlightOffer {
  ukDepartureAirport: string;
  ukDepartureAirportName: string;
  outboundArrivalAirport: string;
  outboundArrivalAirportName: string;
  returnDepartureAirport: string;
  returnDepartureAirportName: string;
  ukReturnAirport: string;
  ukReturnAirportName: string;
  outboundDate: string;           // YYYY-MM-DD (departure from UK)
  outboundDepartureTime: string;  // HH:mm
  outboundArrivalDate: string;    // YYYY-MM-DD (arrival at destination)
  outboundArrivalTime: string;    // HH:mm
  effectiveArrivalDate: string;   // YYYY-MM-DD (treating before 6am as previous day)
  returnDate: string;             // YYYY-MM-DD (return departure)
  returnArrivalDate: string;      // YYYY-MM-DD (arrival back in UK)
  pricePerPerson: number;         // GBP total for both legs
  outboundAirline: string;
  returnAirline: string;
  sameAirline: boolean;           // True if both legs on same airline
  totalDuration: number;          // minutes
  outboundStops: number;
  returnStops: number;
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
    url.searchParams.set("stops", "1"); // Max 1 connection (direct or 1 stop only)
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
      
      // Parse arrival time to get date and time
      const arrivalTimeStr = lastLeg.arrival_airport.time || "";
      const arrivalDate = arrivalTimeStr.split(" ")[0] || outboundDate; // "YYYY-MM-DD HH:mm" format
      const arrivalTime = arrivalTimeStr.split(" ")[1] || "";
      
      offers.push({
        departureAirport: firstLeg.departure_airport.id,
        departureAirportName: firstLeg.departure_airport.name,
        arrivalAirport: lastLeg.arrival_airport.id,
        arrivalAirportName: lastLeg.arrival_airport.name,
        departureDate: outboundDate,
        departureTime: firstLeg.departure_airport.time,
        arrivalDate: arrivalDate,
        arrivalTime: arrivalTime,
        returnDate: returnDate,
        returnTime: "",
        pricePerPerson: flight.price, // Raw flight cost (baggage shown separately)
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

/**
 * Calculate effective arrival date using the 6am rule
 * If flight arrives before 6am, treat it as arriving the previous day
 */
function calculateEffectiveArrivalDate(arrivalDate: string, arrivalTime: string): string {
  if (!arrivalTime) return arrivalDate;
  
  // Parse time (HH:mm format)
  const [hours] = arrivalTime.split(":").map(Number);
  
  // If arrival is before 6am, treat as previous day
  if (hours < 6) {
    return addDays(arrivalDate, -1);
  }
  
  return arrivalDate;
}

/**
 * Fetch open-jaw (multi-city) flights for a single departure date
 * Searches for outbound and return on same airline
 */
async function fetchOpenJawFlightsForDate(
  apiKey: string,
  ukAirports: string[],
  arriveAirport: string,
  departAirport: string,
  outboundDate: string,
  nights: number
): Promise<OpenJawFlightOffer[]> {
  const offers: OpenJawFlightOffer[] = [];
  
  // We'll need to search with multi_city_json (type=3)
  // For open-jaw: UK -> arriveAirport, then departAirport -> UK
  // First, we need to estimate the return date based on nights
  // Since we don't know exact arrival time yet, use outbound date + nights as starting point
  const estimatedReturnDate = addDays(outboundDate, nights);
  
  try {
    for (const ukAirport of ukAirports) {
      // Build multi-city JSON for open-jaw search
      const multiCityLegs = [
        {
          departure_id: ukAirport,
          arrival_id: arriveAirport,
          date: outboundDate,
        },
        {
          departure_id: departAirport,
          arrival_id: ukAirport, // Return to same UK airport
          date: estimatedReturnDate,
        },
      ];
      
      const url = new URL(SERPAPI_BASE);
      url.searchParams.set("engine", "google_flights");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("type", "3"); // Multi-city
      url.searchParams.set("multi_city_json", JSON.stringify(multiCityLegs));
      url.searchParams.set("currency", "GBP");
      url.searchParams.set("gl", "uk");
      url.searchParams.set("hl", "en");
      url.searchParams.set("adults", "1");
      url.searchParams.set("bags", "1");
      url.searchParams.set("stops", "1"); // Max 1 connection (direct or 1 stop only)
      url.searchParams.set("travel_class", "1"); // Economy
      url.searchParams.set("sort_by", "2"); // Sort by price
      
      console.log(`[SerpAPI OpenJaw] ${ukAirport} -> ${arriveAirport}, ${departAirport} -> ${ukAirport} on ${outboundDate}`);
      
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });
      
      if (!response.ok) {
        console.error(`[SerpAPI OpenJaw] Error: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data = await response.json() as SerpApiResponse;
      
      if (data.error) {
        console.error(`[SerpAPI OpenJaw] API Error: ${data.error}`);
        continue;
      }
      
      // Process multi-city flights
      // For multi-city, flights array contains all legs of the journey
      const flights = [...(data.best_flights || []), ...(data.other_flights || [])];
      
      for (const flight of flights) {
        if (!flight.flights || flight.flights.length < 2) continue;
        
        // Multi-city returns all legs in the flights array
        // Find the outbound leg (UK -> arrival city) and return leg (depart city -> UK)
        // The structure varies - sometimes it's split into segments
        
        // For multi-city with 2 legs, we typically get them as separate journey segments
        // Let's process the first segment as outbound and look for return segment
        
        const allLegs = flight.flights;
        
        // Find outbound: starts from UK airport
        const outboundLegs = allLegs.filter(leg => 
          leg.departure_airport.id === ukAirport || 
          ukAirports.includes(leg.departure_airport.id)
        );
        
        // Find return: ends at UK airport  
        const returnLegs = allLegs.filter(leg =>
          leg.arrival_airport.id === ukAirport ||
          ukAirports.includes(leg.arrival_airport.id)
        );
        
        if (outboundLegs.length === 0 || returnLegs.length === 0) {
          // Try alternate approach: first leg is outbound start, last leg is return end
          if (allLegs.length >= 2) {
            const firstLeg = allLegs[0];
            const lastLeg = allLegs[allLegs.length - 1];
            
            // Parse arrival info for outbound
            // Find the leg that arrives at arriveAirport
            const outboundFinalLeg = allLegs.find(leg => leg.arrival_airport.id === arriveAirport);
            const returnFirstLeg = allLegs.find(leg => leg.departure_airport.id === departAirport);
            
            if (outboundFinalLeg) {
              const outboundArrivalTimeStr = outboundFinalLeg.arrival_airport.time || "";
              // Parse "2025-01-15 14:30" format
              const outboundArrivalDate = outboundArrivalTimeStr.split(" ")[0] || outboundDate;
              const outboundArrivalTime = outboundArrivalTimeStr.split(" ")[1] || "";
              
              const effectiveArrivalDate = calculateEffectiveArrivalDate(outboundArrivalDate, outboundArrivalTime);
              
              // Calculate proper return date based on effective arrival + nights
              const properReturnDate = addDays(effectiveArrivalDate, nights);
              
              // Determine airlines
              const outboundAirline = firstLeg.airline || "";
              const returnAirline = lastLeg.airline || "";
              
              offers.push({
                ukDepartureAirport: firstLeg.departure_airport.id,
                ukDepartureAirportName: firstLeg.departure_airport.name,
                outboundArrivalAirport: arriveAirport,
                outboundArrivalAirportName: outboundFinalLeg.arrival_airport.name,
                returnDepartureAirport: departAirport,
                returnDepartureAirportName: returnFirstLeg?.departure_airport.name || departAirport,
                ukReturnAirport: lastLeg.arrival_airport.id,
                ukReturnAirportName: lastLeg.arrival_airport.name,
                outboundDate: outboundDate,
                outboundDepartureTime: firstLeg.departure_airport.time?.split(" ")[1] || "",
                outboundArrivalDate: outboundArrivalDate,
                outboundArrivalTime: outboundArrivalTime,
                effectiveArrivalDate: effectiveArrivalDate,
                returnDate: properReturnDate,
                returnArrivalDate: lastLeg.arrival_airport.time?.split(" ")[0] || properReturnDate,
                pricePerPerson: flight.price, // Raw flight cost (baggage shown separately)
                outboundAirline: outboundAirline,
                returnAirline: returnAirline,
                sameAirline: outboundAirline.toLowerCase() === returnAirline.toLowerCase(),
                totalDuration: flight.total_duration,
                outboundStops: outboundLegs.length > 0 ? outboundLegs.length - 1 : 0,
                returnStops: returnLegs.length > 0 ? returnLegs.length - 1 : 0,
              });
            }
          }
          continue;
        }
        
        // Standard processing when we can identify outbound and return legs
        const outboundFirst = outboundLegs[0];
        const outboundLast = outboundLegs.find(leg => leg.arrival_airport.id === arriveAirport) || outboundLegs[outboundLegs.length - 1];
        const returnFirst = returnLegs.find(leg => leg.departure_airport.id === departAirport) || returnLegs[0];
        const returnLast = returnLegs[returnLegs.length - 1];
        
        // Parse outbound arrival
        const outboundArrivalTimeStr = outboundLast.arrival_airport.time || "";
        const outboundArrivalDate = outboundArrivalTimeStr.split(" ")[0] || outboundDate;
        const outboundArrivalTime = outboundArrivalTimeStr.split(" ")[1] || "";
        
        const effectiveArrivalDate = calculateEffectiveArrivalDate(outboundArrivalDate, outboundArrivalTime);
        const properReturnDate = addDays(effectiveArrivalDate, nights);
        
        const outboundAirline = outboundFirst.airline || "";
        const returnAirline = returnFirst.airline || "";
        
        offers.push({
          ukDepartureAirport: outboundFirst.departure_airport.id,
          ukDepartureAirportName: outboundFirst.departure_airport.name,
          outboundArrivalAirport: outboundLast.arrival_airport.id,
          outboundArrivalAirportName: outboundLast.arrival_airport.name,
          returnDepartureAirport: returnFirst.departure_airport.id,
          returnDepartureAirportName: returnFirst.departure_airport.name,
          ukReturnAirport: returnLast.arrival_airport.id,
          ukReturnAirportName: returnLast.arrival_airport.name,
          outboundDate: outboundDate,
          outboundDepartureTime: outboundFirst.departure_airport.time?.split(" ")[1] || "",
          outboundArrivalDate: outboundArrivalDate,
          outboundArrivalTime: outboundArrivalTime,
          effectiveArrivalDate: effectiveArrivalDate,
          returnDate: properReturnDate,
          returnArrivalDate: returnLast.arrival_airport.time?.split(" ")[0] || properReturnDate,
          pricePerPerson: flight.price, // Raw flight cost (baggage shown separately)
          outboundAirline: outboundAirline,
          returnAirline: returnAirline,
          sameAirline: outboundAirline.toLowerCase() === returnAirline.toLowerCase(),
          totalDuration: flight.total_duration,
          outboundStops: outboundLegs.length - 1,
          returnStops: returnLegs.length - 1,
        });
      }
      
      // Small delay between airport searches
      await sleep(200);
    }
    
  } catch (error) {
    console.error(`[SerpAPI OpenJaw] Error fetching flights for ${outboundDate}:`, error);
  }
  
  return offers;
}

/**
 * Search for open-jaw flights using SERP API
 * Returns flights where outbound and return use same airline (preferred)
 */
export async function searchOpenJawFlights(params: OpenJawSearchParams): Promise<OpenJawFlightOffer[]> {
  const apiKey = process.env.SERPAPI_KEY;
  
  if (!apiKey) {
    throw new Error("SERPAPI_KEY not configured. Please add your SerpApi key to secrets.");
  }
  
  // Generate date range
  const datesToSearch = generateDateRange(params.startDate, params.endDate);
  console.log(`[SerpAPI OpenJaw] Searching ${datesToSearch.length} dates for open-jaw flights`);
  console.log(`[SerpAPI OpenJaw] Route: UK airports -> ${params.arriveAirport}, ${params.departAirport} -> UK airports`);
  
  if (datesToSearch.length === 0) {
    console.log(`[SerpAPI OpenJaw] No dates to search`);
    return [];
  }
  
  // Limit to reasonable number of dates (API calls are expensive)
  const limitedDates = datesToSearch.slice(0, 30);
  
  // Parallel fetch with concurrency limit
  const CONCURRENCY = 5; // Lower concurrency for multi-city (more complex queries)
  const allOffers: OpenJawFlightOffer[] = [];
  
  for (let i = 0; i < limitedDates.length; i += CONCURRENCY) {
    const batch = limitedDates.slice(i, i + CONCURRENCY);
    console.log(`[SerpAPI OpenJaw] Fetching batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(limitedDates.length / CONCURRENCY)}`);
    
    const batchResults = await Promise.all(
      batch.map(date => fetchOpenJawFlightsForDate(
        apiKey,
        params.ukAirports,
        params.arriveAirport,
        params.departAirport,
        date,
        params.nights
      ))
    );
    
    for (const offers of batchResults) {
      allOffers.push(...offers);
    }
    
    // Delay between batches
    if (i + CONCURRENCY < limitedDates.length) {
      await sleep(1000);
    }
  }
  
  console.log(`[SerpAPI OpenJaw] Found ${allOffers.length} total open-jaw flight offers`);
  
  // Filter to prefer same-airline flights
  const sameAirlineOffers = allOffers.filter(o => o.sameAirline);
  console.log(`[SerpAPI OpenJaw] ${sameAirlineOffers.length} offers with same airline for both legs`);
  
  return allOffers;
}

/**
 * Get cheapest open-jaw flights per departure date and UK airport, preferring same-airline
 */
export function getCheapestOpenJawByDateAndAirport(
  offers: OpenJawFlightOffer[],
  preferSameAirline: boolean = true
): Map<string, OpenJawFlightOffer> {
  const cheapestByDateAirport = new Map<string, OpenJawFlightOffer>();
  
  // Sort offers: same-airline first if preferred, then by price
  const sortedOffers = [...offers].sort((a, b) => {
    if (preferSameAirline) {
      if (a.sameAirline && !b.sameAirline) return -1;
      if (!a.sameAirline && b.sameAirline) return 1;
    }
    return a.pricePerPerson - b.pricePerPerson;
  });
  
  for (const offer of sortedOffers) {
    const key = `${offer.outboundDate}|${offer.ukDepartureAirport}`;
    
    const existing = cheapestByDateAirport.get(key);
    
    if (!existing) {
      cheapestByDateAirport.set(key, offer);
    } else if (preferSameAirline) {
      // Replace if current is same-airline and existing is not, or if cheaper with same airline status
      if (offer.sameAirline && !existing.sameAirline) {
        cheapestByDateAirport.set(key, offer);
      } else if (offer.sameAirline === existing.sameAirline && offer.pricePerPerson < existing.pricePerPerson) {
        cheapestByDateAirport.set(key, offer);
      }
    } else if (offer.pricePerPerson < existing.pricePerPerson) {
      cheapestByDateAirport.set(key, offer);
    }
  }
  
  return cheapestByDateAirport;
}

/**
 * Fetch internal/domestic one-way flights for a single date
 */
async function fetchInternalFlightForDate(
  apiKey: string,
  fromAirport: string,
  toAirport: string,
  date: string
): Promise<InternalFlightOffer[]> {
  const offers: InternalFlightOffer[] = [];
  
  try {
    const url = new URL(SERPAPI_BASE);
    url.searchParams.set("engine", "google_flights");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("departure_id", fromAirport);
    url.searchParams.set("arrival_id", toAirport);
    url.searchParams.set("outbound_date", date);
    url.searchParams.set("type", "2"); // One-way
    url.searchParams.set("currency", "GBP");
    url.searchParams.set("gl", "uk");
    url.searchParams.set("hl", "en");
    url.searchParams.set("adults", "1");
    url.searchParams.set("stops", "1"); // Max 1 connection (direct or 1 stop only)
    url.searchParams.set("travel_class", "1"); // Economy
    url.searchParams.set("sort_by", "2"); // Sort by price
    
    console.log(`[SerpAPI Internal] ${fromAirport} -> ${toAirport} on ${date}`);
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      console.error(`[SerpAPI Internal] Error: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const data = await response.json() as SerpApiResponse;
    
    if (data.error) {
      console.error(`[SerpAPI Internal] API Error: ${data.error}`);
      return [];
    }
    
    // Process flights
    const flights = [...(data.best_flights || []), ...(data.other_flights || [])];
    
    for (const flight of flights) {
      if (!flight.flights || flight.flights.length === 0) continue;
      
      const firstLeg = flight.flights[0];
      const lastLeg = flight.flights[flight.flights.length - 1];
      
      // Parse times
      const depTimeStr = firstLeg.departure_airport.time || "";
      const arrTimeStr = lastLeg.arrival_airport.time || "";
      
      offers.push({
        fromAirport: firstLeg.departure_airport.id,
        fromAirportName: firstLeg.departure_airport.name,
        toAirport: lastLeg.arrival_airport.id,
        toAirportName: lastLeg.arrival_airport.name,
        date: date,
        departureTime: depTimeStr.split(" ")[1] || depTimeStr,
        arrivalTime: arrTimeStr.split(" ")[1] || arrTimeStr,
        pricePerPerson: flight.price, // Raw flight cost (baggage shown separately)
        airline: firstLeg.airline || "",
        duration: flight.total_duration,
        stops: flight.flights.length - 1,
      });
    }
    
  } catch (error) {
    console.error(`[SerpAPI Internal] Error fetching flights for ${date}:`, error);
  }
  
  return offers;
}

/**
 * Search for internal/domestic one-way flights using SERP API
 * Used for internal transfers within a destination country
 */
export async function searchInternalFlights(params: InternalFlightSearchParams): Promise<InternalFlightOffer[]> {
  const apiKey = process.env.SERPAPI_KEY;
  
  if (!apiKey) {
    throw new Error("SERPAPI_KEY not configured. Please add your SerpApi key to secrets.");
  }
  
  console.log(`[SerpAPI Internal] Searching ${params.dates.length} dates for ${params.fromAirport} -> ${params.toAirport}`);
  
  if (params.dates.length === 0) {
    console.log(`[SerpAPI Internal] No dates to search`);
    return [];
  }
  
  // Parallel fetch with concurrency limit
  const CONCURRENCY = 10;
  const allOffers: InternalFlightOffer[] = [];
  
  for (let i = 0; i < params.dates.length; i += CONCURRENCY) {
    const batch = params.dates.slice(i, i + CONCURRENCY);
    console.log(`[SerpAPI Internal] Fetching batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(params.dates.length / CONCURRENCY)}`);
    
    const batchResults = await Promise.all(
      batch.map(date => fetchInternalFlightForDate(
        apiKey,
        params.fromAirport,
        params.toAirport,
        date
      ))
    );
    
    for (const offers of batchResults) {
      allOffers.push(...offers);
    }
    
    // Delay between batches
    if (i + CONCURRENCY < params.dates.length) {
      await sleep(500);
    }
  }
  
  console.log(`[SerpAPI Internal] Found ${allOffers.length} total internal flight offers`);
  
  return allOffers;
}

/**
 * Get cheapest internal flight per date
 */
export function getCheapestInternalByDate(
  offers: InternalFlightOffer[]
): Map<string, InternalFlightOffer> {
  const cheapestByDate = new Map<string, InternalFlightOffer>();
  
  for (const offer of offers) {
    const existing = cheapestByDate.get(offer.date);
    
    if (!existing || offer.pricePerPerson < existing.pricePerPerson) {
      cheapestByDate.set(offer.date, offer);
    }
  }
  
  return cheapestByDate;
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
