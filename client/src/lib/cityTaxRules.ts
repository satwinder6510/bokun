// lib/cityTaxRules.ts

export type Money = {
  currency: "EUR" | "GBP" | "USD" | "AED" | "JPY" | "CZK" | "CHF";
  amount: number;
};

export type TaxBasis =
  | "per_person_per_night"
  | "per_room_per_night"
  | "percent_of_room_rate"
  | "mixed";

export type TaxRule = {
  city: string;
  countryCode: string;
  payableLocally: true;
  basis: TaxBasis;
  fixed?: Money;
  range?: { min: Money; max: Money };
  percent?: { rate: number; cap?: Money; appliesTo?: "net_room_rate" | "room_rate" };
  byHotelStars?: Record<"1" | "2" | "3" | "4" | "5", Money>;
  notes?: string;
  capNights?: number;
  exemptions?: string[];
};

const LOCAL_CITY_TAX_TABLE: Record<string, TaxRule> = {
  // ===== AUSTRIA =====
  "AT_VIENNA": {
    city: "Vienna",
    countryCode: "AT",
    payableLocally: true,
    basis: "percent_of_room_rate",
    percent: { rate: 5, appliesTo: "net_room_rate" },
    notes: "Local accommodation tax. Rate depends on room price.",
  },
  "AT_SALZBURG": {
    city: "Salzburg",
    countryCode: "AT",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 1.75 },
    notes: "Local levy per adult per night.",
  },
  "AT_INNSBRUCK": {
    city: "Innsbruck",
    countryCode: "AT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 2 },
      max: { currency: "EUR", amount: 3 },
    },
    notes: "Varies by district.",
  },

  // ===== ITALY =====
  "IT_VENICE": {
    city: "Venice",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 1 },
      max: { currency: "EUR", amount: 5 },
    },
    notes: "Varies by season and accommodation category. Separate from Venice day-tripper Access Fee.",
  },
  "IT_FLORENCE": {
    city: "Florence",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    byHotelStars: {
      "1": { currency: "EUR", amount: 3.5 },
      "2": { currency: "EUR", amount: 4.5 },
      "3": { currency: "EUR", amount: 6.0 },
      "4": { currency: "EUR", amount: 7.0 },
      "5": { currency: "EUR", amount: 8.0 },
    },
    capNights: 7,
    notes: "Rates depend on official accommodation category.",
  },
  "IT_ROME": {
    city: "Rome",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    byHotelStars: {
      "1": { currency: "EUR", amount: 4.0 },
      "2": { currency: "EUR", amount: 5.0 },
      "3": { currency: "EUR", amount: 6.0 },
      "4": { currency: "EUR", amount: 7.5 },
      "5": { currency: "EUR", amount: 10.0 },
    },
    capNights: 10,
    notes: "Rates vary by category/type.",
  },
  "IT_MILAN": {
    city: "Milan",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 2 },
      max: { currency: "EUR", amount: 5 },
    },
    notes: "Varies by hotel category.",
  },
  "IT_NAPLES": {
    city: "Naples",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 1.5 },
      max: { currency: "EUR", amount: 5 },
    },
  },
  "IT_BOLOGNA": {
    city: "Bologna",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 3 },
      max: { currency: "EUR", amount: 5 },
    },
  },
  "IT_TURIN": {
    city: "Turin",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 2.3 },
      max: { currency: "EUR", amount: 5 },
    },
    notes: "Varies by hotel category.",
  },
  "IT_SORRENTO": {
    city: "Sorrento",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 2 },
      max: { currency: "EUR", amount: 5 },
    },
    capNights: 7,
    notes: "Varies by accommodation category.",
  },
  "IT_PALERMO": {
    city: "Palermo",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 1.5 },
      max: { currency: "EUR", amount: 3.0 },
    },
    capNights: 4,
    notes: "Commonly capped after 4 nights.",
  },
  "IT_CATANIA": {
    city: "Catania",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    byHotelStars: {
      "1": { currency: "EUR", amount: 2.0 },
      "2": { currency: "EUR", amount: 2.0 },
      "3": { currency: "EUR", amount: 2.5 },
      "4": { currency: "EUR", amount: 3.5 },
      "5": { currency: "EUR", amount: 5.0 },
    },
    capNights: 4,
    notes: "Tariff depends on property category.",
  },
  "IT_SYRACUSE": {
    city: "Syracuse",
    countryCode: "IT",
    payableLocally: true,
    basis: "percent_of_room_rate",
    percent: {
      rate: 4,
      cap: { currency: "EUR", amount: 5 },
      appliesTo: "net_room_rate",
    },
    capNights: 7,
    notes: "4% of room price capped at €5 pp/pn.",
  },
  "IT_VERONA": {
    city: "Verona",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 2.0 },
      max: { currency: "EUR", amount: 5.0 },
    },
    capNights: 5,
    notes: "Varies by accommodation type/category.",
  },
  "IT_LAKE_GARDA": {
    city: "Lake Garda",
    countryCode: "IT",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 1.0 },
      max: { currency: "EUR", amount: 4.2 },
    },
    capNights: 7,
    notes: "Each municipality sets its own tariff.",
  },

  // ===== PORTUGAL =====
  "PT_LISBON": {
    city: "Lisbon",
    countryCode: "PT",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 4 },
    capNights: 7,
    exemptions: ["Children under 13"],
  },
  "PT_PORTO": {
    city: "Porto",
    countryCode: "PT",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 3 },
    capNights: 7,
  },
  "PT_FUNCHAL": {
    city: "Funchal (Madeira)",
    countryCode: "PT",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 2 },
    capNights: 7,
  },
  "PT_PONTA_DELGADA": {
    city: "Ponta Delgada (Azores)",
    countryCode: "PT",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 2 },
  },
  "PT_ALGARVE": {
    city: "Algarve",
    countryCode: "PT",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 2 },
    notes: "Season dependent; applies to Albufeira, Lagos, Portimão.",
  },

  // ===== SPAIN =====
  "ES_BARCELONA": {
    city: "Barcelona",
    countryCode: "ES",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 1.7 },
      max: { currency: "EUR", amount: 4 },
    },
    notes: "Hotel category + municipal surcharge.",
  },
  "ES_CATALONIA": {
    city: "Girona, Tarragona, Lleida",
    countryCode: "ES",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 0.5 },
      max: { currency: "EUR", amount: 2.5 },
    },
    notes: "Catalonia standard rates.",
  },
  "ES_BALEARIC": {
    city: "Balearic Islands",
    countryCode: "ES",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 1 },
      max: { currency: "EUR", amount: 4 },
    },
    notes: "Mallorca, Ibiza, Menorca; seasonal + hotel class.",
  },

  // ===== NETHERLANDS =====
  "NL_AMSTERDAM": {
    city: "Amsterdam",
    countryCode: "NL",
    payableLocally: true,
    basis: "percent_of_room_rate",
    percent: { rate: 12.5, appliesTo: "net_room_rate" },
    notes: "2024–2026 rate.",
  },
  "NL_ROTTERDAM": {
    city: "Rotterdam",
    countryCode: "NL",
    payableLocally: true,
    basis: "percent_of_room_rate",
    percent: { rate: 6.5, appliesTo: "net_room_rate" },
  },
  "NL_THE_HAGUE": {
    city: "The Hague",
    countryCode: "NL",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 5.35 },
  },

  // ===== GERMANY =====
  "DE_BERLIN": {
    city: "Berlin",
    countryCode: "DE",
    payableLocally: true,
    basis: "percent_of_room_rate",
    percent: { rate: 5, appliesTo: "room_rate" },
    notes: "City Tax.",
  },
  "DE_HAMBURG": {
    city: "Hamburg",
    countryCode: "DE",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 0.5 },
      max: { currency: "EUR", amount: 4 },
    },
    notes: "Tiered by room price.",
  },
  "DE_COLOGNE": {
    city: "Cologne",
    countryCode: "DE",
    payableLocally: true,
    basis: "percent_of_room_rate",
    percent: { rate: 5, appliesTo: "room_rate" },
  },
  "DE_FRANKFURT": {
    city: "Frankfurt",
    countryCode: "DE",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 2 },
  },

  // ===== CZECHIA =====
  "CZ_PRAGUE": {
    city: "Prague",
    countryCode: "CZ",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "CZK", amount: 50 },
    notes: "≈ €2",
  },

  // ===== CROATIA =====
  "HR_DUBROVNIK": {
    city: "Dubrovnik",
    countryCode: "HR",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "EUR", amount: 2 },
    notes: "Peak season rate.",
  },
  "HR_SPLIT": {
    city: "Split",
    countryCode: "HR",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 1.5 },
      max: { currency: "EUR", amount: 2 },
    },
  },

  // ===== SWITZERLAND =====
  "CH_ZURICH": {
    city: "Zurich",
    countryCode: "CH",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "CHF", amount: 2.5 },
  },
  "CH_LUCERNE": {
    city: "Lucerne",
    countryCode: "CH",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "CHF", amount: 4 },
  },
  "CH_ZERMATT": {
    city: "Zermatt",
    countryCode: "CH",
    payableLocally: true,
    basis: "per_person_per_night",
    fixed: { currency: "CHF", amount: 4 },
  },

  // ===== GREECE =====
  "GR_GENERAL": {
    city: "Athens, Santorini, Mykonos, Rhodes",
    countryCode: "GR",
    payableLocally: true,
    basis: "per_room_per_night",
    range: {
      min: { currency: "EUR", amount: 1.5 },
      max: { currency: "EUR", amount: 10 },
    },
    notes: "Climate resilience fee; depends on hotel class & season. Per room, not per person.",
  },

  // ===== BELGIUM =====
  "BE_BRUSSELS": {
    city: "Brussels",
    countryCode: "BE",
    payableLocally: true,
    basis: "per_room_per_night",
    range: {
      min: { currency: "EUR", amount: 4 },
      max: { currency: "EUR", amount: 9 },
    },
  },
  "BE_BRUGES": {
    city: "Bruges",
    countryCode: "BE",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "EUR", amount: 3 },
      max: { currency: "EUR", amount: 4 },
    },
  },

  // ===== UAE =====
  "AE_DUBAI": {
    city: "Dubai",
    countryCode: "AE",
    payableLocally: true,
    basis: "per_room_per_night",
    range: {
      min: { currency: "AED", amount: 7 },
      max: { currency: "AED", amount: 20 },
    },
    capNights: 30,
    notes: "Tourism Dirham fee; depends on hotel category.",
  },

  // ===== USA =====
  "US_NEW_YORK": {
    city: "New York City",
    countryCode: "US",
    payableLocally: true,
    basis: "mixed",
    percent: { rate: 14.75, appliesTo: "room_rate" },
    notes: "Occupancy tax + fixed nightly government fees.",
  },

  // ===== JAPAN =====
  "JP_TOKYO": {
    city: "Tokyo",
    countryCode: "JP",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "JPY", amount: 100 },
      max: { currency: "JPY", amount: 200 },
    },
    notes: "Varies by nightly rate bracket.",
  },
  "JP_KYOTO": {
    city: "Kyoto",
    countryCode: "JP",
    payableLocally: true,
    basis: "per_person_per_night",
    range: {
      min: { currency: "JPY", amount: 200 },
      max: { currency: "JPY", amount: 1000 },
    },
    notes: "Varies by nightly rate bracket.",
  },
};

