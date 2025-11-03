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

export async function searchBokunProducts(page: number = 1, pageSize: number = 20) {
  const path = "/activity.json/search";
  const method = "POST";

  try {
    const headers = getBokunHeaders(method, path);
    const response = await fetch(`${BOKUN_API_BASE}${path}`, {
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
      firstItemKeys: data.items?.[0] ? Object.keys(data.items[0]) : "no items",
      sampleItem: data.items?.[0]
    });
    return data;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch products from Bokun API");
  }
}

export async function getBokunProductDetails(productId: string) {
  const path = `/activity.json/${productId}`;
  const method = "GET";

  try {
    const headers = getBokunHeaders(method, path);
    const response = await fetch(`${BOKUN_API_BASE}${path}`, {
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
  currency: string = "GBP"
) {
  const path = `/activity.json/${productId}/availabilities`;
  const method = "GET";
  const queryParams = `?start=${startDate}&end=${endDate}&currency=${currency}`;
  const fullPath = `${path}${queryParams}`;

  try {
    // Generate signature with the full path including query parameters
    const headers = getBokunHeaders(method, fullPath);
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
    console.log("Availability response structure:", JSON.stringify(data, null, 2));
    return data;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch availability from Bokun API");
  }
}
