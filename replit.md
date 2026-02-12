# Flights and Packages - Tours Booking Platform

## Overview

This project is a public-facing tour booking website for "Flights and Packages," showcasing over 700 curated tours from the Bokun API. The platform aims to provide a clear interface for browsing tours, viewing itineraries, checking availability, and exploring pricing. The long-term vision is to become a comprehensive tour booking platform, incorporating full booking functionality, a shopping cart, secure Stripe payments, and booking confirmations under the domain tours.flightsandpackages.com.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The platform features a clean, minimal design with a red/orange accent color. It includes a compact, admin-configurable hero banner, redesigned tour cards, and horizontal scrolling category pills. The header is transparent with a backdrop blur, and the footer provides essential company and contact details. A contact form integrates with Privyr CRM.

### SEO Implementation

The platform incorporates a modular server-side SEO system for dynamic meta tags, canonical URLs, Open Graph, and Twitter Cards. It uses structured data (JSON-LD) for `TouristTrip`, `BreadcrumbList`, `Organization`, `TravelAgency`, `TouristDestination`, and `CollectionPage` schemas. A multi-sitemap architecture and AI-friendly JSON feeds (`/feed/tours.json`, `/feed/packages.json`, `/feed/destinations.json`) are also implemented. Specific SEO enhancements are in place for UK-intent destinations and collection pages with guide-grade SEO, featuring inventory-driven FAQs and comprehensive JSON-LD.

### URL Structure

The URL structure supports both legacy and new SEO-friendly routes for various content types, ensuring compatibility with existing sites.

### Frontend Architecture

The frontend is built with React 18, TypeScript, Vite, and Wouter for routing. UI components are based on shadcn/ui (Radix UI) and styled with Tailwind CSS, with TanStack Query v5 managing server state. The design is component-based, reusable, and mobile-first.

### Backend Architecture

An Express.js application in TypeScript provides RESTful API endpoints, acting as a secure proxy for the Bokun API. It handles HMAC-SHA1 signatures, protects credentials, and integrates product search, details, availability, and pricing. Prices are displayed in GBP (£) with a configurable exchange rate and markup.

### Data Layer

Drizzle ORM with Neon Serverless PostgreSQL is used for all data persistence. Flight packages are stored in `flight_packages` with `package_pricing` for date-specific pricing.

### Dual Pricing

Flight packages support dual pricing for twin share and solo travelers, automatically detecting room types from Bokun tour rates. An admin setting controls the display of these prices.

### Local Charges System

A two-layer local charges system is implemented for flight packages:

1.  **City Taxes:** Auto-calculated from the `city_taxes` database table based on destination country, duration, and star rating. Supports per-city configuration via `cityTaxConfig` on each package, or auto-detection using the capital/highest-rate city for the destination country. A `cityTaxEnabled` boolean toggle (default: true) on each package allows selectively disabling city tax.
2.  **Additional Charges:** Package-specific charges (port fees, resort fees, etc.) stored directly on each package with `additionalChargeName`, `additionalChargeCurrency`, `additionalChargeForeignAmount`, and `additionalChargeExchangeRate` fields. Converted to GBP for display.

Both charge types are combined into a `totalLocalCharges` value. Card displays (Homepage featured packages, DestinationDetail, CollectionDetail, AI search results) show the total price inclusive of all local charges. Detailed breakdowns are shown only on the PackageDetail page. The admin panel provides a toggle to enable/disable city tax per package and fields to configure additional charges in foreign currency.

### Build & Deployment

Development uses `tsx` for the backend and Vite for the frontend. Production builds use Vite for the frontend and `esbuild` for the backend, served by a single Node.js process.

### Admin Authentication System

A multi-user admin authentication system with role-based access control (super_admin, editor) is implemented. It uses PostgreSQL for user and session management, requiring 2FA for all users.

### Dynamic Flight + Tour Pricing

The platform supports dynamic combined pricing for Bokun land tours and external flight prices, integrated into the Flight Packages admin workflow. A unified pricing module allows selecting between Manual Pricing, Open-Jaw Seasonal Pricing (with European Flight API or SERP API), and Bokun Departures + Flights Module (syncs Bokun dates/rates, stores flight prices per UK airport using Sunshine European Flight API for round-trip and open-jaw flights).

### Sunshine Hotel API Integration

The system integrates with the Sunshine Hotel API for hotel destination mappings (country, resort/hotel lists) and hotel availability searches.

### Automatic Weekly Flight Price Refresh

Packages using the Bokun Departures + Flights module can have their flight prices automatically refreshed weekly via a node-cron scheduler using the Sunshine European Flight API.

### AI-Powered Search Feature

An AI-Powered Search (accessible via API at `/api/ai-search`) filters flight packages and Bokun tours based on destination, duration, budget, holiday type (with keyword indexing and synonym expansion), and number of travelers. It uses a scoring algorithm to balance results and dynamically filters holiday types based on selected destinations.

## External Dependencies

-   **Bokun API:** Tour data, availability, and booking (authenticated via HMAC-SHA1).
-   **Stripe:** Payment processing (TEST mode).
-   **Privyr CRM:** Contact form submissions and enquiry management.
-   **PostHog:** User activity tracking and analytics.
-   **Sunshine European Flight API:** Primary flight pricing for European routes (round-trip and one-way).
-   **SERP API / Google Flights:** Alternative worldwide flight pricing, including open-jaw and internal flights.
-   **Sunshine Hotel API:** Hotel destination mappings, search, and availability.
-   **Unsplash & Pexels:** Stock photography search and import for media library.
-   **Neon Serverless PostgreSQL:** Database operations via Drizzle ORM.
-   **Replit Object Storage:** Storage for media library images and videos.
-   **Radix UI Primitives, shadcn/ui, embla-carousel-react, lucide-react, react-day-picker:** UI Component Libraries.