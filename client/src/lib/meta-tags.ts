export function setMetaTags(title: string, description: string, ogImage?: string) {
  // Update title
  document.title = title;

  // Update/create meta description
  let descMeta = document.querySelector('meta[name="description"]');
  if (!descMeta) {
    descMeta = document.createElement('meta');
    descMeta.setAttribute('name', 'description');
    document.head.appendChild(descMeta);
  }
  descMeta.setAttribute('content', description);

  // Update/create canonical link
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  const baseUrl = 'https://tours.flightsandpackages.com';
  canonical.setAttribute('href', baseUrl + window.location.pathname + window.location.search);

  // Update/create Open Graph tags
  updateOGTag('og:title', title);
  updateOGTag('og:description', description);
  if (ogImage) {
    updateOGTag('og:image', ogImage);
  }
  updateOGTag('og:url', window.location.href);
}

function updateOGTag(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

export function addJsonLD(schema: object) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}
