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

-- Convert sensorlogs to hypertable
DO $$
BEGIN
  IF NOT _timescaledb_internal.is_hypertable('sensorLogs') THEN
    PERFORM create_hypertable('sensorLogs', by_range('dateTime', INTERVAL '1 day'));
  END IF;
END $$;

-- Create index on sensorLogs for building name and time
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'sensor_logs_building_name_time_idx'
  ) THEN
    CREATE INDEX sensor_logs_building_name_time_idx
    ON sensorLogs (dateTime, (
      SELECT buildings.name
      FROM doorSensors
      JOIN buildings ON doorSensors.buildingId = buildings.id
      WHERE doorSensors.id = sensorLogs.sensorId
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