"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const connection_1 = require("../database/connection");
class PlayerService {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
        this.SALT_ROUNDS = 12;
    }
    get db() {
        return (0, connection_1.getDatabaseConnection)();
    }
    async registerPlayer(registerData) {
        const { username, email, password } = registerData;
        if (!username || !email || !password) {
            throw new Error('Username, email, and password are required');
        }
        if (username.length < 3 || username.length > 50) {
            throw new Error('Username must be between 3 and 50 characters');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }
        const existingPlayer = await this.db.query('SELECT id FROM players WHERE username = $1 OR email = $2', [username, email]);
        if (existingPlayer.rows.length > 0) {
            throw new Error('Username or email already exists');
        }
        const passwordHash = await bcrypt_1.default.hash(password, this.SALT_ROUNDS);
        const result = await this.db.query(`INSERT INTO players (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, created_at, total_races, wins, league_points`, [username, email, passwordHash]);
        const playerRow = result.rows[0];
        return {
            id: playerRow.id,
            username: playerRow.username,
            email: playerRow.email,
            createdAt: playerRow.created_at,
            totalRaces: playerRow.total_races,
            wins: playerRow.wins,
            leaguePoints: playerRow.league_points
        };
    }
    async authenticatePlayer(credentials) {
        const { username, password } = credentials;
        if (!username || !password) {
            throw new Error('Username and password are required');
        }
        const result = await this.db.query('SELECT id, username, password_hash, is_active FROM players WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            throw new Error('Invalid username or password');
        }
        const player = result.rows[0];
        if (!player.is_active) {
            throw new Error('Account is deactivated');
        }
        const isValidPassword = await bcrypt_1.default.compare(password, player.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid username or password');
        }
        const token = jwt.sign({ playerId: player.id, username: player.username }, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        return {
            token,
            expiresAt,
            playerId: player.id
        };
    }
    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.JWT_SECRET);
            return decoded.playerId;
        }
        catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
    async getPlayerById(playerId) {
        const result = await this.db.query(`SELECT id, username, email, created_at, total_races, wins, league_points 
       FROM players WHERE id = $1 AND is_active = true`, [playerId]);
        if (result.rows.length === 0) {
            return null;
        }
        const player = result.rows[0];
        return {
            id: player.id,
            username: player.username,
            email: player.email,
            createdAt: player.created_at,
            totalRaces: player.total_races,
            wins: player.wins,
            leaguePoints: player.league_points
        };
    }
    async getPlayerProfile(playerId) {
        const player = await this.getPlayerById(playerId);
        if (!player) {
            return null;
        }
        const [raceHistory, statistics] = await Promise.all([
            this.getPlayerRaceHistory(playerId),
            this.calculatePlayerStatistics(playerId)
        ]);
        return {
            ...player,
            raceHistory,
            statistics
        };
    }
    async getPlayerRaceHistory(playerId, limit = 50) {
        const result = await this.db.query(`SELECT 
         rp.race_id,
         rp.player_id,
         rp.car_id,
         rp.final_position,
         rp.final_time,
         rp.race_events,
         r.end_time as completed_at,
         COALESCE(
           CASE 
             WHEN rp.final_position = 1 THEN 25
             WHEN rp.final_position = 2 THEN 18
             WHEN rp.final_position = 3 THEN 15
             WHEN rp.final_position <= 5 THEN 12
             WHEN rp.final_position <= 8 THEN 10
             WHEN rp.final_position <= 10 THEN 8
             ELSE 5
           END, 0
         ) as points
       FROM race_participants rp
       JOIN races r ON rp.race_id = r.id
       WHERE rp.player_id = $1 AND r.status = 'completed'
       ORDER BY r.end_time DESC
       LIMIT $2`, [playerId, limit]);
        return result.rows.map((row) => ({
            raceId: row.race_id,
            playerId: row.player_id,
            carId: row.car_id,
            finalPosition: row.final_position,
            finalTime: row.final_time,
            lapTimes: [],
            raceEvents: row.race_events ? Object.keys(row.race_events) : [],
            points: row.points,
            completedAt: row.completed_at
        }));
    }
    async calculatePlayerStatistics(playerId) {
        const result = await this.db.query(`SELECT 
         COUNT(*) as total_races,
         AVG(rp.final_time) as avg_race_time,
         MIN(rp.final_time) as best_race_time,
         SUM(rp.final_time) as total_race_time,
         AVG(rp.final_position) as avg_position,
         COUNT(CASE WHEN rp.final_position <= 3 THEN 1 END) as podium_finishes,
         COUNT(CASE WHEN rp.final_position IS NULL THEN 1 END) as dnf_count
       FROM race_participants rp
       JOIN races r ON rp.race_id = r.id
       WHERE rp.player_id = $1 AND r.status = 'completed'`, [playerId]);
        const stats = result.rows[0];
        return {
            averageLapTime: 0,
            bestLapTime: 0,
            totalRaceTime: parseInt(stats.total_race_time) || 0,
            podiumFinishes: parseInt(stats.podium_finishes) || 0,
            dnfCount: parseInt(stats.dnf_count) || 0,
            averagePosition: parseFloat(stats.avg_position) || 0
        };
    }
    async updatePlayerStats(playerId, raceResult) {
        await this.db.transaction(async (client) => {
            let points = 0;
            switch (raceResult.finalPosition) {
                case 1:
                    points = 25;
                    break;
                case 2:
                    points = 18;
                    break;
                case 3:
                    points = 15;
                    break;
                case 4:
                    points = 12;
                    break;
                case 5:
                    points = 10;
                    break;
                case 6:
                    points = 8;
                    break;
                case 7:
                    points = 6;
                    break;
                case 8:
                    points = 4;
                    break;
                case 9:
                    points = 2;
                    break;
                case 10:
                    points = 1;
                    break;
                default: points = 0;
            }
            await client.query(`UPDATE players 
         SET total_races = total_races + 1,
             wins = wins + CASE WHEN $2 = 1 THEN 1 ELSE 0 END,
             league_points = league_points + $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`, [playerId, raceResult.finalPosition, points]);
        });
    }
    async getLeagueStandings(limit = 50) {
        const result = await this.db.query(`SELECT 
         id as player_id,
         username,
         league_points,
         total_races,
         wins,
         ROW_NUMBER() OVER (ORDER BY league_points DESC, wins DESC, total_races ASC) as position
       FROM players 
       WHERE is_active = true AND total_races > 0
       ORDER BY league_points DESC, wins DESC, total_races ASC
       LIMIT $1`, [limit]);
        return result.rows.map((row) => ({
            playerId: row.player_id,
            username: row.username,
            leaguePoints: row.league_points,
            totalRaces: row.total_races,
            wins: row.wins,
            position: parseInt(row.position)
        }));
    }
    async getPlayerLeaguePosition(playerId) {
        const result = await this.db.query(`SELECT position FROM (
         SELECT 
           id,
           ROW_NUMBER() OVER (ORDER BY league_points DESC, wins DESC, total_races ASC) as position
         FROM players 
         WHERE is_active = true AND total_races > 0
       ) ranked_players
       WHERE id = $1`, [playerId]);
        return result.rows.length > 0 ? parseInt(result.rows[0].position) : 0;
    }
    async updatePlayerProfile(playerId, updates) {
        const allowedFields = ['email'];
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key) && value !== undefined) {
                updateFields.push(`${key} = $${paramIndex}`);
                updateValues.push(value);
                paramIndex++;
            }
        }
        if (updateFields.length === 0) {
            throw new Error('No valid fields to update');
        }
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(playerId);
        const query = `
      UPDATE players 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, created_at, total_races, wins, league_points
    `;
        const result = await this.db.query(query, updateValues);
        if (result.rows.length === 0) {
            throw new Error('Player not found');
        }
        const player = result.rows[0];
        return {
            id: player.id,
            username: player.username,
            email: player.email,
            createdAt: player.created_at,
            totalRaces: player.total_races,
            wins: player.wins,
            leaguePoints: player.league_points
        };
    }
    async deactivatePlayer(playerId) {
        const result = await this.db.query('UPDATE players SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [playerId]);
        if (result.rowCount === 0) {
            throw new Error('Player not found');
        }
    }
    async isUsernameAvailable(username) {
        const result = await this.db.query('SELECT id FROM players WHERE username = $1', [username]);
        return result.rows.length === 0;
    }
    async isEmailAvailable(email) {
        const result = await this.db.query('SELECT id FROM players WHERE email = $1', [email]);
        return result.rows.length === 0;
    }
}
exports.PlayerService = PlayerService;
//# sourceMappingURL=PlayerService.js.map