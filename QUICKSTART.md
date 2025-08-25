# Text Racing MMO - Quick Start Guide

This guide will get you up and running with the Text Racing MMO in just a few minutes.

## 🚀 Option 1: Automated Development Setup (Recommended)

The easiest way to get started:

```bash
# Clone the repository
git clone <repository-url>
cd text-racing-mmo

# Start everything automatically
npm run dev
```

This will:
- Install all dependencies
- Set up the database
- Build all components
- Start both backend and frontend servers
- Open the game at http://localhost:5173

## 🐳 Option 2: Docker Setup (Production-like)

If you have Docker installed:

```bash
# Start with Docker Compose
npm run deploy:dev

# The game will be available at http://localhost:3000
```

## 🔧 Option 3: Manual Setup

If you prefer to set up each component manually:

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Step-by-Step Setup

1. **Install Dependencies**
   ```bash
   npm run install:all
   ```

2. **Set up Database**
   ```bash
   # Make sure PostgreSQL is running
   # Update backend/.env with your database credentials
   cd backend
   node setup-database.js
   cd ..
   ```

3. **Build Components**
   ```bash
   npm run build:all
   ```

4. **Start Backend** (in one terminal)
   ```bash
   npm run dev:backend
   ```

5. **Start Frontend** (in another terminal)
   ```bash
   npm run dev:frontend
   ```

6. **Open the Game**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## 🎮 How to Play

1. **Register/Login**: Create an account or log in
2. **Select Car**: Choose from available car models
3. **Create/Join Race**: Start a new race or join an existing one
4. **Race**: Use commands to control your car:
   - `accelerate` - Apply throttle
   - `brake` - Apply brakes
   - `coast` - Let the car coast
   - `pit` - Enter pit lane

## 🔍 Troubleshooting

### Backend Not Starting
```bash
# Test if backend is responding
node test-backend.js

# Check logs
npm run dev:backend
```

### Database Issues
```bash
# Reset database
cd backend
node reset-database.js
node setup-database.js
```

### Frontend Can't Connect
- Make sure backend is running on port 3000
- Check browser console for errors
- Verify CORS settings in backend/.env

### Port Conflicts
If ports 3000 or 5173 are in use:
- Backend: Change `PORT` in backend/.env
- Frontend: Change port in frontend/vite.config.ts

## 📊 Health Checks

- Backend Health: http://localhost:3000/health
- API Test: http://localhost:3000/api/cars
- WebSocket Test: Connect to ws://localhost:3000

## 🛠️ Development Commands

```bash
# Install dependencies
npm run install:all

# Build everything
npm run build:all

# Run tests
npm run test:all

# Database management
npm run setup:db
npm run reset:db

# Docker commands
npm run docker:build
npm run docker:run
npm run docker:stop
```

## 🎯 What's Working in the MVP

✅ **User Authentication**: Register, login, JWT tokens  
✅ **Car Selection**: Real car models with specifications  
✅ **Race Management**: Create and join races  
✅ **Real-time Racing**: WebSocket communication  
✅ **Physics Engine**: Authentic car performance  
✅ **Database**: PostgreSQL with proper schema  
✅ **Caching**: Redis for performance  
✅ **Deployment**: Docker and Docker Compose  

## 🆘 Getting Help

If you run into issues:

1. Check the console logs (both frontend and backend)
2. Verify all services are running:
   - PostgreSQL (port 5432)
   - Redis (port 6379)
   - Backend (port 3000)
   - Frontend (port 5173)
3. Run the test script: `node test-backend.js`
4. Check the [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup instructions

## 🎉 Success!

Once everything is running, you should see:
- Login page at http://localhost:5173
- Successful registration/login
- Car selection interface
- Race creation/joining functionality
- Real-time race updates

Happy racing! 🏁