CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

SELECT create_hypertable('"errorLogs"', 'dateTime', chunk_time_interval => INTERVAL '7 days', if_not_exists => true, migrate_data => true);
SELECT create_hypertable('"eventLogs"', 'dateTime', chunk_time_interval => INTERVAL '3 days', if_not_exists => true, migrate_data => true);
SELECT create_hypertable('"sensorUpdates"', 'dateTime', chunk_time_interval => INTERVAL '1 day', if_not_exists => true, migrate_data => true);
SELECT create_hypertable('"accessLogs"', 'dateTime', chunk_time_interval => INTERVAL '3 days', if_not_exists => true, migrate_data => true);
SELECT create_hypertable('"sensorLogs"', 'dateTime', chunk_time_interval => INTERVAL '3 days', if_not_exists => true, migrate_data => true);
SELECT create_hypertable('"alarmUpdates"', 'dateTime', chunk_time_interval => INTERVAL '1 day', if_not_exists => true, migrate_data => true);
SELECT create_hypertable('"alarmLogs"', 'dateTime', chunk_time_interval => INTERVAL '3 days', if_not_exists => true, migrate_data => true);
