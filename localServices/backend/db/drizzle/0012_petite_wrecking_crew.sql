-- Drop old primary key constraint for alarmLogs
ALTER TABLE "alarmLogs" DROP CONSTRAINT "alarmLogs_pkey";--> statement-breakpoint
-- Drop old primary key constraint for alarmUpdates
ALTER TABLE "alarmUpdates" DROP CONSTRAINT "alarmUpdates_pkey";--> statement-breakpoint
ALTER TABLE "alarmUpdates" ALTER COLUMN "dateTime" SET NOT NULL;--> statement-breakpoint
-- Drop old primary key constraint for errorLogs
ALTER TABLE "errorLogs" DROP CONSTRAINT "errorLogs_pkey";--> statement-breakpoint
ALTER TABLE "errorLogs" ALTER COLUMN "dateTime" SET NOT NULL;--> statement-breakpoint
-- Drop old primary key constraint for eventLogs
ALTER TABLE "eventLogs" DROP CONSTRAINT "eventLogs_pkey";--> statement-breakpoint
ALTER TABLE "eventLogs" ALTER COLUMN "dateTime" SET NOT NULL;--> statement-breakpoint
-- Drop old primary key constraint for accessLogs
ALTER TABLE "accessLogs" DROP CONSTRAINT "accessLogs_pkey";--> statement-breakpoint
ALTER TABLE "accessLogs" ALTER COLUMN "dateTime" SET NOT NULL;--> statement-breakpoint
-- Drop old primary key constraint for sensorLogs
ALTER TABLE "sensorLogs" DROP CONSTRAINT "sensorLogs_pkey";--> statement-breakpoint
-- Drop old primary key constraint for sensorUpdates
ALTER TABLE "sensorUpdates" DROP CONSTRAINT "sensorUpdates_pkey";--> statement-breakpoint
ALTER TABLE "sensorUpdates" ALTER COLUMN "dateTime" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alarmLogs" ADD CONSTRAINT "alarmLogs_id_dateTime_pk" PRIMARY KEY("id","dateTime");--> statement-breakpoint
ALTER TABLE "alarmUpdates" ADD CONSTRAINT "alarmUpdates_id_dateTime_pk" PRIMARY KEY("id","dateTime");--> statement-breakpoint
ALTER TABLE "errorLogs" ADD CONSTRAINT "errorLogs_id_dateTime_pk" PRIMARY KEY("id","dateTime");--> statement-breakpoint
ALTER TABLE "eventLogs" ADD CONSTRAINT "eventLogs_id_dateTime_pk" PRIMARY KEY("id","dateTime");--> statement-breakpoint
ALTER TABLE "accessLogs" ADD CONSTRAINT "accessLogs_id_dateTime_pk" PRIMARY KEY("id","dateTime");--> statement-breakpoint
ALTER TABLE "sensorLogs" ADD CONSTRAINT "sensorLogs_id_dateTime_pk" PRIMARY KEY("id","dateTime");--> statement-breakpoint
ALTER TABLE "sensorUpdates" ADD CONSTRAINT "sensorUpdates_id_dateTime_pk" PRIMARY KEY("id","dateTime");