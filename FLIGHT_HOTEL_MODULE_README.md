# Flight + Hotel API Module - Complete Documentation

## 📋 Overview

**What it does:** Combines Sunshine Flight API + Hotel API to create dynamic flight+hotel packages with real-time pricing, completely independent of Bokun.

**Key Benefits:**
- ✅ Full control over hotel selection (any hotel, any city)
- ✅ Dynamic pricing for both flights and hotels
- ✅ Support for multi-city itineraries
- ✅ Choice of flight APIs (Sunshine European or SERP/Google Flights)
- ✅ Weekly automatic price updates
- ✅ Zero impact on existing Bokun packages

---

## 🏗️ Architecture

```
Admin Panel
    ↓
Configure Package (cities, hotels, flights, dates)
    ↓
Fetch Prices
    ↓
┌─────────────────┬─────────────────┐
│  Flight API     │   Hotel API     │
│  (European/SERP)│   (Sunshine)    │
└────────┬────────┴────────┬────────┘
         │                 │
         └────────┬────────┘
                  ↓
         Combine + Markup
                  ↓
         Smart Rounding
                  ↓
         Store in Database
                  ↓
         Frontend Display
```

---

## 📊 Database Schema

### **flight_hotel_configs**
Stores configuration per package:
- Cities to visit (name, nights, star rating, board basis)
- Flight settings (airports, flight type, API source)
- Pricing (markup percentage)
- Date range
- Auto-refresh settings

### **flight_hotel_prices**
Caches calculated prices:
- Travel date + UK airport + room type (unique)
- Flight cost breakdown
- Hotel cost breakdown (per city)
- Final smart-rounded price

---

## 🔧 Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `server/hotelApi.ts` | Sunshine Hotel API integration | 130 |
| `server/flightHotelPricing.ts` | Combined pricing calculator | 430 |
| `shared/schema.ts` | Added flight+hotel schemas | 120 |
| `server/storage.ts` | Added 8 storage methods | 160 |
| `server/routes.ts` | Added 7 API endpoints | 130 |
| `server/scheduler.ts` | Added auto-refresh job | 60 |
| `migrations/add_flight_hotel_tables.sql` | Database migration | 100 |

**Total:** ~1,130 lines of new code

---

## 🚀 Quick Start Guide

### **Step 1: Database Migration**

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL -f migrations/add_flight_hotel_tables.sql
```

**Verify:**
```sql
SELECT COUNT(*) FROM flight_hotel_configs;
SELECT COUNT(*) FROM flight_hotel_prices;
-- Both should return 0 (empty tables)
```

---

### **Step 2: Deploy Code**

```bash
# Commit changes
git add .
git commit -m "Add Flight+Hotel API pricing module"

