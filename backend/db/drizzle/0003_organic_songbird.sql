DO $$ BEGIN
 CREATE TYPE "public"."alarmState" AS ENUM('on', 'off');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alarmLogs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"alarmId" text NOT NULL,
	"dateTime" timestamp with time zone NOT NULL,
	"class" varchar(255) NOT NULL,
	"function" varchar(255) NOT NULL,
	"errorMessage" text NOT NULL,
	"hash" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alarms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"buildingId" text NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"deleted" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alarmUpdates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"alarmId" text NOT NULL,
	"state" "alarmState" NOT NULL,
	"temperature" numeric(5, 2) NOT NULL,
	"voltage" numeric(5, 2),
	"frequency" integer,
	"dateTime" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "doorSensors" RENAME TO "sensors";--> statement-breakpoint
ALTER TABLE "sensors" DROP CONSTRAINT "doorSensors_buildingId_buildings_id_fk";
--> statement-breakpoint
ALTER TABLE "sensorLogs" DROP CONSTRAINT "sensorLogs_sensorId_doorSensors_id_fk";
--> statement-breakpoint
ALTER TABLE "sensorUpdates" DROP CONSTRAINT "sensorUpdates_sensorId_doorSensors_id_fk";
--> statement-breakpoint
ALTER TABLE "sensors" ADD COLUMN "deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "sensorUpdates" ADD COLUMN "voltage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "sensorUpdates" ADD COLUMN "frequency" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alarmLogs" ADD CONSTRAINT "alarmLogs_alarmId_alarms_id_fk" FOREIGN KEY ("alarmId") REFERENCES "public"."alarms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alarms" ADD CONSTRAINT "alarms_buildingId_buildings_id_fk" FOREIGN KEY ("buildingId") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alarmUpdates" ADD CONSTRAINT "alarmUpdates_alarmId_alarms_id_fk" FOREIGN KEY ("alarmId") REFERENCES "public"."alarms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensors" ADD CONSTRAINT "sensors_buildingId_buildings_id_fk" FOREIGN KEY ("buildingId") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensorLogs" ADD CONSTRAINT "sensorLogs_sensorId_sensors_id_fk" FOREIGN KEY ("sensorId") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensorUpdates" ADD CONSTRAINT "sensorUpdates_sensorId_sensors_id_fk" FOREIGN KEY ("sensorId") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
