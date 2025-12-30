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
  included: z.string().optional(),
  excluded: z.string().optional(),
  requirements: z.string().optional(),
  attention: z.string().optional(),
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
  destination: text("destination"), // Country/destination for SEO linking
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
  destination: z.string().max(100, "Destination name too long").optional().nullable(),
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
  category: text("category").notNull(), // e.g., "India", "Maldives", "Dubai" - primary country for URL
  countries: jsonb("countries").$type<string[]>().notNull().default([]), // All countries this package covers
  tags: jsonb("tags").$type<string[]>().notNull().default([]), // e.g., "Beach", "City Break", "Honeymoon", "Family"
  
  // Bokun integration - link to a Bokun land tour for content import
  bokunProductId: text("bokun_product_id"), // Optional: links to a Bokun tour for content/pricing reference
  
  // Pricing
  price: real("price").notNull(), // Double room / twin share price per person
  singlePrice: real("single_price"), // Single room / solo traveler price (optional)
  pricingDisplay: text("pricing_display").notNull().default("both"), // "both", "twin", "single"
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
  
  // Additional tour info (from Bokun)
  excluded: text("excluded"), // HTML - what's not included
  requirements: text("requirements"), // HTML - what to bring
  attention: text("attention"), // HTML - please note / important info
  
  // Gallery videos (YouTube/Vimeo)
  videos: jsonb("videos").$type<{
    url: string;
    title?: string;
    platform: 'youtube' | 'vimeo';
    videoId: string;
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
  isSpecialOffer: boolean("is_special_offer").notNull().default(false), // Featured in Special Offers section
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
  countries: z.array(z.string()).default([]),
  price: z.number().min(0, "Price cannot be negative"),
  singlePrice: z.number().min(0, "Single price cannot be negative").optional().nullable(),
  pricingDisplay: z.enum(["both", "twin", "single"]).default("both"),
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

// Tour Enquiries schema (for Bokun land tours)
export const tourEnquiries = pgTable("tour_enquiries", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull(), // Bokun product ID
  productTitle: text("product_title").notNull(),
  
  // Customer info
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  
  // Tour selection details
  departureDate: text("departure_date"), // ISO date string
  rateTitle: text("rate_title"), // Room/category selected
  numberOfTravelers: integer("number_of_travelers"),
  estimatedPrice: real("estimated_price"), // Total price at time of enquiry
  currency: text("currency").default("GBP"),
  message: text("message"),
  
  // Status
  status: text("status").notNull().default("new"), // new, contacted, converted, closed
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTourEnquirySchema = createInsertSchema(tourEnquiries).omit({ 
  id: true, 
  createdAt: true,
  status: true
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Phone number is required"),
});

export type TourEnquiry = typeof tourEnquiries.$inferSelect;
export type InsertTourEnquiry = z.infer<typeof insertTourEnquirySchema>;

// Package Pricing Calendar schema
export const packagePricing = pgTable("package_pricing", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => flightPackages.id, { onDelete: 'cascade' }),
  departureAirport: text("departure_airport").notNull(), // e.g., "LHR", "MAN", "BHX"
  departureAirportName: text("departure_airport_name").notNull(), // e.g., "London Heathrow"
  departureDate: text("departure_date").notNull(), // ISO date string YYYY-MM-DD
  price: real("price").notNull(),
  flightPricePerPerson: real("flight_price_per_person"), // Actual flight price per person (GBP)
  landPricePerPerson: real("land_price_per_person"), // Bokun tour price per person with markup (GBP)
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
  flightPricePerPerson: z.number().optional().nullable(),
  landPricePerPerson: z.number().optional().nullable(),
});

export type PackagePricing = typeof packagePricing.$inferSelect;
export type InsertPackagePricing = z.infer<typeof insertPackagePricingSchema>;

