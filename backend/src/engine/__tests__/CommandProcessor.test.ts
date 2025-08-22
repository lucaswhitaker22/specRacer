import { 
  CommandParser, 
  CommandQueue, 
  CommandProcessor, 
  CommandInput, 
  ProcessedCommand 
} from '../CommandProcessor';
import { RaceCommand } from '../PhysicsEngine';

describe('CommandParser', () => {
  describe('parseCommand', () => {
    describe('valid commands', () => {
      test('should parse basic accelerate command', () => {
        const result = CommandParser.parseCommand('accelerate');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'accelerate', intensity: 1.0 });
      });

      test('should parse accelerate with decimal intensity', () => {
        const result = CommandParser.parseCommand('accelerate 0.5');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'accelerate', intensity: 0.5 });
      });

      test('should parse accelerate with percentage intensity', () => {
        const result = CommandParser.parseCommand('accelerate 75%');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'accelerate', intensity: 0.75 });
      });

      test('should parse basic brake command', () => {
        const result = CommandParser.parseCommand('brake');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'brake', intensity: 1.0 });
      });

      test('should parse brake with intensity', () => {
        const result = CommandParser.parseCommand('brake 0.3');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'brake', intensity: 0.3 });
      });

      test('should parse brake with percentage', () => {
        const result = CommandParser.parseCommand('brake 50%');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'brake', intensity: 0.5 });
      });

      test('should parse shift command with gear', () => {
        const result = CommandParser.parseCommand('shift 3');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'shift', gear: 3 });
      });

      test('should parse coast command', () => {
        const result = CommandParser.parseCommand('coast');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'coast' });
      });

      test('should parse pit command', () => {
        const result = CommandParser.parseCommand('pit');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'pit' });
      });
    });

    describe('command aliases', () => {
      test('should parse accelerate aliases', () => {
        const aliases = ['acc', 'accel', 'gas', 'throttle'];
        aliases.forEach(alias => {
          const result = CommandParser.parseCommand(alias);
          expect(result.isValid).toBe(true);
          expect(result.command?.type).toBe('accelerate');
        });
      });

      test('should parse brake aliases', () => {
        const aliases = ['br', 'stop', 'slow'];
        aliases.forEach(alias => {
          const result = CommandParser.parseCommand(alias);
          expect(result.isValid).toBe(true);
          expect(result.command?.type).toBe('brake');
        });
      });

      test('should parse shift aliases', () => {
        const aliases = ['sh', 'gear'];
        aliases.forEach(alias => {
          const result = CommandParser.parseCommand(`${alias} 2`);
          expect(result.isValid).toBe(true);
          expect(result.command?.type).toBe('shift');
          expect(result.command?.gear).toBe(2);
        });
      });

      test('should parse pit aliases', () => {
        const aliases = ['p', 'pitstop'];
        aliases.forEach(alias => {
          const result = CommandParser.parseCommand(alias);
          expect(result.isValid).toBe(true);
          expect(result.command?.type).toBe('pit');
        });
      });

      test('should parse coast aliases', () => {
        const aliases = ['c', 'neutral'];
        aliases.forEach(alias => {
          const result = CommandParser.parseCommand(alias);
          expect(result.isValid).toBe(true);
          expect(result.command?.type).toBe('coast');
        });
      });
    });

    describe('case insensitivity', () => {
      test('should handle uppercase commands', () => {
        const result = CommandParser.parseCommand('ACCELERATE');
        expect(result.isValid).toBe(true);
        expect(result.command?.type).toBe('accelerate');
      });

      test('should handle mixed case commands', () => {
        const result = CommandParser.parseCommand('BrAkE 50%');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'brake', intensity: 0.5 });
      });
    });

    describe('whitespace handling', () => {
      test('should handle leading/trailing whitespace', () => {
        const result = CommandParser.parseCommand('  accelerate 0.8  ');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'accelerate', intensity: 0.8 });
      });

      test('should handle multiple spaces between command and parameters', () => {
        const result = CommandParser.parseCommand('shift    4');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'shift', gear: 4 });
      });
    });

    describe('invalid commands', () => {
      test('should reject empty command', () => {
        const result = CommandParser.parseCommand('');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Command cannot be empty');
      });

      test('should reject null command', () => {
        const result = CommandParser.parseCommand(null as any);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Command cannot be empty');
      });

      test('should reject whitespace-only command', () => {
        const result = CommandParser.parseCommand('   ');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Command cannot be empty');
      });

      test('should reject unknown command', () => {
        const result = CommandParser.parseCommand('jump');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Unknown command: jump');
      });
    });

    describe('invalid parameters', () => {
      test('should reject accelerate with invalid intensity', () => {
        const invalidValues = ['1.5', '150%', '-0.5', '-10%', 'abc'];
        invalidValues.forEach(value => {
          const result = CommandParser.parseCommand(`accelerate ${value}`);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('intensity must be between');
        });
      });

      test('should reject brake with invalid intensity', () => {
        const invalidValues = ['2.0', '200%', '-1', 'xyz'];
        invalidValues.forEach(value => {
          const result = CommandParser.parseCommand(`brake ${value}`);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('intensity must be between');
        });
      });

      test('should reject shift without gear', () => {
        const result = CommandParser.parseCommand('shift');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('requires a gear number');
      });

      test('should reject shift with invalid gear', () => {
        const invalidGears = ['0', '9', '-1', 'abc', '2.5'];
        invalidGears.forEach(gear => {
          const result = CommandParser.parseCommand(`shift ${gear}`);
          expect(result.isValid).toBe(false);
          if (gear === 'abc' || gear === '2.5') {
            expect(result.error).toContain('Gear must be a number');
          } else {
            expect(result.error).toContain('Gear must be between 1 and 8');
          }
        });
      });
    });

    describe('edge cases', () => {
      test('should handle zero intensity for accelerate', () => {
        const result = CommandParser.parseCommand('accelerate 0');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'accelerate', intensity: 0 });
      });

      test('should handle zero intensity for brake', () => {
        const result = CommandParser.parseCommand('brake 0%');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'brake', intensity: 0 });
      });

      test('should handle maximum valid gear', () => {
        const result = CommandParser.parseCommand('shift 8');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'shift', gear: 8 });
      });

      test('should handle minimum valid gear', () => {
        const result = CommandParser.parseCommand('shift 1');
        expect(result.isValid).toBe(true);
        expect(result.command).toEqual({ type: 'shift', gear: 1 });
      });
    });
  });

  describe('utility methods', () => {
    test('should return valid commands list', () => {
      const commands = CommandParser.getValidCommands();
      expect(commands).toContain('accelerate');
      expect(commands).toContain('brake');
      expect(commands).toContain('coast');
      expect(commands).toContain('shift');
      expect(commands).toContain('pit');
    });

    test('should return command aliases map', () => {
      const aliases = CommandParser.getCommandAliases();
      expect(aliases.get('acc')).toBe('accelerate');
      expect(aliases.get('br')).toBe('brake');
      expect(aliases.get('p')).toBe('pit');
    });
  });
});