// Country code to name mapping
const COUNTRY_NAMES: Record<string, { name: string; flag: string }> = {
  "AT": { name: "Austria", flag: "🇦🇹" },
  "IT": { name: "Italy", flag: "🇮🇹" },
  "PT": { name: "Portugal", flag: "🇵🇹" },
  "ES": { name: "Spain", flag: "🇪🇸" },
  "NL": { name: "Netherlands", flag: "🇳🇱" },
  "DE": { name: "Germany", flag: "🇩🇪" },
  "CZ": { name: "Czechia", flag: "🇨🇿" },
  "HR": { name: "Croatia", flag: "🇭🇷" },
  "CH": { name: "Switzerland", flag: "🇨🇭" },
  "GR": { name: "Greece", flag: "🇬🇷" },
  "BE": { name: "Belgium", flag: "🇧🇪" },
  "AE": { name: "UAE", flag: "🇦🇪" },
  "US": { name: "USA", flag: "🇺🇸" },
  "JP": { name: "Japan", flag: "🇯🇵" },
  "FR": { name: "France", flag: "🇫🇷" },
  "GB": { name: "United Kingdom", flag: "🇬🇧" },
};

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "Austria": "AT",
  "Italy": "IT",
  "Portugal": "PT",
  "Netherlands": "NL",
  "Germany": "DE",
  "Spain": "ES",
  "France": "FR",
  "Greece": "GR",
  "Switzerland": "CH",
  "Belgium": "BE",
  "Croatia": "HR",
  "Czechia": "CZ",
  "Czech Republic": "CZ",
  "UAE": "AE",
  "United Arab Emirates": "AE",
  "Dubai": "AE",
  "USA": "US",
  "United States": "US",
  "Japan": "JP",
  "United Kingdom": "GB",
  "UK": "GB",
};

