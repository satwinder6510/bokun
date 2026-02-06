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
  // Spain (Country ID: 1)
  "alcudia": {
    countryId: "1",
    regionId: "1",
    areaId: "1",
    resortId: "1",
    resortName: "Alcudia"
  },
  "palma nova": {
    countryId: "1",
    regionId: "1",
    areaId: "1",
    resortId: "2",
    resortName: "Palma Nova"
  },
  "magaluf": {
    countryId: "1",
    regionId: "1",
    areaId: "1",
    resortId: "5",
    resortName: "Magaluf"
  },

  // Italy (Country ID: 16)
  "rome": {
    countryId: "16",
    regionId: "21",
    areaId: "54",
    resortId: "727",
    resortName: "Rome"
  },
  "sorrento": {
    countryId: "16",
    regionId: "21",
    areaId: "54",
    resortId: "336",
    resortName: "Sorrento"
  },
  "amalfi": {
    countryId: "16",
    regionId: "21",
    areaId: "54",
    resortId: "363",
    resortName: "Amalfi"
  },
  "positano": {
    countryId: "16",
    regionId: "21",
    areaId: "54",
    resortId: "365",
    resortName: "Positano"
  },
  "naples": {
    countryId: "16",
    regionId: "21",
    areaId: "54",
    resortId: "680",
    resortName: "Naples"
  },

  // France (Country ID: 26)
  "paris": {
    countryId: "26",
    regionId: "0",
    areaId: "0",
    resortId: "693",
    resortName: "Paris"
  },
  "nice": {
    countryId: "26",
    regionId: "0",
    areaId: "0",
    resortId: "682",
    resortName: "Nice"
  },

  // Portugal (Country ID: 2)
  // Greece (Country ID: 3)
  // Add more destinations as needed by looking up from Sunshine API
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
