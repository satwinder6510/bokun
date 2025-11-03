# Tour Discoveries - Public Tour Booking Website

## Overview

A public-facing tour booking website showcasing 700+ curated tours from the Bokun API. The application provides a clean, minimal interface for browsing tours, viewing detailed itineraries with hotel information, checking availability with calendar-based date selection, and exploring pricing options. Built as a full-stack TypeScript application focused on user experience and visual appeal.

**Current Phase:** Phase 1 - Browse and explore only. Shopping cart and booking functionality planned for Phase 2.

## Recent Changes (November 3, 2025)

- **Security Update**: Implemented two-factor authentication (2FA) with authenticator app
  - Dashboard now requires password + 6-digit TOTP code from authenticator app
  - 2FA setup page at `/2fa-setup` displays QR code for scanning
  - Supports all standard authenticator apps (Google Authenticator, Authy, 1Password, etc.)
  - Two-step login flow: password verification → TOTP verification
  - Default password: `admin123` (configurable via VITE_ADMIN_PASSWORD)
  - TOTP secret stored in TOTP_SECRET environment variable
  - Session-based authentication using browser sessionStorage
  - Logout functionality to clear session and return to login page
  - Public users cannot access admin features without correct credentials
- **Implemented 30-Day Product Caching System**:
  - In-memory cache storing all products for 30 days to reduce API load
  - Auto-load products from cache on homepage (no manual action required)
  - Products served from cache when available, otherwise fetched from API
  - Note: Cache resets on server restart (in-memory storage)
- **Public Tour Pages**:
  - Homepage displays 700+ unique tours with search and filtering
  - Tour detail pages with comprehensive information:
    - Full tour descriptions with HTML formatting
    - Complete day-by-day itinerary breakdown
    - Hotel details by location (for multi-day tours)
    - Photo galleries with hero images
    - Availability checker with calendar date picker
    - Bookable extras and add-ons
  - Search functionality by destination or tour name with live feedback
  - Category filtering with formatted badge names
- **HTML Content Rendering**: Fixed display of tour descriptions, itineraries, and hotel details using dangerouslySetInnerHTML
- **Availability Tab**: Calendar-based date selection for checking tour availability and pricing
- **Default currency set to GBP** for all pricing displays
- **Category Name Formatting**: Display readable names (e.g., "Seat In Coach Tour" instead of "SEAT_IN_COACH_TOUR")
- Fixed HMAC signature generation to include query parameters for availability endpoint
- Improved error handling with proper HTTP status code propagation
- Schema updated to include `itinerary`, `customFields`, `bookableExtras`, and `pricingCategories` fields

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and dev server, configured for fast HMR and optimized production builds
- **Wouter** for lightweight client-side routing (single-page application pattern)

**UI Component System:**
- **shadcn/ui** component library (New York style variant) built on Radix UI primitives
- **Tailwind CSS** for utility-first styling with custom design tokens
- Custom design system following technical dashboard patterns inspired by Linear/Vercel
- Typography hierarchy using Inter (primary) and JetBrains Mono (code/monospace)

**State Management:**
- **TanStack Query v5** for server state management, API caching, and data synchronization
- React hooks for local component state
- Query client configured with disabled refetching (manual refresh pattern)

**Key Design Decisions:**
- Component-based architecture with reusable UI primitives
- Separation of concerns: presentational components vs. page-level logic
- Custom theming system with light/dark mode support via CSS variables
- Responsive design with mobile-first breakpoints

### Backend Architecture

**Server Framework:**
- **Express.js** with TypeScript for REST API endpoints
- ESM module system (type: "module" in package.json)
- Custom middleware for request logging with response time tracking

**API Design:**
- RESTful endpoints under `/api` namespace
- POST-based mutations for Bokun API interactions
- JSON request/response format
- Centralized error handling with structured error responses

**Bokun Integration:**
- HMAC-SHA1 signature authentication for Bokun API requests
- Custom signature generation using access key, secret key, timestamp, and full request path (including query parameters)
- Proxy pattern: backend acts as secure intermediary to hide API credentials from client
- Four primary integration points:
  - Connection testing endpoint (health check pattern)
  - Product search with pagination support
  - Product details retrieval by ID
  - Availability and pricing queries with date range filtering

