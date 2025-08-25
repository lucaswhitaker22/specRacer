import { Server as HTTPServer } from 'http';
import type { RaceState, RaceEvent } from '../../../shared/types/index';
export declare class WebSocketServer {
    private io;
    private connectionManager;
    private eventHandler;
    private logger;
    private stateRecovery;
    private healthCheckInterval;
    constructor(httpServer: HTTPServer);
    private setupEventHandlers;
    broadcastRaceUpdate(raceId: string, raceState: RaceState): void;
    broadcastRaceEvent(raceId: string, raceEvent: RaceEvent): void;
    broadcastRaceComplete(raceId: string, raceResult: any): void;
    private sendError;
    getConnectionStats(): {
        totalConnections: number;
        authenticatedConnections: number;
    };
    private handleRaceStateCorruption;
    private startHealthChecks;
    private performHealthCheck;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=WebSocketServer.d.ts.map