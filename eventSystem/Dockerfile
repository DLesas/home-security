# advertisementService/Dockerfile
FROM node:lts-alpine

WORKDIR /app

# Copy shared files with correct path
COPY backend/src/db ./shared/db
COPY backend/src/redis ./shared/redis

# Copy advertisement service files
COPY eventSystem/package*.json ./
RUN npm install

COPY eventSystem/src ./src
COPY eventSystem/tsconfig.json ./

# Port Documentation:
# This service uses the following ports (configured in docker-compose.yml):
# - UDP_BROADCAST_PORT (default: 41234) for UDP broadcasts
# - CLIENT_TCP_PORT (default: 31337) for TCP connections
# - BONJOUR_PORT (default: 4000) for mDNS/Bonjour service
# EXPOSE ${UDP_BROADCAST_PORT:-41234}/udp
# EXPOSE ${CLIENT_TCP_PORT:-31337}
# EXPOSE ${BONJOUR_PORT:-4000}

RUN npm run build

CMD ["npm", "start"]