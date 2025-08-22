import { RaceCommand } from './PhysicsEngine';

export interface CommandInput {
  playerId: string;
  commandText: string;
  timestamp: number;
}

export interface ProcessedCommand {
  playerId: string;
  command: RaceCommand;
  timestamp: number;
  isValid: boolean;
  error?: string;
}

export interface CommandValidationResult {
  isValid: boolean;
  error?: string;
  command?: RaceCommand;
}

/**
 * Parses and validates text commands from players
 */
export class CommandParser {
  private static readonly VALID_COMMANDS = ['accelerate', 'brake', 'coast', 'shift', 'pit'] as const;
  private static readonly COMMAND_ALIASES = new Map([
    ['acc', 'accelerate'],
    ['accel', 'accelerate'],
    ['gas', 'accelerate'],
    ['throttle', 'accelerate'],
    ['br', 'brake'],
    ['stop', 'brake'],
    ['slow', 'brake'],
    ['sh', 'shift'],
    ['gear', 'shift'],
    ['p', 'pit'],
    ['pitstop', 'pit'],
    ['c', 'coast'],
    ['neutral', 'coast']
  ]);

  /**
   * Parse a text command into a RaceCommand object
   */
  static parseCommand(commandText: string): CommandValidationResult {
    if (!commandText || typeof commandText !== 'string') {
      return {
        isValid: false,
        error: 'Command cannot be empty'
      };
    }

    const trimmed = commandText.trim().toLowerCase();
    if (trimmed.length === 0) {
      return {
        isValid: false,
        error: 'Command cannot be empty'
      };
    }

    // Split command into parts
    const parts = trimmed.split(/\s+/);
    const baseCommand = parts[0];

    // Resolve aliases
    const resolvedCommand = this.COMMAND_ALIASES.get(baseCommand) || baseCommand;

    // Validate base command
    if (!this.VALID_COMMANDS.includes(resolvedCommand as any)) {
      return {
        isValid: false,
        error: `Unknown command: ${baseCommand}. Valid commands: ${this.VALID_COMMANDS.join(', ')}`
      };
    }

    // Parse command-specific parameters
    try {
      const command = this.parseCommandParameters(resolvedCommand as typeof this.VALID_COMMANDS[number], parts.slice(1));
      return {
        isValid: true,
        command
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid command parameters'
      };
    }
  }

  /**
   * Parse parameters for specific command types
   */
  private static parseCommandParameters(
    commandType: typeof CommandParser.VALID_COMMANDS[number], 
    params: string[]
  ): RaceCommand {
    switch (commandType) {
      case 'accelerate':
        return this.parseAccelerateCommand(params);
      case 'brake':
        return this.parseBrakeCommand(params);
      case 'shift':
        return this.parseShiftCommand(params);
      case 'pit':
        return this.parsePitCommand(params);
      case 'coast':
        return { type: 'coast' };
      default:
        throw new Error(`Unsupported command type: ${commandType}`);
    }
  }

  /**
   * Parse accelerate command with optional intensity
   */
  private static parseAccelerateCommand(params: string[]): RaceCommand {
    if (params.length === 0) {
      return { type: 'accelerate', intensity: 1.0 };
    }

    const intensityParam = params[0];
    
    // Handle percentage format (e.g., "50%")
    if (intensityParam.endsWith('%')) {
      const percentage = parseFloat(intensityParam.slice(0, -1));
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        throw new Error('Accelerate intensity must be between 0% and 100%');
      }
      return { type: 'accelerate', intensity: percentage / 100 };
    }

    // Handle decimal format (e.g., "0.5")
    const intensity = parseFloat(intensityParam);
    if (isNaN(intensity) || intensity < 0 || intensity > 1) {
      throw new Error('Accelerate intensity must be between 0 and 1, or 0% and 100%');
    }

    return { type: 'accelerate', intensity };
  }

  /**
   * Parse brake command with optional intensity
   */
  private static parseBrakeCommand(params: string[]): RaceCommand {
    if (params.length === 0) {
      return { type: 'brake', intensity: 1.0 };
    }

    const intensityParam = params[0];
    
    // Handle percentage format
    if (intensityParam.endsWith('%')) {
      const percentage = parseFloat(intensityParam.slice(0, -1));
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        throw new Error('Brake intensity must be between 0% and 100%');
      }
      return { type: 'brake', intensity: percentage / 100 };
    }

    // Handle decimal format
    const intensity = parseFloat(intensityParam);
    if (isNaN(intensity) || intensity < 0 || intensity > 1) {
      throw new Error('Brake intensity must be between 0 and 1, or 0% and 100%');
    }

    return { type: 'brake', intensity };
  }

  /**
   * Parse shift command with gear number
   */
  private static parseShiftCommand(params: string[]): RaceCommand {
    if (params.length === 0) {
      throw new Error('Shift command requires a gear number (e.g., "shift 3")');
    }

    const gearParam = params[0];
    
    // Check if it's a valid integer (no decimals)
    if (!/^\d+$/.test(gearParam)) {
      throw new Error('Gear must be a number');
    }
    
    const gear = parseInt(gearParam, 10);

    if (isNaN(gear)) {
      throw new Error('Gear must be a number');
    }

    if (gear < 1 || gear > 8) {
      throw new Error('Gear must be between 1 and 8');
    }

    return { type: 'shift', gear };
  }

  /**
   * Parse pit command (no parameters needed)
   */
  private static parsePitCommand(params: string[]): RaceCommand {
    // Pit command doesn't need parameters for now
    // Future enhancement could include pit strategy (tires, fuel, etc.)
    return { type: 'pit' };
  }

  /**
   * Get list of valid commands for help/documentation
   */
  static getValidCommands(): string[] {
    return [...this.VALID_COMMANDS];
  }

  /**
   * Get command aliases for help/documentation
   */
  static getCommandAliases(): Map<string, string> {
    return new Map(this.COMMAND_ALIASES);
  }
}

