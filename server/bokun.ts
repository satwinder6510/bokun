import crypto from "crypto";

const BOKUN_API_BASE = process.env.BOKUN_API_BASE || "https://api.bokun.io";
const ACCESS_KEY = process.env.BOKUN_ACCESS_KEY || "";
const SECRET_KEY = process.env.BOKUN_SECRET_KEY || "";

function generateBokunSignature(
  date: string,
  accessKey: string,
  method: string,
  path: string,
  secretKey: string
): string {
  const stringToSign = `${date}${accessKey}${method}${path}`;
  const hmac = crypto.createHmac("sha1", secretKey);
  hmac.update(stringToSign);
  return hmac.digest("base64");
}

function getBokunHeaders(method: string, path: string) {
  const date = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "");

  const signature = generateBokunSignature(
    date,
    ACCESS_KEY,
    method.toUpperCase(),
    path,
    SECRET_KEY
  );

  return {
    "X-Bokun-Date": date,
    "X-Bokun-AccessKey": ACCESS_KEY,
    "X-Bokun-Signature": signature,
    "Content-Type": "application/json;charset=UTF-8",
  };
}

export async function testBokunConnection() {
  const startTime = Date.now();
  const path = "/activity.json/search";
  const method = "POST";

  try {
    const headers = getBokunHeaders(method, path);
    console.log("Testing Bokun connection with headers:", {
      ...headers,
      "X-Bokun-AccessKey": ACCESS_KEY.slice(0, 8) + "...",
      "X-Bokun-Signature": headers["X-Bokun-Signature"].slice(0, 10) + "...",
    });
    
    const response = await fetch(`${BOKUN_API_BASE}${path}`, {
      method,
      headers,
      body: JSON.stringify({ page: 1, pageSize: 1 }),
    });

    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Bokun API error:", response.status, errorText);
      return {
        connected: false,
        message: `API returned status ${response.status}: ${errorText}`,
        timestamp: new Date().toISOString(),
        responseTime,
      };
    }

    const data = await response.json();
    const productCount = data.totalCount || 0;
    console.log("Bokun connection successful, got", productCount, "total products");
    
    return {
      connected: true,
      message: productCount > 0 
        ? `Successfully connected to Bokun API (${productCount} products available)` 
        : "Successfully connected to Bokun API (no products found in your account)",
      timestamp: new Date().toISOString(),
      responseTime,
    };
  } catch (error: any) {
    console.error("Bokun connection error:", error);
    return {
      connected: false,
      message: error.message || "Failed to connect to Bokun API",
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
    };
  }
}

