import cron from "node-cron";
import { storage } from "./storage";
import { searchBokunProducts } from "./bokun";

const SUNSHINE_ROUNDTRIP_URL = "http://87.102.127.86:8119/search/searchoffers.dll";
const SUNSHINE_ONEWAY_URL = "http://87.102.127.86:8119/owflights/owflights.dll";

function smartRound(price: number): number {
  if (price <= 0) return 0;
  const base = Math.floor(price / 100) * 100;
  const remainder = price - base;
  if (remainder <= 49) return base + 49;
  if (remainder <= 69) return base + 69;
  return base + 99;
}

async function refreshPackageFlights(pkg: any): Promise<{ success: boolean; updated: number; error?: string }> {
  try {
    console.log(`[AutoRefresh] Processing package ${pkg.id}: ${pkg.title}`);
    
    const config = pkg.flightRefreshConfig;
    if (!config || !config.destinationAirport || !config.departureAirports?.length) {
      return { success: false, updated: 0, error: "Missing refresh config" };
    }
    
    const departures = await storage.getBokunDepartures(pkg.id);
    if (departures.length === 0) {
      return { success: true, updated: 0, error: "No departures found" };
    }
    
    const storedDuration = departures[0]?.durationNights || 7;
    const uniqueDates = Array.from(new Set(departures.map(d => d.departureDate)));
    const flightType = config.flightType || "roundtrip";
    
    console.log(`[AutoRefresh] Found ${uniqueDates.length} unique dates, duration: ${storedDuration} nights, type: ${flightType}`);
    
    const formatDateForApi = (isoDate: string): string => {
      const [year, month, day] = isoDate.split("-");
      return `${day}/${month}/${year}`;
    };
    
    const sortedDates = [...uniqueDates].sort();
    const startDate = formatDateForApi(sortedDates[0]);
    const endDate = formatDateForApi(sortedDates[sortedDates.length - 1]);
    const airportList = config.departureAirports.join("|");
    
    const flightPrices: Record<string, Record<string, number>> = {};
    
    if (flightType === "openjaw") {
      // ===== OPEN-JAW: Search outbound + return one-way flights separately =====
      console.log(`[AutoRefresh] Open-jaw mode: searching one-way flights`);
      
      // Calculate return date for each departure date using a map for correct pairing
      const returnDateMap: Record<string, string> = {};
      const allReturnDates: string[] = [];
      for (const depDate of uniqueDates) {
        const returnDate = new Date(depDate);
        returnDate.setDate(returnDate.getDate() + storedDuration);
        const returnDateIso = returnDate.toISOString().split("T")[0];
        returnDateMap[depDate] = returnDateIso;
        allReturnDates.push(returnDateIso);
      }
      const sortedReturnDates = Array.from(new Set(allReturnDates)).sort();
      const returnStartDate = formatDateForApi(sortedReturnDates[0]);
      const returnEndDate = formatDateForApi(sortedReturnDates[sortedReturnDates.length - 1]);
      
      // 1. Fetch OUTBOUND one-way flights (UK → destination)
      const outboundUrl = new URL(SUNSHINE_ONEWAY_URL);
      outboundUrl.searchParams.set("agtid", "122");
      outboundUrl.searchParams.set("depart", airportList);
      outboundUrl.searchParams.set("Arrive", config.destinationAirport);
      outboundUrl.searchParams.set("startdate", startDate);
      outboundUrl.searchParams.set("enddate", endDate);
      
      console.log(`[AutoRefresh] Outbound API: ${outboundUrl.toString()}`);
      
      const outboundController = new AbortController();
      const outboundTimeout = setTimeout(() => outboundController.abort(), 60000);
      
      const outboundResponse = await fetch(outboundUrl.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: outboundController.signal,
      });
      
      clearTimeout(outboundTimeout);
      
      if (!outboundResponse.ok) {
        throw new Error(`Outbound API returned ${outboundResponse.status}`);
      }
      
      const outboundRaw = await outboundResponse.text();
      if (outboundRaw.startsWith("<?xml") || outboundRaw.includes("<Error>")) {
        const errorMatch = outboundRaw.match(/<Error>(.*?)<\/Error>/i);
        throw new Error(errorMatch ? errorMatch[1] : "Unknown error from outbound API");
      }
      
      const outboundData = JSON.parse(outboundRaw);
      const outboundFlights = outboundData.Flights || [];
      console.log(`[AutoRefresh] Found ${outboundFlights.length} outbound one-way flights`);
      
      // 2. Fetch RETURN one-way flights (returnAirport → UK)
      // For open-jaw: return departs from a different airport than where outbound landed
      const returnDepartureAirport = config.returnAirport || config.destinationAirport;
      const returnUrl = new URL(SUNSHINE_ONEWAY_URL);
      returnUrl.searchParams.set("agtid", "122");
      returnUrl.searchParams.set("depart", returnDepartureAirport);
      returnUrl.searchParams.set("Arrive", airportList);
      returnUrl.searchParams.set("startdate", returnStartDate);
      returnUrl.searchParams.set("enddate", returnEndDate);
      
      console.log(`[AutoRefresh] Return API: ${returnUrl.toString()}`);
      
      const returnController = new AbortController();
      const returnTimeout = setTimeout(() => returnController.abort(), 60000);
      
      const returnResponse = await fetch(returnUrl.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: returnController.signal,
      });
      
      clearTimeout(returnTimeout);
      
      if (!returnResponse.ok) {
        throw new Error(`Return API returned ${returnResponse.status}`);
      }
      
      const returnRaw = await returnResponse.text();
      if (returnRaw.startsWith("<?xml") || returnRaw.includes("<Error>")) {
        const errorMatch = returnRaw.match(/<Error>(.*?)<\/Error>/i);
        throw new Error(errorMatch ? errorMatch[1] : "Unknown error from return API");
      }
      
      const returnData = JSON.parse(returnRaw);
      const returnFlights = returnData.Flights || [];
      console.log(`[AutoRefresh] Found ${returnFlights.length} return one-way flights`);
      
      // 3. Build cheapest outbound prices per date/airport
      const outboundPrices: Record<string, Record<string, number>> = {};
      for (const flight of outboundFlights) {
        const datePart = flight.Depart?.split(" ")[0];
        if (!datePart) continue;
        
        const [day, month, year] = datePart.split("/");
        const isoDate = `${year}-${month}-${day}`;
        
        if (!uniqueDates.includes(isoDate)) continue;
        
        const airport = flight.Depapt;
        const price = parseFloat(flight.Fltprice);
        
        if (!airport || isNaN(price)) continue;
        
        if (!outboundPrices[isoDate]) outboundPrices[isoDate] = {};
        if (!outboundPrices[isoDate][airport] || price < outboundPrices[isoDate][airport]) {
          outboundPrices[isoDate][airport] = price;
        }
      }
      
      // 4. Build cheapest return prices per date/airport
      const returnPrices: Record<string, Record<string, number>> = {};
      for (const flight of returnFlights) {
        const datePart = flight.Depart?.split(" ")[0];
        if (!datePart) continue;
        
        const [day, month, year] = datePart.split("/");
        const isoDate = `${year}-${month}-${day}`;
        
        const airport = flight.Arrapt;
        const price = parseFloat(flight.Fltprice);
        
        if (!airport || isNaN(price)) continue;
        
        if (!returnPrices[isoDate]) returnPrices[isoDate] = {};
        if (!returnPrices[isoDate][airport] || price < returnPrices[isoDate][airport]) {
          returnPrices[isoDate][airport] = price;
        }
      }
      
      // 5. Combine outbound + return for each departure date using the map
      for (const depDate of uniqueDates) {
        const returnDate = returnDateMap[depDate];
        if (!returnDate) continue;
        
        const outbound = outboundPrices[depDate] || {};
        const returns = returnPrices[returnDate] || {};
        
        for (const airport of config.departureAirports) {
          const outPrice = outbound[airport];
          const retPrice = returns[airport];
          
          if (outPrice !== undefined && retPrice !== undefined) {
            if (!flightPrices[depDate]) flightPrices[depDate] = {};
            flightPrices[depDate][airport] = outPrice + retPrice;
          }
        }
      }
      
    } else {
      // ===== ROUND-TRIP: Use existing searchoffers.dll endpoint =====
      const flightApiUrl = new URL(SUNSHINE_ROUNDTRIP_URL);
      flightApiUrl.searchParams.set("agtid", "122");
      flightApiUrl.searchParams.set("page", "FLTDATE");
      flightApiUrl.searchParams.set("platform", "WEB");
      flightApiUrl.searchParams.set("depart", airportList);
      flightApiUrl.searchParams.set("arrive", config.destinationAirport);
      flightApiUrl.searchParams.set("Startdate", startDate);
      flightApiUrl.searchParams.set("EndDate", endDate);
      flightApiUrl.searchParams.set("duration", storedDuration.toString());
      flightApiUrl.searchParams.set("output", "JSON");
      
      console.log(`[AutoRefresh] Calling Sunshine API: ${flightApiUrl.toString()}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(flightApiUrl.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Sunshine API returned ${response.status}`);
      }
      
      const rawText = await response.text();
      
      if (rawText.startsWith("<?xml") || rawText.includes("<Error>")) {
        const errorMatch = rawText.match(/<Error>(.*?)<\/Error>/i);
        throw new Error(errorMatch ? errorMatch[1] : "Unknown error from Sunshine API");
      }
      
      const data = JSON.parse(rawText);
      const offers = data.Offers || [];
      
      console.log(`[AutoRefresh] Received ${offers.length} flight offers`);
      
      for (const offer of offers) {
        const outdepParts = offer.outdep?.split(" ") || [];
        const datePart = outdepParts[0];
        
        if (!datePart) continue;
        
        const [day, month, year] = datePart.split("/");
        const isoDate = `${year}-${month}-${day}`;
        
        if (!uniqueDates.includes(isoDate)) continue;
        
        const airport = offer.depapt;
        const price = parseFloat(offer.fltnetpricepp);
        
        if (!airport || isNaN(price)) continue;
        
        if (!flightPrices[isoDate]) {
          flightPrices[isoDate] = {};
        }
        
        if (!flightPrices[isoDate][airport] || price < flightPrices[isoDate][airport]) {
          flightPrices[isoDate][airport] = price;
        }
      }
    }
    
    let updatedCount = 0;
    const markup = typeof config.markup === 'number' ? config.markup : 0;
    
    for (const departure of departures) {
      const dateFlights = flightPrices[departure.departureDate] || {};
      
      for (const rate of departure.rates || []) {
        for (const [airport, flightPrice] of Object.entries(dateFlights)) {
          const subtotal = (rate.priceGbp || 0) + (flightPrice as number);
          const withMarkup = subtotal * (1 + markup / 100);
          const smartRoundedPrice = smartRound(withMarkup);
          
          await storage.upsertDepartureRateFlight(
            rate.id,
            airport,
            flightPrice as number,
            smartRoundedPrice,
            markup,
            "sunshine"
          );
          updatedCount++;
        }
      }
    }
    
    await storage.updateFlightPackageRefreshTimestamp(pkg.id);
    
    // Auto-update the lead price shown in banners/cards
    const leadPriceResult = await storage.updatePackageLeadPriceFromFlights(pkg.id);
    if (leadPriceResult.updated) {
      console.log(`[AutoRefresh] Lead price updated: twin=${leadPriceResult.newPrice}, single=${leadPriceResult.newSinglePrice}`);
    }
    
    console.log(`[AutoRefresh] Updated ${updatedCount} flight entries for package ${pkg.id}`);
    return { success: true, updated: updatedCount };
    
  } catch (error: any) {
    console.error(`[AutoRefresh] Error for package ${pkg.id}:`, error.message);
    return { success: false, updated: 0, error: error.message };
  }
}

