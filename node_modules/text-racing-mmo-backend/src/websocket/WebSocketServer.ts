import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import type { 
  WebSocketEvents, 
  ConnectionState, 
  ErrorMessage 
} from '../../../shared/types/websocket';
import type { Command } from '../../../shared/types/commands';
import type { RaceState, RaceEvent } from '../../../shared/types/index';
import { ConnectionManager } from './ConnectionManager';
import { EventHandler } from './EventHandler';

export class WebSocketServer {
  private io: SocketIOServer;
  private connectionManager: ConnectionManager;
  private eventHandler: EventHandler;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.connectionManager = new ConnectionManager();
    this.eventHandler = new EventHandler(this.connectionManager);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Register connection
      this.connectionManager.addConnection(socket.id, socket);

      // Handle authentication
      socket.on('player:authenticate', async (data) => {
        try {
          await this.eventHandler.handleAuthentication(socket, data);
        } catch (error) {
          this.sendError(socket, 'AUTH_FAILED', 'Authentication failed');
        }
      });

      // Handle race commands
      socket.on('race:command', async (command: any) => {
        try {
          await this.eventHandler.handleRaceCommand(socket, command);
        } catch (error) {
          this.sendError(socket, 'COMMAND_FAILED', 'Failed to process command');
        }
      });

      // Handle race join
      socket.on('race:join', async (data) => {
        try {
          await this.eventHandler.handleRaceJoin(socket, data);
        } catch (error) {
          this.sendError(socket, 'JOIN_FAILED', 'Failed to join race');
        }
      });

      // Handle race leave
      socket.on('race:leave', async (data) => {
        try {
          await this.eventHandler.handleRaceLeave(socket, data);
        } catch (error) {
          this.sendError(socket, 'LEAVE_FAILED', 'Failed to leave race');
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
        this.eventHandler.handleDisconnection(socket, reason);
        this.connectionManager.removeConnection(socket.id);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
        this.sendError(socket, 'CONNECTION_ERROR', 'Connection error occurred');
      });
    });
  }

  // Broadcast race state update to all participants in a race
  public broadcastRaceUpdate(raceId: string, raceState: RaceState): void {
    const participants = this.connectionManager.getRaceParticipants(raceId);
    participants.forEach(socketId => {
      const socket = this.connectionManager.getSocket(socketId);
      if (socket) {
        socket.emit('race:update', raceState);
      }
    });
  }

  // Broadcast race event to all participants in a race
  public broadcastRaceEvent(raceId: string, raceEvent: RaceEvent): void {
    const participants = this.connectionManager.getRaceParticipants(raceId);
    participants.forEach(socketId => {
      const socket = this.connectionManager.getSocket(socketId);
      if (socket) {
        socket.emit('race:event', raceEvent);
      }
    });
  }

  // Send race completion to all participants
  public broadcastRaceComplete(raceId: string, raceResult: any): void {
    const participants = this.connectionManager.getRaceParticipants(raceId);
    participants.forEach(socketId => {
      const socket = this.connectionManager.getSocket(socketId);
      if (socket) {
        socket.emit('race:complete', raceResult);
      }
    });
  }

  // Send error message to specific socket
  private sendError(socket: any, code: string, message: string): void {
    const errorMessage: ErrorMessage = {
      message,
      code,
      timestamp: Date.now()
    };
    socket.emit('error', errorMessage);
  }

  // Get connection statistics
  public getConnectionStats(): { totalConnections: number; authenticatedConnections: number } {
    return this.connectionManager.getStats();
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    console.log('Shutting down WebSocket server...');
    
    // Notify all connected clients
    this.io.emit('error' as any, {
      message: 'Server is shutting down',
      code: 'SERVER_SHUTDOWN',
      timestamp: Date.now()
    });

    // Close all connections
    this.io.close();
    
    console.log('WebSocket server shutdown complete');
  }
}