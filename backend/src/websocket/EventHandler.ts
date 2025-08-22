import type { Socket } from 'socket.io';
import type { Command, CommandResult } from '../../../shared/types/commands';
import { ConnectionManager } from './ConnectionManager';
import { CommandProcessor } from '../engine/CommandProcessor';

export class EventHandler {
  private connectionManager: ConnectionManager;
  private commandProcessor: CommandProcessor;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.commandProcessor = new CommandProcessor();
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
      // Process the command through the command processor
      const result = this.commandProcessor.processCommand({
        playerId: connectionState.playerId,
        commandText: `${command.type} ${command.parameters?.intensity || ''}`.trim(),
        timestamp: command.timestamp
      });

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
    data: { raceId: string }
  ): Promise<void> {
    const connectionState = this.connectionManager.getConnectionState(socket.id);
    
    if (!connectionState?.playerId) {
      throw new Error('Player not authenticated');
    }

    try {
      // TODO: Validate race exists and player can join (implement in RaceService later)
      // For now, just add player to race
      this.connectionManager.addPlayerToRace(socket.id, data.raceId);
      
      console.log(`Player ${connectionState.playerId} joined race ${data.raceId}`);
      
      // TODO: Send current race state to player (implement when RaceService is ready)
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
      this.connectionManager.removePlayerFromRace(socket.id, data.raceId);
      
      console.log(`Player ${connectionState.playerId} left race ${data.raceId}`);
      
      // TODO: Notify RaceService about player leaving (implement later)
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
      
      // TODO: Notify RaceService about disconnection (implement later)
      // For now, just log the disconnection
      
      if (connectionState.currentRaceId) {
        console.log(`Player was in race ${connectionState.currentRaceId}`);
      }
    }
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