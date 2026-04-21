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

# Patch apihelper LoggingHelper to skip CloudWatch when no AWS credentials configured
RUN node -e " \
  const fs = require('fs'); \
  const f = '/app/node_modules/@churchapps/apihelper/dist/helpers/LoggingHelper.js'; \
  let c = fs.readFileSync(f, 'utf8'); \
  c = c.replace( \
    'if (EnvironmentBase.appEnv === \"staging\")\n            this.logDestination = \"cloudwatch\";\n        else if (EnvironmentBase.appEnv === \"prod\")\n            this.logDestination = \"cloudwatch\";', \
    'if (EnvironmentBase.appEnv === \"prod\" && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID)\n            this.logDestination = \"cloudwatch\";' \
  ); \
  fs.writeFileSync(f, c); \
"

# Create content directory for local file storage
RUN mkdir -p /app/content && chmod 755 /app/content

# Expose API port
EXPOSE 8084

# Expose WebSocket port
EXPOSE 8087

# Start VPS server (includes both HTTP and WebSocket)
CMD ["node", "dist/vps-server.js"]
