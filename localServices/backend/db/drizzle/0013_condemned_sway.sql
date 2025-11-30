CREATE TABLE IF NOT EXISTS "camera_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"cameraId" text NOT NULL,
	"targetWidth" integer,
	"targetHeight" integer,
	"motionDetectionEnabled" boolean DEFAULT true,
	"motionMinContourArea" integer DEFAULT 1500,
	"motionThresholdPercent" real DEFAULT 1,
	"isCurrent" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cameras" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"buildingId" text,
	"ipAddress" varchar(45),
	"port" integer NOT NULL,
	"protocol" varchar(10) DEFAULT 'udp',
	"username" varchar(256),
	"password" varchar(256),
	"streamPath" varchar(512),
	"createdAt" timestamp DEFAULT now(),
	"lastUpdated" timestamp DEFAULT now(),
	"deleted" boolean DEFAULT false
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "camera_settings" ADD CONSTRAINT "camera_settings_cameraId_cameras_id_fk" FOREIGN KEY ("cameraId") REFERENCES "public"."cameras"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cameras" ADD CONSTRAINT "cameras_buildingId_buildings_id_fk" FOREIGN KEY ("buildingId") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
