import { PlayerService } from '../PlayerService';
import { getDatabaseConnection } from '../../database/connection';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock the database connection
jest.mock('../../database/connection');
const mockDb = {
  query: jest.fn(),
  transaction: jest.fn()
};

(getDatabaseConnection as jest.Mock).mockReturnValue(mockDb);

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

describe('PlayerService', () => {
  let playerService: PlayerService;

  beforeEach(() => {
    playerService = new PlayerService();
    jest.clearAllMocks();
  });

  describe('registerPlayer', () => {
    const validRegisterData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };

    it('should successfully register a new player', async () => {
      // Mock database responses
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ // Insert new player
          rows: [{
            id: 'player-id-123',
            username: 'testuser',
            email: 'test@example.com',
            created_at: new Date(),
            total_races: 0,
            wins: 0,
            league_points: 0
          }]
        });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await playerService.registerPlayer(validRegisterData);

      expect(result).toEqual({
        id: 'player-id-123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: expect.any(Date),
        totalRaces: 0,
        wins: 0,
        leaguePoints: 0
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if username already exists', async () => {
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ id: 'existing-id' }] 
      });

      await expect(playerService.registerPlayer(validRegisterData))
        .rejects.toThrow('Username or email already exists');
    });

    it('should throw error for invalid input', async () => {
      await expect(playerService.registerPlayer({
        username: '',
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow('Username, email, and password are required');

      await expect(playerService.registerPlayer({
        username: 'ab',
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow('Username must be between 3 and 50 characters');

      await expect(playerService.registerPlayer({
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      })).rejects.toThrow('Password must be at least 6 characters long');
    });
  });

  describe('authenticatePlayer', () => {
    const validCredentials = {
      username: 'testuser',
      password: 'password123'
    };

    it('should successfully authenticate valid credentials', async () => {
      const mockPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        password_hash: 'hashed-password',
        is_active: true
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockPlayer] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await playerService.authenticatePlayer(validCredentials);

      expect(result).toEqual({
        token: 'jwt-token',
        expiresAt: expect.any(Date),
        playerId: 'player-id-123'
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(jwt.sign).toHaveBeenCalledWith(
        { playerId: 'player-id-123', username: 'testuser' },
        expect.any(String),
        { expiresIn: expect.any(String) }
      );
    });

    it('should throw error for invalid username', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(playerService.authenticatePlayer(validCredentials))
        .rejects.toThrow('Invalid username or password');
    });

    it('should throw error for invalid password', async () => {
      const mockPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        password_hash: 'hashed-password',
        is_active: true
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockPlayer] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(playerService.authenticatePlayer(validCredentials))
        .rejects.toThrow('Invalid username or password');
    });

    it('should throw error for deactivated account', async () => {
      const mockPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        password_hash: 'hashed-password',
        is_active: false
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockPlayer] });

      await expect(playerService.authenticatePlayer(validCredentials))
        .rejects.toThrow('Account is deactivated');
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ playerId: 'player-id-123' } as any);

      const result = await playerService.verifyToken('valid-token');

      expect(result).toBe('player-id-123');
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
    });

    it('should throw error for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(playerService.verifyToken('invalid-token'))
        .rejects.toThrow('Invalid or expired token');
    });
  });

  describe('getPlayerById', () => {
    it('should return player when found', async () => {
      const mockPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        total_races: 5,
        wins: 2,
        league_points: 100
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockPlayer] });

      const result = await playerService.getPlayerById('player-id-123');

      expect(result).toEqual({
        id: 'player-id-123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: expect.any(Date),
        totalRaces: 5,
        wins: 2,
        leaguePoints: 100
      });
    });

    it('should return null when player not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await playerService.getPlayerById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('getPlayerRaceHistory', () => {
    it('should return race history for player', async () => {
      const mockRaceHistory = [
        {
          race_id: 'race-1',
          player_id: 'player-id-123',
          car_id: 'car-1',
          final_position: 1,
          final_time: 120000,
          race_events: { event1: 'data' },
          completed_at: new Date(),
          points: 25
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockRaceHistory });

      const result = await playerService.getPlayerRaceHistory('player-id-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        raceId: 'race-1',
        playerId: 'player-id-123',
        carId: 'car-1',
        finalPosition: 1,
        finalTime: 120000,
        lapTimes: [],
        raceEvents: ['event1'],
        points: 25,
        completedAt: expect.any(Date)
      });
    });
  });

  describe('calculatePlayerStatistics', () => {
    it('should calculate player statistics correctly', async () => {
      const mockStats = {
        total_races: '10',
        avg_race_time: '125000',
        best_race_time: '120000',
        total_race_time: '1250000',
        avg_position: '3.5',
        podium_finishes: '4',
        dnf_count: '1'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await playerService.calculatePlayerStatistics('player-id-123');

      expect(result).toEqual({
        averageLapTime: 0,
        bestLapTime: 0,
        totalRaceTime: 1250000,
        podiumFinishes: 4,
        dnfCount: 1,
        averagePosition: 3.5
      });
    });
  });

  describe('updatePlayerStats', () => {
    it('should update player stats after race', async () => {
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const mockClient = { query: jest.fn() };
        return await callback(mockClient);
      });

      mockDb.transaction = mockTransaction;

      const raceResult = {
        raceId: 'race-1',
        playerId: 'player-id-123',
        carId: 'car-1',
        finalPosition: 1,
        finalTime: 120000,
        lapTimes: [30000, 29500, 30200, 30300],
        raceEvents: [],
        points: 25,
        completedAt: new Date()
      };

      await playerService.updatePlayerStats('player-id-123', raceResult);

      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('getLeagueStandings', () => {
    it('should return league standings', async () => {
      const mockStandings = [
        {
          player_id: 'player-1',
          username: 'player1',
          league_points: 100,
          total_races: 10,
          wins: 5,
          position: '1'
        },
        {
          player_id: 'player-2',
          username: 'player2',
          league_points: 80,
          total_races: 8,
          wins: 3,
          position: '2'
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockStandings });

      const result = await playerService.getLeagueStandings();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        playerId: 'player-1',
        username: 'player1',
        leaguePoints: 100,
        totalRaces: 10,
        wins: 5,
        position: 1
      });
    });
  });

  describe('isUsernameAvailable', () => {
    it('should return true for available username', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await playerService.isUsernameAvailable('newuser');

      expect(result).toBe(true);
    });

    it('should return false for taken username', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      const result = await playerService.isUsernameAvailable('existinguser');

      expect(result).toBe(false);
    });
  });

  describe('isEmailAvailable', () => {
    it('should return true for available email', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await playerService.isEmailAvailable('new@example.com');

      expect(result).toBe(true);
    });

    it('should return false for taken email', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      const result = await playerService.isEmailAvailable('existing@example.com');

      expect(result).toBe(false);
    });
  });

  describe('updatePlayerProfile', () => {
    it('should update player email successfully', async () => {
      const mockUpdatedPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        email: 'newemail@example.com',
        created_at: new Date(),
        total_races: 5,
        wins: 2,
        league_points: 100
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockUpdatedPlayer] });

      const result = await playerService.updatePlayerProfile('player-id-123', {
        email: 'newemail@example.com'
      });

      expect(result.email).toBe('newemail@example.com');
    });

    it('should throw error for no valid fields', async () => {
      await expect(playerService.updatePlayerProfile('player-id-123', {}))
        .rejects.toThrow('No valid fields to update');
    });
  });

  describe('deactivatePlayer', () => {
    it('should deactivate player successfully', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

      await expect(playerService.deactivatePlayer('player-id-123'))
        .resolves.not.toThrow();
    });

    it('should throw error if player not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(playerService.deactivatePlayer('nonexistent-id'))
        .rejects.toThrow('Player not found');
    });
  });
});