export async function searchBokunProducts(page: number = 1, pageSize: number = 20, currency: string = "USD") {
  // Note: Bokun API always returns prices in USD regardless of currency parameter
  // We keep currency=USD to be explicit about this
  const path = "/activity.json/search";
  const queryParams = `?currency=${currency}`;
  const fullPath = `${path}${queryParams}`;
  const method = "POST";

  try {
    const headers = getBokunHeaders(method, fullPath);
    const response = await fetch(`${BOKUN_API_BASE}${fullPath}`, {
      method,
      headers,
      body: JSON.stringify({ page, pageSize }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Bokun products response structure:", {
      totalHits: data.totalHits,
      itemsCount: data.items?.length || 0,
      hasItems: !!data.items,
      keys: Object.keys(data),
      currency,
      firstItemKeys: data.items?.[0] ? Object.keys(data.items[0]) : "no items",
      sampleItem: data.items?.[0]
    });
    return data;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch products from Bokun API");
  }
}

// Map common destination names to ISO country codes for location-based search
const COUNTRY_CODE_MAP: Record<string, string> = {
  "greece": "GR",
  "greek": "GR",
  "costa rica": "CR",
  "costarica": "CR",
  "spain": "ES",
  "italy": "IT",
  "france": "FR",
  "germany": "DE",
  "portugal": "PT",
  "turkey": "TR",
  "egypt": "EG",
  "morocco": "MA",
  "thailand": "TH",
  "vietnam": "VN",
  "japan": "JP",
  "india": "IN",
  "maldives": "MV",
  "mauritius": "MU",
  "dubai": "AE",
  "uae": "AE",
  "mexico": "MX",
  "peru": "PE",
  "brazil": "BR",
  "argentina": "AR",
  "south africa": "ZA",
  "kenya": "KE",
  "tanzania": "TZ",
  "bali": "ID",
  "indonesia": "ID",
  "malaysia": "MY",
  "singapore": "SG",
  "australia": "AU",
  "new zealand": "NZ",
  "croatia": "HR",
  "montenegro": "ME",
  "albania": "AL",
  "cyprus": "CY",
  "malta": "MT",
  "iceland": "IS",
  "norway": "NO",
  "sweden": "SE",
  "finland": "FI",
  "denmark": "DK",
  "netherlands": "NL",
  "belgium": "BE",
  "austria": "AT",
  "switzerland": "CH",
  "poland": "PL",
  "czech": "CZ",
  "hungary": "HU",
  "ireland": "IE",
  "scotland": "GB",
  "england": "GB",
  "uk": "GB",
  "united kingdom": "GB",
  "canada": "CA",
  "usa": "US",
  "united states": "US",
  "caribbean": "JM",
  "jamaica": "JM",
  "cuba": "CU",
  "dominican republic": "DO",
  "bahamas": "BS",
  "sri lanka": "LK",
  "nepal": "NP",
  "cambodia": "KH",
  "laos": "LA",
  "myanmar": "MM",
  "philippines": "PH",
  "china": "CN",
  "hong kong": "HK",
  "taiwan": "TW",
  "south korea": "KR",
  "korea": "KR",
  "jordan": "JO",
  "israel": "IL",
  "oman": "OM",
  "qatar": "QA",
  "saudi arabia": "SA",
  "tunisia": "TN",
  "colombia": "CO",
  "chile": "CL",
  "ecuador": "EC",
  "bolivia": "BO",
  "panama": "PA",
  "guatemala": "GT",
  "nicaragua": "NI",
  "belize": "BZ",
  "seychelles": "SC",
  "zanzibar": "TZ",
  "fiji": "FJ",
  "tahiti": "PF",
  "french polynesia": "PF",
};

function getCountryCodeFromKeyword(keyword: string): string | null {
  const normalizedKeyword = keyword.toLowerCase().trim();
  
  // Direct match
  if (COUNTRY_CODE_MAP[normalizedKeyword]) {
    return COUNTRY_CODE_MAP[normalizedKeyword];
  }
  
  // Check if keyword contains a country name
  for (const [name, code] of Object.entries(COUNTRY_CODE_MAP)) {
    if (normalizedKeyword.includes(name) || name.includes(normalizedKeyword)) {
      return code;
    }
  }
  
  return null;
}

export async function searchBokunProductsByKeyword(keyword: string, page: number = 1, pageSize: number = 20, currency: string = "USD") {
  const path = "/activity.json/search";
  const queryParams = `?currency=${currency}`;
  const fullPath = `${path}${queryParams}`;
  const method = "POST";

  try {
    const headers = getBokunHeaders(method, fullPath);
    
    // Check if keyword matches a country - use location filter
    const countryCode = getCountryCodeFromKeyword(keyword);
    
    const filter: any = {};
    
    if (countryCode) {
      // Use country filter for destination searches
      filter.countries = [countryCode];
      console.log(`Bokun search: Using country filter for "${keyword}" -> ${countryCode}`);
    } else {
      // Fall back to text search for non-country queries
      filter.textSearch = keyword;
    }
    
    const response = await fetch(`${BOKUN_API_BASE}${fullPath}`, {
      method,
      headers,
      body: JSON.stringify({ 
        page, 
        pageSize,
        filter
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Bokun keyword search for:", keyword, countryCode ? `(country: ${countryCode})` : "(text)", "found:", data.totalHits, "results");
    return data;
  } catch (error: any) {
    throw new Error(error.message || "Failed to search products from Bokun API");
  }
}

export async function getBokunProductDetails(productId: string, currency: string = "USD") {
  const path = `/activity.json/${productId}`;
  const queryParams = `?currency=${currency}`;
  const fullPath = `${path}${queryParams}`;
  const method = "GET";

  try {
    const headers = getBokunHeaders(method, fullPath);
    const response = await fetch(`${BOKUN_API_BASE}${fullPath}`, {
      method,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Bokun product details fetched for ID:", productId);
    return data;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch product details from Bokun API");
  }
}

export async function getBokunAvailability(
  productId: string, 
  startDate: string, 
  endDate: string,
  currency: string = "USD"
) {
  const path = `/activity.json/${productId}/availabilities`;
  const method = "GET";
  const queryParams = `?start=${startDate}&end=${endDate}&currency=${currency}`;
  const fullPath = `${path}${queryParams}`;

  try {
    // Generate signature with the full path including query parameters
    const headers = getBokunHeaders(method, fullPath);
    console.log(`\n=== BOKUN AVAILABILITY REQUEST ===`);
    console.log(`URL: ${BOKUN_API_BASE}${fullPath}`);
    console.log(`Currency requested: ${currency}`);
    console.log(`==================================\n`);
    
    const response = await fetch(`${BOKUN_API_BASE}${fullPath}`, {
      method,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Bokun availability API error:", response.status, errorText);
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Bokun availability fetched for product:", productId, "dates:", startDate, "-", endDate);
    
    // Log detailed structure of availability data
    if (Array.isArray(data) && data.length > 0) {
      console.log("\n=== AVAILABILITY DATA STRUCTURE ===");
      console.log("Requested productId:", productId);
      console.log("Response activityId (if present):", data[0].activityId || "NOT PRESENT");
      console.log("Response id:", data[0].id);
      console.log("Total items:", data.length);
      console.log("\nFirst availability item keys:", Object.keys(data[0]));
      console.log("\nComplete first item structure:");
      console.log(JSON.stringify(data[0], null, 2));
      
      if (data[0].pricesByRate && data[0].pricesByRate.length > 0) {
        console.log("\nPricing structure (pricesByRate[0]):");
        console.log(JSON.stringify(data[0].pricesByRate[0], null, 2));
      }
      
      if (data[0].rates && data[0].rates.length > 0) {
        console.log("\nRate details (rates[0]):");
        console.log(JSON.stringify(data[0].rates[0], null, 2));
      }
      console.log("===================================\n");
    }
    
    return data;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch availability from Bokun API");
  }
}

interface BokunBookingRequest {
  productId: string;
  date: string;
  rateId: string;
  currency: string;
  adults: number;
  children?: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
}

export async function reserveBokunBooking(bookingRequest: BokunBookingRequest) {
  const path = "/checkout.json/submit";
  const method = "POST";
  const queryParams = `?currency=${bookingRequest.currency}`;
  const fullPath = `${path}${queryParams}`;

  try {
    const headers = getBokunHeaders(method, fullPath);
    
    // Build Bokun checkout request
    const checkoutRequest = {
      bookingRequest: {
        productBookings: [
          {
            productId: parseInt(bookingRequest.productId),
            date: bookingRequest.date,
            rateId: bookingRequest.rateId,
            pricingCategoryWithQuantities: [
              {
                pricingCategoryId: 1, // Adult pricing category (default)
                numberOfParticipants: bookingRequest.adults,
              },
            ],
          },
        ],
        contact: {
          firstName: bookingRequest.customerFirstName,
          lastName: bookingRequest.customerLastName,
          email: bookingRequest.customerEmail,
          phone: bookingRequest.customerPhone,
        },
      },
      paymentMethod: "RESERVE_FOR_EXTERNAL_PAYMENT",
    };

    console.log("Reserving Bokun booking:", JSON.stringify(checkoutRequest, null, 2));

    const response = await fetch(`${BOKUN_API_BASE}${fullPath}`, {
      method,
      headers,
      body: JSON.stringify(checkoutRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Bokun reserve booking error:", response.status, errorText);
      throw new Error(`Failed to reserve booking: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Bokun booking reserved successfully:", {
      confirmationCode: data.confirmationCode,
      status: data.status,
    });
    
    return data;
  } catch (error: any) {
    console.error("Error reserving Bokun booking:", error);
    throw new Error(error.message || "Failed to reserve booking with Bokun");
  }
}

export async function confirmBokunBooking(
  confirmationCode: string,
  amountPaid: number,
  currency: string,
  paymentReference: string
) {
  const path = `/checkout.json/confirm-reserved/${confirmationCode}`;
  const method = "POST";

  try {
    const headers = getBokunHeaders(method, path);
    
    const confirmRequest = {
      amountPaid,
      currency,
      paymentReference,
    };

    console.log("Confirming Bokun booking:", {
      confirmationCode,
      amountPaid,
      currency,
      paymentReference: paymentReference.slice(0, 20) + "...",
    });

    const response = await fetch(`${BOKUN_API_BASE}${path}`, {
      method,
      headers,
      body: JSON.stringify(confirmRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Bokun confirm booking error:", response.status, errorText);
      throw new Error(`Failed to confirm booking: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Bokun booking confirmed successfully:", {
      confirmationCode: data.confirmationCode,
      status: data.status,
    });
    
    return data;
  } catch (error: any) {
    console.error("Error confirming Bokun booking:", error);
    throw new Error(error.message || "Failed to confirm booking with Bokun");
  }
}

// Types for parsed departure data
export interface ParsedDepartureRate {
  rateId: string | null;
  rateTitle: string;
  pricingCategoryId: string | null;
  roomCategory: "twin" | "single" | "triple" | "standard";
  hotelCategory: string | null;
  minPerBooking: number;
  maxPerBooking: number | null;
  originalPrice: number;
  originalCurrency: string;
  priceGbp: number;
  availableForRate: number | null;
}

export interface ParsedDeparture {
  departureDate: string;
  startTime: string | null;
  totalCapacity: number | null;
  availableSpots: number | null;
  isSoldOut: boolean;
  rates: ParsedDepartureRate[];
}

// Parse duration text (e.g., "8 days", "7 Days / 6 Nights") to nights
export function parseDurationToNights(durationText: string | null | undefined): number | null {
  if (!durationText) return null;
  
  const text = durationText.toLowerCase().trim();
  
  // Try to find explicit nights: "6 nights", "7 Nights"
  const nightsMatch = text.match(/(\d+)\s*nights?/i);
  if (nightsMatch) {
    return parseInt(nightsMatch[1], 10);
  }
  
  // Try to find days: "8 days" = 7 nights, "7 Days" = 6 nights
  const daysMatch = text.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return Math.max(1, days - 1); // Days - 1 = Nights
  }
  
  // Try weeks: "1 week" = 7 nights, "2 weeks" = 14 nights
  const weeksMatch = text.match(/(\d+)\s*weeks?/i);
  if (weeksMatch) {
    return parseInt(weeksMatch[1], 10) * 7;
  }
  
  return null;
}

// Parse room category from rate title
function parseRoomCategory(rateTitle: string, minPerBooking: number): "twin" | "single" | "triple" | "standard" {
  const titleLower = rateTitle.toLowerCase();
  
  // Check explicit mentions
  if (titleLower.includes("single") || titleLower.includes("solo")) return "single";
  if (titleLower.includes("triple") || titleLower.includes("3-share")) return "triple";
  if (titleLower.includes("twin") || titleLower.includes("double") || titleLower.includes("2-share")) return "twin";
  
  // Infer from minPerBooking
  if (minPerBooking === 1) return "single";
  if (minPerBooking === 2) return "twin";
  if (minPerBooking === 3) return "triple";
  
  return "standard";
}

// Parse hotel category from rate title
function parseHotelCategory(rateTitle: string): string | null {
  const titleLower = rateTitle.toLowerCase();
  
  // Check for star ratings
  const starMatch = rateTitle.match(/(\d)\s*[-*]?\s*star/i);
  if (starMatch) return `${starMatch[1]}-star`;
  
  // Check for common hotel tier keywords
  if (titleLower.includes("deluxe")) return "Deluxe";
  if (titleLower.includes("premium")) return "Premium";
  if (titleLower.includes("standard")) return "Standard";
  if (titleLower.includes("budget")) return "Budget";
  if (titleLower.includes("luxury")) return "Luxury";
  if (titleLower.includes("superior")) return "Superior";
  
  return null;
}

// Sync departures from Bokun for a given product
export async function syncBokunDepartures(
  productId: string,
  exchangeRate: number = 0.79 // Default USD to GBP rate
): Promise<{ departures: ParsedDeparture[]; totalRates: number; durationNights: number | null }> {
  // Fetch next 12 months of availability
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 12);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  console.log(`[SyncDepartures] Fetching Bokun availability for product ${productId} from ${startStr} to ${endStr}`);
  
  // Fetch product details to get duration
  let durationNights: number | null = null;
  try {
    const productDetails = await getBokunProductDetails(productId, "USD");
    const durationText = productDetails?.durationText || productDetails?.fields?.durationText;
    durationNights = parseDurationToNights(durationText);
    console.log(`[SyncDepartures] Product ${productId} duration: "${durationText}" -> ${durationNights} nights`);
  } catch (err) {
    console.warn(`[SyncDepartures] Could not fetch product details for duration: ${err}`);
  }
  
  // Fetch in USD (Bokun default)
  const availabilityData = await getBokunAvailability(productId, startStr, endStr, "USD");
  
  if (!Array.isArray(availabilityData) || availabilityData.length === 0) {
    console.log(`[SyncDepartures] No availability data returned for product ${productId}`);
    return { departures: [], totalRates: 0, durationNights };
  }
  
  const departures: ParsedDeparture[] = [];
  let totalRates = 0;
  
  for (const availability of availabilityData) {
    // Skip if no date
    if (!availability.date) continue;
    
    // Convert timestamp to YYYY-MM-DD format
    const dateValue = typeof availability.date === 'number' 
      ? new Date(availability.date).toISOString().split('T')[0]
      : availability.date;
    const departureDate = dateValue;
    const startTime = availability.startTime || null;
    
    // Check overall availability
    const isSoldOut = availability.soldOut === true || availability.available === false;
    const totalCapacity = availability.maxParticipants || null;
    const availableSpots = availability.availableSpots || availability.availabilityCount || null;
    
    // Build a map of rate details from the rates array
    const rateDetailsMap = new Map<number, any>();
    if (availability.rates && Array.isArray(availability.rates)) {
      for (const rate of availability.rates) {
        rateDetailsMap.set(rate.id, rate);
      }
    }
    
    // Parse rates from pricesByRate (which contains the actual prices)
    const rates: ParsedDepartureRate[] = [];
    
    if (availability.pricesByRate && Array.isArray(availability.pricesByRate)) {
      for (const ratePrice of availability.pricesByRate) {
        const rateId = (ratePrice.activityRateId || ratePrice.rateId)?.toString() || null;
        
        // Get rate details from the rates array
        const rateDetails = rateDetailsMap.get(ratePrice.activityRateId) || {};
        const rateTitle = rateDetails.title || ratePrice.title || ratePrice.rateName || "Standard Rate";
        
        // Get the first adult price from pricePerCategoryUnit
        let originalPrice = 0;
        let originalCurrency = "USD";
        let pricingCategoryId: string | null = null;
        
        if (ratePrice.pricePerCategoryUnit && Array.isArray(ratePrice.pricePerCategoryUnit) && ratePrice.pricePerCategoryUnit.length > 0) {
          // Get the first pricing category (typically Adult)
          const firstPricing = ratePrice.pricePerCategoryUnit[0];
          pricingCategoryId = firstPricing.id?.toString() || null;
          if (firstPricing.amount) {
            originalPrice = firstPricing.amount.amount || 0;
            originalCurrency = firstPricing.amount.currency || "USD";
          }
        }
        
        // Convert to GBP (divide by rate since we're buying in USD, e.g., $100 / 1.25 = £80)
        const priceGbp = originalCurrency === "GBP" 
          ? originalPrice 
          : Math.round((originalPrice / exchangeRate) * 100) / 100;
        
        // Parse min/max booking from rate details
        const minPerBooking = rateDetails.minPerBooking || 1;
        const maxPerBooking = rateDetails.maxPerBooking || null;
        
        // Determine room and hotel categories from the rate title
        const roomCategory = parseRoomCategory(rateTitle, minPerBooking);
        const hotelCategory = parseHotelCategory(rateTitle);
        
        rates.push({
          rateId,
          rateTitle,
          pricingCategoryId,
          roomCategory,
          hotelCategory,
          minPerBooking,
          maxPerBooking,
          originalPrice,
          originalCurrency,
          priceGbp,
          availableForRate: null,
        });
        totalRates++;
      }
    }
    
    // If no pricesByRate, try to get pricing from rates array
    if (rates.length === 0 && availability.rates && Array.isArray(availability.rates)) {
      for (const rate of availability.rates) {
        const rateId = rate.id?.toString() || null;
        const rateTitle = rate.title || rate.name || "Standard Rate";
        const originalPrice = rate.price || rate.pricePerPerson || 0;
        const originalCurrency = rate.currency || "USD";
        const priceGbp = originalCurrency === "GBP" 
          ? originalPrice 
          : Math.round((originalPrice / exchangeRate) * 100) / 100;
        
        const minPerBooking = rate.minPerBooking || 1;
        const roomCategory = parseRoomCategory(rateTitle, minPerBooking);
        const hotelCategory = parseHotelCategory(rateTitle);
        
        rates.push({
          rateId,
          rateTitle,
          pricingCategoryId: null,
          roomCategory,
          hotelCategory,
          minPerBooking,
          maxPerBooking: rate.maxPerBooking || null,
          originalPrice,
          originalCurrency,
          priceGbp,
          availableForRate: null,
        });
        totalRates++;
      }
    }
    
    // Only add departure if it has rates with prices
    if (rates.length > 0) {
      departures.push({
        departureDate,
        startTime,
        totalCapacity,
        availableSpots,
        isSoldOut,
        rates,
      });
    }
  }
  
  console.log(`[SyncDepartures] Parsed ${departures.length} departures with ${totalRates} total rates for product ${productId}`);
  
  return { departures, totalRates, durationNights };
}