/**
 * Manages a queue of commands for a single player
 */
export class CommandQueue {
  private queue: ProcessedCommand[] = [];
  private readonly maxQueueSize: number;
  private readonly maxCommandsPerSecond: number;
  private commandTimestamps: number[] = [];

  constructor(maxQueueSize: number = 10, maxCommandsPerSecond: number = 5) {
    this.maxQueueSize = maxQueueSize;
    this.maxCommandsPerSecond = maxCommandsPerSecond;
  }

  /**
   * Add a command to the queue with rate limiting
   */
  enqueue(command: ProcessedCommand): { success: boolean; error?: string } {
    const now = Date.now();

    // Clean old timestamps (older than 1 second)
    this.commandTimestamps = this.commandTimestamps.filter(ts => now - ts < 1000);

    // Check rate limit
    if (this.commandTimestamps.length >= this.maxCommandsPerSecond) {
      return {
        success: false,
        error: `Rate limit exceeded. Maximum ${this.maxCommandsPerSecond} commands per second.`
      };
    }

    // Check queue size
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest command to make room
      this.queue.shift();
    }

    // Add command to queue
    this.queue.push(command);
    this.commandTimestamps.push(now);

    return { success: true };
  }

  /**
   * Get the next command from the queue
   */
  dequeue(): ProcessedCommand | null {
    return this.queue.shift() || null;
  }

  /**
   * Peek at the next command without removing it
   */
  peek(): ProcessedCommand | null {
    return this.queue[0] || null;
  }

  /**
   * Get the current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear all commands from the queue
   */
  clear(): void {
    this.queue = [];
    this.commandTimestamps = [];
  }

  /**
   * Get all commands in the queue (for debugging)
   */
  getAll(): ProcessedCommand[] {
    return [...this.queue];
  }
}

/**
 * Main command processor that handles parsing, validation, and queuing
 */
export class CommandProcessor {
  private playerQueues = new Map<string, CommandQueue>();
  private readonly defaultQueueSize: number;
  private readonly defaultRateLimit: number;

  constructor(defaultQueueSize: number = 10, defaultRateLimit: number = 5) {
    this.defaultQueueSize = defaultQueueSize;
    this.defaultRateLimit = defaultRateLimit;
  }

  /**
   * Process a raw command input from a player
   */
  processCommand(input: CommandInput): ProcessedCommand {
    // Parse and validate the command
    const parseResult = CommandParser.parseCommand(input.commandText);
    
    const processedCommand: ProcessedCommand = {
      playerId: input.playerId,
      timestamp: input.timestamp,
      isValid: parseResult.isValid,
      command: parseResult.command || { type: 'coast' },
      error: parseResult.error
    };

    // If command is valid, add to player's queue
    if (processedCommand.isValid) {
      const queue = this.getPlayerQueue(input.playerId);
      const enqueueResult = queue.enqueue(processedCommand);
      
      if (!enqueueResult.success) {
        // Override the command as invalid due to queue/rate limit issues
        processedCommand.isValid = false;
        processedCommand.error = enqueueResult.error;
      }
    }

    return processedCommand;
  }

  /**
   * Get the next command for a player
   */
  getNextCommand(playerId: string): RaceCommand | null {
    const queue = this.playerQueues.get(playerId);
    if (!queue) {
      return null;
    }

    const processedCommand = queue.dequeue();
    return processedCommand?.command || null;
  }

  /**
   * Get or create a command queue for a player
   */
  private getPlayerQueue(playerId: string): CommandQueue {
    let queue = this.playerQueues.get(playerId);
    if (!queue) {
      queue = new CommandQueue(this.defaultQueueSize, this.defaultRateLimit);
      this.playerQueues.set(playerId, queue);
    }
    return queue;
  }

  /**
   * Clear all commands for a player
   */
  clearPlayerCommands(playerId: string): void {
    const queue = this.playerQueues.get(playerId);
    if (queue) {
      queue.clear();
    }
  }

  /**
   * Remove a player's queue entirely
   */
  removePlayer(playerId: string): void {
    this.playerQueues.delete(playerId);
  }

  /**
   * Get queue status for a player (for debugging/monitoring)
   */
  getPlayerQueueStatus(playerId: string): { size: number; commands: ProcessedCommand[] } {
    const queue = this.playerQueues.get(playerId);
    if (!queue) {
      return { size: 0, commands: [] };
    }
    return {
      size: queue.size(),
      commands: queue.getAll()
    };
  }

  /**
   * Get all active players with queues
   */
  getActivePlayers(): string[] {
    return Array.from(this.playerQueues.keys());
  }
}