import { CarModel, RaceState, ParticipantState, RaceEvent, RaceEventType, TrackPosition, TireWear } from '../../../shared/types';
import { CarService } from '../services/CarService';

export interface PhysicsUpdate {
  participantId: string;
  newState: ParticipantState;
  events: RaceEvent[];
}

export interface RaceCommand {
  type: 'accelerate' | 'brake' | 'coast' | 'shift' | 'pit';
  intensity?: number; // 0-1 for accelerate/brake intensity
  gear?: number; // for shift command
}

export interface TrackConfiguration {
  id: string;
  name: string;
  length: number; // meters per lap
  sectors: number;
  corners: number;
  elevation: number; // meters of elevation change
  surface: 'asphalt' | 'concrete';
  difficulty: number; // 0-1 scale
}

/**
 * Core physics simulation engine for race calculations
 */
export class PhysicsEngine {
  private static readonly TICK_RATE = 10; // Updates per second
  private static readonly TICK_DURATION = 1000 / PhysicsEngine.TICK_RATE; // milliseconds
  
  // Default track configuration
  private static readonly DEFAULT_TRACK: TrackConfiguration = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Silverstone Grand Prix Circuit',
    length: 5891, // meters
    sectors: 3,
    corners: 18,
    elevation: 15, // meters
    surface: 'asphalt',
    difficulty: 0.7
  };

  /**
   * Process a single physics tick for all race participants
   */
  static processRaceTick(
    raceState: RaceState, 
    commands: Map<string, RaceCommand>,
    track: TrackConfiguration = PhysicsEngine.DEFAULT_TRACK
  ): { updatedState: RaceState; events: RaceEvent[] } {
    const allEvents: RaceEvent[] = [];
    const updatedParticipants: ParticipantState[] = [];

    // Process each participant
    for (const participant of raceState.participants) {
      const car = CarService.getCarById(participant.carId);
      const command = commands.get(participant.playerId) || { type: 'coast' };
      const update = this.updateParticipant(participant, car, command, track, raceState.raceTime);
      
      updatedParticipants.push(update.newState);
      allEvents.push(...update.events);
    }

    // Sort participants by position
    updatedParticipants.sort((a, b) => {
      if (a.location.lap !== b.location.lap) {
        return b.location.lap - a.location.lap; // Higher lap = better position
      }
      return b.location.distance - a.location.distance; // Further distance = better position
    });

    // Update positions
    updatedParticipants.forEach((participant, index) => {
      participant.position = index + 1;
    });

    // Check for overtakes
    const overtakeEvents = this.detectOvertakes(raceState.participants, updatedParticipants, raceState.raceTime);
    allEvents.push(...overtakeEvents);

    // Check for lap completions
    const lapEvents = this.detectLapCompletions(updatedParticipants, track, raceState.raceTime);
    allEvents.push(...lapEvents);

    const updatedState: RaceState = {
      ...raceState,
      raceTime: raceState.raceTime + (PhysicsEngine.TICK_DURATION / 1000),
      participants: updatedParticipants,
      raceEvents: [...raceState.raceEvents, ...allEvents]
    };

    return { updatedState, events: allEvents };
  }

  /**
   * Update a single participant's state based on their command
   */
  private static updateParticipant(
    participant: ParticipantState,
    car: CarModel | null,
    command: RaceCommand,
    track: TrackConfiguration,
    raceTime: number
  ): PhysicsUpdate {
    const events: RaceEvent[] = [];
    const deltaTime = PhysicsEngine.TICK_DURATION / 1000; // Convert to seconds

    // If car is null, return unchanged participant
    if (!car) {
      return { participantId: participant.playerId, newState: { ...participant }, events };
    }

    // Calculate throttle and brake inputs
    const { throttle, brake } = this.processCommand(command);
    
    // Calculate acceleration/deceleration
    let acceleration = 0;
    if (throttle > 0) {
      acceleration = CarService.calculateAcceleration(car, participant.speed) * throttle;
    } else if (brake > 0) {
      acceleration = -CarService.calculateBrakingDeceleration(car, participant.speed) * brake;
    } else {
      // Coasting - apply drag deceleration
      acceleration = this.calculateDragDeceleration(car, participant.speed);
    }

    // Update speed
    const newSpeed = Math.max(0, participant.speed + (acceleration * deltaTime * 3.6)); // Convert m/s² to km/h
    const topSpeed = CarService.calculateTopSpeed(car);
    const clampedSpeed = Math.min(newSpeed, topSpeed);

    // Calculate distance traveled this tick
    const averageSpeed = (participant.speed + clampedSpeed) / 2;
    const distanceTraveled = (averageSpeed / 3.6) * deltaTime; // Convert km/h to m/s

    // Update position
    const newDistance = participant.location.distance + distanceTraveled;
    const newLap = participant.location.lap + Math.floor(newDistance / track.length);
    const adjustedDistance = newDistance % track.length;

    // Calculate fuel consumption
    const fuelConsumed = CarService.calculateFuelConsumption(car, averageSpeed, throttle) * (deltaTime / 3600); // Convert L/h to L/tick
    const newFuel = Math.max(0, participant.fuel - (fuelConsumed * 100 / 60)); // Assuming 60L tank capacity, convert to percentage

    // Calculate tire wear
    const lateralG = this.calculateLateralG(clampedSpeed, track);
    const brakingG = brake * CarService.calculateBrakingDeceleration(car, participant.speed) / 9.81;
    const tireWearRate = CarService.calculateTireWearRate(car, averageSpeed, lateralG, brakingG);
    const wearThisTick = tireWearRate * (deltaTime / 3600); // Convert %/h to %/tick

    const newTireWear: TireWear = {
      front: Math.min(100, participant.tireWear.front + wearThisTick * 1.2), // Front tires wear faster
      rear: Math.min(100, participant.tireWear.rear + wearThisTick)
    };

    // Check for critical conditions
    if (newFuel <= 5 && participant.fuel > 5) {
      events.push(this.createRaceEvent('incident', `${participant.playerId} is running low on fuel!`, [participant.playerId], raceTime));
    }

    if (newTireWear.front > 80 && participant.tireWear.front <= 80) {
      events.push(this.createRaceEvent('incident', `${participant.playerId}'s front tires are heavily worn`, [participant.playerId], raceTime));
    }

    const newState: ParticipantState = {
      ...participant,
      speed: clampedSpeed,
      location: {
        lap: newLap,
        sector: Math.floor((adjustedDistance / track.length) * track.sectors) + 1,
        distance: adjustedDistance
      },
      fuel: newFuel,
      tireWear: newTireWear,
      lastCommand: command.type,
      commandTimestamp: raceTime
    };

    return { participantId: participant.playerId, newState, events };
  }

  /**
   * Process race command into throttle and brake inputs
   */
  private static processCommand(command: RaceCommand): { throttle: number; brake: number } {
    switch (command.type) {
      case 'accelerate':
        return { throttle: command.intensity || 1.0, brake: 0 };
      case 'brake':
        return { throttle: 0, brake: command.intensity || 1.0 };
      case 'coast':
        return { throttle: 0, brake: 0 };
      case 'shift':
        // For now, treat shift as coast (gear management can be added later)
        return { throttle: 0, brake: 0 };
      case 'pit':
        // Pit stops will be handled separately
        return { throttle: 0, brake: 0.5 }; // Light braking for pit entry
      default:
        return { throttle: 0, brake: 0 };
    }
  }

  /**
   * Calculate drag-induced deceleration when coasting
   */
  private static calculateDragDeceleration(car: CarModel, currentSpeed: number): number {
    const specs = car.specifications;
    const speedMs = currentSpeed / 3.6;
    
    // Drag force: F = 0.5 * ρ * Cd * A * v²
    const dragForce = 0.5 * 1.225 * specs.dragCoefficient * specs.frontalArea * Math.pow(speedMs, 2);
    
    // Rolling resistance (approximately 1% of weight)
    const rollingResistance = specs.weight * 9.81 * 0.01;
    
    const totalResistance = dragForce + rollingResistance;
    
    // Deceleration = Force / mass (negative because it opposes motion)
    return -totalResistance / specs.weight;
  }

  /**
   * Calculate lateral G-forces based on speed and track characteristics
   */
  private static calculateLateralG(speed: number, track: TrackConfiguration): number {
    // Simplified calculation based on average cornering speed
    const speedMs = speed / 3.6;
    const averageCornerRadius = track.length / (track.corners * 2 * Math.PI); // Rough approximation
    
    // Lateral acceleration = v² / r
    const lateralAcceleration = Math.pow(speedMs, 2) / averageCornerRadius;
    
    // Convert to G-forces
    return lateralAcceleration / 9.81;
  }

  /**
   * Detect overtakes between race ticks
   */
  private static detectOvertakes(
    previousParticipants: ParticipantState[],
    currentParticipants: ParticipantState[],
    raceTime: number
  ): RaceEvent[] {
    const events: RaceEvent[] = [];
    
    // Create position maps
    const prevPositions = new Map(previousParticipants.map(p => [p.playerId, p.position]));
    const currentPositions = new Map(currentParticipants.map(p => [p.playerId, p.position]));
    
    for (const participant of currentParticipants) {
      const prevPos = prevPositions.get(participant.playerId);
      const currentPos = currentPositions.get(participant.playerId);
      
      if (prevPos && currentPos && prevPos > currentPos) {
        // This participant improved their position
        const overtakenPlayer = previousParticipants.find(p => p.position === currentPos);
        if (overtakenPlayer) {
          events.push(this.createRaceEvent(
            'overtake',
            `${participant.playerId} overtakes ${overtakenPlayer.playerId} for P${currentPos}`,
            [participant.playerId, overtakenPlayer.playerId],
            raceTime
          ));
        }
      }
    }
    
    return events;
  }

  /**
   * Detect lap completions
   */
  private static detectLapCompletions(
    participants: ParticipantState[],
    track: TrackConfiguration,
    raceTime: number
  ): RaceEvent[] {
    const events: RaceEvent[] = [];
    
    for (const participant of participants) {
      // Check if participant just completed a lap (crossed finish line)
      // We'll track this by checking if they've moved past the track length
      if (participant.location.lap > 0 && participant.location.distance < track.length * 0.1) {
        // Only generate event if this is a new lap completion
        // In a real implementation, we'd track previous state to avoid duplicate events
        events.push(this.createRaceEvent(
          'lap_complete',
          `${participant.playerId} completes lap ${participant.location.lap}`,
          [participant.playerId],
          raceTime,
          { lap: participant.location.lap, lapTime: participant.lapTime }
        ));
      }
    }
    
    return events;
  }

  /**
   * Create a race event
   */
  private static createRaceEvent(
    type: RaceEventType,
    description: string,
    involvedPlayers: string[],
    timestamp: number,
    data?: any
  ): RaceEvent {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      type,
      description,
      involvedPlayers,
      data
    };
  }

  /**
   * Get the default track configuration
   */
  static getDefaultTrack(): TrackConfiguration {
    return { ...PhysicsEngine.DEFAULT_TRACK };
  }

  /**
   * Get the physics tick rate
   */
  static getTickRate(): number {
    return PhysicsEngine.TICK_RATE;
  }

  /**
   * Get the tick duration in milliseconds
   */
  static getTickDuration(): number {
    return PhysicsEngine.TICK_DURATION;
  }
}