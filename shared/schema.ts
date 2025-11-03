import { z } from "zod";
import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const bokunProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string().optional(),
  summary: z.string().optional(),
  activityCategories: z.array(z.string()).optional(),
  flags: z.array(z.string()).optional(),
  price: z.number().optional(),
  durationText: z.string().optional(),
  vendor: z.object({
    id: z.number(),
    title: z.string(),
  }).optional(),
});

export const bokunProductDetailsSchema = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  activityCategories: z.array(z.string()).optional(),
  price: z.number().optional(),
  durationText: z.string().optional(),
  vendor: z.object({
    id: z.number(),
    title: z.string(),
  }).optional(),
  bookingType: z.string().optional(),
  capacityType: z.string().optional(),
  meetingType: z.string().optional(),
  locationCode: z.object({
    country: z.string().optional(),
    location: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  keyPhoto: z.object({
    originalUrl: z.string().optional(),
    description: z.string().optional(),
    height: z.string().optional(),
    width: z.string().optional(),
    derived: z.array(z.object({
      name: z.string().optional(),
      url: z.string().optional(),
    })).optional(),
  }).optional(),
  photos: z.array(z.object({
    originalUrl: z.string().optional(),
    description: z.string().optional(),
    derived: z.array(z.object({
      name: z.string().optional(),
      url: z.string().optional(),
    })).optional(),
  })).optional(),
  difficultyLevel: z.string().optional(),
  reviewRating: z.number().optional(),
  reviewCount: z.number().optional(),
  customFields: z.array(z.object({
    code: z.string().optional(),
    value: z.string().optional(),
    title: z.string().optional(),
    type: z.string().optional(),
  })).optional(),
  itinerary: z.array(z.object({
    id: z.number().optional(),
    day: z.number().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    excerpt: z.string().optional(),
  })).optional(),
  bookableExtras: z.array(z.object({
    id: z.number().optional(),
    title: z.string().optional(),
    information: z.string().optional(),
    price: z.number().optional(),
    pricingType: z.string().optional(),
    pricingTypeLabel: z.string().optional(),
    included: z.boolean().optional(),
    free: z.boolean().optional(),
  })).optional(),
  pricingCategories: z.array(z.object({
    id: z.number().optional(),
    label: z.string().optional(),
    minAge: z.number().optional(),
    maxAge: z.number().optional(),
  })).optional(),
  rates: z.array(z.object({
    id: z.number().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    pricedPerPerson: z.boolean().optional(),
    minPerBooking: z.number().optional(),
    maxPerBooking: z.number().optional(),
  })).optional(),
  nextDefaultPrice: z.number().optional(),
  nextDefaultPriceMoney: z.object({
    amount: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
});

export const bokunAvailabilityRateSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
});

export const bokunAvailabilitySchema = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
  availabilityCount: z.number().optional(),
  unlimitedAvailability: z.boolean().optional(),
  soldOut: z.boolean().optional(),
  unavailable: z.boolean().optional(),
  pricesByRate: z.array(bokunAvailabilityRateSchema).optional(),
});

export const bokunAvailabilityResponseSchema = z.object({
  availabilities: z.array(bokunAvailabilitySchema).optional(),
  product: bokunProductDetailsSchema.optional(),
});

export const bokunProductSearchResponseSchema = z.object({
  totalHits: z.number(),
  tookInMillis: z.number().optional(),
  items: z.array(bokunProductSchema),
});

export const connectionStatusSchema = z.object({
  connected: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
  responseTime: z.number().optional(),
});

export type BokunProduct = z.infer<typeof bokunProductSchema>;
export type BokunProductDetails = z.infer<typeof bokunProductDetailsSchema>;
export type BokunAvailability = z.infer<typeof bokunAvailabilitySchema>;
export type BokunAvailabilityResponse = z.infer<typeof bokunAvailabilityResponseSchema>;
export type BokunProductSearchResponse = z.infer<typeof bokunProductSearchResponseSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

// Database tables
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
});

export const cachedProducts = pgTable("cached_products", {
  productId: text("product_id").primaryKey(),
  data: jsonb("data").notNull(),
  cachedAt: timestamp("cached_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const cacheMetadata = pgTable("cache_metadata", {
  id: integer("id").primaryKey(),
  lastRefreshAt: timestamp("last_refresh_at").notNull().defaultNow(),
  totalProducts: integer("total_products").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(users);
export const insertCachedProductSchema = createInsertSchema(cachedProducts);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CachedProduct = typeof cachedProducts.$inferSelect;
export type InsertCachedProduct = z.infer<typeof insertCachedProductSchema>;
