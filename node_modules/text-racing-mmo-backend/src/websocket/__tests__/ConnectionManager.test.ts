import { ConnectionManager } from '../ConnectionManager';
import type { Socket } from 'socket.io';

// Mock Socket for testing
const createMockSocket = (id: string): Socket => ({
  id,
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn()
} as any);

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockSocket1: Socket;
  let mockSocket2: Socket;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockSocket1 = createMockSocket('socket-1');
    mockSocket2 = createMockSocket('socket-2');
  });

  describe('Connection Management', () => {
    it('should add and track connections', () => {
      connectionManager.addConnection('socket-1', mockSocket1);
      
      const socket = connectionManager.getSocket('socket-1');
      expect(socket).toBe(mockSocket1);
      
      const state = connectionManager.getConnectionState('socket-1');
      expect(state).toEqual({
        isConnected: true,
        lastPing: expect.any(Number)
      });
    });

    it('should remove connections and clean up state', () => {
      connectionManager.addConnection('socket-1', mockSocket1);
      connectionManager.authenticateConnection('socket-1', 'player-1');
      connectionManager.addPlayerToRace('socket-1', 'race-1');

      connectionManager.removeConnection('socket-1');

      expect(connectionManager.getSocket('socket-1')).toBeUndefined();
      expect(connectionManager.getConnectionState('socket-1')).toBeUndefined();
      expect(connectionManager.isPlayerConnected('player-1')).toBe(false);
      expect(connectionManager.getRaceParticipants('race-1')).toEqual([]);
    });

    it('should provide accurate connection statistics', () => {
      connectionManager.addConnection('socket-1', mockSocket1);
      connectionManager.addConnection('socket-2', mockSocket2);
      connectionManager.authenticateConnection('socket-1', 'player-1');

      const stats = connectionManager.getStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.authenticatedConnections).toBe(1);
    });
  });

  describe('Authentication', () => {
    it('should authenticate connections and map players to sockets', () => {
      connectionManager.addConnection('socket-1', mockSocket1);
      connectionManager.authenticateConnection('socket-1', 'player-1');

      const socket = connectionManager.getSocketByPlayerId('player-1');
      expect(socket).toBe(mockSocket1);
      expect(connectionManager.isPlayerConnected('player-1')).toBe(true);

      const state = connectionManager.getConnectionState('socket-1');
      expect(state?.playerId).toBe('player-1');
    });

    it('should handle player reconnection by removing old connection', () => {
      // Player connects on first socket
      connectionManager.addConnection('socket-1', mockSocket1);
      connectionManager.authenticateConnection('socket-1', 'player-1');

      // Player connects on second socket (reconnection)
      connectionManager.addConnection('socket-2', mockSocket2);
      connectionManager.authenticateConnection('socket-2', 'player-1');

      // Old connection should be removed
      expect(connectionManager.getSocket('socket-1')).toBeUndefined();
      expect(connectionManager.getSocketByPlayerId('player-1')).toBe(mockSocket2);
    });

    it('should return list of connected player IDs', () => {
      connectionManager.addConnection('socket-1', mockSocket1);
      connectionManager.addConnection('socket-2', mockSocket2);
      connectionManager.authenticateConnection('socket-1', 'player-1');
      connectionManager.authenticateConnection('socket-2', 'player-2');

      const playerIds = connectionManager.getConnectedPlayerIds();
      expect(playerIds).toContain('player-1');
      expect(playerIds).toContain('player-2');
      expect(playerIds).toHaveLength(2);
    });
  });

  describe('Race Participation', () => {
    beforeEach(() => {
      connectionManager.addConnection('socket-1', mockSocket1);
      connectionManager.addConnection('socket-2', mockSocket2);
      connectionManager.authenticateConnection('socket-1', 'player-1');
      connectionManager.authenticateConnection('socket-2', 'player-2');
    });

    it('should add players to races', () => {
      connectionManager.addPlayerToRace('socket-1', 'race-1');
      connectionManager.addPlayerToRace('socket-2', 'race-1');

      const participants = connectionManager.getRaceParticipants('race-1');
      expect(participants).toContain('socket-1');
      expect(participants).toContain('socket-2');
      expect(participants).toHaveLength(2);

      const state1 = connectionManager.getConnectionState('socket-1');
      expect(state1?.currentRaceId).toBe('race-1');
    });

    it('should remove players from races', () => {
      connectionManager.addPlayerToRace('socket-1', 'race-1');
      connectionManager.addPlayerToRace('socket-2', 'race-1');

      connectionManager.removePlayerFromRace('socket-1', 'race-1');

      const participants = connectionManager.getRaceParticipants('race-1');
      expect(participants).not.toContain('socket-1');
      expect(participants).toContain('socket-2');
      expect(participants).toHaveLength(1);

      const state1 = connectionManager.getConnectionState('socket-1');
      expect(state1?.currentRaceId).toBeUndefined();
    });

    it('should clean up empty races', () => {
      connectionManager.addPlayerToRace('socket-1', 'race-1');
      connectionManager.removePlayerFromRace('socket-1', 'race-1');

      const participants = connectionManager.getRaceParticipants('race-1');
      expect(participants).toEqual([]);
    });

    it('should handle multiple races simultaneously', () => {
      connectionManager.addPlayerToRace('socket-1', 'race-1');
      connectionManager.addPlayerToRace('socket-2', 'race-2');

      expect(connectionManager.getRaceParticipants('race-1')).toEqual(['socket-1']);
      expect(connectionManager.getRaceParticipants('race-2')).toEqual(['socket-2']);
    });
  });

  describe('Ping Management', () => {
    it('should update ping timestamps', (done) => {
      connectionManager.addConnection('socket-1', mockSocket1);
      
      const initialState = connectionManager.getConnectionState('socket-1');
      const initialPing = initialState?.lastPing || 0;

      // Wait a bit and update ping
      setTimeout(() => {
        connectionManager.updatePing('socket-1');
        
        const updatedState = connectionManager.getConnectionState('socket-1');
        const updatedPing = updatedState?.lastPing || 0;
        
        expect(updatedPing).toBeGreaterThan(initialPing);
        done();
      }, 10);
    });

    it('should clean up stale connections', () => {
      connectionManager.addConnection('socket-1', mockSocket1);
      connectionManager.addConnection('socket-2', mockSocket2);

      // Manually set old ping time for socket-1
      const state1 = connectionManager.getConnectionState('socket-1');
      if (state1) {
        state1.lastPing = Date.now() - 200000; // 200 seconds ago
      }

      connectionManager.cleanupStaleConnections(120000); // 2 minutes max age

      expect(connectionManager.getSocket('socket-1')).toBeUndefined();
      expect(connectionManager.getSocket('socket-2')).toBeDefined();
      expect(mockSocket1.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations on non-existent connections gracefully', () => {
      expect(connectionManager.getSocket('non-existent')).toBeUndefined();
      expect(connectionManager.getConnectionState('non-existent')).toBeUndefined();
      expect(connectionManager.getSocketByPlayerId('non-existent')).toBeUndefined();
      expect(connectionManager.isPlayerConnected('non-existent')).toBe(false);
    });

    it('should handle removing players from non-existent races', () => {
      connectionManager.addConnection('socket-1', mockSocket1);
      
      // Should not throw error
      connectionManager.removePlayerFromRace('socket-1', 'non-existent-race');
      
      expect(connectionManager.getRaceParticipants('non-existent-race')).toEqual([]);
    });

    it('should handle authentication of non-existent connections', () => {
      // Should not throw error
      connectionManager.authenticateConnection('non-existent', 'player-1');
      
      expect(connectionManager.isPlayerConnected('player-1')).toBe(false);
    });
  });
});