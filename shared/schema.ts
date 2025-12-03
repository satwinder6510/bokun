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

// Flight Inclusive Packages schema
export const flightPackages = pgTable("flight_packages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(), // e.g., "India", "Maldives", "Dubai"
  
  // Bokun integration - link to a Bokun land tour for content import
  bokunProductId: text("bokun_product_id"), // Optional: links to a Bokun tour for content/pricing reference
  
  // Pricing
  price: real("price").notNull(),
  currency: text("currency").notNull().default("GBP"),
  priceLabel: text("price_label").notNull().default("per adult"),
  
  // Content
  description: text("description").notNull(), // HTML content for overview
  excerpt: text("excerpt"), // Short summary for cards
  
  // Structured data as JSON
  whatsIncluded: jsonb("whats_included").$type<string[]>().notNull().default([]),
  highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
  itinerary: jsonb("itinerary").$type<{
    day: number;
    title: string;
    description: string;
  }[]>().notNull().default([]),
  accommodations: jsonb("accommodations").$type<{
    name: string;
    images: string[];
    description: string;
  }[]>().notNull().default([]),
  otherInfo: text("other_info"), // HTML content for terms, conditions, etc.
  
  // Images
  featuredImage: text("featured_image"),
  gallery: jsonb("gallery").$type<string[]>().default([]),
  
  // Duration info
  duration: text("duration"), // e.g., "11 Nights / 12 Days"
  
  // Meta
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  
  // Status
  isPublished: boolean("is_published").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  
  // Source URL for rescraping
  sourceUrl: text("source_url"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFlightPackageSchema = createInsertSchema(flightPackages).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  slug: z.string()
    .min(1, "Slug is required")
    .max(200, "Slug too long")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  title: z.string().min(1, "Title is required").max(300, "Title too long"),
  category: z.string().min(1, "Category is required"),
  price: z.number().positive("Price must be positive"),
  description: z.string().min(1, "Description is required"),
  bokunProductId: z.string().optional().nullable(),
});

export const updateFlightPackageSchema = insertFlightPackageSchema.partial();

export type FlightPackage = typeof flightPackages.$inferSelect;
export type InsertFlightPackage = z.infer<typeof insertFlightPackageSchema>;
export type UpdateFlightPackage = z.infer<typeof updateFlightPackageSchema>;

// Package Enquiries schema
export const packageEnquiries = pgTable("package_enquiries", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").references(() => flightPackages.id),
  packageTitle: text("package_title"),
  
  // Customer info
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  
  // Enquiry details
  preferredDates: text("preferred_dates"),
  numberOfTravelers: integer("number_of_travelers"),
  message: text("message"),
  
  // Status
  status: text("status").notNull().default("new"), // new, contacted, converted, closed
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPackageEnquirySchema = createInsertSchema(packageEnquiries).omit({ 
  id: true, 
  createdAt: true,
  status: true
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Phone number is required"),
});

export type PackageEnquiry = typeof packageEnquiries.$inferSelect;
export type InsertPackageEnquiry = z.infer<typeof insertPackageEnquirySchema>;

// Package Pricing Calendar schema
export const packagePricing = pgTable("package_pricing", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => flightPackages.id, { onDelete: 'cascade' }),
  departureAirport: text("departure_airport").notNull(), // e.g., "LHR", "MAN", "BHX"
  departureAirportName: text("departure_airport_name").notNull(), // e.g., "London Heathrow"
  departureDate: text("departure_date").notNull(), // ISO date string YYYY-MM-DD
  price: real("price").notNull(),
  currency: text("currency").notNull().default("GBP"),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPackagePricingSchema = createInsertSchema(packagePricing).omit({ 
  id: true, 
  createdAt: true 
}).extend({
  packageId: z.number().positive("Package ID is required"),
  departureAirport: z.string().min(2, "Airport code is required").max(10),
  departureAirportName: z.string().min(1, "Airport name is required"),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  price: z.number().positive("Price must be positive"),
});

export type PackagePricing = typeof packagePricing.$inferSelect;
export type InsertPackagePricing = z.infer<typeof insertPackagePricingSchema>;

// Customer Reviews schema
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  location: text("location"), // e.g., "London, UK"
  rating: integer("rating").notNull().default(5), // 1-5 stars
  reviewText: text("review_text").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  customerName: z.string().min(1, "Customer name is required").max(100),
  location: z.string().max(100).optional(),
  rating: z.number().min(1).max(5).default(5),
  reviewText: z.string().min(10, "Review must be at least 10 characters").max(1000),
  displayOrder: z.number().default(0),
  isPublished: z.boolean().default(true),
});

export const updateReviewSchema = insertReviewSchema.partial();

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type UpdateReview = z.infer<typeof updateReviewSchema>;

// Dynamic Number Insertion (DNI) - Tracking Numbers schema
export const trackingNumbers = pgTable("tracking_numbers", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  label: text("label").notNull(), // e.g., "Google Ads - Summer Sale"
  source: text("source"), // e.g., "google", "facebook", "bing", null for default
  campaign: text("campaign"), // e.g., "summer_sale", "brand", null for any campaign from that source
  medium: text("medium"), // e.g., "cpc", "organic", "social"
  isDefault: boolean("is_default").notNull().default(false), // Fallback number when no source matches
  isActive: boolean("is_active").notNull().default(true),
  impressions: integer("impressions").notNull().default(0), // Track how many times number was displayed
  displayOrder: integer("display_order").notNull().default(0), // For priority matching
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrackingNumberSchema = createInsertSchema(trackingNumbers).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  impressions: true
}).extend({
  phoneNumber: z.string().min(1, "Phone number is required").max(30),
  label: z.string().min(1, "Label is required").max(100),
  source: z.string().max(50).optional().nullable(),
  campaign: z.string().max(100).optional().nullable(),
  medium: z.string().max(50).optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

export const updateTrackingNumberSchema = insertTrackingNumberSchema.partial();

export type TrackingNumber = typeof trackingNumbers.$inferSelect;
export type InsertTrackingNumber = z.infer<typeof insertTrackingNumberSchema>;
export type UpdateTrackingNumber = z.infer<typeof updateTrackingNumberSchema>;

// Admin Users schema for multi-user admin access with individual 2FA
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("editor"), // "super_admin" or "editor"
  isActive: boolean("is_active").notNull().default(true),
  
  // 2FA fields
  twoFactorSecret: text("two_factor_secret"), // TOTP secret for this user
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  
  // Session tracking
  lastLoginAt: timestamp("last_login_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastLoginAt: true
}).extend({
  email: z.string().email("Valid email is required"),
  fullName: z.string().min(1, "Full name is required").max(100),
  role: z.enum(["super_admin", "editor"]).default("editor"),
  isActive: z.boolean().default(true),
});

export const updateAdminUserSchema = z.object({
  email: z.string().email("Valid email is required").optional(),
  fullName: z.string().min(1, "Full name is required").max(100).optional(),
  role: z.enum(["super_admin", "editor"]).optional(),
  isActive: z.boolean().optional(),
  passwordHash: z.string().optional(),
  twoFactorSecret: z.string().nullable().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type UpdateAdminUser = z.infer<typeof updateAdminUserSchema>;

// Admin login schema for validation
export const adminLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export type AdminLogin = z.infer<typeof adminLoginSchema>;

// Admin Sessions table for persistent sessions across server restarts
export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: integer("user_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminSession = typeof adminSessions.$inferSelect;
