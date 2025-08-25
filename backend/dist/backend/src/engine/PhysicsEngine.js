"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicsEngine = void 0;
const CarService_1 = require("../services/CarService");
class PhysicsEngine {
    static processRaceTick(raceState, commands, track = PhysicsEngine.DEFAULT_TRACK) {
        const allEvents = [];
        const updatedParticipants = [];
        for (const participant of raceState.participants) {
            const car = CarService_1.CarService.getCarById(participant.carId);
            const command = commands.get(participant.playerId) || { type: 'coast' };
            const update = this.updateParticipant(participant, car, command, track, raceState.raceTime);
            updatedParticipants.push(update.newState);
            allEvents.push(...update.events);
        }
        updatedParticipants.sort((a, b) => {
            if (a.location.lap !== b.location.lap) {
                return b.location.lap - a.location.lap;
            }
            return b.location.distance - a.location.distance;
        });
        updatedParticipants.forEach((participant, index) => {
            participant.position = index + 1;
        });
        const overtakeEvents = this.detectOvertakes(raceState.participants, updatedParticipants, raceState.raceTime);
        allEvents.push(...overtakeEvents);
        const lapEvents = this.detectLapCompletions(updatedParticipants, track, raceState.raceTime);
        allEvents.push(...lapEvents);
        const updatedState = {
            ...raceState,
            raceTime: raceState.raceTime + (PhysicsEngine.TICK_DURATION / 1000),
            participants: updatedParticipants,
            raceEvents: [...raceState.raceEvents, ...allEvents]
        };
        return { updatedState, events: allEvents };
    }
    static updateParticipant(participant, car, command, track, raceTime) {
        const events = [];
        const deltaTime = PhysicsEngine.TICK_DURATION / 1000;
        if (!car) {
            return { participantId: participant.playerId, newState: { ...participant }, events };
        }
        const { throttle, brake } = this.processCommand(command);
        let acceleration = 0;
        if (throttle > 0) {
            acceleration = CarService_1.CarService.calculateAcceleration(car, participant.speed) * throttle;
        }
        else if (brake > 0) {
            acceleration = -CarService_1.CarService.calculateBrakingDeceleration(car, participant.speed) * brake;
        }
        else {
            acceleration = this.calculateDragDeceleration(car, participant.speed);
        }
        const newSpeed = Math.max(0, participant.speed + (acceleration * deltaTime * 3.6));
        const topSpeed = CarService_1.CarService.calculateTopSpeed(car);
        const clampedSpeed = Math.min(newSpeed, topSpeed);
        const averageSpeed = (participant.speed + clampedSpeed) / 2;
        const distanceTraveled = (averageSpeed / 3.6) * deltaTime;
        const newDistance = participant.location.distance + distanceTraveled;
        const newLap = participant.location.lap + Math.floor(newDistance / track.length);
        const adjustedDistance = newDistance % track.length;
        const fuelConsumed = CarService_1.CarService.calculateFuelConsumption(car, averageSpeed, throttle) * (deltaTime / 3600);
        const newFuel = Math.max(0, participant.fuel - (fuelConsumed * 100 / 60));
        const lateralG = this.calculateLateralG(clampedSpeed, track);
        const brakingG = brake * CarService_1.CarService.calculateBrakingDeceleration(car, participant.speed) / 9.81;
        const tireWearRate = CarService_1.CarService.calculateTireWearRate(car, averageSpeed, lateralG, brakingG);
        const wearThisTick = tireWearRate * (deltaTime / 3600);
        const newTireWear = {
            front: Math.min(100, participant.tireWear.front + wearThisTick * 1.2),
            rear: Math.min(100, participant.tireWear.rear + wearThisTick)
        };
        if (newFuel <= 5 && participant.fuel > 5) {
            events.push(this.createRaceEvent('incident', `${participant.playerId} is running low on fuel!`, [participant.playerId], raceTime));
        }
        if (newTireWear.front > 80 && participant.tireWear.front <= 80) {
            events.push(this.createRaceEvent('incident', `${participant.playerId}'s front tires are heavily worn`, [participant.playerId], raceTime));
        }
        const newState = {
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
    static processCommand(command) {
        switch (command.type) {
            case 'accelerate':
                return { throttle: command.intensity || 1.0, brake: 0 };
            case 'brake':
                return { throttle: 0, brake: command.intensity || 1.0 };
            case 'coast':
                return { throttle: 0, brake: 0 };
            case 'shift':
                return { throttle: 0, brake: 0 };
            case 'pit':
                return { throttle: 0, brake: 0.5 };
            default:
                return { throttle: 0, brake: 0 };
        }
    }
    static calculateDragDeceleration(car, currentSpeed) {
        const specs = car.specifications;
        const speedMs = currentSpeed / 3.6;
        const dragForce = 0.5 * 1.225 * specs.dragCoefficient * specs.frontalArea * Math.pow(speedMs, 2);
        const rollingResistance = specs.weight * 9.81 * 0.01;
        const totalResistance = dragForce + rollingResistance;
        return -totalResistance / specs.weight;
    }
    static calculateLateralG(speed, track) {
        const speedMs = speed / 3.6;
        const averageCornerRadius = track.length / (track.corners * 2 * Math.PI);
        const lateralAcceleration = Math.pow(speedMs, 2) / averageCornerRadius;
        return lateralAcceleration / 9.81;
    }
    static detectOvertakes(previousParticipants, currentParticipants, raceTime) {
        const events = [];
        const prevPositions = new Map(previousParticipants.map(p => [p.playerId, p.position]));
        const currentPositions = new Map(currentParticipants.map(p => [p.playerId, p.position]));
        for (const participant of currentParticipants) {
            const prevPos = prevPositions.get(participant.playerId);
            const currentPos = currentPositions.get(participant.playerId);
            if (prevPos && currentPos && prevPos > currentPos) {
                const overtakenPlayer = previousParticipants.find(p => p.position === currentPos);
                if (overtakenPlayer) {
                    events.push(this.createRaceEvent('overtake', `${participant.playerId} overtakes ${overtakenPlayer.playerId} for P${currentPos}`, [participant.playerId, overtakenPlayer.playerId], raceTime));
                }
            }
        }
        return events;
    }
    static detectLapCompletions(participants, track, raceTime) {
        const events = [];
        for (const participant of participants) {
            if (participant.location.lap > 0 && participant.location.distance < track.length * 0.1) {
                events.push(this.createRaceEvent('lap_complete', `${participant.playerId} completes lap ${participant.location.lap}`, [participant.playerId], raceTime, { lap: participant.location.lap, lapTime: participant.lapTime }));
            }
        }
        return events;
    }
    static createRaceEvent(type, description, involvedPlayers, timestamp, data) {
        return {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp,
            type,
            description,
            involvedPlayers,
            data
        };
    }
    static getDefaultTrack() {
        return { ...PhysicsEngine.DEFAULT_TRACK };
    }
    static getTickRate() {
        return PhysicsEngine.TICK_RATE;
    }
    static getTickDuration() {
        return PhysicsEngine.TICK_DURATION;
    }
}
exports.PhysicsEngine = PhysicsEngine;
PhysicsEngine.TICK_RATE = 10;
PhysicsEngine.TICK_DURATION = 1000 / PhysicsEngine.TICK_RATE;
PhysicsEngine.DEFAULT_TRACK = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Silverstone Grand Prix Circuit',
    length: 5891,
    sectors: 3,
    corners: 18,
    elevation: 15,
    surface: 'asphalt',
    difficulty: 0.7
};
//# sourceMappingURL=PhysicsEngine.js.map