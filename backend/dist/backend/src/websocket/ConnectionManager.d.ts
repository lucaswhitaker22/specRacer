import type { Socket } from 'socket.io';
import type { ConnectionState } from '../../../shared/types/websocket.js';
export declare class ConnectionManager {
    private connections;
    private connectionStates;
    private playerToSocket;
    private raceParticipants;
    addConnection(socketId: string, socket: Socket): void;
    removeConnection(socketId: string): void;
    authenticateConnection(socketId: string, playerId: string): void;
    addPlayerToRace(socketId: string, raceId: string): void;
    removePlayerFromRace(socketId: string, raceId: string): void;
    getSocket(socketId: string): Socket | undefined;
    getSocketByPlayerId(playerId: string): Socket | undefined;
    getConnectionState(socketId: string): ConnectionState | undefined;
    getRaceParticipants(raceId: string): string[];
    isPlayerConnected(playerId: string): boolean;
    updatePing(socketId: string): void;
    getStats(): {
        totalConnections: number;
        authenticatedConnections: number;
    };
    getConnectedPlayerIds(): string[];
    cleanupStaleConnections(maxAge?: number): void;
}
//# sourceMappingURL=ConnectionManager.d.ts.map