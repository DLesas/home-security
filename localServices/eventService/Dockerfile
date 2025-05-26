# advertisementService/Dockerfile
FROM node:lts-alpine

WORKDIR /app

COPY eventService/package*.json ./
RUN npm install

COPY eventService/scripts ./scripts
COPY eventService/src ./src

RUN rm -rf ./src/shared/db ./src/shared/redis ./src/shared/events
RUN mkdir -p ./src/shared/db ./src/shared/redis ./src/shared/events

COPY backend/src/db ./src/shared/db/
COPY backend/src/redis ./src/shared/redis/
COPY backend/src/events ./src/shared/events/
COPY eventService/tsconfig.json ./

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