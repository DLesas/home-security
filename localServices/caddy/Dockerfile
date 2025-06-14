# Build stage
FROM caddy:builder AS builder

# Build Caddy with rate limiting plugin
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit

# Runtime stage
FROM caddy:2.8-alpine

# Copy the custom Caddy binary from builder stage
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Create necessary directories
RUN mkdir -p /data/caddy

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Set volume for Caddy data
VOLUME ["/data/caddy"] 