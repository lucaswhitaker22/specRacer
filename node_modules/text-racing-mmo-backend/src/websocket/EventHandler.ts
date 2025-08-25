import type { Socket } from 'socket.io';
import type { Command, CommandResult } from '../../../shared/types/commands';
import { ConnectionManager } from './ConnectionManager';
import { CommandProcessor } from '../engine/CommandProcessor';
import { RaceService } from '../services/RaceService';

export class EventHandler {
  private connectionManager: ConnectionManager;
  private commandProcessor: CommandProcessor;
  private raceService: RaceService;

  constructor(connectionManager: ConnectionManager, raceService?: RaceService) {
    this.connectionManager = connectionManager;
    this.commandProcessor = new CommandProcessor();
    this.raceService = raceService || new RaceService();
    
    // Set up race service event listeners
    this.setupRaceServiceListeners();
  }

  // Handle player authentication
  public async handleAuthentication(
    socket: Socket, 
    data: { token: string }
  ): Promise<void> {
    try {
      // TODO: Implement proper JWT token validation in later tasks
      // For now, extract playerId from token (simplified)
      const playerId = this.extractPlayerIdFromToken(data.token);
      
      if (!playerId) {
        throw new Error('Invalid token');
      }

      // Authenticate the connection
      this.connectionManager.authenticateConnection(socket.id, playerId);
      
      // Send confirmation
      socket.emit('connection:authenticated', { playerId });
      
      console.log(`Player ${playerId} authenticated on socket ${socket.id}`);
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  // Handle race command from player
  public async handleRaceCommand(socket: Socket, command: Command): Promise<void> {
    const connectionState = this.connectionManager.getConnectionState(socket.id);
    
    if (!connectionState?.playerId) {
      throw new Error('Player not authenticated');
    }

    if (!connectionState.currentRaceId) {
      throw new Error('Player not in a race');
    }

    try {
      // Process the command through the race service
      const commandText = `${command.type} ${command.parameters?.intensity || ''}`.trim();
      const result = await this.raceService.processPlayerCommand(
        connectionState.currentRaceId,
        connectionState.playerId,
        commandText
      );

      // Send command result back to player
      const commandResult: CommandResult = {
        success: result.isValid,
        message: result.error || `Command ${command.type} processed successfully`
      };

      socket.emit('command:result', commandResult);

      console.log(`Processed ${command.type} command for player ${connectionState.playerId}`);
    } catch (error) {
      console.error('Command processing error:', error);
      
      const commandResult: CommandResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Command processing failed'
      };

      socket.emit('command:result', commandResult);
    }
  }

  // Handle player joining a race
  public async handleRaceJoin(
    socket: Socket, 
    data: { raceId: string, carId: string }
  ): Promise<void> {
    const connectionState = this.connectionManager.getConnectionState(socket.id);
    
    if (!connectionState?.playerId) {
      throw new Error('Player not authenticated');
    }

    try {
      // Join race through race service
      const success = await this.raceService.joinRace(data.raceId, {
        playerId: connectionState.playerId,
        carId: data.carId
      });

      if (success) {
        this.connectionManager.addPlayerToRace(socket.id, data.raceId);
        
        // Send current race state to player
        const raceState = this.raceService.getRaceState(data.raceId);
        if (raceState) {
          socket.emit('race:state', raceState);
        }
        
        console.log(`Player ${connectionState.playerId} joined race ${data.raceId}`);
      } else {
        throw new Error('Failed to join race');
      }
    } catch (error) {
      console.error('Race join error:', error);
      throw error;
    }
  }

  // Handle player leaving a race
  public async handleRaceLeave(
    socket: Socket, 
    data: { raceId: string }
  ): Promise<void> {
    const connectionState = this.connectionManager.getConnectionState(socket.id);
    
    if (!connectionState?.playerId) {
      throw new Error('Player not authenticated');
    }

    try {
      // Leave race through race service
      await this.raceService.leaveRace(data.raceId, connectionState.playerId);
      this.connectionManager.removePlayerFromRace(socket.id, data.raceId);
      
      console.log(`Player ${connectionState.playerId} left race ${data.raceId}`);
    } catch (error) {
      console.error('Race leave error:', error);
      throw error;
    }
  }

  // Handle player disconnection
  public handleDisconnection(socket: Socket, reason: string): void {
    const connectionState = this.connectionManager.getConnectionState(socket.id);
    
    if (connectionState?.playerId) {
      console.log(`Player ${connectionState.playerId} disconnected: ${reason}`);
      
      // Notify RaceService about disconnection
      if (connectionState.currentRaceId) {
        console.log(`Player was in race ${connectionState.currentRaceId}`);
        // Note: We don't automatically remove players from races on disconnect
        // They can reconnect and continue racing
      }
    }
  }

  /**
   * Set up race service event listeners for broadcasting updates
   */
  private setupRaceServiceListeners(): void {
    this.raceService.on('raceStateUpdate', ({ raceId, raceState }) => {
      // Broadcast race state to all participants
      this.connectionManager.broadcastToRace(raceId, 'race:update', raceState);
    });

    this.raceService.on('raceStarted', ({ raceId }) => {
      this.connectionManager.broadcastToRace(raceId, 'race:started', { raceId });
    });

    this.raceService.on('raceCompleted', ({ raceId }) => {
      const result = this.raceService.getRaceResult(raceId);
      this.connectionManager.broadcastToRace(raceId, 'race:completed', { raceId, result });
    });

    this.raceService.on('pitStopStarted', ({ raceId, playerId, actions, duration }) => {
      this.connectionManager.broadcastToRace(raceId, 'race:pitStop', {
        playerId,
        actions,
        duration
      });
    });

    this.raceService.on('commandProcessed', ({ raceId, playerId, command }) => {
      // Optionally broadcast command events for spectators
      this.connectionManager.broadcastToRace(raceId, 'race:command', {
        playerId,
        command: command.command.type,
        timestamp: Date.now()
      });
    });
  }

  // Simplified token extraction (to be replaced with proper JWT validation)
  private extractPlayerIdFromToken(token: string): string | null {
    try {
      // For now, assume token is just the playerId (simplified for testing)
      // In production, this would decode and validate a JWT token
      if (token && token.length > 0) {
        return token;
      }
      return null;
    } catch (error) {
      console.error('Token extraction error:', error);
      return null;
    }
  }
}