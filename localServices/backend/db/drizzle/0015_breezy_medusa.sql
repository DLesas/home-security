ALTER TABLE "alarms" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "cameras" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "sensors" ADD COLUMN "deletedAt" timestamp;