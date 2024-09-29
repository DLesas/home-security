-- Create TimescaleDB extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert errorLogs to hypertable
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'errorLogs') THEN
        PERFORM create_hypertable('errorLogs', 'dateTime', chunk_time_interval => INTERVAL '7 days', if_not_exists => true, migrate_data => true);
    END IF;
END $$;

-- Convert eventLogs to hypertable
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'eventLogs') THEN
        PERFORM create_hypertable('eventLogs', 'dateTime', chunk_time_interval => INTERVAL '3 days', if_not_exists => true, migrate_data => true);
    END IF;
END $$;

-- Convert sensorUpdates to hypertable
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sensorUpdates') THEN
        PERFORM create_hypertable('sensorUpdates', 'dateTime', chunk_time_interval => INTERVAL '1 day', if_not_exists => true, migrate_data => true);
    END IF;
END $$;

-- Create index on sensorUpdates for sensor name, building name, and time
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sensorUpdates') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE indexname = 'sensor_updates_sensor_name_building_name_time_idx'
        ) THEN
            CREATE INDEX sensor_updates_sensor_name_building_name_time_idx
            ON sensorUpdates (dateTime, (
                SELECT ds.name
                FROM doorSensors ds
                WHERE ds.id = sensorUpdates.sensorId
            ), (
                SELECT b.name
                FROM doorSensors ds
                JOIN buildings b ON ds.buildingId = b.id
                WHERE ds.id = sensorUpdates.sensorId
            ));
        END IF;
    END IF;
END $$;

-- Convert accessLogs to hypertable
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'accessLogs') THEN
        PERFORM create_hypertable('accessLogs', 'dateTime', chunk_time_interval => INTERVAL '3 days', if_not_exists => true, migrate_data => true);
    END IF;
END $$;

-- Convert sensorLogs to hypertable
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sensorLogs') THEN
        PERFORM create_hypertable('sensorLogs', 'dateTime', chunk_time_interval => INTERVAL '3 days', if_not_exists => true, migrate_data => true);
    END IF;
END $$;

-- Create index on sensorLogs for sensor name and building name
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sensorLogs') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE indexname = 'sensor_logs_sensor_name_building_name_idx'
        ) THEN
            CREATE INDEX sensor_logs_sensor_name_building_name_idx
            ON sensorLogs (dateTime, (
                SELECT ds.name
                FROM doorSensors ds
                WHERE ds.id = sensorLogs.sensorId
            ), (
                SELECT b.name
                FROM doorSensors ds
                JOIN buildings b ON ds.buildingId = b.id
                WHERE ds.id = sensorLogs.sensorId
            ));
        END IF;
    END IF;
END $$;
