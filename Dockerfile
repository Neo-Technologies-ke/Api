# Multi-stage build for B1Api backend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --legacy-peer-deps --no-audit --no-fund || \
    npm install --legacy-peer-deps --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Development stage
FROM node:22-alpine AS development

WORKDIR /app

# Install mysql client for healthchecks
RUN apk add --no-cache mysql-client

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev)
# Use install instead of ci for better compatibility
RUN npm install --legacy-peer-deps --no-audit --no-fund || \
    npm install --legacy-peer-deps --no-audit --no-fund

# Copy source code
COPY . .

# Expose API port
EXPOSE 8084

# Expose WebSocket port
EXPOSE 8087

# Start development server
CMD ["npm", "run", "dev"]

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install mysql client for healthchecks and cron
RUN apk add --no-cache mysql-client dcron

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/config ./config

# Install only production dependencies
RUN npm install --only=production --legacy-peer-deps --no-audit --no-fund || \
    npm install --production --legacy-peer-deps --no-audit --no-fund

# Expose API port
EXPOSE 8084

# Expose WebSocket port
EXPOSE 8087

# Start VPS server (includes both HTTP and WebSocket)
CMD ["node", "dist/vps-server.js"]
