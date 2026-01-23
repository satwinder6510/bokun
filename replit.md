# Flights and Packages - Tours Booking Platform

## Overview

This project is a public-facing tour booking website for "Flights and Packages," showcasing over 700 curated tours from the Bokun API. The platform aims to provide a clear interface for browsing tours, viewing itineraries, checking availability, and exploring pricing. The long-term vision is to become a comprehensive tour booking platform, incorporating full booking functionality, a shopping cart, secure Stripe payments, and booking confirmations under the domain tours.flightsandpackages.com.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The platform features a clean, minimal design with a red/orange accent color (#E74C3C). Key UI elements include a compact, admin-configurable hero banner, redesigned tour cards, and horizontal scrolling category pills. The header is transparent with a backdrop blur, offering essential navigation. The footer provides destination, company, quick links, and contact details. A contact form integrates with Privyr CRM. Administrators can control the hero image with a fallback system.

### SEO Implementation

The platform includes comprehensive SEO optimization managed via a modular server-side SEO system (`server/seo/`).

**Server-Side SEO Injection:**
- Dynamic meta tags, canonical URLs, Open Graph, and Twitter Cards are injected server-side for search engine crawlers
- Routes for `/packages/:slug`, `/destinations/:slug`, `/Holidays/:country`, `/Holidays/:country/:slug`, and `/tour/:id` receive SEO-injected HTML
- The `X-SEO-Injected: true` header indicates successful injection
- Environment variables control features: `SEO_ENABLED`, `SITEMAP_ENABLED`, `FEEDS_ENABLED`, `PRERENDER_ENABLED`, `CANONICAL_HOST`

**Structured Data (JSON-LD):**
- `TouristTrip` schema for tours and packages with pricing, duration, and itinerary
- `BreadcrumbList` for navigation hierarchy
- `Organization` and `TravelAgency` schemas for business identity
- `TouristDestination` and `CollectionPage` for destination pages

**Sitemaps:**
- Multi-sitemap architecture via `/sitemap.xml` (sitemap index)
- Individual sitemaps: `/sitemaps/pages.xml`, `/sitemaps/tours.xml`, `/sitemaps/packages.xml`, `/sitemaps/destinations.xml`, `/sitemaps/blog.xml`

**AI-Friendly JSON Feeds:**
- `/feed/tours.json` - All Bokun tours with metadata
- `/feed/packages.json` - All flight packages with pricing
- `/feed/destinations.json` - Destination listing with package counts

**Caching:**
- SEO-injected HTML is cached in-memory for performance
- 1-hour TTL for dynamic content caching

A content marketing blog is available at `/blog` with SEO-optimized URLs and content.

**UK-Intent Market-Specific SEO:**
For priority destinations like India, the platform includes enhanced UK-focused SEO content:
- UK-intent phrases in H1 titles, meta titles, and descriptions (e.g., "India Holidays from the UK")
- Inventory-driven FAQs (10-14 questions) with contact email (holidayenq@flightsandpackages.com)
- Enhanced JSON-LD with TouristDestination, FAQPage, ItemList, and BreadcrumbList schemas
- Featured packages (12 top items) with ItemList markup
- Supporting pages like `/destinations/india/holiday-deals` with CollectionPage schema
- Internal hub links from package pages back to destination pages
- Configurable via `UK_INTENT_DESTINATIONS` map in `server/seo/ukIntentDestination.ts`

**Collection Pages with Guide-Grade SEO:**
The system includes a configurable collection SEO system in `server/seo/collectionSeo.ts` for themed holiday categories:
- `/collections/river-cruises` - River Cruise Packages
- `/collections/twin-centre` - Twin-Centre Holidays
- `/collections/golden-triangle` - Golden Triangle Tours (India)
- `/collections/multi-centre` - Multi-Centre Holidays
- `/collections/solo-travel` - Solo Travel Packages

Each collection page features:
- Inventory-driven content (package counts, price ranges, top destinations)
- 10-14 FAQs with contact email (holidayenq@flightsandpackages.com)
- Complete JSON-LD schemas (BreadcrumbList, CollectionPage, ItemList, FAQPage)
- UK-market-focused meta titles ("from the UK")
- Package matching via tag/title/description keywords
- Configurable via `COLLECTION_CONFIGS` in `server/seo/collectionSeo.ts`

### URL Structure (Migration-Compatible)

The URL structure is designed for compatibility with existing sites, supporting both legacy and new SEO-friendly routes for packages, destinations, collections, tours, blog posts, and static pages.

### Frontend Architecture

The frontend is built with React 18 and TypeScript, using Vite for builds and Wouter for routing. UI components leverage shadcn/ui (New York style) based on Radix UI and styled with Tailwind CSS. TanStack Query v5 manages server state. The design is component-based, reusable, and mobile-first.

### Backend Architecture

An Express.js application in TypeScript provides RESTful API endpoints, acting as a secure proxy for the Bokun API. It handles HMAC-SHA1 signatures and protects credentials, integrating product search, details, availability, and pricing. Prices are displayed in GBP (£), with Bokun API USD prices converted using an admin-configurable exchange rate and a 10% markup. The system optimizes performance by initially returning a subset of products and caching the rest.

### Data Layer

An in-memory storage system (`MemStorage`) is used for development, with Drizzle ORM configured for Neon Serverless PostgreSQL. Flight packages are stored in `flight_packages` with `package_pricing` for date-specific pricing.

### Dual Pricing (Twin Share vs Solo)

Flight packages support dual pricing for twin share and solo travelers. The system automatically detects room types from Bokun tour rates. An admin panel setting controls whether to display both, twin share only, or solo prices.

### Build & Deployment

Development uses `tsx` for the backend and Vite for the frontend. Production builds use Vite for the frontend and `esbuild` for the backend, served by a single Node.js process.

### Admin Authentication System

A multi-user admin authentication system with role-based access control (super_admin, editor) is implemented. It uses PostgreSQL for `admin_users` (with bcrypt-hashed passwords and TOTP secrets for 2FA) and `admin_sessions` for session management. 2FA is required for new users and returning users.

### Dynamic Flight + Tour Pricing

The platform supports dynamic combined pricing for Bokun land tours and external flight prices, integrated into the Flight Packages admin workflow. A unified pricing module system in the admin panel allows selecting between:

1.  **Manual Pricing Module:** Direct price entry per departure airport and date.
2.  **Open-Jaw Seasonal Pricing Module:** Inline season management (name, date range, land/hotel cost) with a choice between European Flight API and SERP API (Google Flights) for flight pricing. Supports round-trip, open-jaw, and open-jaw + internal flight types.
3.  **Bokun Departures + Flights Module:** Syncs Bokun departure dates and rates, auto-detects tour duration, and stores multiple rates per departure. Flight prices are stored per rate per UK airport, allowing calculation of combined prices with smart rounding. Uses the Sunshine European Flight API (http://87.102.127.86:8119) for flight pricing. Supports both **round-trip** flights (via `/search/searchoffers.dll`) and **open-jaw** flights (via `/owflights/owflights.dll`) where outbound and return are priced separately and combined.

The pricing calculation logic considers flight API data, internal flights, seasonal land/hotel costs, and a markup, with a 6am threshold for effective arrival date calculation.

### Automatic Weekly Flight Price Refresh

Packages using the Bokun Departures + Flights module can have their flight prices automatically refreshed every Sunday at 3:00 AM UK time. When flight prices are fetched for a package, the system saves the configuration (destination airport, UK departure airports, markup) and enables auto-refresh. The scheduler uses node-cron and the Sunshine European Flight API to keep prices up to date.

### AI-Powered Search Feature

The platform includes an AI-Powered Search at `/ai-search` that filters both flight packages and Bokun tours. Features include:
- **Destination dropdown:** Filter by destination country
- **Duration slider:** 1-21 days range
- **Budget slider:** Up to £10,000
- **Holiday type multi-select:** Toggle buttons for Beach, Adventure, Cultural, City Break, Cruise, River Cruise, Safari, Wildlife, Luxury, Multi-Centre, Island, Solo Travellers (up to 3 selections)
- **Travelers selector:** 1-6+ travelers with solo traveler boost

**Keyword Index System (server/keywordIndex.ts):**
An in-memory keyword index is built at server startup that scans all package content (title, description, excerpt, highlights, itinerary) and maps keywords to holiday types using synonym expansion (e.g., "Beach" matches beaches, seaside, coastal, tropical, oceanfront). This enables more accurate holiday type matching than simple tag-based filtering.

**Scoring Algorithm:**
- Packages base score: 80, Tours base score: 60
- Holiday type matches add +50 (direct match) or +8-20 (keyword match) based on relevance
- Results are balanced with max 18 packages + 6 tours when filters are active
- No filters: 2:1 interleave pattern (2 packages, 1 tour) for variety
- Falls back to USD cache if GBP cache is empty

**Destination-Aware Holiday Types:**
Holiday type options are dynamically filtered based on the selected destination using regional constraints:
- Safari: Only shown for African countries (Kenya, Tanzania, South Africa, etc.) + Sri Lanka, India
- Beach: Only shown for coastal/island destinations (Thailand, Greece, Spain, etc.)
- River Cruise: Only shown for countries with major river routes (Germany, France, Austria, etc.)
- Island: Only shown for archipelago destinations
The `/api/ai-search/filters` endpoint returns `holidayTypesByDestination` mapping auto-detected from actual package/tour content with regional filtering applied.

## External Dependencies

### Third-Party Services

-   **Bokun API:** Tour data (search, details, availability, booking), authenticated via HMAC-SHA1. Bookings are reserved for external payment and confirmed post-Stripe.
-   **Stripe:** Payment processing via Stripe Elements (TEST mode).
-   **Privyr CRM:** Webhook integration for contact form submissions.
-   **PostHog:** User activity tracking and analytics with EU data residency.

### Mobile Hero Video Feature

Flight packages support per-package mobile hero videos that display instead of the featured image on mobile devices:
- Videos are uploaded via the admin panel (max 50MB) and stored in Replit Object Storage
- On mobile devices, the video auto-plays, loops, and is muted with playsInline
- Desktop users see the standard hero image
- Fallback to featured image if video fails to load
- Explicit dimensions and poster attribute prevent CLS issues

### Database & Infrastructure

-   **Neon Serverless PostgreSQL:** Database operations via Drizzle ORM.
-   **Replit Object Storage:** For media library images and videos.

### UI Component Libraries

-   **Radix UI Primitives:** Accessible, unstyled UI components.
-   **shadcn/ui:** Component library built on Radix UI and Tailwind CSS.
-   **embla-carousel-react:** Carousel functionality.
-   **lucide-react:** Icon system.
-   **react-day-picker:** Date picker.

### Supporting Libraries

-   **class-variance-authority:** Type-safe component variants.
-   **nanoid:** Unique ID generation.
-   **date-fns:** Date formatting and manipulation.