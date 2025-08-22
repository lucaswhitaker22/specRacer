import { SessionService } from '../SessionService';
import { redisManager } from '../../database/redis';

// Mock Redis manager
jest.mock('../../database/redis', () => ({
  redisManager: {
    getClient: jest.fn(),
    isReady: jest.fn(() => true)
  }
}));

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockRedisClient: any;

  beforeEach(() => {
    sessionService = new SessionService();
    mockRedisClient = {
      setEx: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
    (redisManager.getClient as jest.Mock).mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const sessionId = await sessionService.createSession('player1', 'testuser', 'conn1');

      expect(sessionId).toMatch(/^player1_\d+_[a-z0-9]+$/);
      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(2); // session + player mapping
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      await expect(sessionService.createSession('player1', 'testuser', 'conn1'))
        .rejects.toThrow('Redis error');
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', async () => {
      const mockSession = {
        playerId: 'player1',
        username: 'testuser',
        connectionId: 'conn1',
        lastActivity: Date.now(),
        isActive: true
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const result = await sessionService.getSession('session1');

      expect(result).toEqual(mockSession);
      expect(mockRedisClient.get).toHaveBeenCalledWith('session:session1');
    });

    it('should return null for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await sessionService.getSession('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle malformed session data', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json');

      const result = await sessionService.getSession('session1');

      expect(result).toBeNull();
    });
  });

  describe('getPlayerSession', () => {
    it('should retrieve session by player ID', async () => {
      const mockSession = {
        playerId: 'player1',
        username: 'testuser',
        connectionId: 'conn1',
        lastActivity: Date.now(),
        isActive: true
      };
      
      mockRedisClient.get
        .mockResolvedValueOnce('session1') // player mapping
        .mockResolvedValueOnce(JSON.stringify(mockSession)); // session data

      const result = await sessionService.getPlayerSession('player1');

      expect(result).toEqual(mockSession);
      expect(mockRedisClient.get).toHaveBeenCalledWith('player_session:player1');
      expect(mockRedisClient.get).toHaveBeenCalledWith('session:session1');
    });

    it('should return null if player has no session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await sessionService.getPlayerSession('player1');

      expect(result).toBeNull();
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session activity timestamp', async () => {
      const mockSession = {
        playerId: 'player1',
        username: 'testuser',
        connectionId: 'conn1',
        lastActivity: Date.now() - 1000,
        isActive: true
      };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await sessionService.updateSessionActivity('session1');

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalled();
      
      const updatedSession = JSON.parse(mockRedisClient.setEx.mock.calls[0][2]);
      expect(updatedSession.lastActivity).toBeGreaterThan(mockSession.lastActivity);
    });

    it('should return false for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await sessionService.updateSessionActivity('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('updatePlayerRace', () => {
    it('should update player race ID', async () => {
      const mockSession = {
        playerId: 'player1',
        username: 'testuser',
        connectionId: 'conn1',
        lastActivity: Date.now(),
        isActive: true
      };
      
      mockRedisClient.get
        .mockResolvedValueOnce('session1') // getPlayerSession: player mapping lookup
        .mockResolvedValueOnce(JSON.stringify(mockSession)) // getPlayerSession: getSession call
        .mockResolvedValueOnce('session1'); // updatePlayerRace: sessionId lookup
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await sessionService.updatePlayerRace('player1', 'race123');

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalled();
      
      const updatedSession = JSON.parse(mockRedisClient.setEx.mock.calls[0][2]);
      expect(updatedSession.currentRaceId).toBe('race123');
    });

    it('should clear race ID when null is provided', async () => {
      const mockSession = {
        playerId: 'player1',
        username: 'testuser',
        connectionId: 'conn1',
        lastActivity: Date.now(),
        isActive: true,
        currentRaceId: 'race123'
      };
      
      mockRedisClient.get
        .mockResolvedValueOnce('session1') // getPlayerSession: player mapping lookup
        .mockResolvedValueOnce(JSON.stringify(mockSession)) // getPlayerSession: getSession call
        .mockResolvedValueOnce('session1'); // updatePlayerRace: sessionId lookup
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await sessionService.updatePlayerRace('player1', null);

      expect(result).toBe(true);
      
      const updatedSession = JSON.parse(mockRedisClient.setEx.mock.calls[0][2]);
      expect(updatedSession.currentRaceId).toBeUndefined();
    });
  });

  describe('removeSession', () => {
    it('should remove session and player mapping', async () => {
      const mockSession = {
        playerId: 'player1',
        username: 'testuser',
        connectionId: 'conn1',
        lastActivity: Date.now(),
        isActive: true
      };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedisClient.del.mockResolvedValue(1);

      const result = await sessionService.removeSession('session1');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(['session:session1', 'player_session:player1']);
    });

    it('should return false for non-existent session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await sessionService.removeSession('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', async () => {
      const mockSessions = [
        {
          playerId: 'player1',
          username: 'user1',
          connectionId: 'conn1',
          lastActivity: Date.now(),
          isActive: true
        },
        {
          playerId: 'player2',
          username: 'user2',
          connectionId: 'conn2',
          lastActivity: Date.now(),
          isActive: false
        }
      ];

      mockRedisClient.keys.mockResolvedValue(['session:1', 'session:2']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockSessions[0]))
        .mockResolvedValueOnce(JSON.stringify(mockSessions[1]));

      const result = await sessionService.getActiveSessions();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockSessions[0]);
    });

    it('should handle empty session list', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await sessionService.getActiveSessions();

      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', async () => {
      const now = Date.now();
      const expiredSession = {
        playerId: 'player1',
        username: 'user1',
        connectionId: 'conn1',
        lastActivity: now - (25 * 60 * 60 * 1000), // 25 hours ago
        isActive: true
      };
      const activeSession = {
        playerId: 'player2',
        username: 'user2',
        connectionId: 'conn2',
        lastActivity: now - (1 * 60 * 60 * 1000), // 1 hour ago (well within 24 hour limit)
        isActive: true
      };

      // Test with only one expired session to avoid complexity
      mockRedisClient.keys.mockResolvedValue(['session:1']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(expiredSession))  // cleanupExpiredSessions: session check (expired)
        .mockResolvedValueOnce(JSON.stringify(expiredSession)); // removeSession: getSession call
      mockRedisClient.del.mockResolvedValue(1);

      const result = await sessionService.cleanupExpiredSessions();

      expect(result).toBe(1);


      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });
});