// WebSocket event interfaces for real-time communication

import type { RaceState, RaceEvent } from './index';
import type { Command, CommandResult } from './commands';
import type { RaceResult } from './player';

export interface WebSocketEvents {
  // Client to Server events
  'race:command': Command;
  'race:join': { raceId: string; carId: string };
  'race:leave': { raceId: string };
  'player:authenticate': { token: string };
  
  // Server to Client events
  'race:update': RaceState;
  'race:state': RaceState;
  'race:event': RaceEvent;
  'race:started': { raceId: string };
  'race:completed': { raceId: string; result: RaceResult };
  'race:pitStop': { playerId: string; actions: any[]; duration: number };
  'race:command': { playerId: string; command: string; timestamp: number };
  'command:result': CommandResult;
  'error': ErrorMessage;
  'connection:authenticated': { playerId: string };
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