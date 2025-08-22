import request from 'supertest';
import express from 'express';
import playerRoutes from '../players';
import { PlayerService } from '../../services/PlayerService';

// Mock PlayerService
jest.mock('../../services/PlayerService');
const MockPlayerService = PlayerService as jest.MockedClass<typeof PlayerService>;

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.playerId = 'player-id-123';
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/players', playerRoutes);

describe('Player Routes', () => {
  let mockPlayerService: jest.Mocked<PlayerService>;

  beforeEach(() => {
    mockPlayerService = new MockPlayerService() as jest.Mocked<PlayerService>;
    (PlayerService as any).mockImplementation(() => mockPlayerService);
    jest.clearAllMocks();
  });

  describe('GET /players/profile', () => {
    it('should return player profile', async () => {
      const mockProfile = {
        id: 'player-id-123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date(),
        totalRaces: 5,
        wins: 2,
        leaguePoints: 100,
        raceHistory: [],
        statistics: {
          averageLapTime: 0,
          bestLapTime: 0,
          totalRaceTime: 600000,
          podiumFinishes: 2,
          dnfCount: 0,
          averagePosition: 3.2
        }
      };

      mockPlayerService.getPlayerProfile.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/players/profile')
        .expect(200);

      expect(response.body.profile.username).toBe('testuser');
      expect(mockPlayerService.getPlayerProfile).toHaveBeenCalledWith('player-id-123');
    });

    it('should return 404 if profile not found', async () => {
      mockPlayerService.getPlayerProfile.mockResolvedValue(null);

      const response = await request(app)
        .get('/players/profile')
        .expect(404);

      expect(response.body.error).toBe('Player profile not found');
    });
  });

  describe('PUT /players/profile', () => {
    it('should update player profile', async () => {
      const mockUpdatedPlayer = {
        id: 'player-id-123',
        username: 'testuser',
        email: 'newemail@example.com',
        createdAt: new Date(),
        totalRaces: 5,
        wins: 2,
        leaguePoints: 100
      };

      mockPlayerService.updatePlayerProfile.mockResolvedValue(mockUpdatedPlayer);

      const response = await request(app)
        .put('/players/profile')
        .send({ email: 'newemail@example.com' })
        .expect(200);

      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.player.email).toBe('newemail@example.com');
    });
  });

  describe('GET /players/race-history', () => {
    it('should return race history', async () => {
      const mockRaceHistory = [
        {
          raceId: 'race-1',
          playerId: 'player-id-123',
          carId: 'car-1',
          finalPosition: 1,
          finalTime: 120000,
          lapTimes: [30000, 29500, 30200, 30300],
          raceEvents: [],
          points: 25,
          completedAt: new Date()
        }
      ];

      mockPlayerService.getPlayerRaceHistory.mockResolvedValue(mockRaceHistory);

      const response = await request(app)
        .get('/players/race-history')
        .expect(200);

      expect(response.body.raceHistory).toHaveLength(1);
      expect(response.body.raceHistory[0].finalPosition).toBe(1);
    });

    it('should handle limit parameter', async () => {
      mockPlayerService.getPlayerRaceHistory.mockResolvedValue([]);

      await request(app)
        .get('/players/race-history?limit=10')
        .expect(200);

      expect(mockPlayerService.getPlayerRaceHistory).toHaveBeenCalledWith('player-id-123', 10);
    });
  });

  describe('GET /players/statistics', () => {
    it('should return player statistics', async () => {
      const mockStatistics = {
        averageLapTime: 30000,
        bestLapTime: 29500,
        totalRaceTime: 600000,
        podiumFinishes: 3,
        dnfCount: 1,
        averagePosition: 2.8
      };

      mockPlayerService.calculatePlayerStatistics.mockResolvedValue(mockStatistics);

      const response = await request(app)
        .get('/players/statistics')
        .expect(200);

      expect(response.body.statistics.podiumFinishes).toBe(3);
      expect(response.body.statistics.averagePosition).toBe(2.8);
    });
  });

  describe('GET /players/league-standings', () => {
    it('should return league standings', async () => {
      const mockStandings = [
        {
          playerId: 'player-1',
          username: 'player1',
          leaguePoints: 150,
          totalRaces: 10,
          wins: 6,
          position: 1
        },
        {
          playerId: 'player-2',
          username: 'player2',
          leaguePoints: 120,
          totalRaces: 8,
          wins: 4,
          position: 2
        }
      ];

      mockPlayerService.getLeagueStandings.mockResolvedValue(mockStandings);

      const response = await request(app)
        .get('/players/league-standings')
        .expect(200);

      expect(response.body.standings).toHaveLength(2);
      expect(response.body.standings[0].position).toBe(1);
    });

    it('should handle limit parameter', async () => {
      mockPlayerService.getLeagueStandings.mockResolvedValue([]);

      await request(app)
        .get('/players/league-standings?limit=25')
        .expect(200);

      expect(mockPlayerService.getLeagueStandings).toHaveBeenCalledWith(25);
    });
  });

  describe('GET /players/league-position', () => {
    it('should return player league position', async () => {
      mockPlayerService.getPlayerLeaguePosition.mockResolvedValue(5);

      const response = await request(app)
        .get('/players/league-position')
        .expect(200);

      expect(response.body.position).toBe(5);
    });
  });

  describe('GET /players/:playerId', () => {
    it('should return public player information', async () => {
      const mockPlayer = {
        id: 'other-player-id',
        username: 'otheruser',
        email: 'other@example.com',
        createdAt: new Date(),
        totalRaces: 8,
        wins: 3,
        leaguePoints: 75
      };

      mockPlayerService.getPlayerById.mockResolvedValue(mockPlayer);

      const response = await request(app)
        .get('/players/other-player-id')
        .expect(200);

      expect(response.body.player.username).toBe('otheruser');
      expect(response.body.player.email).toBeUndefined(); // Should not include email
    });

    it('should return 404 for non-existent player', async () => {
      mockPlayerService.getPlayerById.mockResolvedValue(null);

      const response = await request(app)
        .get('/players/nonexistent-id')
        .expect(404);

      expect(response.body.error).toBe('Player not found');
    });
  });

  describe('DELETE /players/account', () => {
    it('should deactivate account successfully', async () => {
      mockPlayerService.deactivatePlayer.mockResolvedValue();

      const response = await request(app)
        .delete('/players/account')
        .expect(200);

      expect(response.body.message).toBe('Account deactivated successfully');
      expect(mockPlayerService.deactivatePlayer).toHaveBeenCalledWith('player-id-123');
    });

    it('should handle deactivation errors', async () => {
      mockPlayerService.deactivatePlayer.mockRejectedValue(new Error('Player not found'));

      const response = await request(app)
        .delete('/players/account')
        .expect(500);

      expect(response.body.error).toBe('Failed to deactivate account');
    });
  });
});