A browser-based, text-driven MMO racing game where players select real car models and compete in persistent leagues through strategic text commands.

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

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Set up environment variables (create .env files in backend/)

3. Run database migrations (to be implemented)

4. Start development servers:
```bash
# Backend (in one terminal)
npm run dev:backend

# Frontend (in another terminal)  
npm run dev:frontend
```

### Testing

Run all tests:
```bash
npm run test:all
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

## Development Status

This project is currently in development. See `.kiro/specs/text-racing-mmo/tasks.md` for the implementation roadmap.
