import fs from 'fs';
import path from 'path';
import { storage } from '../server/storage';
import { generateTourMeta, generateDestinationMeta } from '../server/seo/meta';
import { generateTourJsonLd, generateDestinationJsonLd, generateBreadcrumbJsonLd, generateOrganizationJsonLd } from '../server/seo/jsonld';
import type { FlightPackage } from '../shared/schema';

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'https://holidays.flightsandpackages.com';
const OUTPUT_DIR = path.resolve(process.cwd(), 'prerendered');

async function getBaseTemplate(): Promise<string> {
  const templatePath = path.resolve(process.cwd(), 'client', 'index.html');
  return fs.promises.readFile(templatePath, 'utf-8');
}

function injectIntoHead(html: string, content: string): string {
  return html.replace('</head>', `${content}\n</head>`);
}

function injectIntoBody(html: string, content: string): string {
  return html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}

function parseDuration(durationStr: string | null | undefined): number | undefined {
  if (!durationStr) return undefined;
  const match = durationStr.match(/(\d+)\s*(?:nights?|days?)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

async function prerenderPackage(pkg: FlightPackage, template: string): Promise<void> {
  const requestPath = `/packages/${pkg.slug}`;
  
  const metaTags = generateTourMeta({
    title: pkg.title,
    excerpt: pkg.excerpt || undefined,
    description: pkg.description || undefined,
    keyPhoto: pkg.featuredImage || undefined,
    destination: pkg.category || undefined,
    duration: parseDuration(pkg.duration)
  }, requestPath);
  
  const jsonLd = generateTourJsonLd({
    id: pkg.id,
    title: pkg.title,
    description: pkg.description || undefined,
    excerpt: pkg.excerpt || undefined,
    destination: pkg.category || undefined,
    duration: parseDuration(pkg.duration),
    priceFrom: pkg.price || undefined,
    currency: 'GBP',
    keyPhoto: pkg.featuredImage || undefined,
    highlights: pkg.highlights || undefined,
    itinerary: pkg.itinerary || undefined
  }, requestPath);
  
  const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', url: CANONICAL_HOST },
    { name: 'Packages', url: `${CANONICAL_HOST}/packages` },
    { name: pkg.title, url: `${CANONICAL_HOST}${requestPath}` }
  ]);
  
  const orgJsonLd = generateOrganizationJsonLd();
  
  let html = injectIntoHead(template, metaTags + jsonLd + breadcrumbs + orgJsonLd);
  
  const content = `
    <article itemscope itemtype="https://schema.org/TouristTrip">
      <h1 itemprop="name">${pkg.title}</h1>
      <p itemprop="description">${pkg.excerpt || pkg.description?.substring(0, 500) || ''}</p>
      ${pkg.category ? `<p>Destination: <span itemprop="touristType">${pkg.category}</span></p>` : ''}
      ${pkg.duration ? `<p>Duration: ${pkg.duration}</p>` : ''}
      ${pkg.price ? `<p>From <span itemprop="offers" itemscope itemtype="https://schema.org/Offer"><span itemprop="priceCurrency">£</span><span itemprop="price">${pkg.price}</span></span></p>` : ''}
      ${pkg.highlights?.length ? `<h2>Highlights</h2><ul>${pkg.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
    </article>
  `;
  html = injectIntoBody(html, content);
  
  const outputPath = path.join(OUTPUT_DIR, 'packages', `${pkg.slug}.html`);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, html, 'utf-8');
  
  console.log(`[Prerender] Generated: ${outputPath}`);
}

async function prerenderDestination(destination: string, packages: FlightPackage[], template: string): Promise<void> {
  const slug = destination.toLowerCase().replace(/\s+/g, '-');
  const requestPath = `/destinations/${slug}`;
  
  const metaTags = generateDestinationMeta({
    name: destination,
    description: `Explore our ${packages.length} holiday packages to ${destination}. Book your perfect getaway with Flights and Packages.`,
    image: packages[0]?.featuredImage || undefined,
    packageCount: packages.length
  }, requestPath);
  
  const jsonLd = generateDestinationJsonLd({
    name: destination,
    description: `Holiday packages to ${destination}`,
    image: packages[0]?.featuredImage || undefined,
    packageCount: packages.length
  }, requestPath);
  
  const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', url: CANONICAL_HOST },
    { name: 'Destinations', url: `${CANONICAL_HOST}/destinations` },
    { name: destination, url: `${CANONICAL_HOST}${requestPath}` }
  ]);
  
  let html = injectIntoHead(template, metaTags + jsonLd + breadcrumbs);
  
  const content = `
    <article itemscope itemtype="https://schema.org/TouristDestination">
      <h1 itemprop="name">${destination} Holidays</h1>
      <p itemprop="description">Explore our ${packages.length} holiday packages to ${destination}.</p>
      <h2>Available Packages</h2>
      <ul>
        ${packages.map(p => `
          <li itemscope itemtype="https://schema.org/TouristTrip">
            <a href="/packages/${p.slug}" itemprop="url">
              <span itemprop="name">${p.title}</span>
            </a>
            ${p.price ? ` - From £${p.price}` : ''}
          </li>
        `).join('')}
      </ul>
    </article>
  `;
  html = injectIntoBody(html, content);
  
  const outputPath = path.join(OUTPUT_DIR, 'destinations', `${slug}.html`);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, html, 'utf-8');
  
  console.log(`[Prerender] Generated: ${outputPath}`);
}

async function main(): Promise<void> {
  console.log('[Prerender] Starting prerender process...');
  
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  
  const template = await getBaseTemplate();
  const packages = await storage.getAllFlightPackages();
  const publishedPackages = packages.filter((p: FlightPackage) => p.isPublished);
  
  console.log(`[Prerender] Found ${publishedPackages.length} published packages`);
  
  for (const pkg of publishedPackages) {
    try {
      await prerenderPackage(pkg, template);
    } catch (error) {
      console.error(`[Prerender] Error prerendering package ${pkg.slug}:`, error);
    }
  }
  
  const destinations = new Map<string, FlightPackage[]>();
  for (const pkg of publishedPackages) {
    if (pkg.category) {
      const existing = destinations.get(pkg.category) || [];
      existing.push(pkg);
      destinations.set(pkg.category, existing);
    }
  }
  
  console.log(`[Prerender] Found ${destinations.size} destinations`);
  
  const destinationEntries = Array.from(destinations.entries());
  for (const [destination, pkgs] of destinationEntries) {
    try {
      await prerenderDestination(destination, pkgs, template);
    } catch (error) {
      console.error(`[Prerender] Error prerendering destination ${destination}:`, error);
    }
  }
  
  console.log('[Prerender] Complete!');
}

main().catch(console.error);
