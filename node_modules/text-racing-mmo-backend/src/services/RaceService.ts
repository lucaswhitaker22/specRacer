import { EventEmitter } from 'events';
import { RaceStateManager, RaceConfiguration } from '../engine/RaceStateManager';
import { CommandProcessor, CommandInput, ProcessedCommand } from '../engine/CommandProcessor';
import { PhysicsEngine, TrackConfiguration } from '../engine/PhysicsEngine';
import { getDatabaseConnection } from '../database/connection';
import { 
  RaceState, 
  ParticipantState, 
  RaceEvent, 
  WeatherConditions, 
  TrackConditions,
  CarModel 
} from '../../../shared/types';

export interface RaceResult {
  raceId: string;
  trackId: string;
  startTime: Date;
  endTime: Date;
  totalLaps: number;
  participants: RaceParticipantResult[];
  raceEvents: RaceEvent[];
  weather: WeatherConditions;
  trackConditions: TrackConditions;
}

export interface RaceParticipantResult {
  playerId: string;
  carId: string;
  finalPosition: number;
  finalTime: number; // milliseconds
  lapTimes: number[];
  bestLapTime: number;
  totalDistance: number;
  averageSpeed: number;
  fuelUsed: number;
  tireChanges: number;
  pitStops: PitStopRecord[];
}

export interface PitStopRecord {
  lap: number;
  timestamp: number;
  duration: number; // milliseconds
  actions: PitStopAction[];
}

export interface PitStopAction {
  type: 'tire_change' | 'refuel' | 'repair';
  details: any;
  timeCost: number; // milliseconds
}

export interface CreateRaceOptions {
  trackId: string;
  totalLaps: number;
  maxParticipants?: number;
  weather?: WeatherConditions;
  trackConditions?: TrackConditions;
}

export interface JoinRaceOptions {
  playerId: string;
  carId: string;
}

/**
 * Comprehensive race management service that orchestrates race lifecycle,
 * participant management, pit stops, and result calculation
 */
export class RaceService extends EventEmitter {
  private activeRaces = new Map<string, RaceStateManager>();
  private raceConfigurations = new Map<string, RaceConfiguration>();
  private commandProcessors = new Map<string, CommandProcessor>();
  private pitStopStates = new Map<string, Map<string, PitStopState>>(); // raceId -> playerId -> pitStopState
  private raceResults = new Map<string, RaceResult>();
  private trackConfigurations = new Map<string, TrackConfiguration>();

  constructor() {
    super();
    this.initializeDefaultTrack();
  }

  /**
   * Initialize default track configuration
   */
  private initializeDefaultTrack(): void {
    const defaultTrack = PhysicsEngine.getDefaultTrack();
    this.trackConfigurations.set(defaultTrack.id, defaultTrack);
  }

  /**
   * Create a new race
   */
  async createRace(options: CreateRaceOptions): Promise<string> {
    const raceId = this.generateRaceId();
    
    // Get track configuration
    const track = this.trackConfigurations.get(options.trackId);
    if (!track) {
      throw new Error(`Track not found: ${options.trackId}`);
    }

    // Create race configuration
    const raceConfig: RaceConfiguration = {
      raceId,
      trackId: options.trackId,
      totalLaps: options.totalLaps,
      maxParticipants: options.maxParticipants || 20,
      weather: options.weather || this.getDefaultWeather(),
      trackConditions: options.trackConditions || this.getDefaultTrackConditions()
    };

    // Create race state manager
    const raceManager = new RaceStateManager(raceConfig, track);
    
    // Create command processor for this race
    const commandProcessor = new CommandProcessor();

    // Store race components
    this.activeRaces.set(raceId, raceManager);
    this.raceConfigurations.set(raceId, raceConfig);
    this.commandProcessors.set(raceId, commandProcessor);
    this.pitStopStates.set(raceId, new Map());

    // Persist race to database
    await this.persistRaceCreation(raceConfig);

    this.emit('raceCreated', { raceId, config: raceConfig });
    
    return raceId;
  }

