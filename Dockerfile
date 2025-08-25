# Multi-stage build for Text Racing MMO

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
RUN npm run build

# Stage 3: Build shared types
FROM node:18-alpine AS shared-builder
WORKDIR /app/shared
COPY shared/package*.json ./
RUN npm ci --only=production
COPY shared/ ./
RUN npm run build

# Stage 4: Production image
FROM node:18-alpine AS production
WORKDIR /app

# Install production dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/
RUN npm ci --only=production --workspaces

# Copy built applications
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy necessary configuration files
COPY backend/.env.example ./backend/.env
COPY backend/setup-database.js ./backend/
COPY backend/reset-database.js ./backend/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S textrace -u 1001
USER textrace

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "backend/dist/index.js"]