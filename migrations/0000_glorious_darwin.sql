CREATE TABLE "cache_metadata" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_refresh_at" timestamp DEFAULT now() NOT NULL,
	"total_products" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cached_products" (
	"product_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
