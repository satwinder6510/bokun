# Bokun API Testing Console

## Overview

A professional developer tool for testing and exploring the Bokun booking API. The application provides a clean, technical dashboard for verifying API connectivity, viewing connection status, and browsing available products from the Bokun test environment. Built as a full-stack TypeScript application with a focus on data presentation and immediate visual feedback.

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
- Custom signature generation using access key, secret key, and timestamp
- Proxy pattern: backend acts as secure intermediary to hide API credentials from client
- Two primary integration points:
  - Connection testing endpoint (health check pattern)
  - Product search with pagination support

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