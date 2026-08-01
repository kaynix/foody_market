CREATE TABLE "worker_heartbeats" (
	"worker_name" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkout_groups" ADD COLUMN "tracking_expires_at" timestamp with time zone DEFAULT now() + interval '90 days' NOT NULL;--> statement-breakpoint
ALTER TABLE "checkout_groups" ADD COLUMN "tracking_revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "checkout_groups_tracking_expiry_idx" ON "checkout_groups" USING btree ("tracking_expires_at","tracking_revoked_at");