  /**
   * Join a race as a participant
   */
  async joinRace(raceId: string, options: JoinRaceOptions): Promise<boolean> {
    const raceManager = this.activeRaces.get(raceId);
    if (!raceManager) {
      throw new Error(`Race not found: ${raceId}`);
    }

    if (raceManager.isRaceActive()) {
      throw new Error('Cannot join race that has already started');
    }

    // Validate car exists and is available
    await this.validateCarSelection(options.carId);

    // Add participant to race
    const success = raceManager.addParticipant(options.playerId, options.carId);
    if (!success) {
      return false;
    }

    // Persist participant to database
    await this.persistRaceParticipant(raceId, options.playerId, options.carId);

    this.emit('playerJoined', { raceId, playerId: options.playerId, carId: options.carId });
    
    return true;
  }

  /**
   * Leave a race
   */
  async leaveRace(raceId: string, playerId: string): Promise<boolean> {
    const raceManager = this.activeRaces.get(raceId);
    if (!raceManager) {
      throw new Error(`Race not found: ${raceId}`);
    }

    const success = raceManager.removeParticipant(playerId);
    if (success) {
      // Clean up command processor
      const commandProcessor = this.commandProcessors.get(raceId);
      if (commandProcessor) {
        commandProcessor.removePlayer(playerId);
      }

      // Clean up pit stop state
      const pitStops = this.pitStopStates.get(raceId);
      if (pitStops) {
        pitStops.delete(playerId);
      }

      this.emit('playerLeft', { raceId, playerId });
    }

    return success;
  }

  /**
   * Start a race
   */
  async startRace(raceId: string): Promise<boolean> {
    const raceManager = this.activeRaces.get(raceId);
    if (!raceManager) {
      throw new Error(`Race not found: ${raceId}`);
    }

    const success = raceManager.startRace();
    if (success) {
      // Update database
      await this.updateRaceStatus(raceId, 'active', new Date());
      
      this.emit('raceStarted', { raceId });
    }

    return success;
  }

  /**
   * Process a player command
   */
  async processPlayerCommand(raceId: string, playerId: string, commandText: string): Promise<ProcessedCommand> {
    const commandProcessor = this.commandProcessors.get(raceId);
    if (!commandProcessor) {
      throw new Error(`Race not found: ${raceId}`);
    }

    const raceManager = this.activeRaces.get(raceId);
    if (!raceManager || !raceManager.isRaceActive()) {
      throw new Error('Race is not active');
    }

    const commandInput: CommandInput = {
      playerId,
      commandText,
      timestamp: Date.now()
    };

    const processedCommand = commandProcessor.processCommand(commandInput);

    // Handle pit stop commands specially
    if (processedCommand.isValid && processedCommand.command.type === 'pit') {
      await this.handlePitStopCommand(raceId, playerId);
    }

    // Queue command in race manager if valid
    if (processedCommand.isValid) {
      raceManager.queueCommand(playerId, processedCommand.command);
    }

    this.emit('commandProcessed', { raceId, playerId, command: processedCommand });

    return processedCommand;
  }

  /**
   * Get current race state
   */
  getRaceState(raceId: string): RaceState | null {
    const raceManager = this.activeRaces.get(raceId);
    return raceManager ? raceManager.getRaceState() : null;
  }

  /**
   * Get race result (for completed races)
   */
  getRaceResult(raceId: string): RaceResult | null {
    return this.raceResults.get(raceId) || null;
  }

  /**
   * Get list of active races
   */
  getActiveRaces(): string[] {
    return Array.from(this.activeRaces.keys());
  }

  /**
   * Handle pit stop command
   */
  private async handlePitStopCommand(raceId: string, playerId: string): Promise<void> {
    const raceManager = this.activeRaces.get(raceId);
    if (!raceManager) return;

    const raceState = raceManager.getRaceState();
    const participant = raceState.participants.find(p => p.playerId === playerId);
    if (!participant) return;

    // Initialize pit stop state
    const pitStopState: PitStopState = {
      playerId,
      isInPit: true,
      startTime: Date.now(),
      actions: [],
      totalDuration: 0
    };

    // Determine pit stop actions based on car condition
    const actions = this.determinePitStopActions(participant);
    pitStopState.actions = actions;

    // Calculate total pit stop duration
    pitStopState.totalDuration = actions.reduce((total, action) => total + action.timeCost, 0);

    // Store pit stop state
    let racePitStops = this.pitStopStates.get(raceId);
    if (!racePitStops) {
      racePitStops = new Map();
      this.pitStopStates.set(raceId, racePitStops);
    }
    racePitStops.set(playerId, pitStopState);

    // Apply pit stop effects (tire change, refuel, etc.)
    this.applyPitStopEffects(participant, actions);

    this.emit('pitStopStarted', { raceId, playerId, actions, duration: pitStopState.totalDuration });
  }

