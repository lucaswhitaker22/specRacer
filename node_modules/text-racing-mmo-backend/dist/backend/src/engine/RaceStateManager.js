"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceStateManager = void 0;
const PhysicsEngine_1 = require("./PhysicsEngine");
class RaceStateManager {
    constructor(config, track) {
        this.isActive = false;
        this.tickInterval = null;
        this.commandQueue = new Map();
        this.track = track || PhysicsEngine_1.PhysicsEngine.getDefaultTrack();
        this.raceState = this.initializeRaceState(config);
    }
    initializeRaceState(config) {
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
    addParticipant(playerId, carId) {
        if (this.isActive) {
            return false;
        }
        if (this.raceState.participants.length >= 20) {
            return false;
        }
        if (this.raceState.participants.some(p => p.playerId === playerId)) {
            return false;
        }
        const participant = {
            playerId,
            carId,
            position: this.raceState.participants.length + 1,
            lapTime: 0,
            totalTime: 0,
            fuel: 100,
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
        const event = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: this.raceState.raceTime,
            type: 'race_start',
            description: `${playerId} joins the race`,
            involvedPlayers: [playerId]
        };
        this.raceState.raceEvents.push(event);
        return true;
    }
    removeParticipant(playerId) {
        const index = this.raceState.participants.findIndex(p => p.playerId === playerId);
        if (index === -1) {
            return false;
        }
        this.raceState.participants.splice(index, 1);
        this.raceState.participants.forEach((participant, idx) => {
            participant.position = idx + 1;
        });
        const event = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: this.raceState.raceTime,
            type: 'incident',
            description: `${playerId} leaves the race`,
            involvedPlayers: [playerId]
        };
        this.raceState.raceEvents.push(event);
        return true;
    }
    startRace() {
        if (this.isActive || this.raceState.participants.length === 0) {
            return false;
        }
        this.isActive = true;
        const startEvent = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: this.raceState.raceTime,
            type: 'race_start',
            description: `Race started with ${this.raceState.participants.length} participants`,
            involvedPlayers: this.raceState.participants.map(p => p.playerId)
        };
        this.raceState.raceEvents.push(startEvent);
        this.tickInterval = setInterval(() => {
            this.processTick();
        }, PhysicsEngine_1.PhysicsEngine.getTickDuration());
        return true;
    }
    stopRace() {
        if (!this.isActive) {
            return;
        }
        this.isActive = false;
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        const finishEvent = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: this.raceState.raceTime,
            type: 'race_finish',
            description: 'Race finished',
            involvedPlayers: this.raceState.participants.map(p => p.playerId)
        };
        this.raceState.raceEvents.push(finishEvent);
    }
    queueCommand(playerId, command) {
        if (!this.isActive) {
            return false;
        }
        if (!this.raceState.participants.some(p => p.playerId === playerId)) {
            return false;
        }
        this.commandQueue.set(playerId, command);
        return true;
    }
    processTick() {
        if (!this.isActive) {
            return;
        }
        const { updatedState, events } = PhysicsEngine_1.PhysicsEngine.processRaceTick(this.raceState, this.commandQueue, this.track);
        this.raceState = updatedState;
        this.commandQueue.clear();
        this.checkRaceCompletion();
        if (events.length > 0) {
            this.onRaceEvents(events);
        }
    }
    checkRaceCompletion() {
        const raceWinner = this.raceState.participants.find(p => p.location.lap >= this.raceState.totalLaps);
        if (raceWinner) {
            this.stopRace();
        }
        const maxRaceTime = this.raceState.totalLaps * 300;
        if (this.raceState.raceTime > maxRaceTime) {
            this.stopRace();
        }
    }
    onRaceEvents(events) {
        console.log('Race events:', events.map(e => e.description));
    }
    getRaceState() {
        return { ...this.raceState };
    }
    isRaceActive() {
        return this.isActive;
    }
    getParticipantCount() {
        return this.raceState.participants.length;
    }
    getRaceProgress() {
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
    getTrack() {
        return { ...this.track };
    }
    updateWeather(weather) {
        this.raceState.weather = weather;
        const event = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: this.raceState.raceTime,
            type: 'incident',
            description: `Weather conditions changed`,
            involvedPlayers: [],
            data: { weather }
        };
        this.raceState.raceEvents.push(event);
    }
    updateTrackConditions(conditions) {
        this.raceState.trackConditions = conditions;
        const event = {
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
exports.RaceStateManager = RaceStateManager;
//# sourceMappingURL=RaceStateManager.js.map