// Format money for display
function formatMoney(money: Money): string {
  const symbols: Record<string, string> = {
    EUR: "€",
    GBP: "£",
    USD: "$",
    AED: "AED ",
    JPY: "¥",
    CZK: "CZK ",
    CHF: "CHF ",
  };
  return `${symbols[money.currency] || ""}${money.amount}`;
}

// Format the charge string for display
function formatCharge(rule: TaxRule): string {
  if (rule.fixed) {
    return formatMoney(rule.fixed);
  }
  if (rule.range) {
    return `${formatMoney(rule.range.min)}–${formatMoney(rule.range.max)}`;
  }
  if (rule.percent) {
    return `${rule.percent.rate}%`;
  }
  if (rule.byHotelStars) {
    const min = Math.min(...Object.values(rule.byHotelStars).map(m => m.amount));
    const max = Math.max(...Object.values(rule.byHotelStars).map(m => m.amount));
    const currency = Object.values(rule.byHotelStars)[0].currency;
    return `${formatMoney({ currency, amount: min })}–${formatMoney({ currency, amount: max })}`;
  }
  return "Varies";
}

// Format basis for display
function formatBasis(basis: TaxBasis): string {
  switch (basis) {
    case "per_person_per_night": return "pp/pn";
    case "per_room_per_night": return "per room/night";
    case "percent_of_room_rate": return "of room rate";
    case "mixed": return "mixed";
    default: return "";
  }
}