# Push to Replit
git push origin main
```

**Replit will:**
1. Pull latest code
2. Run `npm install` (no new dependencies)
3. Restart server
4. Initialize new scheduler job

---

### **Step 3: Create Test Package**

**In Admin Panel:**

1. **Create New Package:**
   - Title: "Test Golden Triangle"
   - Pricing Module: **"flights_hotels_api"** ← NEW OPTION
   - Save

2. **Configure Cities:**
   ```json
   [
     {
       "cityName": "Delhi",
       "nights": 2,
       "starRating": 4,
       "boardBasis": "BB"
     },
     {
       "cityName": "Agra",
       "nights": 1,
       "starRating": 5,
       "boardBasis": "BB"
     },
     {
       "cityName": "Jaipur",
       "nights": 2,
       "starRating": 4,
       "boardBasis": "BB"
     }
   ]
   ```

3. **Configure Flights:**
   - Flight API Source: **SERP** (for India) or **European** (for Europe)
   - Arrival Airport: DEL
   - Flight Type: roundtrip
   - UK Airports: LHR, MAN, BHX

4. **Set Pricing:**
   - Markup: 15%
   - Date Range: 01/06/2026 - 30/06/2026
   - Auto-Refresh: Enabled

5. **Fetch Prices:**
   - Click "Fetch Prices"
   - Wait 2-5 minutes
   - Check results in "Pricing" tab

---

## 📡 API Endpoints

### **Admin Endpoints (Require Auth)**

#### GET `/api/admin/packages/:id/flight-hotel-config`
Get configuration for a package.

**Response:**
```json
{
  "id": 1,
  "packageId": 42,
  "cities": [...],
  "arrivalAirport": "DEL",
  "flightApiSource": "serp",
  "markup": 15,
  "autoRefreshEnabled": true
}
```

---

#### POST `/api/admin/packages/:id/flight-hotel-config`
Save/update configuration.

**Request:**
```json
{
  "cities": [{"cityName": "Delhi", "nights": 2, "starRating": 4, "boardBasis": "BB"}],
  "arrivalAirport": "DEL",
  "flightType": "roundtrip",
  "flightApiSource": "serp",
  "ukAirports": ["LHR", "MAN"],
  "markup": 15,
  "searchStartDate": "2026-06-01",
  "searchEndDate": "2026-06-30",
  "autoRefreshEnabled": true
}
```

---

#### POST `/api/admin/packages/:id/fetch-flight-hotel-prices`
Trigger price calculation.

**Response:**
```json
{
  "success": true,
  "pricesCalculated": 120,
  "message": "Successfully calculated 120 prices"
}
```

---

#### GET `/api/admin/packages/:id/flight-hotel-prices`
Get all calculated prices.

**Query Params:**
- `roomType` (optional): "twin" or "single"

**Response:**
```json
[
  {
    "travelDate": "2026-06-15",
    "ukAirport": "LHR",
    "roomType": "twin",
    "flightPricePerPerson": 425.50,
    "totalHotelCostPerPerson": 245.00,
    "finalPrice": 799,
    "hotels": [...]
  }
]
```

---

### **Public Endpoint**

#### GET `/api/packages/:id/flight-hotel-availability`
Frontend uses this to display prices to customers.

**Query Params:**
- `roomType`: "twin" or "single"

**Response:**
```json
{
  "dates": ["2026-06-15", "2026-06-22", ...],
  "pricesByDate": {
    "2026-06-15": [
      {
        "ukAirport": "LHR",
        "flightPrice": 425.50,
        "hotelCost": 245.00,
        "finalPrice": 799,
        "hotels": [...]
      }
    ]
  }
}
```

---

## ⏰ Auto-Refresh Schedule

**When:** Every Sunday at 4:00 AM UK time

**What it does:**
1. Finds all packages with `autoRefreshEnabled: true`
2. For each package:
   - Fetches latest flight prices (from configured API)
   - Fetches latest hotel prices
   - Recalculates combined prices
   - Updates database
   - Updates `lastRefreshAt` timestamp
3. Logs results

**Monitor:**
```bash
# Check logs on Sunday mornings
grep "FlightHotel" /path/to/logs
```

---

## 💰 Pricing Calculation Flow

### **Example: Golden Triangle Package**

**Input:**
- Cities: Delhi (2N) → Agra (1N) → Jaipur (2N)
- Total: 5 nights
- Travel Date: 2026-06-15
- UK Airport: LHR

**Step 1: Fetch Flights**
```
SERP API → LHR to DEL (roundtrip, 5 nights)
Result: £425.50 per person
```

**Step 2: Fetch Hotels**
```
Hotel API → Delhi (2 nights, 4-star, BB)
Result: £160 per room = £80 per person

Hotel API → Agra (1 night, 5-star, BB)
Result: £150 per room = £75 per person

Hotel API → Jaipur (2 nights, 4-star, BB)
Result: £180 per room = £90 per person

