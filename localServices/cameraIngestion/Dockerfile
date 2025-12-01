# cameraIngestion/Dockerfile.simple
# Simple Dockerfile for development/ARM64 Macs (no GPU acceleration)

FROM node:lts-alpine

# Install FFmpeg from Alpine repos (works on ARM64 and x86_64)
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY cameraIngestion/package*.json ./
RUN npm install

COPY cameraIngestion/src ./src

# Remove symlinked shared folders and replace with actual backend code
RUN rm -rf ./src/shared/db ./src/shared/redis ./src/shared/events
RUN mkdir -p ./src/shared/db ./src/shared/redis ./src/shared/events

COPY backend/src/db ./src/shared/db/
COPY backend/src/redis ./src/shared/redis/
COPY backend/src/events ./src/shared/events/
COPY cameraIngestion/tsconfig.json ./

RUN npm run build

CMD ["npm", "start"]
