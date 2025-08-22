// WebSocket event interfaces for real-time communication

import type { RaceState, RaceEvent } from './index.js';
import type { Command, CommandResult } from './commands.js';
import type { RaceResult } from './player.js';

export interface WebSocketEvents {
  // Client to Server events
  'race:command': Command;
  'race:join': { raceId: string };
  'race:leave': { raceId: string };
  'player:authenticate': { token: string };
  
  // Server to Client events
  'race:update': RaceState;
  'race:event': RaceEvent;
  'race:complete': RaceResult;
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