import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { WebSocketService } from '../WebSocketService';
import { useErrorStore } from '../../stores/error';
import { io } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn()
}));

// Mock error store
vi.mock('../../stores/error', () => ({
  useErrorStore: vi.fn(() => ({
    addError: vi.fn(),
    addWarning: vi.fn(),
    addInfo: vi.fn(),
    clearErrors: vi.fn(),
    clearErrorsByCode: vi.fn()
  }))
}));

describe('WebSocketService Error Handling', () => {
  let webSocketService: WebSocketService;
  let mockSocket: any;
  let mockErrorStore: any;

  beforeEach(() => {
    mockSocket = {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn()
    };

    mockErrorStore = {
      addError: vi.fn(),
      addWarning: vi.fn(),
      addInfo: vi.fn(),
      clearErrors: vi.fn(),
      clearErrorsByCode: vi.fn()
    };

    (io as Mock).mockReturnValue(mockSocket);
    (useErrorStore as Mock).mockReturnValue(mockErrorStore);

    webSocketService = new WebSocketService({
      url: 'ws://localhost:3001',
      timeout: 1000,
      maxReconnectAttempts: 3,
      reconnectDelay: 100,
      maxReconnectDelay: 1000
    });
  });

  afterEach(() => {
    webSocketService.disconnect();
    vi.clearAllMocks();
  });

  describe('Connection Error Handling', () => {
    it('should handle connection timeout', async () => {
      // Mock connection timeout
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(new Error('Connection timeout')), 50);
        }
      });

      await expect(webSocketService.connect()).rejects.toThrow('Connection timeout');
      expect(mockErrorStore.addError).toHaveBeenCalledWith(
        expect.stringContaining('Connection failed'),
        'CONNECTION_ERROR'
      );
    });

    it('should handle connection refused', async () => {
      const connectionError = new Error('Connection refused');
      
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(connectionError), 50);
        }
      });

      await expect(webSocketService.connect()).rejects.toThrow('Connection refused');
    });

    it('should attempt reconnection on disconnect', async () => {
      // First establish connection
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      });

      await webSocketService.connect();

      // Simulate disconnect
      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      expect(disconnectCallback).toBeDefined();
      disconnectCallback('transport close');

      expect(mockErrorStore.addWarning).toHaveBeenCalledWith(
        expect.stringContaining('Connection lost'),
        'CONNECTION_LOST'
      );
    });

    it('should stop reconnection after max attempts', async () => {
      let connectAttempts = 0;
      
      mockSocket.connect.mockImplementation(() => {
        connectAttempts++;
        const errorCallback = mockSocket.once.mock.calls.find(
          call => call[0] === 'connect_error'
        )?.[1];
        
        if (errorCallback) {
          setTimeout(() => errorCallback(new Error('Connection failed')), 10);
        }
      });

      // Trigger initial connection failure
      await expect(webSocketService.connect()).rejects.toThrow();

      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(mockErrorStore.addError).toHaveBeenCalledWith(
        'Maximum reconnection attempts reached',
        'MAX_RECONNECT_EXCEEDED'
      );
    });
  });

  describe('Message Sending Error Handling', () => {
    beforeEach(async () => {
      // Establish connection
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      });
      await webSocketService.connect();
    });

    it('should handle send when not connected', async () => {
      mockSocket.connected = false;
      
      const result = await webSocketService.send('race:command', { 
        type: 'accelerate' 
      } as any, { retry: false });

      expect(result).toBe(false);
      expect(mockErrorStore.addError).toHaveBeenCalledWith(
        'Cannot send message: WebSocket not connected',
        'WEBSOCKET_NOT_CONNECTED'
      );
    });

    it('should queue messages when disconnected with retry enabled', async () => {
      mockSocket.connected = false;
      
      // Mock reconnection success
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          mockSocket.connected = true;
          setTimeout(() => callback(), 10);
        }
      });

      const sendPromise = webSocketService.send('race:command', { 
        type: 'accelerate' 
      } as any, { retry: true });

      // Should attempt to reconnect
      expect(mockSocket.connect).toHaveBeenCalled();

      await sendPromise;
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'race:command',
        { type: 'accelerate' },
        expect.any(Function)
      );
    });

    it('should handle send timeout', async () => {
      mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        // Don't call callback to simulate timeout
      });

      const result = await webSocketService.send('race:command', { 
        type: 'accelerate' 
      } as any, { timeout: 100 });

      expect(result).toBe(false);
      expect(mockErrorStore.addWarning).toHaveBeenCalledWith(
        'Message send timeout',
        'SEND_TIMEOUT'
      );
    });

    it('should handle emit errors', async () => {
      mockSocket.emit.mockImplementation(() => {
        throw new Error('Emit failed');
      });

      const result = await webSocketService.send('race:command', { 
        type: 'accelerate' 
      } as any);

      expect(result).toBe(false);
      expect(mockErrorStore.addError).toHaveBeenCalledWith(
        'Failed to send message: Emit failed',
        'SEND_ERROR'
      );
    });
  });

  describe('Event Handling Error Handling', () => {
    it('should handle event listener errors', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Event handler error');
      });

      webSocketService.on('race:update', errorCallback);

      // Simulate event
      const eventCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'race:update'
      )?.[1];

      expect(eventCallback).toBeDefined();
      eventCallback({ raceId: 'test' });

      expect(mockErrorStore.addError).toHaveBeenCalledWith(
        expect.stringContaining('Event handler error for race:update'),
        'EVENT_HANDLER_ERROR'
      );
    });

    it('should handle server error messages', async () => {
      // Establish connection
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      });
      await webSocketService.connect();

      // Simulate server error
      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      expect(errorCallback).toBeDefined();
      errorCallback({
        message: 'Race not found',
        code: 'RACE_NOT_FOUND',
        timestamp: Date.now()
      });

      expect(mockErrorStore.addError).toHaveBeenCalledWith(
        'Race not found',
        'RACE_NOT_FOUND'
      );
    });

    it('should handle race recovery messages', async () => {
      // Establish connection
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      });
      await webSocketService.connect();

      // Simulate race recovery
      const recoveryCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'race:recovered'
      )?.[1];

      expect(recoveryCallback).toBeDefined();
      recoveryCallback({
        message: 'Race state recovered',
        recoveredState: { raceId: 'test-race' }
      });

      expect(mockErrorStore.addInfo).toHaveBeenCalledWith(
        'Race state recovered',
        'RACE_RECOVERED'
      );
    });
  });

  describe('Connection Health Monitoring', () => {
    it('should track connection health', () => {
      const health = webSocketService.getConnectionHealth();
      
      expect(health).toHaveProperty('isConnected');
      expect(health).toHaveProperty('lastPing');
      expect(health).toHaveProperty('reconnectAttempts');
      expect(health).toHaveProperty('connectionQuality');
    });

    it('should determine connection quality based on ping', async () => {
      // Establish connection
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      });
      await webSocketService.connect();

      // Simulate recent ping
      const pongCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'pong'
      )?.[1];

      expect(pongCallback).toBeDefined();
      pongCallback();

      const health = webSocketService.getConnectionHealth();
      expect(health.connectionQuality).toBe('excellent');
    });

    it('should detect poor connection quality', async () => {
      // Establish connection
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      });
      await webSocketService.connect();

      // Simulate old ping (poor connection)
      const service = webSocketService as any;
      service.connectionState.lastPing = Date.now() - 20000; // 20 seconds ago

      const health = webSocketService.getConnectionHealth();
      expect(health.connectionQuality).toBe('poor');
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue operation with degraded functionality', async () => {
      // Start with connection
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      });
      await webSocketService.connect();

      // Simulate connection loss
      mockSocket.connected = false;
      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      disconnectCallback('transport close');

      // Should still accept messages (they get queued)
      const result = await webSocketService.send('race:command', { 
        type: 'accelerate' 
      } as any, { retry: true });

      // Should attempt reconnection
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should clear appropriate errors on reconnection', async () => {
      // Establish connection
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
      });
      await webSocketService.connect();

      expect(mockErrorStore.clearErrorsByCode).toHaveBeenCalledWith('CONNECTION_ERROR');
      expect(mockErrorStore.clearErrorsByCode).toHaveBeenCalledWith('WEBSOCKET_NOT_CONNECTED');
    });
  });
});