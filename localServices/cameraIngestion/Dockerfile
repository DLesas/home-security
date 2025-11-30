# cameraIngestion/Dockerfile
FROM node:lts-alpine

# Install FFmpeg for video processing
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
