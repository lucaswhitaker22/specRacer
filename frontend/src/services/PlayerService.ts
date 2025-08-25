import type { PlayerProfile, RaceResult, PlayerStatistics, LeagueStanding } from '@shared/types/player';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  // Backend returns data directly in some endpoints
  standings?: T;
  raceHistory?: T;
  statistics?: T;
  profile?: T;
  position?: T;
}

export class PlayerService {
  private static getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  private static getAuthHeaders(): HeadersInit {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  /**
   * Fetch league standings from the API
   */
  static async getLeagueStandings(limit: number = 50): Promise<LeagueStanding[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/players/league-standings?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse<LeagueStanding[]> = await response.json();
      
      // Handle both response formats
      const standings = result.standings || result.data;
      if (!standings) {
        throw new Error(result.error || 'Failed to fetch league standings');
      }
      
      return standings;
    } catch (error) {
      console.error('Error fetching league standings:', error);
      throw error;
    }
  }

  /**
   * Fetch player's race history from the API
   */
  static async getPlayerRaceHistory(limit: number = 50): Promise<RaceResult[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/players/race-history?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse<RaceResult[]> = await response.json();
      
      // Handle both response formats
      const raceHistory = result.raceHistory || result.data;
      if (!raceHistory) {
        throw new Error(result.error || 'Failed to fetch race history');
      }
      
      return raceHistory;
    } catch (error) {
      console.error('Error fetching race history:', error);
      throw error;
    }
  }

  /**
   * Fetch player statistics from the API
   */
  static async getPlayerStatistics(): Promise<PlayerStatistics> {
    try {
      const response = await fetch(`${API_BASE_URL}/players/statistics`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse<PlayerStatistics> = await response.json();
      
      // Handle both response formats
      const statistics = result.statistics || result.data;
      if (!statistics) {
        throw new Error(result.error || 'Failed to fetch player statistics');
      }
      
      return statistics;
    } catch (error) {
      console.error('Error fetching player statistics:', error);
      throw error;
    }
  }

  /**
   * Fetch player profile from the API
   */
  static async getPlayerProfile(): Promise<PlayerProfile> {
    try {
      const response = await fetch(`${API_BASE_URL}/players/profile`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse<PlayerProfile> = await response.json();
      
      // Handle both response formats
      const profile = result.profile || result.data;
      if (!profile) {
        throw new Error(result.error || 'Failed to fetch player profile');
      }
      
      return profile;
    } catch (error) {
      console.error('Error fetching player profile:', error);
      throw error;
    }
  }

  /**
   * Fetch player's current league position
   */
  static async getPlayerLeaguePosition(): Promise<number> {
    try {
      const response = await fetch(`${API_BASE_URL}/players/league-position`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse<number> = await response.json();
      
      // Handle both response formats
      const position = result.position || result.data;
      if (position === undefined || position === null) {
        throw new Error(result.error || 'Failed to fetch league position');
      }
      
      return position;
    } catch (error) {
      console.error('Error fetching league position:', error);
      throw error;
    }
  }
}