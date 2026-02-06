# Bokun System Architecture

> **📚 Full System Documentation:** See `FLIGHT_HOTEL_MODULE_README.md` for complete module overview
>
> **This document:** Focus on TODAY'S changes (2026-02-06 session)

## Overview
Flight + Hotel pricing module for Bokun packages. Independent from core Bokun - uses external APIs to fetch and display flight+hotel combinations.

## Critical Constraint
**DO NOT modify Bokun core.** This module is completely separate and should not depend on or change Bokun's existing functionality.

---

# 🆕 Changes Made Today (2026-02-06)

## Problem We Solved
- **Original Issue:** Sunshine API returns XML, but we tried to parse as JSON → crash
- **User Insight:** Static data (countries/resorts) rarely change, dynamic data (hotels) needed real-time

## Solution Implemented
**Two-tier data strategy:**
1. **Static JSON** for countries/resorts (instant, no API calls)
2. **Dynamic XML API** for hotel searches (real-time pricing)

---

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

## What Changed Today

### 1. Created `sunshineStaticData.ts` (NEW FILE)
- 130 countries as JSON array
- 30+ European resorts with location IDs
- Instant loading, no XML parsing

### 2. Updated API Endpoints (`routes.ts`)
- `/api/admin/sunshine/countries` → Returns static JSON
- `/api/admin/sunshine/resorts/:countryId` → Filters static JSON
- `/api/admin/hotels/search` → Still uses XML API for real-time

### 3. Replaced UI Dropdowns with Autocomplete
- Added Command + Popover components (shadcn/ui)
- Type-to-search for countries (130 options)
- Type-to-search for cities (100+ per country)
- Much better UX than scrolling dropdowns

### 4. Fixed Dependencies
- Added `xml2js@^0.6.2` to package.json (was missing!)
- Added `@types/xml2js@^0.4.14` for TypeScript

### Configuration UI Flow (After Today's Changes)
1. Load countries (instant from static data)
2. Select country from autocomplete
3. Load resorts for that country (instant from static data)
4. Select city/resort from autocomplete
5. Configure nights and board basis
6. Optionally search and select specific hotel (dynamic API)
7. Add to itinerary with all location IDs stored

---

## 📋 Quick Reference

### To Add More Resorts
Edit `server/sunshineStaticData.ts` and append to `SUNSHINE_RESORTS`:
```typescript
{
  countryId: "3",
  regionId: "5",
  areaId: "12",
  resortId: "123",
  resortName: "Athens"
},
```

### To Fetch Resort IDs from API
```bash
curl "http://87.102.127.86:8119/Search/SearchOffers.dll?agtid=122&page=resort&countryid=3" | grep "Athens"
```

### Current Coverage
- **Countries:** 130 (all Sunshine supports)
- **Resorts:** 30+ European cities
- **Can expand:** Yes, just add to static arrays

---

## 🔗 Related Documentation
- `FLIGHT_HOTEL_MODULE_README.md` - Complete module guide (from previous sessions)
- `FLIGHT_HOTEL_MODULE_SAFETY.md` - Rollback procedures
- `design_guidelines.md` - UI/UX standards

---

## 💡 Key Learnings

### Why Static Data Works
- Countries/resorts change rarely (maybe once a year)
- Hotel prices change constantly (need real-time API)
- Static = instant loading, no rate limits, no errors
- Dynamic where it matters = accurate pricing

### Why XML Parser Needed
- Sunshine API only returns XML (despite docs mentioning JSON)
- Tried `output=JSON` parameter → still returns XML
- Must use xml2js with `mergeAttrs: true` option

### Why Autocomplete vs Dropdowns
- 130 countries in dropdown = bad UX
- 100+ resorts per country = worse UX
- Type-to-search = much better
- Uses shadcn/ui Command component (built on cmdk)
