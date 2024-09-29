# Use the official Redis image from Docker Hub
FROM redis/redis-stack:latest

# Copy the Redis configuration file
COPY redis.conf /usr/local/etc/redis/redis.conf

# Expose port 6379
EXPOSE 6379
EXPOSE 8001

# Start Redis with the configuration file
CMD ["redis-stack-server", "/usr/local/etc/redis/redis.conf"]