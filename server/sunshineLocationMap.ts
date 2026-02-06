/**
 * Sunshine API Location Mappings
 * Maps city/resort names to country/region/area/resort IDs
 * Add destinations as needed
 */

export interface SunshineLocation {
  countryId: string;
  regionId: string;
  areaId: string;
  resortId: string;
  resortName: string;
}

/**
 * Location mapping - European destinations only
 * Key = search term (city/resort name that admin will type)
 * Value = IDs needed for Sunshine API
 *
 * To add more destinations:
 * 1. Get country ID: http://87.102.127.86:8119/Search/SearchOffers.dll?agtid=122&page=country
 * 2. Get region/area/resort IDs: http://87.102.127.86:8119/Search/SearchOffers.dll?agtid=122&page=resort&countryid=X
 */
export const SUNSHINE_LOCATIONS: Record<string, SunshineLocation> = {
  // Spain
  "barcelona": {
    countryId: "2",
    regionId: "1",
    areaId: "1",
    resortId: "1",
    resortName: "Barcelona"
  },
  "madrid": {
    countryId: "2",
    regionId: "2",
    areaId: "1",
    resortId: "1",
    resortName: "Madrid"
  },

  // Italy
  "rome": {
    countryId: "3",
    regionId: "1",
    areaId: "1",
    resortId: "1",
    resortName: "Rome"
  },
  "venice": {
    countryId: "3",
    regionId: "2",
    areaId: "1",
    resortId: "1",
    resortName: "Venice"
  },
  "florence": {
    countryId: "3",
    regionId: "3",
    areaId: "1",
    resortId: "1",
    resortName: "Florence"
  },

  // France
  "paris": {
    countryId: "4",
    regionId: "1",
    areaId: "1",
    resortId: "1",
    resortName: "Paris"
  },

  // Greece
  "athens": {
    countryId: "5",
    regionId: "1",
    areaId: "1",
    resortId: "1",
    resortName: "Athens"
  },

  // Portugal
  "lisbon": {
    countryId: "6",
    regionId: "1",
    areaId: "1",
    resortId: "1",
    resortName: "Lisbon"
  },

  // TODO: Update these IDs with actual values from Sunshine API
  // The IDs above are placeholders - you need to fetch the real ones from:
  // http://87.102.127.86:8119/Search/SearchOffers.dll?agtid=122&page=country
  // Then for each country:
  // http://87.102.127.86:8119/Search/SearchOffers.dll?agtid=122&page=resort&countryid=X
};

/**
 * Search for a location by name (case-insensitive, partial match)
 */
export function findLocation(searchTerm: string): SunshineLocation | null {
  const term = searchTerm.toLowerCase().trim();

  // Exact match first
  if (SUNSHINE_LOCATIONS[term]) {
    return SUNSHINE_LOCATIONS[term];
  }

  // Partial match
  for (const [key, location] of Object.entries(SUNSHINE_LOCATIONS)) {
    if (key.includes(term) || term.includes(key)) {
      return location;
    }
  }

  return null;
}

/**
 * Get all available locations (for autocomplete)
 */
export function getAllLocations(): Array<{ name: string; location: SunshineLocation }> {
  return Object.entries(SUNSHINE_LOCATIONS).map(([name, location]) => ({
    name: location.resortName,
    location
  }));
}
