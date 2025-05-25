DO $$ BEGIN
 CREATE TYPE "public"."actions" AS ENUM('GET', 'POST', 'DELETE', 'PUT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."connection" AS ENUM('http', 'socket');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."state" AS ENUM('open', 'closed', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."eventType" AS ENUM('info', 'warning', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "buildings" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doorSensors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"buildingId" text NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "errorLogs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"endpoint" varchar(256) NOT NULL,
	"errorTrace" varchar(2048) NOT NULL,
	"dateTime" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eventLogs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" "eventType" NOT NULL,
	"message" text NOT NULL,
	"dateTime" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accessLogs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"endpoint" varchar(256) NOT NULL,
	"queryString" varchar(2048),
	"action" "actions" NOT NULL,
	"connection" "connection" NOT NULL,
	"clientIp" varchar(256) NOT NULL,
	"userAgent" varchar(512),
	"dateTime" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensorLogs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sensorId" text NOT NULL,
	"dateTime" timestamp with time zone NOT NULL,
	"class" varchar(255) NOT NULL,
	"function" varchar(255) NOT NULL,
	"errorMessage" text NOT NULL,
	"hash" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensorUpdates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sensorId" text NOT NULL,
	"state" "state" NOT NULL,
	"temperature" numeric(5, 2) NOT NULL,
	"dateTime" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doorSensors" ADD CONSTRAINT "doorSensors_buildingId_buildings_id_fk" FOREIGN KEY ("buildingId") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensorLogs" ADD CONSTRAINT "sensorLogs_sensorId_doorSensors_id_fk" FOREIGN KEY ("sensorId") REFERENCES "public"."doorSensors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensorUpdates" ADD CONSTRAINT "sensorUpdates_sensorId_doorSensors_id_fk" FOREIGN KEY ("sensorId") REFERENCES "public"."doorSensors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
