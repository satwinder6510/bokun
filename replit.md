# Flights and Packages - Tours Booking Platform

## Overview

This project is a public-facing tour booking website for "Flights and Packages," showcasing over 700 curated tours from the Bokun API. The platform aims to provide a clear interface for browsing tours, viewing itineraries, checking availability, and exploring pricing. The long-term vision is to become a comprehensive tour booking platform, incorporating full booking functionality, a shopping cart, secure Stripe payments, and booking confirmations under the domain tours.flightsandpackages.com.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The platform features a clean, minimal design with a red/orange accent color (#E74C3C). Key UI elements include a compact, admin-configurable hero banner, redesigned tour cards, and horizontal scrolling category pills. The header is transparent with a backdrop blur, offering essential navigation. The footer provides destination, company, quick links, and contact details. A contact form integrates with Privyr CRM. Administrators can control the hero image with a fallback system.

### SEO Implementation

The platform includes comprehensive SEO optimization with dynamic meta tags, canonical URLs, Open Graph, and Twitter Cards managed via a central utility. Structured data (JSON-LD) is implemented for various content types, including `BreadcrumbList`, `TouristTrip`, `Article`, `FAQPage`, `TravelAgency`, `TouristDestination`, and `CollectionPage`. A content marketing blog is available at `/blog` with SEO-optimized URLs and content.

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
3.  **Bokun Departures + Flights Module:** Syncs Bokun departure dates and rates, auto-detects tour duration, and stores multiple rates per departure. Flight prices are stored per rate per UK airport, allowing calculation of combined prices with smart rounding.

The pricing calculation logic considers flight API data, internal flights, seasonal land/hotel costs, and a markup, with a 6am threshold for effective arrival date calculation.

## External Dependencies

### Third-Party Services

-   **Bokun API:** Tour data (search, details, availability, booking), authenticated via HMAC-SHA1. Bookings are reserved for external payment and confirmed post-Stripe.
-   **Stripe:** Payment processing via Stripe Elements (TEST mode).
-   **Privyr CRM:** Webhook integration for contact form submissions.
-   **PostHog:** User activity tracking and analytics with EU data residency.

### Database & Infrastructure

-   **Neon Serverless PostgreSQL:** Database operations via Drizzle ORM.
-   **Replit Object Storage:** For media library images.

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