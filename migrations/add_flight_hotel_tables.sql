-- Migration: Add Flight + Hotel API Module Tables
-- Created: 2026-02-06
-- Safe to run: These are NEW tables, won't affect existing data

-- ============================================
-- Table: flight_hotel_configs
-- Stores configuration for flight+hotel packages
-- ============================================
CREATE TABLE IF NOT EXISTS flight_hotel_configs (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL UNIQUE REFERENCES flight_packages(id) ON DELETE CASCADE,

  -- Multi-city hotel configuration (JSONB)
  cities JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Flight configuration
  arrival_airport TEXT NOT NULL,
  departure_airport TEXT,
  flight_type TEXT NOT NULL DEFAULT 'roundtrip',
  flight_api_source TEXT NOT NULL DEFAULT 'european',

  -- UK departure airports (JSONB array)
  uk_airports JSONB NOT NULL DEFAULT '["LGW","STN","LTN","LHR","MAN","BHX"]'::jsonb,

  -- Pricing settings
  markup REAL NOT NULL DEFAULT 15,

  -- Date range
  search_start_date TEXT NOT NULL,
  search_end_date TEXT NOT NULL,

  -- Auto-refresh
  auto_refresh_enabled BOOLEAN NOT NULL DEFAULT false,
  last_refresh_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flight_hotel_configs_package_id
  ON flight_hotel_configs(package_id);

CREATE INDEX IF NOT EXISTS idx_flight_hotel_configs_auto_refresh
  ON flight_hotel_configs(auto_refresh_enabled)
  WHERE auto_refresh_enabled = true;

-- ============================================
-- Table: flight_hotel_prices
-- Stores cached pricing data
-- ============================================
CREATE TABLE IF NOT EXISTS flight_hotel_prices (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES flight_packages(id) ON DELETE CASCADE,

  -- Travel details
  travel_date TEXT NOT NULL,
  uk_airport TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'twin',

  -- Flight component
  flight_price_per_person REAL NOT NULL,
  airline_name TEXT,

  -- Hotel component (JSONB array)
  hotels JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Pricing breakdown
  total_flight_cost REAL NOT NULL,
  total_hotel_cost_per_person REAL NOT NULL,
  subtotal REAL NOT NULL,
  markup_amount REAL NOT NULL,
  after_markup REAL NOT NULL,
  final_price REAL NOT NULL,

  -- Metadata
  is_available BOOLEAN NOT NULL DEFAULT true,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_hotel_unique
  ON flight_hotel_prices(package_id, travel_date, uk_airport, room_type);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_flight_hotel_prices_package_id
  ON flight_hotel_prices(package_id);

CREATE INDEX IF NOT EXISTS idx_flight_hotel_prices_travel_date
  ON flight_hotel_prices(travel_date);

CREATE INDEX IF NOT EXISTS idx_flight_hotel_prices_room_type
  ON flight_hotel_prices(room_type);

-- ============================================
-- Verification Queries
-- ============================================

-- Check tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('flight_hotel_configs', 'flight_hotel_prices')
ORDER BY table_name;

-- Check indexes were created
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('flight_hotel_configs', 'flight_hotel_prices')
ORDER BY tablename, indexname;

-- Verify empty tables
SELECT 'flight_hotel_configs' as table_name, COUNT(*) as row_count FROM flight_hotel_configs
UNION ALL
SELECT 'flight_hotel_prices' as table_name, COUNT(*) as row_count FROM flight_hotel_prices;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

-- Uncomment the following lines to rollback:

-- DROP TABLE IF EXISTS flight_hotel_prices;
-- DROP TABLE IF EXISTS flight_hotel_configs;
