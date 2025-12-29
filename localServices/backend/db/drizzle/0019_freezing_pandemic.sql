ALTER TABLE "camera_settings" ADD COLUMN "detectionModel" varchar(20) DEFAULT 'mog2' NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_settings" ADD COLUMN "modelSettings" jsonb DEFAULT '{"history":500,"varThreshold":16,"detectShadows":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "camera_settings" DROP COLUMN IF EXISTS "mog2History";--> statement-breakpoint
ALTER TABLE "camera_settings" DROP COLUMN IF EXISTS "mog2VarThreshold";--> statement-breakpoint
ALTER TABLE "camera_settings" DROP COLUMN IF EXISTS "mog2DetectShadows";