describe('CommandQueue', () => {
  let queue: CommandQueue;
  let mockCommand: ProcessedCommand;

  beforeEach(() => {
    queue = new CommandQueue(3, 2); // Max 3 commands, 2 per second
    mockCommand = {
      playerId: 'player1',
      command: { type: 'accelerate', intensity: 1.0 },
      timestamp: Date.now(),
      isValid: true
    };
  });

  describe('enqueue', () => {
    test('should successfully enqueue valid command', () => {
      const result = queue.enqueue(mockCommand);
      expect(result.success).toBe(true);
      expect(queue.size()).toBe(1);
    });

    test('should enforce queue size limit', () => {
      // Fill queue to capacity
      for (let i = 0; i < 3; i++) {
        queue.enqueue({ ...mockCommand, timestamp: Date.now() + i });
      }
      expect(queue.size()).toBe(3);

      // Adding one more should remove the oldest
      const result = queue.enqueue({ ...mockCommand, timestamp: Date.now() + 10 });
      expect(result.success).toBe(true);
      expect(queue.size()).toBe(3);
    });

    test('should enforce rate limit', () => {
      // Add 2 commands quickly (should succeed)
      const result1 = queue.enqueue(mockCommand);
      const result2 = queue.enqueue({ ...mockCommand, timestamp: Date.now() + 1 });
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Third command should be rate limited
      const result3 = queue.enqueue({ ...mockCommand, timestamp: Date.now() + 2 });
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Rate limit exceeded');
    });

    test('should allow commands after rate limit window', (done) => {
      // Fill rate limit
      queue.enqueue(mockCommand);
      queue.enqueue({ ...mockCommand, timestamp: Date.now() + 1 });

      // Wait for rate limit to reset
      setTimeout(() => {
        const result = queue.enqueue({ ...mockCommand, timestamp: Date.now() });
        expect(result.success).toBe(true);
        done();
      }, 1100); // Wait slightly more than 1 second
    });
  });

  describe('dequeue', () => {
    test('should return null for empty queue', () => {
      const command = queue.dequeue();
      expect(command).toBeNull();
    });

    test('should return and remove first command', () => {
      const command1 = { ...mockCommand, timestamp: 1 };
      const command2 = { ...mockCommand, timestamp: 2 };
      
      queue.enqueue(command1);
      queue.enqueue(command2);

      const dequeued = queue.dequeue();
      expect(dequeued).toEqual(command1);
      expect(queue.size()).toBe(1);
    });

    test('should maintain FIFO order', () => {
      const commands = [
        { ...mockCommand, timestamp: 1 },
        { ...mockCommand, timestamp: 2 },
        { ...mockCommand, timestamp: 3 }
      ];

      commands.forEach(cmd => queue.enqueue(cmd));

      const dequeued1 = queue.dequeue();
      const dequeued2 = queue.dequeue();
      const dequeued3 = queue.dequeue();

      expect(dequeued1?.timestamp).toBe(1);
      expect(dequeued2?.timestamp).toBe(2);
      expect(dequeued3?.timestamp).toBe(3);
    });
  });

  describe('peek', () => {
    test('should return null for empty queue', () => {
      const command = queue.peek();
      expect(command).toBeNull();
    });

    test('should return first command without removing it', () => {
      queue.enqueue(mockCommand);
      
      const peeked = queue.peek();
      expect(peeked).toEqual(mockCommand);
      expect(queue.size()).toBe(1);
    });
  });

  describe('clear', () => {
    test('should remove all commands', () => {
      queue.enqueue(mockCommand);
      queue.enqueue({ ...mockCommand, timestamp: Date.now() + 1 });
      
      expect(queue.size()).toBe(2);
      queue.clear();
      expect(queue.size()).toBe(0);
    });

    test('should reset rate limiting', () => {
      // Fill rate limit
      queue.enqueue(mockCommand);
      queue.enqueue({ ...mockCommand, timestamp: Date.now() + 1 });
      
      // Clear should reset rate limit
      queue.clear();
      
      // Should be able to add commands again
      const result = queue.enqueue(mockCommand);
      expect(result.success).toBe(true);
    });
  });
});

