import { Player, PlayerProfile, PlayerStatistics, LoginCredentials, RegisterData, AuthToken, RaceResult, LeagueStanding } from '../../../shared/types/player';
export declare class PlayerService {
    private get db();
    private readonly JWT_SECRET;
    private readonly JWT_EXPIRES_IN;
    private readonly SALT_ROUNDS;
    registerPlayer(registerData: RegisterData): Promise<Player>;
    authenticatePlayer(credentials: LoginCredentials): Promise<AuthToken>;
    verifyToken(token: string): Promise<string>;
    getPlayerById(playerId: string): Promise<Player | null>;
    getPlayerProfile(playerId: string): Promise<PlayerProfile | null>;
    getPlayerRaceHistory(playerId: string, limit?: number): Promise<RaceResult[]>;
    calculatePlayerStatistics(playerId: string): Promise<PlayerStatistics>;
    updatePlayerStats(playerId: string, raceResult: RaceResult): Promise<void>;
    getLeagueStandings(limit?: number): Promise<LeagueStanding[]>;
    getPlayerLeaguePosition(playerId: string): Promise<number>;
    updatePlayerProfile(playerId: string, updates: Partial<Pick<Player, 'email'>>): Promise<Player>;
    deactivatePlayer(playerId: string): Promise<void>;
    isUsernameAvailable(username: string): Promise<boolean>;
    isEmailAvailable(email: string): Promise<boolean>;
}
//# sourceMappingURL=PlayerService.d.ts.map