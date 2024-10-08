# Use the official Redis Stack image
FROM redis/redis-stack:latest

# Create a directory for the configuration file
RUN mkdir -p /usr/local/etc/redis

# Copy the Redis configuration file
COPY redis.conf /usr/local/etc/redis/redis-stack.conf

# Expose ports 6379 (Redis) and 8001 (RedisInsight)
EXPOSE 6379 8001

# Set the data directory
VOLUME /data

# Start Redis Stack Server with the configuration file
CMD ["redis-stack-server", "/usr/local/etc/redis/redis-stack.conf"]