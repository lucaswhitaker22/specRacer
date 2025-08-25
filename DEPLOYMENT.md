# Text Racing MMO - Deployment Guide

This document provides instructions for deploying the Text Racing MMO application in various environments.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- PostgreSQL 15+ (if running without Docker)
- Redis 7+ (if running without Docker)

## Quick Start with Docker Compose

### Development Environment

1. Clone the repository and navigate to the project root
2. Copy environment configuration:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Start all services:
   ```bash
   docker-compose up -d
   ```
4. The application will be available at `http://localhost:3000`

### Production Environment

1. Update environment variables in `docker-compose.yml`:
   - Change database passwords
   - Set secure JWT_SECRET
   - Configure proper FRONTEND_URL

2. Start with production profile:
   ```bash
   docker-compose --profile production up -d
   ```

3. The application will be available at `http://localhost` (port 80)

## Manual Deployment

### Database Setup

1. Create PostgreSQL database:
   ```sql
   CREATE DATABASE textracingmmo;
   CREATE USER textrace WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE textracingmmo TO textrace;
   ```

2. Run database migrations:
   ```bash
   cd backend
   node setup-database.js
   ```

### Backend Deployment

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Set environment variables:
   ```bash
   export NODE_ENV=production
   export DATABASE_URL=postgresql://textrace:password@localhost:5432/textracingmmo
   export REDIS_URL=redis://localhost:6379
   export JWT_SECRET=your-super-secret-key
   export PORT=3000
   ```

4. Start the server:
   ```bash
   npm start
   ```

### Frontend Deployment

The frontend is served by the backend server as static files. No separate deployment is needed.

## Environment Variables

### Required Variables

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret key for JWT token signing

### Optional Variables

- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:5173)

## Health Checks

The application provides several health check endpoints:

- `GET /health`: Overall system health
- `GET /metrics`: System metrics (development only)
- `GET /logs/errors`: Error logs (development only)

## Monitoring

### Logs

Application logs are written to:
- Console output (Docker logs)
- `./logs` directory (if mounted)

### Metrics

System metrics are available at `/metrics` endpoint in development mode.

## Scaling

### Horizontal Scaling

The application can be scaled horizontally by:

1. Running multiple app instances behind a load balancer
2. Using Redis for session storage (already configured)
3. Ensuring database connection pooling is properly configured

### Database Scaling

For high-traffic scenarios:

1. Use PostgreSQL read replicas for read-heavy operations
2. Implement connection pooling (PgBouncer)
3. Consider database partitioning for race data

## Security Considerations

### Production Checklist

- [ ] Change default database passwords
- [ ] Set secure JWT_SECRET (32+ characters)
- [ ] Enable HTTPS with proper SSL certificates
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable Redis authentication
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting

### HTTPS Setup

For production deployment with HTTPS:

1. Obtain SSL certificates (Let's Encrypt recommended)
2. Update nginx configuration to handle SSL
3. Redirect HTTP to HTTPS
4. Update FRONTEND_URL to use https://

## Backup and Recovery

### Database Backup

```bash
# Create backup
pg_dump -h localhost -U textrace textracingmmo > backup.sql

# Restore backup
psql -h localhost -U textrace textracingmmo < backup.sql
```

### Redis Backup

Redis automatically creates snapshots. For manual backup:

```bash
# Create backup
redis-cli BGSAVE

# Copy dump.rdb file from Redis data directory
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify database is running and accessible
   - Check firewall rules

2. **Redis Connection Failed**
   - Verify Redis is running
   - Check REDIS_URL format
   - Ensure Redis is accessible from app container

3. **WebSocket Connection Issues**
   - Check proxy configuration for WebSocket upgrade
   - Verify CORS settings
   - Check firewall rules for WebSocket traffic

4. **Frontend Not Loading**
   - Verify frontend build completed successfully
   - Check static file serving configuration
   - Verify FRONTEND_URL matches actual URL

### Debug Mode

To enable debug logging:

```bash
export DEBUG=textrace:*
export LOG_LEVEL=debug
```

## Performance Tuning

### Database Optimization

1. Create indexes on frequently queried columns
2. Configure PostgreSQL shared_buffers and work_mem
3. Enable query logging to identify slow queries

### Redis Optimization

1. Configure appropriate maxmemory policy
2. Enable persistence if needed
3. Monitor memory usage

### Application Optimization

1. Enable gzip compression
2. Configure proper caching headers
3. Optimize WebSocket message frequency
4. Implement connection pooling

## Support

For deployment issues:

1. Check application logs
2. Verify all environment variables are set
3. Test database and Redis connectivity
4. Check health endpoints
5. Review Docker container logs

## Version History

- v1.0.0: Initial MVP deployment configuration
  - Docker Compose setup
  - Basic health checks
  - Development and production profiles