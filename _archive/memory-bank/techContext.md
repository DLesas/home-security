# Technical Context

## Core Technologies

1. Backend Stack:

   - TypeScript/Node.js (ES Modules)
   - Express.js with Socket.IO
   - PostgreSQL with Drizzle ORM
   - Redis with Redis-OM
   - Zod for validation
   - Bonjour for service discovery
   - Expo Server SDK for push notifications

2. Frontend/Apps:

   - AdminApp (Electron + React):
     - Electron Vite for build system
     - React with TypeScript
     - NextUI components
     - Tailwind CSS for styling
     - Socket.IO for real-time communication
     - SystemInformation for device monitoring
     - USB device management with stable ordering
     - WiFi network management
   - React Native (Mobile App)
   - CircuitPython (Sensors)

3. Infrastructure:
   - Docker for containerization
   - Caddy for reverse proxy
   - Wireguard for remote access
   - Bonjour/mDNS for local discovery

## Service Architecture

1. Backend Service:

   - Main security system logic
   - WebSocket server for real-time updates
   - REST API endpoints
   - Database management
   - Device state management

2. Advertisement Service:

   - Bonjour service for device discovery
   - UDP broadcasting
   - Network interface management
   - Shared database access

3. Event Service:

   - Redis pub/sub consumer
   - Event processing and routing
   - Notification management
   - Logging and monitoring

4. Database Services:
   - PostgreSQL for persistent storage
   - Redis for real-time state
   - Drizzle ORM for type-safe queries

## Development Setup

1. Build Tools:

   - TypeScript for type safety
   - Electron Vite for AdminApp
   - Drizzle Kit for database management
   - ESLint + Prettier for code quality

2. Network Architecture:
   - Internal Docker network
   - Host network for discovery
   - Wireguard for remote access
   - WebSocket for real-time updates

## Dependencies

1. Core Services:

   - Docker
   - PostgreSQL
   - Redis
   - Node.js
   - TypeScript

2. External Dependencies:
   - Push notification service (Expo)
   - Time synchronization
   - Network connectivity
   - SystemInformation for device monitoring
   - USB device support with stable ordering
   - WiFi management

## External Server Technologies

1. Central WireGuard Server

   - WireGuard VPN server
   - VPS hosting (provider to be determined)
   - Network configuration management
   - Client certificate management

2. Phone Notifications Server
   - Expo push notification service
   - Firebase Cloud Messaging integration
   - Apple Push Notification service integration
   - VPS hosting (provider to be determined)

## Docker Management

1. Core Libraries:

   - dockerode: Container-level operations and monitoring
   - docker-compose: Service orchestration and management
   - js-yaml: Docker compose file parsing

2. Service Management Features:

   - Dynamic service discovery
   - Individual and bulk service control
   - Real-time log streaming
   - Health monitoring
   - Service validation

3. Implementation Details:

   - TypeScript/Node.js based
   - Event-driven architecture
   - Error handling and logging
   - Service state management

4. Future Considerations:
   - docker-compose.yml file management
   - Service configuration updates
   - Backup and restore procedures
   - Migration strategies
