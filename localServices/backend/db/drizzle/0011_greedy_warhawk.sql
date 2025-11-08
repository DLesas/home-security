DO $$ BEGIN
 CREATE TYPE "public"."scheduleAction" AS ENUM('Arm', 'Disarm');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scheduleRecurrence" AS ENUM('Daily', 'Weekly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scheduleType" AS ENUM('recurring', 'oneTime');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduleExecutions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scheduleId" varchar(255) NOT NULL,
	"scheduleName" varchar(255) NOT NULL,
	"scheduleType" "scheduleType" NOT NULL,
	"executionType" "scheduleAction" NOT NULL,
	"sensorIds" json NOT NULL,
	"armTime" varchar(8),
	"armDayOffset" integer,
	"disarmTime" varchar(8),
	"disarmDayOffset" integer,
	"recurrence" "scheduleRecurrence",
	"days" json,
	"active" boolean,
	"armDateTime" timestamp with time zone,
	"disarmDateTime" timestamp with time zone,
	"executedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"sensorsAffected" json NOT NULL,
	"successfulSensors" json NOT NULL,
	"failedSensors" json NOT NULL,
	"retriedSensors" json,
	"createdAt" timestamp with time zone DEFAULT now()
);
