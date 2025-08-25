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
import { ErrorLogger, AppError } from '../utils/ErrorLogger';
import { StateRecoveryService } from '../services/StateRecoveryService';

export class WebSocketServer {
  private io: SocketIOServer;
  private connectionManager: ConnectionManager;
  private eventHandler: EventHandler;
  private logger: ErrorLogger;
  private stateRecovery: StateRecoveryService;
  private healthCheckInterval: NodeJS.Timeout | null = null;

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
    this.logger = ErrorLogger.getInstance();
    this.stateRecovery = StateRecoveryService.getInstance();
    
    this.setupEventHandlers();
    this.startHealthChecks();
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
          this.logger.logError(error as Error, {
            socketId: socket.id,
            operation: 'authentication'
          });
          this.sendError(socket, 'AUTH_FAILED', 'Authentication failed');
        }
      });

      // Handle race commands
      socket.on('race:command', async (command: any) => {
        try {
          await this.eventHandler.handleRaceCommand(socket, command);
        } catch (error) {
          this.logger.logError(error as Error, {
            socketId: socket.id,
            operation: 'race_command',
            command: command?.type
          });
          
          // Check if we need to recover race state
          if (error instanceof AppError && error.code === 'RACE_STATE_CORRUPTED') {
            await this.handleRaceStateCorruption(command.raceId);
          }
          
          this.sendError(socket, 'COMMAND_FAILED', 'Failed to process command');
        }
      });

      // Handle race join
      socket.on('race:join', async (data) => {
        try {
          await this.eventHandler.handleRaceJoin(socket, data);
        } catch (error) {
          this.logger.logError(error as Error, {
            socketId: socket.id,
            operation: 'race_join',
            raceId: data?.raceId
          });
          this.sendError(socket, 'JOIN_FAILED', 'Failed to join race');
        }
      });

      // Handle race leave
      socket.on('race:leave', async (data) => {
        try {
          await this.eventHandler.handleRaceLeave(socket, data);
        } catch (error) {
          this.logger.logError(error as Error, {
            socketId: socket.id,
            operation: 'race_leave',
            raceId: data?.raceId
          });
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

  // Handle race state corruption
  private async handleRaceStateCorruption(raceId: string): Promise<void> {
    try {
      this.logger.logWarning(
        'Attempting race state recovery',
        'STATE_RECOVERY_ATTEMPT',
        { raceId }
      );

      const recovery = await this.stateRecovery.recoverRaceState(raceId);
      
      if (recovery.success) {
        // Broadcast recovery to all participants
        const participants = this.connectionManager.getRaceParticipants(raceId);
        participants.forEach(socketId => {
          const socket = this.connectionManager.getSocket(socketId);
          if (socket) {
            socket.emit('race:recovered', {
              message: 'Race state has been recovered',
              recoveredState: recovery.recoveredState || recovery.fallbackState
            });
          }
        });
      } else {
        // Broadcast failure to all participants
        const participants = this.connectionManager.getRaceParticipants(raceId);
        participants.forEach(socketId => {
          const socket = this.connectionManager.getSocket(socketId);
          if (socket) {
            this.sendError(socket, 'RACE_RECOVERY_FAILED', 'Unable to recover race state');
          }
        });
      }
    } catch (error) {
      this.logger.logError(error as Error, {
        raceId,
        operation: 'state_recovery'
      });
    }
  }

  // Start health checks
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  // Perform health check
  private performHealthCheck(): void {
    try {
      const stats = this.getConnectionStats();
      
      this.logger.logInfo(
        'WebSocket health check',
        'HEALTH_CHECK',
        {
          totalConnections: stats.totalConnections,
          authenticatedConnections: stats.authenticatedConnections,
          timestamp: Date.now()
        }
      );

      // Check for stale connections
      this.connectionManager.cleanupStaleConnections();
    } catch (error) {
      this.logger.logError(error as Error, {
        operation: 'health_check'
      });
    }
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    console.log('Shutting down WebSocket server...');
    
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Notify all connected clients
    this.io.emit('error' as any, {
      message: 'Server is shutting down',
      code: 'SERVER_SHUTDOWN',
      timestamp: Date.now()
    });

    // Give clients time to handle shutdown message
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Close all connections
    this.io.close();
    
    console.log('WebSocket server shutdown complete');
  }
}