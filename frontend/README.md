# Text Racing MMO - Frontend

Vue.js frontend application for the Text Racing MMO game.

## Features Implemented (Task 10)

### ✅ Vue.js Project Setup with TypeScript
- Vue 3 with Composition API
- TypeScript configuration with strict mode
- Vite build system with optimized development experience
- Vue Router for client-side routing
- Component structure for future implementation

### ✅ WebSocket Client with Automatic Reconnection
- Socket.io client integration
- Automatic reconnection with exponential backoff
- Connection health monitoring with ping/pong
- Graceful error handling and recovery
- Event-driven architecture for real-time communication

### ✅ State Management with Pinia
- **WebSocket Store**: Connection management, event handling, reconnection logic
- **Game Store**: Race state, car selection, race history management
- **Error Store**: Centralized error handling with auto-removal and categorization
- Reactive state with computed properties
- Type-safe store actions and getters

### ✅ Error Handling and User Feedback
- Centralized error management system
- Visual error notifications with different types (error, warning, info)
- Automatic error removal with configurable timeouts
- Network error handling with specific error codes
- Connection status indicators throughout the UI

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable Vue components
│   │   └── ErrorNotification.vue
│   ├── stores/              # Pinia state management
│   │   ├── websocket.ts     # WebSocket connection management
│   │   ├── game.ts          # Game state management
│   │   └── error.ts         # Error handling
│   ├── views/               # Route-level components
│   │   ├── Home.vue
│   │   ├── CarSelection.vue
│   │   ├── Race.vue
│   │   └── Standings.vue
│   ├── router/              # Vue Router configuration
│   │   └── index.ts
│   ├── App.vue              # Root component
│   └── main.ts              # Application entry point
├── __tests__/               # Test files
└── index.html               # HTML template
```

## Development

### Prerequisites
- Node.js 16+
- npm or yarn

### Setup
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Type Checking
```bash
npm run type-check
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
VITE_WEBSOCKET_URL=ws://localhost:3001
VITE_API_BASE_URL=http://localhost:3001/api
VITE_NODE_ENV=development
```

## WebSocket Events

The frontend handles these WebSocket events:

### Client to Server
- `race:command` - Send racing commands
- `race:join` - Join a race session
- `race:leave` - Leave a race session
- `player:authenticate` - Authenticate player

### Server to Client
- `race:update` - Receive race state updates
- `race:event` - Receive race events
- `race:complete` - Receive race results
- `command:result` - Command execution results
- `error` - Error messages
- `connection:authenticated` - Authentication confirmation

## Error Handling

The error system provides:
- **Automatic Error Removal**: Non-persistent errors auto-remove after 5 seconds
- **Error Categories**: Error, Warning, Info with different visual styles
- **Network Error Handling**: Specific handling for HTTP and WebSocket errors
- **Validation Errors**: Form validation error support
- **Persistent Errors**: Critical errors that require manual dismissal

## Connection Management

WebSocket connection features:
- **Automatic Reconnection**: Exponential backoff with jitter
- **Health Monitoring**: Periodic ping/pong for connection health
- **Graceful Degradation**: UI adapts to connection state
- **Error Recovery**: Automatic retry with maximum attempt limits

## Next Steps

This foundation enables implementation of:
- Task 11: Car selection interface
- Task 12: Race interface and command input
- Task 13: League standings and race history
- Task 14: Enhanced error handling
- Task 15: End-to-end testing

## Requirements Satisfied

- **Requirement 7.1**: ✅ Browser-based application with Vue.js
- **Requirement 7.4**: ✅ WebSocket communication with reconnection handling