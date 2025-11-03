import crypto from "crypto";

const BOKUN_API_BASE = "https://api.bokuntest.com";
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
    console.log("Bokun connection successful, got", data.totalCount || 0, "total products");
    
    return {
      connected: true,
      message: "Successfully connected to Bokun API",
      timestamp: new Date().toISOString(),
      responseTime,
      data,
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
    return data;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch products from Bokun API");
  }
}
