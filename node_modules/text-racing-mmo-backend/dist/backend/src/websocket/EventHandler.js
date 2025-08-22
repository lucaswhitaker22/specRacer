"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHandler = void 0;
const CommandProcessor_1 = require("../engine/CommandProcessor");
class EventHandler {
    constructor(connectionManager) {
        this.connectionManager = connectionManager;
        this.commandProcessor = new CommandProcessor_1.CommandProcessor();
    }
    async handleAuthentication(socket, data) {
        try {
            const playerId = this.extractPlayerIdFromToken(data.token);
            if (!playerId) {
                throw new Error('Invalid token');
            }
            this.connectionManager.authenticateConnection(socket.id, playerId);
            socket.emit('connection:authenticated', { playerId });
            console.log(`Player ${playerId} authenticated on socket ${socket.id}`);
        }
        catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }
    async handleRaceCommand(socket, command) {
        const connectionState = this.connectionManager.getConnectionState(socket.id);
        if (!connectionState?.playerId) {
            throw new Error('Player not authenticated');
        }
        if (!connectionState.currentRaceId) {
            throw new Error('Player not in a race');
        }
        try {
            const result = this.commandProcessor.processCommand({
                playerId: connectionState.playerId,
                commandText: `${command.type} ${command.parameters?.intensity || ''}`.trim(),
                timestamp: command.timestamp
            });
            const commandResult = {
                success: result.isValid,
                message: result.error || `Command ${command.type} processed successfully`
            };
            socket.emit('command:result', commandResult);
            console.log(`Processed ${command.type} command for player ${connectionState.playerId}`);
        }
        catch (error) {
            console.error('Command processing error:', error);
            const commandResult = {
                success: false,
                message: error instanceof Error ? error.message : 'Command processing failed'
            };
            socket.emit('command:result', commandResult);
        }
    }
    async handleRaceJoin(socket, data) {
        const connectionState = this.connectionManager.getConnectionState(socket.id);
        if (!connectionState?.playerId) {
            throw new Error('Player not authenticated');
        }
        try {
            this.connectionManager.addPlayerToRace(socket.id, data.raceId);
            console.log(`Player ${connectionState.playerId} joined race ${data.raceId}`);
        }
        catch (error) {
            console.error('Race join error:', error);
            throw error;
        }
    }
    async handleRaceLeave(socket, data) {
        const connectionState = this.connectionManager.getConnectionState(socket.id);
        if (!connectionState?.playerId) {
            throw new Error('Player not authenticated');
        }
        try {
            this.connectionManager.removePlayerFromRace(socket.id, data.raceId);
            console.log(`Player ${connectionState.playerId} left race ${data.raceId}`);
        }
        catch (error) {
            console.error('Race leave error:', error);
            throw error;
        }
    }
    handleDisconnection(socket, reason) {
        const connectionState = this.connectionManager.getConnectionState(socket.id);
        if (connectionState?.playerId) {
            console.log(`Player ${connectionState.playerId} disconnected: ${reason}`);
            if (connectionState.currentRaceId) {
                console.log(`Player was in race ${connectionState.currentRaceId}`);
            }
        }
    }
    extractPlayerIdFromToken(token) {
        try {
            if (token && token.length > 0) {
                return token;
            }
            return null;
        }
        catch (error) {
            console.error('Token extraction error:', error);
            return null;
        }
    }
}
exports.EventHandler = EventHandler;
//# sourceMappingURL=EventHandler.js.map