# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN apk --no-cache add curl

# Install pm2 globally for process management
RUN npm install -g pm2

# Copy package files
COPY package*.json ./

# Install production dependencies only (skip prepare script)
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/app.js ./app.js

# Run with pm2-runtime for resilience (auto-restart on crash)
# Shell form needed for environment variable expansion
CMD pm2-runtime --name taskforce node -- app.js -n "${TASKFORCE_CONNECTION}" --team "${TASKFORCE_TEAM}"

# Healthcheck uses pm2 process name - must match --name above
HEALTHCHECK --interval=30s --timeout=30s \
  --start-period=5s --retries=3 CMD pm2 list | grep -q taskforce || exit 1

LABEL org.opencontainers.image.source="https://github.com/serenityapp/taskforce-connector"
LABEL org.opencontainers.image.description="Patched for AWS MemoryDB TLS compatibility"
