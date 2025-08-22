import { createServer } from 'http';
import { AddressInfo } from 'net';
import { io as Client } from 'socket.io-client';
import { WebSocketServer } from '../WebSocketServer';

describe('WebSocketServer Integration Tests', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let clientSocket: any;
  let serverPort: number;

  beforeAll((done) => {
    httpServer = createServer();
    wsServer = new WebSocketServer(httpServer);
    
    httpServer.listen(() => {
      const address = httpServer.address() as AddressInfo;
      serverPort = address.port;
      done();
    });
  });

  afterAll((done) => {
    wsServer.shutdown().then(() => {
      httpServer.close(done);
    });
  });

  beforeEach((done) => {
    clientSocket = Client(`http://localhost:${serverPort}`);
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should handle client disconnection gracefully', (done) => {
      clientSocket.on('disconnect', (reason: any) => {
        expect(reason).toBeDefined();
        done();
      });
      
      clientSocket.disconnect();
    });

    it('should provide connection statistics', () => {
      const stats = wsServer.getConnectionStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('authenticatedConnections');
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.authenticatedConnections).toBe('number');
    });
  });

  describe('Authentication Flow', () => {
    it('should authenticate player with valid token', (done) => {
      const testPlayerId = 'test-player-123';
      
      clientSocket.on('connection:authenticated', (data: any) => {
        expect(data.playerId).toBe(testPlayerId);
        done();
      });

      clientSocket.emit('player:authenticate', { token: testPlayerId });
    });

    it('should reject authentication with invalid token', (done) => {
      clientSocket.on('error', (error: any) => {
        expect(error.code).toBe('AUTH_FAILED');
        expect(error.message).toBe('Authentication failed');
        done();
      });

      clientSocket.emit('player:authenticate', { token: '' });
    });
  });

  describe('Basic Broadcasting', () => {
    it('should broadcast race updates to participants', (done) => {
      const raceId = 'test-race';
      
      // First authenticate and join race
      clientSocket.on('connection:authenticated', () => {
        clientSocket.emit('race:join', { raceId });
        
        // Set up listener for race update
        clientSocket.on('race:update', (raceState: any) => {
          expect(raceState.raceId).toBe(raceId);
          done();
        });

        // Simulate a race state broadcast after a short delay
        setTimeout(() => {
          const mockRaceState = {
            raceId,
            trackId: 'test-track',
            currentLap: 1,
            totalLaps: 5,
            raceTime: 30,
            participants: [],
            raceEvents: [],
            weather: { temperature: 20, humidity: 50, windSpeed: 10, precipitation: 0, visibility: 1000 },
            trackConditions: { surface: 'dry' as const, grip: 1.0, temperature: 25 }
          };

          wsServer.broadcastRaceUpdate(raceId, mockRaceState);
        }, 100);
      });

      clientSocket.emit('player:authenticate', { token: 'test-player' });
    });
  });
});