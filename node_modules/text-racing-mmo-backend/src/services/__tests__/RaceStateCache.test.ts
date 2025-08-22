import { RaceStateCache } from '../RaceStateCache';
import { redisManager } from '../../database/redis';
import { RaceState, ParticipantState, RaceEvent } from '../../../../shared/types';

// Mock Redis manager
jest.mock('../../database/redis', () => ({
  redisManager: {
    getClient: jest.fn(),
    isReady: jest.fn(() => true)
  }
}));

describe('RaceStateCache', () => {
  let raceStateCache: RaceStateCache;
  let mockRedisClient: any;

  const mockRaceState: RaceState = {
    raceId: 'race123',
    trackId: 'track1',
    currentLap: 1,
    totalLaps: 10,
    raceTime: 120,
    participants: [
      {
        playerId: 'player1',
        carId: 'car1',
        position: 1,
        lapTime: 60,
        totalTime: 120,
        fuel: 85,
        tireWear: { front: 10, rear: 15 },
        speed: 180,
        location: { lap: 1, sector: 2, distance: 1500 },
        lastCommand: 'accelerate',
        commandTimestamp: Date.now()
      }
    ],
    raceEvents: [
      {
        id: 'event1',
        timestamp: Date.now(),
        type: 'race_start',
        description: 'Race started',
        involvedPlayers: ['player1']
      }
    ],
    weather: {
      temperature: 25,
      humidity: 60,
      windSpeed: 10,
      precipitation: 0,
      visibility: 10000
    },
    trackConditions: {
      surface: 'dry',
      grip: 1.0,
      temperature: 30
    }
  };

  beforeEach(() => {
    raceStateCache = new RaceStateCache();
    mockRedisClient = {
      setEx: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      info: jest.fn()
    };
    (redisManager.getClient as jest.Mock).mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cacheRaceState', () => {
    it('should cache complete race state successfully', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.keys.mockResolvedValue([]); // No existing backups

      const result = await raceStateCache.cacheRaceState(mockRaceState);

      expect(result).toBe(true);
      // Should call setEx for: race state, participant, events, and backup
      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(4);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await raceStateCache.cacheRaceState(mockRaceState);

      expect(result).toBe(false);
    });
  });

  describe('getRaceState', () => {
    it('should retrieve cached race state', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRaceState));

      const result = await raceStateCache.getRaceState('race123');

      expect(result).toEqual(mockRaceState);
      expect(mockRedisClient.get).toHaveBeenCalledWith('race_state:race123');
    });

    it('should return null for non-existent race', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await raceStateCache.getRaceState('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle malformed race data', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json');

      const result = await raceStateCache.getRaceState('race123');

      expect(result).toBeNull();
    });
  });

  describe('updateParticipant', () => {
    it('should update participant state', async () => {
      const participant = mockRaceState.participants[0];
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRaceState));

      const result = await raceStateCache.updateParticipant('race123', participant);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'participant:race123:player1',
        expect.any(Number),
        JSON.stringify(participant)
      );
    });

    it('should handle participant update without existing race state', async () => {
      const participant = mockRaceState.participants[0];
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(null);

      const result = await raceStateCache.updateParticipant('race123', participant);

      expect(result).toBe(true);
    });
  });

  describe('getParticipant', () => {
    it('should retrieve participant state', async () => {
      const participant = mockRaceState.participants[0];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(participant));

      const result = await raceStateCache.getParticipant('race123', 'player1');

      expect(result).toEqual(participant);
      expect(mockRedisClient.get).toHaveBeenCalledWith('participant:race123:player1');
    });

    it('should return null for non-existent participant', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await raceStateCache.getParticipant('race123', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('addRaceEvent', () => {
    it('should add new race event', async () => {
      const newEvent: RaceEvent = {
        id: 'event2',
        timestamp: Date.now(),
        type: 'overtake',
        description: 'Player overtook another player',
        involvedPlayers: ['player1', 'player2']
      };

      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockRaceState.raceEvents)) // existing events
        .mockResolvedValueOnce(JSON.stringify(mockRaceState)); // race state
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await raceStateCache.addRaceEvent('race123', newEvent);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'race_events:race123',
        expect.any(Number),
        expect.stringContaining('event2')
      );
    });

    it('should limit events to 100 entries', async () => {
      const manyEvents = Array.from({ length: 105 }, (_, i) => ({
        id: `event${i}`,
        timestamp: Date.now(),
        type: 'lap_complete' as const,
        description: `Event ${i}`,
        involvedPlayers: ['player1']
      }));

      const newEvent: RaceEvent = {
        id: 'event_new',
        timestamp: Date.now(),
        type: 'overtake',
        description: 'New event',
        involvedPlayers: ['player1']
      };

      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(manyEvents))
        .mockResolvedValueOnce(null); // no race state
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await raceStateCache.addRaceEvent('race123', newEvent);

      expect(result).toBe(true);
      
      const savedEvents = JSON.parse(mockRedisClient.setEx.mock.calls[0][2]);
      expect(savedEvents).toHaveLength(100);
      expect(savedEvents[99].id).toBe('event_new');
    });
  });

  describe('createBackup', () => {
    it('should create race state backup', async () => {
      mockRedisClient.keys.mockResolvedValue([]); // No existing backups
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await raceStateCache.createBackup(mockRaceState);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'race_backup:race123:1',
        expect.any(Number),
        expect.stringContaining('race123')
      );
    });

    it('should clean up old backups when limit exceeded', async () => {
      const existingBackups = Array.from({ length: 12 }, (_, i) => 
        `race_backup:race123:${i + 1}`
      );
      
      mockRedisClient.keys.mockResolvedValue(existingBackups);
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);

      const result = await raceStateCache.createBackup(mockRaceState);

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        expect.arrayContaining(['race_backup:race123:1', 'race_backup:race123:2', 'race_backup:race123:3'])
      );
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore from specific backup version', async () => {
      const backup = {
        raceState: mockRaceState,
        timestamp: Date.now(),
        version: 1
      };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(backup));
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await raceStateCache.restoreFromBackup('race123', 1);

      expect(result).toEqual(mockRaceState);
      expect(mockRedisClient.get).toHaveBeenCalledWith('race_backup:race123:1');
    });

    it('should restore from latest backup when no version specified', async () => {
      const backup = {
        raceState: mockRaceState,
        timestamp: Date.now(),
        version: 3
      };
      
      mockRedisClient.keys.mockResolvedValue([
        'race_backup:race123:1',
        'race_backup:race123:2',
        'race_backup:race123:3'
      ]);
      mockRedisClient.get.mockResolvedValue(JSON.stringify(backup));
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await raceStateCache.restoreFromBackup('race123');

      expect(result).toEqual(mockRaceState);
      expect(mockRedisClient.get).toHaveBeenCalledWith('race_backup:race123:3');
    });

    it('should return null when no backups exist', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await raceStateCache.restoreFromBackup('race123');

      expect(result).toBeNull();
    });
  });

  describe('removeRace', () => {
    it('should remove all race-related data', async () => {
      mockRedisClient.keys
        .mockResolvedValueOnce(['race_state:race123'])
        .mockResolvedValueOnce(['race_backup:race123:1', 'race_backup:race123:2'])
        .mockResolvedValueOnce(['participant:race123:player1'])
        .mockResolvedValueOnce(['race_events:race123']);
      mockRedisClient.del.mockResolvedValue(1);

      const result = await raceStateCache.removeRace('race123');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith([
        'race_state:race123',
        'race_backup:race123:1',
        'race_backup:race123:2',
        'participant:race123:player1',
        'race_events:race123'
      ]);
    });

    it('should handle race with no cached data', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await raceStateCache.removeRace('nonexistent');

      expect(result).toBe(true);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      mockRedisClient.keys
        .mockResolvedValueOnce(['race_state:race1', 'race_state:race2'])
        .mockResolvedValueOnce(['participant:race1:player1', 'participant:race2:player1'])
        .mockResolvedValueOnce(['race_backup:race1:1', 'race_backup:race2:1']);

      const result = await raceStateCache.getCacheStats();

      expect(result).toEqual({
        activeRaces: 2,
        totalParticipants: 2,
        totalBackups: 2
      });
    });

    it('should handle Redis errors in stats', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await raceStateCache.getCacheStats();

      expect(result).toEqual({
        activeRaces: 0,
        totalParticipants: 0,
        totalBackups: 0
      });
    });
  });
});