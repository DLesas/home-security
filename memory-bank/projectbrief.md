# Home Security System Project Brief

## Core Purpose

A local-first, user-friendly security system where non-technical users can set up and manage their own home security infrastructure.

## Key Requirements

1. Local-first architecture with remote access capabilities
2. Easy setup and management for non-technical users
3. Real-time monitoring and notifications
4. Secure communication between all components
5. Plug-and-play device discovery

## Components

1. User's Local Server (Computer running AdminApp)
2. Door Sensors (CircuitPython microcontrollers)
3. Alarms (Microcontroller relays)
4. User's Phone (React Native app)
5. Docker-based services for system operation
6. External Servers (Managed separately):
   - Central WireGuard Server (VPS)
   - Phone Notifications Server (VPS)

## Success Criteria

1. Non-technical users can set up and manage the system
2. Real-time alerts for security events
3. System works primarily on local network
4. Remote access when needed
5. Reliable device discovery and communication
