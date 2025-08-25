# Text Racing MMO Backend

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- Redis (v6 or higher)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy `.env.example` to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```
   
   Update the database credentials in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=text_racing_mmo
   DB_USER=your_username
   DB_PASSWORD=your_password
   ```

3. **Setup database:**
   ```bash
   npm run db:setup
   ```
   
   This will:
   - Create the database and user (if they don't exist)
   - Run migrations to create tables
   - Seed initial data

4. **Start the development server:**
   ```bash
   npm run dev
   ```

### Manual Database Setup

If the automatic setup doesn't work, you can manually create the database:

```sql
-- Connect to PostgreSQL as superuser
CREATE USER your_username WITH PASSWORD 'your_password';
CREATE DATABASE text_racing_mmo OWNER your_username;
GRANT ALL PRIVILEGES ON DATABASE text_racing_mmo TO your_username;
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run db:create` - Create database and user
- `npm run db:setup` - Full database setup (create + migrate + seed)

### Troubleshooting

**Database connection error:**
- Make sure PostgreSQL is running
- Check your database credentials in `.env`
- Ensure the database exists and user has proper permissions

**Redis connection error:**
- Redis is optional for development - the server will run in degraded mode without it
- To install Redis: `winget install Redis.Redis` (Windows) or use Docker
- Check Redis configuration in `.env`

**Port already in use:**
- Change the PORT in `.env` to an available port

### Current Status

✅ **Database Connection**: Fixed and working  
✅ **Schema & Migrations**: Working  
✅ **Car Data Seeding**: Working  
⚠️ **Redis**: Optional - runs in degraded mode without it  
✅ **Server Startup**: Working on port 3000