describe('CommandProcessor', () => {
  let processor: CommandProcessor;
  let mockInput: CommandInput;

  beforeEach(() => {
    processor = new CommandProcessor(5, 3); // Max 5 commands in queue, 3 per second
    mockInput = {
      playerId: 'player1',
      commandText: 'accelerate',
      timestamp: Date.now()
    };
  });

  describe('processCommand', () => {
    test('should process valid command successfully', () => {
      const result = processor.processCommand(mockInput);
      
      expect(result.isValid).toBe(true);
      expect(result.playerId).toBe('player1');
      expect(result.command.type).toBe('accelerate');
      expect(result.error).toBeUndefined();
    });

    test('should handle invalid command', () => {
      const invalidInput = { ...mockInput, commandText: 'invalid' };
      const result = processor.processCommand(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    test('should handle rate limiting', () => {
      // Process commands up to rate limit
      const result1 = processor.processCommand(mockInput);
      const result2 = processor.processCommand({ ...mockInput, timestamp: Date.now() + 1 });
      const result3 = processor.processCommand({ ...mockInput, timestamp: Date.now() + 2 });
      
      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
      expect(result3.isValid).toBe(true);

      // Fourth command should be rate limited
      const result4 = processor.processCommand({ ...mockInput, timestamp: Date.now() + 3 });
      expect(result4.isValid).toBe(false);
      expect(result4.error).toContain('Rate limit exceeded');
    });

    test('should create separate queues for different players', () => {
      const player1Input = { ...mockInput, playerId: 'player1' };
      const player2Input = { ...mockInput, playerId: 'player2' };

      processor.processCommand(player1Input);
      processor.processCommand(player2Input);

      const activePlayers = processor.getActivePlayers();
      expect(activePlayers).toContain('player1');
      expect(activePlayers).toContain('player2');
    });
  });

  describe('getNextCommand', () => {
    test('should return null for non-existent player', () => {
      const command = processor.getNextCommand('nonexistent');
      expect(command).toBeNull();
    });

    test('should return null for player with empty queue', () => {
      // Process a command to create the queue, then empty it
      processor.processCommand(mockInput);
      processor.getNextCommand('player1'); // This empties the queue
      
      const command = processor.getNextCommand('player1');
      expect(command).toBeNull();
    });

    test('should return and remove command from queue', () => {
      processor.processCommand(mockInput);
      
      const command = processor.getNextCommand('player1');
      expect(command).toEqual({ type: 'accelerate', intensity: 1.0 });
      
      // Queue should now be empty
      const nextCommand = processor.getNextCommand('player1');
      expect(nextCommand).toBeNull();
    });

    test('should maintain command order', () => {
      const commands = [
        { ...mockInput, commandText: 'accelerate' },
        { ...mockInput, commandText: 'brake', timestamp: Date.now() + 1 },
        { ...mockInput, commandText: 'coast', timestamp: Date.now() + 2 }
      ];

      commands.forEach(cmd => processor.processCommand(cmd));

      const cmd1 = processor.getNextCommand('player1');
      const cmd2 = processor.getNextCommand('player1');
      const cmd3 = processor.getNextCommand('player1');

      expect(cmd1?.type).toBe('accelerate');
      expect(cmd2?.type).toBe('brake');
      expect(cmd3?.type).toBe('coast');
    });
  });

  describe('player management', () => {
    test('should clear player commands', () => {
      processor.processCommand(mockInput);
      processor.processCommand({ ...mockInput, commandText: 'brake', timestamp: Date.now() + 1 });
      
      let status = processor.getPlayerQueueStatus('player1');
      expect(status.size).toBe(2);
      
      processor.clearPlayerCommands('player1');
      
      status = processor.getPlayerQueueStatus('player1');
      expect(status.size).toBe(0);
    });

    test('should remove player entirely', () => {
      processor.processCommand(mockInput);
      
      let activePlayers = processor.getActivePlayers();
      expect(activePlayers).toContain('player1');
      
      processor.removePlayer('player1');
      
      activePlayers = processor.getActivePlayers();
      expect(activePlayers).not.toContain('player1');
    });

    test('should get player queue status', () => {
      processor.processCommand(mockInput);
      processor.processCommand({ ...mockInput, commandText: 'brake', timestamp: Date.now() + 1 });
      
      const status = processor.getPlayerQueueStatus('player1');
      expect(status.size).toBe(2);
      expect(status.commands).toHaveLength(2);
      expect(status.commands[0].command.type).toBe('accelerate');
      expect(status.commands[1].command.type).toBe('brake');
    });

    test('should return empty status for non-existent player', () => {
      const status = processor.getPlayerQueueStatus('nonexistent');
      expect(status.size).toBe(0);
      expect(status.commands).toHaveLength(0);
    });
  });

  describe('integration scenarios', () => {
    test('should handle multiple players with different command patterns', () => {
      const player1Commands = [
        { playerId: 'player1', commandText: 'accelerate', timestamp: Date.now() },
        { playerId: 'player1', commandText: 'shift 3', timestamp: Date.now() + 1 }
      ];
      
      const player2Commands = [
        { playerId: 'player2', commandText: 'brake 50%', timestamp: Date.now() },
        { playerId: 'player2', commandText: 'pit', timestamp: Date.now() + 1 }
      ];

      [...player1Commands, ...player2Commands].forEach(cmd => {
        const result = processor.processCommand(cmd);
        expect(result.isValid).toBe(true);
      });

      // Verify each player gets their own commands
      const p1cmd1 = processor.getNextCommand('player1');
      const p1cmd2 = processor.getNextCommand('player1');
      const p2cmd1 = processor.getNextCommand('player2');
      const p2cmd2 = processor.getNextCommand('player2');

      expect(p1cmd1?.type).toBe('accelerate');
      expect(p1cmd2?.type).toBe('shift');
      expect(p2cmd1?.type).toBe('brake');
      expect(p2cmd2?.type).toBe('pit');
    });

    test('should handle mixed valid and invalid commands', () => {
      const commands = [
        { ...mockInput, commandText: 'accelerate' }, // valid
        { ...mockInput, commandText: 'invalid' },    // invalid
        { ...mockInput, commandText: 'brake' },      // valid
        { ...mockInput, commandText: 'shift' },      // invalid (no gear)
        { ...mockInput, commandText: 'pit' }         // valid
      ];

      const results = commands.map(cmd => processor.processCommand(cmd));
      
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(false);
      expect(results[4].isValid).toBe(true);

      // Only valid commands should be in queue
      const status = processor.getPlayerQueueStatus('player1');
      expect(status.size).toBe(3);
    });
  });
});