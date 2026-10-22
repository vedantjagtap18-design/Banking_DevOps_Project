# Stage 1: Production Runtime
FROM node:20-alpine

# Set secure working directory
WORKDIR /usr/src/app

# Install dependencies (only production packages)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and public assets
COPY src/ ./src/

# Security Hardening: Run as unprivileged user
USER node

# Expose Banking application and metrics port
EXPOSE 3000

# Docker native container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "src/server.js"]
