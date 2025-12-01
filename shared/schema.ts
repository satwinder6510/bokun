import { z } from "zod";
import { pgTable, text, timestamp, jsonb, integer, serial, boolean, real } from "drizzle-orm/pg-core";
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
  locationCode: z.object({
    country: z.string().optional(),
    location: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  googlePlace: z.object({
    country: z.string().optional(),
    countryCode: z.string().optional(),
    city: z.string().optional(),
    cityCode: z.string().optional(),
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

// Contact form schema
export const contactLeadSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(100, "Last name too long"),
  email: z.string().email("Valid email is required").max(255, "Email too long"),
  phone: z.string()
    .min(1, "Phone number is required")
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^[+]?[0-9\s.\-()]+$/, "Please enter a valid phone number (digits, spaces, +, -, (, ) only)"),
  bookingReference: z.string().max(50, "Booking reference too long").optional().or(z.literal("")),
  message: z.string().min(10, "Please provide at least 10 characters").max(2000, "Message too long"),
});

export type ContactLead = z.infer<typeof contactLeadSchema>;

// FAQ schema
export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFaqSchema = createInsertSchema(faqs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateFaqSchema = createInsertSchema(faqs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).partial();

export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type UpdateFaq = z.infer<typeof updateFaqSchema>;

// Blog posts schema with SEO optimization
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  featuredImage: text("featured_image"),
  author: text("author").notNull().default("Flights and Packages"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  slug: z.string()
    .min(1, "Slug is required")
    .max(200, "Slug too long")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  excerpt: z.string().min(1, "Excerpt is required").max(500, "Excerpt too long"),
  content: z.string().min(1, "Content is required"),
  metaTitle: z.string().max(70, "Meta title should be under 70 characters").optional(),
  metaDescription: z.string().max(160, "Meta description should be under 160 characters").optional(),
});

export const updateBlogPostSchema = insertBlogPostSchema.partial();

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type UpdateBlogPost = z.infer<typeof updateBlogPostSchema>;

// Shopping cart schema
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  productId: text("product_id").notNull(),
  productTitle: text("product_title").notNull(),
  productPrice: real("product_price").notNull(),
  currency: text("currency").notNull().default("USD"),
  quantity: integer("quantity").notNull().default(1),
  productData: jsonb("product_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({ 
  id: true, 
  createdAt: true 
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

// Bookings schema
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  bookingReference: text("booking_reference").notNull().unique(),
  sessionId: text("session_id").notNull(),
  
  // Customer information
  customerFirstName: text("customer_first_name").notNull(),
  customerLastName: text("customer_last_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  
  // Booking details
  productId: text("product_id").notNull(),
  productTitle: text("product_title").notNull(),
  productPrice: real("product_price").notNull(),
  currency: text("currency").notNull().default("USD"),
  
  // Bokun details
  bokunBookingId: text("bokun_booking_id"),
  bokunReservationId: text("bokun_reservation_id"),
  
  // Payment details
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  totalAmount: integer("total_amount").notNull(),
  
  // Booking status
  bookingStatus: text("booking_status").notNull().default("pending"),
  
  // Additional data
  bookingData: jsonb("booking_data"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

// Custom offers schema (non-API tours from holidays.flightsandpackages.com)
export const customOffers = pgTable("custom_offers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  destination: text("destination").notNull(),
  country: text("country").notNull(),
  region: text("region").notNull().default("Europe"),
  duration: text("duration").notNull(),
  nights: integer("nights").notNull(),
  mealPlan: text("meal_plan").notNull().default("Bed & Breakfast"),
  priceFrom: real("price_from").notNull(),
  currency: text("currency").notNull().default("GBP"),
  overview: text("overview").notNull(),
  whatsIncluded: text("whats_included").notNull(),
  highlights: text("highlights").notNull(),
  itinerary: jsonb("itinerary"),
  accommodation: jsonb("accommodation"),
  gallery: text("gallery").array(),
  featuredImage: text("featured_image"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  externalUrl: text("external_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCustomOfferSchema = createInsertSchema(customOffers).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateCustomOfferSchema = insertCustomOfferSchema.partial();

export type CustomOffer = typeof customOffers.$inferSelect;
export type InsertCustomOffer = z.infer<typeof insertCustomOfferSchema>;
