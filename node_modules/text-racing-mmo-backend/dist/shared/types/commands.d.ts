import type { ParticipantState } from './index';
export interface Command {
    type: CommandType;
    parameters?: CommandParameters;
    timestamp: number;
}
export type CommandType = 'accelerate' | 'brake' | 'shift' | 'pit';
export interface CommandParameters {
    intensity?: number;
    gear?: number;
    pitAction?: PitAction;
}
export interface PitAction {
    changeTires?: boolean;
    refuel?: boolean;
    fuelAmount?: number;
    tireType?: 'soft' | 'medium' | 'hard';
}
export interface CommandResult {
    success: boolean;
    message?: string;
    newState?: Partial<ParticipantState>;
}
export type { ParticipantState };
//# sourceMappingURL=commands.d.ts.map