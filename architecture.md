# Flights and Packages - Architecture Reference

> This document tracks the system architecture, critical flows, and change history.
> Consult this before making changes to avoid breaking existing functionality.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Frontend Routes](#frontend-routes)
3. [Backend API Endpoints](#backend-api-endpoints)
4. [Database Schema](#database-schema)
5. [Pricing System](#pricing-system)
6. [City Tax System](#city-tax-system)
7. [Flight API Integration](#flight-api-integration)
8. [SEO System](#seo-system)
9. [Admin Authentication](#admin-authentication)
10. [External Services](#external-services)
11. [Critical Flows (Do Not Break)](#critical-flows-do-not-break)
12. [Change Log](#change-log)

---

## 1. Project Structure

```
├── client/                     # Frontend (React + Vite)
│   └── src/
│       ├── App.tsx             # Route definitions
│       ├── pages/              # Page components
│       ├── components/         # Reusable components
│       ├── hooks/              # Custom hooks
│       └── lib/                # Utilities (queryClient, etc.)
├── server/                     # Backend (Express + TypeScript)
│   ├── index.ts                # Server entry point
│   ├── routes.ts               # All API route handlers (~6000+ lines)
│   ├── storage.ts              # Database operations (MemStorage class)
│   ├── db.ts                   # Database connection (Drizzle + Neon)
│   ├── bokun.ts                # Bokun API client (HMAC-SHA1 auth)
│   ├── flightApi.ts            # Sunshine European Flight API client
│   ├── serpFlightApi.ts         # SERP API (Google Flights) client
│   ├── flightHotelPricing.ts   # Combined flight+hotel pricing engine
│   ├── hotelApi.ts             # Hotel search API client
│   ├── sunshineHotelApi.ts     # Sunshine Hotel API client
│   ├── scheduler.ts            # Weekly auto-refresh (node-cron)
│   ├── keywordIndex.ts         # AI search keyword indexing
│   ├── imageProcessor.ts       # Image resize/optimization
│   ├── objectStorage.ts        # Replit Object Storage wrapper
│   ├── mediaService.ts         # Media library service
│   ├── scraper.ts              # Web scraper for package import
│   ├── analytics.ts            # PostHog integration
│   ├── stripeClient.ts         # Stripe client setup
│   ├── vite.ts                 # Vite dev server integration (DO NOT EDIT)
│   └── seo/                    # SEO modules
│       ├── index.ts            # Module exports
│       ├── routes.ts           # SEO route registration
│       ├── inject.ts           # Bot-detected HTML injection
│       ├── meta.ts             # Meta tag generation
│       ├── jsonld.ts           # JSON-LD structured data
│       ├── sitemaps.ts         # XML sitemap generation
│       ├── feeds.ts            # JSON feeds for crawlers
│       ├── cache.ts            # In-memory SEO cache (5-min TTL)
│       ├── canonical.ts        # Canonical URL generation
│       ├── collectionSeo.ts    # Collection page SEO configs
│       ├── ukIntentDestination.ts  # UK-market destination SEO
│       ├── destinationAggregate.ts # Destination data aggregation
│       └── fragments.ts        # Reusable HTML/FAQ fragments
├── shared/
│   └── schema.ts               # Database schema + Zod types (Drizzle ORM)
├── drizzle.config.ts           # Drizzle migration config (DO NOT EDIT)
├── vite.config.ts              # Vite build config (DO NOT EDIT)
└── package.json                # Dependencies (DO NOT EDIT directly)
```

### Files You Must NEVER Edit
- `server/vite.ts` - Vite dev server integration
- `vite.config.ts` - Vite build configuration
- `drizzle.config.ts` - Drizzle migration configuration
- `package.json` - Use packager tool instead

---

## 2. Frontend Routes

### Public Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/` | Homepage | Landing page with hero, categories, special offers |
| `/packages` | Packages | Package listing with filters |
| `/packages/:slug` | PackageDetail | Full package detail with pricing calendar |
| `/Holidays/:country` | DestinationDetail | Legacy URL, destination page |
| `/Holidays/:country/:slug` | PackageDetail | Legacy URL, package detail |
| `/destinations` | Destinations | All destination countries |
| `/destinations/:country` | DestinationDetail | Packages by destination |
| `/collections` | Collections | Themed collections (river cruises, etc.) |
| `/collections/:tag` | CollectionDetail | Collection detail page |
| `/search` | SearchResults | Text search results |
| `/special-offers` | SpecialOffers | Special offer packages |
| `/checkout` | Checkout | Payment page (Stripe) |
| `/booking/:reference` | BookingConfirmation | Post-payment confirmation |
| `/contact` | Contact | Contact form (Privyr CRM webhook) |
| `/faq` | FAQ | Published FAQs |
| `/blog` | Blog | Blog listing |
| `/blog/:slug` | BlogPost | Individual blog post |
| `/terms` | Terms | Terms and conditions |
| `/privacy` | Privacy | Privacy policy |

### Admin Routes (Protected - require authentication)
| Path | Component | Description |
|------|-----------|-------------|
| `/login` | Login | Admin login (email + password + 2FA) |
| `/dashboard` | Dashboard | Admin dashboard overview |
| `/admin/packages` | AdminPackages | Manage flight packages |
| `/admin/flight-pricing` | AdminFlightPricing | Flight + tour pricing module |
| `/admin/pricing-generator` | AdminPricingGenerator | Pricing generation tool |
| `/admin/settings` | AdminSettings | Site-wide settings |
| `/admin/hotels` | AdminHotels | Hotel library management |
| `/admin/city-taxes` | AdminCityTaxes | City tax configuration |
| `/admin/media` | AdminMedia | Media library |
| `/admin/content-images` | AdminContentImages | Content images for collections |
| `/admin/blog` | AdminBlog | Blog post management |
| `/admin/faq` | AdminFAQ | FAQ management |
| `/admin/reviews` | AdminReviews | Customer reviews |
| `/admin/users` | AdminUsers | Admin user management (super_admin only) |
| `/admin/newsletter` | AdminNewsletter | Newsletter subscribers |

### Preview Routes (unpublished content)
| Path | Component |
|------|-----------|
| `/preview/packages` | PreviewPackages |
| `/preview/packages/:id` | PreviewPackageDetail |
| `/preview/contact` | PreviewContact |
| `/preview/faq` | PreviewFAQ |
| `/preview/blog` | PreviewBlog |
| `/preview/blog/:slug` | PreviewBlogPost |

---

## 3. Backend API Endpoints

### Public APIs

#### Packages
- `GET /api/packages` - Published flight packages
- `GET /api/packages/categories` - Package categories
- `GET /api/packages/special-offers` - Special offer packages
- `GET /api/packages/homepage` - Homepage aggregated data
- `GET /api/packages/:slug` - Single package by slug
- `GET /api/packages/:id/pricing` - Package pricing entries
- `GET /api/packages/:id/bokun-pricing` - Combined flight+Bokun departure pricing
- `GET /api/packages/:slug/city-taxes` - Calculated city taxes for a package

#### Destinations & Collections
- `GET /api/destinations` - All destinations with package counts
- `GET /api/destinations/:slug` - Packages/tours for a destination
- `GET /api/collections` - All collections with product counts
- `GET /api/collections/:tagSlug` - Collection detail

#### Search
- `GET /api/search` - Unified search across packages and tours
- `GET /api/ai-search/filters` - AI search filter options
- `GET /api/ai-search` - AI-powered search with filters

#### Bokun Tours
- `GET /api/bokun/products` - Cached Bokun products (paginated)
- `GET /api/bokun/product/:id` - Bokun product details
- `GET /api/bokun/availability/:id` - Bokun product availability

#### Commerce
- `GET /api/cart` - Cart items for session
- `POST /api/cart` - Add item to cart
- `DELETE /api/cart/:id` - Remove cart item
- `DELETE /api/cart` - Clear cart
- `GET /api/cart/count` - Cart item count
- `GET /api/stripe/config` - Stripe publishable key
- `POST /api/create-payment-intent` - Create Stripe payment intent
- `POST /api/bookings` - Create booking after payment
- `GET /api/bookings/:reference` - Booking details

#### Content
- `GET /api/faqs` - Published FAQs
- `GET /api/blog` - Published blog posts
- `GET /api/blog/slug/:slug` - Blog post by slug

#### Other Public
- `POST /api/contact` - Contact form submission
- `POST /api/newsletter/subscribe` - Newsletter signup
- `GET /api/exchange-rate` - Current USD to GBP exchange rate
- `GET /api/city-taxes` - All city taxes
- `GET /api/homepage-settings` - Homepage display settings

### Admin APIs (require session auth)

#### Package Management
- `GET /api/admin/packages` - All packages (published + unpublished)
- `POST /api/admin/packages` - Create package
- `PATCH /api/admin/packages/:id` - Update package
- `DELETE /api/admin/packages/:id` - Delete package

#### Package Pricing
- `GET /api/admin/packages/:id/pricing` - Pricing entries
- `POST /api/admin/packages/:id/pricing` - Add pricing entries
- `DELETE /api/admin/packages/:packageId/pricing/:pricingId` - Delete pricing entry
- `DELETE /api/admin/packages/:id/pricing` - Delete all pricing
- `GET /api/admin/packages/:id/pricing/download-csv` - Export pricing CSV
- `POST /api/admin/packages/:id/pricing/upload-csv` - Import pricing CSV

#### Package Seasons
- `GET /api/admin/packages/:id/seasons` - Seasons for package
- `POST /api/admin/packages/:id/seasons` - Create season
- `PATCH /api/admin/seasons/:id` - Update season
- `DELETE /api/admin/seasons/:id` - Delete season

#### Bokun Departures & Flight Pricing
- `POST /api/admin/packages/:id/sync-departures` - Sync Bokun departures
- `GET /api/admin/packages/:id/departures` - Get departures
- `PATCH /api/admin/departure-rates/:id/flight-pricing` - Update flight pricing for a rate
- `POST /api/admin/packages/fetch-bokun-departure-flights` - Fetch flight prices for departures

#### City Taxes
- `GET /api/admin/city-taxes` - All city taxes
- `POST /api/admin/city-taxes` - Create city tax
- `PUT /api/admin/city-taxes/:id` - Update city tax
- `DELETE /api/admin/city-taxes/:id` - Delete city tax

#### Content Management
- `GET /api/admin/content-images` - All content images
- `POST /api/admin/content-images` - Upsert content image
- `DELETE /api/admin/content-images/:id` - Delete content image

#### Blog & FAQ Admin
- `GET /api/blog/admin` - All blog posts
- `POST /api/blog` - Create blog post
- `PATCH /api/blog/:id` - Update blog post
- `DELETE /api/blog/:id` - Delete blog post
- `GET /api/faqs/admin` - All FAQs
- `POST /api/faqs` - Create FAQ
- `PATCH /api/faqs/:id` - Update FAQ
- `DELETE /api/faqs/:id` - Delete FAQ

#### Admin Auth
- `POST /api/auth/admin/login` - Login
- `POST /api/auth/admin/2fa/setup` - 2FA QR code
- `POST /api/auth/admin/2fa/verify` - 2FA verify
- `POST /api/auth/admin/logout` - Logout
- `GET /api/auth/admin/me` - Current user
- `GET /api/auth/admin/users` - List admin users
- `POST /api/auth/admin/users` - Create admin user
- `PATCH /api/auth/admin/users/:id` - Update admin user
- `DELETE /api/auth/admin/users/:id` - Delete admin user
- `POST /api/auth/admin/bootstrap` - Create first super admin

#### Settings & Uploads
- `GET /api/admin/settings` - All settings
- `PUT /api/admin/settings/:key` - Update setting
- `POST /api/admin/upload` - Upload single image
- `POST /api/admin/upload-multiple` - Upload multiple images
- `POST /api/admin/upload-video` - Upload video
- `DELETE /api/admin/upload/:filename` - Delete upload

#### Scheduled Tasks
- `POST /api/admin/refresh-bokun-cache` - Manual Bokun cache refresh
- `POST /api/admin/refresh-flight-prices` - Manual flight price refresh

---

## 4. Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `flight_packages` | Holiday packages | id (serial PK), title, slug (unique), category, countries (jsonb), price, singlePrice, bokunProductId, isPublished, pricingModule |
| `package_pricing` | Manual pricing per airport/date | id, packageId (FK), departureAirport, departureDate, price |
| `package_seasons` | Seasonal pricing ranges | id, packageId (FK), seasonName, startDate, endDate, landCostPerPerson |
| `bokun_departures` | Synced Bokun departure dates | id, packageId (FK), bokunProductId, departureDate, availableSpots |
| `bokun_departure_rates` | Rates per departure (twin/single) | id, departureId (FK), rateTitle, priceGbp, flightPriceGbp, combinedPriceGbp |
| `bokun_departure_rate_flights` | Flight prices per rate per airport | id, rateId (FK), airportCode, flightPriceGbp, combinedPriceGbp |
| `city_taxes` | City tax rates per destination | id, cityName, countryCode, currency, taxPerNightPerPerson, rate3Star, rate4Star, rate5Star |
| `hotels` | Hotel library | id, name, city, country, starRating |
| `flight_hotel_configs` | Flight+hotel package configs | id, packageId, cities (jsonb), searchStartDate |
| `flight_hotel_prices` | Cached flight+hotel prices | id, packageId, travelDate, ukAirport, finalPrice |

### Content Tables

| Table | Purpose |
|-------|---------|
| `blog_posts` | Blog articles with SEO fields |
| `faqs` | Frequently asked questions |
| `content_images` | Images for collections/destinations |
| `reviews` | Customer reviews |
| `newsletter_subscribers` | Email subscribers |

### Commerce Tables

| Table | Purpose |
|-------|---------|
| `cart_items` | Shopping cart (session-based) |
| `bookings` | Booking records with Stripe/Bokun references |
| `package_enquiries` | Enquiries for flight packages |
| `tour_enquiries` | Enquiries for Bokun tours |

### System Tables

| Table | Purpose |
|-------|---------|
| `admin_users` | Admin accounts (bcrypt + TOTP 2FA) |
| `admin_sessions` | Active admin sessions |
| `pending_2fa_sessions` | Temporary 2FA pending sessions |
| `cached_products` | Bokun product cache |
| `cache_metadata` | Cache refresh timestamps |
| `site_settings` | Key-value site configuration |
| `media_assets` | Media library items |
| `media_variants` | Resized media variants |
| `tracking_numbers` | DNI phone tracking numbers |
| `flight_tour_pricing_configs` | Flight+tour pricing configurations |

---

## 5. Pricing System

### Pricing Modules (per package)

Each package uses one of three pricing modules, set via `pricingModule` field:

#### 1. Manual Pricing (`manual`)
- Admin enters prices directly per departure airport and date
- Stored in `package_pricing` table
- Simplest module, used for packages with fixed pricing

#### 2. Open-Jaw Seasonal Pricing (`openJawSeasonal`)
- Seasons defined with date ranges and land costs
- Flight prices fetched from European or SERP API
- Supports round-trip, open-jaw, and open-jaw + internal flights
- Stored in `package_seasons` table

#### 3. Bokun Departures + Flights (`bokunDepartures`)
- Syncs departure dates and rates from Bokun API
- Fetches flight prices per UK airport per departure date
- Calculates combined price: `landCost + flightPrice + markup`
- Smart rounds to psychological prices (x49, x69, x99)
- Stored in `bokun_departures`, `bokun_departure_rates`, `bokun_departure_rate_flights`

### Price Calculation Formula (Bokun Departures)
```
1. Bokun land cost (USD) -> convert to GBP using admin exchange rate
2. Flight price (GBP) from Sunshine European API or SERP API
3. Combined = landCostGbp + flightPriceGbp
4. After markup = combined * (1 + markupPercent / 100)
5. Final price = smartRoundPrice(afterMarkup)
```

### Smart Round Price Rules
```javascript
// Rounds to nearest psychological price point
// Candidates: x49, x69, x99 in current hundred, x49 in next hundred
smartRoundPrice(1523) -> 1549
smartRoundPrice(1580) -> 1569
smartRoundPrice(1595) -> 1599
```

### Currency Display
- All prices displayed in GBP (£)
- Bokun API returns USD, converted using admin-configured exchange rate
- 10% markup applied to Bokun tour prices
- Exchange rate stored in `site_settings` table (key: `exchangeRate`)

### Dual Pricing (Twin Share vs Solo)
- Packages support both twin share and solo pricing
- `price` field = twin share per person
- `singlePrice` field = solo per person
- Admin setting controls display mode: both, twin-only, or solo-only

---

## 6. City Tax System

### How City Taxes Work

City taxes are local charges that hotels collect from guests. They vary by city, country, and hotel star rating.

### Configuration (Admin)
- City taxes are configured in `city_taxes` table via Admin > City Taxes
- Each entry has: cityName, countryCode, currency, base rate, and star-specific rates (3/4/5 star)
- Currency can be any of 19 supported currencies (see below)

### Calculation Flow (CRITICAL - Do Not Break)

**Location:** `server/routes.ts` - `GET /api/packages/:slug/city-taxes`

1. Package has `cityTaxConfig` (jsonb) listing cities and nights per city
2. For each city, system looks up the matching `city_taxes` entry
3. Tax rate is selected based on hotel star rating
4. **Currency conversion to GBP:**
   - If currency is `EUR`: uses admin-configured EUR-to-GBP rate
   - If currency is `GBP`: no conversion needed
   - If any other currency: fetches live rate from Frankfurter API (`https://api.frankfurter.dev/v1/latest`)
5. All taxes are summed as GBP per person
6. Response includes both GBP total and original foreign currency breakdowns

### Supported Currencies
```
EUR, USD, GBP, HRK, CZK, PLN, HUF, CHF, NOK, SEK, DKK,
TRY, AED, THB, INR, JPY, AUD, NZD, ZAR, IDR
```

### Frontend Display Format
```
£899 + £5.04 City taxes (€6.00 + Ft500 paid locally)
```
Shows: GBP equivalent + original foreign currency amounts with proper symbols

### Currency Symbol Map (Frontend)
```
EUR: €, USD: $, GBP: £, HRK: kn, CZK: Kč, PLN: zł, HUF: Ft,
CHF: Fr, NOK: kr, SEK: kr, DKK: kr, TRY: ₺, AED: د.إ, THB: ฿,
INR: ₹, JPY: ¥, AUD: A$, NZD: NZ$, ZAR: R, IDR: Rp
```

### Additional Charges
- Packages can have a separate "additional charge" (e.g., visa fees)
- Stored on the package: `additionalChargeName`, `additionalChargeCurrency`, `additionalChargeForeignAmount`, `additionalChargeExchangeRate`
- Converted to GBP using stored exchange rate
- Displayed alongside city taxes in the price breakdown

---

## 7. Flight API Integration

### Sunshine European Flight API
- **Base URL (Round-trip):** `http://87.102.127.86:8119/search/searchoffers.dll`
- **Base URL (One-way/Open-jaw):** `http://87.102.127.86:8119/owflights/owflights.dll`
- **Agent ID:** 122 (`agtid=122`)
- **File:** `server/flightApi.ts`
- **Used for:** European and most destinations

### SERP API (Google Flights)
- **File:** `server/serpFlightApi.ts`
- **Used for:** Non-European destinations or when explicitly configured
- **Requires:** SERP API key

### Flight Types
1. **Round-trip:** Single search, outbound + return
2. **Open-jaw:** Separate one-way searches for outbound and return (different airports)
3. **Open-jaw + Internal:** Open-jaw with an additional internal flight segment

### 6am Threshold Rule
- If a flight arrives after midnight but before 6am, the effective arrival date is the previous day
- This affects which departure date the flight price is associated with

### Weekly Auto-Refresh
- **Schedule:** Every Sunday at 3:00 AM UK time
- **File:** `server/scheduler.ts`
- Refreshes flight prices for all packages with `bokunDepartures` pricing module
- Uses saved configuration per package (destination airport, UK airports, markup)

---

## 8. SEO System

### Architecture
All SEO modules live in `server/seo/` and are registered via `registerSeoRoutes()`.

### Bot Detection
- User-agent sniffing for Googlebot, Bingbot, etc.
- Bots receive server-rendered HTML with full SEO content
- Regular users receive the React SPA

### Content Injection
For bot requests, the system injects into the base HTML:
- Meta tags (title, description, Open Graph, Twitter Cards)
- Canonical URLs
- JSON-LD structured data
- Crawler-visible HTML content (hidden from regular users)

### Sitemaps
- `/sitemap.xml` - Sitemap index
- `/sitemaps/pages.xml` - Static pages
- `/sitemaps/tours.xml` - Bokun tours (currently redirects to packages)
- `/sitemaps/packages.xml` - Flight packages
- `/sitemaps/destinations.xml` - Destination pages
- `/sitemaps/blog.xml` - Blog posts

### JSON Feeds
- `/feed/tours.json` - All Bokun tours
- `/feed/packages.json` - All flight packages
- `/feed/destinations.json` - Destinations with counts

### Collection Pages
Configured in `server/seo/collectionSeo.ts`:
- `/collections/river-cruises`
- `/collections/twin-centre`
- `/collections/golden-triangle`
- `/collections/multi-centre`
- `/collections/solo-travel`

### UK-Intent Destinations
Enhanced SEO for UK market, configured in `server/seo/ukIntentDestination.ts`.

### Environment Variables
- `SEO_ENABLED` - Master SEO toggle
- `SITEMAP_ENABLED` - Sitemap generation
- `FEEDS_ENABLED` - JSON feed generation
- `PRERENDER_ENABLED` - Server-side rendering for bots
- `CANONICAL_HOST` - Base URL for canonical tags

---

## 9. Admin Authentication

### Flow
1. Admin submits email + password to `/api/auth/admin/login`
2. Password verified with bcrypt (12 rounds)
3. If 2FA enabled: returns pending token, admin enters TOTP code
4. If 2FA not set up: redirects to 2FA setup (QR code)
5. On success: session token created, stored in `admin_sessions`
6. Session validated via `verifyAdminSession` middleware

### Roles
- `super_admin` - Full access including user management
- `editor` - Content and package management

### Security
- Passwords: minimum 12 characters, uppercase, lowercase, number, special char
- 2FA: TOTP-based (Google Authenticator compatible)
- Sessions: random token, stored server-side, expires after configurable period

---

## 10. External Services

| Service | Purpose | Auth Method |
|---------|---------|-------------|
| Bokun API | Tour data (search, details, availability, booking) | HMAC-SHA1 signature |
| Stripe | Payment processing (TEST mode) | Stripe secret key |
| Sunshine European Flight API | Flight prices (European routes) | Agent ID (122) |
| SERP API | Google Flights data | API key |
| Frankfurter API | Live currency exchange rates | None (free, no key) |
| Privyr CRM | Contact form webhook | Webhook URL |
| PostHog | User analytics | API key |
| Spotler Mail+ | Newsletter management | API credentials |
| Replit Object Storage | Image/video storage | Built-in (no key) |
| Neon PostgreSQL | Database | Connection string (DATABASE_URL) |

---

## 11. Critical Flows (Do Not Break)

### Package Detail Page Price Display
**Files:** `client/src/pages/PackageDetail.tsx`, `server/routes.ts`
- Calendar must auto-open to the month and airport with the cheapest (headline) price
- Prices must include city tax conversion from foreign currencies to GBP
- Display must show original foreign currency amounts with proper symbols
- Additional charges must display with currency conversion transparency

### Bokun Departure Sync + Flight Pricing
**Files:** `server/bokun.ts`, `server/routes.ts`, `server/flightApi.ts`
- Sync flow: Bokun availability -> parse departures/rates -> save to DB
- Flight pricing: fetch per airport per date -> combine with land cost -> apply markup -> smart round
- Lead price auto-update after flight prices are fetched

### City Tax Calculation
**Files:** `server/routes.ts` (line ~5700+), `client/src/pages/PackageDetail.tsx`
- ALL foreign currencies must convert to GBP before adding to price
- EUR uses admin-configured rate; other currencies use Frankfurter API live rates
- Never add raw foreign amounts as GBP (this was a critical bug, fixed 2026-02-06)

### Exchange Rate System
- Admin-configurable USD-to-GBP rate (stored in `site_settings`)
- Used for Bokun product price conversion (USD -> GBP)
- Separate from city tax exchange rates (which use live Frankfurter API)

### SEO Content Injection
**Files:** `server/seo/inject.ts`, `server/seo/routes.ts`
- Must only inject for bot user agents
- Must not break the React SPA for regular users
- Cache TTL: 5 minutes for SEO content

---

## 12. Change Log

### 2026-02-06
- **Fixed:** City tax foreign currency conversion bug - non-EUR currencies (HUF, CZK, etc.) were being added as raw amounts instead of converting to GBP
- **Added:** Live exchange rate fetching via Frankfurter API for all non-EUR/non-GBP city tax currencies
- **Updated:** Frontend city tax display to show multi-currency breakdowns with proper currency symbols
- **Added:** Currency symbol map for 19 supported currencies in PackageDetail.tsx

### Pre-2026-02-06 (Historical)
- Implemented Bokun Departures + Flights pricing module
- Added city tax system with multi-city support
- Built SEO system with bot detection and content injection
- Implemented admin authentication with 2FA
- Added AI-powered search with keyword indexing
- Built hotel library and media library
- Implemented weekly auto-refresh scheduler for flight prices
- Added UK-intent destination SEO and collection pages
- Integrated Stripe payment processing (TEST mode)
- Added mobile hero video support for packages
- Implemented PostHog analytics tracking
