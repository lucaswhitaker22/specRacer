import type { Socket } from 'socket.io';
import type { ConnectionState } from '../../../shared/types/websocket.js';

export class ConnectionManager {
  private connections: Map<string, Socket> = new Map();
  private connectionStates: Map<string, ConnectionState> = new Map();
  private playerToSocket: Map<string, string> = new Map(); // playerId -> socketId
  private raceParticipants: Map<string, Set<string>> = new Map(); // raceId -> Set<socketId>

  // Add a new connection
  public addConnection(socketId: string, socket: Socket): void {
    this.connections.set(socketId, socket);
    this.connectionStates.set(socketId, {
      isConnected: true,
      lastPing: Date.now()
    });
  }

  // Remove a connection
  public removeConnection(socketId: string): void {
    const connectionState = this.connectionStates.get(socketId);
    
    if (connectionState?.playerId) {
      // Remove player mapping
      this.playerToSocket.delete(connectionState.playerId);
      
      // Remove from all races
      this.raceParticipants.forEach((participants, raceId) => {
        if (participants.has(socketId)) {
          participants.delete(socketId);
          if (participants.size === 0) {
            this.raceParticipants.delete(raceId);
          }
        }
      });
    }

    this.connections.delete(socketId);
    this.connectionStates.delete(socketId);
  }

  // Authenticate a connection with player ID
  public authenticateConnection(socketId: string, playerId: string): void {
    const connectionState = this.connectionStates.get(socketId);
    if (connectionState) {
      // Remove old mapping if player was connected elsewhere
      const oldSocketId = this.playerToSocket.get(playerId);
      if (oldSocketId && oldSocketId !== socketId) {
        this.removeConnection(oldSocketId);
      }

      connectionState.playerId = playerId;
      this.playerToSocket.set(playerId, socketId);
      this.connectionStates.set(socketId, connectionState);
    }
  }

  // Add player to race
  public addPlayerToRace(socketId: string, raceId: string): void {
    const connectionState = this.connectionStates.get(socketId);
    if (connectionState) {
      connectionState.currentRaceId = raceId;
      
      if (!this.raceParticipants.has(raceId)) {
        this.raceParticipants.set(raceId, new Set());
      }
      this.raceParticipants.get(raceId)!.add(socketId);
    }
  }

  // Remove player from race
  public removePlayerFromRace(socketId: string, raceId: string): void {
    const connectionState = this.connectionStates.get(socketId);
    if (connectionState && connectionState.currentRaceId === raceId) {
      connectionState.currentRaceId = undefined;
    }

    const participants = this.raceParticipants.get(raceId);
    if (participants) {
      participants.delete(socketId);
      if (participants.size === 0) {
        this.raceParticipants.delete(raceId);
      }
    }
  }

  // Get socket by ID
  public getSocket(socketId: string): Socket | undefined {
    return this.connections.get(socketId);
  }

  // Get socket by player ID
  public getSocketByPlayerId(playerId: string): Socket | undefined {
    const socketId = this.playerToSocket.get(playerId);
    return socketId ? this.connections.get(socketId) : undefined;
  }

  // Get connection state
  public getConnectionState(socketId: string): ConnectionState | undefined {
    return this.connectionStates.get(socketId);
  }

  // Get all participants in a race
  public getRaceParticipants(raceId: string): string[] {
    const participants = this.raceParticipants.get(raceId);
    return participants ? Array.from(participants) : [];
  }

  // Check if player is connected
  public isPlayerConnected(playerId: string): boolean {
    const socketId = this.playerToSocket.get(playerId);
    return socketId ? this.connections.has(socketId) : false;
  }

  // Update last ping time
  public updatePing(socketId: string): void {
    const connectionState = this.connectionStates.get(socketId);
    if (connectionState) {
      connectionState.lastPing = Date.now();
    }
  }

  // Get connection statistics
  public getStats(): { totalConnections: number; authenticatedConnections: number } {
    const totalConnections = this.connections.size;
    const authenticatedConnections = Array.from(this.connectionStates.values())
      .filter(state => state.playerId).length;

    return { totalConnections, authenticatedConnections };
  }

  // Get all connected player IDs
  public getConnectedPlayerIds(): string[] {
    return Array.from(this.connectionStates.values())
      .filter(state => state.playerId)
      .map(state => state.playerId!);
  }

  // Clean up stale connections (connections that haven't pinged recently)
  public cleanupStaleConnections(maxAge: number = 120000): void { // 2 minutes default
    const now = Date.now();
    const staleConnections: string[] = [];

    this.connectionStates.forEach((state, socketId) => {
      if (now - state.lastPing > maxAge) {
        staleConnections.push(socketId);
      }
    });

    staleConnections.forEach(socketId => {
      console.log(`Cleaning up stale connection: ${socketId}`);
      const socket = this.connections.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
      this.removeConnection(socketId);
    });
  }
}