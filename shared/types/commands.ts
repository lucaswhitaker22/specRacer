// Command interfaces for player actions

export interface Command {
  type: CommandType;
  parameters?: CommandParameters;
  timestamp: number;
}

export type CommandType = 
  | 'accelerate'
  | 'brake'
  | 'shift'
  | 'pit';

export interface CommandParameters {
  intensity?: number; // 0-100 for accelerate/brake
  gear?: number; // for shift command
  pitAction?: PitAction; // for pit command
}

export interface PitAction {
  changeTires?: boolean;
  refuel?: boolean;
  fuelAmount?: number; // liters
  tireType?: 'soft' | 'medium' | 'hard';
}

export interface CommandResult {
  success: boolean;
  message?: string;
  newState?: Partial<ParticipantState>;
}

// Re-export ParticipantState for convenience
export type { ParticipantState } from './index.js';