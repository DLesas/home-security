-- Convert errorlogs to hypertable
DO $$
BEGIN
  IF NOT _timescaledb_internal.is_hypertable('errorLogs') THEN
    PERFORM create_hypertable('errorLogs', by_range('dateTime', INTERVAL '7 days'));
  END IF;
END $$;

-- Convert eventlogs to hypertable
DO $$
BEGIN
  IF NOT _timescaledb_internal.is_hypertable('eventLogs') THEN
    PERFORM create_hypertable('eventLogs', by_range('dateTime', INTERVAL '3 days'));
  END IF;
END $$;

-- Convert sensorUpdates to hypertable
DO $$
BEGIN
  IF NOT _timescaledb_internal.is_hypertable('sensorUpdates') THEN
    PERFORM create_hypertable('sensorUpdates', by_range('dateTime', INTERVAL '1 day'));
  END IF;
END $$;

-- Create index on sensorUpdates for sensor name, building name, and time
DO $$
BEGIN
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
END $$;

-- Convert accesslogs to hypertable
DO $$
BEGIN
  IF NOT _timescaledb_internal.is_hypertable('accessLogs') THEN
    PERFORM create_hypertable('accessLogs', by_range('dateTime', INTERVAL '3 days'));
  END IF;
END $$;


-- Convert sensorLogs to hypertable
DO $$
BEGIN
  IF NOT _timescaledb_internal.is_hypertable('sensorLogs') THEN
    PERFORM create_hypertable('sensorLogs', by_range('dateTime', INTERVAL '3 days'));
  END IF;
END $$;


-- Create index on sensorLogs for sensor name and building name
DO $$
BEGIN
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
END $$;
