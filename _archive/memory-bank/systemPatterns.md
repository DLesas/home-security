# System Patterns

## Architecture Patterns

1. Local-First Architecture

   - AdminApp (Electron) orchestrates system
   - Docker containers for services
   - Local network communication
   - Optional remote access
   - USB device management with stable ordering
   - WiFi network management
   - System information monitoring

2. Service Communication

   - Redis pub/sub for real-time events
   - PostgreSQL for persistent storage
   - UDP broadcasting for device discovery
   - WebSocket/HTTPS for secure communication
   - Socket.IO for real-time updates
   - Bonjour/mDNS for service discovery

3. Device Discovery Pattern

   - Advertisement service broadcasts backend location
   - Devices auto-connect using broadcast info
   - Zero configuration for users
   - Network interface detection
   - Service registration via Bonjour
   - Stable USB device ordering
   - System information monitoring

4. Event Processing Pattern
   - Event service consumes Redis events
   - Event validation via Zod
   - Event routing and processing
   - Notification distribution
   - Logging and monitoring

## Design Patterns

1. Event-Driven Architecture

   - Redis pub/sub for real-time events
   - Event service for notification distribution
   - Decoupled service communication
   - Event validation and processing
   - Event persistence and logging

2. Container Orchestration

   - AdminApp manages Docker
   - Health checks for services
   - Automatic service recovery
   - Network isolation
   - Resource management

3. Security Patterns

   - Local network isolation
   - Secure external access via Caddy
   - Encrypted communication
   - USB device security
   - Network interface security
   - System information monitoring

4. UI/UX Patterns
   - NextUI component library
   - Tailwind CSS for styling
   - Responsive design
   - Real-time updates
   - Device management interface
   - Stable device ordering

# System Architecture Patterns

## Docker Service Management

1. Service Control Architecture:

   - Hybrid approach using both docker-compose and dockerode
   - docker-compose for service orchestration
   - dockerode for container-level operations
   - Service validation against docker-compose.yml

2. Service Discovery:

   - Dynamic service list from docker-compose.yml
   - Service name validation
   - Container-to-service mapping

3. Service Operations:

   - Individual service control (start/stop/restart)
   - Bulk service operations
   - Real-time log streaming
   - Service health monitoring

4. Known Challenges:
   - docker-compose.yml location management
     - Need to determine final location after adminApp downloads from server
     - Current temporary solution uses process.cwd()
     - Will need update when file download system is implemented

## Service Dependencies

1. Inter-service Dependencies:

   - Managed via docker-compose
   - Health check conditions
   - Network isolation
   - Startup order

2. External Dependencies:
   - Docker Engine
   - Docker Compose
   - Network requirements

## External Server Architecture

1. Central WireGuard Server (VPS)

   - Managed separately from user installations
   - Handles VPN connections for remote access
   - Not part of user's local network
   - Managed by system administrator

2. Phone Notifications Server (VPS)
   - Managed separately from user installations
   - Handles push notifications via Expo/Firebase/Apple
   - Receives events from user's eventService
   - Managed by system administrator

## Local Network Architecture
