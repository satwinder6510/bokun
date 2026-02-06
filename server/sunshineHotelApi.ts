/**
 * Sunshine Hotel API Integration (Correct Implementation)
 * Based on searchoffers.dll with country/region/area/resort structure
 */

import fetch from "node-fetch";
import xml2js from "xml2js";

const SUNSHINE_API_BASE = "http://87.102.127.86:8119/Search/SearchOffers.dll";
const AGENT_ID = "122";

export interface SunshineCountry {
  id: string;
  name: string;
}

export interface SunshineResort {
  countryId: string;
  countryName: string;
  regionId: string;
  regionName: string;
  areaId: string;
  areaName: string;
  resortId: string;
  resortName: string;
}

export interface SunshineHotel {
  id: string;
  name: string;
  countryId: string;
  regionId: string;
  areaId: string;
  resortId: string;
  resortName: string;
  starRating: string;
}

export interface HotelSearchResult {
  refNum: string;
  hotelSupplier: string;
  hotelName: string;
  resort: string;
  checkInDate: string;
  stay: string;
  roomType: string;
  boardBasis: string;
  starRating: string;
  pricePerPerson: number;
  hotelId: string;
}

/**
 * Get list of all countries
 */
export async function getSunshineCountries(): Promise<SunshineCountry[]> {
  const url = `${SUNSHINE_API_BASE}?agtid=${AGENT_ID}&page=country&output=XML`;

  console.log("[SunshineHotel] Fetching countries...");

  try {
    const response = await fetch(url);
    const xmlText = await response.text();
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlText);

    const countries: SunshineCountry[] = [];
    const countryData = result.Countries?.Country;

    if (!countryData) {
      console.log("[SunshineHotel] No countries found");
      return [];
    }

    const countryArray = Array.isArray(countryData) ? countryData : [countryData];

    for (const country of countryArray) {
      countries.push({
        id: country.$.id,
        name: country.$.name.replace(/\+/g, ' '),
      });
    }

    console.log(`[SunshineHotel] Found ${countries.length} countries`);
    return countries;

  } catch (error: any) {
    console.error("[SunshineHotel] Error fetching countries:", error.message);
    throw error;
  }
}

/**
 * Get destinations and hotels for a specific country
 */
export async function getSunshineDestinations(countryId: string): Promise<{
  resorts: SunshineResort[];
  hotels: SunshineHotel[];
}> {
  const url = `${SUNSHINE_API_BASE}?agtid=${AGENT_ID}&page=resort&countryid=${countryId}&output=XML`;

  console.log(`[SunshineHotel] Fetching destinations for country ${countryId}...`);

  try {
    const response = await fetch(url);
    const xmlText = await response.text();
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlText);

    const resorts: SunshineResort[] = [];
    const hotels: SunshineHotel[] = [];

    const regions = result.Regions?.Region;
    if (!regions) {
      return { resorts, hotels };
    }

    const regionArray = Array.isArray(regions) ? regions : [regions];

    for (const region of regionArray) {
      const areas = region.Area;
      const areaArray = Array.isArray(areas) ? areas : [areas];

      for (const area of areaArray) {
        const resortData = area.Resort;
        const resortArray = Array.isArray(resortData) ? resortData : [resortData];

        for (const resort of resortArray) {
          resorts.push({
            countryId: region.$.countryid,
            countryName: region.$.countryname?.replace(/\+/g, ' ') || '',
            regionId: region.$.regionid,
            regionName: region.$.regionname?.replace(/\+/g, ' ') || '',
            areaId: area.$.areaid,
            areaName: area.$.areaname?.replace(/\+/g, ' ') || '',
            resortId: resort.$.resortid,
            resortName: resort.$.resortname?.replace(/\+/g, ' ') || '',
          });

          // Extract hotels from this resort
          const hotelData = resort.Hotel;
          if (hotelData) {
            const hotelArray = Array.isArray(hotelData) ? hotelData : [hotelData];

            for (const hotel of hotelArray) {
              hotels.push({
                id: hotel.$.hotelid,
                name: hotel.$.hotelname?.replace(/\+/g, ' ') || '',
                countryId: region.$.countryid,
                regionId: region.$.regionid,
                areaId: area.$.areaid,
                resortId: resort.$.resortid,
                resortName: resort.$.resortname?.replace(/\+/g, ' ') || '',
                starRating: hotel.$.starrating || '0',
              });
            }
          }
        }
      }
    }

    console.log(`[SunshineHotel] Found ${resorts.length} resorts and ${hotels.length} hotels`);
    return { resorts, hotels };

  } catch (error: any) {
    console.error("[SunshineHotel] Error fetching destinations:", error.message);
    throw error;
  }
}