// Package Seasons - for seasonal land cost pricing per package
export const packageSeasons = pgTable("package_seasons", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => flightPackages.id, { onDelete: 'cascade' }),
  seasonName: text("season_name").notNull(), // e.g., "Peak", "Shoulder", "Low", "Season 1"
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  landCostPerPerson: real("land_cost_per_person").notNull(), // Land/tour cost in GBP
  hotelCostPerPerson: real("hotel_cost_per_person"), // Optional hotel cost per night
  notes: text("notes"), // Admin notes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPackageSeasonSchema = createInsertSchema(packageSeasons).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
}).extend({
  packageId: z.number().positive("Package ID is required"),
  seasonName: z.string().min(1, "Season name is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
  landCostPerPerson: z.number().positive("Land cost must be positive"),
  hotelCostPerPerson: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type PackageSeason = typeof packageSeasons.$inferSelect;
export type InsertPackageSeason = z.infer<typeof insertPackageSeasonSchema>;

// Pricing Export History - track generated CSVs
export const pricingExports = pgTable("pricing_exports", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => flightPackages.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  flightApiUsed: text("flight_api_used").notNull(), // "european" or "serp"
  dateRangeStart: text("date_range_start").notNull(),
  dateRangeEnd: text("date_range_end").notNull(),
  departureAirports: text("departure_airports").notNull(), // Pipe-separated
  totalRows: integer("total_rows").notNull().default(0),
  status: text("status").notNull().default("completed"), // completed, failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPricingExportSchema = createInsertSchema(pricingExports).omit({ 
  id: true, 
  createdAt: true 
});

export type PricingExport = typeof pricingExports.$inferSelect;
export type InsertPricingExport = z.infer<typeof insertPricingExportSchema>;

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
// Simplified: just a tag (e.g., "tzl") that matches ?tzl in the URL
export const trackingNumbers = pgTable("tracking_numbers", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  label: text("label"), // Optional label for admin reference, e.g., "TikTok Campaign"
  tag: text("tag"), // Simple tag like "tzl" - matches ?tzl in URL
  isDefault: boolean("is_default").notNull().default(false), // Fallback number when no tag matches
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrackingNumberSchema = createInsertSchema(trackingNumbers).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
}).extend({
  phoneNumber: z.string().min(1, "Phone number is required").max(30),
  label: z.string().max(100).optional().nullable(),
  tag: z.string().max(50).optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
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

// Flight Tour Pricing Configs - links Bokun tours to flight API for dynamic pricing
export const flightTourPricingConfigs = pgTable("flight_tour_pricing_configs", {
  id: serial("id").primaryKey(),
  bokunProductId: text("bokun_product_id").notNull().unique(), // Links to Bokun tour
  
  // Flight API parameters
  arriveAirportCode: text("arrive_airport_code").notNull(), // 3-letter code e.g., "ATH", "SOF"
  departAirports: text("depart_airports").notNull().default("LGW|STN|LTN|LHR|MAN|BHX|BRS|EDI|GLA"), // Pipe-separated UK airports
  durationNights: integer("duration_nights").notNull(), // Number of nights for flights
  searchStartDate: text("search_start_date").notNull(), // DD/MM/YYYY format for API
  searchEndDate: text("search_end_date").notNull(), // DD/MM/YYYY format for API
  
  // Pricing settings
  markupPercent: real("markup_percent").notNull().default(15), // Markup percentage e.g., 15 for 15%
  
  // Status
  isEnabled: boolean("is_enabled").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFlightTourPricingConfigSchema = createInsertSchema(flightTourPricingConfigs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  bokunProductId: z.string().min(1, "Bokun Product ID is required"),
  arriveAirportCode: z.string().length(3, "Airport code must be 3 letters").toUpperCase(),
  departAirports: z.string().min(3, "At least one departure airport required"),
  durationNights: z.number().min(1, "Duration must be at least 1 night").max(30, "Duration too long"),
  searchStartDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"),
  searchEndDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"),
  markupPercent: z.number().min(0, "Markup cannot be negative").max(100, "Markup too high"),
  isEnabled: z.boolean().default(true),
});

export const updateFlightTourPricingConfigSchema = insertFlightTourPricingConfigSchema.partial();

export type FlightTourPricingConfig = typeof flightTourPricingConfigs.$inferSelect;
export type InsertFlightTourPricingConfig = z.infer<typeof insertFlightTourPricingConfigSchema>;
export type UpdateFlightTourPricingConfig = z.infer<typeof updateFlightTourPricingConfigSchema>;

// Flight offer from external API (for type safety)
export const flightOfferSchema = z.object({
  Refnum: z.string(),
  fltsuppname: z.string(),
  fltsuppcode: z.string(),
  depapt: z.string(),
  depname: z.string(),
  arrapt: z.string(),
  arrname: z.string(),
  outdep: z.string(), // Outbound departure datetime DD/MM/YYYY HH:mm
  outarr: z.string(), // Outbound arrival datetime
  outfltnum: z.string(),
  outairlinename: z.string(),
  indep: z.string(), // Inbound departure datetime
  inarr: z.string(), // Inbound arrival datetime
  infltnum: z.string(),
  inairlinename: z.string(),
  nights: z.string(),
  fltnetpricepp: z.string(), // Net price per person as string
  fltSellpricepp: z.string(), // Sell price per person as string
});

export type FlightOffer = z.infer<typeof flightOfferSchema>;

// Combined package pricing result
export const combinedPackagePriceSchema = z.object({
  date: z.string(), // Travel date
  flightPricePerPerson: z.number(),
  landTourPricePerPerson: z.number(),
  subtotal: z.number(),
  markupPercent: z.number(),
  afterMarkup: z.number(),
  finalPrice: z.number(), // After smart rounding
  currency: z.string(),
  flightDetails: flightOfferSchema.optional(),
});

export type CombinedPackagePrice = z.infer<typeof combinedPackagePriceSchema>;

// Site Settings - for admin-configurable settings like exchange rates
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // Setting key e.g., "usd_to_gbp_rate"
  value: text("value").notNull(), // Setting value (stored as text for flexibility)
  label: text("label").notNull(), // Human-readable label
  description: text("description"), // Optional description
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({ 
  id: true,
  updatedAt: true 
});

export const updateSiteSettingSchema = z.object({
  value: z.string().min(1, "Value is required"),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type UpdateSiteSetting = z.infer<typeof updateSiteSettingSchema>;

// ============================================
// MEDIA ASSET MANAGEMENT SYSTEM
// ============================================

// Main media assets table - stores original images
export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // Unique identifier for the asset
  originalUrl: text("original_url"), // External source URL (if from Unsplash/Pexels)
  storagePath: text("storage_path"), // Local storage path
  perceptualHash: text("perceptual_hash"), // For duplicate detection
  mimeType: text("mime_type").notNull().default("image/webp"),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes"),
  altText: text("alt_text"), // Accessibility alt text
  caption: text("caption"), // Optional caption
  photographer: text("photographer"), // Attribution
  license: text("license"), // License type (unsplash, pexels, owned, etc.)
  licenseUrl: text("license_url"), // Link to license
  source: text("source").notNull().default("upload"), // upload, unsplash, pexels
  externalId: text("external_id"), // ID from external service
  isDeleted: boolean("is_deleted").notNull().default(false), // Soft delete
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
});

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;

// Media variants - different sizes of the same image
export const mediaVariants = pgTable("media_variants", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(), // FK to mediaAssets
  variantType: text("variant_type").notNull(), // original, hero, gallery, card, thumb, mobile_hero
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  quality: integer("quality").notNull().default(80), // WebP quality
  format: text("format").notNull().default("webp"),
  filepath: text("filepath").notNull(), // Storage path for this variant
  storageType: text("storage_type").notNull().default("local"), // local, object_storage
  sizeBytes: integer("size_bytes"),
  checksum: text("checksum"), // File integrity check
  status: text("status").notNull().default("pending"), // pending, active, failed, superseded
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMediaVariantSchema = createInsertSchema(mediaVariants).omit({
  id: true,
  createdAt: true,
});

export type MediaVariant = typeof mediaVariants.$inferSelect;
export type InsertMediaVariant = z.infer<typeof insertMediaVariantSchema>;

// Media tags - for categorizing and finding images
export const mediaTags = pgTable("media_tags", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(), // FK to mediaAssets
  tagType: text("tag_type").notNull(), // destination, hotel, category, keyword
  tagValue: text("tag_value").notNull(), // e.g., "Turkey", "Grand Hotel", "beach"
  confidence: real("confidence").default(1.0), // For auto-detected tags
  isPrimary: boolean("is_primary").notNull().default(false), // Main tag for this asset
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMediaTagSchema = createInsertSchema(mediaTags).omit({
  id: true,
  createdAt: true,
});

export type MediaTag = typeof mediaTags.$inferSelect;
export type InsertMediaTag = z.infer<typeof insertMediaTagSchema>;

// Media usage - tracks where images are used (prevents duplicates)
export const mediaUsage = pgTable("media_usage", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(), // FK to mediaAssets
  entityType: text("entity_type").notNull(), // destination_gallery, hotel_page, package, blog, bokun_override
  entityId: text("entity_id").notNull(), // ID of the package, blog post, etc.
  variantType: text("variant_type").notNull(), // Which variant is being used
  isPrimary: boolean("is_primary").notNull().default(false), // Primary image for this entity
  usageStatus: text("usage_status").notNull().default("active"), // active, staged, historical
  assignedBy: text("assigned_by"),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const insertMediaUsageSchema = createInsertSchema(mediaUsage).omit({
  id: true,
  assignedAt: true,
});

export type MediaUsage = typeof mediaUsage.$inferSelect;
export type InsertMediaUsage = z.infer<typeof insertMediaUsageSchema>;

// Media backups - stores backup metadata for recovery
export const mediaBackups = pgTable("media_backups", {
  id: serial("id").primaryKey(),
  scope: text("scope").notNull(), // destination_gallery, hotel_gallery, bulk_operation, full_backup
  snapshotPath: text("snapshot_path").notNull(), // Path to backup archive
  fileCount: integer("file_count").notNull().default(0),
  totalSizeBytes: integer("total_size_bytes"),
  metadata: jsonb("metadata"), // Additional context about what was backed up
  status: text("status").notNull().default("completed"), // pending, completed, failed, restored
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  restoredAt: timestamp("restored_at"), // When/if backup was used for restore
});

export const insertMediaBackupSchema = createInsertSchema(mediaBackups).omit({
  id: true,
  createdAt: true,
  restoredAt: true,
});

export type MediaBackup = typeof mediaBackups.$inferSelect;
export type InsertMediaBackup = z.infer<typeof insertMediaBackupSchema>;

// Media cleanup jobs - tracks cleanup operations with dry-run support
export const mediaCleanupJobs = pgTable("media_cleanup_jobs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(), // hotel_from_gallery, duplicate_removal, unused_cleanup
  status: text("status").notNull().default("draft"), // draft, previewed, approved, executed, rolled_back, failed
  scope: jsonb("scope"), // JSON defining what to clean up
  previewResults: jsonb("preview_results"), // Dry-run results showing what would be removed
  affectedCount: integer("affected_count").default(0),
  backupId: integer("backup_id"), // FK to mediaBackups (created before execution)
  rollbackToken: text("rollback_token"), // Unique token for rollback
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  previewedAt: timestamp("previewed_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  executedAt: timestamp("executed_at"),
  rolledBackAt: timestamp("rolled_back_at"),
});

export const insertMediaCleanupJobSchema = createInsertSchema(mediaCleanupJobs).omit({
  id: true,
  createdAt: true,
  previewedAt: true,
  approvedAt: true,
  executedAt: true,
  rolledBackAt: true,
});

export type MediaCleanupJob = typeof mediaCleanupJobs.$inferSelect;
export type InsertMediaCleanupJob = z.infer<typeof insertMediaCleanupJobSchema>;

// Variant type configurations (presets for different image sizes)
export const variantPresets = {
  original: { width: 0, height: 0, quality: 95, fit: 'inside' as const },
  hero: { width: 1920, height: 1080, quality: 85, fit: 'cover' as const },
  gallery: { width: 1280, height: 0, quality: 80, fit: 'inside' as const }, // Auto height
  card: { width: 800, height: 600, quality: 75, fit: 'cover' as const },
  thumb: { width: 400, height: 400, quality: 70, fit: 'cover' as const },
  mobile_hero: { width: 768, height: 1024, quality: 75, fit: 'cover' as const },
} as const;

export type VariantType = keyof typeof variantPresets;

// Hotels library - stores scraped hotel information for reuse across packages
export const hotels = pgTable("hotels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  starRating: integer("star_rating"), // 1-5 stars
  amenities: jsonb("amenities").$type<string[]>(), // ["WiFi", "Pool", "Spa", etc.]
  address: text("address"),
  city: text("city"),
  country: text("country"),
  sourceUrl: text("source_url"), // Original hotel website scraped
  images: jsonb("images").$type<string[]>(), // Array of media asset URLs
  featuredImage: text("featured_image"), // Main display image
  roomTypes: jsonb("room_types").$type<{ name: string; description?: string }[]>(),
  checkInTime: text("check_in_time"),
  checkOutTime: text("check_out_time"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  lastScrapedAt: timestamp("last_scraped_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertHotelSchema = createInsertSchema(hotels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastScrapedAt: true,
});

export type Hotel = typeof hotels.$inferSelect;
export type InsertHotel = z.infer<typeof insertHotelSchema>;

// Newsletter Subscribers schema
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").default("website"), // website, footer, popup, etc.
  isActive: boolean("is_active").notNull().default(true),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({
  id: true,
  subscribedAt: true,
  unsubscribedAt: true,
}).extend({
  email: z.string().email("Valid email is required"),
  source: z.string().optional(),
});

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;

// Content Images for Collections and Destinations
export const contentImages = pgTable("content_images", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "collection" or "destination"
  name: text("name").notNull(), // tag name or country name
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContentImageSchema = createInsertSchema(contentImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ContentImage = typeof contentImages.$inferSelect;
export type InsertContentImage = z.infer<typeof insertContentImageSchema>;
