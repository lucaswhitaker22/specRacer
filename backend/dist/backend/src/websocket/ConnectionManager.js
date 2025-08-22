"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.connectionStates = new Map();
        this.playerToSocket = new Map();
        this.raceParticipants = new Map();
    }
    addConnection(socketId, socket) {
        this.connections.set(socketId, socket);
        this.connectionStates.set(socketId, {
            isConnected: true,
            lastPing: Date.now()
        });
    }
    removeConnection(socketId) {
        const connectionState = this.connectionStates.get(socketId);
        if (connectionState?.playerId) {
            this.playerToSocket.delete(connectionState.playerId);
            this.raceParticipants.forEach((participants, raceId) => {
                if (participants.has(socketId)) {
                    participants.delete(socketId);
                    if (participants.size === 0) {
                        this.raceParticipants.delete(raceId);
                    }
                }
            });
        }
        this.connections.delete(socketId);
        this.connectionStates.delete(socketId);
    }
    authenticateConnection(socketId, playerId) {
        const connectionState = this.connectionStates.get(socketId);
        if (connectionState) {
            const oldSocketId = this.playerToSocket.get(playerId);
            if (oldSocketId && oldSocketId !== socketId) {
                this.removeConnection(oldSocketId);
            }
            connectionState.playerId = playerId;
            this.playerToSocket.set(playerId, socketId);
            this.connectionStates.set(socketId, connectionState);
        }
    }
    addPlayerToRace(socketId, raceId) {
        const connectionState = this.connectionStates.get(socketId);
        if (connectionState) {
            connectionState.currentRaceId = raceId;
            if (!this.raceParticipants.has(raceId)) {
                this.raceParticipants.set(raceId, new Set());
            }
            this.raceParticipants.get(raceId).add(socketId);
        }
    }
    removePlayerFromRace(socketId, raceId) {
        const connectionState = this.connectionStates.get(socketId);
        if (connectionState && connectionState.currentRaceId === raceId) {
            connectionState.currentRaceId = undefined;
        }
        const participants = this.raceParticipants.get(raceId);
        if (participants) {
            participants.delete(socketId);
            if (participants.size === 0) {
                this.raceParticipants.delete(raceId);
            }
        }
    }
    getSocket(socketId) {
        return this.connections.get(socketId);
    }
    getSocketByPlayerId(playerId) {
        const socketId = this.playerToSocket.get(playerId);
        return socketId ? this.connections.get(socketId) : undefined;
    }
    getConnectionState(socketId) {
        return this.connectionStates.get(socketId);
    }
    getRaceParticipants(raceId) {
        const participants = this.raceParticipants.get(raceId);
        return participants ? Array.from(participants) : [];
    }
    isPlayerConnected(playerId) {
        const socketId = this.playerToSocket.get(playerId);
        return socketId ? this.connections.has(socketId) : false;
    }
    updatePing(socketId) {
        const connectionState = this.connectionStates.get(socketId);
        if (connectionState) {
            connectionState.lastPing = Date.now();
        }
    }
    getStats() {
        const totalConnections = this.connections.size;
        const authenticatedConnections = Array.from(this.connectionStates.values())
            .filter(state => state.playerId).length;
        return { totalConnections, authenticatedConnections };
    }
    getConnectedPlayerIds() {
        return Array.from(this.connectionStates.values())
            .filter(state => state.playerId)
            .map(state => state.playerId);
    }
    cleanupStaleConnections(maxAge = 120000) {
        const now = Date.now();
        const staleConnections = [];
        this.connectionStates.forEach((state, socketId) => {
            if (now - state.lastPing > maxAge) {
                staleConnections.push(socketId);
            }
        });
        staleConnections.forEach(socketId => {
            console.log(`Cleaning up stale connection: ${socketId}`);
            const socket = this.connections.get(socketId);
            if (socket) {
                socket.disconnect(true);
            }
            this.removeConnection(socketId);
        });
    }
}
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=ConnectionManager.js.map