# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a distributed microservices-based IoT home security system with three main components:
1. **Raspberry Pi Pico microcontrollers** running CircuitPython (door sensors and alarm relays)
2. **Backend services** (Node.js/TypeScript) for API, scheduling, device management, and event processing
3. **Client applications** (Next.js web app, React Native mobile app, Electron desktop app)

## Architecture

### Service Communication Flow

```
CircuitPython Devices (sensors/alarms)
    ↓ (UDP broadcast for discovery, then HTTP for updates)
Backend API (Express + Socket.IO)
    ↓ (Redis pub/sub for events)
Event Service (push notifications)
    ↓ (Socket.IO WebSocket)
Client Apps (web/mobile/desktop)
```

### Data Layer
- **Redis**: High-performance cache for sensors, alarms, schedules, and pub/sub messaging
- **PostgreSQL**: Persistent storage for logs, audit trails, and historical data
- **Socket.IO**: Real-time bidirectional communication to all connected clients

### Key Singleton Managers

The backend uses three critical singleton managers that must never be duplicated:

1. **ScheduleManager** (`/localServices/backend/src/scheduleManager.ts`)
   - Uses **timeout-based execution** (NOT polling/intervals)
   - Manages separate `armTimeouts` and `disarmTimeouts` Maps keyed by scheduleId
   - After execution, only reschedules the action that executed (for recurring schedules)
   - Provides `resetSchedules()` for API routes to call when schedules change
   - All schedules contain BOTH arm and disarm configurations (unified schema)

2. **SensorTimeoutMonitor** (`/localServices/backend/src/microDeviceTimeoutMonitor.ts`)
   - Monitors device connectivity based on `expectedSecondsUpdated` intervals
   - Creates individual timeouts per sensor/alarm
   - Marks devices as "unknown" on timeout

3. **AlarmTimeoutManager** (`/localServices/backend/src/alarmTimeoutManager.ts`)
   - Manages cooldown periods (prevents re-triggering within 30s)
   - Handles auto-turnoff after configurable seconds per alarm

## Database Schemas

### Redis Repositories (Redis-OM)

**Door Sensors:**
```typescript
{
  name, externalID, building, armed, state,
  ipAddress, macAddress, temperature, voltage, frequency,
  expectedSecondsUpdated, lastUpdated
}
```

**Recurring Schedules (NEW unified schema):**
```typescript
{
  id, name, sensorIDs,
  armTime: "HH:MM",           // When to arm
  armDayOffset: number,       // Day offset: 0=same day, 1=next day, -1=previous
  disarmTime: "HH:MM",        // When to disarm
  disarmDayOffset: number,    // Day offset relative to arm day
  recurrence: "Daily" | "Weekly",
  days: string,               // JSON array for Weekly: ["Monday", "Wednesday"]
  active: boolean,
  createdAt, lastModified
}
```

**One-Time Schedules (NEW unified schema):**
```typescript
{
  id, name, sensorIDs,
  armDateTime: Date,          // Full timestamp for arm
  disarmDateTime: Date,       // Full timestamp for disarm
  createdAt
}
```

### PostgreSQL Key Tables

- `sensors`, `alarms`, `buildings`, `cameras` - Device metadata
- `sensorUpdates`, `alarmUpdates` - State change logs with telemetry
- `eventLogs` - System events (debug/info/warning/critical) with system origin
- `scheduleExecutions` - Audit trail with execution results (NEW)
  - Records executionType (Arm/Disarm), sensors affected, success/failure counts

## Critical Patterns

### Schedule System (Recently Refactored)

The schedule system enforces **complete arm/disarm cycles** - no standalone arm-only or disarm-only schedules.

**Execution Pattern:**
```typescript
// When creating/modifying/deleting schedules, ALWAYS call:
await scheduleManager.resetSchedules();
await emitNewData();
```

**Timeout-Based Execution (NOT Polling):**
- Calculate exact execution time
- Use `setTimeout()` for precise timing
- After execution, reschedule only the executed action (arm or disarm)
- For one-time schedules, auto-remove after disarm executes

**Retry Logic:**
- If arm fails (sensor open): retry every 60s until disarm time
- Track per-sensor retry contexts
- Hard cutoff at disarm time (always available in unified schema)
- Emit warning events after retries

### Device Communication

**Discovery Flow:**
1. Device sends UDP broadcast with server name (port 41234)
2. Advertisement Service validates and responds via TCP (port 31337)
3. Device sends handshake: `POST /api/v1/sensors/{sensorId}/handshake`
4. Device sends periodic updates: `POST /api/v1/sensors/{sensorId}/update`

**Update Flow:**
```
Device HTTP POST → Backend route → Update Redis → Log to PostgreSQL →
Check alarm triggers → Emit via Socket.IO → All clients update
```

### Event Publishing

```typescript
// Raise events using:
await raiseEvent({
  type: "info" | "warning" | "critical" | "debug",
  message: "...",
  system: "backend:schedules" // Prefix with service name
});

// Events flow through Redis pub/sub to EventService
// Critical/warning events trigger push notifications
```

### Real-Time Updates

