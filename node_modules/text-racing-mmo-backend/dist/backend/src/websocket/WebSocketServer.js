"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketServer = void 0;
const socket_io_1 = require("socket.io");
const ConnectionManager_1 = require("./ConnectionManager");
const EventHandler_1 = require("./EventHandler");
const ErrorLogger_1 = require("../utils/ErrorLogger");
const StateRecoveryService_1 = require("../services/StateRecoveryService");
class WebSocketServer {
    constructor(httpServer) {
        this.healthCheckInterval = null;
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:5173",
                methods: ["GET", "POST"]
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });
        this.connectionManager = new ConnectionManager_1.ConnectionManager();
        this.eventHandler = new EventHandler_1.EventHandler(this.connectionManager);
        this.logger = ErrorLogger_1.ErrorLogger.getInstance();
        this.stateRecovery = StateRecoveryService_1.StateRecoveryService.getInstance();
        this.setupEventHandlers();
        this.startHealthChecks();
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);
            this.connectionManager.addConnection(socket.id, socket);
            socket.on('player:authenticate', async (data) => {
                try {
                    await this.eventHandler.handleAuthentication(socket, data);
                }
                catch (error) {
                    this.logger.logError(error, {
                        socketId: socket.id,
                        operation: 'authentication'
                    });
                    this.sendError(socket, 'AUTH_FAILED', 'Authentication failed');
                }
            });
            socket.on('race:command', async (command) => {
                try {
                    await this.eventHandler.handleRaceCommand(socket, command);
                }
                catch (error) {
                    this.logger.logError(error, {
                        socketId: socket.id,
                        operation: 'race_command',
                        command: command?.type
                    });
                    if (error instanceof ErrorLogger_1.AppError && error.code === 'RACE_STATE_CORRUPTED') {
                        await this.handleRaceStateCorruption(command.raceId);
                    }
                    this.sendError(socket, 'COMMAND_FAILED', 'Failed to process command');
                }
            });
            socket.on('race:join', async (data) => {
                try {
                    await this.eventHandler.handleRaceJoin(socket, data);
                }
                catch (error) {
                    this.logger.logError(error, {
                        socketId: socket.id,
                        operation: 'race_join',
                        raceId: data?.raceId
                    });
                    this.sendError(socket, 'JOIN_FAILED', 'Failed to join race');
                }
            });
            socket.on('race:leave', async (data) => {
                try {
                    await this.eventHandler.handleRaceLeave(socket, data);
                }
                catch (error) {
                    this.logger.logError(error, {
                        socketId: socket.id,
                        operation: 'race_leave',
                        raceId: data?.raceId
                    });
                    this.sendError(socket, 'LEAVE_FAILED', 'Failed to leave race');
                }
            });
            socket.on('disconnect', (reason) => {
                console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
                this.eventHandler.handleDisconnection(socket, reason);
                this.connectionManager.removeConnection(socket.id);
            });
            socket.on('error', (error) => {
                console.error(`Socket error for ${socket.id}:`, error);
                this.sendError(socket, 'CONNECTION_ERROR', 'Connection error occurred');
            });
        });
    }
    broadcastRaceUpdate(raceId, raceState) {
        const participants = this.connectionManager.getRaceParticipants(raceId);
        participants.forEach(socketId => {
            const socket = this.connectionManager.getSocket(socketId);
            if (socket) {
                socket.emit('race:update', raceState);
            }
        });
    }
    broadcastRaceEvent(raceId, raceEvent) {
        const participants = this.connectionManager.getRaceParticipants(raceId);
        participants.forEach(socketId => {
            const socket = this.connectionManager.getSocket(socketId);
            if (socket) {
                socket.emit('race:event', raceEvent);
            }
        });
    }
    broadcastRaceComplete(raceId, raceResult) {
        const participants = this.connectionManager.getRaceParticipants(raceId);
        participants.forEach(socketId => {
            const socket = this.connectionManager.getSocket(socketId);
            if (socket) {
                socket.emit('race:complete', raceResult);
            }
        });
    }
    sendError(socket, code, message) {
        const errorMessage = {
            message,
            code,
            timestamp: Date.now()
        };
        socket.emit('error', errorMessage);
    }
    getConnectionStats() {
        return this.connectionManager.getStats();
    }
    async handleRaceStateCorruption(raceId) {
        try {
            this.logger.logWarning('Attempting race state recovery', 'STATE_RECOVERY_ATTEMPT', { raceId });
            const recovery = await this.stateRecovery.recoverRaceState(raceId);
            if (recovery.success) {
                const participants = this.connectionManager.getRaceParticipants(raceId);
                participants.forEach(socketId => {
                    const socket = this.connectionManager.getSocket(socketId);
                    if (socket) {
                        socket.emit('race:recovered', {
                            message: 'Race state has been recovered',
                            recoveredState: recovery.recoveredState || recovery.fallbackState
                        });
                    }
                });
            }
            else {
                const participants = this.connectionManager.getRaceParticipants(raceId);
                participants.forEach(socketId => {
                    const socket = this.connectionManager.getSocket(socketId);
                    if (socket) {
                        this.sendError(socket, 'RACE_RECOVERY_FAILED', 'Unable to recover race state');
                    }
                });
            }
        }
        catch (error) {
            this.logger.logError(error, {
                raceId,
                operation: 'state_recovery'
            });
        }
    }
    startHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000);
    }
    performHealthCheck() {
        try {
            const stats = this.getConnectionStats();
            this.logger.logInfo('WebSocket health check', 'HEALTH_CHECK', {
                totalConnections: stats.totalConnections,
                authenticatedConnections: stats.authenticatedConnections,
                timestamp: Date.now()
            });
            this.connectionManager.cleanupStaleConnections();
        }
        catch (error) {
            this.logger.logError(error, {
                operation: 'health_check'
            });
        }
    }
    async shutdown() {
        console.log('Shutting down WebSocket server...');
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.io.emit('error', {
            message: 'Server is shutting down',
            code: 'SERVER_SHUTDOWN',
            timestamp: Date.now()
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.io.close();
        console.log('WebSocket server shutdown complete');
    }
}
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=WebSocketServer.js.map