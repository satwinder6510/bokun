# Flights and Packages - Architecture Reference

> This document tracks the system architecture, critical flows, and change history.
> Consult this before making changes to avoid breaking existing functionality.
> **RULE:** This file MUST be updated with every meaningful code change.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Frontend Routes](#frontend-routes)
3. [Backend API Endpoints](#backend-api-endpoints)
4. [Database Schema](#database-schema)
5. [Pricing System](#pricing-system)
6. [City Tax System](#city-tax-system)
7. [Flight API Integration](#flight-api-integration)
8. [Sunshine Hotel API Integration](#sunshine-hotel-api-integration)
9. [Flight + Hotel Combined Pricing Module](#flight--hotel-combined-pricing-module)
10. [Media Asset Management System](#media-asset-management-system)
11. [Hotel Library & Scraping System](#hotel-library--scraping-system)
12. [Stock Image Integration](#stock-image-integration)
13. [Enquiry System](#enquiry-system)
14. [Tracking Numbers (DNI)](#tracking-numbers-dni)
15. [SEO System](#seo-system)
16. [Admin Authentication](#admin-authentication)
17. [External Services](#external-services)
18. [Critical Flows (Do Not Break)](#critical-flows-do-not-break)
19. [Change Log](#change-log)

---

## 1. Project Structure

```
├── client/                     # Frontend (React + Vite)
│   └── src/
│       ├── App.tsx             # Route definitions
│       ├── pages/              # Page components (~50 pages)
│       ├── components/         # Reusable components (~24 custom + ~47 UI)
│       ├── hooks/              # Custom hooks (~5)
│       └── lib/                # Utilities (~11 modules)
├── server/                     # Backend (Express + TypeScript)
│   ├── index.ts                # Server entry point
│   ├── routes.ts               # All API route handlers (~10,600 lines, ~195 routes)
│   ├── storage.ts              # Database operations via Drizzle ORM (~2,100 lines)
│   ├── db.ts                   # Database connection (Drizzle + Neon)
│   ├── bokun.ts                # Bokun API client (HMAC-SHA1 auth)
│   ├── flightApi.ts            # Sunshine European Flight API client (round-trip + one-way)
│   ├── serpFlightApi.ts         # SERP API (Google Flights) client
│   ├── flightHotelPricing.ts   # Combined flight+hotel pricing engine
│   ├── hotelApi.ts             # Sunshine Hotel availability/pricing API (HTLSEARCH)
│   ├── sunshineHotelApi.ts     # Sunshine Hotel destination mapping API (resort/country lists)
│   ├── sunshineStaticData.ts   # Pre-cached static resort data for Sunshine
│   ├── hotelScraperService.ts  # Hotel website scraper (Cheerio-based)
│   ├── stockImageService.ts    # Stock image integration (Unsplash + Pexels)
│   ├── mediaService.ts         # Media library service (sharp, variants, backups)
│   ├── imageProcessor.ts       # Image download, resize and optimization for packages
│   ├── objectStorage.ts        # Replit Object Storage wrapper
│   ├── objectAcl.ts            # Object storage ACL policies
│   ├── keywordIndex.ts         # AI search keyword indexing at startup
│   ├── scheduler.ts            # Weekly auto-refresh scheduler (node-cron)
│   ├── scraper.ts              # Web scraper for package import from demo site
│   ├── analytics.ts            # PostHog analytics (AI bot detection)
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
│   └── schema.ts               # Database schema + Zod types (~1,437 lines, Drizzle ORM)
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
| `/tours` | Redirect | Redirects to `/packages` |
| `/tour/:id` | Redirect | Redirects to `/packages` |
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
| `/admin/login` | Login | Alias for login page |
| `/dashboard` | Dashboard | Admin dashboard overview |
| `/admin/dashboard` | Dashboard | Alias for dashboard |
| `/admin/packages` | AdminPackages | Manage flight packages |
| `/admin/flight-pricing` | AdminFlightPricing | Flight + tour pricing module |
| `/admin/pricing-generator` | AdminPricingGenerator | Pricing generation tool |
| `/admin/settings` | AdminSettings | Site-wide settings |
| `/admin/hotels` | AdminHotels | Hotel library management |
| `/admin/city-taxes` | AdminCityTaxes | City tax configuration |
| `/admin/media` | AdminMedia | Media library |
| `/admin/content-images` | AdminContentImages | Content images for collections/destinations |
| `/admin/blog` | AdminBlog | Blog post management |
| `/admin/faq` | AdminFAQ | FAQ management |
| `/admin/reviews` | AdminReviews | Customer reviews |
| `/admin/users` | AdminUsers | Admin user management (super_admin only) |
| `/admin/newsletter` | AdminNewsletter | Newsletter subscribers |
| `/admin/tracking-numbers` | AdminTrackingNumbers | Dynamic Number Insertion tracking |

### Preview Routes (unpublished content)
| Path | Component |
|------|-----------|
| `/preview/packages` | PreviewPackages |
| `/preview/packages/:id` | PreviewPackageDetail |
| `/preview/tours` | Redirect to `/preview/packages` |
| `/preview/tours/:slug` | Redirect to `/preview/packages` |
| `/preview/contact` | PreviewContact |
| `/preview/faq` | PreviewFAQ |
| `/preview/blog` | PreviewBlog |
| `/preview/blog/:slug` | PreviewBlogPost |

### Internal/Dev Routes
| Path | Component |
|------|-----------|
| `/design-preview` | DesignPreview |
| `/hero-concepts` | HeroConcepts |

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
- `GET /api/packages/:id/flight-hotel-availability` - Flight+hotel combined pricing availability
- `POST /api/packages/:slug/enquiry` - Submit package enquiry

#### Destinations & Collections
- `GET /api/destinations` - All destinations with package counts
- `GET /api/destinations/:slug` - Packages/tours for a destination
- `GET /api/collections` - All collections with product counts
- `GET /api/collections/:tagSlug` - Collection detail

#### Search
- `GET /api/search` - Unified search across packages and tours
- `GET /api/ai-search/filters` - AI search filter options (holiday types by destination)
- `GET /api/ai-search` - AI-powered search with filters

#### Bokun Tours
- `POST /api/bokun/test-connection` - Test Bokun API connection
- `GET /api/bokun/cache-metadata` - Cache metadata (last refresh, total products)
- `POST /api/bokun/products/refresh` - Force refresh Bokun product cache
- `POST /api/bokun/products` - Search/list Bokun products (paginated)
- `GET /api/bokun/product/:id` - Bokun product details
- `GET /api/bokun/currency-test/:id` - Currency test for Bokun product
- `GET /api/bokun/availability/:id` - Bokun product availability
- `POST /api/tours/:productId/enquiry` - Submit tour enquiry

#### Flight Pricing for Tours (Bokun land tours with dynamic flights)
- `GET /api/flight-pricing/airports` - Available UK departure airports
- `GET /api/tours/:bokunProductId/flight-pricing` - All flight prices for a tour
- `GET /api/tours/:bokunProductId/flight-pricing/:date` - Flight prices for a specific date

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
- `PATCH /api/bookings/:reference` - Update booking status

#### Content
- `GET /api/faqs` - Published FAQs
- `GET /api/faqs/:id` - Single FAQ
- `GET /api/blog` - Published blog posts
- `GET /api/blog/id/:id` - Blog post by ID
- `GET /api/blog/slug/:slug` - Blog post by slug
- `GET /api/reviews` - Published customer reviews

#### Other Public
- `POST /api/contact` - Contact form submission (Privyr CRM webhook)
- `POST /api/newsletter/subscribe` - Newsletter signup
- `GET /api/exchange-rate` - Current USD to GBP exchange rate
- `GET /api/city-taxes` - All city taxes
- `GET /api/homepage-settings` - Homepage display settings
- `GET /api/tracking-number` - Get tracking phone number (by tag/referrer)
- `GET /api/spotler/properties` - Spotler Mail+ properties
- `GET /api/media/:slug/:variant` - Serve media asset variant
- `GET /api/image-proxy` - Proxy external images
- `GET /objects/*` - Replit Object Storage proxy

#### Auth (2FA for non-admin legacy)
- `GET /api/auth/2fa/setup` - 2FA setup
- `POST /api/auth/2fa/verify` - 2FA verify

### Admin APIs (require session auth)

#### Package Management
- `GET /api/admin/packages` - All packages (published + unpublished)
- `POST /api/admin/packages` - Create package
- `PATCH /api/admin/packages/:id` - Update package
- `DELETE /api/admin/packages/:id` - Delete package

#### Package Pricing (Manual Module)
- `GET /api/admin/packages/:id/pricing` - Pricing entries
- `POST /api/admin/packages/:id/pricing` - Add pricing entries
- `DELETE /api/admin/packages/:packageId/pricing/:pricingId` - Delete pricing entry
- `DELETE /api/admin/packages/:id/pricing` - Delete all pricing
- `GET /api/admin/packages/:id/pricing/download-csv` - Download pricing CSV
- `POST /api/admin/packages/:id/pricing/upload-csv` - Upload pricing CSV
- `GET /api/admin/packages/:id/pricing/export-csv` - Export pricing CSV

#### Package Seasons (Open-Jaw Seasonal Module)
- `GET /api/admin/packages/:id/seasons` - Seasons for package
- `POST /api/admin/packages/:id/seasons` - Create season
- `PATCH /api/admin/seasons/:id` - Update season
- `DELETE /api/admin/seasons/:id` - Delete season
- `DELETE /api/admin/packages/:id/seasons` - Delete all seasons

#### Bokun Departures & Flight Pricing
- `POST /api/admin/packages/:id/sync-departures` - Sync Bokun departures
- `GET /api/admin/packages/:id/departures` - Get departures with rates
- `PATCH /api/admin/departure-rates/:id/flight-pricing` - Update flight pricing for a rate
- `POST /api/admin/packages/fetch-bokun-departure-flights` - Fetch flight prices (Sunshine API)
- `POST /api/admin/packages/fetch-serp-flight-prices` - Fetch flight prices (SERP API / Google Flights)

#### Pricing Generation & Export
- `POST /api/admin/packages/:id/generate-pricing` - Generate round-trip pricing
- `POST /api/admin/packages/:id/generate-openjaw-pricing` - Generate open-jaw pricing
- `GET /api/admin/packages/:id/exports` - Export history
- `POST /api/admin/packages/fetch-flight-prices` - Fetch flight prices (Sunshine European API)

#### Flight + Hotel Combined Pricing Module
- `GET /api/admin/packages/:id/flight-hotel-config` - Get flight+hotel config
- `POST /api/admin/packages/:id/flight-hotel-config` - Save flight+hotel config
- `POST /api/admin/packages/:id/fetch-flight-hotel-prices` - Calculate and cache prices
- `GET /api/admin/packages/:id/flight-hotel-prices` - Get cached flight+hotel prices
- `DELETE /api/admin/packages/:id/flight-hotel-prices` - Clear cached prices

#### Sunshine Hotel API (Admin)
- `GET /api/admin/sunshine/countries` - List all Sunshine countries
- `GET /api/admin/sunshine/resorts/:countryId` - Resorts for a country (static data with live API fallback)
- `GET /api/admin/hotels/search` - Search hotels via Sunshine destination mapping (**MUST be before /:id route**)

#### Hotel Library (Admin)
- `GET /api/admin/hotels` - List all hotels
- `GET /api/admin/hotels/:id` - Get hotel by ID
- `POST /api/admin/hotels` - Create hotel
- `PATCH /api/admin/hotels/:id` - Update hotel
- `DELETE /api/admin/hotels/:id` - Delete hotel
- `POST /api/admin/hotels/scrape` - Scrape hotel data from website URL
- `POST /api/admin/hotels/import-from-packages` - Import hotels from existing packages
- `POST /api/admin/hotels/remove-duplicates` - Remove duplicate hotels
- `POST /api/admin/hotels/verify-images` - Verify hotel image URLs are still valid

#### Flight Pricing Configs (Tour-level)
- `GET /api/admin/flight-pricing-configs` - All configs
- `GET /api/admin/flight-pricing-configs/bokun/:bokunProductId` - Config for a Bokun tour
- `POST /api/admin/flight-pricing-configs` - Create config
- `PATCH /api/admin/flight-pricing-configs/:id` - Update config
- `DELETE /api/admin/flight-pricing-configs/:id` - Delete config
- `GET /api/admin/flight-pricing-configs/test-search` - Test flight search

#### City Taxes (Admin)
- `GET /api/admin/city-taxes` - All city taxes
- `POST /api/admin/city-taxes` - Create city tax
- `PUT /api/admin/city-taxes/:id` - Update city tax
- `DELETE /api/admin/city-taxes/:id` - Delete city tax

#### Content Images (Admin)
- `GET /api/admin/content-images` - All content images
- `GET /api/admin/content-images/:type` - Content images by type
- `POST /api/admin/content-images` - Upsert content image
- `DELETE /api/admin/content-images/:id` - Delete content image

#### Blog & FAQ Admin
- `GET /api/blog/admin` - All blog posts (including unpublished)
- `POST /api/blog` - Create blog post
- `PATCH /api/blog/:id` - Update blog post
- `DELETE /api/blog/:id` - Delete blog post
- `GET /api/faqs/admin` - All FAQs (including unpublished)
- `POST /api/faqs` - Create FAQ
- `PATCH /api/faqs/:id` - Update FAQ
- `DELETE /api/faqs/:id` - Delete FAQ

#### Reviews (Admin)
- `GET /api/admin/reviews` (via admin routes) - All reviews
- `POST /api/admin/reviews` - Create review
- `PATCH /api/admin/reviews/:id` - Update review
- `DELETE /api/admin/reviews/:id` - Delete review

#### Tracking Numbers (Admin)
- `GET /api/admin/tracking-numbers` - All tracking numbers
- `GET /api/admin/tracking-numbers/:id` - Single tracking number
- `POST /api/admin/tracking-numbers` - Create tracking number
- `PATCH /api/admin/tracking-numbers/:id` - Update tracking number
- `DELETE /api/admin/tracking-numbers/:id` - Delete tracking number

#### Enquiries (Admin)
- `GET /api/admin/enquiries` - All enquiries (packages + tours combined)

#### Newsletter (Admin)
- `GET /api/admin/newsletter/subscribers` - All subscribers
- `GET /api/admin/newsletter/export` - Export subscribers CSV

#### Media Library (Admin)
- `GET /api/admin/media/assets` - List media assets
- `GET /api/admin/media/assets/:id` - Get single asset with variants/tags
- `POST /api/admin/media/upload` - Upload image to media library
- `GET /api/admin/media/search` - Search media assets
- `GET /api/admin/media/unused` - Find unused media assets
- `POST /api/admin/media/assign` - Assign media to entity
- `DELETE /api/admin/media/assets/:id` - Delete media asset
- `POST /api/admin/media/assets/:id/destinations` - Add destination tag to asset
- `DELETE /api/admin/media/assets/:id/destinations/:destination` - Remove destination tag

#### Media Cleanup (Admin)
- `GET /api/admin/media/cleanup-jobs` - List cleanup jobs
- `POST /api/admin/media/cleanup-jobs` - Create cleanup job
- `POST /api/admin/media/cleanup-jobs/:id/execute` - Execute cleanup job
- `POST /api/admin/media/cleanup-jobs/:id/rollback` - Rollback cleanup job
- `GET /api/admin/media/backups` - List media backups

#### Media Migration (Admin)
- `GET /api/admin/media/migration/status` - Migration status
- `POST /api/admin/media/migration/run` - Run media migration

#### Stock Images (Admin)
- `GET /api/admin/media/stock/status` - Stock API availability
- `GET /api/admin/media/stock/search` - Search stock images (Unsplash + Pexels)
- `POST /api/admin/media/stock/import` - Import a stock image
- `POST /api/admin/media/stock/auto-import` - Auto-import stock images for a destination

#### Scraping & Import Tools (Admin)
- `POST /api/admin/scrape-test` - Test scrape a URL
- `POST /api/admin/process-image` - Process/optimize an image
- `POST /api/admin/batch-import` - Batch import packages
- `POST /api/admin/flight-packages/match-urls` - Match packages to source URLs
- `POST /api/admin/flight-packages/rescrape-accommodations` - Re-scrape hotel info
- `POST /api/admin/flight-packages/rescrape-images` - Re-scrape package images
- `GET /api/admin/packages/bokun-search` - Search Bokun for tours
- `GET /api/admin/packages/bokun-tour/:productId` - Get Bokun tour details for import

#### Image Migration (Admin)
- `POST /api/admin/migrate-images` - Migrate images to Object Storage
- `GET /api/admin/migration-status` - Image migration status

#### Storage Diagnostics (Admin)
- `GET /api/admin/storage-diagnostic` - Object Storage diagnostic info
- `POST /api/objects/migrate-url` - Migrate a single object URL

#### Admin Auth
- `POST /api/auth/admin/login` - Login (rate limited)
- `POST /api/auth/admin/2fa/setup` - 2FA QR code generation
- `POST /api/auth/admin/2fa/verify-setup` - 2FA setup verification (rate limited)
- `POST /api/auth/admin/2fa/verify` - 2FA code verification (rate limited)
- `POST /api/auth/admin/logout` - Logout
- `GET /api/auth/admin/me` - Current user info
- `GET /api/auth/admin/users` - List admin users (super_admin only)
- `POST /api/auth/admin/users` - Create admin user (super_admin only)
- `PATCH /api/auth/admin/users/:id` - Update admin user (super_admin only)
- `POST /api/auth/admin/users/:id/reset-password` - Reset password (rate limited, super_admin only)
- `DELETE /api/auth/admin/users/:id` - Delete admin user (super_admin only)
- `POST /api/auth/admin/bootstrap` - Create first super admin (one-time)

#### Scheduled Tasks (Admin)
- `POST /api/admin/refresh-bokun-cache` - Manual Bokun cache refresh
- `POST /api/admin/refresh-flight-prices` - Manual flight price refresh

---

## 4. Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `flight_packages` | Holiday packages | id (serial PK), title, slug (unique), category, countries (jsonb), tags (jsonb), price, singlePrice, bokunProductId, pricingModule, pricingDisplay, isPublished, isUnlisted, isSpecialOffer, cityTaxConfig (jsonb), mobileHeroVideo, desktopHeroVideo, customExclusions (jsonb), autoRefreshEnabled, flightRefreshConfig (jsonb), enabledHotelCategories (jsonb) |
| `package_pricing` | Manual pricing per airport/date | id, packageId (FK), departureAirport, departureAirportName, departureDate, price, flightPricePerPerson, landPricePerPerson, rateTitle, rateId |
| `package_seasons` | Seasonal pricing ranges | id, packageId (FK), seasonName, startDate, endDate, landCostPerPerson, hotelCostPerPerson |
| `bokun_departures` | Synced Bokun departure dates | id, packageId (FK), bokunProductId, departureDate, durationNights, availableSpots, isSoldOut |
| `bokun_departure_rates` | Rates per departure (twin/single/hotel category) | id, departureId (FK), rateTitle, roomCategory, hotelCategory, priceGbp, originalPrice, flightPriceGbp, combinedPriceGbp, departureAirport |
| `bokun_departure_rate_flights` | Flight prices per rate per UK airport | id, rateId (FK), airportCode, flightPriceGbp, combinedPriceGbp, markupApplied, flightSource (unique: rateId+airportCode) |
| `pricing_exports` | Pricing export history | id, packageId (FK), fileName, flightApiUsed, totalRows |
| `city_taxes` | City tax rates per destination | id, cityName, countryCode, pricingType (flat/star_rating), taxPerNightPerPerson, rate1Star-rate5Star, currency |
| `hotels` | Hotel library | id, name, description, starRating, amenities (jsonb), city, country, images (jsonb), sourceUrl, roomTypes (jsonb) |
| `flight_hotel_configs` | Flight+hotel package configs | id, packageId (unique FK), cities (jsonb), arrivalAirport, departureAirport, flightType, flightApiSource, ukAirports (jsonb), markup, searchStartDate, searchEndDate |
| `flight_hotel_prices` | Cached flight+hotel prices | id, packageId (FK), travelDate, ukAirport, roomType, flightPricePerPerson, hotels (jsonb), totalFlightCost, totalHotelCostPerPerson, finalPrice (unique: packageId+date+airport+roomType) |
| `flight_tour_pricing_configs` | Flight+tour pricing configs for Bokun tours | id, bokunProductId (unique), arriveAirportCode, departAirports, durationNights, markupPercent |

### Content Tables

| Table | Purpose |
|-------|---------|
| `blog_posts` | Blog articles with SEO fields (title, slug, content, metaTitle, metaDescription, destination) |
| `faqs` | Frequently asked questions (question, answer, displayOrder, isPublished) |
| `content_images` | Images for collections/destinations (type: collection/destination, name, imageUrl) |
| `reviews` | Customer reviews (customerName, location, rating 1-5, reviewText) |
| `newsletter_subscribers` | Email subscribers (email, source, isActive) |

### Commerce Tables

| Table | Purpose |
|-------|---------|
| `cart_items` | Shopping cart (session-based) |
| `bookings` | Booking records with Stripe/Bokun references |
| `package_enquiries` | Enquiries for flight packages (customer info, package ref, status, referrer) |
| `tour_enquiries` | Enquiries for Bokun tours (customer info, product ref, departure date, estimatedPrice, referrer) |

### System Tables

| Table | Purpose |
|-------|---------|
| `admin_users` | Admin accounts (email, passwordHash bcrypt, fullName, role, twoFactorSecret TOTP, twoFactorEnabled) |
| `admin_sessions` | Active admin sessions (sessionToken, userId, email, role, expiresAt) |
| `pending_2fa_sessions` | Temporary 2FA pending sessions (pendingToken, sessionType, userId, expiresAt) |
| `cached_products` | Bokun product cache (productId, data jsonb, cachedAt, expiresAt) |
| `cache_metadata` | Cache refresh timestamps (lastRefreshAt, totalProducts) |
| `site_settings` | Key-value site configuration (key unique, value, label, description) |
| `tracking_numbers` | DNI phone tracking numbers (phoneNumber, label, tag, referrerDomain, isDefault, isActive) |

### Media Asset Tables

| Table | Purpose |
|-------|---------|
| `media_assets` | Media library items (slug unique, originalUrl, storagePath, perceptualHash, mimeType, altText, photographer, license, source, externalId, isDeleted soft-delete) |
| `media_variants` | Resized media variants (assetId, variantType: original/hero/gallery/card/thumb/mobile_hero, width, height, quality, filepath, storageType, status) |
| `media_tags` | Tags for media assets (assetId, tagType: destination/hotel/category/keyword, tagValue, confidence, isPrimary) |
| `media_usage` | Where media is used (assetId, entityType, entityId, variantType, isPrimary, usageStatus) |
| `media_backups` | Media backup metadata (scope, snapshotPath, fileCount, totalSizeBytes, status) |
| `media_cleanup_jobs` | Cleanup operations with dry-run (jobType, status: draft/previewed/approved/executed/rolled_back, previewResults, backupId, rollbackToken) |

### Variant Presets (defined in schema.ts)
```
original: 0x0 @ q95 (inside)
hero: 1920x1080 @ q85 (cover)
gallery: 1280x0 @ q80 (inside, auto-height)
card: 800x600 @ q75 (cover)
thumb: 400x400 @ q70 (cover)
mobile_hero: 768x1024 @ q75 (cover)
```

---

## 5. Pricing System

### Pricing Modules (per package)

Each package uses one of five pricing modules, set via `pricingModule` field:

#### 1. Manual Pricing (`manual`)
- Admin enters prices directly per departure airport and date
- Stored in `package_pricing` table
- Supports CSV upload/download for bulk editing
- Simplest module, used for packages with fixed pricing

#### 2. European API Pricing (`european_api`)
- Flight prices fetched from Sunshine European Flight API
- Used for straightforward European routes with round-trip flights

#### 3. Open-Jaw Seasonal Pricing (`open_jaw_seasonal`)
- Seasons defined with date ranges and land costs
- Flight prices fetched from European or SERP API (configurable per package via `flightApiSource`)
- Supports round-trip, open-jaw, and open-jaw + internal flights
- Stored in `package_seasons` table
- Admin UI: inline season management with API source selection

#### 4. Bokun Departures + Flights (`bokun_departures`)
- Syncs departure dates and rates from Bokun API
- Fetches flight prices per UK airport per departure date
- Calculates combined price: `landCost + flightPrice + markup`
- Smart rounds to psychological prices (x49, x69, x99)
- Supports hotel category filtering via `enabledHotelCategories`
- Stored in `bokun_departures`, `bokun_departure_rates`, `bokun_departure_rate_flights`

#### 5. Flights + Hotels API (`flights_hotels_api`)
- Multi-city hotel + flight combined pricing
- Uses Sunshine Hotel API (HTLSEARCH) for hotel availability
- Uses Sunshine Flight API or SERP API for flights (configurable)
- Configuration stored in `flight_hotel_configs`
- Cached prices in `flight_hotel_prices`
- See [Flight + Hotel Combined Pricing Module](#flight--hotel-combined-pricing-module)

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
- `pricingDisplay` controls display mode: `both`, `twin`, or `single`

---

## 6. City Tax System

### How City Taxes Work

City taxes are local charges that hotels collect from guests. They vary by city, country, and hotel star rating.

### Configuration (Admin)
- City taxes configured in `city_taxes` table via Admin > City Taxes
- Each entry has: cityName, countryCode, currency, pricing type (flat or star_rating)
- Flat pricing: single rate for all hotels
- Star-rating pricing: different rates for 1-5 star hotels
- Currency can be any of 20 supported currencies

### Calculation Flow (CRITICAL - Do Not Break)

**Location:** `server/routes.ts` - `GET /api/packages/:slug/city-taxes`

1. Package has `cityTaxConfig` (jsonb) listing cities, nights per city, and optional star rating
2. For each city, system looks up the matching `city_taxes` entry
3. Tax rate is selected based on hotel star rating (if star_rating pricing type)
4. **Currency conversion to GBP** (via centralized `fetchExchangeRateToGbp()` helper):
   - If currency is `GBP`: no conversion needed (rate = 1)
   - If currency is `EUR`: uses admin-configured EUR-to-GBP rate
   - If currency is Frankfurter-supported: fetches live rate from Frankfurter API
   - If currency is unsupported (e.g. AED, HRK): uses hardcoded fallback rates
   - If no rate available at all: keeps raw amount and adds a warning to the response
5. All taxes are summed as GBP per person
6. Response includes GBP total, original foreign currency breakdowns, and any `warnings` array

### Exchange Rate Resolution Order
```
1. GBP -> rate = 1 (no conversion)
2. EUR -> admin-configured rate from site_settings
3. Frankfurter-supported currencies -> live API rate
4. Fallback rates (AED: 0.22, HRK: 0.11) -> hardcoded approximations
5. Unknown currency -> warning returned, raw amount kept
```

### Additional Charges
- Packages can have a separate "additional charge" (e.g., visa fees, port charges, resort fees)
- Stored on the package: `additionalChargeName`, `additionalChargeCurrency`, `additionalChargeForeignAmount`, `additionalChargeExchangeRate`
- Exchange rate is auto-fetched when admin selects a currency (via `fetchExchangeRateToGbp`)
- Exchange rate column: `numeric(16, 10)` - high precision to support currencies like IDR (rate ~0.000044)
- Converted to GBP using stored exchange rate on the frontend
- Displayed alongside city taxes in the price breakdown

### Frontend Display Format
```
£899 + £5.04 City taxes (€6.00 + Ft500 paid locally)
```

### Supported Currencies
```
EUR, USD, GBP, HRK, CZK, PLN, HUF, CHF, NOK, SEK, DKK,
TRY, AED, THB, INR, JPY, AUD, NZD, ZAR, IDR
```

---

## 7. Flight API Integration

### Dual Flight API System

The platform uses two flight pricing sources:

#### Sunshine European Flight API (Primary)
- **Base URL (Round-trip):** `http://87.102.127.86:8119/search/searchoffers.dll`
- **Base URL (One-way/Open-jaw):** `http://87.102.127.86:8119/owflights/owflights.dll`
- **Agent ID:** 122 (`agtid=122`)
- **File:** `server/flightApi.ts`
- **Used for:** European routes where Sunshine has inventory
- **Limitation:** Does NOT cover all European routes (e.g., STN-SUF may not be available)

#### SERP API / Google Flights (Alternative)
- **File:** `server/serpFlightApi.ts`
- **Used for:** Routes not covered by Sunshine, or any global route when explicitly configured
- **Requires:** `SERPAPI_KEY` secret
- **How it works:** Searches Google Flights via SerpApi. For a date range, it generates every departure date, batches them in groups of 10, and searches each concurrently
- **Supports:** Round-trip, open-jaw, and internal flight searches
- **Admin selection:** In Open-Jaw Seasonal module, admin chooses "European Flight API" or "SERP API (Google Flights)" per package
- **API endpoint:** `POST /api/admin/packages/fetch-serp-flight-prices`

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
- Refreshes flight prices for all packages with `autoRefreshEnabled` and `bokunDepartures` pricing module
- Uses saved configuration per package (`flightRefreshConfig`: destination airport, UK airports, markup, flight type)
- Supports both round-trip and open-jaw auto-refresh

---

## 8. Sunshine Hotel API Integration

### Files
- `server/sunshineHotelApi.ts` - Destination mapping API (country/resort/hotel lists)
- `server/hotelApi.ts` - Hotel availability/pricing API (HTLSEARCH)
- `server/sunshineStaticData.ts` - Pre-cached static resort data

### Agent ID: 122

### Destination Mappings (Static Data)
- Country list: `SearchOffers.dll?agtid=122&page=country` - returns all available countries with IDs
- Resort/hotel list: `SearchOffers.dll?agtid=122&page=resort&countryid=X` - returns full hierarchy
- Ski destinations: `SearchOffers.dll?agtid=122&page=skidest` - ski-specific destinations

### XML Structure Handling
The API returns XML with varying structures per country:
- **Standard:** `Region > Area > Resort > Hotel` (most countries)
- **Flat:** `Region > Area` with no Resort wrapper (e.g., Austria) - Areas are treated as Resorts, and Hotels may be nested directly under Areas
- The parser (`getSunshineDestinations()`) handles both structures automatically

### Hotel Search in Admin
- **Route:** `GET /api/admin/hotels/search` (**MUST be defined BEFORE `/:id` route in Express**)
- Uses destination mapping endpoint (`page=resort`) to get the static catalogue of hotels for a country
- Filters by resort/area
- This is the hotel directory, NOT availability search

### Resort Data Fallback
- Static resort data stored in `server/sunshineStaticData.ts`
- If no static data exists for a country, system fetches live data from Sunshine API (`getSunshineDestinations()`)
- Route: `GET /api/admin/sunshine/resorts/:countryId`

### Hotel Availability Search (HTLSEARCH)
- **File:** `server/hotelApi.ts`
- **Base URL:** `http://87.102.127.86:8119/hotels/search.dll`
- Searches actual hotel availability with dates, board basis, star ratings
- Used by the Flight+Hotel pricing module when pricing specific hotels
- Returns: hotel code, name, room type, total price, availability count

### Critical Route Ordering
The `/api/admin/hotels/search` route MUST be defined before `/api/admin/hotels/:id` in Express routes, otherwise Express matches "search" as an `:id` parameter. This was a critical bug fixed on 2026-02-12.

---

## 9. Flight + Hotel Combined Pricing Module

### Overview
**File:** `server/flightHotelPricing.ts`
**Pricing Module Value:** `flights_hotels_api`

Combines Sunshine Flight API (or SERP API) + Sunshine Hotel API for dynamic multi-city package pricing.

### How It Works
1. Admin configures multi-city itinerary with hotel preferences per city
2. System iterates through date range
3. For each date: fetches flights for all UK airports, then hotels for each city
4. Calculates twin share and single room prices
5. Applies markup and smart rounding
6. Caches results in `flight_hotel_prices` table

### Configuration Schema (flight_hotel_configs)
```json
{
  "cities": [
    {
      "cityName": "Rome",
      "nights": 3,
      "starRating": 4,
      "boardBasis": "BB",
      "specificHotelCode": "ROMHIL01"
    },
    {
      "cityName": "Florence",
      "nights": 2,
      "starRating": 4,
      "boardBasis": "BB"
    }
  ],
  "arrivalAirport": "FCO",
  "departureAirport": "FLR",
  "flightType": "openjaw",
  "flightApiSource": "european",
  "ukAirports": ["LGW", "STN", "LTN", "LHR", "MAN", "BHX"],
  "markup": 15,
  "searchStartDate": "2026-04-01",
  "searchEndDate": "2026-10-31"
}
```

### Hotel Selection
- **Preferred:** `specificHotelCode` - exact hotel code for consistent pricing
- **Fallback:** `hotelCodes` array - searches multiple hotels, picks cheapest

### Flight API Source
- `"european"` - Sunshine European Flight API
- `"serp"` - SERP API / Google Flights

---

## 10. Media Asset Management System

### Files
- `server/mediaService.ts` - Core media operations (sharp image processing)
- `server/imageProcessor.ts` - Package-specific image download/processing
- `server/objectStorage.ts` - Replit Object Storage wrapper
- `server/objectAcl.ts` - Object storage ACL policies

### Architecture
The media system provides centralized image management with:
- **Upload:** Direct uploads or URL imports
- **Processing:** Automatic variant generation using sharp
- **Storage:** Replit Object Storage for production, local filesystem for dev
- **Deduplication:** Perceptual hashing to detect similar images
- **Tagging:** Destination, hotel, category, and keyword tags
- **Usage Tracking:** Tracks where each image is used across packages, blogs, destinations
- **Cleanup:** Dry-run preview before deletion, with backup and rollback support
- **Soft Delete:** Media assets are soft-deleted (`isDeleted` flag)

### Variant Generation
When an image is uploaded/imported, the system generates multiple sizes:
- `original` - Full resolution, quality 95
- `hero` - 1920x1080, quality 85 (cover)
- `gallery` - 1280 wide, auto height, quality 80
- `card` - 800x600, quality 75 (cover)
- `thumb` - 400x400, quality 70 (cover)
- `mobile_hero` - 768x1024, quality 75 (cover)

### Media Serving
- **Route:** `GET /api/media/:slug/:variant`
- Returns the appropriate variant of a media asset
- Variants are stored as WebP format

---

## 11. Hotel Library & Scraping System

### Files
- `server/hotelScraperService.ts` - Website scraper (Cheerio-based)
- Admin page: `client/src/pages/AdminHotels.tsx`

### Features
- **Web Scraping:** Extracts hotel name, description, amenities, star rating, images from hotel websites
- **Rate Limiting:** 2-second minimum between requests to same domain
- **Gallery Discovery:** Auto-discovers gallery pages on hotel websites
- **Image Processing:** Downloaded images are processed through media service
- **Import from Packages:** Bulk-import hotel data from existing package accommodations
- **Deduplication:** Remove duplicate hotel entries
- **Image Verification:** Check if stored hotel image URLs are still valid

### Data Model
Hotels are stored independently and can be referenced across multiple packages:
- Name, description, star rating
- Amenities (JSON array)
- Address, city, country
- Images (JSON array of URLs)
- Room types (JSON array)
- Contact info (phone, email, website)
- Source URL for re-scraping

---

## 12. Stock Image Integration

### File
- `server/stockImageService.ts`

### Supported Providers
1. **Unsplash** - Requires `UNSPLASH_ACCESS_KEY` environment variable
2. **Pexels** - Requires `PEXELS_API_KEY` environment variable

### Features
- **Search:** Search both providers simultaneously
- **Import:** Download stock image and process through media service (generates all variants)
- **Auto-Import:** Automatically find and import images for a destination
- **Attribution:** Photographer name, URL, and license info stored with each imported image
- **Status Check:** `GET /api/admin/media/stock/status` reports which providers are configured

### Admin Endpoints
- `GET /api/admin/media/stock/search` - Search stock images
- `POST /api/admin/media/stock/import` - Import a specific stock image
- `POST /api/admin/media/stock/auto-import` - Auto-import for a destination

---

## 13. Enquiry System

### Package Enquiries
- **Submit:** `POST /api/packages/:slug/enquiry`
- **Schema:** firstName, lastName, email, phone, preferredDates, numberOfTravelers, message, referrer
- **Privyr CRM:** Enquiries are also forwarded to Privyr CRM via webhook
- **Referrer Tracking:** Captures external referring domain (e.g., travelzoo.com)

### Tour Enquiries (Bokun Tours)
- **Submit:** `POST /api/tours/:productId/enquiry`
- **Schema:** firstName, lastName, email, phone, departureDate, rateTitle, numberOfTravelers, estimatedPrice, message, referrer
- **Privyr CRM:** Also forwarded to Privyr

### Admin Management
- **View All:** `GET /api/admin/enquiries` - Combined list of package + tour enquiries
- **Status Tracking:** new → contacted → converted → closed

---

## 14. Tracking Numbers (DNI)

### Purpose
Dynamic Number Insertion - shows different phone numbers based on how visitors arrive at the site.

### Matching Logic
1. Check URL for tag parameter (e.g., `?tzl` matches tag `tzl`)
2. Check `document.referrer` for matching domain (e.g., `google.com`)
3. Fall back to default number (where `isDefault = true`)

### Schema
- `phoneNumber` - The phone number to display
- `label` - Admin reference (e.g., "TikTok Campaign")
- `tag` - URL parameter to match (e.g., "tzl" matches `?tzl`)
- `referrerDomain` - Referring domain to match (e.g., "google.com")
- `isDefault` - Fallback number
- `isActive` - Enable/disable

### API
- `GET /api/tracking-number` - Public endpoint, returns matching number based on query params
- Admin CRUD at `/api/admin/tracking-numbers`

---

## 15. SEO System

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
- `/sitemaps/tours.xml` - Bokun tours
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

## 16. Admin Authentication

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
- Rate limiting: login, 2FA verification, and password reset endpoints are rate-limited

---

## 17. External Services

| Service | Purpose | Auth Method |
|---------|---------|-------------|
| Bokun API | Tour data (search, details, availability, booking) | HMAC-SHA1 signature |
| Stripe | Payment processing (TEST mode) | Stripe secret key |
| Sunshine European Flight API | Flight prices (European routes) | Agent ID (122) |
| Sunshine Hotel API | Hotel destination mappings, search, availability | Agent ID (122) |
| SERP API / Google Flights | Flight prices (global, routes Sunshine doesn't cover) | `SERPAPI_KEY` secret |
| Frankfurter API | Live currency exchange rates | None (free, no key) |
| Privyr CRM | Contact form & enquiry webhook | Webhook URL |
| PostHog | User analytics & AI bot tracking | API key |
| Spotler Mail+ | Newsletter management | API credentials |
| Unsplash | Stock photography search & import | `UNSPLASH_ACCESS_KEY` |
| Pexels | Stock photography search & import | `PEXELS_API_KEY` |
| Replit Object Storage | Image/video storage | Built-in (no key) |
| Neon PostgreSQL | Database | Connection string (DATABASE_URL) |

---

## 18. Critical Flows (Do Not Break)

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
- Uses centralized `fetchExchangeRateToGbp()` with Frankfurter API + fallback rates
- If conversion fails for a currency, a warning is returned in the API response (never silently zero out)
- Never add raw foreign amounts as GBP (this was a critical bug, fixed 2026-02-06)

### Exchange Rate System
- **Centralized helper:** `fetchExchangeRateToGbp()` at top of `server/routes.ts`
- Resolution: GBP=1 -> EUR=admin rate -> Frankfurter API -> fallback map -> warning
- **Fallback rates** for unsupported currencies (AED, HRK) stored in `FALLBACK_RATES_TO_GBP`
- Admin-configurable USD-to-GBP rate (stored in `site_settings`) used for Bokun products
- Additional charge exchange rate stored per-package with `numeric(16, 10)` precision

### SEO Content Injection
**Files:** `server/seo/inject.ts`, `server/seo/routes.ts`
- Must only inject for bot user agents
- Must not break the React SPA for regular users
- Cache TTL: 5 minutes for SEO content

### Hotel Search Route Ordering
**File:** `server/routes.ts`
- `/api/admin/hotels/search` MUST be defined before `/api/admin/hotels/:id`
- Express matches parameters greedily - "search" would be captured as `:id` otherwise
- This was a critical bug fixed on 2026-02-12

### Media Asset Integrity
**Files:** `server/mediaService.ts`, `server/objectStorage.ts`
- Cleanup jobs must always create a backup before executing
- Dry-run (preview) must always precede actual execution
- Rollback capability must be maintained via rollback tokens

---

## 19. Change Log

### 2026-02-12
- **Fixed:** Hotel search route ordering - moved `/api/admin/hotels/search` before `/:id` to prevent Express matching "search" as an ID parameter
- **Redesigned:** Hotel search now uses Sunshine destination mapping API (`page=resort`) instead of local DB search, returning the full static hotel catalogue for a country filtered by resort/area
- **Enhanced:** Sunshine Hotel API XML parser to handle both standard nested structure (`Region > Area > Resort > Hotel`) and flat structure (`Region > Area` with hotels directly under Areas, e.g., Austria)
- **Added:** Dynamic resort data fallback - if no static data exists for a country in `sunshineStaticData.ts`, the system fetches live data from Sunshine API
- **Confirmed:** SERP API (Google Flights) working for routes not in Sunshine inventory (e.g., STN-SUF, 154 pricing entries generated successfully)
- **Documented:** Comprehensive architecture.md rewrite covering all systems: media library, hotel scraping, stock images, tracking numbers, enquiry system, flight+hotel module, all 195 API routes, all 50 frontend pages, all database tables

### 2026-02-07
- **Fixed:** Exchange rate saving to support currencies with many decimal places
- **Fixed:** Package saving to correctly handle pricing module options
- **Added:** Safety net for package pricing exchange rate updates

### 2026-02-06
- **Fixed:** City tax foreign currency conversion bug - non-EUR currencies (HUF, CZK, etc.) were being added as raw amounts instead of converting to GBP
- **Added:** Live exchange rate fetching via Frankfurter API for all non-EUR/non-GBP city tax currencies
- **Updated:** Frontend city tax display to show multi-currency breakdowns with proper currency symbols
- **Added:** Currency symbol map for 19 supported currencies in PackageDetail.tsx
- **Added:** Centralized `fetchExchangeRateToGbp()` helper with Frankfurter API + fallback rates for AED and HRK
- **Fixed:** Exchange rate column precision increased from `numeric(10,4)` to `numeric(16,10)` to support currencies like IDR (rate ~0.000044)
- **Removed:** Legacy columns `additionalChargeAmount` and `additionalChargeEurAmount` from schema
- **Added:** Warning system for unsupported currencies
- **Added:** Architecture reference document (initial version)

### Pre-2026-02-06 (Historical)
- Implemented Bokun Departures + Flights pricing module
- Added city tax system with multi-city support and star-rating pricing
- Built SEO system with bot detection and content injection
- Implemented admin authentication with 2FA (TOTP)
- Added AI-powered search with keyword indexing
- Built hotel library with web scraping
- Built media library with variant generation, tagging, usage tracking
- Implemented weekly auto-refresh scheduler for flight prices
- Added UK-intent destination SEO and collection pages
- Integrated Stripe payment processing (TEST mode)
- Added mobile hero video support for packages
- Added desktop hero video support
- Implemented PostHog analytics tracking with AI bot detection
- Added stock image integration (Unsplash + Pexels)
- Built tracking numbers (DNI) system
- Added package and tour enquiry system with Privyr CRM integration
- Built Flight + Hotel combined pricing module
- Added newsletter subscriber management with Spotler integration
- Implemented customer reviews system
- Built content image management for collections/destinations
- Added pricing CSV upload/download
- Implemented Bokun tour content import into packages
