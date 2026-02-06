-- Cache table for Sunshine hotel data
-- This stores the country/region/area/resort/hotel structure
-- Should be refreshed daily

CREATE TABLE IF NOT EXISTS sunshine_hotels_cache (
  id SERIAL PRIMARY KEY,
  hotel_id TEXT NOT NULL UNIQUE,
  hotel_name TEXT NOT NULL,
  country_id TEXT NOT NULL,
  country_name TEXT,
  region_id TEXT NOT NULL,
  region_name TEXT,
  area_id TEXT NOT NULL,
  area_name TEXT,
  resort_id TEXT NOT NULL,
  resort_name TEXT NOT NULL,
  star_rating TEXT,
  last_synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sunshine_hotels_name ON sunshine_hotels_cache(hotel_name);
CREATE INDEX IF NOT EXISTS idx_sunshine_hotels_resort ON sunshine_hotels_cache(resort_name);
CREATE INDEX IF NOT EXISTS idx_sunshine_hotels_country ON sunshine_hotels_cache(country_id);

-- Verification
SELECT COUNT(*) FROM sunshine_hotels_cache;