**Security Approach:**
- API credentials (BOKUN_ACCESS_KEY, BOKUN_SECRET_KEY) stored as environment variables
- Credentials never exposed to client-side code
- Server-side signature generation prevents credential leakage

### Data Layer

**Storage Strategy:**
- In-memory storage implementation via `MemStorage` class
- Interface-based design (`IStorage`) allows for future database integration
- Currently supports basic user CRUD operations (foundation for future auth)

**Database Configuration:**
- **Drizzle ORM** configured for PostgreSQL integration
- Schema definition in TypeScript with Zod validation
- Migration system ready but minimal schema usage in current implementation
- Database provisioning expected via `DATABASE_URL` environment variable

**Data Validation:**
- **Zod schemas** for runtime type validation and parsing
- Shared schema definitions between frontend and backend
- Type-safe API contracts derived from Zod schemas

**Key Schema Entities:**
- `BokunProduct`: Product information from Bokun API
- `BokunProductSearchResponse`: Paginated search results with metadata
- `ConnectionStatus`: API health check response structure

### Build & Deployment

**Development Mode:**
- `tsx` for running TypeScript server code without compilation
- Vite dev server with HMR for frontend development
- Concurrent processes (dev server + API server)

**Production Build:**
- Frontend: Vite builds React app to `dist/public`
- Backend: esbuild bundles server code to `dist/index.js`
- Single Node.js process serves both static files and API
- Platform-agnostic deployment (node + external packages pattern)

**Replit-Specific Integrations:**
- Runtime error overlay plugin for development
- Cartographer plugin for code navigation
- Dev banner for Replit environment identification

## External Dependencies

### Third-Party Services

**Bokun API:**
- Test environment endpoint: `https://api.bokuntest.com`
- Authentication: HMAC-SHA1 signature-based
- Primary endpoints used:
  - `/activity.json/search` - Product search with pagination
- Response format: JSON with nested product objects

### Database & Infrastructure

**Neon Serverless PostgreSQL:**
- Serverless PostgreSQL via `@neondatabase/serverless` driver
- WebSocket-based connection for serverless environments
- Configured via Drizzle ORM but minimal current usage
- Connection pooling handled by Neon driver

### UI Component Libraries

**Radix UI Primitives (30+ components):**
- Unstyled, accessible component primitives
- Used for: dialogs, dropdowns, tooltips, accordions, tabs, etc.
- Provides ARIA-compliant, keyboard-navigable interactions

**Supporting Libraries:**
- `class-variance-authority` - Type-safe component variant system
- `cmdk` - Command palette component (for future search features)
- `embla-carousel-react` - Carousel/slider functionality
- `lucide-react` - Icon system (200+ icons)
- `react-day-picker` - Date picker component
- `vaul` - Drawer component for mobile interfaces

### Development Tools

**TypeScript Tooling:**
- Full-stack TypeScript with strict mode enabled
- Path aliases for clean imports (`@/`, `@shared/`)
- Incremental compilation with build info caching

**Code Quality:**
- PostCSS with Tailwind CSS and Autoprefixer
- ESLint/Prettier configuration implied by project structure

### Runtime Dependencies

- `date-fns` - Date formatting and manipulation
- `nanoid` - Unique ID generation
- `crypto` (Node.js built-in) - HMAC signature generation
- `connect-pg-simple` - PostgreSQL session store (infrastructure for future auth)

### Notable Architecture Decisions

**Why In-Memory Storage Initially:**
- Simplifies initial development and testing
- Interface design allows seamless migration to PostgreSQL
- User management infrastructure prepared but not critical for core API testing functionality

**Why Server-Side Bokun Proxy:**
- Protects API credentials from client exposure
- Enables secure signature generation
- Allows request/response transformation and caching opportunities

**Why Vite Over Other Bundlers:**
- Faster development experience with native ESM
- Excellent TypeScript and React support
- Simpler configuration compared to webpack
- Optimal for modern React applications