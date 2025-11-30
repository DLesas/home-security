CREATE TABLE IF NOT EXISTS "motion_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"cameraId" text NOT NULL,
	"name" text NOT NULL,
	"points" jsonb DEFAULT '[]'::jsonb,
	"minContourArea" integer DEFAULT 1500,
	"thresholdPercent" real DEFAULT 1,
	"deleted" boolean DEFAULT false,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"lastUpdated" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "camera_settings" ADD COLUMN "mog2History" integer DEFAULT 500;--> statement-breakpoint
ALTER TABLE "camera_settings" ADD COLUMN "mog2VarThreshold" real DEFAULT 16;--> statement-breakpoint
ALTER TABLE "camera_settings" ADD COLUMN "mog2DetectShadows" boolean DEFAULT false;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "motion_zones" ADD CONSTRAINT "motion_zones_cameraId_cameras_id_fk" FOREIGN KEY ("cameraId") REFERENCES "public"."cameras"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "camera_settings" DROP COLUMN IF EXISTS "motionMinContourArea";--> statement-breakpoint
ALTER TABLE "camera_settings" DROP COLUMN IF EXISTS "motionThresholdPercent";