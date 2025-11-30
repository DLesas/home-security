ALTER TABLE "alarmLogs" DROP CONSTRAINT "alarmLogs_alarmId_alarms_id_fk";
--> statement-breakpoint
ALTER TABLE "alarmUpdates" DROP CONSTRAINT "alarmUpdates_alarmId_alarms_id_fk";
--> statement-breakpoint
ALTER TABLE "sensorLogs" DROP CONSTRAINT "sensorLogs_sensorId_sensors_id_fk";
--> statement-breakpoint
ALTER TABLE "sensorUpdates" DROP CONSTRAINT "sensorUpdates_sensorId_sensors_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alarmLogs" ADD CONSTRAINT "alarmLogs_alarmId_alarms_id_fk" FOREIGN KEY ("alarmId") REFERENCES "public"."alarms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alarmUpdates" ADD CONSTRAINT "alarmUpdates_alarmId_alarms_id_fk" FOREIGN KEY ("alarmId") REFERENCES "public"."alarms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensorLogs" ADD CONSTRAINT "sensorLogs_sensorId_sensors_id_fk" FOREIGN KEY ("sensorId") REFERENCES "public"."sensors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensorUpdates" ADD CONSTRAINT "sensorUpdates_sensorId_sensors_id_fk" FOREIGN KEY ("sensorId") REFERENCES "public"."sensors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "alarms" DROP COLUMN IF EXISTS "deleted";--> statement-breakpoint
ALTER TABLE "alarms" DROP COLUMN IF EXISTS "deletedAt";--> statement-breakpoint
ALTER TABLE "buildings" DROP COLUMN IF EXISTS "deleted";--> statement-breakpoint
ALTER TABLE "buildings" DROP COLUMN IF EXISTS "deletedAt";--> statement-breakpoint
ALTER TABLE "cameras" DROP COLUMN IF EXISTS "deleted";--> statement-breakpoint
ALTER TABLE "cameras" DROP COLUMN IF EXISTS "deletedAt";--> statement-breakpoint
ALTER TABLE "sensors" DROP COLUMN IF EXISTS "deleted";--> statement-breakpoint
ALTER TABLE "sensors" DROP COLUMN IF EXISTS "deletedAt";--> statement-breakpoint
ALTER TABLE "motion_zones" DROP COLUMN IF EXISTS "deleted";--> statement-breakpoint
ALTER TABLE "motion_zones" DROP COLUMN IF EXISTS "deletedAt";