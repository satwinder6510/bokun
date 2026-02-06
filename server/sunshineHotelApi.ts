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
  const url = `${SUNSHINE_API_BASE}?agtid=${AGENT_ID}&page=country&output=JSON`;

  console.log("[SunshineHotel] Fetching countries from:", url);

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("[SunshineHotel] Received response:", JSON.stringify(data).substring(0, 200));

    // Check for error
    if (data.Error) {
      console.error("[SunshineHotel] API Error:", data.Error);
      throw new Error(`Sunshine API error: ${data.Error}`);
    }

    const countries: SunshineCountry[] = [];
    const countryData = data.Countries?.Country;

    if (!countryData) {
      console.log("[SunshineHotel] No countries found in response");
      return [];
    }

    const countryArray = Array.isArray(countryData) ? countryData : [countryData];

    for (const country of countryArray) {
      countries.push({
        id: country.Id || country.id,
        name: (country.Name || country.name || '').replace(/\+/g, ' '),
      });
    }

    console.log(`[SunshineHotel] Found ${countries.length} countries`);
    return countries;

  } catch (error: any) {
    console.error("[SunshineHotel] Error fetching countries:", error.message);
    console.error("[SunshineHotel] Stack:", error.stack);
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
  const url = `${SUNSHINE_API_BASE}?agtid=${AGENT_ID}&page=resort&countryid=${countryId}&output=JSON`;

  console.log(`[SunshineHotel] Fetching destinations for country ${countryId} from:`, url);

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log(`[SunshineHotel] Received response:`, JSON.stringify(data).substring(0, 200));

    // Check for error
    if (data.Error) {
      console.error("[SunshineHotel] API Error:", data.Error);
      throw new Error(`Sunshine API error: ${data.Error}`);
    }

    const resorts: SunshineResort[] = [];
    const hotels: SunshineHotel[] = [];

    const regions = data.Regions?.Region;
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
            countryId: region.CountryId || region.countryid,
            countryName: (region.CountryName || region.countryname || '').replace(/\+/g, ' '),
            regionId: region.RegionId || region.regionid,
            regionName: (region.RegionName || region.regionname || '').replace(/\+/g, ' '),
            areaId: area.AreaId || area.areaid,
            areaName: (area.AreaName || area.areaname || '').replace(/\+/g, ' '),
            resortId: resort.ResortId || resort.resortid,
            resortName: (resort.ResortName || resort.resortname || '').replace(/\+/g, ' '),
          });

          // Extract hotels from this resort
          const hotelData = resort.Hotel;
          if (hotelData) {
            const hotelArray = Array.isArray(hotelData) ? hotelData : [hotelData];

            for (const hotel of hotelArray) {
              hotels.push({
                id: hotel.HotelId || hotel.hotelid,
                name: (hotel.HotelName || hotel.hotelname || '').replace(/\+/g, ' '),
                countryId: region.CountryId || region.countryid,
                regionId: region.RegionId || region.regionid,
                areaId: area.AreaId || area.areaid,
                resortId: resort.ResortId || resort.resortid,
                resortName: (resort.ResortName || resort.resortname || '').replace(/\+/g, ' '),
                starRating: hotel.StarRating || hotel.starrating || '0',
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
  url.searchParams.set("output", "JSON");

  console.log(`[SunshineHotel] Searching hotels: ${url.toString()}`);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    // Check for errors
    if (data.Error) {
      console.error(`[SunshineHotel] API Error: ${data.Error}`);

      if (data.Error.includes("IP Address Does Not Match")) {
        throw new Error("Sunshine API access denied: Server IP not whitelisted");
      }
      throw new Error(`Sunshine API error: ${data.Error}`);
    }

    const hotels: HotelSearchResult[] = [];
    const hotelData = data.Hotels?.Hotel;

    if (!hotelData) {
      console.log("[SunshineHotel] No hotels found");
      return [];
    }

    const hotelArray = Array.isArray(hotelData) ? hotelData : [hotelData];

    for (const hotel of hotelArray) {
      hotels.push({
        refNum: hotel.RefNum || hotel.refnum,
        hotelSupplier: (hotel.HtlSupp || hotel.htlsupp || '').replace(/\+/g, ' '),
        hotelName: (hotel.HtlName || hotel.htlname || '').replace(/\+/g, ' '),
        resort: (hotel.Resort || hotel.resort || '').replace(/\+/g, ' '),
        checkInDate: hotel.CheckInDate || hotel.checkindate,
        stay: hotel.Stay || hotel.stay,
        roomType: (hotel.RoomType || hotel.roomtype || '').replace(/\+/g, ' '),
        boardBasis: hotel.BoardBasis || hotel.boardbasis,
        starRating: hotel.StarRating || hotel.starrating,
        pricePerPerson: parseFloat(hotel.HtlNetPP || hotel.htlnetpp || hotel.HtlSellPP || hotel.htlsellpp || '0'),
        hotelId: hotel.SuppHotelId || hotel.supphotelid || hotel.KwikId || hotel.kwikid || '',
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
