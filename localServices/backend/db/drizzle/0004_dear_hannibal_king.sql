ALTER TABLE "alarms" ADD COLUMN "port" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "errorLogs" ADD COLUMN "level" "eventType" NOT NULL;