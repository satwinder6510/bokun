type CountryKey = string;

interface TaxInfo {
  countryName: string;
  typicalCharge: string;
  notes: string;
}

const COUNTRY_TAX_INFO: Record<CountryKey, TaxInfo> = {
  "AT": {
    countryName: "Austria",
    typicalCharge: "€0.50–€3.00 per person/night",
    notes: "Varies by municipality and hotel category"
  },
  "IT": {
    countryName: "Italy",
    typicalCharge: "€1–€10 per person/night",
    notes: "Varies by city, season and property; often capped after set nights"
  },
  "PT": {
    countryName: "Portugal",
    typicalCharge: "€2–€4 per person/night",
    notes: "Major municipalities; often capped after ~7 nights"
  },
  "NL": {
    countryName: "Netherlands",
    typicalCharge: "3–7% of room rate",
    notes: "Amsterdam uses percentage; other cities may use fixed rate"
  },
  "DE": {
    countryName: "Germany",
    typicalCharge: "€1–€5 per person/night or 5%",
    notes: "Some cities only; varies by city"
  },
  "ES": {
    countryName: "Spain",
    typicalCharge: "€0.50–€4 per person/night",
    notes: "Regional/municipal; not nationwide"
  },
  "FR": {
    countryName: "France",
    typicalCharge: "€0.20–€4 per person/night",
    notes: "Taxe de séjour; varies by municipality and hotel class"
  },
  "GR": {
    countryName: "Greece",
    typicalCharge: "€0.50–€4 per room/night",
    notes: "Climate resilience fee; varies by property category"
  },
  "CH": {
    countryName: "Switzerland",
    typicalCharge: "CHF 1–6 per person/night",
    notes: "Kurtaxe; may include guest card benefits"
  },
  "BE": {
    countryName: "Belgium",
    typicalCharge: "€2–€8 per person/night",
    notes: "Major cities; varies by municipality"
  },
  "HR": {
    countryName: "Croatia",
    typicalCharge: "€1–€2 per person/night",
    notes: "Sojourn tax; varies by season"
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
};

export function getCityTaxDisclosure(country: string): string {
  if (!country) {
    return "A local tourist/city tax may apply and is payable locally; amount depends on the municipality and accommodation type.";
  }

  const trimmed = country.trim();
  const code = trimmed.length === 2 ? trimmed.toUpperCase() : (COUNTRY_NAME_ALIASES[trimmed] ?? "");
  const info = COUNTRY_TAX_INFO[code];

  if (info) {
    return `${info.countryName}: ${info.typicalCharge}. ${info.notes}. Payable locally.`;
  }

  return "A local tourist/city tax may apply and is payable locally; amount depends on the municipality and accommodation type.";
}

export function getTaxInfo(country: string): TaxInfo | null {
  if (!country) return null;

  const trimmed = country.trim();
  const code = trimmed.length === 2 ? trimmed.toUpperCase() : (COUNTRY_NAME_ALIASES[trimmed] ?? "");

  return COUNTRY_TAX_INFO[code] || null;
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
