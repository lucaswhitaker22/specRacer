# Text Racing MMO

A browser-based, text-driven MMO racing game where players select real car models and compete in persistent leagues through strategic text commands.

## MVP Features

✅ **Complete Race Flow**: From player login to race completion  
✅ **Car Selection**: Choose from authentic car models with real specifications  
✅ **Real-Time Racing**: WebSocket-based live race updates  
✅ **User Authentication**: Secure player registration and login  
✅ **Race Management**: Create and join races with other players  
✅ **Basic UI**: Clean, responsive interface for all game functions  
✅ **Docker Deployment**: Complete containerized deployment setup

## Project Structure

```
text-racing-mmo/
├── backend/                 # Node.js backend server
│   ├── src/
│   │   ├── services/       # Business logic services
│   │   ├── database/       # Database utilities
│   │   ├── engine/         # Game engine components
│   │   └── index.ts        # Main server entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
├── frontend/               # Vue.js frontend client
│   ├── src/
│   │   ├── components/     # Vue components
│   │   ├── services/       # Frontend services
│   │   └── main.ts         # Main app entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── shared/                 # Shared TypeScript types
│   ├── types/
│   │   ├── index.ts        # Core data models
│   │   ├── commands.ts     # Command interfaces
│   │   ├── player.ts       # Player data types
│   │   └── websocket.ts    # WebSocket event types
│   ├── package.json
│   └── tsconfig.json
└── package.json            # Root workspace configuration
```

## 🚀 Quick Start

**Get racing in 2 minutes:**

```bash
git clone <repository-url>
cd text-racing-mmo
npm run dev
```

That's it! The game will be available at http://localhost:5173

For detailed setup instructions, troubleshooting, and alternative installation methods, see [QUICKSTART.md](QUICKSTART.md).

## Game Flow

1. **Register/Login**: Create an account or log in
2. **Select Car**: Choose from available car models with real specifications
3. **Join/Create Race**: Start a new race or join an existing one
4. **Race**: Use text commands to control your car during the race
5. **View Results**: Check race results and league standings

## Racing Commands

- `accelerate` - Apply throttle to increase speed
- `brake` - Apply brakes to slow down
- `coast` - Let the car coast without throttle or brakes
- `pit` - Enter the pit lane for tire changes and refueling

### Development Commands

```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev:backend    # Backend server
npm run dev:frontend   # Frontend dev server

# Run tests
npm run test:all

# Database management
npm run setup:db       # Initialize database
npm run reset:db       # Reset database

# Docker commands
npm run docker:build   # Build Docker image
npm run docker:run     # Start with Docker Compose
npm run docker:stop    # Stop Docker containers
```

## Architecture

- **Frontend**: Vue.js 3 with TypeScript, Vite build tool
- **Backend**: Node.js with Express and Socket.IO for real-time communication
- **Database**: PostgreSQL for persistent data, Redis for sessions and caching
- **Shared Types**: Common TypeScript interfaces used by both frontend and backend

## Features

- Real car models with authentic specifications
- Text-based racing commands (accelerate, brake, shift, pit)
- Real-time race updates and position tracking
- Tire wear and fuel management strategy
- Persistent league standings and race history
- WebSocket-based real-time communication

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions including:
- Docker Compose setup
- Environment configuration
- Production deployment
- Scaling considerations
- Security best practices

## Technology Stack

- **Frontend**: Vue.js 3, TypeScript, Pinia
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Real-time**: Socket.IO
- **Deployment**: Docker, Docker Compose

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
