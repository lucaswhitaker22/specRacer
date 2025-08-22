import { Router, Request, Response } from 'express';
import { PlayerService } from '../services/PlayerService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const playerService = new PlayerService();

/**
 * Get current player profile
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).playerId;
    const profile = await playerService.getPlayerProfile(playerId);

    if (!profile) {
      res.status(404).json({
        error: 'Player profile not found'
      });
      return;
    }

    res.json({
      profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to retrieve player profile'
    });
  }
});

/**
 * Update player profile
 */
router.put('/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).playerId;
    const updates = req.body;

    // Only allow email updates for now
    const allowedUpdates = { email: updates.email };
    
    const updatedPlayer = await playerService.updatePlayerProfile(playerId, allowedUpdates);

    res.json({
      message: 'Profile updated successfully',
      player: updatedPlayer
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update profile'
    });
  }
});

/**
 * Get player race history
 */
router.get('/race-history', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).playerId;
    const limit = parseInt(req.query.limit as string) || 50;

    const raceHistory = await playerService.getPlayerRaceHistory(playerId, limit);

    res.json({
      raceHistory
    });
  } catch (error) {
    console.error('Get race history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve race history'
    });
  }
});

/**
 * Get player statistics
 */
router.get('/statistics', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).playerId;
    const statistics = await playerService.calculatePlayerStatistics(playerId);

    res.json({
      statistics
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve player statistics'
    });
  }
});

/**
 * Get league standings
 */
router.get('/league-standings', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const standings = await playerService.getLeagueStandings(limit);

    res.json({
      standings
    });
  } catch (error) {
    console.error('Get league standings error:', error);
    res.status(500).json({
      error: 'Failed to retrieve league standings'
    });
  }
});

/**
 * Get player's league position
 */
router.get('/league-position', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).playerId;
    const position = await playerService.getPlayerLeaguePosition(playerId);

    res.json({
      position
    });
  } catch (error) {
    console.error('Get league position error:', error);
    res.status(500).json({
      error: 'Failed to retrieve league position'
    });
  }
});

/**
 * Get player by ID (public endpoint)
 */
router.get('/:playerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { playerId } = req.params;
    const player = await playerService.getPlayerById(playerId);

    if (!player) {
      res.status(404).json({
        error: 'Player not found'
      });
      return;
    }

    // Return public player information only
    res.json({
      player: {
        id: player.id,
        username: player.username,
        totalRaces: player.totalRaces,
        wins: player.wins,
        leaguePoints: player.leaguePoints
      }
    });
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({
      error: 'Failed to retrieve player information'
    });
  }
});

/**
 * Deactivate account
 */
router.delete('/account', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = (req as any).playerId;
    await playerService.deactivatePlayer(playerId);

    res.json({
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      error: 'Failed to deactivate account'
    });
  }
});

export default router;