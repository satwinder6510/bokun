# URL Comparison: Old Site vs New Site

Generated: December 2024

## Summary

| Category | Old Site | New Site | Status |
|----------|----------|----------|--------|
| Homepage | ✅ Works | ✅ Works | Match |
| Country Pages | ❌ All broken (500 errors) | ✅ Works | **New site is BETTER** |
| Package Detail Pages | ✅ Works | ⚠️ Different slug format | **Needs Redirects** |
| Collections | `/collections` | `/holidays` | **Needs Redirect** |

---

## Critical Issue: Slug Format Differences

The old site uses **special characters** in URLs, while the new site uses **clean slugs**.

### Old Site Format
```
/Holidays/{Country}/{Title-With-Special-Characters:-&,-'}
```

### New Site Format
```
/Holidays/{country}/{title-with-clean-slugs}
```

---

## Package URL Mapping (Old → New)

### Italy Packages

| Old URL Slug | New URL Slug | Status |
|-------------|--------------|--------|
| `Vienna-&-Venice:-A-Twin-City-European-Escape-by-Sleeper-Train` | `vienna-and-venice-a-twin-city-european-escape-by-sleeper-train` | ⚠️ Different |
| `Discover-Procida:-Italy's-Hidden-Gem-of-Authentic-Charm-and-Rich-Heritage` | `discover-procida-italy-hidden-gem-of-authentic-charm-and-rich-heritage` | ⚠️ Different |
| `Sorrento-&-Sicily:-A-Rail-Adventure-Through-Southern-Italy` | `sorrento-and-sicily-a-rail-adventure-through-southern-italy` | ⚠️ Different |
| `Four-Incredible-Nights-In-Florence-And-Venice` | `four-incredible-nights-in-florence-and-venice` | ✅ Similar |
| `Ischia-Serenity:-Thermal-Retreat,-Coastal-Charm-&-Island-Adventures` | `ischia-elegance-and-capri-charm-a-journey-of-sun-sea-and-serenity` | ⚠️ Different title |

### Indonesia Packages

| Old URL Slug | New URL Slug | Status |
|-------------|--------------|--------|
| `Luxury-Hong-Kong,-Kuala-Lumpur-&-Bali` | `luxury-hong-kong-kuala-lumpur-bali` | ⚠️ Different |
| `Luxury-Malaysia,-Singapore-and-Bali-Rainforest-and-Beach-Stay` | `luxury-malaysia-singapore-and-bali-rainforest-and-beach-stay` | ⚠️ Different |

### Portugal Packages

| Old URL Slug | New URL Slug | Status |
|-------------|--------------|--------|
| `Journey-Through-Porto-and-the-Picturesque-Douro-Valley` | `journey-through-porto-and-the-picturesque-douro-valley` | ✅ Match |
| `Lisbon-and-Porto-Twin-Centre-Break-with-Breakfast` | `lisbon-and-porto-twin-centre-break-with-breakfast` | ✅ Match |

### South Africa Packages

| Old URL Slug | New URL Slug | Status |
|-------------|--------------|--------|
| `Southern-Africa-aboard-the-African-Dream-travel-to-the-ends-of-the-earth` | Not found | ❌ Missing |

---

## Collections/Tags Comparison

### Old Site Collections (from /collections page)
- Vietnam and Cambodia
- Golden Triangle Holidays
- Italian Lakes
- New & Exclusive Offers
- All Inclusive
- City Breaks
- Beach
- European Tours
- Multi Centre
- WorldWide Tours
- Twin Centre
- Luxury
- Summer Holidays
- Adults Only
- Family Holidays
- Occasions
- Solo Traveller
- Winter Sun Holidays
- Greek Island Hopping

### New Site Collections (via /holidays/:tag)
Check your database for available tags to compare.

---

## Country Pages Comparison

### Old Site (All returning 500 errors)
- `/Holidays/Italy` - ❌ 500 Error
- `/Holidays/Indonesia` - ❌ 500 Error
- `/Holidays/India` - ❌ 500 Error
- `/Holidays/Thailand` - ❌ 500 Error
- (All country pages broken)

### New Site
- `/Holidays/Italy` - ✅ Works
- `/Holidays/Indonesia` - ✅ Works
- `/Holidays/India` - ✅ Works
- `/Holidays/Thailand` - ✅ Works
- (All country pages work)

---

## Static Pages Comparison

| Page | Old URL | New URL | Status |
|------|---------|---------|--------|
| Home | `/` | `/` | ✅ Match |
| Collections | `/collections` | `/holidays` | ⚠️ Redirect needed |
| Contact | Unknown | `/contact` | Check |
| FAQ | Unknown | `/faq` | Check |
| Terms | Unknown | `/terms` | Check |

---

## Recommendations

### 1. Add URL Redirects (Priority: HIGH)
Create server-side redirects to handle old URL formats:
- Convert special characters: `&` → `and`, `:` → removed, `'` → removed, `,` → removed
- Lowercase conversion
- Redirect `/collections` → `/holidays`

### 2. Verify All Packages Exist
Cross-check every package from the old site exists in the new site database.

### 3. Test All Collections/Tags
Ensure all collection tags from the old site exist in the new site.

---

## New Site Published Packages by Country

| Country | Count | Sample Packages |
|---------|-------|-----------------|
| Argentina | 1 | Wonders of Argentina and Brazil |
| Austria | 3 | Danube Elegance, Blue Danube, Vienna Cruise |
| Costa Rica | 1 | Amazing Costa Rica |
| Cyprus | 1 | 5 Star All Inclusive Paphos |
| Czech Republic | 3 | Prague and Vienna, Prague and Budapest |
| Denmark | 1 | Copenhagen and Stockholm |
| Germany | 2 | Advent on Rhine, Southern Rhine |
| Greece | 6 | Corfu Cruise, Rhodes Cruise, Santorini, etc. |
| India | 13 | Golden Triangle, Kerala, Rajasthan tours |
| Indonesia | 6 | Bali packages, Malaysia multi-centre |
| Italy | 15 | Various city breaks, cruises, island tours |
| Las Vegas | 2 | San Francisco & Las Vegas |
| Latvia | 1 | Riga and Tallinn |
| Malaysia | 2 | Malaysia Discovery, Malaysia Wonders |
| Peru | 1 | Classic Peru |
| Poland | 1 | Warsaw and Krakow |
| Portugal | 4 | Douro cruises, Porto, Lisbon |
| Slovakia | 2 | Vienna and Bratislava |
| Spain | 3 | Barcelona, Tenerife, Seville |
| Sri Lanka | 2 | Singles Holiday, Heritage Trail |
| Thailand | 12 | Island hopping, multi-centre tours |
| Vietnam | 2 | Cambodia and Vietnam tours |

**Total Published Packages: 88**