Always emit updates to connected clients after state changes:
```typescript
import { emitNewData } from "./express/socketHandler";

// After any sensor/alarm/schedule modification:
await emitNewData();
```

## Common Commands

### Backend Development
```bash
cd localServices/backend
npm install
npm run build          # TypeScript compilation
npm start              # Run with tsx
npm run generate       # Generate Drizzle migrations
npm run studio         # Open Drizzle Studio (DB admin UI)
```

### WebApp Development
```bash
cd localServices/webapp
npm install
npm run dev            # Next.js dev server (port 3000)
npm run build          # Production build
npm run db:generate    # Generate PostgreSQL migrations
npm run db:migrate     # Run migrations
npm run db:studio      # Drizzle Studio
```

### Docker Services
```bash
# Start core services (redis, postgres, backend, event-system, advertisement, caddy)
docker compose --profile core up

# Backend health check
curl http://localhost:8080/health

# Stop all services
docker compose down
```

## File Locations

### Backend Entry Points
- Main server: `/localServices/backend/src/index.ts`
- Advertisement service: `/localServices/advertisement/index.js`
- Event service: `/localServices/event-system/index.js`

### Schema Definitions
- Redis schemas: `/localServices/backend/src/redis/*.ts`
- PostgreSQL schema: `/localServices/backend/src/db/schema/index.ts`
- Schedule executions: `/localServices/backend/src/db/schema/scheduleExecutions.ts`

### API Routes
- Sensors: `/localServices/backend/src/express/routes/Sensors.ts`
- Alarms: `/localServices/backend/src/express/routes/Alarms.ts`
- Schedules: `/localServices/backend/src/express/routes/Schedules.ts`
- Buildings: `/localServices/backend/src/express/routes/Buildings.ts`
- Logs: `/localServices/backend/src/express/routes/Logs.ts`

### Frontend
- Socket.IO context: `/localServices/webapp/app/socketData.tsx`
- Schedule editor: `/localServices/webapp/app/scheduling/scheduleEditor.tsx`

### CircuitPython Devices
- Door sensor: `/localServices/device_code/circuit_python/doorSensor.py`
- Alarm relay: `/localServices/device_code/circuit_python/alarmRelay.py`
- Main loop: `/localServices/device_code/circuit_python/main.py`

## Important Constraints

### TypeScript
- **Never use `any` type** - use proper typing or type assertions
- **Avoid EntityId from redis-om** - use explicit `id: string` field on Redis schemas instead
- Table imports: Use `scheduleExecutionTable` (singular), not `scheduleExecutionsTable`

### Redis-OM
- Always create indexes before querying: `await createScheduleIndexes()`
- EntityId symbol is buggy - add explicit `id` field to schemas
- Search with `.where("id").eq(scheduleId)` not `.where(EntityId)`

### Schedule Management
- Never poll schedules - use `setTimeout()` for exact execution times
- Call `scheduleManager.resetSchedules()` from API routes after changes
- Unified schema: every schedule has BOTH arm AND disarm times/datetimes
- No more `action` or `linkedScheduleId` fields (removed in refactor)

### Database
- Redis is cache - PostgreSQL is source of truth for historical data
- Always update both Redis and PostgreSQL on state changes
- Use transactions for multi-table updates in PostgreSQL

### Socket.IO
- Call `emitNewData()` after any sensor/alarm/schedule modification
- Clients automatically re-render on "data" events
- Connection handling in `/localServices/webapp/app/socketInitializer.tsx`

## Environment Variables

Key variables in `.env`:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `REDIS_HOST`, `REDIS_PORT`
- `SERVER_PORT`, `SERVER_NAME`, `SERVER_PASS`
- `UDP_BROADCAST_ADDR`, `UDP_BROADCAST_PORT`
- `ALARM_COOLDOWN_SECONDS` (default: 30)
- `SENSOR_WARNING_TEMPERATURE`, `SENSOR_CRITICAL_TEMPERATURE`
- `EXPO_ACCESS_TOKEN` (for push notifications)

## Testing Approach

When making changes:
1. Update Redis schema if needed (add `id` field explicitly)
2. Update PostgreSQL schema if logging changes
3. Modify API routes and call `resetSchedules()` if schedule-related
4. Update frontend types in `socketData.tsx`
5. Test with Docker Compose: `docker compose --profile core up`
6. Verify Socket.IO updates in browser console
7. Check PostgreSQL logs for audit trails

## Recent Major Changes

### Schedule System Refactor (Current)
- **Unified schema**: Every schedule contains both arm and disarm configurations
- **Removed fields**: `action`, `linkedScheduleId` (no more linked pairs)
- **New fields**: `armTime`/`armDayOffset`, `disarmTime`/`disarmDayOffset` for recurring
- **New fields**: `armDateTime`, `disarmDateTime` for one-time
- **Execution type**: Now tracked per-execution (Arm/Disarm) in audit table
- **Manager pattern**: Timeout-based with separate arm/disarm Maps
- **API changes**: Breaking changes to schedule creation/update endpoints

### Frontend Status
- WebApp and MobileApp are under active development
- Desktop Electron app exists but may be deprecated
- Core backend APIs are production-ready
