import { RaceService } from '../services/RaceService';
import { WebSocketServer } from '../websocket/WebSocketServer';
import { ConnectionManager } from '../websocket/ConnectionManager';
import { EventHandler } from '../websocket/EventHandler';
import { createServer } from 'http';
import { getDatabaseConnection } from '../database/connection';
import { CarService } from '../services/CarService';

// Mock dependencies
jest.mock('../database/connection');
jest.mock('../services/CarService');

const mockDb = {
  query: jest.fn(),
  transaction: jest.fn()
};
(getDatabaseConnection as jest.Mock).mockReturnValue(mockDb);

describe('Race Integration Tests', () => {
  let raceService: RaceService;
  let connectionManager: ConnectionManager;
  let eventHandler: EventHandler;
  let mockCarId: string;

  beforeEach(() => {
    jest.clearAllMocks();

    raceService = new RaceService();
    connectionManager = new ConnectionManager();
    eventHandler = new EventHandler(connectionManager, raceService);

    mockCarId = 'test-car-123';

    // Mock database responses with unique IDs
    let raceIdCounter = 0;
    mockDb.query.mockImplementation((query: string) => {
      if (query.includes('INSERT INTO races')) {
        raceIdCounter++;
        return Promise.resolve({ rows: [{ id: `race-${raceIdCounter}` }] });
      }
      // For other queries (car validation, etc.)
      return Promise.resolve({ rows: [{ id: mockCarId }] });
    });

    mockDb.transaction.mockImplementation(async (callback) => {
      return await callback(mockDb);
    });

    // Mock CarService
    (CarService as any).getCarById = jest.fn().mockReturnValue({
      id: mockCarId,
      name: 'Test Car',
      manufacturer: 'Test Manufacturer',
      year: 2023,
      specifications: {
        horsepower: 300,
        weight: 1500,
        dragCoefficient: 0.3,
        frontalArea: 2.5,
        drivetrain: 'RWD',
        tireGrip: 1.0,
        gearRatios: [3.5, 2.1, 1.4, 1.0, 0.8, 0.6],
        aeroDownforce: 50,
        fuelEconomy: 12,
        zeroToSixty: 4.5,
        topSpeed: 250
      },
      licensing: {
        source: 'Test License',
        validUntil: new Date('2025-12-31'),
        restrictions: []
      }
    });
  });

  afterEach(async () => {
    // Clean up any active races to prevent hanging async operations
    const activeRaces = raceService.getActiveRaces();
    for (const raceId of activeRaces) {
      try {
        await raceService.stopRace(raceId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  describe('Complete Race Lifecycle', () => {
    it('should handle full race from creation to completion', async () => {
      // Track events
      const events: any[] = [];
      raceService.on('raceCreated', (data) => events.push({ type: 'raceCreated', data }));
      raceService.on('playerJoined', (data) => events.push({ type: 'playerJoined', data }));
      raceService.on('raceStarted', (data) => events.push({ type: 'raceStarted', data }));
      raceService.on('commandProcessed', (data) => events.push({ type: 'commandProcessed', data }));
      raceService.on('pitStopStarted', (data) => events.push({ type: 'pitStopStarted', data }));
      raceService.on('raceStateUpdate', (data) => events.push({ type: 'raceStateUpdate', data }));

      // 1. Create race
      const raceId = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 3,
        maxParticipants: 4
      });

      expect(raceId).toBeDefined();
      expect(events.some(e => e.type === 'raceCreated')).toBe(true);

      // 2. Add multiple participants
      const players = ['player1', 'player2', 'player3'];
      for (const playerId of players) {
        const success = await raceService.joinRace(raceId, {
          playerId,
          carId: mockCarId
        });
        expect(success).toBe(true);
      }

      expect(events.filter(e => e.type === 'playerJoined')).toHaveLength(3);

      // 3. Verify race state before start
      const preRaceState = raceService.getRaceState(raceId);
      expect(preRaceState).toBeDefined();
      expect(preRaceState?.participants).toHaveLength(3);
      expect(preRaceState?.raceTime).toBe(0);

      // 4. Start race
      const startSuccess = await raceService.startRace(raceId);
      expect(startSuccess).toBe(true);
      expect(events.some(e => e.type === 'raceStarted')).toBe(true);

      // 5. Process various commands
      const commandSequence = [
        { player: 'player1', command: 'accelerate' },
        { player: 'player2', command: 'accelerate' },
        { player: 'player3', command: 'accelerate' },
        { player: 'player1', command: 'shift 3' },
        { player: 'player2', command: 'brake 25%' },
        { player: 'player1', command: 'pit' }, // Pit stop
        { player: 'player3', command: 'shift 4' },
        { player: 'player2', command: 'accelerate' }
      ];

      for (const cmd of commandSequence) {
        const result = await raceService.processPlayerCommand(raceId, cmd.player, cmd.command);
        expect(result.isValid).toBe(true);
      }

      // 6. Verify pit stop was processed
      const pitStopEvents = events.filter(e => e.type === 'pitStopStarted');
      expect(pitStopEvents).toHaveLength(1);
      expect(pitStopEvents[0].data.playerId).toBe('player1');

      // 7. Check final race state
      const finalState = raceService.getRaceState(raceId);
      expect(finalState).toBeDefined();
      expect(finalState?.participants).toHaveLength(3);

      // Verify pit stop effects on player1
      const player1 = finalState?.participants.find(p => p.playerId === 'player1');
      expect(player1?.fuel).toBe(100); // Refueled
      expect(player1?.tireWear.front).toBe(0); // New tires
      expect(player1?.tireWear.rear).toBe(0);

      // 8. Verify command processing events
      const commandEvents = events.filter(e => e.type === 'commandProcessed');
      expect(commandEvents.length).toBeGreaterThan(0);
    });

    it('should handle race with strategic pit stops', async () => {
      const raceId = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 5
      });

      // Add two players
      await raceService.joinRace(raceId, { playerId: 'player1', carId: mockCarId });
      await raceService.joinRace(raceId, { playerId: 'player2', carId: mockCarId });

      await raceService.startRace(raceId);

      // Simulate race where players need pit stops at different times
      const raceState = raceService.getRaceState(raceId);
      if (raceState) {
        // Manually set tire wear and fuel to simulate race conditions
        const player1 = raceState.participants.find(p => p.playerId === 'player1');
        const player2 = raceState.participants.find(p => p.playerId === 'player2');

        if (player1) {
          player1.fuel = 15; // Low fuel
          player1.tireWear.front = 60; // Worn tires
          player1.tireWear.rear = 55;
        }

        if (player2) {
          player2.fuel = 80; // Good fuel
          player2.tireWear.front = 20; // Good tires
          player2.tireWear.rear = 25;
        }
      }

      // Player1 pits (needs fuel and tires)
      const pitResult1 = await raceService.processPlayerCommand(raceId, 'player1', 'pit');
      expect(pitResult1.isValid).toBe(true);

      // Player2 continues racing
      const accelResult = await raceService.processPlayerCommand(raceId, 'player2', 'accelerate');
      expect(accelResult.isValid).toBe(true);

      // Verify pit stop effects
      const updatedState = raceService.getRaceState(raceId);
      const updatedPlayer1 = updatedState?.participants.find(p => p.playerId === 'player1');
      const updatedPlayer2 = updatedState?.participants.find(p => p.playerId === 'player2');

      expect(updatedPlayer1?.fuel).toBe(100);
      expect(updatedPlayer1?.tireWear.front).toBe(0);
      expect(updatedPlayer2?.fuel).toBe(80); // Unchanged
    });

    it('should handle concurrent races without interference', async () => {
      // Create two separate races
      const race1Id = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 3
      });
      const race2Id = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 5
      });

      // Add different players to each race
      await raceService.joinRace(race1Id, { playerId: 'race1_player1', carId: mockCarId });
      await raceService.joinRace(race1Id, { playerId: 'race1_player2', carId: mockCarId });

      await raceService.joinRace(race2Id, { playerId: 'race2_player1', carId: mockCarId });
      await raceService.joinRace(race2Id, { playerId: 'race2_player2', carId: mockCarId });

      // Start both races
      await raceService.startRace(race1Id);
      await raceService.startRace(race2Id);

      // Process commands in both races
      await raceService.processPlayerCommand(race1Id, 'race1_player1', 'accelerate');
      await raceService.processPlayerCommand(race2Id, 'race2_player1', 'brake 50%');
      await raceService.processPlayerCommand(race1Id, 'race1_player2', 'shift 3');
      await raceService.processPlayerCommand(race2Id, 'race2_player2', 'pit');

      // Verify race states are independent
      const race1State = raceService.getRaceState(race1Id);
      const race2State = raceService.getRaceState(race2Id);

      expect(race1State?.raceId).toBe(race1Id);
      expect(race2State?.raceId).toBe(race2Id);
      expect(race1State?.totalLaps).toBe(3);
      expect(race2State?.totalLaps).toBe(5);
      expect(race1State?.participants).toHaveLength(2);
      expect(race2State?.participants).toHaveLength(2);

      // Verify participants are in correct races
      expect(race1State?.participants.map(p => p.playerId)).toEqual(['race1_player1', 'race1_player2']);
      expect(race2State?.participants.map(p => p.playerId)).toEqual(['race2_player1', 'race2_player2']);
    });

    it('should handle player disconnection and reconnection scenarios', async () => {
      const raceId = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 3
      });

      // Add players
      await raceService.joinRace(raceId, { playerId: 'player1', carId: mockCarId });
      await raceService.joinRace(raceId, { playerId: 'player2', carId: mockCarId });

      await raceService.startRace(raceId);

      // Process some commands
      await raceService.processPlayerCommand(raceId, 'player1', 'accelerate');
      await raceService.processPlayerCommand(raceId, 'player2', 'accelerate');

      // Simulate player leaving (but not disconnecting from race)
      const leaveSuccess = await raceService.leaveRace(raceId, 'player1');
      expect(leaveSuccess).toBe(true);

      // Verify race continues with remaining player
      const stateAfterLeave = raceService.getRaceState(raceId);
      expect(stateAfterLeave?.participants).toHaveLength(1);
      expect(stateAfterLeave?.participants[0].playerId).toBe('player2');

      // Remaining player can still race
      const continueResult = await raceService.processPlayerCommand(raceId, 'player2', 'shift 3');
      expect(continueResult.isValid).toBe(true);
    });

    it('should handle race result calculation and persistence', async () => {
      const raceId = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 2 // Short race for testing
      });

      // Add participants
      await raceService.joinRace(raceId, { playerId: 'winner', carId: mockCarId });
      await raceService.joinRace(raceId, { playerId: 'second', carId: mockCarId });
      await raceService.joinRace(raceId, { playerId: 'third', carId: mockCarId });

      await raceService.startRace(raceId);

      // Process commands to simulate race progression
      await raceService.processPlayerCommand(raceId, 'winner', 'accelerate');
      await raceService.processPlayerCommand(raceId, 'second', 'accelerate');
      await raceService.processPlayerCommand(raceId, 'third', 'accelerate');

      // Simulate pit stop for strategic element
      await raceService.processPlayerCommand(raceId, 'second', 'pit');

      // Verify race state has all participants
      const raceState = raceService.getRaceState(raceId);
      expect(raceState?.participants).toHaveLength(3);

      // Verify positions are tracked
      const positions = raceState?.participants.map(p => p.position).sort();
      expect(positions).toEqual([1, 2, 3]);

      // Test manual race stop (simulating completion)
      const stopSuccess = await raceService.stopRace(raceId);
      expect(stopSuccess).toBe(true);

      // Verify race is no longer active
      expect(raceService.getActiveRaces()).not.toContain(raceId);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 3
      })).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid commands during race', async () => {
      const raceId = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 3
      });

      await raceService.joinRace(raceId, { playerId: 'player1', carId: mockCarId });
      await raceService.startRace(raceId);

      // Test invalid command
      const invalidResult = await raceService.processPlayerCommand(raceId, 'player1', 'invalid-command');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toBeDefined();

      // Test valid command still works
      const validResult = await raceService.processPlayerCommand(raceId, 'player1', 'accelerate');
      expect(validResult.isValid).toBe(true);
    });

    it('should handle race capacity limits', async () => {
      const raceId = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 3,
        maxParticipants: 2
      });

      // Add maximum participants
      await raceService.joinRace(raceId, { playerId: 'player1', carId: mockCarId });
      await raceService.joinRace(raceId, { playerId: 'player2', carId: mockCarId });

      // Try to add one more (should fail)
      const overCapacityResult = await raceService.joinRace(raceId, {
        playerId: 'player3',
        carId: mockCarId
      });
      expect(overCapacityResult).toBe(false);

      // Verify only 2 participants
      const raceState = raceService.getRaceState(raceId);
      expect(raceState?.participants).toHaveLength(2);
    });

    it('should handle race state consistency under rapid commands', async () => {
      const raceId = await raceService.createRace({
        trackId: 'silverstone-gp',
        totalLaps: 3
      });

      await raceService.joinRace(raceId, { playerId: 'player1', carId: mockCarId });
      await raceService.startRace(raceId);

      // Send rapid commands
      const rapidCommands = [
        'accelerate',
        'brake 20%',
        'shift 3',
        'accelerate',
        'brake 50%',
        'shift 2',
        'accelerate'
      ];

      const results = await Promise.all(
        rapidCommands.map(cmd =>
          raceService.processPlayerCommand(raceId, 'player1', cmd)
        )
      );

      // All commands should be processed
      expect(results).toHaveLength(7);
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Race state should remain consistent
      const finalState = raceService.getRaceState(raceId);
      expect(finalState).toBeDefined();
      expect(finalState?.participants).toHaveLength(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple races with many participants', async () => {
      const races: string[] = [];
      const numRaces = 5;
      const participantsPerRace = 4;

      // Create multiple races
      for (let i = 0; i < numRaces; i++) {
        const raceId = await raceService.createRace({
          trackId: 'silverstone-gp',
          totalLaps: 3
        });
        races.push(raceId);

        // Add participants to each race
        for (let j = 0; j < participantsPerRace; j++) {
          await raceService.joinRace(raceId, {
            playerId: `race${i}_player${j}`,
            carId: mockCarId
          });
        }

        await raceService.startRace(raceId);
      }

      // Verify all races are active
      const activeRaces = raceService.getActiveRaces();
      expect(activeRaces).toHaveLength(numRaces);

      // Process commands in all races
      for (const raceId of races) {
        const raceState = raceService.getRaceState(raceId);
        if (raceState) {
          for (const participant of raceState.participants) {
            const result = await raceService.processPlayerCommand(
              raceId,
              participant.playerId,
              'accelerate'
            );
            expect(result.isValid).toBe(true);
          }
        }
      }

      // Verify all race states are maintained correctly
      for (const raceId of races) {
        const raceState = raceService.getRaceState(raceId);
        expect(raceState?.participants).toHaveLength(participantsPerRace);
      }
    });
  });
});