const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';

export function getCanonicalUrl(path: string): string {
  const cleanPath = path.split('?')[0];
  return `${CANONICAL_HOST}${cleanPath}`;
}

export function generateCanonicalTag(path: string): string {
  const url = getCanonicalUrl(path);
  return `<link rel="canonical" href="${url}" />`;
}
