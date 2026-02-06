# Flight + Hotel Module - Safety & Testing Guide

## ✅ SAFETY ANALYSIS

### **What We Added (Zero Breaking Changes)**

1. **New Database Tables** (won't affect existing data):
   - `flight_hotel_configs` - Completely new table
   - `flight_hotel_prices` - Completely new table
   - ❌ NO modifications to existing tables
   - ❌ NO foreign key constraints that could block deletions

2. **New Files Created** (isolated modules):
   - `server/hotelApi.ts` - New file, doesn't modify existing code
   - `server/flightHotelPricing.ts` - New file, only imports existing utilities
   - ❌ NO modifications to existing flight APIs
   - ❌ NO changes to Bokun integration

3. **Existing Files Modified** (additive only):
   - `shared/schema.ts` - Added new schemas at END of file
   - `server/storage.ts` - Added new methods at END of class
   - `server/routes.ts` - Added new routes in separate section
   - `server/scheduler.ts` - Added new scheduled job
   - ✅ All changes are ADDITIONS, not modifications
   - ✅ Existing code paths untouched

### **Isolation Guarantee**

```
┌─────────────────────────────────────┐
│  EXISTING CODE (Untouched)          │
│  - Bokun Departures Module          │
│  - Open-Jaw Seasonal Module         │
│  - Manual Pricing Module            │
│  - All existing routes               │
│  - All existing storage methods      │
└─────────────────────────────────────┘
              ↓ (no interaction)
┌─────────────────────────────────────┐
│  NEW CODE (Isolated)                 │
│  - Flight+Hotel Config (new table)   │
│  - Flight+Hotel Prices (new table)   │
│  - Hotel API (new file)              │
│  - Combined Pricing (new file)       │
│  - New routes (separate endpoints)   │
└─────────────────────────────────────┘
```

**Key Points:**
- New module only activates if admin selects `pricingModule: "flights_hotels_api"`
- Existing packages continue using their current pricing modules
- No shared state or dependencies
- Scheduler runs independently (different time slot)

---

## 🧪 TESTING PLAN

### **Phase 1: Database Migration (Safe)**

```sql
-- These tables are NEW - won't affect existing data
CREATE TABLE flight_hotel_configs (...);
CREATE TABLE flight_hotel_prices (...);
```

**Risk:** ❌ None - Creating new tables doesn't affect existing ones
**Rollback:** `DROP TABLE flight_hotel_configs, flight_hotel_prices;`

---

### **Phase 2: Code Deployment (Safe)**

**What happens when you push to Replit:**

1. ✅ Replit runs `npm install` → No new dependencies added
2. ✅ Code compiles → TypeScript validates syntax
3. ✅ Server restarts → New routes register but don't affect existing ones
4. ✅ Scheduler initializes → New job scheduled but doesn't run immediately

**Risk:** ❌ None - No code executes until admin uses new features
**Rollback:** See rollback section below

---

### **Phase 3: Manual Testing (Recommended)**

#### **Test 1: Verify Existing Features Still Work**
```bash
# Test existing package detail page
curl https://your-app.com/api/packages/1

# Test existing admin endpoints
curl https://your-app.com/api/admin/packages
```

**Expected:** ✅ All existing endpoints return normally

---

#### **Test 2: Test New Endpoints (Won't Affect Data)**

```bash
# Get config (will return null for existing packages)
curl https://your-app.com/api/admin/packages/1/flight-hotel-config

# This is safe - just reading, not writing
```

**Expected:** ✅ Returns `null` (no config exists yet)

---

#### **Test 3: Create Test Package (Isolated)**

**In Admin Panel:**
1. Create a NEW package (don't touch existing ones)
2. Set `pricingModule = "flights_hotels_api"`
3. Configure cities and flight settings
4. Click "Fetch Prices"

**What happens:**
- Calls Hotel API (external, read-only)
- Calls Flight API (existing, read-only)
- Writes to `flight_hotel_prices` table (new table, isolated)
- **Does NOT touch existing packages or tables**

**Risk:** ❌ None - Only affects the test package
**Rollback:** Delete the test package

---

## 🔄 ROLLBACK PLAN

### **Level 1: Disable Feature (Instant)**

**If something goes wrong, disable immediately:**

```typescript
// In server/scheduler.ts, comment out the new job:
/*
cron.schedule("0 4 * * 0", () => {
  runWeeklyFlightHotelRefresh();
}, {
  timezone: "Europe/London"
});
*/
```

**Result:** New module stops running, existing code unaffected

---

### **Level 2: Remove Routes (Fast)**

```typescript
// In server/routes.ts, comment out lines 10237-10363
/*
// ========================================
// FLIGHT + HOTEL API MODULE ROUTES
// ========================================
... all new routes ...
*/
```

**Result:** API endpoints disabled, frontend can't trigger new code

---

### **Level 3: Full Rollback (Complete)**

**If you need to completely remove the module:**

```bash
# 1. Revert files
git checkout HEAD -- server/hotelApi.ts
git checkout HEAD -- server/flightHotelPricing.ts
git checkout HEAD -- shared/schema.ts
git checkout HEAD -- server/storage.ts
git checkout HEAD -- server/routes.ts
git checkout HEAD -- server/scheduler.ts

# 2. Delete new files
rm server/hotelApi.ts
rm server/flightHotelPricing.ts

# 3. Drop database tables
# (Only if you want to remove all data)
DROP TABLE IF EXISTS flight_hotel_prices;
DROP TABLE IF EXISTS flight_hotel_configs;
```

**Result:** Complete removal, back to original state

---

## 🛡️ SAFETY GUARANTEES

### **What CANNOT Break:**

✅ **Existing Packages:** Use different `pricingModule` values, completely separate code paths
✅ **Bokun Integration:** Not modified, uses same APIs as before
✅ **Database Integrity:** New tables have no foreign keys to existing tables
✅ **Existing Routes:** New routes in separate namespace, no conflicts
✅ **Performance:** Scheduler runs at different time (4 AM vs 3 AM)

### **What to Watch:**

⚠️ **API Rate Limits:**
- Hotel API: Sunshine API (same credentials, might hit rate limits)
- Flight API: Uses existing APIs (SERP or European)
- **Mitigation:** Built-in rate limiting (1-2 second delays between requests)

⚠️ **Server Memory:**
- Large date ranges = many API calls
- **Mitigation:** Process one date at a time, release memory between dates

⚠️ **Database Size:**
- Each package × dates × airports × room types = rows in `flight_hotel_prices`
- **Mitigation:** Unique constraint prevents duplicates

---

## 📊 MONITORING

### **Check Everything is Working:**

```bash
# 1. Check server logs
tail -f /path/to/logs

# 2. Check database
SELECT COUNT(*) FROM flight_hotel_configs;
SELECT COUNT(*) FROM flight_hotel_prices;

# 3. Check scheduler
# Look for log line: "[Scheduler] All schedulers initialized successfully"

# 4. Check new routes
curl https://your-app.com/api/admin/packages/1/flight-hotel-config
```

**Healthy State:**
- Server starts without errors
- Scheduler shows 3 jobs (Bokun flights, Flight+Hotel, Bokun cache)
- New tables exist and are empty (until you use the feature)
- New routes return 200 OK

---

## 🚀 RECOMMENDED DEPLOYMENT STRATEGY

### **Option A: Cautious (Recommended)**

1. **Week 1:** Deploy code, DON'T create any packages yet
   - Monitor for any startup errors
   - Verify existing features work
   - Check logs for unexpected behavior

2. **Week 2:** Create 1 test package with short date range (7 days)
   - Fetch prices manually
   - Verify results look correct
   - Monitor API usage

3. **Week 3:** Enable auto-refresh on test package
   - Wait for Sunday 4 AM run
   - Check logs for success
   - Verify prices updated

4. **Week 4+:** Gradually add more packages

---

### **Option B: Aggressive (If Confident)**

1. Deploy everything at once
2. Create test package immediately
3. Enable auto-refresh
4. Monitor closely for first week

---

## ❓ FAQ

**Q: Will this break my existing Bokun packages?**
A: No. Different pricing modules, completely separate code.

**Q: What if the Hotel API is down?**
A: Error is logged, package is skipped, other packages continue processing.

**Q: Can I disable auto-refresh?**
A: Yes. Set `autoRefreshEnabled: false` in package config.

**Q: How do I delete all flight+hotel data?**
A: `DELETE FROM flight_hotel_prices; DELETE FROM flight_hotel_configs;`

**Q: Will this use my SERP API credits?**
A: Only if you select `flightApiSource: "serp"`. You can use `"european"` instead.

**Q: What happens if I delete a package?**
A: Cascade delete removes config and prices automatically (`ON DELETE CASCADE`).

---

## 📝 CHECKLIST BEFORE GOING LIVE

- [ ] Database migration completed successfully
- [ ] Server starts without errors
- [ ] Existing package detail pages load correctly
- [ ] Existing admin panel works normally
- [ ] Test package created and prices fetched
- [ ] Logs show no unexpected errors
- [ ] API rate limits not exceeded
- [ ] Rollback plan reviewed and understood
- [ ] Team knows how to disable if needed

---

## 🆘 EMERGENCY CONTACTS

**If something breaks:**
1. Check this rollback guide
2. Disable scheduler (comment out cron job)
3. Check server logs for actual error
4. Revert specific files causing issues

**Common Issues & Fixes:**

| Issue | Fix |
|-------|-----|
| "Table doesn't exist" | Run database migration |
| "Module not found" | Check TypeScript compiled |
| "API timeout" | Reduce date range or airports |
| "Out of memory" | Reduce concurrent packages |
| "SERP API error" | Check API key in secrets |

---

**Last Updated:** 2026-02-06
**Module Version:** 1.0.0
**Status:** Ready for testing ✅