async function runWeeklyFlightRefresh(): Promise<void> {
  console.log(`\n========================================`);
  console.log(`[AutoRefresh] Starting weekly flight price refresh - ${new Date().toISOString()}`);
  console.log(`========================================\n`);
  
  try {
    const packages = await storage.getPackagesWithAutoRefresh();
    
    if (packages.length === 0) {
      console.log("[AutoRefresh] No packages with auto-refresh enabled");
      return;
    }
    
    console.log(`[AutoRefresh] Found ${packages.length} packages with auto-refresh enabled`);
    
    let totalUpdated = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (const pkg of packages) {
      const result = await refreshPackageFlights(pkg);
      
      if (result.success) {
        successCount++;
        totalUpdated += result.updated;
      } else {
        errorCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n[AutoRefresh] Completed: ${successCount} packages successful, ${errorCount} failed, ${totalUpdated} total updates`);
    
  } catch (error: any) {
    console.error("[AutoRefresh] Critical error:", error.message);
  }
}

async function runWeeklyBokunCacheRefresh(): Promise<void> {
  console.log(`\n========================================`);
  console.log(`[BokunCache] Starting weekly Bokun product cache refresh - ${new Date().toISOString()}`);
  console.log(`========================================\n`);
  
  const currencies = ["GBP", "USD", "EUR"];
  
  for (const currency of currencies) {
    try {
      console.log(`[BokunCache] Fetching ALL ${currency} products from Bokun API...`);
      
      let allProducts: any[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;
      
      while (hasMore) {
        const data = await searchBokunProducts(page, pageSize, currency);
        const items = data.items || [];
        allProducts = allProducts.concat(items);
        
        console.log(`[BokunCache] Fetched page ${page}: ${items.length} products (total: ${allProducts.length})`);
        
        hasMore = items.length === pageSize;
        page++;
        
        // Safety limit to prevent infinite loops (50 pages = 5000 products max)
        if (page > 50) {
          console.log(`[BokunCache] Reached safety limit of 50 pages`);
          break;
        }
        
        // Small delay between pages to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Deduplicate products by ID
      const uniqueProducts = Array.from(
        new Map(allProducts.map(p => [p.id, p])).values()
      );
      
      // Store in cache
      await storage.setCachedProducts(uniqueProducts, currency);
      
      console.log(`[BokunCache] Cached ${uniqueProducts.length} unique ${currency} products`);
      
    } catch (error: any) {
      console.error(`[BokunCache] Error refreshing ${currency} products:`, error.message);
    }
  }
  
  console.log(`\n[BokunCache] Weekly cache refresh completed - ${new Date().toISOString()}\n`);
}

export function initScheduler(): void {
  console.log("[Scheduler] Initializing scheduled tasks:");
  console.log("  - Flight price refresh: Sundays at 3:00 AM UK time");
  console.log("  - Bokun product cache: Sundays at 8:00 PM UK time");
  
  // Flight price refresh - Sundays at 3:00 AM UK time
  cron.schedule("0 3 * * 0", () => {
    runWeeklyFlightRefresh();
  }, {
    timezone: "Europe/London"
  });
  
  // Bokun product cache refresh - Sundays at 8:00 PM UK time
  cron.schedule("0 20 * * 0", () => {
    runWeeklyBokunCacheRefresh();
  }, {
    timezone: "Europe/London"
  });
  
  console.log("[Scheduler] All schedulers initialized successfully");
}

export { runWeeklyFlightRefresh, runWeeklyBokunCacheRefresh };
