# Flights and Packages - Tours Booking Platform

## Overview

This project is a public-facing tour booking website for "Flights and Packages," showcasing over 700 curated tours sourced from the Bokun API. The platform aims to provide a clean, minimal interface for users to browse tours, view detailed itineraries with hotel information, check availability using a calendar-based system, and explore various pricing options.

The business vision is to offer a premier travel booking experience, initially focusing on tour discovery and exploration (Phase 1). Future ambitions include integrating shopping cart functionality and booking capabilities (Phase 2) to become a comprehensive tour booking platform under the custom domain tours.flightsandpackages.com.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The design follows a clean, minimal aesthetic with a focus on user experience. A complete visual redesign inspired by https://demo.flightsandpackages.com/flightsandpackages/ has been implemented, featuring a primary accent color of red/orange (#E74C3C). Key UI elements include a fullscreen hero carousel with auto-advancing featured tours, redesigned tour cards with image backgrounds and gradient overlays, and horizontal scrolling category pills. The header is transparent with a backdrop blur effect and includes clickable navigation (Home, Destinations dropdown, Contact). The footer displays all destinations in a responsive multi-column grid, company info, quick links, and contact details. The platform supports dynamic meta tags for SEO, structured data (Schema.org JSON-LD), and Open Graph tags. A multi-currency selector is available, with currency preferences persisted in local storage. Contact form integration with Privyr CRM webhook at /contact enables lead capture.

### Frontend Architecture

The frontend is built with **React 18** and **TypeScript**, using **Vite** for fast HMR and optimized builds. **Wouter** handles client-side routing. The UI component system leverages **shadcn/ui** (New York style variant) built on Radix UI primitives, styled with **Tailwind CSS**. **TanStack Query v5** manages server state, API caching, and data synchronization. The architecture is component-based, emphasizing reusability and separation of concerns, with a responsive, mobile-first design.

### Backend Architecture

The backend is an **Express.js** application written in TypeScript, providing RESTful API endpoints under the `/api` namespace. It acts as a secure intermediary (proxy pattern) for interactions with the Bokun API, protecting credentials and generating HMAC-SHA1 signatures server-side. Key integration points include connection testing, product search with pagination, product details retrieval, and availability/pricing queries. API credentials are stored as environment variables.

**Multi-Currency Support:** The platform supports 5 currencies (USD, EUR, GBP, CAD, INR) with server-side currency conversion via Bokun API and automatic geo-location detection. On first visit, the user's location is detected via IP geolocation (ipapi.co) to set the appropriate currency: USD for USA, CAD for Canada, GBP for UK, EUR for Eurozone countries, and INR for India. The search endpoint accepts a `currency` query parameter which is included in the HMAC signature. 

**Performance Optimization:** First-time loads return the first 100 products immediately (~2-3 seconds), while remaining products are cached in the background. Per-currency caching is implemented: once a currency is fully fetched, it's cached for 30 days, providing instant switching between previously viewed currencies. Currency selection is persisted in local storage.

### Data Layer

An in-memory storage system (`MemStorage`) is used for initial development, with an interface-based design to facilitate future migration to a persistent database. **Drizzle ORM** is configured for PostgreSQL integration (using Neon Serverless PostgreSQL), with schema definitions in TypeScript and **Zod** for runtime validation.

### Build & Deployment

Development uses `tsx` for the backend and Vite for the frontend, with concurrent processes. Production builds involve Vite for the frontend (output to `dist/public`) and `esbuild` for the backend (output to `dist/index.js`), served by a single Node.js process.

## External Dependencies

### Third-Party Services

-   **Bokun API:** Used for tour data, including searching, retrieving details, and checking availability. Authenticated via HMAC-SHA1 signatures.
-   **Privyr CRM:** Integrated for handling contact form submissions via a secure webhook.

### Database & Infrastructure

-   **Neon Serverless PostgreSQL:** Configured for database operations via Drizzle ORM, utilizing a WebSocket-based connection.

### UI Component Libraries

-   **Radix UI Primitives:** Provides accessible, unstyled UI components (e.g., dialogs, dropdowns).
-   **shadcn/ui:** Component library built on Radix UI and styled with Tailwind CSS.
-   **embla-carousel-react:** For carousel functionality.
-   **lucide-react:** Icon system.
-   **react-day-picker:** Date picker component.

### Supporting Libraries

-   **class-variance-authority:** For type-safe component variants.
-   **nanoid:** For unique ID generation.
-   **date-fns:** For date formatting and manipulation.