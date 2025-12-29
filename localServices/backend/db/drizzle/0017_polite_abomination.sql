ALTER TABLE "buildings" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_settings" ADD COLUMN "maxStreamFps" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "camera_settings" ADD COLUMN "maxRecordingFps" integer DEFAULT 15;