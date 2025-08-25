import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { getDatabaseConnection } from '../database/connection';
import { 
  Player, 
  PlayerProfile, 
  PlayerStatistics, 
  LoginCredentials, 
  RegisterData, 
  AuthToken, 
  RaceResult,
  LeagueStanding
} from '../../../shared/types/player';

export class PlayerService {
  private get db() {
    return getDatabaseConnection();
  }
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
  private readonly JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '24h';
  private readonly SALT_ROUNDS = 12;

  /**
   * Register a new player
   */
  async registerPlayer(registerData: RegisterData): Promise<Player> {
    const { username, email, password } = registerData;

    // Validate input
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }

    if (username.length < 3 || username.length > 50) {
      throw new Error('Username must be between 3 and 50 characters');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Check if username or email already exists
    const existingPlayer = await this.db.query(
      'SELECT id FROM players WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingPlayer.rows.length > 0) {
      throw new Error('Username or email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Insert new player
    const result = await this.db.query(
      `INSERT INTO players (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, created_at, total_races, wins, league_points`,
      [username, email, passwordHash]
    );

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

  /**
   * Authenticate player login
   */
  async authenticatePlayer(credentials: LoginCredentials): Promise<AuthToken> {
    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    // Find player by username
    const result = await this.db.query(
      'SELECT id, username, password_hash, is_active FROM players WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid username or password');
    }

    const player = result.rows[0];

    if (!player.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, player.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    // Generate JWT token
    const token = (jwt.sign as any)(
      { playerId: player.id, username: player.username },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Default 24 hours

    return {
      token,
      expiresAt,
      playerId: player.id
    };
  }

  /**
   * Verify JWT token and return player ID
   */
  async verifyToken(token: string): Promise<string> {
    try {
      const decoded = (jwt.verify as any)(token, this.JWT_SECRET) as any;
      return decoded.playerId;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get player by ID
   */
  async getPlayerById(playerId: string): Promise<Player | null> {
    const result = await this.db.query(
      `SELECT id, username, email, created_at, total_races, wins, league_points 
       FROM players WHERE id = $1 AND is_active = true`,
      [playerId]
    );

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

  /**
   * Get complete player profile with statistics and race history
   */
  async getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
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

  /**
   * Get player race history
   */
  async getPlayerRaceHistory(playerId: string, limit: number = 50): Promise<RaceResult[]> {
    const result = await this.db.query(
      `SELECT 
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
       LIMIT $2`,
      [playerId, limit]
    );

    return result.rows.map((row: any) => ({
      raceId: row.race_id,
      playerId: row.player_id,
      carId: row.car_id,
      finalPosition: row.final_position,
      finalTime: row.final_time,
      lapTimes: [], // TODO: Extract from race_events when lap timing is implemented
      raceEvents: row.race_events ? Object.keys(row.race_events) : [],
      points: row.points,
      completedAt: row.completed_at
    }));
  }

  /**
   * Calculate player statistics
   */
  async calculatePlayerStatistics(playerId: string): Promise<PlayerStatistics> {
    const result = await this.db.query(
      `SELECT 
         COUNT(*) as total_races,
         AVG(rp.final_time) as avg_race_time,
         MIN(rp.final_time) as best_race_time,
         SUM(rp.final_time) as total_race_time,
         AVG(rp.final_position) as avg_position,
         COUNT(CASE WHEN rp.final_position <= 3 THEN 1 END) as podium_finishes,
         COUNT(CASE WHEN rp.final_position IS NULL THEN 1 END) as dnf_count
       FROM race_participants rp
       JOIN races r ON rp.race_id = r.id
       WHERE rp.player_id = $1 AND r.status = 'completed'`,
      [playerId]
    );

    const stats = result.rows[0];
    
    return {
      averageLapTime: 0, // TODO: Calculate from lap timing data when available
      bestLapTime: 0, // TODO: Calculate from lap timing data when available
      totalRaceTime: parseInt(stats.total_race_time) || 0,
      podiumFinishes: parseInt(stats.podium_finishes) || 0,
      dnfCount: parseInt(stats.dnf_count) || 0,
      averagePosition: parseFloat(stats.avg_position) || 0
    };
  }

  /**
   * Update player statistics after a race
   */
  async updatePlayerStats(playerId: string, raceResult: RaceResult): Promise<void> {
    await this.db.transaction(async (client) => {
      // Calculate points based on position
      let points = 0;
      switch (raceResult.finalPosition) {
        case 1: points = 25; break;
        case 2: points = 18; break;
        case 3: points = 15; break;
        case 4: points = 12; break;
        case 5: points = 10; break;
        case 6: points = 8; break;
        case 7: points = 6; break;
        case 8: points = 4; break;
        case 9: points = 2; break;
        case 10: points = 1; break;
        default: points = 0;
      }

      // Update player totals
      await client.query(
        `UPDATE players 
         SET total_races = total_races + 1,
             wins = wins + CASE WHEN $2 = 1 THEN 1 ELSE 0 END,
             league_points = league_points + $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [playerId, raceResult.finalPosition, points]
      );
    });
  }

  /**
   * Get league standings
   */
  async getLeagueStandings(limit: number = 50): Promise<LeagueStanding[]> {
    const result = await this.db.query(
      `SELECT 
         id as player_id,
         username,
         league_points,
         total_races,
         wins,
         ROW_NUMBER() OVER (ORDER BY league_points DESC, wins DESC, total_races ASC) as position
       FROM players 
       WHERE is_active = true AND total_races > 0
       ORDER BY league_points DESC, wins DESC, total_races ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => ({
      playerId: row.player_id,
      username: row.username,
      leaguePoints: row.league_points,
      totalRaces: row.total_races,
      wins: row.wins,
      position: parseInt(row.position)
    }));
  }

  /**
   * Get player's current league position
   */
  async getPlayerLeaguePosition(playerId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT position FROM (
         SELECT 
           id,
           ROW_NUMBER() OVER (ORDER BY league_points DESC, wins DESC, total_races ASC) as position
         FROM players 
         WHERE is_active = true AND total_races > 0
       ) ranked_players
       WHERE id = $1`,
      [playerId]
    );

    return result.rows.length > 0 ? parseInt(result.rows[0].position) : 0;
  }

  /**
   * Update player profile information
   */
  async updatePlayerProfile(playerId: string, updates: Partial<Pick<Player, 'email'>>): Promise<Player> {
    const allowedFields = ['email'];
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
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

  /**
   * Deactivate player account
   */
  async deactivatePlayer(playerId: string): Promise<void> {
    const result = await this.db.query(
      'UPDATE players SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [playerId]
    );

    if (result.rowCount === 0) {
      throw new Error('Player not found');
    }
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT id FROM players WHERE username = $1',
      [username]
    );

    return result.rows.length === 0;
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT id FROM players WHERE email = $1',
      [email]
    );

    return result.rows.length === 0;
  }
}