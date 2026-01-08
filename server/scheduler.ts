import cron from "node-cron";
import { storage } from "./storage";

const SUNSHINE_API_URL = "http://87.102.127.86:8119/search/searchoffers.dll";

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
    
    console.log(`[AutoRefresh] Found ${uniqueDates.length} unique dates, duration: ${storedDuration} nights`);
    
    const formatDateForApi = (isoDate: string): string => {
      const [year, month, day] = isoDate.split("-");
      return `${day}/${month}/${year}`;
    };
    
    const sortedDates = [...uniqueDates].sort();
    const startDate = formatDateForApi(sortedDates[0]);
    const endDate = formatDateForApi(sortedDates[sortedDates.length - 1]);
    const airportList = config.departureAirports.join("|");
    
    const flightApiUrl = new URL(SUNSHINE_API_URL);
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
    
    const flightPrices: Record<string, Record<string, number>> = {};
    
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

export function initScheduler(): void {
  console.log("[Scheduler] Initializing weekly flight price refresh (Sundays at 3:00 AM UK time)");
  
  cron.schedule("0 3 * * 0", () => {
    runWeeklyFlightRefresh();
  }, {
    timezone: "Europe/London"
  });
  
  console.log("[Scheduler] Scheduler initialized successfully");
}

export { runWeeklyFlightRefresh };
