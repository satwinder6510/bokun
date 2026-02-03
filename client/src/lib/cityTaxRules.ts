type CountryKey = string;

interface CityTax {
  city: string;
  charge: string;
  notes?: string;
}

interface CountryTaxData {
  countryName: string;
  flag: string;
  generalNote?: string;
  cities: CityTax[];
}

const COUNTRY_TAX_DATA: Record<CountryKey, CountryTaxData> = {
  "AT": {
    countryName: "Austria",
    flag: "🇦🇹",
    cities: [
      { city: "Vienna", charge: "~5% of net room rate", notes: "Ortstaxe; varies with room rate" },
      { city: "Salzburg", charge: "~€1.75 per adult/night", notes: "Local levy" },
      { city: "Innsbruck", charge: "€2–€3 per adult/night", notes: "Varies by district" },
    ]
  },
  "IT": {
    countryName: "Italy",
    flag: "🇮🇹",
    generalNote: "Municipal city taxes, collected locally at accommodation",
    cities: [
      { city: "Venice", charge: "€1–€5 pp/pn", notes: "Varies by hotel class & season" },
      { city: "Florence", charge: "€3.50–€8 pp/pn", notes: "1★ €3.50, 2★ €4.50, 3★ €6, 4★ €7, 5★ €8 (max 7 nights)" },
      { city: "Rome", charge: "€4–€10 pp/pn", notes: "1★ €4, 2★ €5, 3★ €6, 4★ €7.50, 5★ €10 (max 10 nights)" },
      { city: "Milan", charge: "€2–€5 pp/pn", notes: "Varies by hotel category" },
      { city: "Naples", charge: "€1.50–€5 pp/pn" },
      { city: "Bologna", charge: "€3–€5 pp/pn" },
      { city: "Turin", charge: "€2.30–€5 pp/pn", notes: "Varies by hotel category" },
      { city: "Sorrento", charge: "€2–€5 pp/pn" },
      { city: "Palermo", charge: "€1.50–€3 pp/pn", notes: "Max 4 nights" },
      { city: "Catania", charge: "€2–€5 pp/pn", notes: "1-2★ €2, 3★ €2.50, 4★ €3.50, 5★ €5 (max 4 nights)" },
      { city: "Syracuse", charge: "4% of room rate", notes: "Capped €5 pp/pn (max 7 nights)" },
      { city: "Verona", charge: "€2–€5 pp/pn", notes: "Varies by hotel category" },
      { city: "Lake Garda", charge: "€1–€4 pp/pn", notes: "Sirmione: 5★ €4.20 / 4★ €2.50 / 3★ €1.50" },
    ]
  },
  "PT": {
    countryName: "Portugal",
    flag: "🇵🇹",
    cities: [
      { city: "Lisbon", charge: "€4 pp/pn", notes: "Max 7 nights" },
      { city: "Porto", charge: "€3 pp/pn", notes: "Max 7 nights" },
      { city: "Funchal (Madeira)", charge: "€2 pp/pn", notes: "Max 7 nights" },
      { city: "Ponta Delgada (Azores)", charge: "€2 pp/pn" },
      { city: "Algarve", charge: "€2 pp/pn", notes: "Season dependent; Albufeira, Lagos, Portimão" },
    ]
  },
  "ES": {
    countryName: "Spain",
    flag: "🇪🇸",
    generalNote: "Regional taxes; applies mainly in Catalonia + Balearic Islands",
    cities: [
      { city: "Barcelona", charge: "€1.70–€4 pp/pn", notes: "Hotel category + municipal surcharge" },
      { city: "Girona, Tarragona, Lleida", charge: "€0.50–€2.50 pp/pn", notes: "Catalonia standard rates" },
      { city: "Balearic Islands", charge: "€1–€4 pp/pn", notes: "Mallorca, Ibiza, Menorca; seasonal + hotel class" },
    ]
  },
  "NL": {
    countryName: "Netherlands",
    flag: "🇳🇱",
    generalNote: "Percentage-based, collected locally",
    cities: [
      { city: "Amsterdam", charge: "12.5% of room rate", notes: "2024–2026 rate" },
      { city: "Rotterdam", charge: "6.5% of room rate" },
      { city: "The Hague", charge: "~€5.35 pp/pn" },
    ]
  },
  "DE": {
    countryName: "Germany",
    flag: "🇩🇪",
    generalNote: "City tax varies by municipality",
    cities: [
      { city: "Berlin", charge: "5% of room rate", notes: "City Tax" },
      { city: "Hamburg", charge: "€0.50–€4 pp/pn", notes: "Tiered by room price" },
      { city: "Cologne", charge: "5% of accommodation cost" },
      { city: "Frankfurt", charge: "€2 pp/pn" },
    ]
  },
  "CZ": {
    countryName: "Czechia",
    flag: "🇨🇿",
    cities: [
      { city: "Prague", charge: "50 CZK pp/pn", notes: "≈ €2" },
    ]
  },
  "HR": {
    countryName: "Croatia",
    flag: "🇭🇷",
    cities: [
      { city: "Dubrovnik", charge: "€2 pp/pn", notes: "Peak season" },
      { city: "Split", charge: "€1.50–€2 pp/pn" },
    ]
  },
  "CH": {
    countryName: "Switzerland",
    flag: "🇨🇭",
    generalNote: "Municipal visitor tax (Kurtaxe)",
    cities: [
      { city: "Zurich", charge: "~CHF 2.50 pp/pn" },
      { city: "Lucerne", charge: "~CHF 4 pp/pn" },
      { city: "Zermatt", charge: "~CHF 4 pp/pn" },
    ]
  },
  "GR": {
    countryName: "Greece",
    flag: "🇬🇷",
    generalNote: "Nationwide 'climate resilience fee', per room (not per person)",
    cities: [
      { city: "Athens, Santorini, Mykonos, Rhodes", charge: "€1.50–€10 per room/night", notes: "Depends on hotel class & season" },
    ]
  },
  "BE": {
    countryName: "Belgium",
    flag: "🇧🇪",
    cities: [
      { city: "Brussels", charge: "€4–€9 per room/night" },
      { city: "Bruges", charge: "€3–€4 pp/pn" },
    ]
  },
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
};

export function getCityTaxDisclosure(country: string): string {
  if (!country) {
    return "A local tourist/city tax may apply and is payable locally; amount depends on the municipality and accommodation type.";
  }

  const trimmed = country.trim();
  const code = trimmed.length === 2 ? trimmed.toUpperCase() : (COUNTRY_NAME_ALIASES[trimmed] ?? "");
  const data = COUNTRY_TAX_DATA[code];

  if (data) {
    const cityList = data.cities.map(c => `${c.city}: ${c.charge}`).join("; ");
    return `${data.countryName}: ${cityList}. Payable locally.`;
  }

  return "A local tourist/city tax may apply and is payable locally; amount depends on the municipality and accommodation type.";
}

export function getCountryTaxData(country: string): CountryTaxData | null {
  if (!country) return null;

  const trimmed = country.trim();
  const code = trimmed.length === 2 ? trimmed.toUpperCase() : (COUNTRY_NAME_ALIASES[trimmed] ?? "");

  return COUNTRY_TAX_DATA[code] || null;
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
