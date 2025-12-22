# Flights and Packages - Tours Booking Platform

## Overview

This project is a public-facing tour booking website for "Flights and Packages," offering over 700 curated tours from the Bokun API. The platform provides a clean interface for browsing tours, viewing itineraries, checking availability, and exploring pricing. The business vision is to evolve into a comprehensive tour booking platform with full booking functionality, shopping cart, secure Stripe payments, and booking confirmations under the domain tours.flightsandpackages.com.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The design is clean and minimal, featuring a visual redesign with a red/orange accent color (#E74C3C). Key UI elements include a compact static hero banner (50-60vh height) with admin-configurable background image, redesigned tour cards, and horizontal scrolling category pills. The header is transparent with a backdrop blur, offering navigation (Home, Destinations dropdown, FAQ, Blog, Contact). The footer displays destinations, company info, quick links, and contact details. A contact form integrates with Privyr CRM.

**Hero Image Control:** Administrators can upload a custom hero image via `/admin/settings`. The fallback chain is:
1. Admin-configured hero image (first priority)
2. Featured package image (second)
3. Tour image (third)
4. Static fallback image (last)

### SEO Implementation

Comprehensive SEO optimization is implemented across all pages:

-   **Meta Tags Utility (`client/src/lib/meta-tags.ts`):** Centralized functions for managing dynamic meta tags, canonical URLs, Open Graph tags, and Twitter Cards.
-   **Structured Data (JSON-LD):** Multiple schema types using the `@graph` pattern:
    -   `BreadcrumbList` on all detail pages for navigation hierarchy
    -   `TouristTrip` / `TravelAction` on tour and package detail pages
    -   `Article` on blog posts with author, publisher, and date info
    -   `FAQPage` on FAQ page
    -   `TravelAgency` / `Organization` on homepage
    -   `TouristDestination` on destination pages
    -   `CollectionPage` on collection pages
-   **Canonical URLs:** Case-preserving canonical links match actual routes (e.g., `/Holidays/india` not `/holidays/india`)
-   **Default OG Image:** Fallback image (`/og-image.jpg`) for pages without specific images
-   **Twitter Cards:** Large summary cards with title, description, and image on all pages

A content marketing blog is implemented at `/blog` with SEO-optimized URLs (`/blog/:slug`), featuring HTML-formatted posts, excerpts, featured images, author attribution, reading time, and comprehensive meta tags.

### URL Structure (Migration-Compatible)

The URL structure is designed for compatibility with an existing site to prevent broken links.

-   **Flight Packages:** `/packages`, `/packages/:slug` (legacy), `/Holidays/:country/:slug` (new SEO-friendly)
-   **Destinations & Collections:** `/Holidays` (country listing), `/Holidays/:country` (country detail), `/holidays` (collections listing), `/holidays/:tag` (collection detail)
-   **Other Routes:** `/tours` (Bokun products), `/tour/:id` (Tour detail), `/blog`, `/blog/:slug`, `/contact`, `/faq`, `/terms`.

Package cards use `/Holidays/:country/:slug`.

### Frontend Architecture

Built with **React 18** and **TypeScript**, using **Vite** for builds and **Wouter** for routing. The UI uses **shadcn/ui** (New York style) built on Radix UI, styled with **Tailwind CSS**. **TanStack Query v5** manages server state. The design is component-based, reusable, and mobile-first.

A shared `Header` component (`client/src/components/Header.tsx`) ensures consistent navigation across all pages, including dynamic phone numbers, Tidio chat integration, and mobile responsiveness.

### Backend Architecture

An **Express.js** application in TypeScript provides RESTful API endpoints under `/api`. It acts as a secure proxy for the Bokun API, handling HMAC-SHA1 signatures and protecting credentials. Integrations include product search, details, availability, and pricing.

All prices are displayed in GBP (£) for the UK market. Bokun API USD prices are converted using an admin-configurable exchange rate (default: 0.75) stored in `site_settings`, plus a 10% markup. The admin panel (`/admin/settings`) allows exchange rate adjustment. Frontend must not pass a currency parameter to API calls as the server handles USD conversion.

Performance is optimized by initially returning 100 products, with remaining products cached in the background (USD cache, 30-day TTL).

### Data Layer

An in-memory storage system (`MemStorage`) is used during development, with an interface for future persistence. **Drizzle ORM** is configured for **Neon Serverless PostgreSQL** with TypeScript schema definitions and **Zod** for validation.

Flight packages are stored in the `flight_packages` table with `package_pricing` for date-specific pricing (departure airport, date, price). The admin panel (`/admin/packages`) includes a "Pricing" tab for managing these entries.

### Dual Pricing (Twin Share vs Solo)

Flight packages support dual pricing for different room types:
-   **Twin Share Price (`price`):** Price per person when 2 people share a room (required)
-   **Solo Traveller Price (`singlePrice`):** Price per person for single occupancy (optional)
-   **Pricing Display (`pricingDisplay`):** Controls which prices to show - "both", "twin", or "single"

When importing a Bokun tour, the system automatically detects room types from the rates array:
-   Rates with `minPerBooking: 2` → Twin share / double room pricing
-   Rates with `minPerBooking: 1` → Single room / solo traveller pricing

The admin panel includes a "Pricing Display" dropdown to control which prices appear on the frontend. Options:
-   **Show Both Prices:** Displays both twin share and solo pricing side by side
-   **Twin Share Only:** Shows only the twin share price
-   **Solo Traveller Only:** Shows only the solo price

### Build & Deployment

Development uses `tsx` for backend and Vite for frontend. Production builds use Vite for frontend (`dist/public`) and `esbuild` for backend (`dist/index.js`), served by a single Node.js process.

### Admin Authentication System

A multi-user admin authentication system with role-based access control is implemented.

-   **Admin Users:** Stored in `admin_users` (PostgreSQL) with email, bcrypt-hashed passwords, and TOTP secrets for 2FA.
-   **Roles:** `super_admin` (full access) and `editor` (content management).
-   **Session Management:** 24-hour session tokens are stored in `admin_sessions` (PostgreSQL) and extended on each request.
-   **2FA Flow:** New users set up 2FA on first login; returning users verify with an authenticator app.

### Dynamic Flight + Tour Pricing

The platform supports dynamic combined pricing for Bokun land tours with external flight prices, integrated into the Flight Packages admin workflow.

**Admin Workflow (`Flight Packages` → `Pricing Tab`):**
1.  Import Bokun Tour.
2.  Configure Flight Settings: Destination Airport Code, Departure Airports, Duration, Date Range, Markup %.
3.  "Fetch Flight Prices & Save to Package": Fetches live flight prices, combines with Bokun land tour price (with 10% markup), applies configured markup, smart-rounds to x49, x69, or x99, and populates `package_pricing`.

**Pricing Calculation Flow:**
1.  Flight prices from external API.
2.  Land Tour Price from Bokun (with 10% markup).
3.  Combined Price: `(Flight Price + Land Tour Price) * (1 + Markup%)`.
4.  Smart Rounding.

The external flight API requires IP whitelisting.

## External Dependencies

### Third-Party Services

-   **Bokun API:** Tour data (search, details, availability, booking). Authenticated via HMAC-SHA1. A 10% markup is applied to all per-person prices from Bokun. Bookings are reserved with Bokun using `RESERVE_FOR_EXTERNAL_PAYMENT` and then confirmed after Stripe payment verification.
-   **Stripe:** Payment processing via Stripe Elements (TEST mode). Payment amounts are derived server-side.
-   **Privyr CRM:** Webhook integration for contact form submissions.

### Database & Infrastructure

-   **Neon Serverless PostgreSQL:** Database operations via Drizzle ORM.
-   **Replit Object Storage:** For media library images, enabling instant production availability upon upload.

### Media Library Storage

Supports `local` storage (legacy) and `object_storage` (Replit Object Storage at `/objects/media/`) for immediate production access. A migration system tracks `storage_type` and allows migrating local files to Object Storage.

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

### PostHog Analytics

Comprehensive user activity tracking is implemented using PostHog (EU data residency).

**Configuration (`client/index.html`):**
-   EU data residency (`eu.i.posthog.com`)
-   `capture_pageview: false` (using custom route-based hook)
-   Session recording enabled with input masking
-   Autocapture enabled for CSS selectors

**Utility (`client/src/lib/posthog.ts`):**
Centralized, typed event tracking functions:
-   `capturePageView(pageType, properties)` - Page view with route context
-   `capturePackageViewed(properties)` - Flight package detail views
-   `captureTourViewed(properties)` - Bokun tour detail views
-   `captureCtaClicked(ctaType, pageType)` - CTA button clicks
-   `captureNewsletterSignup(success, email)` - Newsletter subscriptions
-   `captureContactFormSubmitted(success, properties)` - Contact form submissions
-   `captureEnquirySubmitted(success, properties)` - Package enquiry forms
-   `captureDestinationViewed(properties)` - Destination clicks on homepage
-   `captureDateSelected(tourId, properties)` - Flight pricing calendar date selection
-   `captureScrollDepth(depth, pageType, properties)` - Scroll depth milestones (25%, 50%, 75%, 100%)

**Hooks (`client/src/hooks/`):**
-   `usePostHogPageView` - Automatic page view tracking on route changes
-   `useScrollDepth` - Reusable scroll depth tracking with configurable thresholds, using refs to prevent duplicate events

**Events Tracked:**
-   `$pageview` - Automatic route tracking via `usePostHogPageView` hook
-   `package_viewed` - Package detail page with ID, title, country, price
-   `tour_viewed` - Tour detail page with ID, title, duration, price
-   `cta_clicked` - Call/chat/enquire button clicks
-   `newsletter_signup` - Success/failure with email domain
-   `contact_form_submitted` - Contact page submissions
-   `enquiry_submitted` - Package enquiry form submissions
-   `destination_viewed` - Homepage destination clicks with name and package count
-   `date_selected` - Flight pricing calendar date selections with airport and price
-   `scroll_depth` - User scroll milestones (25%, 50%, 75%, 100%) on package and tour detail pages