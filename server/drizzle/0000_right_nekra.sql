CREATE TYPE "public"."application_status" AS ENUM('new', 'accepted', 'rejected', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_kind" AS ENUM('seller', 'buyer', 'system');--> statement-breakpoint
CREATE TYPE "public"."channel_target_kind" AS ENUM('seller', 'buyer');--> statement-breakpoint
CREATE TYPE "public"."delivery_attempt_status" AS ENUM('sent', 'retryable_failure', 'permanent_failure');--> statement-breakpoint
CREATE TYPE "public"."delivery_type" AS ENUM('nova_poshta', 'pickup', 'arrangement');--> statement-breakpoint
CREATE TYPE "public"."link_intent_status" AS ENUM('pending', 'confirmed', 'consumed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."outbox_state" AS ENUM('pending', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."product_state" AS ENUM('available', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."seller_status" AS ENUM('active', 'blocked');--> statement-breakpoint
CREATE TABLE "application_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price_kopecks" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_kopecks" integer NOT NULL,
	CONSTRAINT "application_items_unit_price_nonnegative" CHECK ("application_items"."unit_price_kopecks" >= 0),
	CONSTRAINT "application_items_quantity_positive" CHECK ("application_items"."quantity" > 0),
	CONSTRAINT "application_items_total_matches" CHECK ("application_items"."line_total_kopecks" = "application_items"."unit_price_kopecks" * "application_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_kind" "audit_actor_kind" NOT NULL,
	"actor_id" uuid,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "channel_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"destination_encrypted" text NOT NULL,
	"destination_fingerprint" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_link_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"target_kind" "channel_target_kind" NOT NULL,
	"target_id" uuid,
	"browser_secret_hash" text NOT NULL,
	"confirmed_destination_encrypted" text,
	"destination_fingerprint" text,
	"status" "link_intent_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_name_encrypted" text NOT NULL,
	"buyer_phone_encrypted" text NOT NULL,
	"buyer_channel_provider" text NOT NULL,
	"buyer_channel_destination_encrypted" text NOT NULL,
	"buyer_channel_fingerprint" text NOT NULL,
	"tracking_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"type" "delivery_type" NOT NULL,
	"details_encrypted" text NOT NULL,
	"instructions_snapshot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "delivery_attempt_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_attempts_number_positive" CHECK ("outbox_attempts"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"state" "outbox_state" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_attempt_count_nonnegative" CHECK ("outbox_events"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_storage_key_not_blank" CHECK (length(trim("product_images"."storage_key")) > 0),
	CONSTRAINT "product_images_sort_nonnegative" CHECK ("product_images"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price_kopecks" integer NOT NULL,
	"unit" text NOT NULL,
	"minimum_quantity" integer DEFAULT 1 NOT NULL,
	"state" "product_state" DEFAULT 'available' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_not_blank" CHECK (length(trim("products"."name")) > 0),
	CONSTRAINT "products_price_nonnegative" CHECK ("products"."price_kopecks" >= 0),
	CONSTRAINT "products_minimum_quantity_positive" CHECK ("products"."minimum_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "seller_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_group_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"amount_kopecks" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_applications_amount_nonnegative" CHECK ("seller_applications"."amount_kopecks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "seller_delivery_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"type" "delivery_type" NOT NULL,
	"instructions" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_delivery_options_instructions_not_blank" CHECK (length(trim("seller_delivery_options"."instructions")) > 0)
);
--> statement-breakpoint
CREATE TABLE "seller_public_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_public_contacts_value_not_blank" CHECK (length(trim("seller_public_contacts"."value")) > 0),
	CONSTRAINT "seller_public_contacts_sort_nonnegative" CHECK ("seller_public_contacts"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "seller_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_provider" text NOT NULL,
	"provider_subject_hash" text NOT NULL,
	"status" "seller_status" DEFAULT 'active' NOT NULL,
	"slug" text NOT NULL,
	"store_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_slug_not_blank" CHECK (length(trim("sellers"."slug")) > 0),
	CONSTRAINT "sellers_store_name_not_blank" CHECK (length(trim("sellers"."store_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "application_items" ADD CONSTRAINT "application_items_application_id_seller_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."seller_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_items" ADD CONSTRAINT "application_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_selections" ADD CONSTRAINT "delivery_selections_application_id_seller_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."seller_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_attempts" ADD CONSTRAINT "outbox_attempts_outbox_event_id_outbox_events_id_fk" FOREIGN KEY ("outbox_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_checkout_group_id_checkout_groups_id_fk" FOREIGN KEY ("checkout_group_id") REFERENCES "public"."checkout_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_delivery_options" ADD CONSTRAINT "seller_delivery_options_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_public_contacts" ADD CONSTRAINT "seller_public_contacts_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_sessions" ADD CONSTRAINT "seller_sessions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_items_application_idx" ON "application_items" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "audit_events_aggregate_idx" ON "audit_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connections_seller_provider_uq" ON "channel_connections" USING btree ("seller_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connections_primary_uq" ON "channel_connections" USING btree ("seller_id") WHERE "channel_connections"."is_primary" = true AND "channel_connections"."active" = true;--> statement-breakpoint
CREATE INDEX "channel_connections_seller_idx" ON "channel_connections" USING btree ("seller_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_link_intents_browser_secret_uq" ON "channel_link_intents" USING btree ("browser_secret_hash");--> statement-breakpoint
CREATE INDEX "channel_link_intents_expiry_idx" ON "channel_link_intents" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_groups_tracking_token_uq" ON "checkout_groups" USING btree ("tracking_token_hash");--> statement-breakpoint
CREATE INDEX "checkout_groups_created_idx" ON "checkout_groups" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_selections_application_uq" ON "delivery_selections" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_attempts_event_number_uq" ON "outbox_attempts" USING btree ("outbox_event_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_events_idempotency_uq" ON "outbox_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" USING btree ("state","available_at","locked_until");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_order_uq" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_storage_key_uq" ON "product_images" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "products_seller_idx" ON "products" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_catalog_idx" ON "products" USING btree ("state","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_applications_group_seller_uq" ON "seller_applications" USING btree ("checkout_group_id","seller_id");--> statement-breakpoint
CREATE INDEX "seller_applications_seller_status_idx" ON "seller_applications" USING btree ("seller_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_delivery_options_seller_type_uq" ON "seller_delivery_options" USING btree ("seller_id","type");--> statement-breakpoint
CREATE INDEX "seller_public_contacts_seller_idx" ON "seller_public_contacts" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_sessions_token_hash_uq" ON "seller_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "seller_sessions_seller_idx" ON "seller_sessions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "seller_sessions_expiry_idx" ON "seller_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_identity_subject_uq" ON "sellers" USING btree ("identity_provider","provider_subject_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_slug_uq" ON "sellers" USING btree ("slug");