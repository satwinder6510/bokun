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

export async function searchBokunProductsByKeyword(keyword: string, page: number = 1, pageSize: number = 20, currency: string = "USD") {
  const path = "/activity.json/search";
  const queryParams = `?currency=${currency}`;
  const fullPath = `${path}${queryParams}`;
  const method = "POST";

  try {
    const headers = getBokunHeaders(method, fullPath);
    const response = await fetch(`${BOKUN_API_BASE}${fullPath}`, {
      method,
      headers,
      body: JSON.stringify({ 
        page, 
        pageSize,
        filter: {
          textSearch: keyword
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Bokun keyword search for:", keyword, "found:", data.totalHits, "results");
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

// Extract single traveller pricing from Bokun product details
export interface SingleTravellerPrice {
  productId: string;
  singlePrice: number | null;  // Price in GBP with markup applied
  currency: string;
  rateName: string | null;
  hasSingleRate: boolean;
}

// Get exchange rate from storage (pass from caller) or use default
const DEFAULT_EXCHANGE_RATE = 0.79;
const MARKUP = 1.10; // 10% markup

export async function getSingleTravellerPrice(
  productId: string, 
  currency: string = "USD",
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): Promise<SingleTravellerPrice> {
  try {
    const productDetails = await getBokunProductDetails(productId, currency);
    
    let rawPrice: number | null = null;
    let rateName: string | null = null;
    let hasSingleRate = false;
    
    // Look for single/solo rates in the rates array
    // Bokun rates use priceFrom or other price fields
    if (productDetails.rates && Array.isArray(productDetails.rates)) {
      const singleRate = productDetails.rates.find((rate: any) => {
        const title = (rate.title || rate.name || "").toLowerCase();
        return title.includes("single") || title.includes("solo") || 
               title.includes("individual") || title.includes("private single") ||
               title.includes("1 person") || title.includes("one person");
      });
      
      if (singleRate) {
        // Try multiple price fields that Bokun might use
        const ratePrice = singleRate.priceFrom?.amount || 
                         singleRate.price || 
                         singleRate.pricePerPerson ||
                         singleRate.nextDefaultPrice ||
                         null;
        if (ratePrice) {
          rawPrice = ratePrice;
          rateName = singleRate.title || singleRate.name || "Single Rate";
          hasSingleRate = true;
        }
      }
    }
    
    // If no specific single rate found, check pricingCategories for single supplement
    if (!hasSingleRate && productDetails.pricingCategories && Array.isArray(productDetails.pricingCategories)) {
      const singleCategory = productDetails.pricingCategories.find((cat: any) => {
        const label = (cat.label || cat.name || cat.title || "").toLowerCase();
        return label.includes("single") || label.includes("solo") || label.includes("1 person");
      });
      
      if (singleCategory) {
        // Look for price in various possible fields
        const catPrice = singleCategory.categoryPrice?.amount ||
                        singleCategory.pricePerCategoryUnit?.amount ||
                        singleCategory.price ||
                        null;
        if (catPrice) {
          rawPrice = catPrice;
          rateName = singleCategory.label || singleCategory.name || "Single Occupancy";
          hasSingleRate = true;
        }
      }
    }
    
    // If still no single price found, use the base price (per person price for 1 adult)
    // This is the standard Bokun price structure
    if (rawPrice === null) {
      rawPrice = productDetails.nextDefaultPriceMoney?.amount || 
                productDetails.nextDefaultPrice ||
                productDetails.price || 
                null;
      rateName = "Per Person";
    }
    
    // Convert USD to GBP and apply markup
    let singlePriceGBP: number | null = null;
    if (rawPrice !== null) {
      singlePriceGBP = Math.round(rawPrice * exchangeRate * MARKUP);
    }
    
    return {
      productId,
      singlePrice: singlePriceGBP,
      currency: "GBP",
      rateName,
      hasSingleRate
    };
  } catch (error: any) {
    console.error(`Error fetching single price for product ${productId}:`, error.message);
    return {
      productId,
      singlePrice: null,
      currency: "GBP",
      rateName: null,
      hasSingleRate: false
    };
  }
}

// Batch fetch single traveller prices for multiple products
export async function getBatchSingleTravellerPrices(
  productIds: string[], 
  currency: string = "USD",
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): Promise<Record<string, SingleTravellerPrice>> {
  const results: Record<string, SingleTravellerPrice> = {};
  
  // Fetch in parallel with concurrency limit to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(id => getSingleTravellerPrice(id, currency, exchangeRate))
    );
    batchResults.forEach(result => {
      results[result.productId] = result;
    });
  }
  
  return results;
}