  /**
   * Determine what actions should be performed during pit stop
   */
  private determinePitStopActions(participant: ParticipantState): PitStopAction[] {
    const actions: PitStopAction[] = [];

    // Always refuel to full
    if (participant.fuel < 100) {
      actions.push({
        type: 'refuel',
        details: { fromFuel: participant.fuel, toFuel: 100 },
        timeCost: 3000 + (100 - participant.fuel) * 50 // Base 3s + 50ms per % fuel
      });
    }

    // Change tires if worn
    const maxTireWear = Math.max(participant.tireWear.front, participant.tireWear.rear);
    if (maxTireWear > 30) { // Change tires if more than 30% worn
      actions.push({
        type: 'tire_change',
        details: { 
          frontWear: participant.tireWear.front, 
          rearWear: participant.tireWear.rear 
        },
        timeCost: 2500 // 2.5 seconds for tire change
      });
    }

    return actions;
  }

  /**
   * Apply pit stop effects to participant
   */
  private applyPitStopEffects(participant: ParticipantState, actions: PitStopAction[]): void {
    for (const action of actions) {
      switch (action.type) {
        case 'refuel':
          participant.fuel = 100;
          break;
        case 'tire_change':
          participant.tireWear.front = 0;
          participant.tireWear.rear = 0;
          break;
      }
    }
  }

  /**
   * Calculate and persist race results when race completes
   */
  private async calculateRaceResults(raceId: string): Promise<RaceResult> {
    const raceManager = this.activeRaces.get(raceId);
    const raceConfig = this.raceConfigurations.get(raceId);
    
    if (!raceManager || !raceConfig) {
      throw new Error(`Race data not found: ${raceId}`);
    }

    const raceState = raceManager.getRaceState();
    const track = raceManager.getTrack();

    // Calculate participant results
    const participantResults: RaceParticipantResult[] = raceState.participants.map(participant => {
      const pitStops = this.getPitStopsForPlayer(raceId, participant.playerId);
      
      return {
        playerId: participant.playerId,
        carId: participant.carId,
        finalPosition: participant.position,
        finalTime: participant.totalTime * 1000, // Convert to milliseconds
        lapTimes: [], // Would need to track lap times during race
        bestLapTime: participant.lapTime * 1000,
        totalDistance: (participant.location.lap * track.length) + participant.location.distance,
        averageSpeed: this.calculateAverageSpeed(participant, raceState.raceTime),
        fuelUsed: 100 - participant.fuel,
        tireChanges: pitStops.filter(ps => ps.actions.some(a => a.type === 'tire_change')).length,
        pitStops
      };
    });

    const result: RaceResult = {
      raceId,
      trackId: raceConfig.trackId,
      startTime: new Date(Date.now() - (raceState.raceTime * 1000)),
      endTime: new Date(),
      totalLaps: raceConfig.totalLaps,
      participants: participantResults,
      raceEvents: raceState.raceEvents,
      weather: raceState.weather,
      trackConditions: raceState.trackConditions
    };

    // Persist results to database
    await this.persistRaceResults(result);

    // Update player statistics
    await this.updatePlayerStatistics(participantResults);

    // Store result in memory
    this.raceResults.set(raceId, result);

    return result;
  }

  /**
   * Clean up race when it completes
   */
  private async cleanupRace(raceId: string): Promise<void> {
    // Calculate and store results
    await this.calculateRaceResults(raceId);

    // Clean up memory
    this.activeRaces.delete(raceId);
    this.raceConfigurations.delete(raceId);
    this.commandProcessors.delete(raceId);
    this.pitStopStates.delete(raceId);

    // Update database status
    await this.updateRaceStatus(raceId, 'completed', undefined, new Date());

    this.emit('raceCompleted', { raceId });
  }

