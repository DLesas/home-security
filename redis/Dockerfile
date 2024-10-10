# Use the official Redis Stack image
FROM redis/redis-stack:latest

# Expose Redis ports (6379 for Redis, 8001 for RedisInsight)
EXPOSE 6379
EXPOSE 8001

# Create a directory for Redis persistence data

# Copy custom Redis configuration (if needed)
COPY redis-stack.conf /redis-stack.conf


# Expose ports 6379 (Redis) and 8001 (RedisInsight)
EXPOSE 6379 8001

# Set the working directory to /data for persistence
WORKDIR /data

# Start Redis Stack with the custom configuration
CMD ["redis-stack-server", "--appendonly", "yes", "--dir", "/data"]