import { redisManager } from '../database/redis';
import { Player } from '../../../shared/types/player';
import { ConnectionState } from '../../../shared/types/websocket';

export interface PlayerSession {
  playerId: string;
  username: string;
  currentRaceId?: string;
  connectionId: string;
  lastActivity: number;
  isActive: boolean;
}

export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly PLAYER_SESSION_PREFIX = 'player_session:';
  private readonly SESSION_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

  constructor() {}

  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  private getPlayerSessionKey(playerId: string): string {
    return `${this.PLAYER_SESSION_PREFIX}${playerId}`;
  }

  /**
   * Create a new session for a player
   */
  async createSession(playerId: string, username: string, connectionId: string): Promise<string> {
    const sessionId = `${playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: PlayerSession = {
      playerId,
      username,
      connectionId,
      lastActivity: Date.now(),
      isActive: true
    };

    const client = redisManager.getClient();
    
    // Store session data
    await client.setEx(
      this.getSessionKey(sessionId),
      this.SESSION_EXPIRY,
      JSON.stringify(session)
    );

    // Store player -> session mapping
    await client.setEx(
      this.getPlayerSessionKey(playerId),
      this.SESSION_EXPIRY,
      sessionId
    );

    return sessionId;
  }

  /**
   * Get session by session ID
   */
  async getSession(sessionId: string): Promise<PlayerSession | null> {
    try {
      const client = redisManager.getClient();
      const sessionData = await client.get(this.getSessionKey(sessionId));
      
      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData) as PlayerSession;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Get session by player ID
   */
  async getPlayerSession(playerId: string): Promise<PlayerSession | null> {
    try {
      const client = redisManager.getClient();
      const sessionId = await client.get(this.getPlayerSessionKey(playerId));
      
      if (!sessionId) {
        return null;
      }

      return this.getSession(sessionId);
    } catch (error) {
      console.error('Error getting player session:', error);
      return null;
    }
  }

  /**
   * Update session activity and extend expiry
   */
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.lastActivity = Date.now();
      
      const client = redisManager.getClient();
      await client.setEx(
        this.getSessionKey(sessionId),
        this.SESSION_EXPIRY,
        JSON.stringify(session)
      );

      return true;
    } catch (error) {
      console.error('Error updating session activity:', error);
      return false;
    }
  }

  /**
   * Update player's current race
   */
  async updatePlayerRace(playerId: string, raceId: string | null): Promise<boolean> {
    try {
      const session = await this.getPlayerSession(playerId);
      if (!session) {
        return false;
      }

      session.currentRaceId = raceId || undefined;
      session.lastActivity = Date.now();

      const client = redisManager.getClient();
      const sessionId = await client.get(this.getPlayerSessionKey(playerId));
      
      if (!sessionId) {
        return false;
      }

      await client.setEx(
        this.getSessionKey(sessionId),
        this.SESSION_EXPIRY,
        JSON.stringify(session)
      );

      return true;
    } catch (error) {
      console.error('Error updating player race:', error);
      return false;
    }
  }

  /**
   * Update connection ID for reconnection
   */
  async updateConnectionId(playerId: string, newConnectionId: string): Promise<boolean> {
    try {
      const session = await this.getPlayerSession(playerId);
      if (!session) {
        return false;
      }

      session.connectionId = newConnectionId;
      session.lastActivity = Date.now();

      const client = redisManager.getClient();
      const sessionId = await client.get(this.getPlayerSessionKey(playerId));
      
      if (!sessionId) {
        return false;
      }

      await client.setEx(
        this.getSessionKey(sessionId),
        this.SESSION_EXPIRY,
        JSON.stringify(session)
      );

      return true;
    } catch (error) {
      console.error('Error updating connection ID:', error);
      return false;
    }
  }

  /**
   * Deactivate session (logout)
   */
  async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.isActive = false;
      session.lastActivity = Date.now();

      const client = redisManager.getClient();
      await client.setEx(
        this.getSessionKey(sessionId),
        this.SESSION_EXPIRY,
        JSON.stringify(session)
      );

      return true;
    } catch (error) {
      console.error('Error deactivating session:', error);
      return false;
    }
  }

  /**
   * Remove session completely
   */
  async removeSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const client = redisManager.getClient();
      
      // Remove both session and player mapping
      await client.del([
        this.getSessionKey(sessionId),
        this.getPlayerSessionKey(session.playerId)
      ]);

      return true;
    } catch (error) {
      console.error('Error removing session:', error);
      return false;
    }
  }

  /**
   * Get all active sessions (for admin purposes)
   */
  async getActiveSessions(): Promise<PlayerSession[]> {
    try {
      const client = redisManager.getClient();
      const sessionKeys = await client.keys(`${this.SESSION_PREFIX}*`);
      
      const sessions: PlayerSession[] = [];
      
      for (const key of sessionKeys) {
        const sessionData = await client.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData) as PlayerSession;
          if (session.isActive) {
            sessions.push(session);
          }
        }
      }

      return sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const client = redisManager.getClient();
      const sessionKeys = await client.keys(`${this.SESSION_PREFIX}*`);
      
      let cleanedCount = 0;
      const expiredThreshold = Date.now() - (this.SESSION_EXPIRY * 1000);
      
      for (const key of sessionKeys) {
        const sessionData = await client.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData) as PlayerSession;
          if (session.lastActivity < expiredThreshold) {
            await this.removeSession(key.replace(this.SESSION_PREFIX, ''));
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}