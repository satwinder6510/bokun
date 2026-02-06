/**
 * Static data for Sunshine API
 * This avoids XML parsing and slow API calls for relatively static data
 */

export interface StaticCountry {
  id: string;
  name: string;
}

export interface StaticResort {
  countryId: string;
  regionId: string;
  areaId: string;
  resortId: string;
  resortName: string;
}

// All countries from Sunshine API (fetched once)
export const SUNSHINE_COUNTRIES: StaticCountry[] = [
  { id: "1", name: "Spain" },
  { id: "2", name: "Portugal" },
  { id: "3", name: "Greece" },
  { id: "4", name: "Egypt" },
  { id: "5", name: "Tunisia" },
  { id: "6", name: "Cyprus" },
  { id: "7", name: "Malta" },
  { id: "8", name: "Turkey" },
  { id: "9", name: "Dominican Republic" },
  { id: "10", name: "Mexico" },
  { id: "11", name: "Morocco" },
  { id: "12", name: "Gibraltar" },
  { id: "13", name: "Cuba" },
  { id: "14", name: "United States Of America" },
  { id: "15", name: "Barbados" },
  { id: "16", name: "Italy" },
  { id: "18", name: "Sri Lanka" },
  { id: "19", name: "Bulgaria" },
  { id: "20", name: "Aruba (Netherlands Antilles)" },
  { id: "21", name: "Croatia" },
  { id: "22", name: "Antigua & Barbuda" },
  { id: "23", name: "Jamaica" },
  { id: "24", name: "Czech Republic" },
  { id: "25", name: "United Arab Emirates" },
  { id: "26", name: "France" },
  { id: "27", name: "Netherlands" },
  { id: "28", name: "Belgium" },
  { id: "29", name: "India" },
  { id: "30", name: "Maldives" },
  { id: "31", name: "Gambia" },
  { id: "32", name: "Thailand" },
  { id: "33", name: "Germany" },
  { id: "34", name: "Slovakia" },
  { id: "36", name: "Austria" },
  { id: "37", name: "Hungary" },
  { id: "38", name: "Ireland" },
  { id: "39", name: "Brazil" },
  { id: "40", name: "United Kingdom" },
  { id: "41", name: "Latvia" },
  { id: "42", name: "Australia" },
  { id: "43", name: "Estonia" },
  { id: "44", name: "Cape Verde" },
  { id: "45", name: "Montenegro" },
  { id: "47", name: "Switzerland" },
  { id: "48", name: "Slovenia" },
  { id: "50", name: "Kenya" },
  { id: "51", name: "Finland" },
  { id: "52", name: "Jordan" },
  { id: "55", name: "Seychelles, Republic Of" },
  { id: "57", name: "Romania" },
  { id: "59", name: "Iceland" },
  { id: "61", name: "St. Lucia" },
  { id: "62", name: "Puerto Rico" },
  { id: "63", name: "Panama" },
  { id: "64", name: "Indonesia" },
  { id: "66", name: "Argentina" },
  { id: "67", name: "Poland" },
  { id: "68", name: "Ecuador" },
  { id: "69", name: "Venezuela" },
  { id: "70", name: "Israel" },
  { id: "71", name: "Trinidad & Tobago" },
  { id: "72", name: "Denmark" },
  { id: "73", name: "South Africa" },
  { id: "74", name: "Kazakhstan" },
  { id: "75", name: "Peru" },
  { id: "77", name: "Mauritius" },
  { id: "78", name: "Costa Rica" },
  { id: "79", name: "Colombia" },
  { id: "81", name: "Great Britain" },
  { id: "82", name: "Canada" },
  { id: "83", name: "Russia" },
  { id: "84", name: "Russian Federation" },
  { id: "85", name: "China" },
  { id: "86", name: "Ukraine" },
  { id: "88", name: "Malaysia" },
  { id: "89", name: "Singapore" },
  { id: "90", name: "Sweden" },
  { id: "93", name: "Senegal" },
  { id: "94", name: "Bahamas" },
  { id: "95", name: "Oman" },
  { id: "96", name: "Norway" },
  { id: "97", name: "Ethiopia" },
  { id: "98", name: "Philippines" },
  { id: "99", name: "Lithuania" },
  { id: "100", name: "Vietnam" },
  { id: "101", name: "Qatar" },
  { id: "102", name: "Ghana" },
  { id: "103", name: "Nigeria" },
  { id: "104", name: "Luxembourg" },
  { id: "105", name: "Japan" },
  { id: "106", name: "Cambodia" },
  { id: "107", name: "Algeria" },
  { id: "109", name: "Taiwan, Province Of China" },
  { id: "110", name: "Saudi Arabia" },
  { id: "111", name: "Uruguay" },
  { id: "112", name: "Bahrain" },
  { id: "113", name: "Myanmar, Union Of" },
  { id: "114", name: "Namibia" },
  { id: "115", name: "Nepal" },
  { id: "116", name: "Afghanistan" },
  { id: "117", name: "Papua New Guinea" },
  { id: "119", name: "Guatemala" },
  { id: "120", name: "Greenland" },
  { id: "121", name: "Honduras" },
  { id: "122", name: "New Zealand" },
  { id: "123", name: "Belize" },
  { id: "124", name: "Lebanon" },
  { id: "125", name: "Pakistan" },
  { id: "126", name: "Sierra Leone" },
  { id: "127", name: "Andorra" },
  { id: "128", name: "Macedonia" },
  { id: "129", name: "Serbia" },
  { id: "130", name: "Albania" },
];

