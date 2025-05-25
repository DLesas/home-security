# advertisementService/Dockerfile
FROM node:22.14-alpine

WORKDIR /app

# Copy shared files with correct path

# Copy advertisement service files
COPY advertisementService/package*.json ./
RUN npm install

COPY advertisementService/scripts ./scripts
COPY advertisementService/src ./src
COPY backend/src/db ./src/shared/db
COPY backend/src/redis ./src/shared/redis
COPY backend/src/events ./src/shared/events
COPY advertisementService/tsconfig.json ./

RUN npm run build

# Port Documentation:
# This service uses the following ports (configured in docker-compose.yml):
# - UDP_BROADCAST_PORT (default: 41234) for UDP broadcasts
# - CLIENT_TCP_PORT (default: 31337) for TCP connections
# - BONJOUR_PORT (default: 4000) for mDNS/Bonjour service
# EXPOSE ${UDP_BROADCAST_PORT:-41234}/udp
# EXPOSE ${CLIENT_TCP_PORT:-31337}
# EXPOSE ${BONJOUR_PORT:-4000}

CMD ["npm", "start"]