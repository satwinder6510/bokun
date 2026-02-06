/**
 * Database Migration Runner
 * Run with: node migrations/run-migration.js
 */

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log("🚀 Starting database migration...\n");

  try {
    // Create flight_hotel_configs table
    console.log("Creating flight_hotel_configs table...");
    await sql`
      CREATE TABLE IF NOT EXISTS flight_hotel_configs (
        id SERIAL PRIMARY KEY,
        package_id INTEGER NOT NULL UNIQUE REFERENCES flight_packages(id) ON DELETE CASCADE,
        cities JSONB NOT NULL DEFAULT '[]'::jsonb,
        arrival_airport TEXT NOT NULL,
        departure_airport TEXT,
        flight_type TEXT NOT NULL DEFAULT 'roundtrip',
        flight_api_source TEXT NOT NULL DEFAULT 'european',
        uk_airports JSONB NOT NULL DEFAULT '["LGW","STN","LTN","LHR","MAN","BHX"]'::jsonb,
        markup REAL NOT NULL DEFAULT 15,
        search_start_date TEXT NOT NULL,
        search_end_date TEXT NOT NULL,
        auto_refresh_enabled BOOLEAN NOT NULL DEFAULT false,
        last_refresh_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log("✅ flight_hotel_configs table created\n");

    // Create indexes for flight_hotel_configs
    console.log("Creating indexes for flight_hotel_configs...");
    await sql`CREATE INDEX IF NOT EXISTS idx_flight_hotel_configs_package_id ON flight_hotel_configs(package_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_flight_hotel_configs_auto_refresh ON flight_hotel_configs(auto_refresh_enabled) WHERE auto_refresh_enabled = true`;
    console.log("✅ Indexes created\n");

    // Create flight_hotel_prices table
    console.log("Creating flight_hotel_prices table...");
    await sql`
      CREATE TABLE IF NOT EXISTS flight_hotel_prices (
        id SERIAL PRIMARY KEY,
        package_id INTEGER NOT NULL REFERENCES flight_packages(id) ON DELETE CASCADE,
        travel_date TEXT NOT NULL,
        uk_airport TEXT NOT NULL,
        room_type TEXT NOT NULL DEFAULT 'twin',
        flight_price_per_person REAL NOT NULL,
        airline_name TEXT,
        hotels JSONB NOT NULL DEFAULT '[]'::jsonb,
        total_flight_cost REAL NOT NULL,
        total_hotel_cost_per_person REAL NOT NULL,
        subtotal REAL NOT NULL,
        markup_amount REAL NOT NULL,
        after_markup REAL NOT NULL,
        final_price REAL NOT NULL,
        is_available BOOLEAN NOT NULL DEFAULT true,
        fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log("✅ flight_hotel_prices table created\n");

    // Create indexes for flight_hotel_prices
    console.log("Creating indexes for flight_hotel_prices...");
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_hotel_unique ON flight_hotel_prices(package_id, travel_date, uk_airport, room_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_flight_hotel_prices_package_id ON flight_hotel_prices(package_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_flight_hotel_prices_travel_date ON flight_hotel_prices(travel_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_flight_hotel_prices_room_type ON flight_hotel_prices(room_type)`;
    console.log("✅ Indexes created\n");

    // Verify tables
    console.log("Verifying tables...");
    const configCount = await sql`SELECT COUNT(*) FROM flight_hotel_configs`;
    const pricesCount = await sql`SELECT COUNT(*) FROM flight_hotel_prices`;

    console.log(`✅ flight_hotel_configs: ${configCount[0].count} rows`);
    console.log(`✅ flight_hotel_prices: ${pricesCount[0].count} rows\n`);

    console.log("🎉 Migration completed successfully!\n");

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
