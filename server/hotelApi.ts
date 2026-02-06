/**
 * Sunshine Hotel API Integration
 * Fetches hotel availability and pricing from Sunshine European API
 */

import fetch from "node-fetch";

const HOTEL_API_BASE = "http://87.102.127.86:8119/hotels/search.dll";
const HOTEL_API_AGENT_ID = "122";

export interface HotelSearchParams {
  destination: string;        // City name or code
  checkIn: string;           // DD/MM/YYYY
  checkOut: string;          // DD/MM/YYYY
  adults: number;            // Number of adults (1 for single, 2 for twin)
  starRating?: number;       // 3, 4, or 5
  boardBasis?: string;       // "RO", "BB", "HB", "FB"
  hotelCodes?: string[];     // Optional: specific hotels to search
}

export interface HotelOffer {
  hotelCode: string;
  hotelName: string;
  starRating: number;
  city: string;
  boardBasis: string;         // RO, BB, HB, FB
  roomType: string;           // "Twin Room", "Double Room", "Single Room"
  checkIn: string;            // DD/MM/YYYY
  checkOut: string;           // DD/MM/YYYY
  nights: number;
  totalPrice: number;         // GBP total for the stay (per room)
  currency: string;
  availability: number;       // Rooms available
  refNum: string;
}

/**
 * Search hotels for a city and date range
 */
export async function searchHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
  const url = new URL(HOTEL_API_BASE);

  url.searchParams.set("agtid", HOTEL_API_AGENT_ID);
  url.searchParams.set("destination", params.destination);
  url.searchParams.set("checkin", params.checkIn);
  url.searchParams.set("checkout", params.checkOut);
  url.searchParams.set("adults", params.adults.toString());
  url.searchParams.set("output", "JSON");

  if (params.starRating) {
    url.searchParams.set("stars", params.starRating.toString());
  }

  if (params.boardBasis) {
    url.searchParams.set("board", params.boardBasis);
  }

  if (params.hotelCodes && params.hotelCodes.length > 0) {
    url.searchParams.set("hotels", params.hotelCodes.join("|"));
  }

  console.log(`[HotelAPI] Searching: ${params.destination}, ${params.checkIn} - ${params.checkOut}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Hotel API returned ${response.status}: ${response.statusText}`);
    }

    const rawText = await response.text();

    // Handle XML errors
    if (rawText.startsWith("<?xml") || rawText.includes("<Error>")) {
      const errorMatch = rawText.match(/<Error>(.*?)<\/Error>/i);
      const errorMessage = errorMatch ? errorMatch[1] : "Hotel API error";
      console.error(`[HotelAPI] Error: ${errorMessage}`);

      if (errorMessage.includes("IP Address Does Not Match")) {
        throw new Error("Hotel API access denied: Server IP not whitelisted. Contact Sunshine Technology Ltd to add this server's IP address.");
      }
      throw new Error(`Hotel API error: ${errorMessage}`);
    }

    const data = JSON.parse(rawText);
    console.log(`[HotelAPI] Found ${data.Hotels?.length || 0} hotels`);

    return data.Hotels || [];

  } catch (error: any) {
    console.error(`[HotelAPI] Error:`, error.message);
    throw error;
  }
}

/**
 * Get cheapest hotel from search results
 */
export function getCheapestHotel(hotels: HotelOffer[]): HotelOffer | null {
  if (hotels.length === 0) return null;
  return hotels.reduce((cheapest, current) =>
    current.totalPrice < cheapest.totalPrice ? current : cheapest
  );
}

// Date helper functions
export function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function addDays(dateInput: Date | string, days: number): Date {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function parseDateDDMMYYYY(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}
