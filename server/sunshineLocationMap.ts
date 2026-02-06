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
  "venice": {
    countryId: "16",
    regionId: "22",
    areaId: "55",
    resortId: "774",
    resortName: "Venice"
  },
  "verona": {
    countryId: "16",
    regionId: "22",
    areaId: "55",
    resortId: "778",
    resortName: "Verona"
  },
  "lake garda": {
    countryId: "16",
    regionId: "22",
    areaId: "55",
    resortId: "1806",
    resortName: "Lake Garda"
  },
  "lake como": {
    countryId: "16",
    regionId: "22",
    areaId: "55",
    resortId: "4892",
    resortName: "Lake Como"
  },
  "milan": {
    countryId: "16",
    regionId: "22",
    areaId: "55",
    resortId: "669",
    resortName: "Milan"
  },
  "florence": {
    countryId: "16",
    regionId: "23",
    areaId: "56",
    resortId: "591",
    resortName: "Florence"
  },
  "bologna": {
    countryId: "16",
    regionId: "23",
    areaId: "56",
    resortId: "3321",
    resortName: "Bologna"
  },
  "turin": {
    countryId: "16",
    regionId: "22",
    areaId: "55",
    resortId: "3322",
    resortName: "Turin"
  },
  "catania": {
    countryId: "16",
    regionId: "24",
    areaId: "57",
    resortId: "573",
    resortName: "Catania"
  },
  "genoa": {
    countryId: "16",
    regionId: "22",
    areaId: "261",
    resortId: "4253",
    resortName: "Genoa"
  },
  "palermo": {
    countryId: "16",
    regionId: "24",
    areaId: "74",
    resortId: "691",
    resortName: "Palermo"
  },
  "syracuse": {
    countryId: "16",
    regionId: "24",
    areaId: "57",
    resortId: "5421",
    resortName: "Syracuse"
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
  "lisbon": {
    countryId: "2",
    regionId: "5",
    areaId: "71",
    resortId: "441",
    resortName: "Lisbon"
  },
  "porto": {
    countryId: "2",
    regionId: "5",
    areaId: "48",
    resortId: "712",
    resortName: "Porto"
  },

  // Hungary (Country ID: 37)
  "budapest": {
    countryId: "37",
    regionId: "29",
    areaId: "99",
    resortId: "558",
    resortName: "Budapest"
  },

  // Slovakia (Country ID: 34)
  "bratislava": {
    countryId: "34",
    regionId: "27",
    areaId: "92",
    resortId: "505",
    resortName: "Bratislava"
  },

  // Czech Republic (Country ID: 24)
  "prague": {
    countryId: "24",
    regionId: "19",
    areaId: "70",
    resortId: "440",
    resortName: "Prague"
  },

  // Estonia (Country ID: 43)
  "tallinn": {
    countryId: "43",
    regionId: "32",
    areaId: "149",
    resortId: "762",
    resortName: "Tallinn"
  },

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
