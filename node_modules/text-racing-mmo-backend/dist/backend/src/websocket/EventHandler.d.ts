import type { Socket } from 'socket.io';
import type { Command } from '../../../shared/types/commands';
import { ConnectionManager } from './ConnectionManager';
export declare class EventHandler {
    private connectionManager;
    private commandProcessor;
    constructor(connectionManager: ConnectionManager);
    handleAuthentication(socket: Socket, data: {
        token: string;
    }): Promise<void>;
    handleRaceCommand(socket: Socket, command: Command): Promise<void>;
    handleRaceJoin(socket: Socket, data: {
        raceId: string;
    }): Promise<void>;
    handleRaceLeave(socket: Socket, data: {
        raceId: string;
    }): Promise<void>;
    handleDisconnection(socket: Socket, reason: string): void;
    private extractPlayerIdFromToken;
}
//# sourceMappingURL=EventHandler.d.ts.map