Total: £245 per person
```

**Step 3: Calculate Price**
```
Flight:           £425.50
Hotels:           £245.00
─────────────────────────
Subtotal:         £670.50
Markup (15%):     £100.58
─────────────────────────
After Markup:     £771.08
Smart Round:      £799.00  ← Final price
```

---

## 🎛️ Configuration Options

### **Flight API Source**

| Option | Best For | Coverage | Cost |
|--------|----------|----------|------|
| **european** | European destinations | EU routes only | Included |
| **serp** | Worldwide | All routes | $0.002/search |

**Recommendation:**
- Europe packages → Use "european"
- India/Asia/Americas → Use "serp"

---

### **Board Basis Options**

| Code | Meaning |
|------|---------|
| RO | Room Only |
| BB | Bed & Breakfast |
| HB | Half Board (breakfast + dinner) |
| FB | Full Board (all meals) |

---

### **Flight Types**

| Type | Description | Example |
|------|-------------|---------|
| roundtrip | Same arrival/departure city | LHR → DEL → LHR |
| openjaw | Different cities | LHR → DEL, BOM → LHR |

---

## 🔍 Troubleshooting

### **"No hotels found for [city]"**

**Cause:** Hotel API returned no results for that city/date/criteria

**Fix:**
1. Check city name spelling
2. Try broader date range
3. Reduce star rating requirement
4. Remove specific hotel codes

---

### **"No flights found for [date]"**

**Cause:** Flight API returned no results

**Fix:**
1. Check airport codes are correct
2. Verify date is in future
3. Try different UK departure airports
4. Switch flight API source (european ↔ serp)

---

### **Prices seem incorrect**

**Check:**
1. Markup percentage (is 15% correct?)
2. Room type (twin vs single)
3. Hotel prices (per room or per person?)
4. Currency conversion

**Debug:**
```sql
SELECT
  travel_date,
  uk_airport,
  flight_price_per_person,
  total_hotel_cost_per_person,
  subtotal,
  markup_amount,
  final_price
FROM flight_hotel_prices
WHERE package_id = 42
ORDER BY travel_date, uk_airport
LIMIT 10;
```

---

### **Auto-refresh not running**

**Check:**
1. `autoRefreshEnabled` is true
2. Server logs for errors
3. Scheduler initialized: `grep "Scheduler" logs`
4. Wait for Sunday 4:00 AM UK time

---

## 📈 Performance Considerations

### **API Rate Limits**

**Built-in Protection:**
- 1 second delay between hotel searches
- 2 seconds delay between dates
- 3 seconds delay between packages

**Estimated Time:**
- 30 dates × 3 cities × 1 sec = 90 seconds per package
- 10 packages = 15 minutes total

---

### **Database Size**

**Formula:**
```
Rows = packages × dates × airports × room_types
```

**Example:**
- 10 packages
- 30 dates each
- 4 UK airports
- 2 room types (twin + single)
= 2,400 rows

**Storage:** ~500 KB (JSONB hotels data)

---

## 🎯 Best Practices

### **1. Start Small**
- Test with 1 package first
- Short date range (7-14 days)
- Few UK airports (2-3)

### **2. Monitor Costs**
If using SERP API:
- Each date × airport = 1 search
- 30 dates × 4 airports = 120 searches = $0.24
- Monitor usage in SerpApi dashboard

### **3. Optimize Hotel Selection**
- Specify `hotelCodes` if you know good hotels
- Use appropriate star ratings (don't always use 5-star)
- BB (bed & breakfast) is usually sufficient

### **4. Cache Strategy**
- Prices cached until next refresh
- Manual refresh clears old prices
- Auto-refresh updates weekly

---

## 🔐 Security

### **API Keys**
Required in Replit Secrets:
- `SERPAPI_KEY` (if using SERP flight API)

### **Admin Authentication**
All admin endpoints require:
- Valid admin session
- Verified 2FA

### **Rate Limiting**
Built into pricing calculator to prevent abuse.

---

## 📞 Support

**Issues?**
1. Check `FLIGHT_HOTEL_MODULE_SAFETY.md` for rollback procedures
2. Review server logs for specific errors
3. Verify API credentials in Replit Secrets

**Feature Requests:**
- Add to GitHub issues
- Tag as "flight-hotel-module"

---

**Version:** 1.0.0
**Last Updated:** 2026-02-06
**Status:** Production Ready ✅
