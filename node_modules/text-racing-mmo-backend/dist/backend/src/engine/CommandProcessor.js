"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandProcessor = exports.CommandQueue = exports.CommandParser = void 0;
class CommandParser {
    static parseCommand(commandText) {
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
        const parts = trimmed.split(/\s+/);
        const baseCommand = parts[0];
        const resolvedCommand = this.COMMAND_ALIASES.get(baseCommand) || baseCommand;
        if (!this.VALID_COMMANDS.includes(resolvedCommand)) {
            return {
                isValid: false,
                error: `Unknown command: ${baseCommand}. Valid commands: ${this.VALID_COMMANDS.join(', ')}`
            };
        }
        try {
            const command = this.parseCommandParameters(resolvedCommand, parts.slice(1));
            return {
                isValid: true,
                command
            };
        }
        catch (error) {
            return {
                isValid: false,
                error: error instanceof Error ? error.message : 'Invalid command parameters'
            };
        }
    }
    static parseCommandParameters(commandType, params) {
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
    static parseAccelerateCommand(params) {
        if (params.length === 0) {
            return { type: 'accelerate', intensity: 1.0 };
        }
        const intensityParam = params[0];
        if (intensityParam.endsWith('%')) {
            const percentage = parseFloat(intensityParam.slice(0, -1));
            if (isNaN(percentage) || percentage < 0 || percentage > 100) {
                throw new Error('Accelerate intensity must be between 0% and 100%');
            }
            return { type: 'accelerate', intensity: percentage / 100 };
        }
        const intensity = parseFloat(intensityParam);
        if (isNaN(intensity) || intensity < 0 || intensity > 1) {
            throw new Error('Accelerate intensity must be between 0 and 1, or 0% and 100%');
        }
        return { type: 'accelerate', intensity };
    }
    static parseBrakeCommand(params) {
        if (params.length === 0) {
            return { type: 'brake', intensity: 1.0 };
        }
        const intensityParam = params[0];
        if (intensityParam.endsWith('%')) {
            const percentage = parseFloat(intensityParam.slice(0, -1));
            if (isNaN(percentage) || percentage < 0 || percentage > 100) {
                throw new Error('Brake intensity must be between 0% and 100%');
            }
            return { type: 'brake', intensity: percentage / 100 };
        }
        const intensity = parseFloat(intensityParam);
        if (isNaN(intensity) || intensity < 0 || intensity > 1) {
            throw new Error('Brake intensity must be between 0 and 1, or 0% and 100%');
        }
        return { type: 'brake', intensity };
    }
    static parseShiftCommand(params) {
        if (params.length === 0) {
            throw new Error('Shift command requires a gear number (e.g., "shift 3")');
        }
        const gearParam = params[0];
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
    static parsePitCommand(params) {
        return { type: 'pit' };
    }
    static getValidCommands() {
        return [...this.VALID_COMMANDS];
    }
    static getCommandAliases() {
        return new Map(this.COMMAND_ALIASES);
    }
}
exports.CommandParser = CommandParser;
CommandParser.VALID_COMMANDS = ['accelerate', 'brake', 'coast', 'shift', 'pit'];
CommandParser.COMMAND_ALIASES = new Map([
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
class CommandQueue {
    constructor(maxQueueSize = 10, maxCommandsPerSecond = 5) {
        this.queue = [];
        this.commandTimestamps = [];
        this.maxQueueSize = maxQueueSize;
        this.maxCommandsPerSecond = maxCommandsPerSecond;
    }
    enqueue(command) {
        const now = Date.now();
        this.commandTimestamps = this.commandTimestamps.filter(ts => now - ts < 1000);
        if (this.commandTimestamps.length >= this.maxCommandsPerSecond) {
            return {
                success: false,
                error: `Rate limit exceeded. Maximum ${this.maxCommandsPerSecond} commands per second.`
            };
        }
        if (this.queue.length >= this.maxQueueSize) {
            this.queue.shift();
        }
        this.queue.push(command);
        this.commandTimestamps.push(now);
        return { success: true };
    }
    dequeue() {
        return this.queue.shift() || null;
    }
    peek() {
        return this.queue[0] || null;
    }
    size() {
        return this.queue.length;
    }
    clear() {
        this.queue = [];
        this.commandTimestamps = [];
    }
    getAll() {
        return [...this.queue];
    }
}
exports.CommandQueue = CommandQueue;
class CommandProcessor {
    constructor(defaultQueueSize = 10, defaultRateLimit = 5) {
        this.playerQueues = new Map();
        this.defaultQueueSize = defaultQueueSize;
        this.defaultRateLimit = defaultRateLimit;
    }
    processCommand(input) {
        const parseResult = CommandParser.parseCommand(input.commandText);
        const processedCommand = {
            playerId: input.playerId,
            timestamp: input.timestamp,
            isValid: parseResult.isValid,
            command: parseResult.command || { type: 'coast' },
            error: parseResult.error
        };
        if (processedCommand.isValid) {
            const queue = this.getPlayerQueue(input.playerId);
            const enqueueResult = queue.enqueue(processedCommand);
            if (!enqueueResult.success) {
                processedCommand.isValid = false;
                processedCommand.error = enqueueResult.error;
            }
        }
        return processedCommand;
    }
    getNextCommand(playerId) {
        const queue = this.playerQueues.get(playerId);
        if (!queue) {
            return null;
        }
        const processedCommand = queue.dequeue();
        return processedCommand?.command || null;
    }
    getPlayerQueue(playerId) {
        let queue = this.playerQueues.get(playerId);
        if (!queue) {
            queue = new CommandQueue(this.defaultQueueSize, this.defaultRateLimit);
            this.playerQueues.set(playerId, queue);
        }
        return queue;
    }
    clearPlayerCommands(playerId) {
        const queue = this.playerQueues.get(playerId);
        if (queue) {
            queue.clear();
        }
    }
    removePlayer(playerId) {
        this.playerQueues.delete(playerId);
    }
    getPlayerQueueStatus(playerId) {
        const queue = this.playerQueues.get(playerId);
        if (!queue) {
            return { size: 0, commands: [] };
        }
        return {
            size: queue.size(),
            commands: queue.getAll()
        };
    }
    getActivePlayers() {
        return Array.from(this.playerQueues.keys());
    }
}
exports.CommandProcessor = CommandProcessor;
//# sourceMappingURL=CommandProcessor.js.map