  // Helper methods for database operations
  private async persistRaceCreation(config: RaceConfiguration): Promise<void> {
    const db = getDatabaseConnection();
    await db.query(
      `INSERT INTO races (id, track_id, total_laps, race_data, status) 
       VALUES ($1, $2, $3, $4, $5)`,
      [config.raceId, config.trackId, config.totalLaps, JSON.stringify(config), 'waiting']
    );
  }

  private async persistRaceParticipant(raceId: string, playerId: string, carId: string): Promise<void> {
    const db = getDatabaseConnection();
    await db.query(
      `INSERT INTO race_participants (race_id, player_id, car_id) 
       VALUES ($1, $2, $3)`,
      [raceId, playerId, carId]
    );
  }

  private async updateRaceStatus(raceId: string, status: string, startTime?: Date, endTime?: Date): Promise<void> {
    const db = getDatabaseConnection();
    const updates = ['status = $2'];
    const params: any[] = [raceId, status];
    
    if (startTime) {
      updates.push('start_time = $3');
      params.push(startTime);
    }
    
    if (endTime) {
      updates.push('end_time = $' + (params.length + 1));
      params.push(endTime);
    }

    await db.query(
      `UPDATE races SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      params
    );
  }

  private async persistRaceResults(result: RaceResult): Promise<void> {
    const db = getDatabaseConnection();
    
    await db.transaction(async (client) => {
      // Update race with results
      await client.query(
        `UPDATE races SET results = $2, end_time = $3 WHERE id = $1`,
        [result.raceId, JSON.stringify(result), result.endTime]
      );

      // Update participant results
      for (const participant of result.participants) {
        await client.query(
          `UPDATE race_participants 
           SET final_position = $3, final_time = $4, race_events = $5 
           WHERE race_id = $1 AND player_id = $2`,
          [
            result.raceId, 
            participant.playerId, 
            participant.finalPosition, 
            participant.finalTime,
            JSON.stringify(participant.pitStops)
          ]
        );
      }
    });
  }

  private async updatePlayerStatistics(participants: RaceParticipantResult[]): Promise<void> {
    const db = getDatabaseConnection();
    
    for (const participant of participants) {
      const isWin = participant.finalPosition === 1;
      await db.query(
        `UPDATE players 
         SET total_races = total_races + 1, 
             wins = wins + $2,
             league_points = league_points + $3
         WHERE id = $1`,
        [
          participant.playerId, 
          isWin ? 1 : 0,
          this.calculateLeaguePoints(participant.finalPosition, participants.length)
        ]
      );
    }
  }

  // Helper methods
  private generateRaceId(): string {
    return `race_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async validateCarSelection(carId: string): Promise<void> {
    const db = getDatabaseConnection();
    const result = await db.query(
      'SELECT id FROM cars WHERE id = $1 AND is_active = true',
      [carId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Car not found or not available: ${carId}`);
    }
  }

  private getDefaultWeather(): WeatherConditions {
    return {
      temperature: 22,
      humidity: 60,
      windSpeed: 10,
      precipitation: 0,
      visibility: 10000
    };
  }

  private getDefaultTrackConditions(): TrackConditions {
    return {
      surface: 'dry',
      grip: 1.0,
      temperature: 25
    };
  }

  private getPitStopsForPlayer(raceId: string, playerId: string): PitStopRecord[] {
    const racePitStops = this.pitStopStates.get(raceId);
    const playerPitStop = racePitStops?.get(playerId);
    
    if (!playerPitStop) return [];
    
    return [{
      lap: 0, // Would need to track current lap during pit stop
      timestamp: playerPitStop.startTime,
      duration: playerPitStop.totalDuration,
      actions: playerPitStop.actions
    }];
  }

  private calculateAverageSpeed(participant: ParticipantState, raceTime: number): number {
    const totalDistance = participant.location.distance / 1000; // Convert to km
    const timeInHours = raceTime / 3600; // Convert to hours
    return timeInHours > 0 ? totalDistance / timeInHours : 0;
  }

  private calculateLeaguePoints(position: number, totalParticipants: number): number {
    // Points system: 1st = 25, 2nd = 18, 3rd = 15, etc.
    const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    return position <= pointsTable.length ? pointsTable[position - 1] : 0;
  }
}

interface PitStopState {
  playerId: string;
  isInPit: boolean;
  startTime: number;
  actions: PitStopAction[];
  totalDuration: number;
}