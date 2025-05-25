# Use the official Redis Stack image
FROM redis/redis-stack:latest

# Create a directory for Redis persistence data

# Copy custom Redis configuration (if needed)
COPY redis-stack.conf /redis-stack.conf


# Handled in docker-compose.yml, for Documentation purposes. 6379 is the default port for Redis and 8001 is the default port for RedisInsight
#EXPOSE 6379 8001

# Set the working directory to /data for persistence
WORKDIR /data

# Start Redis Stack with the custom configuration
CMD ["redis-stack-server", "--appendonly", "yes", "--dir", "/data"]