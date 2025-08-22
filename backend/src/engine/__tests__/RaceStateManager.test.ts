import { RaceStateManager, RaceConfiguration } from '../RaceStateManager';
import { CarService } from '../../services/CarService';
import { WeatherConditions, TrackConditions } from '../../../../shared/types';

describe('RaceStateManager', () => {
  let raceManager: RaceStateManager;
  let mockConfig: RaceConfiguration;

  beforeEach(() => {
    // Initialize CarService
    CarService.initialize();

    mockConfig = {
      raceId: 'test-race-123',
      trackId: 'silverstone-gp',
      totalLaps: 5,
      maxParticipants: 20,
      weather: {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        precipitation: 0,
        visibility: 10000
      },
      trackConditions: {
        surface: 'dry',
        grip: 1.0,
        temperature: 25
      }
    };

    raceManager = new RaceStateManager(mockConfig);
  });

  afterEach(() => {
    // Clean up any running intervals
    if (raceManager.isRaceActive()) {
      raceManager.stopRace();
    }
  });

  describe('initialization', () => {
    it('should initialize with correct race configuration', () => {
      const raceState = raceManager.getRaceState();
      
      expect(raceState.raceId).toBe(mockConfig.raceId);
      expect(raceState.trackId).toBe(mockConfig.trackId);
      expect(raceState.totalLaps).toBe(mockConfig.totalLaps);
      expect(raceState.participants).toHaveLength(0);
      expect(raceState.raceTime).toBe(0);
      expect(raceManager.isRaceActive()).toBe(false);
    });

    it('should initialize with default track if none provided', () => {
      const track = raceManager.getTrack();
      
      expect(track).toBeDefined();
      expect(track.id).toBe('silverstone-gp');
      expect(track.length).toBeGreaterThan(0);
    });
  });

  describe('participant management', () => {
    it('should add participants successfully', () => {
      const result = raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
      
      expect(result).toBe(true);
      expect(raceManager.getParticipantCount()).toBe(1);
      
      const raceState = raceManager.getRaceState();
      expect(raceState.participants[0].playerId).toBe('player1');
      expect(raceState.participants[0].carId).toBe('honda-civic-type-r-2023');
      expect(raceState.participants[0].position).toBe(1);
      expect(raceState.participants[0].fuel).toBe(100);
    });

    it('should not add duplicate participants', () => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
      const result = raceManager.addParticipant('player1', 'porsche-911-gt3-2022');
      
      expect(result).toBe(false);
      expect(raceManager.getParticipantCount()).toBe(1);
    });

    it('should not add participants to active race', () => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
      raceManager.startRace();
      
      const result = raceManager.addParticipant('player2', 'porsche-911-gt3-2022');
      
      expect(result).toBe(false);
      expect(raceManager.getParticipantCount()).toBe(1);
    });

    it('should remove participants successfully', () => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
      raceManager.addParticipant('player2', 'porsche-911-gt3-2022');
      
      const result = raceManager.removeParticipant('player1');
      
      expect(result).toBe(true);
      expect(raceManager.getParticipantCount()).toBe(1);
      
      const raceState = raceManager.getRaceState();
      expect(raceState.participants[0].playerId).toBe('player2');
      expect(raceState.participants[0].position).toBe(1); // Position updated
    });

    it('should not remove non-existent participants', () => {
      const result = raceManager.removeParticipant('nonexistent');
      
      expect(result).toBe(false);
      expect(raceManager.getParticipantCount()).toBe(0);
    });

    it('should update positions when participants are removed', () => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
      raceManager.addParticipant('player2', 'porsche-911-gt3-2022');
      raceManager.addParticipant('player3', 'subaru-wrx-sti-2021');
      
      raceManager.removeParticipant('player2'); // Remove middle participant
      
      const raceState = raceManager.getRaceState();
      expect(raceState.participants).toHaveLength(2);
      expect(raceState.participants[0].position).toBe(1);
      expect(raceState.participants[1].position).toBe(2);
    });
  });

  describe('race lifecycle', () => {
    beforeEach(() => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
    });

    it('should start race successfully', () => {
      const result = raceManager.startRace();
      
      expect(result).toBe(true);
      expect(raceManager.isRaceActive()).toBe(true);
      
      const raceState = raceManager.getRaceState();
      const startEvent = raceState.raceEvents.find(e => e.type === 'race_start');
      expect(startEvent).toBeDefined();
    });

    it('should not start race without participants', () => {
      const emptyRaceManager = new RaceStateManager(mockConfig);
      const result = emptyRaceManager.startRace();
      
      expect(result).toBe(false);
      expect(emptyRaceManager.isRaceActive()).toBe(false);
    });

    it('should not start already active race', () => {
      raceManager.startRace();
      const result = raceManager.startRace();
      
      expect(result).toBe(false);
    });

    it('should stop race successfully', () => {
      raceManager.startRace();
      raceManager.stopRace();
      
      expect(raceManager.isRaceActive()).toBe(false);
      
      const raceState = raceManager.getRaceState();
      const finishEvent = raceState.raceEvents.find(e => e.type === 'race_finish');
      expect(finishEvent).toBeDefined();
    });

    it('should handle stopping inactive race gracefully', () => {
      expect(() => raceManager.stopRace()).not.toThrow();
      expect(raceManager.isRaceActive()).toBe(false);
    });
  });

  describe('command processing', () => {
    beforeEach(() => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
      raceManager.startRace();
    });

    it('should queue commands for active race', () => {
      const result = raceManager.queueCommand('player1', { type: 'accelerate', intensity: 1.0 });
      
      expect(result).toBe(true);
    });

    it('should not queue commands for inactive race', () => {
      raceManager.stopRace();
      const result = raceManager.queueCommand('player1', { type: 'accelerate', intensity: 1.0 });
      
      expect(result).toBe(false);
    });

    it('should not queue commands for non-existent participants', () => {
      const result = raceManager.queueCommand('nonexistent', { type: 'accelerate', intensity: 1.0 });
      
      expect(result).toBe(false);
    });
  });

  describe('race progress tracking', () => {
    beforeEach(() => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
    });

    it('should calculate race progress correctly', () => {
      let progress = raceManager.getRaceProgress();
      expect(progress).toBe(0);
      
      // Simulate some race progress
      const raceState = raceManager.getRaceState();
      raceState.participants[0].location.lap = 1;
      raceState.participants[0].location.distance = 1000;
      
      progress = raceManager.getRaceProgress();
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it('should return 0 progress for race with no participants', () => {
      const emptyRaceManager = new RaceStateManager(mockConfig);
      const progress = emptyRaceManager.getRaceProgress();
      
      expect(progress).toBe(0);
    });
  });

  describe('weather and track conditions', () => {
    it('should update weather conditions', () => {
      const newWeather: WeatherConditions = {
        temperature: 15,
        humidity: 80,
        windSpeed: 20,
        precipitation: 5,
        visibility: 5000
      };
      
      raceManager.updateWeather(newWeather);
      
      const raceState = raceManager.getRaceState();
      expect(raceState.weather).toEqual(newWeather);
      
      const weatherEvent = raceState.raceEvents.find(e => 
        e.description.includes('Weather conditions changed')
      );
      expect(weatherEvent).toBeDefined();
    });

    it('should update track conditions', () => {
      const newConditions: TrackConditions = {
        surface: 'wet',
        grip: 0.7,
        temperature: 15
      };
      
      raceManager.updateTrackConditions(newConditions);
      
      const raceState = raceManager.getRaceState();
      expect(raceState.trackConditions).toEqual(newConditions);
      
      const conditionEvent = raceState.raceEvents.find(e => 
        e.description.includes('Track conditions changed to wet')
      );
      expect(conditionEvent).toBeDefined();
    });
  });

  describe('race simulation', () => {
    beforeEach(() => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
      raceManager.addParticipant('player2', 'porsche-911-gt3-2022');
    });

    it('should process race ticks when active', (done) => {
      raceManager.startRace();
      
      const initialRaceTime = raceManager.getRaceState().raceTime;
      
      // Wait for a few ticks
      setTimeout(() => {
        const currentRaceTime = raceManager.getRaceState().raceTime;
        expect(currentRaceTime).toBeGreaterThan(initialRaceTime);
        
        raceManager.stopRace();
        done();
      }, 250); // Wait for ~2-3 ticks
    });

    it('should update participant states during simulation', (done) => {
      raceManager.startRace();
      
      // Queue some commands
      raceManager.queueCommand('player1', { type: 'accelerate', intensity: 1.0 });
      raceManager.queueCommand('player2', { type: 'accelerate', intensity: 0.8 });
      
      setTimeout(() => {
        const raceState = raceManager.getRaceState();
        
        // Both participants should have gained speed and moved
        expect(raceState.participants[0].speed).toBeGreaterThan(0);
        expect(raceState.participants[1].speed).toBeGreaterThan(0);
        expect(raceState.participants[0].location.distance).toBeGreaterThan(0);
        expect(raceState.participants[1].location.distance).toBeGreaterThan(0);
        
        raceManager.stopRace();
        done();
      }, 250);
    });
  });

  describe('race completion', () => {
    beforeEach(() => {
      raceManager.addParticipant('player1', 'honda-civic-type-r-2023');
    });

    it('should complete race when participant finishes all laps', (done) => {
      raceManager.startRace();
      
      // Manually set participant near race completion
      const raceState = raceManager.getRaceState();
      raceState.participants[0].location.lap = mockConfig.totalLaps;
      
      // Wait for race completion check
      setTimeout(() => {
        expect(raceManager.isRaceActive()).toBe(false);
        
        const finalState = raceManager.getRaceState();
        const finishEvent = finalState.raceEvents.find(e => e.type === 'race_finish');
        expect(finishEvent).toBeDefined();
        
        done();
      }, 150);
    });
  });
});