import { RaceState, ParticipantState, RaceEvent, WeatherConditions, TrackConditions } from '../../../shared/types';
import { PhysicsEngine, RaceCommand, TrackConfiguration } from './PhysicsEngine';

export interface RaceConfiguration {
  raceId: string;
  trackId: string;
  totalLaps: number;
  maxParticipants: number;
  weather: WeatherConditions;
  trackConditions: TrackConditions;
}

/**
 * Manages race state and coordinates physics updates
 */
export class RaceStateManager {
  private raceState: RaceState;
  private isActive: boolean = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private commandQueue: Map<string, RaceCommand> = new Map();
  private track: TrackConfiguration;
  
  constructor(config: RaceConfiguration, track?: TrackConfiguration) {
    this.track = track || PhysicsEngine.getDefaultTrack();
    this.raceState = this.initializeRaceState(config);
  }

  /**
   * Initialize a new race state
   */
  private initializeRaceState(config: RaceConfiguration): RaceState {
    return {
      raceId: config.raceId,
      trackId: config.trackId,
      currentLap: 0,
      totalLaps: config.totalLaps,
      raceTime: 0,
      participants: [],
      raceEvents: [],
      weather: config.weather,
      trackConditions: config.trackConditions
    };
  }

  /**
   * Add a participant to the race
   */
  addParticipant(playerId: string, carId: string): boolean {
    if (this.isActive) {
      return false; // Cannot add participants to active race
    }

    if (this.raceState.participants.length >= 20) { // Max participants
      return false;
    }

    if (this.raceState.participants.some(p => p.playerId === playerId)) {
      return false; // Player already in race
    }

    const participant: ParticipantState = {
      playerId,
      carId,
      position: this.raceState.participants.length + 1,
      lapTime: 0,
      totalTime: 0,
      fuel: 100, // Start with full tank
      tireWear: {
        front: 0,
        rear: 0
      },
      speed: 0,
      location: {
        lap: 0,
        sector: 1,
        distance: 0
      },
      lastCommand: 'coast',
      commandTimestamp: 0
    };

    this.raceState.participants.push(participant);
    
    // Add race event
    const event: RaceEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.raceState.raceTime,
      type: 'race_start', // Will be updated when race actually starts
      description: `${playerId} joins the race`,
      involvedPlayers: [playerId]
    };
    
    this.raceState.raceEvents.push(event);
    return true;
  }

  /**
   * Remove a participant from the race
   */
  removeParticipant(playerId: string): boolean {
    const index = this.raceState.participants.findIndex(p => p.playerId === playerId);
    if (index === -1) {
      return false;
    }

    this.raceState.participants.splice(index, 1);
    
    // Update positions
    this.raceState.participants.forEach((participant, idx) => {
      participant.position = idx + 1;
    });

    // Add race event
    const event: RaceEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.raceState.raceTime,
      type: 'incident',
      description: `${playerId} leaves the race`,
      involvedPlayers: [playerId]
    };
    
    this.raceState.raceEvents.push(event);
    return true;
  }

  /**
   * Start the race
   */
  startRace(): boolean {
    if (this.isActive || this.raceState.participants.length === 0) {
      return false;
    }

    this.isActive = true;
    
    // Add race start event
    const startEvent: RaceEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.raceState.raceTime,
      type: 'race_start',
      description: `Race started with ${this.raceState.participants.length} participants`,
      involvedPlayers: this.raceState.participants.map(p => p.playerId)
    };
    
    this.raceState.raceEvents.push(startEvent);

    // Start physics tick loop
    this.tickInterval = setInterval(() => {
      this.processTick();
    }, PhysicsEngine.getTickDuration());

    return true;
  }

  /**
   * Stop the race
   */
  stopRace(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Add race finish event
    const finishEvent: RaceEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.raceState.raceTime,
      type: 'race_finish',
      description: 'Race finished',
      involvedPlayers: this.raceState.participants.map(p => p.playerId)
    };
    
    this.raceState.raceEvents.push(finishEvent);
  }

  /**
   * Queue a command for a participant
   */
  queueCommand(playerId: string, command: RaceCommand): boolean {
    if (!this.isActive) {
      return false;
    }

    if (!this.raceState.participants.some(p => p.playerId === playerId)) {
      return false;
    }

    this.commandQueue.set(playerId, command);
    return true;
  }

  /**
   * Process a single physics tick
   */
  private processTick(): void {
    if (!this.isActive) {
      return;
    }

    // Process physics update
    const { updatedState, events } = PhysicsEngine.processRaceTick(
      this.raceState,
      this.commandQueue,
      this.track
    );

    this.raceState = updatedState;
    
    // Clear command queue after processing
    this.commandQueue.clear();

    // Check for race completion
    this.checkRaceCompletion();

    // Emit events if needed (this would integrate with WebSocket in a real implementation)
    if (events.length > 0) {
      this.onRaceEvents(events);
    }
  }

  /**
   * Check if the race should be completed
   */
  private checkRaceCompletion(): void {
    // Check if any participant has completed all laps
    const raceWinner = this.raceState.participants.find(
      p => p.location.lap >= this.raceState.totalLaps
    );

    if (raceWinner) {
      this.stopRace();
    }

    // Also check for maximum race time (safety measure)
    const maxRaceTime = this.raceState.totalLaps * 300; // 5 minutes per lap maximum
    if (this.raceState.raceTime > maxRaceTime) {
      this.stopRace();
    }
  }

  /**
   * Handle race events (override in subclass or use callbacks)
   */
  protected onRaceEvents(events: RaceEvent[]): void {
    // Default implementation - can be overridden or use event emitters
    console.log('Race events:', events.map(e => e.description));
  }

  /**
   * Get current race state
   */
  getRaceState(): RaceState {
    return { ...this.raceState };
  }

  /**
   * Get race status
   */
  isRaceActive(): boolean {
    return this.isActive;
  }

  /**
   * Get participant count
   */
  getParticipantCount(): number {
    return this.raceState.participants.length;
  }

  /**
   * Get race progress (0-1)
   */
  getRaceProgress(): number {
    if (this.raceState.participants.length === 0) {
      return 0;
    }

    const leader = this.raceState.participants.reduce((leader, participant) => {
      if (participant.location.lap > leader.location.lap) {
        return participant;
      }
      if (participant.location.lap === leader.location.lap && 
          participant.location.distance > leader.location.distance) {
        return participant;
      }
      return leader;
    });

    const totalDistance = this.raceState.totalLaps * this.track.length;
    const leaderDistance = (leader.location.lap * this.track.length) + leader.location.distance;
    
    return Math.min(1, leaderDistance / totalDistance);
  }

  /**
   * Get track configuration
   */
  getTrack(): TrackConfiguration {
    return { ...this.track };
  }

  /**
   * Update weather conditions
   */
  updateWeather(weather: WeatherConditions): void {
    this.raceState.weather = weather;
    
    // Add weather change event
    const event: RaceEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.raceState.raceTime,
      type: 'incident',
      description: `Weather conditions changed`,
      involvedPlayers: [],
      data: { weather }
    };
    
    this.raceState.raceEvents.push(event);
  }

  /**
   * Update track conditions
   */
  updateTrackConditions(conditions: TrackConditions): void {
    this.raceState.trackConditions = conditions;
    
    // Add track condition change event
    const event: RaceEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.raceState.raceTime,
      type: 'incident',
      description: `Track conditions changed to ${conditions.surface}`,
      involvedPlayers: [],
      data: { trackConditions: conditions }
    };
    
    this.raceState.raceEvents.push(event);
  }
}