// Get tax rules for a country
export function getTaxRulesForCountry(countryCode: string): TaxRule[] {
  const code = countryCode.length === 2 
    ? countryCode.toUpperCase() 
    : (COUNTRY_NAME_ALIASES[countryCode] || countryCode).toUpperCase();
  
  return Object.values(LOCAL_CITY_TAX_TABLE).filter(rule => rule.countryCode === code);
}

// Get country info
export function getCountryInfo(countryCode: string): { name: string; flag: string } | null {
  const code = countryCode.length === 2 
    ? countryCode.toUpperCase() 
    : (COUNTRY_NAME_ALIASES[countryCode] || "").toUpperCase();
  
  return COUNTRY_NAMES[code] || null;
}

// Interface for display
export interface CityTaxDisplay {
  city: string;
  charge: string;
  basis: string;
  notes?: string;
  capNights?: number;
  byHotelStars?: Record<string, string>;
}

// Get formatted tax data for display
export function getCountryTaxData(country: string): {
  countryName: string;
  flag: string;
  cities: CityTaxDisplay[];
} | null {
  const code = country.length === 2 
    ? country.toUpperCase() 
    : (COUNTRY_NAME_ALIASES[country] || "").toUpperCase();
  
  const countryInfo = COUNTRY_NAMES[code];
  if (!countryInfo) return null;
  
  const rules = getTaxRulesForCountry(code);
  if (rules.length === 0) return null;
  
  const cities: CityTaxDisplay[] = rules.map(rule => ({
    city: rule.city,
    charge: formatCharge(rule),
    basis: formatBasis(rule.basis),
    notes: rule.notes,
    capNights: rule.capNights,
    byHotelStars: rule.byHotelStars 
      ? Object.fromEntries(
          Object.entries(rule.byHotelStars).map(([stars, money]) => [stars, formatMoney(money)])
        )
      : undefined,
  }));
  
  return {
    countryName: countryInfo.name,
    flag: countryInfo.flag,
    cities,
  };
}

// Legacy function for backwards compatibility
export function getCityTaxDisclosure(country: string): string {
  const data = getCountryTaxData(country);
  if (!data) {
    return "A local tourist/city tax may apply and is payable locally; amount depends on the municipality and accommodation type.";
  }
  
  const cityList = data.cities.slice(0, 3).map(c => `${c.city}: ${c.charge} ${c.basis}`).join("; ");
  return `${data.countryName}: ${cityList}. Payable locally.`;
}

export function uniqueCountries(countries: string[]): string[] {
  const set = new Set<string>();
  for (const c of countries) {
    if (!c) continue;
    const trimmed = c.trim();
    const code = trimmed.length === 2 ? trimmed.toUpperCase() : (COUNTRY_NAME_ALIASES[trimmed] ?? trimmed);
    set.add(code);
  }
  return Array.from(set);
}
