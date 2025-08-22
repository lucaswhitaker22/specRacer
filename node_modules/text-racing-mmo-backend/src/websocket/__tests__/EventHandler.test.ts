import { EventHandler } from '../EventHandler';
import { ConnectionManager } from '../ConnectionManager';
import type { Socket } from 'socket.io';
import type { Command } from '../../../../shared/types/commands';

// Mock Socket for testing
const createMockSocket = (id: string): Socket => ({
  id,
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn()
} as any);

describe('EventHandler', () => {
  let eventHandler: EventHandler;
  let connectionManager: ConnectionManager;
  let mockSocket: Socket;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    eventHandler = new EventHandler(connectionManager);
    mockSocket = createMockSocket('test-socket');
  });

  describe('Authentication Handling', () => {
    it('should authenticate valid tokens', async () => {
      const testToken = 'valid-player-123';
      
      await eventHandler.handleAuthentication(mockSocket, { token: testToken });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('connection:authenticated', {
        playerId: testToken
      });
    });

    it('should reject empty tokens', async () => {
      await expect(
        eventHandler.handleAuthentication(mockSocket, { token: '' })
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('Race Command Handling', () => {
    beforeEach(async () => {
      connectionManager.addConnection('test-socket', mockSocket);
      await eventHandler.handleAuthentication(mockSocket, { token: 'test-player' });
    });

    it('should reject commands from players not in a race', async () => {
      const command: Command = {
        type: 'accelerate',
        parameters: { intensity: 50 },
        timestamp: Date.now()
      };

      await expect(
        eventHandler.handleRaceCommand(mockSocket, command)
      ).rejects.toThrow('Player not in a race');
    });
  });
});