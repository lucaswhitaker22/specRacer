import type { RaceState, RaceEvent } from './index';
import type { Command, CommandResult } from './commands';
import type { RaceResult } from './player';
export interface WebSocketEvents {
    'race:command': Command;
    'race:join': {
        raceId: string;
    };
    'race:leave': {
        raceId: string;
    };
    'player:authenticate': {
        token: string;
    };
    'race:update': RaceState;
    'race:event': RaceEvent;
    'race:complete': RaceResult;
    'command:result': CommandResult;
    'error': ErrorMessage;
    'connection:authenticated': {
        playerId: string;
    };
}
export interface ErrorMessage {
    message: string;
    code: string;
    timestamp: number;
}
export interface ConnectionState {
    isConnected: boolean;
    playerId?: string;
    currentRaceId?: string;
    lastPing: number;
}
//# sourceMappingURL=websocket.d.ts.map