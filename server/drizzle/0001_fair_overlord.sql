CREATE TABLE "channel_action_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"provider" text NOT NULL,
	"seller_id" uuid NOT NULL,
	"destination_fingerprint" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"action" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_link_intents" ADD COLUMN "provider_token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_action_tokens" ADD CONSTRAINT "channel_action_tokens_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_action_tokens_hash_uq" ON "channel_action_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "channel_action_tokens_expiry_idx" ON "channel_action_tokens" USING btree ("expires_at","consumed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_link_intents_provider_token_uq" ON "channel_link_intents" USING btree ("provider_token_hash");