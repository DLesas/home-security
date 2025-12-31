CREATE TABLE IF NOT EXISTS "detection_boxes" (
	"id" text PRIMARY KEY NOT NULL,
	"detectionId" text NOT NULL,
	"classId" integer NOT NULL,
	"className" varchar(50) NOT NULL,
	"confidence" real NOT NULL,
	"x1" real NOT NULL,
	"y1" real NOT NULL,
	"x2" real NOT NULL,
	"y2" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "detections" (
	"id" text PRIMARY KEY NOT NULL,
	"cameraId" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"modelUsed" varchar(50) NOT NULL,
	"processingTimeMs" real,
	"clipPath" text,
	"clipStatus" varchar(20) DEFAULT 'pending'
);
--> statement-breakpoint
ALTER TABLE "camera_settings" ADD COLUMN "objectDetectionEnabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "camera_settings" ADD COLUMN "classConfigs" jsonb DEFAULT '[{"class":"person","confidence":0.5},{"class":"car","confidence":0.5},{"class":"dog","confidence":0.5},{"class":"cat","confidence":0.5}]'::jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "detection_boxes" ADD CONSTRAINT "detection_boxes_detectionId_detections_id_fk" FOREIGN KEY ("detectionId") REFERENCES "public"."detections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "detections" ADD CONSTRAINT "detections_cameraId_cameras_id_fk" FOREIGN KEY ("cameraId") REFERENCES "public"."cameras"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "detection_boxes_detection_id_idx" ON "detection_boxes" USING btree ("detectionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "detection_boxes_class_name_idx" ON "detection_boxes" USING btree ("className");