// Popular European resorts (can be expanded as needed)
// Format: { countryId, regionId, areaId, resortId, resortName }
export const SUNSHINE_RESORTS: StaticResort[] = [
  // Spain (ID: 1)
  { countryId: "1", regionId: "1", areaId: "1", resortId: "8", resortName: "Alcudia" },
  { countryId: "1", regionId: "1", areaId: "1", resortId: "57", resortName: "Palma Nova" },
  { countryId: "1", regionId: "1", areaId: "1", resortId: "1", resortName: "Magaluf" },

  // Portugal (ID: 2)
  { countryId: "2", regionId: "2", areaId: "4", resortId: "32", resortName: "Lisbon" },
  { countryId: "2", regionId: "2", areaId: "269", resortId: "4439", resortName: "Porto" },

  // Italy (ID: 16)
  { countryId: "16", regionId: "21", areaId: "54", resortId: "727", resortName: "Rome" },
  { countryId: "16", regionId: "21", areaId: "54", resortId: "732", resortName: "Sorrento" },
  { countryId: "16", regionId: "21", areaId: "54", resortId: "569", resortName: "Amalfi" },
  { countryId: "16", regionId: "21", areaId: "54", resortId: "721", resortName: "Positano" },
  { countryId: "16", regionId: "21", areaId: "54", resortId: "680", resortName: "Naples" },
  { countryId: "16", regionId: "22", areaId: "55", resortId: "774", resortName: "Venice" },
  { countryId: "16", regionId: "22", areaId: "55", resortId: "778", resortName: "Verona" },
  { countryId: "16", regionId: "22", areaId: "55", resortId: "1806", resortName: "Lake Garda" },
  { countryId: "16", regionId: "22", areaId: "55", resortId: "4892", resortName: "Lake Como" },
  { countryId: "16", regionId: "22", areaId: "55", resortId: "669", resortName: "Milan" },
  { countryId: "16", regionId: "23", areaId: "56", resortId: "591", resortName: "Florence" },
  { countryId: "16", regionId: "23", areaId: "56", resortId: "3321", resortName: "Bologna" },
  { countryId: "16", regionId: "22", areaId: "55", resortId: "3322", resortName: "Turin" },
  { countryId: "16", regionId: "24", areaId: "57", resortId: "573", resortName: "Catania" },
  { countryId: "16", regionId: "22", areaId: "261", resortId: "4253", resortName: "Genoa" },
  { countryId: "16", regionId: "24", areaId: "74", resortId: "691", resortName: "Palermo" },
  { countryId: "16", regionId: "24", areaId: "57", resortId: "5421", resortName: "Syracuse" },

  // France (ID: 26)
  { countryId: "26", regionId: "20", areaId: "63", resortId: "439", resortName: "Paris" },
  { countryId: "26", regionId: "20", areaId: "230", resortId: "3717", resortName: "Nice" },

  // Hungary (ID: 37)
  { countryId: "37", regionId: "29", areaId: "99", resortId: "558", resortName: "Budapest" },

  // Slovakia (ID: 34)
  { countryId: "34", regionId: "27", areaId: "92", resortId: "505", resortName: "Bratislava" },

  // Czech Republic (ID: 24)
  { countryId: "24", regionId: "19", areaId: "70", resortId: "440", resortName: "Prague" },

  // Estonia (ID: 43)
  { countryId: "43", regionId: "32", areaId: "149", resortId: "762", resortName: "Tallinn" },
];