/**
 * Search for hotel availability
 */
export async function searchSunshineHotels(params: {
  countryId: string;
  regionId: string;
  areaId: string;
  resortId: string;
  depDate: string;      // DD/MM/YYYY
  duration: number;     // nights
  adults: number;
  children?: number;
  boardBasis?: string;  // e.g., "BB|HB" or empty for all
  starRating?: string;  // e.g., "4|5" or empty for all
  hotelId?: string;     // specific hotel ID or "0" for all
}): Promise<HotelSearchResult[]> {

  const url = new URL(SUNSHINE_API_BASE);
  url.searchParams.set("agtid", AGENT_ID);
  url.searchParams.set("page", "HTLSEARCH");
  url.searchParams.set("platform", "WEB");
  url.searchParams.set("countryid", params.countryId);
  url.searchParams.set("regionid", params.regionId);
  url.searchParams.set("areaid", params.areaId);
  url.searchParams.set("resortid", params.resortId);
  url.searchParams.set("depdate", params.depDate);
  url.searchParams.set("flex", "0");
  url.searchParams.set("board", params.boardBasis || "");
  url.searchParams.set("star", params.starRating || "");
  url.searchParams.set("adults", params.adults.toString());
  url.searchParams.set("children", (params.children || 0).toString());
  url.searchParams.set("duration", params.duration.toString());
  url.searchParams.set("hotelid", params.hotelId || "0");
  url.searchParams.set("output", "XML");

  console.log(`[SunshineHotel] Searching hotels: ${url.toString()}`);

  try {
    const response = await fetch(url.toString());
    const xmlText = await response.text();

    // Check for XML errors
    if (xmlText.includes("<Error>")) {
      const errorMatch = xmlText.match(/<Error>(.*?)<\/Error>/i);
      const errorMessage = errorMatch ? errorMatch[1] : "Unknown error";
      console.error(`[SunshineHotel] API Error: ${errorMessage}`);

      if (errorMessage.includes("IP Address Does Not Match")) {
        throw new Error("Sunshine API access denied: Server IP not whitelisted");
      }
      throw new Error(`Sunshine API error: ${errorMessage}`);
    }

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlText);

    const hotels: HotelSearchResult[] = [];
    const hotelData = result.Hotels?.Hotel;

    if (!hotelData) {
      console.log("[SunshineHotel] No hotels found");
      return [];
    }

    const hotelArray = Array.isArray(hotelData) ? hotelData : [hotelData];

    for (const hotel of hotelArray) {
      hotels.push({
        refNum: hotel.$.refnum,
        hotelSupplier: hotel.$.htlsupp?.replace(/\+/g, ' ') || '',
        hotelName: hotel.$.htlname?.replace(/\+/g, ' ') || '',
        resort: hotel.$.resort?.replace(/\+/g, ' ') || '',
        checkInDate: hotel.$.checkindate,
        stay: hotel.$.stay,
        roomType: hotel.$.roomtype?.replace(/\+/g, ' ') || '',
        boardBasis: hotel.$.boardbasis,
        starRating: hotel.$.starrating,
        pricePerPerson: parseFloat(hotel.$.htlnetpp || hotel.$.htlsellpp || '0'),
        hotelId: hotel.$.supphotelid || hotel.$.kwikid || '',
      });
    }

    console.log(`[SunshineHotel] Found ${hotels.length} hotel offers`);
    return hotels;

  } catch (error: any) {
    console.error("[SunshineHotel] Search error:", error.message);
    throw error;
  }
}

/**
 * Simple hotel search by name (searches across all stored hotels)
 * This is a helper for the admin UI autocomplete
 */
export async function searchHotelsByName(searchTerm: string, hotels: SunshineHotel[]): Promise<SunshineHotel[]> {
  const term = searchTerm.toLowerCase();
  return hotels.filter(h =>
    h.name.toLowerCase().includes(term) ||
    h.resortName.toLowerCase().includes(term)
  );
}
