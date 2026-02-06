# Bokun System Architecture

## Overview
Flight + Hotel pricing module for Bokun packages. Independent from core Bokun - uses external APIs to fetch and display flight+hotel combinations.

## Critical Constraint
**DO NOT modify Bokun core.** This module is completely separate and should not depend on or change Bokun's existing functionality.

## Tech Stack
- **Frontend**: React (client/src/pages/AdminPackages.tsx)
- **Backend**: Express (server/routes.ts)
- **Database**: PostgreSQL via Drizzle ORM
- **APIs**:
  - Sunshine API (European flights + hotels) - XML format only
  - SERP API (Google Flights) - JSON format

## Key Files

### Frontend
- `client/src/pages/AdminPackages.tsx` - Main admin UI for package configuration
  - Lines 5040-5320: Flight + Hotel API Module UI
  - Autocomplete for country/city selection using Command + Popover components

### Backend
- `server/routes.ts` - API endpoints
  - Line 10337+: Sunshine country/resort endpoints (static data)
  - Line 10368+: Hotel search endpoint (dynamic API)
- `server/sunshineHotelApi.ts` - Sunshine API integration (XML parsing)
- `server/sunshineStaticData.ts` - Static country/resort lookup tables
- `server/flightHotelPricing.ts` - Core pricing logic
- `server/flightApi.ts` - Flight API integrations

### Database
- `shared/schema.ts` - Drizzle schema definitions
  - `flight_hotel_configs` table - Package configuration
  - `flight_hotel_prices` table - Cached pricing data

## Data Flow

### Configuration
1. Admin selects country (static JSON from `SUNSHINE_COUNTRIES`)
2. Admin selects city/resort (static JSON from `SUNSHINE_RESORTS`)
3. Admin configures: nights, board basis, optional specific hotel
4. Saves to `flight_hotel_configs` table with location IDs

### Price Fetching
1. System reads config from database
2. Calls Sunshine API for hotels (XML → parsed with xml2js)
3. Calls flight APIs (Sunshine European or SERP)
4. Combines prices and stores in `flight_hotel_prices` table

### Frontend Display
1. Package detail page fetches prices from database
2. Groups by travel date
3. Shows flight + hotel combinations with total price

## API Integration Strategy

### Static Data (Instant)
- **Countries**: 130 countries in `SUNSHINE_COUNTRIES` array
- **Resorts**: 30+ European cities in `SUNSHINE_RESORTS` array
- **Why**: Avoids slow XML API calls for relatively static data

### Dynamic Data (Real-time)
- **Hotel Search**: Live API call to get availability/pricing
- **Flight Search**: Live API call for current prices
- **Why**: Prices change constantly, need real-time data

## Important Notes

### Sunshine API
- **Agent ID**: 122 (use in all requests)
- **Output Format**: XML only (despite docs mentioning JSON)
- **XML Parser**: xml2js with `mergeAttrs: true`
- **Endpoints**:
  - Countries: `?agtid=122&page=country`
  - Resorts: `?agtid=122&page=resort&countryid=X`
  - Hotels: `?agtid=122&page=HTLSEARCH&countryid=X&regionid=Y&areaid=Z&resortid=W&...`

### Open-Jaw Flights
- Makes two separate one-way API calls
- Outbound: UK → Destination
- Return: Departure Airport → UK
- Combined for total price

## Recent Changes

### 2026-02-06: Static Data Implementation
- Replaced XML API calls with static JSON for countries/resorts
- Keeps hotel search dynamic for real-time pricing
- Added autocomplete UI with Command + Popover components
- Added xml2js dependency to package.json

### Configuration UI Flow
1. Load countries (instant from static data)
2. Select country from autocomplete
3. Load resorts for that country (instant from static data)
4. Select city/resort from autocomplete
5. Configure nights and board basis
6. Optionally search and select specific hotel (dynamic API)
7. Add to itinerary with all location IDs stored

## Extending the System

### Adding More Resorts
Simply append to `SUNSHINE_RESORTS` array in `server/sunshineStaticData.ts`:
```typescript
{
  countryId: "3",
  regionId: "5",
  areaId: "12",
  resortId: "123",
  resortName: "Athens"
},
```

### Adding New Flight APIs
1. Create integration in `server/flightApi.ts`
2. Add to `flightHotelApiSource` type in schema
3. Update pricing logic in `server/flightHotelPricing.ts`

## Dependencies to Note
- `xml2js` - Required for Sunshine API XML parsing
- `@types/xml2js` - TypeScript definitions
- `cmdk` - Powers the autocomplete Command component

## Common Tasks

### Debugging API Issues
1. Check server logs for API URLs being called
2. Test API directly with curl
3. Verify XML structure with xml2js parser options

### Adding New Countries/Cities
1. Fetch from Sunshine API manually
2. Parse XML to get IDs
3. Add to static data arrays
4. Commit and push
