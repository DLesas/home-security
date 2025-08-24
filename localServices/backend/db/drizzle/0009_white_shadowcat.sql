ALTER TABLE "sensorLogs" ALTER COLUMN "last_seen" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alarmLogs" ADD COLUMN "last_seen" timestamp with time zone;