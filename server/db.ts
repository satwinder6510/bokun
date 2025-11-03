import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision the database?");
}

// Use arrayMode for better compatibility with Neon driver
export const sql = neon(process.env.DATABASE_URL, { arrayMode: true });
export const db = drizzle(sql);
