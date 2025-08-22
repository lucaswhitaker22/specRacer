import { PhysicsEngine, RaceCommand, TrackConfiguration } from '../PhysicsEngine';
import { CarService } from '../../services/CarService';
import { RaceState, ParticipantState, CarModel } from '../../../../shared/types';

describe('PhysicsEngine', () => {
  let mockCar: CarModel;
  let mockParticipant: ParticipantState;
  let mockRaceState: RaceState;
  let mockTrack: TrackConfiguration;

  beforeEach(() => {
    // Initialize CarService
    CarService.initialize();
    
    mockCar = {
      id: 'test-car',
      name: 'Test Car',
      manufacturer: 'Test',
      year: 2023,
      specifications: {
        horsepower: 300,
        weight: 1500,
        dragCoefficient: 0.35,
        frontalArea: 2.2,
        drivetrain: 'RWD',
        tireGrip: 1.0,
        gearRatios: [3.5, 2.1, 1.4, 1.0, 0.8],
        aeroDownforce: 50,
        fuelEconomy: 10.0,
        zeroToSixty: 5.0,
        topSpeed: 250
      },
      licensing: {
        source: 'Test',
        validUntil: new Date('2025-12-31'),
        restrictions: []
      }
    };

    mockParticipant = {
      playerId: 'player1',
      carId: 'test-car',
      position: 1,
      lapTime: 0,
      totalTime: 0,
      fuel: 100,
      tireWear: { front: 0, rear: 0 },
      speed: 0,
      location: { lap: 0, sector: 1, distance: 0 },
      lastCommand: 'coast',
      commandTimestamp: 0
    };

    mockRaceState = {
      raceId: 'test-race',
      trackId: 'test-track',
      currentLap: 0,
      totalLaps: 5,
      raceTime: 0,
      participants: [mockParticipant],
      raceEvents: [],
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

    mockTrack = {
      id: 'test-track',
      name: 'Test Track',
      length: 5000,
      sectors: 3,
      corners: 12,
      elevation: 20,
      surface: 'asphalt',
      difficulty: 0.5
    };

    // Mock CarService.getCarById
    jest.spyOn(CarService, 'getCarById').mockReturnValue(mockCar);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processRaceTick', () => {
    it('should process a race tick with no commands', () => {
      const commands = new Map<string, RaceCommand>();
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState).toBeDefined();
      expect(result.updatedState.raceTime).toBeGreaterThan(mockRaceState.raceTime);
      expect(result.updatedState.participants).toHaveLength(1);
      expect(result.events).toBeDefined();
    });

    it('should process acceleration command', () => {
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants[0].speed).toBeGreaterThan(0);
      expect(result.updatedState.participants[0].location.distance).toBeGreaterThan(0);
    });

    it('should process braking command', () => {
      // Start with some speed
      mockParticipant.speed = 100;
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'brake', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants[0].speed).toBeLessThan(100);
    });

    it('should update fuel consumption during acceleration', () => {
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants[0].fuel).toBeLessThan(100);
    });

    it('should update tire wear during racing', () => {
      mockParticipant.speed = 150; // High speed to generate wear
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants[0].tireWear.front).toBeGreaterThan(0);
      expect(result.updatedState.participants[0].tireWear.rear).toBeGreaterThan(0);
    });

    it('should respect top speed limits', () => {
      // Start near top speed
      mockParticipant.speed = 245;
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants[0].speed).toBeLessThanOrEqual(250);
    });

    it('should handle multiple participants', () => {
      const participant2: ParticipantState = {
        ...mockParticipant,
        playerId: 'player2',
        position: 2
      };
      
      mockRaceState.participants.push(participant2);
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      commands.set('player2', { type: 'accelerate', intensity: 0.8 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants).toHaveLength(2);
      expect(result.updatedState.participants[0].speed).toBeGreaterThan(
        result.updatedState.participants[1].speed
      );
    });

    it('should consume fuel during acceleration', () => {
      mockParticipant.fuel = 100;
      mockParticipant.speed = 100;
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      // Fuel should be consumed
      expect(result.updatedState.participants[0].fuel).toBeLessThan(100);
    });

    it('should increase tire wear during racing', () => {
      mockParticipant.tireWear.front = 0;
      mockParticipant.speed = 150;
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'brake', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      // Tire wear should increase
      expect(result.updatedState.participants[0].tireWear.front).toBeGreaterThan(0);
    });
  });

  describe('overtake detection', () => {
    it('should detect overtakes between participants', () => {
      const participant2: ParticipantState = {
        ...mockParticipant,
        playerId: 'player2',
        position: 2,
        speed: 50
      };
      
      mockRaceState.participants.push(participant2);
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'coast' }); // Slower player
      commands.set('player2', { type: 'accelerate', intensity: 1.0 }); // Faster player
      
      // Process multiple ticks to allow overtake
      let result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      for (let i = 0; i < 50; i++) {
        result = PhysicsEngine.processRaceTick(result.updatedState, commands, mockTrack);
      }
      
      const overtakeEvent = result.updatedState.raceEvents.find(
        event => event.type === 'overtake'
      );
      
      expect(overtakeEvent).toBeDefined();
    });
  });

  describe('lap completion detection', () => {
    it('should detect lap completions', () => {
      // Position participant near end of lap with high speed
      mockParticipant.location.distance = mockTrack.length - 100;
      mockParticipant.speed = 200; // High speed to ensure lap completion
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      // Process ticks until lap completion
      let result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      let tickCount = 0;
      while (result.updatedState.participants[0].location.lap === 0 && tickCount < 20) {
        result = PhysicsEngine.processRaceTick(result.updatedState, commands, mockTrack);
        tickCount++;
      }
      
      // Check that lap was completed
      expect(result.updatedState.participants[0].location.lap).toBeGreaterThan(0);
    });
  });

  describe('physics constants', () => {
    it('should return correct tick rate', () => {
      expect(PhysicsEngine.getTickRate()).toBe(10);
    });

    it('should return correct tick duration', () => {
      expect(PhysicsEngine.getTickDuration()).toBe(100);
    });

    it('should return default track configuration', () => {
      const track = PhysicsEngine.getDefaultTrack();
      expect(track).toBeDefined();
      expect(track.id).toBe('silverstone-gp');
      expect(track.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero speed gracefully', () => {
      mockParticipant.speed = 0;
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'coast' });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants[0].speed).toBe(0);
    });

    it('should handle missing car gracefully', () => {
      jest.spyOn(CarService, 'getCarById').mockReturnValue(null);
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      // Should not crash and should maintain original state
      expect(result.updatedState.participants[0].speed).toBe(0);
    });

    it('should handle empty fuel tank', () => {
      mockParticipant.fuel = 0;
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants[0].fuel).toBe(0);
    });

    it('should handle maximum tire wear', () => {
      mockParticipant.tireWear = { front: 100, rear: 100 };
      
      const commands = new Map<string, RaceCommand>();
      commands.set('player1', { type: 'accelerate', intensity: 1.0 });
      
      const result = PhysicsEngine.processRaceTick(mockRaceState, commands, mockTrack);
      
      expect(result.updatedState.participants[0].tireWear.front).toBe(100);
      expect(result.updatedState.participants[0].tireWear.rear).toBe(100);
    });
  });
});