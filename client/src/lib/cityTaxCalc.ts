import type { CityTax } from "@shared/schema";

export interface CityTaxInfo {
  totalTaxPerPerson: number;
  cityName: string;
  nights: number;
  ratePerNight: number;
  currency: string;
  eurAmount?: number;
  eurToGbpRate?: number;
}

const countryToCode: Record<string, string> = {
  'italy': 'IT', 'italian': 'IT',
  'france': 'FR', 'french': 'FR',
  'spain': 'ES', 'spanish': 'ES',
  'portugal': 'PT', 'portuguese': 'PT',
  'greece': 'GR', 'greek': 'GR',
  'germany': 'DE', 'german': 'DE',
  'austria': 'AT', 'austrian': 'AT',
  'switzerland': 'CH', 'swiss': 'CH',
  'belgium': 'BE',
  'czech republic': 'CZ', 'czech': 'CZ', 'czechia': 'CZ',
  'hungary': 'HU', 'hungarian': 'HU',
  'croatia': 'HR', 'croatian': 'HR',
  'montenegro': 'ME',
  'romania': 'RO', 'romanian': 'RO',
  'latvia': 'LV',
  'iceland': 'IS', 'icelandic': 'IS',
  'dubai': 'AE', 'uae': 'AE', 'emirates': 'AE',
  'morocco': 'MA', 'moroccan': 'MA',
  'maldives': 'MV',
  'mauritius': 'MU',
  'malta': 'MT', 'maltese': 'MT',
  'cape verde': 'CV',
  'bulgaria': 'BG', 'bulgarian': 'BG',
  'slovakia': 'SK', 'slovak': 'SK',
  'denmark': 'DK', 'danish': 'DK',
  'estonia': 'EE', 'estonian': 'EE',
  'poland': 'PL', 'polish': 'PL',
  'netherlands': 'NL', 'dutch': 'NL',
};

const defaultCityPerCountry: Record<string, string> = {
  'IT': 'Rome',
  'FR': 'Paris',
  'ES': 'Barcelona',
  'PT': 'Lisbon',
  'GR': 'Greece',
  'DE': 'Hamburg',
  'AT': 'Vienna',
  'CH': 'Geneva',
  'BE': 'Brussels',
  'CZ': 'Prague',
  'HU': 'Budapest',
  'HR': 'Croatia',
  'ME': 'Montenegro',
  'RO': 'Bucharest',
  'LV': 'Riga',
  'IS': 'Reykjavik',
  'AE': 'Dubai',
  'MA': 'Morocco',
  'MV': 'Maldives',
  'MU': 'Mauritius',
  'MT': 'Malta',
  'CV': 'Cape Verde',
  'BG': 'Sofia',
  'SK': 'Bratislava',
  'DK': 'Copenhagen',
  'EE': 'Tallinn',
  'PL': 'Krakow',
};

export function getCountryCode(countryName: string): string | null {
  if (!countryName) return null;
  const lower = countryName.toLowerCase().trim();
  for (const [name, code] of Object.entries(countryToCode)) {
    if (lower.includes(name)) return code;
  }
  return null;
}

export function parseDurationNights(duration: string | null | undefined): number {
  if (!duration) return 0;
  const nightsMatch = duration.match(/(\d+)\s*night/i);
  if (nightsMatch) return parseInt(nightsMatch[1], 10);
  const daysMatch = duration.match(/(\d+)\s*day/i);
  if (daysMatch) return Math.max(0, parseInt(daysMatch[1], 10) - 1);
  return 0;
}

function getTaxRate(tax: CityTax, starRating: number = 4): number {
  if (tax.pricingType === 'star_rating') {
    switch (starRating) {
      case 1: return tax.rate1Star ?? tax.taxPerNightPerPerson ?? 0;
      case 2: return tax.rate2Star ?? tax.taxPerNightPerPerson ?? 0;
      case 3: return tax.rate3Star ?? tax.taxPerNightPerPerson ?? 0;
      case 4: return tax.rate4Star ?? tax.taxPerNightPerPerson ?? 0;
      case 5: return tax.rate5Star ?? tax.taxPerNightPerPerson ?? 0;
      default: return tax.rate4Star ?? tax.taxPerNightPerPerson ?? 0;
    }
  }
  return tax.taxPerNightPerPerson ?? 0;
}

export function calculateCityTax(
  countryName: string | null | undefined,
  duration: string | null | undefined,
  cityTaxes: CityTax[],
  eurToGbpRate: number = 0.84
): CityTaxInfo | undefined {
  if (!countryName || !cityTaxes || cityTaxes.length === 0) return undefined;

  const nights = parseDurationNights(duration);
  if (nights <= 0) return undefined;

  const countryCode = getCountryCode(countryName);
  if (!countryCode) return undefined;

  const defaultCity = defaultCityPerCountry[countryCode];
  if (!defaultCity) return undefined;

  const tax = cityTaxes.find(
    t => t.cityName.toLowerCase() === defaultCity.toLowerCase() && t.countryCode === countryCode
  );
  if (!tax) return undefined;

  const ratePerNight = getTaxRate(tax, 4);
  if (ratePerNight <= 0) return undefined;

  let rateInGbp = ratePerNight;
  let eurAmount: number | undefined;

  if (tax.currency === 'EUR') {
    rateInGbp = Math.round(ratePerNight * eurToGbpRate * 100) / 100;
    eurAmount = Math.round(ratePerNight * nights * 100) / 100;
  } else if (tax.currency !== 'GBP') {
    rateInGbp = ratePerNight;
    eurAmount = undefined;
  }

  const totalTax = Math.round(rateInGbp * nights * 100) / 100;

  return {
    totalTaxPerPerson: totalTax,
    cityName: tax.cityName,
    nights,
    ratePerNight: rateInGbp,
    currency: 'GBP',
    eurAmount,
    eurToGbpRate: tax.currency === 'EUR' ? eurToGbpRate : undefined,
  };
}
