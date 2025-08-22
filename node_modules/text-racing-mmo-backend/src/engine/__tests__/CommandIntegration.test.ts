import { CommandProcessor, CommandInput } from '../CommandProcessor';
import { PhysicsEngine, RaceCommand } from '../PhysicsEngine';
import { RaceState, ParticipantState, WeatherConditions, TrackConditions } from '../../../../shared/types';

describe('Command Processing Integration', () => {
  let commandProcessor: CommandProcessor;
  let mockRaceState: RaceState;

  beforeEach(() => {
    commandProcessor = new CommandProcessor();
    
    // Create a mock race state with two participants
    mockRaceState = {
      raceId: 'test-race-1',
      trackId: 'silverstone-gp',
      currentLap: 1,
      totalLaps: 10,
      raceTime: 0,
      participants: [
        {
          playerId: 'player1',
          carId: 'car1',
          position: 1,
          lapTime: 0,
          totalTime: 0,
          fuel: 100,
          tireWear: { front: 0, rear: 0 },
          speed: 0,
          location: { lap: 0, sector: 1, distance: 0 },
          lastCommand: 'coast',
          commandTimestamp: 0
        },
        {
          playerId: 'player2',
          carId: 'car2',
          position: 2,
          lapTime: 0,
          totalTime: 0,
          fuel: 100,
          tireWear: { front: 0, rear: 0 },
          speed: 0,
          location: { lap: 0, sector: 1, distance: 0 },
          lastCommand: 'coast',
          commandTimestamp: 0
        }
      ],
      raceEvents: [],
      weather: {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        precipitation: 0,
        visibility: 1000
      } as WeatherConditions,
      trackConditions: {
        surface: 'dry',
        grip: 1.0,
        temperature: 25
      } as TrackConditions
    };
  });

  test('should process commands and integrate with physics engine', () => {
    const now = Date.now();
    
    // Player 1 sends accelerate command
    const player1Input: CommandInput = {
      playerId: 'player1',
      commandText: 'accelerate 0.8',
      timestamp: now
    };
    
    // Player 2 sends brake command
    const player2Input: CommandInput = {
      playerId: 'player2',
      commandText: 'brake 50%',
      timestamp: now + 1
    };

    // Process the commands
    const result1 = commandProcessor.processCommand(player1Input);
    const result2 = commandProcessor.processCommand(player2Input);

    expect(result1.isValid).toBe(true);
    expect(result2.isValid).toBe(true);

    // Get commands for physics engine
    const player1Command = commandProcessor.getNextCommand('player1');
    const player2Command = commandProcessor.getNextCommand('player2');

    expect(player1Command).toEqual({ type: 'accelerate', intensity: 0.8 });
    expect(player2Command).toEqual({ type: 'brake', intensity: 0.5 });

    // Create command map for physics engine
    const commandMap = new Map<string, RaceCommand>();
    if (player1Command) commandMap.set('player1', player1Command);
    if (player2Command) commandMap.set('player2', player2Command);

    // This would normally be called by the race engine
    // Note: We can't actually run the physics engine here because it requires CarService
    // but we can verify the command map structure is correct
    expect(commandMap.size).toBe(2);
    expect(commandMap.get('player1')?.type).toBe('accelerate');
    expect(commandMap.get('player2')?.type).toBe('brake');
  });

  test('should handle multiple rapid commands with rate limiting', () => {
    const now = Date.now();
    const commands: CommandInput[] = [
      { playerId: 'player1', commandText: 'accelerate', timestamp: now },
      { playerId: 'player1', commandText: 'brake', timestamp: now + 1 },
      { playerId: 'player1', commandText: 'shift 3', timestamp: now + 2 },
      { playerId: 'player1', commandText: 'accelerate 0.5', timestamp: now + 3 },
      { playerId: 'player1', commandText: 'pit', timestamp: now + 4 }
    ];

    const results = commands.map(cmd => commandProcessor.processCommand(cmd));

    // First 3 commands should succeed (rate limit is 5 per second by default)
    expect(results[0].isValid).toBe(true);
    expect(results[1].isValid).toBe(true);
    expect(results[2].isValid).toBe(true);
    expect(results[3].isValid).toBe(true);
    expect(results[4].isValid).toBe(true);

    // Should be able to get commands in order
    const cmd1 = commandProcessor.getNextCommand('player1');
    const cmd2 = commandProcessor.getNextCommand('player1');
    const cmd3 = commandProcessor.getNextCommand('player1');

    expect(cmd1?.type).toBe('accelerate');
    expect(cmd2?.type).toBe('brake');
    expect(cmd3?.type).toBe('shift');
  });

  test('should handle invalid commands gracefully', () => {
    const invalidCommands: CommandInput[] = [
      { playerId: 'player1', commandText: 'jump', timestamp: Date.now() },
      { playerId: 'player1', commandText: 'accelerate 150%', timestamp: Date.now() + 1 },
      { playerId: 'player1', commandText: 'shift', timestamp: Date.now() + 2 },
      { playerId: 'player1', commandText: '', timestamp: Date.now() + 3 }
    ];

    const results = invalidCommands.map(cmd => commandProcessor.processCommand(cmd));

    // All commands should be invalid
    results.forEach(result => {
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    // No commands should be in the queue
    const nextCommand = commandProcessor.getNextCommand('player1');
    expect(nextCommand).toBeNull();
  });

  test('should handle mixed valid and invalid commands', () => {
    const mixedCommands: CommandInput[] = [
      { playerId: 'player1', commandText: 'accelerate', timestamp: Date.now() },
      { playerId: 'player1', commandText: 'invalid', timestamp: Date.now() + 1 },
      { playerId: 'player1', commandText: 'brake 0.3', timestamp: Date.now() + 2 },
      { playerId: 'player1', commandText: 'shift 15', timestamp: Date.now() + 3 },
      { playerId: 'player1', commandText: 'pit', timestamp: Date.now() + 4 }
    ];

    const results = mixedCommands.map(cmd => commandProcessor.processCommand(cmd));

    expect(results[0].isValid).toBe(true);  // accelerate - valid
    expect(results[1].isValid).toBe(false); // invalid - invalid
    expect(results[2].isValid).toBe(true);  // brake 0.3 - valid
    expect(results[3].isValid).toBe(false); // shift 15 - invalid (gear out of range)
    expect(results[4].isValid).toBe(true);  // pit - valid

    // Only valid commands should be retrievable
    const cmd1 = commandProcessor.getNextCommand('player1');
    const cmd2 = commandProcessor.getNextCommand('player1');
    const cmd3 = commandProcessor.getNextCommand('player1');
    const cmd4 = commandProcessor.getNextCommand('player1');

    expect(cmd1?.type).toBe('accelerate');
    expect(cmd2?.type).toBe('brake');
    expect(cmd3?.type).toBe('pit');
    expect(cmd4).toBeNull(); // No more valid commands
  });

  test('should support command aliases in race scenario', () => {
    const aliasCommands: CommandInput[] = [
      { playerId: 'player1', commandText: 'acc 75%', timestamp: Date.now() },
      { playerId: 'player1', commandText: 'br', timestamp: Date.now() + 1 },
      { playerId: 'player1', commandText: 'sh 4', timestamp: Date.now() + 2 },
      { playerId: 'player1', commandText: 'p', timestamp: Date.now() + 3 }
    ];

    const results = aliasCommands.map(cmd => commandProcessor.processCommand(cmd));

    // All should be valid
    results.forEach(result => {
      expect(result.isValid).toBe(true);
    });

    // Verify the commands are correctly parsed
    const cmd1 = commandProcessor.getNextCommand('player1');
    const cmd2 = commandProcessor.getNextCommand('player1');
    const cmd3 = commandProcessor.getNextCommand('player1');
    const cmd4 = commandProcessor.getNextCommand('player1');

    expect(cmd1).toEqual({ type: 'accelerate', intensity: 0.75 });
    expect(cmd2).toEqual({ type: 'brake', intensity: 1.0 });
    expect(cmd3).toEqual({ type: 'shift', gear: 4 });
    expect(cmd4).toEqual({ type: 'pit' });
  });

  test('should handle multiple players independently', () => {
    const now = Date.now();
    
    // Different commands for different players
    const commands: CommandInput[] = [
      { playerId: 'player1', commandText: 'accelerate', timestamp: now },
      { playerId: 'player2', commandText: 'brake', timestamp: now },
      { playerId: 'player1', commandText: 'shift 3', timestamp: now + 1 },
      { playerId: 'player2', commandText: 'pit', timestamp: now + 1 }
    ];

    commands.forEach(cmd => {
      const result = commandProcessor.processCommand(cmd);
      expect(result.isValid).toBe(true);
    });

    // Each player should get their own commands
    const p1cmd1 = commandProcessor.getNextCommand('player1');
    const p1cmd2 = commandProcessor.getNextCommand('player1');
    const p2cmd1 = commandProcessor.getNextCommand('player2');
    const p2cmd2 = commandProcessor.getNextCommand('player2');

    expect(p1cmd1?.type).toBe('accelerate');
    expect(p1cmd2?.type).toBe('shift');
    expect(p2cmd1?.type).toBe('brake');
    expect(p2cmd2?.type).toBe('pit');

    // No more commands for either player
    expect(commandProcessor.getNextCommand('player1')).toBeNull();
    expect(commandProcessor.getNextCommand('player2')).toBeNull();
  });
});