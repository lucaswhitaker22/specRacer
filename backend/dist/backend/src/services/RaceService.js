"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceService = void 0;
const events_1 = require("events");
const RaceStateManager_1 = require("../engine/RaceStateManager");
const CommandProcessor_1 = require("../engine/CommandProcessor");
const PhysicsEngine_1 = require("../engine/PhysicsEngine");
const connection_1 = require("../database/connection");
class RaceService extends events_1.EventEmitter {
    constructor() {
        super();
        this.activeRaces = new Map();
        this.raceConfigurations = new Map();
        this.commandProcessors = new Map();
        this.pitStopStates = new Map();
        this.raceResults = new Map();
        this.trackConfigurations = new Map();
        this.initializeDefaultTrack();
    }
    initializeDefaultTrack() {
        const defaultTrack = PhysicsEngine_1.PhysicsEngine.getDefaultTrack();
        this.trackConfigurations.set(defaultTrack.id, defaultTrack);
    }
    async createRace(options) {
        let trackId = options.trackId;
        if (!trackId || trackId === 'silverstone-gp' || trackId === 'default') {
            trackId = '550e8400-e29b-41d4-a716-446655440000';
        }
        await this.validateTrackExists(trackId);
        const correctedOptions = { ...options, trackId };
        const raceId = await this.createRaceInDatabase(correctedOptions);
        let track = this.trackConfigurations.get(trackId);
        if (!track) {
            track = PhysicsEngine_1.PhysicsEngine.getDefaultTrack();
            track.id = trackId;
            this.trackConfigurations.set(trackId, track);
        }
        const raceConfig = {
            raceId,
            trackId: options.trackId,
            totalLaps: options.totalLaps,
            maxParticipants: options.maxParticipants || 20,
            weather: options.weather || this.getDefaultWeather(),
            trackConditions: options.trackConditions || this.getDefaultTrackConditions()
        };
        const raceManager = new RaceStateManager_1.RaceStateManager(raceConfig, track);
        const commandProcessor = new CommandProcessor_1.CommandProcessor();
        this.activeRaces.set(raceId, raceManager);
        this.raceConfigurations.set(raceId, raceConfig);
        this.commandProcessors.set(raceId, commandProcessor);
        this.pitStopStates.set(raceId, new Map());
        await this.persistRaceCreation(raceConfig);
        this.emit('raceCreated', { raceId, config: raceConfig });
        return raceId;
    }
    async joinRace(raceId, options) {
        const raceManager = this.activeRaces.get(raceId);
        if (!raceManager) {
            throw new Error(`Race not found: ${raceId}`);
        }
        if (raceManager.isRaceActive()) {
            throw new Error('Cannot join race that has already started');
        }
        await this.validateCarSelection(options.carId);
        const success = raceManager.addParticipant(options.playerId, options.carId);
        if (!success) {
            return false;
        }
        await this.persistRaceParticipant(raceId, options.playerId, options.carId);
        this.emit('playerJoined', { raceId, playerId: options.playerId, carId: options.carId });
        return true;
    }
    async leaveRace(raceId, playerId) {
        const raceManager = this.activeRaces.get(raceId);
        if (!raceManager) {
            throw new Error(`Race not found: ${raceId}`);
        }
        const success = raceManager.removeParticipant(playerId);
        if (success) {
            const commandProcessor = this.commandProcessors.get(raceId);
            if (commandProcessor) {
                commandProcessor.removePlayer(playerId);
            }
            const pitStops = this.pitStopStates.get(raceId);
            if (pitStops) {
                pitStops.delete(playerId);
            }
            this.emit('playerLeft', { raceId, playerId });
        }
        return success;
    }
    async startRace(raceId) {
        const raceManager = this.activeRaces.get(raceId);
        if (!raceManager) {
            throw new Error(`Race not found: ${raceId}`);
        }
        const success = raceManager.startRace();
        if (success) {
            await this.updateRaceStatus(raceId, 'active', new Date());
            this.emit('raceStarted', { raceId });
        }
        return success;
    }
    async processPlayerCommand(raceId, playerId, commandText) {
        const commandProcessor = this.commandProcessors.get(raceId);
        if (!commandProcessor) {
            throw new Error(`Race not found: ${raceId}`);
        }
        const raceManager = this.activeRaces.get(raceId);
        if (!raceManager || !raceManager.isRaceActive()) {
            throw new Error('Race is not active');
        }
        const commandInput = {
            playerId,
            commandText,
            timestamp: Date.now()
        };
        const processedCommand = commandProcessor.processCommand(commandInput);
        if (processedCommand.isValid && processedCommand.command.type === 'pit') {
            await this.handlePitStopCommand(raceId, playerId);
        }
        if (processedCommand.isValid) {
            raceManager.queueCommand(playerId, processedCommand.command);
        }
        this.emit('commandProcessed', { raceId, playerId, command: processedCommand });
        return processedCommand;
    }
    getRaceState(raceId) {
        const raceManager = this.activeRaces.get(raceId);
        return raceManager ? raceManager.getRaceState() : null;
    }
    getRaceResult(raceId) {
        return this.raceResults.get(raceId) || null;
    }
    getActiveRaces() {
        return Array.from(this.activeRaces.keys());
    }
    async handlePitStopCommand(raceId, playerId) {
        const raceManager = this.activeRaces.get(raceId);
        if (!raceManager)
            return;
        const raceState = raceManager.getRaceState();
        const participant = raceState.participants.find(p => p.playerId === playerId);
        if (!participant)
            return;
        const pitStopState = {
            playerId,
            isInPit: true,
            startTime: Date.now(),
            actions: [],
            totalDuration: 0
        };
        const actions = this.determinePitStopActions(participant);
        pitStopState.actions = actions;
        pitStopState.totalDuration = actions.reduce((total, action) => total + action.timeCost, 0);
        let racePitStops = this.pitStopStates.get(raceId);
        if (!racePitStops) {
            racePitStops = new Map();
            this.pitStopStates.set(raceId, racePitStops);
        }
        racePitStops.set(playerId, pitStopState);
        this.applyPitStopEffects(participant, actions);
        this.emit('pitStopStarted', { raceId, playerId, actions, duration: pitStopState.totalDuration });
    }
    determinePitStopActions(participant) {
        const actions = [];
        if (participant.fuel < 100) {
            actions.push({
                type: 'refuel',
                details: { fromFuel: participant.fuel, toFuel: 100 },
                timeCost: 3000 + (100 - participant.fuel) * 50
            });
        }
        const maxTireWear = Math.max(participant.tireWear.front, participant.tireWear.rear);
        if (maxTireWear > 30) {
            actions.push({
                type: 'tire_change',
                details: {
                    frontWear: participant.tireWear.front,
                    rearWear: participant.tireWear.rear
                },
                timeCost: 2500
            });
        }
        return actions;
    }
    applyPitStopEffects(participant, actions) {
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
    async calculateRaceResults(raceId) {
        const raceManager = this.activeRaces.get(raceId);
        const raceConfig = this.raceConfigurations.get(raceId);
        if (!raceManager || !raceConfig) {
            throw new Error(`Race data not found: ${raceId}`);
        }
        const raceState = raceManager.getRaceState();
        const track = raceManager.getTrack();
        const participantResults = raceState.participants.map(participant => {
            const pitStops = this.getPitStopsForPlayer(raceId, participant.playerId);
            return {
                playerId: participant.playerId,
                carId: participant.carId,
                finalPosition: participant.position,
                finalTime: participant.totalTime * 1000,
                lapTimes: [],
                bestLapTime: participant.lapTime * 1000,
                totalDistance: (participant.location.lap * track.length) + participant.location.distance,
                averageSpeed: this.calculateAverageSpeed(participant, raceState.raceTime),
                fuelUsed: 100 - participant.fuel,
                tireChanges: pitStops.filter(ps => ps.actions.some(a => a.type === 'tire_change')).length,
                pitStops
            };
        });
        const result = {
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
        await this.persistRaceResults(result);
        await this.updatePlayerStatistics(participantResults);
        this.raceResults.set(raceId, result);
        return result;
    }
    async cleanupRace(raceId) {
        await this.calculateRaceResults(raceId);
        this.activeRaces.delete(raceId);
        this.raceConfigurations.delete(raceId);
        this.commandProcessors.delete(raceId);
        this.pitStopStates.delete(raceId);
        await this.updateRaceStatus(raceId, 'completed', undefined, new Date());
        this.emit('raceCompleted', { raceId });
    }
    async createRaceInDatabase(options) {
        const db = (0, connection_1.getDatabaseConnection)();
        const result = await db.query(`INSERT INTO races (track_id, total_laps, status) 
       VALUES ($1, $2, $3) RETURNING id`, [options.trackId, options.totalLaps, 'waiting']);
        return result.rows[0].id;
    }
    async persistRaceCreation(config) {
        const db = (0, connection_1.getDatabaseConnection)();
        await db.query(`UPDATE races SET race_data = $2 WHERE id = $1`, [config.raceId, JSON.stringify(config)]);
    }
    async persistRaceParticipant(raceId, playerId, carId) {
        const db = (0, connection_1.getDatabaseConnection)();
        await db.query(`INSERT INTO race_participants (race_id, player_id, car_id) 
       VALUES ($1, $2, $3)`, [raceId, playerId, carId]);
    }
    async updateRaceStatus(raceId, status, startTime, endTime) {
        const db = (0, connection_1.getDatabaseConnection)();
        const updates = ['status = $2'];
        const params = [raceId, status];
        if (startTime) {
            updates.push('start_time = $3');
            params.push(startTime);
        }
        if (endTime) {
            updates.push('end_time = $' + (params.length + 1));
            params.push(endTime);
        }
        await db.query(`UPDATE races SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, params);
    }
    async persistRaceResults(result) {
        const db = (0, connection_1.getDatabaseConnection)();
        await db.transaction(async (client) => {
            await client.query(`UPDATE races SET results = $2, end_time = $3 WHERE id = $1`, [result.raceId, JSON.stringify(result), result.endTime]);
            for (const participant of result.participants) {
                await client.query(`UPDATE race_participants 
           SET final_position = $3, final_time = $4, race_events = $5 
           WHERE race_id = $1 AND player_id = $2`, [
                    result.raceId,
                    participant.playerId,
                    participant.finalPosition,
                    participant.finalTime,
                    JSON.stringify(participant.pitStops)
                ]);
            }
        });
    }
    async updatePlayerStatistics(participants) {
        const db = (0, connection_1.getDatabaseConnection)();
        for (const participant of participants) {
            const isWin = participant.finalPosition === 1;
            await db.query(`UPDATE players 
         SET total_races = total_races + 1, 
             wins = wins + $2,
             league_points = league_points + $3
         WHERE id = $1`, [
                participant.playerId,
                isWin ? 1 : 0,
                this.calculateLeaguePoints(participant.finalPosition, participants.length)
            ]);
        }
    }
    async validateTrackExists(trackId) {
        const db = (0, connection_1.getDatabaseConnection)();
        const result = await db.query('SELECT id FROM tracks WHERE id = $1 AND is_active = true', [trackId]);
        if (result.rows.length === 0) {
            throw new Error(`Track not found or not available: ${trackId}`);
        }
    }
    async validateCarSelection(carId) {
        const db = (0, connection_1.getDatabaseConnection)();
        const result = await db.query('SELECT id FROM cars WHERE id = $1 AND is_active = true', [carId]);
        if (result.rows.length === 0) {
            throw new Error(`Car not found or not available: ${carId}`);
        }
    }
    getDefaultWeather() {
        return {
            temperature: 22,
            humidity: 60,
            windSpeed: 10,
            precipitation: 0,
            visibility: 10000
        };
    }
    getDefaultTrackConditions() {
        return {
            surface: 'dry',
            grip: 1.0,
            temperature: 25
        };
    }
    getPitStopsForPlayer(raceId, playerId) {
        const racePitStops = this.pitStopStates.get(raceId);
        const playerPitStop = racePitStops?.get(playerId);
        if (!playerPitStop)
            return [];
        return [{
                lap: 0,
                timestamp: playerPitStop.startTime,
                duration: playerPitStop.totalDuration,
                actions: playerPitStop.actions
            }];
    }
    calculateAverageSpeed(participant, raceTime) {
        const totalDistance = participant.location.distance / 1000;
        const timeInHours = raceTime / 3600;
        return timeInHours > 0 ? totalDistance / timeInHours : 0;
    }
    calculateLeaguePoints(position, totalParticipants) {
        const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        return position <= pointsTable.length ? pointsTable[position - 1] : 0;
    }
    async getAvailableRaces() {
        const db = (0, connection_1.getDatabaseConnection)();
        const result = await db.query(`SELECT r.id as race_id, r.track_id, r.total_laps, 
              COUNT(rp.player_id) as current_participants,
              COALESCE(r.race_data->>'maxParticipants', '20')::int as max_participants,
              r.status
       FROM races r
       LEFT JOIN race_participants rp ON r.id = rp.race_id
       WHERE r.status = 'waiting'
       GROUP BY r.id, r.track_id, r.total_laps, r.race_data
       ORDER BY r.created_at DESC`);
        return result.rows.map((row) => ({
            raceId: row.race_id,
            trackId: row.track_id,
            totalLaps: row.total_laps,
            currentParticipants: parseInt(row.current_participants),
            maxParticipants: row.max_participants,
            status: row.status
        }));
    }
    async getRaceResults(raceId) {
        return this.getRaceResult(raceId);
    }
}
exports.RaceService = RaceService;
//# sourceMappingURL=RaceService.js.map