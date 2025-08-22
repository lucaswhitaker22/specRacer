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
export declare class CommandParser {
    private static readonly VALID_COMMANDS;
    private static readonly COMMAND_ALIASES;
    static parseCommand(commandText: string): CommandValidationResult;
    private static parseCommandParameters;
    private static parseAccelerateCommand;
    private static parseBrakeCommand;
    private static parseShiftCommand;
    private static parsePitCommand;
    static getValidCommands(): string[];
    static getCommandAliases(): Map<string, string>;
}
export declare class CommandQueue {
    private queue;
    private readonly maxQueueSize;
    private readonly maxCommandsPerSecond;
    private commandTimestamps;
    constructor(maxQueueSize?: number, maxCommandsPerSecond?: number);
    enqueue(command: ProcessedCommand): {
        success: boolean;
        error?: string;
    };
    dequeue(): ProcessedCommand | null;
    peek(): ProcessedCommand | null;
    size(): number;
    clear(): void;
    getAll(): ProcessedCommand[];
}
export declare class CommandProcessor {
    private playerQueues;
    private readonly defaultQueueSize;
    private readonly defaultRateLimit;
    constructor(defaultQueueSize?: number, defaultRateLimit?: number);
    processCommand(input: CommandInput): ProcessedCommand;
    getNextCommand(playerId: string): RaceCommand | null;
    private getPlayerQueue;
    clearPlayerCommands(playerId: string): void;
    removePlayer(playerId: string): void;
    getPlayerQueueStatus(playerId: string): {
        size: number;
        commands: ProcessedCommand[];
    };
    getActivePlayers(): string[];
}
//# sourceMappingURL=CommandProcessor.d.ts.map