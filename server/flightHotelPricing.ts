/**
 * Flight + Hotel Combined Pricing Calculator
 * Combines Sunshine Flight API + Hotel API for dynamic package pricing
 * Supports both Sunshine European API and SERP API (Google Flights)
 */

import { searchFlights, searchOneWayFlights, smartRoundPrice, type OneWayFlight } from "./flightApi";
import { searchSerpFlights, searchOpenJawFlights, type SerpFlightOffer, type OpenJawFlightOffer } from "./serpFlightApi";
import { searchHotels, getCheapestHotel, formatDateDDMMYYYY, addDays, type HotelOffer } from "./hotelApi";
import { storage } from "./storage";
import type { FlightHotelConfig } from "@shared/schema";

interface CityConfig {
  cityName: string;
  cityCode?: string;
  nights: number;
  starRating: number;
  boardBasis: string;
  hotelCodes?: string[];      // For search mode (fallback)
  specificHotelCode?: string;  // For exact hotel specification (preferred)
}

/**
 * Calculate combined flight + hotel prices for a date range
 */
export async function calculateFlightHotelPrices(
  packageId: number,
  config: FlightHotelConfig
): Promise<{ success: boolean; pricesCalculated: number; errors: string[] }> {

  const errors: string[] = [];
  let pricesCalculated = 0;

  // Calculate total trip duration
  const totalNights = config.cities.reduce((sum: number, city) => sum + city.nights, 0);

  // Generate date range
  const dates = generateDateRange(config.searchStartDate, config.searchEndDate);

  console.log(`[FlightHotel] Processing ${dates.length} dates for package ${packageId}`);
  console.log(`[FlightHotel] Using ${config.flightApiSource} flight API`);

  for (const travelDate of dates) {
    try {
      console.log(`\n[FlightHotel] === Processing ${travelDate} ===`);

      // STEP 1: Fetch flights for this date
      const flightPrices = await fetchFlightPrices(
        travelDate,
        config.arrivalAirport,
        config.departureAirport,
        config.flightType as "roundtrip" | "openjaw",
        config.ukAirports,
        totalNights,
        config.flightApiSource as "european" | "serp"
      );

      if (Object.keys(flightPrices).length === 0) {
        console.log(`[FlightHotel] No flights found for ${travelDate}`);
        continue;
      }

      // STEP 2: Fetch hotels for multi-city itinerary (Twin Share)
      const hotelResults = await fetchHotelsForItinerary(
        config.cities,
        travelDate,
        "twin"
      );

      if (!hotelResults.success) {
        errors.push(`${travelDate}: ${hotelResults.error}`);
        continue;
      }

      // STEP 3: Calculate prices for each UK airport (Twin Share)
      for (const [ukAirport, flightPrice] of Object.entries(flightPrices)) {
        const price = calculateFinalPrice(
          flightPrice,
          hotelResults.hotels!,
          config.markup
        );

        await storage.insertFlightHotelPrice({
          packageId,
          travelDate,
          ukAirport,
          roomType: "twin",
          flightPricePerPerson: flightPrice,
          hotels: hotelResults.hotels!,
          totalFlightCost: flightPrice,
          totalHotelCostPerPerson: price.hotelCostPerPerson,
          subtotal: price.subtotal,
          markupAmount: price.markupAmount,
          afterMarkup: price.afterMarkup,
          finalPrice: price.finalPrice,
        });

        pricesCalculated++;
        console.log(`[FlightHotel] ${travelDate} ${ukAirport} (twin): £${price.finalPrice}`);
      }

      // STEP 4: Single room pricing
      const singleHotels = await fetchHotelsForItinerary(
        config.cities,
        travelDate,
        "single"
      );

      if (singleHotels.success) {
        for (const [ukAirport, flightPrice] of Object.entries(flightPrices)) {
          const price = calculateFinalPrice(
            flightPrice,
            singleHotels.hotels!,
            config.markup
          );

          await storage.insertFlightHotelPrice({
            packageId,
            travelDate,
            ukAirport,
            roomType: "single",
            flightPricePerPerson: flightPrice,
            hotels: singleHotels.hotels!,
            totalFlightCost: flightPrice,
            totalHotelCostPerPerson: price.hotelCostPerPerson,
            subtotal: price.subtotal,
            markupAmount: price.markupAmount,
            afterMarkup: price.afterMarkup,
            finalPrice: price.finalPrice,
          });

          pricesCalculated++;
        }
      }

    } catch (error: any) {
      console.error(`[FlightHotel] Error for ${travelDate}:`, error.message);
      errors.push(`${travelDate}: ${error.message}`);
    }

    // Rate limiting between dates
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n[FlightHotel] Complete: ${pricesCalculated} prices calculated, ${errors.length} errors`);

  return {
    success: errors.length === 0,
    pricesCalculated,
    errors
  };
}

/**
 * Fetch flight prices using the configured API source
 */
async function fetchFlightPrices(
  travelDate: string,
  arrivalAirport: string,
  departureAirport: string | null,
  flightType: "roundtrip" | "openjaw",
  ukAirports: string[],
  nights: number,
  flightApiSource: "european" | "serp"
): Promise<Record<string, number>> {

  if (flightApiSource === "serp") {
    return await fetchFlightPricesSerp(
      travelDate,
      arrivalAirport,
      departureAirport,
      flightType,
      ukAirports,
      nights
    );
  } else {
    return await fetchFlightPricesEuropean(
      travelDate,
      arrivalAirport,
      departureAirport,
      flightType,
      ukAirports,
      nights
    );
  }
}

/**
 * Fetch flight prices from Sunshine European API
 */
async function fetchFlightPricesEuropean(
  travelDate: string,
  arrivalAirport: string,
  departureAirport: string | null,
  flightType: "roundtrip" | "openjaw",
  ukAirports: string[],
  nights: number
): Promise<Record<string, number>> {

  const travelDateObj = new Date(travelDate);
  const startDate = formatDateDDMMYYYY(travelDateObj);
  const endDate = startDate;

  const flightPrices: Record<string, number> = {};

  if (flightType === "roundtrip") {
    const offers = await searchFlights({
      departAirports: ukAirports.join("|"),
      arriveAirport: arrivalAirport,
      nights,
      startDate,
      endDate,
    });

    for (const offer of offers) {
      const airport = offer.depapt;
      const price = parseFloat(offer.fltnetpricepp);

      if (!flightPrices[airport] || price < flightPrices[airport]) {
        flightPrices[airport] = price;
      }
    }

  } else {
    // Open-jaw
    const returnDate = addDays(travelDateObj, nights);
    const returnDateStr = formatDateDDMMYYYY(returnDate);

    const outbound = await searchOneWayFlights({
      departAirports: ukAirports.join("|"),
      arriveAirports: arrivalAirport,
      startDate,
      endDate,
    });

    const returns = await searchOneWayFlights({
      departAirports: departureAirport || arrivalAirport,
      arriveAirports: ukAirports.join("|"),
      startDate: returnDateStr,
      endDate: returnDateStr,
    });

    const outboundByAirport: Record<string, number> = {};
    const returnByAirport: Record<string, number> = {};

    for (const flight of outbound) {
      const airport = flight.Depapt;
      const price = parseFloat(flight.Fltprice);
      if (!outboundByAirport[airport] || price < outboundByAirport[airport]) {
        outboundByAirport[airport] = price;
      }
    }

    for (const flight of returns) {
      const airport = flight.Arrapt;
      const price = parseFloat(flight.Fltprice);
      if (!returnByAirport[airport] || price < returnByAirport[airport]) {
        returnByAirport[airport] = price;
      }
    }

    for (const airport of ukAirports) {
      const outPrice = outboundByAirport[airport];
      const retPrice = returnByAirport[airport];
      if (outPrice && retPrice) {
        flightPrices[airport] = outPrice + retPrice;
      }
    }
  }

  return flightPrices;
}

/**
 * Fetch flight prices from SERP API (Google Flights)
 */
async function fetchFlightPricesSerp(
  travelDate: string,
  arrivalAirport: string,
  departureAirport: string | null,
  flightType: "roundtrip" | "openjaw",
  ukAirports: string[],
  nights: number
): Promise<Record<string, number>> {

  const flightPrices: Record<string, number> = {};

  if (flightType === "roundtrip") {
    const offers = await searchSerpFlights({
      departAirports: ukAirports,
      arriveAirport: arrivalAirport,
      nights,
      startDate: travelDate,
      endDate: travelDate,
      specificDates: [travelDate],
    });

    for (const offer of offers) {
      const airport = offer.departureAirport;
      const price = offer.pricePerPerson;

      if (!flightPrices[airport] || price < flightPrices[airport]) {
        flightPrices[airport] = price;
      }
    }

  } else {
    const offers = await searchOpenJawFlights({
      ukAirports,
      arriveAirport: arrivalAirport,
      departAirport: departureAirport || arrivalAirport,
      nights,
      startDate: travelDate,
      endDate: travelDate,
      specificDates: [travelDate],
    });

    for (const offer of offers) {
      const airport = offer.ukDepartureAirport;
      const price = offer.pricePerPerson;

      if (!flightPrices[airport] || price < flightPrices[airport]) {
        flightPrices[airport] = price;
      }
    }
  }

  return flightPrices;
}

/**
 * Fetch hotels for multi-city itinerary
 *
 * Two modes:
 * 1. Specific hotel mode: Admin provides exact hotel code -> fetch that hotel's price
 * 2. Search mode: Admin provides star rating/criteria -> search and pick cheapest
 */
async function fetchHotelsForItinerary(
  cities: CityConfig[],
  startDate: string,
  roomType: "twin" | "single"
): Promise<{ success: boolean; hotels?: any[]; error?: string }> {

  const hotels: any[] = [];
  let nightsSoFar = 0;

  for (const city of cities) {
    const checkInDate = addDays(new Date(startDate), nightsSoFar);
    const checkOutDate = addDays(checkInDate, city.nights);

    let hotelOffers: any[] = [];

    // MODE 1: Specific hotel code provided (preferred)
    if (city.specificHotelCode) {
      console.log(`[FlightHotel] Fetching specific hotel: ${city.specificHotelCode} in ${city.cityName}`);

      hotelOffers = await searchHotels({
        destination: city.cityCode || city.cityName,
        checkIn: formatDateDDMMYYYY(checkInDate),
        checkOut: formatDateDDMMYYYY(checkOutDate),
        adults: roomType === "twin" ? 2 : 1,
        boardBasis: city.boardBasis,
        hotelCodes: [city.specificHotelCode], // Search for this specific hotel only
      });

      // Filter to exact match (in case API returns multiple)
      const exactMatch = hotelOffers.find(h => h.hotelCode === city.specificHotelCode);

      if (!exactMatch) {
        return {
          success: false,
          error: `Hotel ${city.specificHotelCode} not found in ${city.cityName} for these dates`
        };
      }

      hotels.push({
        cityName: city.cityName,
        hotelCode: exactMatch.hotelCode,
        hotelName: exactMatch.hotelName,
        starRating: exactMatch.starRating,
        boardBasis: exactMatch.boardBasis,
        checkIn: checkInDate.toISOString().split('T')[0],
        checkOut: checkOutDate.toISOString().split('T')[0],
        nights: city.nights,
        roomType: exactMatch.roomType,
        pricePerRoom: exactMatch.totalPrice,
        pricePerPerson: roomType === "twin" ? exactMatch.totalPrice / 2 : exactMatch.totalPrice,
      });

    }
    // MODE 2: Search by criteria and pick cheapest (fallback)
    else {
      console.log(`[FlightHotel] Searching hotels in ${city.cityName} by criteria (${city.starRating}-star, ${city.boardBasis})`);

      hotelOffers = await searchHotels({
        destination: city.cityCode || city.cityName,
        checkIn: formatDateDDMMYYYY(checkInDate),
        checkOut: formatDateDDMMYYYY(checkOutDate),
        adults: roomType === "twin" ? 2 : 1,
        starRating: city.starRating,
        boardBasis: city.boardBasis,
        hotelCodes: city.hotelCodes, // Optional: restrict to specific hotels
      });

      const cheapest = getCheapestHotel(hotelOffers);

      if (!cheapest) {
        return {
          success: false,
          error: `No hotels found for ${city.cityName}`
        };
      }

      hotels.push({
        cityName: city.cityName,
        hotelCode: cheapest.hotelCode,
        hotelName: cheapest.hotelName,
        starRating: cheapest.starRating,
        boardBasis: cheapest.boardBasis,
        checkIn: checkInDate.toISOString().split('T')[0],
        checkOut: checkOutDate.toISOString().split('T')[0],
        nights: city.nights,
        roomType: cheapest.roomType,
        pricePerRoom: cheapest.totalPrice,
        pricePerPerson: roomType === "twin" ? cheapest.totalPrice / 2 : cheapest.totalPrice,
      });
    }

    nightsSoFar += city.nights;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { success: true, hotels };
}

/**
 * Calculate final price with markup and smart rounding
 */
function calculateFinalPrice(
  flightPrice: number,
  hotels: any[],
  markupPercent: number
) {
  const hotelCostPerPerson = hotels.reduce((sum, h) => sum + h.pricePerPerson, 0);
  const subtotal = flightPrice + hotelCostPerPerson;
  const markupAmount = subtotal * (markupPercent / 100);
  const afterMarkup = subtotal + markupAmount;
  const finalPrice = smartRoundPrice(afterMarkup);

  return {
    hotelCostPerPerson,
    subtotal,
    markupAmount,
    afterMarkup,
    finalPrice,
  };
}

/**
 * Generate date range
 */
function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
