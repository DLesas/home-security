FROM caddy:2.7-alpine

# Create necessary directories
RUN mkdir -p /data/caddy

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Expose ports
EXPOSE 80
EXPOSE 443

# Set volume for Caddy data
VOLUME ["/data/caddy"] 